"""Cut employees stay in the ranking at their frozen hours -- they are neither
removed from the list nor pinned to the position they held when cut.
"""
from _boot import boot
from playwright.sync_api import sync_playwright

ORDER = """()=>[...document.querySelectorAll('.ht-emp-row')].map(r=>({
    name:r.querySelector('.ht-emp-name').textContent.trim(),
    cut:r.classList.contains('ht-cut'),
    rank:r.querySelector('.ht-rank')?r.querySelector('.ht-rank').textContent.trim():null}))"""

with sync_playwright() as p:
    b, pg, errs = boot(p)
    pg.click('#tab-btn-hours'); pg.wait_for_timeout(300)
    ok = True

    names = pg.evaluate("""()=>{htSyncFromWallyShift();
        hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null;e.role=null;
                                         e.manualRole=null;e.frozenHours=0;e.cutTime=null;e.pausedMs=0;});
        const es=hoursState.employees.slice(0,4);
        es.forEach((e,i)=>{htActivateEmployee(e.id);e.startTime=new Date(Date.now()-(4-i)*3600000);});
        htSaveState();htRenderAll();return es.map(e=>e.name);}""")
    pg.wait_for_timeout(300)

    top = pg.evaluate(ORDER)[0]['name']
    print(f'top of the board before the cut: {top}')

    # cut the leader -- they must remain listed, still first (highest frozen hours)
    pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);htCutEmployee(e.id);}", top)
    pg.wait_for_timeout(350)
    rows = pg.evaluate(ORDER)
    still = [r for r in rows if r['name'] == top]
    ok &= len(still) == 1 and still[0]['cut'] and rows[0]['name'] == top
    print(f'still on the board after the cut: {len(still) == 1}, marked cut: {still[0]["cut"]}')
    print(f'still ranked first on frozen hours: {rows[0]["name"] == top}')

    # controls on a cut row must stay usable, not look disabled
    op = pg.eval_on_selector('.ht-emp-row.ht-cut', "e=>parseFloat(getComputedStyle(e).opacity)")
    ok &= op > 0.85
    print(f'cut row opacity {op} (not greyed out): {op > 0.85}')

    # let an active employee accumulate past the frozen total -- the cut one drops
    pg.evaluate("""(n)=>{const e=hoursState.employees.find(x=>x.name===n);
        e.startTime=new Date(Date.now()-60*3600000);htSaveState();htRenderAll();}""", names[3])
    pg.wait_for_timeout(350)
    rows2 = pg.evaluate(ORDER)
    pos = [i for i, r in enumerate(rows2) if r['name'] == top][0]
    ok &= rows2[0]['name'] == names[3] and pos > 0
    print(f'\novertaken: {names[3]} is now first, {top} dropped to position {pos + 1}')

    # ranks are contiguous 1..n across active and cut alike
    ranks = [r['rank'] for r in rows2 if r['rank'] and r['rank'].isdigit()]
    ok &= ranks == [str(i) for i in range(1, len(ranks) + 1)]
    print(f'ranks contiguous across active and cut: {ranks}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
