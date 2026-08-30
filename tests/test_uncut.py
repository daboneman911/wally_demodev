"""Cutting and reinstating an employee.

Cutting stops the clock without discarding hours; reinstating resumes from the
hours already accumulated (the stretch spent cut is excluded), restores the
manual role, and un-ends a shift that the cut had ended.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright


def emp(pg, name):
    return pg.evaluate("""(n)=>{const e=hoursState.employees.find(x=>x.name===n);
        return {status:e.status, hasStart:!!e.startTime, cutTime:e.cutTime,
                frozen:e.frozenHours, manualRole:e.manualRole,
                paused:+((e.pausedMs||0)/3600000).toFixed(3),
                hrs:+htCalcHours(e).toFixed(3)};}""", name)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 393, 'height': 852})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.evaluate("()=>{window.obsValidateAgainstDOP=()=>false;}")
    pg.click('#tab-btn-hours')
    pg.wait_for_timeout(300)
    ok = True

    NAME = pg.evaluate("""()=>{htSyncFromWallyShift();
        hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null;e.manualRole=null;
                                         e.role=null;e.frozenHours=0;e.cutTime=null;e.pausedMs=0;});
        const es=hoursState.employees.slice(0,3);
        es.forEach(e=>{htActivateEmployee(e.id); e.startTime=new Date(Date.now()-3*3600000);});
        es[0].manualRole='belt';
        htSaveState(); htRenderAll();
        return es[0].name;}""")
    pg.wait_for_timeout(300)

    a = emp(pg, NAME)
    print(f'{NAME}: active {a["hrs"]} hrs, role pinned {a["manualRole"]!r}')
    ok &= a['status'] == 'active' and abs(a['hrs'] - 3.0) < 0.02

    # ---- cut: clock stops, hours kept ----
    pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);htCutEmployee(e.id);}", NAME)
    pg.wait_for_timeout(300)
    c = emp(pg, NAME)
    cut_ok = c['status'] == 'cut' and c['cutTime'] is not None and abs(c['hrs'] - 3.0) < 0.02
    ok &= cut_ok
    print(f'cut         -> {c["hrs"]} hrs frozen, manualRole cleared: {c["manualRole"] is None}  {"OK" if cut_ok else "FAIL"}')

    # the undo control must actually be on the row
    has_btn = pg.eval_on_selector_all('.ht-emp-row.ht-cut .ht-btn-undo', 'e=>e.length') > 0
    ok &= has_btn
    print(f'undo button rendered on the cut row: {has_btn}')

    # ---- 2 hours pass while cut, then reinstate ----
    pg.evaluate("""(n)=>{const e=hoursState.employees.find(x=>x.name===n);
        e.startTime=new Date(Date.now()-5*3600000);
        e.cutTime=Date.now()-2*3600000;
        e.frozenHours=3; htSaveState();}""", NAME)
    pg.eval_on_selector('.ht-emp-row.ht-cut .ht-btn-undo', 'e=>e.click()')
    pg.wait_for_timeout(450)
    u = emp(pg, NAME)
    resumed = abs(u['hrs'] - 3.0) < 0.02
    banked = abs(u['paused'] - 2.0) < 0.02
    role_back = u['manualRole'] == 'belt'
    ok &= u['status'] == 'active' and u['cutTime'] is None and resumed and banked and role_back
    print(f'reinstated  -> {u["hrs"]} hrs (resumes from 3.00, not 5.00): {resumed}')
    print(f'               {u["paused"]} h off the clock banked, not credited: {banked}')
    print(f'               manual role restored: {role_back}')

    # ---- cutting the last active person ends the shift; undo un-ends it ----
    pg.evaluate("()=>{hoursState.employees.forEach(e=>{if(e.status==='active')htCutEmployee(e.id);});}")
    ended = pg.evaluate("()=>hoursState.shiftEnded")
    pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);htUncutEmployee(e.id);}", NAME)
    after = pg.evaluate("()=>hoursState.shiftEnded")
    ok &= (ended is True and after is False)
    print(f'shiftEnded  -> after cutting everyone {ended}, after undo {after}')

    # ---- undo is a safe no-op on someone who isn't cut ----
    before = emp(pg, NAME)
    pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);htUncutEmployee(e.id);}", NAME)
    noop = emp(pg, NAME) == before
    ok &= noop
    print(f'undo on a non-cut employee is a no-op: {noop}')

    # ---- survives reload ----
    pg.reload()
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.wait_for_timeout(400)
    r = emp(pg, NAME)
    ok &= r['status'] == 'active'
    print(f'after reload -> {r["status"]}, {r["hrs"]} hrs')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
