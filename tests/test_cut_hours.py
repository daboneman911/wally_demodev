import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
import time
from playwright.sync_api import sync_playwright


def kpis(pg):
    return pg.evaluate("""()=>({
        belt:document.getElementById('ht-kpi-belt').textContent.trim(),
        bulk:document.getElementById('ht-kpi-bulk').textContent.trim(),
        unload:document.getElementById('ht-kpi-unload').textContent.trim(),
        dash:document.getElementById('nameplate-hours-val').textContent.trim()})""")


def roster(pg):
    return pg.evaluate("""()=>hoursState.employees.slice(0,4).map(e=>
        ({n:e.name,st:e.status,role:e.role,h:+htCalcHours(e).toFixed(2)}))""")


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 393, 'height': 852})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)
    # observations are exercised in test_observation; stub the DOP cross-check here
    # so its reassignment popup cannot intercept clicks in these suites
    pg.evaluate("()=>{window.obsValidateAgainstDOP=()=>false;}")
    ok = True

    # start shift, clock in 4 people: force 3 unloaders + 1 belt
    pg.evaluate("()=>{htSyncFromWallyShift();htSaveState();}")
    pg.evaluate("""()=>{const es=hoursState.employees.slice(0,4);
        es.forEach(e=>htActivateEmployee(e.id));
        es[0].startTime=new Date(Date.now()-3600000); es[0].manualRole='unload';
        es[1].startTime=new Date(Date.now()-1800000); es[1].manualRole='unload';
        es[2].startTime=new Date(Date.now()-1800000); es[2].manualRole='unload';
        es[3].startTime=new Date(Date.now()-3600000); es[3].manualRole='belt';
        htSaveState(); htRenderAll();}""")
    pg.click('#tab-btn-hours'); pg.wait_for_timeout(400)

    before = kpis(pg)
    print('before cut :', before, )
    print('  roster   :', roster(pg))
    unload_before = float(before['unload'])

    # cut the 1.00-hr unloader
    subj = pg.evaluate("()=>hoursState.employees[0].name")
    frozen = pg.evaluate("()=>+htCalcHours(hoursState.employees[0]).toFixed(2)")
    pg.evaluate("()=>{htCutEmployee(hoursState.employees[0].id);}")
    pg.wait_for_timeout(400)
    after = kpis(pg)
    print(f'cut {subj} ({frozen} hrs)')
    print('after cut  :', after)
    print('  roster   :', roster(pg))

    # 1. no hours may be lost: the buckets must still total everyone's hours
    tot = pg.evaluate("""()=>{const e=hoursState.employees.filter(x=>x.status!=='inactive');
        const sum=e.reduce((s,x)=>s+htCalcHours(x),0);
        const k=['belt','bulk','unload'].reduce((s,r)=>s+e.filter(x=>x.role===r)
            .reduce((t,x)=>t+htCalcHours(x),0),0);
        return {sum:+sum.toFixed(2), buckets:+k.toFixed(2)};}""")
    no_loss = abs(tot['sum'] - tot['buckets']) < 0.02
    ok &= no_loss
    print(f'no hours lost: everyone={tot["sum"]} buckets={tot["buckets"]} -> {no_loss}')

    # 2. the cut employee still holds a role and still counts somewhere
    still_counted = pg.evaluate("()=>{const e=hoursState.employees[0];return !!e.role;}")
    ok &= still_counted
    print('cut employee still ranked into a role:', still_counted)

    # 3. exactly one Belt and at most two Bulk across active + cut
    shape = pg.evaluate("""()=>{const e=hoursState.employees.filter(x=>x.status!=='inactive');
        return {belt:e.filter(x=>x.role==='belt').length, bulk:e.filter(x=>x.role==='bulk').length};}""")
    good_shape = shape['belt'] == 1 and shape['bulk'] <= 2
    ok &= good_shape
    print(f'role shape belt={shape["belt"]} bulk={shape["bulk"]} -> {good_shape}')

    # 4. the timer must actually stop
    h1 = pg.evaluate("()=>+htCalcHours(hoursState.employees[0]).toFixed(4)")
    time.sleep(2)
    pg.evaluate("()=>htRenderAll()")
    h2 = pg.evaluate("()=>+htCalcHours(hoursState.employees[0]).toFixed(4)")
    stopped = (h1 == h2)
    ok &= stopped
    print(f'timer stopped: {stopped} ({h1} -> {h2})')

    # 5. an active person still accumulates -- on the minute, not the second
    # Hours advance on whole minutes, so a real minute rollover inside the 2s window
    # below would look like a failure. Wait until we are clear of the boundary first.
    import datetime
    while datetime.datetime.now().second > 54:
        time.sleep(1)
    a1 = pg.evaluate("()=>htCalcHours(hoursState.employees[1])")
    time.sleep(2)
    a_same = pg.evaluate("()=>htCalcHours(hoursState.employees[1])")
    steady = abs(a_same - a1) < 1e-9
    pg.evaluate("()=>{const e=hoursState.employees[1];"
                "e.startTime=new Date(e.startTime.getTime()-60000);htSaveState();}")
    a2 = pg.evaluate("()=>htCalcHours(hoursState.employees[1])")
    gained = abs((a2 - a1) - 1.0 / 60) < 1e-9
    ok &= steady and gained
    print(f'active employee steady within the minute: {steady} ({a1:.4f})')
    print(f'active gains exactly 1 min on the tick: {gained} ({a1:.4f} -> {a2:.4f})')

    # 6. dashboard mirrors the DOP unload figure
    pg.click('#tab-btn-dashboard'); pg.wait_for_timeout(400)
    dash = pg.eval_on_selector('#nameplate-hours-val', 'e=>e.textContent.trim()')
    pg.click('#tab-btn-hours'); pg.wait_for_timeout(400)
    mirrored = dash == kpis(pg)['unload']
    ok &= mirrored
    print(f'dashboard mirrors DOP: {mirrored} ({dash})')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
