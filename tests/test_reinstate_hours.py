import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

SETUP = """()=>{htSyncFromWallyShift();
  hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null;e.manualRole=null;
                                   e.role=null;e.frozenHours=0;e.cutTime=null;e.pausedMs=0;});
  const es=hoursState.employees.slice(0,3);
  es.forEach(e=>{htActivateEmployee(e.id); e.startTime=new Date(Date.now()-3*3600000);});
  htSaveState(); htRenderAll();
  return es[0].name;}"""


def state(pg, n):
    return pg.evaluate("""(n)=>{const e=hoursState.employees.find(x=>x.name===n);
        return {st:e.status, hrs:+htCalcHours(e).toFixed(3), paused:+( (e.pausedMs||0)/3600000 ).toFixed(3),
                start:e.startTime?e.startTime.toTimeString().slice(0,5):null};}""", n)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 393, 'height': 852})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.click('#tab-btn-hours'); pg.wait_for_timeout(300)
    ok = True

    name = pg.evaluate(SETUP)
    pg.wait_for_timeout(300)
    s0 = state(pg, name)
    print(f'{name} clocked in at {s0["start"]}, 3h ago -> {s0["hrs"]} hrs')
    ok &= abs(s0['hrs'] - 3.0) < 0.02

    # cut now
    pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);htCutEmployee(e.id);}", name)
    pg.wait_for_timeout(300)
    s1 = state(pg, name)
    print(f'cut          -> {s1["hrs"]} hrs (frozen)')
    ok &= abs(s1['hrs'] - 3.0) < 0.02

    # simulate 2 hours passing while cut, then reinstate.
    # worked 3h then cut for 2h => clocked in 5h ago, cut 2h ago
    pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);"
                "e.startTime=new Date(Date.now()-5*3600000);"
                "e.cutTime=Date.now()-2*3600000;"
                "e.frozenHours=3;htSaveState();}", name)
    pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);htUncutEmployee(e.id);}", name)
    pg.wait_for_timeout(400)
    s2 = state(pg, name)
    print(f'reinstated 2h later -> {s2["hrs"]} hrs, banked pause {s2["paused"]} h, clock-in still {s2["start"]}')
    resumed = abs(s2['hrs'] - 3.0) < 0.02
    banked = abs(s2['paused'] - 2.0) < 0.02
    kept_start = s2['start'] == pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);"
                                            "return e.startTime.toTimeString().slice(0,5);}", name)
    ok &= resumed and banked and kept_start
    print(f'   resumes from accumulated 3.00 (not 5.00): {resumed}')
    print(f'   gap banked rather than credited:          {banked}')
    print(f'   original clock-in time preserved:         {kept_start}')

    # and it keeps accruing from here
    pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);"
                "e.startTime=new Date(e.startTime.getTime()-30*60000);htSaveState();}", name)
    s3 = state(pg, name)
    gained = abs((s3['hrs'] - s2['hrs']) - 0.5) < 0.02
    ok &= gained
    print(f'   still accruing after reinstate (+0.5h):   {gained} ({s2["hrs"]} -> {s3["hrs"]})')

    # a second cut freezes at the corrected total, not the gross elapsed
    pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);htCutEmployee(e.id);}", name)
    pg.wait_for_timeout(300)
    s4 = state(pg, name)
    second = abs(s4['hrs'] - s3['hrs']) < 0.02
    ok &= second
    print(f'   second cut freezes at {s4["hrs"]} (expect {s3["hrs"]}): {second}')

    # editing the cut time still honours the banked pause
    pg.evaluate("""(n)=>{const e=hoursState.employees.find(x=>x.name===n);
        hoursState.pendingCutTimeId=e.id;
        const t=new Date(); document.getElementById('ht-custom-time').value=
            String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
        htApplyCustomTime();}""", name)
    pg.wait_for_timeout(300)
    s5 = state(pg, name)
    edit_ok = abs(s5['hrs'] - s4['hrs']) < 0.05
    ok &= edit_ok
    print(f'   cut-time edit keeps the pause excluded: {edit_ok} ({s5["hrs"]})')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
