import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')

SETUP = """()=>{htSyncFromWallyShift();
  hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null;e.manualRole=null;
                                   e.role=null;e.frozenHours=0;e.cutTime=null;});
  const es=hoursState.employees.slice(0,3);
  es.forEach(e=>{htActivateEmployee(e.id); e.startTime=new Date(Date.now()-2*3600000);});
  htSaveState(); htCutEmployee(es[0].id); htRenderAll();
  return es[0].name;}"""


def subj(pg, name):
    return pg.evaluate("""(n)=>{const e=hoursState.employees.find(x=>x.name===n);
        return {st:e.status, role:e.role, manual:e.manualRole,
                hrs:+htCalcHours(e).toFixed(4), cut:e.cutTime,
                start:e.startTime?e.startTime.toTimeString().slice(0,5):null};}""", name)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 393, 'height': 852})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.evaluate("()=>{window.obsValidateAgainstDOP=()=>false;}")
    pg.click('#tab-btn-hours'); pg.wait_for_timeout(300)
    ok = True

    name = pg.evaluate(SETUP)
    pg.wait_for_timeout(400)
    print(f'subject: {name}')
    print('cut state:', subj(pg, name))

    # ---- 1 & 2. edit START and END together in one editor ----
    pg.click('.ht-emp-row.ht-cut .ht-btn-time'); pg.wait_for_timeout(450)
    opened = pg.is_visible('#ht-edit-times-modal')
    times = pg.evaluate("""()=>{const pad=n=>String(n).padStart(2,'0');
        const f=ms=>{const d=new Date(Date.now()-ms);return pad(d.getHours())+':'+pad(d.getMinutes());};
        return {start:f(4*3600000), end:f(30*60000)};}""")  # 4h ago -> 30m ago = 3.50h
    pg.fill('#ht-edit-start', times['start'])
    pg.fill('#ht-edit-end', times['end'])
    pg.wait_for_timeout(300)
    preview = pg.eval_on_selector('#ht-edit-preview', 'e=>e.textContent')
    pg.click('#ht-edit-times-modal >> text=Save'); pg.wait_for_timeout(500)
    s = subj(pg, name)
    times_ok = opened and s['start'] == times['start'] and abs(s['hrs'] - 3.5) < 0.02
    ok &= times_ok
    print(f"1. edit start+end {times['start']}-{times['end']} -> start {s['start']}, hrs {s['hrs']} (preview said {preview})  {'OK' if times_ok else 'FAIL'}")

    # ---- 3. edit ROLE on a cut employee ----
    pg.click('.ht-emp-row.ht-cut'); pg.wait_for_timeout(450)
    role_modal = pg.is_visible('#ht-role-modal')
    print(f'3. tapping a cut row opens the role picker: {role_modal}')
    if role_modal:
        pg.screenshot(path=f'{SHOT}/cut_role_modal.png')
        opts = pg.eval_on_selector_all('#ht-role-modal .ht-role-option', 'e=>e.length')
        print(f'   role options offered: {opts}')
        # pick Bulk explicitly
        pg.click("#ht-role-modal >> text=Bulk Sweep"); pg.wait_for_timeout(500)
        s = subj(pg, name)
        role_ok = s['role'] == 'bulk' and s['st'] == 'cut'
        ok &= role_ok
        print(f"   role now {s['role']!r}, still cut={s['st']=='cut'}  {'OK' if role_ok else 'FAIL'}")
        print(f"   hours preserved: {s['hrs']}")
    else:
        ok = False

    # ---- 4. reinstate ----
    pg.wait_for_timeout(200)
    if pg.eval_on_selector_all('.ht-emp-row.ht-cut .ht-btn-undo', 'e=>e.length'):
        pg.click('.ht-emp-row.ht-cut .ht-btn-undo'); pg.wait_for_timeout(500)
    s = subj(pg, name)
    re_ok = s['st'] == 'active' and s['cut'] is None and s['hrs'] > 3.4
    ok &= re_ok
    print(f"4. reinstate -> status {s['st']}, hrs {s['hrs']} (kept), cutTime cleared={s['cut'] is None}  {'OK' if re_ok else 'FAIL'}")

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
