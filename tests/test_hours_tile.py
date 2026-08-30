import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')


def tile(pg):
    raw = pg.eval_on_selector('#nameplate-hours-val', 'e=>e.textContent.trim()')
    import re
    m = re.search(r'([\d.]+)\s*hrs', raw)
    return m.group(1) if m else raw


def dop_unload(pg):
    return pg.eval_on_selector('#ht-kpi-unload', 'e=>e.textContent.trim()')


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
    pg.wait_for_timeout(300)
    ok = True

    print('idle tile:', tile(pg))
    ok &= tile(pg) == '0.00'

    # start the shift for real (KPIs are gated on shiftStarted), then clock in
    # three people with known roles: 2 unload, 1 belt
    pg.evaluate("()=>{htSyncFromWallyShift();htSaveState();htRenderAll();}")
    pg.evaluate("""()=>{
        const es=hoursState.employees.slice(0,3);
        es.forEach(e=>htActivateEmployee(e.id));
        es[0].startTime=new Date(Date.now()-3600000); es[0].manualRole='unload'; es[0].role='unload';
        es[1].startTime=new Date(Date.now()-1800000); es[1].manualRole='unload'; es[1].role='unload';
        es[2].startTime=new Date(Date.now()-3600000); es[2].manualRole='belt';   es[2].role='belt';
        htSaveState(); htRenderAll();}""")
    pg.wait_for_timeout(400)

    pg.click('#tab-btn-hours'); pg.wait_for_timeout(400)
    dop = dop_unload(pg)
    pg.click('#tab-btn-dashboard'); pg.wait_for_timeout(400)
    dash = tile(pg)
    print(f'DOP UNLOAD tile = {dop}   dashboard tile = {dash}')
    ok &= (dop == dash)
    # 1.0 + 0.5 unload hours; the belt hour must NOT be counted
    ok &= abs(float(dash) - 1.5) < 0.02
    print(f'excludes the Belt hour (expect ~1.50): {dash}')
    pg.screenshot(path=f'{SHOT}/hours_tile.png')

    # cutting an unloader freezes but still counts (matches the DOP tile)
    pg.evaluate("()=>{const e=hoursState.employees[0];htCutEmployee(e.id);}")
    pg.click('#tab-btn-hours'); pg.wait_for_timeout(350)
    dop2 = dop_unload(pg)
    pg.click('#tab-btn-dashboard'); pg.wait_for_timeout(350)
    dash2 = tile(pg)
    print(f'after cutting an unloader: DOP={dop2}  dashboard={dash2}')
    ok &= (dop2 == dash2)

    # manual add is gone from the nameplate and present in Tools
    gone = pg.eval_on_selector_all('.nameplate-actions .icon-btn', 'e=>e.length') == 0
    pg.click('#tab-btn-tools'); pg.wait_for_timeout(350)
    titles = pg.eval_on_selector_all('.tool-title', 'e=>e.map(x=>x.textContent.trim())')
    print('nameplate icon removed:', gone, '| tools cards:', titles)
    ok &= gone and 'Manual Add' in titles
    pg.screenshot(path=f'{SHOT}/tools_with_manual.png')

    # and it still opens
    pg.click("text=Manual Add"); pg.wait_for_timeout(400)
    opened = pg.is_visible('#manual-add-modal')
    print('Manual Add modal opens:', opened)
    ok &= opened

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
