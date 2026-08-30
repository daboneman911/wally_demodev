"""Roles are purely time-driven: most hours = Belt Tender, next two = Bulk,
everyone else Unloader. Nothing is hardcoded and nothing is locked in.
"""
from _boot import boot
from playwright.sync_api import sync_playwright

STAFF = """(n)=>{htSyncFromWallyShift();
  hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null;e.role=null;
                                   e.manualRole=null;e.frozenHours=0;e.cutTime=null;e.pausedMs=0;});
  const es=hoursState.employees.slice(0,n);
  // staggered starts -> strictly descending hours, es[0] highest
  es.forEach((e,i)=>{htActivateEmployee(e.id); e.startTime=new Date(Date.now()-(n-i)*3600000);});
  htSaveState(); htRenderAll();
  return es.map(e=>e.name);}"""

ROLES = """()=>hoursState.employees.filter(e=>e.status==='active'||e.status==='cut')
             .sort((a,b)=>htCalcHours(b)-htCalcHours(a))
             .map(e=>[e.name, e.role, +htCalcHours(e).toFixed(2)])"""

with sync_playwright() as p:
    b, pg, errs = boot(p)
    pg.click('#tab-btn-hours'); pg.wait_for_timeout(300)
    ok = True

    names = pg.evaluate(STAFF, 6)
    pg.wait_for_timeout(300)
    r = pg.evaluate(ROLES)
    want = ['belt', 'bulk', 'bulk', 'unload', 'unload', 'unload']
    got = [x[1] for x in r]
    ok &= got == want
    print('rank  name          hrs   role')
    for i, (n, role, h) in enumerate(r, 1):
        print(f'{i:>4}  {n:<12} {h:>5}  {role}')
    print(f'most hours = belt, next two = bulk, rest unload: {got == want}')

    # exactly one belt, exactly two bulk -- no duplicates
    counts = {k: got.count(k) for k in ('belt', 'bulk', 'unload')}
    ok &= counts['belt'] == 1 and counts['bulk'] == 2
    print(f'counts {counts}: one belt, two bulk: {counts["belt"] == 1 and counts["bulk"] == 2}')

    # ---- overtake: give the #4 more hours than everyone ----
    pg.evaluate("""(n)=>{const e=hoursState.employees.find(x=>x.name===n);
        e.startTime=new Date(Date.now()-40*3600000);htSaveState();htRenderAll();}""", r[3][0])
    pg.wait_for_timeout(300)
    r2 = pg.evaluate(ROLES)
    ok &= r2[0][0] == r[3][0] and r2[0][1] == 'belt'
    print(f'\novertaking on hours takes the belt: {r2[0][0]} -> {r2[0][1]}')

    # ---- a cut employee is not locked into the role they held ----
    pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);htCutEmployee(e.id);}", r2[0][0])
    pg.wait_for_timeout(250)
    # everyone else keeps accruing; push one clearly past the cut employee's frozen total
    pg.evaluate("""(n)=>{const e=hoursState.employees.find(x=>x.name===n);
        e.startTime=new Date(Date.now()-80*3600000);htSaveState();htRenderAll();}""", r2[1][0])
    pg.wait_for_timeout(300)
    r3 = pg.evaluate(ROLES)
    cut_role = [x for x in r3 if x[0] == r2[0][0]][0]
    ok &= r3[0][0] == r2[1][0] and r3[0][1] == 'belt' and cut_role[1] != 'belt'
    print(f'a cut belt is overtaken and demoted: {r2[0][0]} now {cut_role[1]!r}, belt is {r3[0][0]}')

    # ---- and the cut employee keeps their hours ----
    ok &= cut_role[2] > 0
    print(f'   their hours are retained: {cut_role[2]}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
