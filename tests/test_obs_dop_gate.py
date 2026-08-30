"""The observation reassignment must wait until DOP is MET, not fire on the first
clock-in. With dopConfig 6 that means 1 belt + 2 bulk + 6 unload = 9 staffed.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

# clock in N employees, deliberately excluding the observee
STAFF = """(a)=>{const [n,skip]=a;
  htSyncFromWallyShift();
  hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null;e.manualRole=null;
                                   e.role=null;e.frozenHours=0;e.cutTime=null;e.pausedMs=0;});
  const pool=hoursState.employees.filter(e=>e.name!==skip).slice(0,n);
  pool.forEach(e=>{htActivateEmployee(e.id); e.startTime=new Date(Date.now()-3600000);});
  htSaveState(); htRenderAll();
  const d=htCalcDOP();
  return {active:hoursState.employees.filter(e=>e.status==='active').length,
          dopState:d.dopState, delta:d.delta};}"""


def today(pg):
    return pg.evaluate("()=>{const t=obsToday();return t?{name:t.name,auto:!!t.auto}:null}")


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 393, 'height': 852})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.wait_for_timeout(400)
    ok = True

    cfg = pg.evaluate("()=>hoursState.dopConfig")
    need = 1 + 2 + cfg
    print(f'dopConfig {cfg} -> DOP met at {need} staffed\n')
    print(f"{'staffed':>8} {'dop':>6} {'delta':>6}  {'reassigned?':12s} {'popup':6s} expected")

    for n in [1, 3, 5, need - 1, need, need + 1]:
        # fresh observation state each scenario
        pg.evaluate("()=>{obsState={assignments:{},cycle:1};saveObsState();obsEnsureToday();obsRenderAll();}")
        pg.evaluate("()=>{const m=byId('obs-swap-modal');if(m)m.style.display='none';}")
        target = today(pg)['name']

        d = pg.evaluate(STAFF, [n, target])
        pg.wait_for_timeout(350)

        after = today(pg)
        reassigned = after['name'] != target
        popup = pg.eval_on_selector('#obs-swap-modal', "e=>getComputedStyle(e).display!=='none'")
        should = d['delta'] >= 0          # only once every position is filled
        good = (reassigned == should) and (popup == should)
        ok &= good
        print(f"{d['active']:>8} {d['dopState']:>6} {d['delta']:>6}  "
              f"{str(reassigned):12s} {str(popup):6s} {'fire' if should else 'hold'}  "
              f"{'OK' if good else 'FAIL'}")
        if popup:
            pg.evaluate("()=>{const m=byId('obs-swap-modal');if(m)m.style.display='none';}")

    # and when the observee IS on the clock at full staffing, nothing should move.
    # Clear the roster BEFORE choosing the observee -- otherwise the previous
    # scenario's staffing still satisfies DOP and fires a reassignment immediately.
    pg.evaluate("()=>{hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null;e.role=null;});"
                "htSaveState();htRenderAll();}")
    pg.evaluate("()=>{obsState={assignments:{},cycle:1};saveObsState();obsEnsureToday();obsRenderAll();}")
    target = today(pg)['name']
    pg.evaluate("""(a)=>{const [n,keep]=a;
        htSyncFromWallyShift();
        hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null;e.role=null;
                                         e.manualRole=null;e.frozenHours=0;e.cutTime=null;});
        const first=hoursState.employees.find(e=>e.name===keep);
        const rest=hoursState.employees.filter(e=>e.name!==keep).slice(0,n-1);
        [first].concat(rest).forEach(e=>{htActivateEmployee(e.id);e.startTime=new Date(Date.now()-3600000);});
        htSaveState(); htRenderAll();}""", [need, target])
    pg.wait_for_timeout(350)
    fin = pg.evaluate("()=>({today:obsToday().name, auto:!!obsToday().auto,"
                      "active:obsActiveNames(), dop:htCalcDOP().dopState,"
                      "count:hoursState.employees.filter(e=>e.status==='active').length})")
    held = fin['today'] == target
    ok &= held
    print(f'\nobservee present at full DOP -> left alone: {held}')
    print(f"   picked {target!r}, now {fin['today']!r} (auto={fin['auto']})")
    print(f"   dop={fin['dop']} with {fin['count']} active; observee in active list: {target in fin['active']}")

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
