"""The DOP roster is DERIVED from the master team list -- they are one list.

Adds, renames and deletes from either side must keep them identical, and a
rename must carry the person's accumulated hours across.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright


def lists(pg):
    return pg.evaluate("()=>({team:teamNames.slice(),roster:hoursState.employees.map(e=>e.name)})")


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 393, 'height': 852})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)
    # the observation popup can intercept clicks; not what this suite is testing
    pg.evaluate("()=>{window.obsValidateAgainstDOP=()=>false;}")
    pg.wait_for_timeout(300)
    ok = True

    def step(label):
        global ok
        s = lists(pg)
        same = s['team'] == s['roster']
        ok &= same
        print(f"{label:34s} roster==master: {'YES' if same else 'NO'}  ({len(s['roster'])} people)")

    step('baseline')

    # add from the DOP tab -> reaches the master list
    pg.evaluate("()=>{document.getElementById('ht-new-name').value='Zeke Tester';htAddEmployee();}")
    on_master = pg.evaluate("()=>teamNames.includes('Zeke Tester')")
    ok &= on_master
    step('after add from DOP')
    print(f"{'   reached the master list':34s} {on_master}")

    # add from Settings -> reaches the DOP roster
    pg.evaluate("""()=>{teamNames.push('Nora Master');refreshTeamNamesSorted();saveTeam();
        populateUnloaderSelect();renderTeamManagement();htReconcileRoster();}""")
    step('after add from Settings')

    # per-shift state must survive reconciliation
    pg.evaluate("""()=>{htSyncFromWallyShift();
        const e=hoursState.employees.find(x=>x.name==='Zeke Tester');
        htActivateEmployee(e.id); e.startTime=new Date(Date.now()-3600000);
        e.frozenHours=0; htSaveState(); htRenderAll();}""")
    before = pg.evaluate("()=>{const e=hoursState.employees.find(x=>x.name==='Zeke Tester');return +htCalcHours(e).toFixed(3);}")
    pg.evaluate("()=>{teamNames.push('Filler One');refreshTeamNamesSorted();saveTeam();htRenderAll();}")
    after = pg.evaluate("()=>{const e=hoursState.employees.find(x=>x.name==='Zeke Tester');return +htCalcHours(e).toFixed(3);}")
    kept = abs(before - after) < 1e-9
    ok &= kept
    print(f"{'hours survive reconcile':34s} {before} -> {after}  {kept}")

    # rename must carry hours across, not reset the person to zero
    pg.evaluate("""()=>{const i=teamNames.indexOf('Zeke Tester');teamNames[i]='Zeke Renamed';
        refreshTeamNamesSorted();saveTeam();htRenameEmployee('Zeke Tester','Zeke Renamed');htRenderAll();}""")
    renamed = pg.evaluate("""()=>{const e=hoursState.employees.find(x=>x.name==='Zeke Renamed');
        return e?+htCalcHours(e).toFixed(3):null;}""")
    gone = pg.evaluate("()=>!hoursState.employees.some(e=>e.name==='Zeke Tester')")
    carried = renamed is not None and abs(renamed - after) < 1e-9 and gone
    ok &= carried
    print(f"{'hours survive rename':34s} {renamed} (old name gone: {gone})  {carried}")
    step('after rename')

    # delete from Settings removes from the roster
    pg.evaluate("""()=>{teamNames=teamNames.filter(n=>n!=='Zeke Renamed');
        refreshTeamNamesSorted();saveTeam();htReconcileRoster();}""")
    step('after delete')

    # an orphan written straight into the roster is pruned on the next render
    pg.evaluate("()=>{hoursState.employees.push(htMakeEmployee('Ghost Orphan'));htSaveState();htRenderAll();}")
    pruned = pg.evaluate("()=>!hoursState.employees.some(e=>e.name==='Ghost Orphan')")
    ok &= pruned
    print(f"{'orphan pruned on render':34s} {pruned}")

    pg.reload()
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.wait_for_timeout(400)
    step('after reload')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
