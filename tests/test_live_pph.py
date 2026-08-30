"""Live PPH on the dashboard pill: driven by DOP unload hours and the running
package count. Red under 500, green at or above.
"""
from _boot import boot
from playwright.sync_api import sync_playwright

# put a fixed number of unload hours on the board
UNLOAD = """(h)=>{htSyncFromWallyShift();
  hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null;e.role=null;
                                   e.manualRole=null;e.frozenHours=0;e.cutTime=null;e.pausedMs=0;});
  const es=hoursState.employees.slice(0,6);
  es.forEach(e=>{htActivateEmployee(e.id);e.startTime=new Date(Date.now()-h*3600000);});
  htSaveState();htRenderAll();updateNameplate();
  return +getUnloadHours().toFixed(2);}"""

with sync_playwright() as p:
    b, pg, errs = boot(p)
    ok = True
    pg.evaluate("()=>{pphLog=[];savePphLog();}")

    hrs = pg.evaluate(UNLOAD, 2)
    pg.wait_for_timeout(350)
    print(f'unload hours on the board: {hrs}')
    ok &= hrs > 0

    pill = pg.evaluate("()=>({p:byId('nameplate-pph-val').textContent,h:byId('nameplate-hours-val').textContent})")
    ok &= pill['p'] in ('—', '-')
    print(f"pill before any volume: {pill['p']!r} / {pill['h']!r}")

    # record a count that lands well over target
    vol = round(1000 * hrs)
    pg.evaluate("(v)=>{recordVolume(v);updateNameplate();}", vol)
    pg.wait_for_timeout(300)
    got = pg.evaluate("()=>byId('nameplate-pph-val').textContent")
    ok &= got == '1000'
    print(f'{vol} pkgs over {hrs} hrs -> {got} PPH (want 1000): {got == "1000"}')

    # PPH holds until a new count is entered, even as hours grow
    pg.evaluate("()=>{hoursState.employees.filter(e=>e.status==='active')"
                ".forEach(e=>{e.startTime=new Date(e.startTime.getTime()-3600000)});"
                "htSaveState();htRenderAll();updateNameplate();}")
    pg.wait_for_timeout(300)
    after = pg.evaluate("()=>({p:byId('nameplate-pph-val').textContent,h:byId('nameplate-hours-val').textContent})")
    ok &= after['p'] == '1000'
    print(f"hours now {after['h']}; PPH held at {after['p']!r} until a new count: {after['p'] == '1000'}")

    # ---- colour thresholds ----
    print()
    for target, want in [(1000, 'green'), (500, 'green'), (499, 'red'), (420, 'red')]:
        h = pg.evaluate("()=>getUnloadHours()")
        pg.evaluate("(v)=>{recordVolume(v);updateNameplate();}", round(target * h))
        pg.wait_for_timeout(200)
        r = pg.evaluate("()=>{const box=byId('nameplate-hours');return{v:byId('nameplate-pph-val').textContent,"
                        "low:box.classList.contains('under'),cls:box.className};}")
        got_c = 'red' if r['low'] else 'green'
        good = got_c == want
        ok &= good
        print(f"{r['v']:>6} PPH -> {got_c:5s} (want {want})  {'OK' if good else 'FAIL'}")

    # a new shift clears the volume log
    pg.evaluate("()=>{confirmStartShift(true);}")
    pg.wait_for_timeout(400)
    ok &= pg.evaluate("()=>pphLog.length===0")
    print(f'\nnew shift clears the volume log: {pg.evaluate("()=>pphLog.length===0")}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
