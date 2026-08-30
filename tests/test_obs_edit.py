"""Past observations in the Recent list can be reopened and corrected.

Status is not just a label: only 'done' entries count toward the rotation cycle,
so flipping it has to move the person in and out of the eligible pool.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

SEED = """()=>{
  const k=(n)=>{const d=new Date();if(d.getHours()<12)d.setDate(d.getDate()-1);
                d.setDate(d.getDate()-n);return dateKeyFromTs(d.getTime());};
  obsState={assignments:{},cycle:1};
  obsState.assignments[k(2)]={name:'Robert W',status:'done',cycle:1,auto:false};
  obsState.assignments[k(1)]={name:'Matt R',status:'pending',cycle:1,auto:true,skipped:['Lorena R']};
  saveObsState();obsEnsureToday();obsRenderAll();
  return {two:k(2),one:k(1),today:obsTodayKey()};}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 393, 'height': 852})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.wait_for_timeout(300)
    ok = True

    keys = pg.evaluate(SEED)
    pg.evaluate("()=>openObservation()")
    pg.wait_for_timeout(350)

    rows = pg.eval_on_selector_all('#obs-history-list .obs-history-row', 'e=>e.length')
    clickable = pg.eval_on_selector_all('#obs-history-list .obs-history-row',
                                        "e=>e.every(x=>getComputedStyle(x).cursor==='pointer')")
    ok &= rows == 3 and clickable
    print(f'{rows} history rows, all clickable: {clickable}')

    # today's row is labelled
    marked = pg.eval_on_selector_all('#obs-history-list .note-history-entry-date',
                                     "e=>e.filter(x=>x.textContent.includes('today')).length")
    ok &= marked == 1
    print(f"exactly one row marked 'today': {marked == 1}")

    # ---- open the oldest entry ----
    pg.eval_on_selector_all('#obs-history-list .obs-history-row', 'e=>e[2].click()')
    pg.wait_for_timeout(300)
    shown = pg.eval_on_selector('#obs-edit-modal', "e=>getComputedStyle(e).display!=='none'")
    date = pg.eval_on_selector('#obs-edit-date', 'e=>e.textContent')
    sel = pg.eval_on_selector('#obs-edit-status-done', "e=>e.classList.contains('selected')")
    ok &= shown and keys['two'] in date and sel
    print(f"\nopened {date!r}: modal={shown}, 'Observed' preselected={sel}")

    # Robert W is done this cycle, so he is out of the rotation
    before = pg.evaluate("()=>obsCompletedThisCycle()")
    pg.click('#obs-edit-status-pending')
    pg.wait_for_timeout(250)
    after = pg.evaluate("()=>obsCompletedThisCycle()")
    flipped = pg.evaluate("(k)=>obsState.assignments[k].status", keys['two'])
    back_in = 'Robert W' in before and 'Robert W' not in after
    ok &= flipped == 'pending' and back_in
    print(f"status -> {flipped!r}; cycle-complete {before} -> {after}")
    print(f"   reverting returns Robert W to the rotation: {back_in}")

    # ---- change the employee ----
    pg.select_option('#obs-edit-name', 'Trevon C')
    pg.wait_for_timeout(250)
    a = pg.evaluate("(k)=>({name:obsState.assignments[k].name,auto:obsState.assignments[k].auto})", keys['two'])
    ok &= a['name'] == 'Trevon C' and a['auto'] is False
    print(f"\nemployee -> {a['name']!r}, auto-flag cleared: {a['auto'] is False}")

    # the change is reflected in the list behind it
    pg.click('#obs-edit-modal .modal-close-btn')
    pg.wait_for_timeout(300)
    txt = pg.eval_on_selector('#obs-history-list', 'e=>e.textContent')
    ok &= 'Trevon C' in txt
    print(f'   list behind refreshed: {"Trevon C" in txt}')

    # ---- an off-roster observee stays selectable ----
    pg.evaluate("(k)=>{obsState.assignments[k].name='Ghost Person';saveObsState();obsRenderAll();}", keys['two'])
    pg.evaluate("(k)=>obsOpenEdit(k)", keys['two'])
    pg.wait_for_timeout(250)
    g = pg.eval_on_selector('#obs-edit-name', "e=>({val:e.value,n:e.options.length})")
    ok &= g['val'] == 'Ghost Person'
    print(f"\noff-roster name kept in the list: {g['val']!r} among {g['n']} options")
    pg.click('#obs-edit-modal .modal-close-btn'); pg.wait_for_timeout(200)

    # ---- delete a past entry ----
    pg.on('dialog', lambda d: d.accept())
    pg.evaluate("(k)=>obsOpenEdit(k)", keys['one'])
    pg.wait_for_timeout(250)
    pg.click('text=Delete Entry')
    pg.wait_for_timeout(350)
    gone = pg.evaluate("(k)=>!obsState.assignments[k]", keys['one'])
    closed = pg.eval_on_selector('#obs-edit-modal', "e=>getComputedStyle(e).display==='none'")
    ok &= gone and closed
    print(f'\ndeleted a past entry: {gone}, sheet closed: {closed}')

    # ---- deleting TODAY must leave a pick in place ----
    pg.evaluate("()=>obsOpenEdit(obsTodayKey())")
    pg.wait_for_timeout(250)
    pg.click('text=Delete Entry')
    pg.wait_for_timeout(350)
    t = pg.evaluate("()=>{const c=obsToday();return c?c.name:null}")
    ok &= t is not None
    print(f'deleting today reassigns rather than leaving it empty: {t!r}')

    # ---- survives reload ----
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(400)
    kept = pg.evaluate("(k)=>{const a=obsState.assignments[k];return a?a.name:null}", keys['two'])
    ok &= kept == 'Ghost Person'
    print(f'edits persist across reload: {kept!r}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
