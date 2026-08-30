"""Nightly Checklist: seven tasks, Observation mirrored from the tracker,
share on completion, cleared at shift end.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

TASKS = ['Pre-sort DECR', 'Post-sort DECR', 'Observation',
         'Validate staffing', 'Check slide', 'Walk belt', 'Gratings clear']

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 393, 'height': 852})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.wait_for_timeout(400)
    ok = True

    # capture navigator.share instead of really opening a sheet
    pg.evaluate("""()=>{window.__shared=[];
        navigator.share=(d)=>{window.__shared.push(d);return Promise.resolve();};}""")

    pg.click('#tab-btn-tools'); pg.wait_for_timeout(300)
    card = pg.eval_on_selector_all('.tool-card', "e=>e.map(x=>x.textContent.trim())")
    has_card = any('Nightly Checklist' in t for t in card)
    ok &= has_card
    print(f'tool card present: {has_card}  ({len(card)} tools)')

    pg.click('text=Nightly Checklist'); pg.wait_for_timeout(400)
    labels = pg.eval_on_selector_all('#checklist-items .cl-label', 'e=>e.map(x=>x.textContent)')
    ok &= labels == TASKS
    print(f'{len(labels)} tasks in order: {labels == TASKS}')

    dis = pg.eval_on_selector('#checklist-share-btn', 'e=>e.disabled')
    ok &= dis
    print(f'share disabled while incomplete: {dis}')

    # ---- Observation row mirrors the tracker ----
    obs_i = TASKS.index('Observation')
    who = pg.evaluate("()=>obsToday().name")
    meta = pg.eval_on_selector_all('#checklist-items .cl-meta', 'e=>e.map(x=>x.textContent)')
    ok &= meta == [who]
    print(f"\nObservation row names tonight's observee ({who!r}): {meta == [who]}")

    pg.eval_on_selector_all('#checklist-items .cl-item', f'e=>e[{obs_i}].click()')
    pg.wait_for_timeout(300)
    st = pg.evaluate("()=>obsToday().status")
    ok &= st == 'done'
    print(f'ticking it marks the tracker observed: {st == "done"}')

    # and the reverse: tracker -> checklist
    pg.evaluate("()=>obsReopen()")
    pg.wait_for_timeout(250)
    on = pg.eval_on_selector_all('#checklist-items .cl-item', f'e=>e[{obs_i}].classList.contains("done")')
    ok &= not on
    print(f'reopening in the tracker unticks the row: {not on}')

    # editing a past-day sheet for today also flows through
    pg.evaluate("()=>{obsOpenEdit(obsTodayKey());obsEditSetStatus('done');closeModal('obs-edit-modal');}")
    pg.wait_for_timeout(300)
    on = pg.eval_on_selector_all('#checklist-items .cl-item', f'e=>e[{obs_i}].classList.contains("done")')
    ok &= on
    print(f'editing the entry re-ticks the row: {on}')

    # ---- complete the rest; the last tick fires the share sheet ----
    for i in range(len(TASKS)):
        if i == obs_i:
            continue
        pg.eval_on_selector_all('#checklist-items .cl-item', f'e=>e[{i}].click()')
        pg.wait_for_timeout(120)
    pg.wait_for_timeout(400)

    shared = pg.evaluate("()=>window.__shared")
    fired = len(shared) == 1
    ok &= fired
    print(f'\nshare sheet auto-opened once on the final tick: {fired}')
    text = shared[0]['text'] if shared else ''
    print('--- shared text ---')
    print(text)
    print('-------------------')
    last = who.split()[-1]
    body_ok = text == f'DECR/OBS - {last}'
    ok &= body_ok
    print(f'single line, observee last name only: {body_ok}  (from {who!r})')
    # no date, and none of the other four tasks
    import re as _re
    no_date = not _re.search(r'\d{1,2}/\d{1,2}|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec', text)
    extra = [t for t in ['staffing', 'slide', 'belt', 'Gratings'] if t.lower() in text.lower()]
    ok &= no_date and not extra
    print(f'no date in the report: {no_date}')
    print(f'other tasks kept out of the message: {not extra}  {extra}')

    en = pg.eval_on_selector('#checklist-share-btn', 'e=>({d:e.disabled,t:e.textContent})')
    ok &= (not en['d']) and en['t'] == 'Share Again'
    print(f"share button now {en['t']!r}, enabled: {not en['d']}")

    # re-sharing by button does not require a re-tick
    pg.click('#checklist-share-btn'); pg.wait_for_timeout(300)
    ok &= len(pg.evaluate("()=>window.__shared")) == 2
    print(f'button re-shares: {len(pg.evaluate("()=>window.__shared")) == 2}')

    # ---- persistence, then shift end clears it ----
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(400)
    pg.evaluate("()=>openChecklist()"); pg.wait_for_timeout(300)
    kept = pg.eval_on_selector_all('#checklist-items .cl-item', "e=>e.filter(x=>x.classList.contains('done')).length")
    ok &= kept == 7
    print(f'\nsurvives reload: {kept}/7 still ticked')

    pg.evaluate("()=>confirmEndShift(true)"); pg.wait_for_timeout(500)
    after = pg.evaluate("()=>({tasks:Object.values(checklistState.tasks).filter(Boolean).length,shared:checklistState.shared})")
    ok &= after['tasks'] == 0 and after['shared'] is False
    print(f'shift end clears it: {after}')

    # ticking Observation with nobody assigned must not silently no-op
    pg.evaluate("()=>{obsState={assignments:{},cycle:1};saveObsState();}")
    guarded = pg.evaluate("()=>{try{checklistToggle('observation');return true}catch(e){return String(e)}}")
    ok &= guarded is True
    print(f'no observee assigned -> guarded, no crash: {guarded is True}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
