"""DOP board actions (v7.30, docs/dop-port/PLAN.md sections 3-5).

1. Tapping a name toggles inactive <-> active; taking off someone with hours asks first.
2. A cut person doesn't toggle: the row shakes and a toast points at the options.
3. Move to PS5: hours freeze, they leave the DOP count, the row shows "-> PS5"; a tap
   doesn't toggle them; Return to PS9 resumes without crediting the time away.
4. Lock blocks the tap; unlock restores it.
5. A later start time counts toward the DOP at once, shows "Starts", earns 0 until then.
6. The options sheet offers the right actions per state; Delete only for added people;
   the line picker lists PS1-PS12 without PS9.
7. End Shift keeps a moved person's PS9 hours and lists them in the breakdown.
8. Rows with the options button fit a 375px screen.
"""
import datetime, os
from playwright.sync_api import sync_playwright

PORT = os.environ.get('WALLY_TEST_PORT', '8899')
T = lambda h, m: datetime.datetime(2026, 11, 25, h, m)


def emp(pg, name):
    return pg.evaluate("""(n)=>{const e=hoursState.employees.find(x=>x.name===n);
        return {id:e.id,status:e.status,h:Math.round(htCalcHours(e)*100)/100,movedTo:e.movedTo||null,
                locked:!!e.locked,start:e.startTime?htFmtTimeShort(e.startTime):null}}""", name)


def tap(pg, name):
    pg.evaluate("(n)=>{const e=hoursState.employees.find(x=>x.name===n);htTapEmployee(e.id)}", name)


def render(pg):
    pg.evaluate("()=>htRenderAll()")


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 375, "height": 812})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://script.google.com/**", lambda r: r.abort())
    ok = True

    pg.clock.install(time=T(19, 55))
    pg.goto(f"http://localhost:{PORT}/index.html")
    pg.wait_for_selector("text=Home", timeout=10000)
    pg.evaluate("""()=>{window.obsValidateAgainstDOP=()=>false;window.__confirms=[];window.__answer=true;
        window.confirm=(m)=>{window.__confirms.push(m);return window.__answer};window.alert=()=>{};
        window.__toasts=[];const st=showToast;showToast=(m)=>{window.__toasts.push(m);st(m)}}""")
    pg.clock.set_system_time(T(20, 0))
    pg.evaluate("()=>{confirmStartShift(false);switchTab('hours')}"); pg.wait_for_timeout(200)

    # 1. tap toggles
    tap(pg, 'Robert'); a = emp(pg, 'Robert')['status']
    tap(pg, 'Robert'); b0 = emp(pg, 'Robert')['status']
    n0 = pg.evaluate("()=>window.__confirms.length")
    tap(pg, 'Robert')
    pg.clock.set_system_time(T(21, 0)); render(pg)
    pg.evaluate("()=>{window.__answer=false}"); tap(pg, 'Robert'); kept = emp(pg, 'Robert')
    pg.evaluate("()=>{window.__answer=true}"); tap(pg, 'Robert'); off = emp(pg, 'Robert')
    asked = pg.evaluate("()=>window.__confirms.length")
    good = a == 'active' and b0 == 'inactive' and n0 == 0 and kept['status'] == 'active' and kept['h'] == 1.0 \
        and off == {**off, 'status': 'inactive', 'h': 0} and asked == 2
    ok &= good
    print(f"1. tap on/off ({a}->{b0}, no confirm at 0 h); with 1 h: cancel keeps ({kept['status']}), "
          f"confirm clears ({off['status']}, {off['h']} h): {good}")

    # 2. cut doesn't toggle
    pg.clock.set_system_time(T(21, 0))
    tap(pg, 'Matt'); pg.evaluate("()=>htCutEmployee(hoursState.employees.find(e=>e.name==='Matt').id)")
    tap(pg, 'Matt')
    shook = pg.evaluate("()=>document.getElementById('ht-row-'+hoursState.employees.find(e=>e.name==='Matt').id).classList.contains('ht-shake')")
    toast = pg.evaluate("()=>window.__toasts.slice(-1)[0]||''")
    good = emp(pg, 'Matt')['status'] == 'cut' and shook and 'is cut' in toast
    ok &= good
    print(f"2. cut person stays cut on tap, row shakes, toast '{toast}': {good}")

    # 3. move to PS5 and back
    pg.clock.set_system_time(T(20, 0)); tap(pg, 'Lorena'); tap(pg, 'Russell')
    pg.clock.set_system_time(T(21, 0))
    before = pg.evaluate("()=>hoursState.employees.filter(e=>e.status==='active').length")
    pg.evaluate("()=>htMoveEmployee(hoursState.employees.find(e=>e.name==='Lorena').id,'PS5')")
    moved = emp(pg, 'Lorena')
    after = pg.evaluate("()=>hoursState.employees.filter(e=>e.status==='active').length")
    render(pg)
    tag = pg.evaluate("()=>{const r=document.getElementById('ht-row-'+hoursState.employees.find(e=>e.name==='Lorena').id);return r?r.querySelector('.ht-moved-tag').textContent:null}")
    pg.clock.set_system_time(T(22, 0)); render(pg)
    frozen = emp(pg, 'Lorena')['h']
    tap(pg, 'Lorena'); still = emp(pg, 'Lorena')['status']
    role = pg.evaluate("()=>hoursState.employees.find(e=>e.name==='Lorena').role")
    pg.evaluate("()=>htReturnEmployee(hoursState.employees.find(e=>e.name==='Lorena').id)")
    pg.clock.set_system_time(T(23, 0)); render(pg)
    back = emp(pg, 'Lorena')
    good = moved['status'] == 'moved' and moved['h'] == 1.0 and after == before - 1 and tag == '→ PS5' \
        and frozen == 1.0 and still == 'moved' and role is None and back['status'] == 'active' and back['h'] == 2.0
    ok &= good
    print(f"3. move to PS5: frozen {moved['h']}h, DOP count {before}->{after}, tag '{tag}', no role, "
          f"tap ignored; returned 22:00 -> {back['h']}h at 23:00 (want 2.0): {good}")

    # 4. lock
    pg.evaluate("()=>htToggleLock(hoursState.employees.find(e=>e.name==='David').id)")
    tap(pg, 'David'); locked = emp(pg, 'David')
    pg.evaluate("()=>htToggleLock(hoursState.employees.find(e=>e.name==='David').id)")
    tap(pg, 'David'); unlocked = emp(pg, 'David')
    good = locked['locked'] and locked['status'] == 'inactive' and not unlocked['locked'] and unlocked['status'] == 'active'
    ok &= good
    print(f"4. locked tap ignored ({locked['status']}); unlocked tap works ({unlocked['status']}): {good}")

    # 5. later start
    pg.clock.set_system_time(T(23, 0))
    pg.evaluate("()=>{const e=hoursState.employees.find(x=>x.name==='Eddie');e.customStartStr='23:30';htActivateEmployee(e.id)}")
    sched = emp(pg, 'Eddie')
    counted = pg.evaluate("()=>hoursState.employees.some(e=>e.name==='Eddie'&&e.status==='active')")
    render(pg)
    meta = pg.evaluate("()=>document.getElementById('ht-row-'+hoursState.employees.find(e=>e.name==='Eddie').id).querySelector('.ht-sched-tag')?.textContent||''")
    pg.clock.set_system_time(T(23, 59)); render(pg)
    later = emp(pg, 'Eddie')['h']
    pg.clock.set_system_time(datetime.datetime(2026, 11, 26, 0, 30)); render(pg)
    hour = emp(pg, 'Eddie')['h']
    good = sched['status'] == 'active' and sched['h'] == 0 and counted and meta.startswith('Starts') and later == 0.48 and hour == 1.0
    ok &= good
    print(f"5. starts 23:30: counted {counted}, '{meta}', 0 h before, {later} h at 23:59, {hour} h at 00:30: {good}")

    # 6. options sheet
    def options(name):
        pg.evaluate("(n)=>htOpenOptions(hoursState.employees.find(e=>e.name===n).id)", name)
        return pg.eval_on_selector_all('#ht-opts-list .ht-role-opt-label', 'l=>l.map(x=>x.textContent)')
    o_active = options('Russell')
    o_moved = (pg.evaluate("()=>htMoveEmployee(hoursState.employees.find(e=>e.name==='Russell').id,'PS2')"), options('Russell'))[1]
    o_inactive = options('Luis')
    pg.evaluate("()=>{teamNames.push('Temp Tony');refreshTeamNamesSorted();saveTeam();htRenderAll()}")
    o_temp = options('Temp Tony')
    pg.evaluate("(id)=>htOpenOptions(id,'lines')", emp(pg, 'Tre')['id'])
    lines = pg.eval_on_selector_all('#ht-opts-list .ht-line-btn', 'l=>l.map(x=>x.textContent)')
    good = {'Role', 'Cut', 'Move to another line', 'Lock', 'Remove from shift'} <= set(o_active) and 'Delete' not in o_active \
        and 'Return to PS9' in o_moved and 'Cut' not in o_moved \
        and 'Mark working' in o_inactive and 'Role' not in o_inactive and 'Delete' not in o_inactive \
        and 'Delete' in o_temp and 'PS9' not in lines and len(lines) == 11
    ok &= good
    print(f"6. options per state OK: {good}\n   active {o_active}\n   moved {o_moved}\n   inactive {o_inactive}\n   added {o_temp}\n   lines {lines}")
    pg.evaluate("()=>htCloseModal('ht-opts-modal')")

    # 7. end shift keeps the moved person's hours, in the breakdown
    pg.evaluate("()=>htEndShift()")
    r = emp(pg, 'Russell')
    bd = pg.evaluate("()=>htBuildBreakdown()")
    good = r['status'] == 'moved' and r['h'] > 0 and 'Russell' in bd
    ok &= good
    print(f"7. after End Shift Russell (on PS2) keeps {r['h']} h and is in the breakdown: {good}")

    # 8. layout
    render(pg); pg.wait_for_timeout(150)
    over = pg.evaluate("()=>document.documentElement.scrollWidth-document.documentElement.clientWidth")
    rows_ok = pg.evaluate("""()=>[...document.querySelectorAll('.ht-emp-row')].every(r=>{const a=r.getBoundingClientRect(),
        m=r.querySelector('.ht-btn-more');if(!m)return false;const mb=m.getBoundingClientRect();return mb.right<=a.right+0.5})""")
    good = over <= 0 and rows_ok
    ok &= good
    print(f"8. every row has its options button inside the row, no sideways scroll: {good}")
    if os.environ.get('WALLY_SHOT'):
        pg.evaluate("()=>window.scrollTo(0,0)")
        pg.screenshot(path=os.environ['WALLY_SHOT'], full_page=False)

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
