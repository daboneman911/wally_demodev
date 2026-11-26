"""DOP clocks start at the shift's scheduled start time, never at the tap.

1. Start tapped before the shift is running: reserved with no clock; when the shift
   starts (early, by hand, at 19:45) the clock is set to 20:00, shows "Starts", and
   earns 0.00 until then.
2. Start tapped while the shift is running (20:40): the clock is still 20:00.
3. Auto Start at 20:00 picks up someone reserved at 19:50 -> clock 20:00.
4. Friday's 19:30 start: Start Shift at 19:20 -> clocks at 19:30, nothing earned before.
5. After midnight and a reload, the clock is still the evening start (not tonight's 20:00).
6. A custom start time for the person wins over the shift start.
"""
import datetime, os
from playwright.sync_api import sync_playwright

PORT = os.environ.get('WALLY_TEST_PORT', '8899')
T = lambda d, h, m: datetime.datetime(2026, 11, d, h, m)   # 25 Wed, 26 Thu, 27 Fri


def info(pg, name):
    return pg.evaluate("""(n)=>{const e=hoursState.employees.find(x=>x.name===n);
        return {status:e.status,start:e.startTime?e.startTime.toTimeString().slice(0,5):null,
                day:e.startTime?e.startTime.getDate():null,h:Math.round(htCalcHours(e)*100)/100}}""", name)


def start(pg, name):
    pg.evaluate("(n)=>htActivateEmployee(hoursState.employees.find(x=>x.name===n).id)", name)


def fresh(pg):
    pg.evaluate("""()=>{if(shiftState!=='idle')confirmEndShift(true);
        hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null;e.customStartStr=null;e.frozenHours=0;e.cutTime=null;e.pausedMs=0});
        hoursState.shiftStarted=false;hoursState.shiftEnded=false;htSaveState();
        localStorage.removeItem('ps9_shift_meta')}""")


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 375, "height": 812})
    ctx.add_init_script("window.__wallyAutoShiftUnderTest=true")
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://script.google.com/**", lambda r: r.abort())
    ok = True

    pg.clock.install(time=T(25, 19, 30))
    pg.goto(f"http://localhost:{PORT}/index.html")
    pg.wait_for_selector("text=Home", timeout=10000)
    pg.evaluate("()=>{window.obsValidateAgainstDOP=()=>false;window.confirm=()=>true;window.alert=()=>{}}")

    # 1. reserved before the shift; shift started early by hand
    pg.clock.set_system_time(T(25, 19, 40)); start(pg, 'Robert')
    reserved = info(pg, 'Robert')
    pg.clock.set_system_time(T(25, 19, 45)); pg.evaluate("()=>confirmStartShift(true)")
    at_start = info(pg, 'Robert')
    pg.clock.set_system_time(T(25, 19, 59)); pg.evaluate("()=>{switchTab('hours');htRenderAll()}")
    before = info(pg, 'Robert')
    tag = pg.evaluate("()=>document.querySelector('#ht-row-'+hoursState.employees.find(e=>e.name==='Robert').id+' .ht-sched-tag')?.textContent||''")
    pg.clock.set_system_time(T(25, 20, 15))
    after = info(pg, 'Robert')
    good = reserved['status'] == 'active' and reserved['start'] is None and reserved['h'] == 0 \
        and at_start['start'] == '20:00' and before['h'] == 0 and tag.startswith('Starts') and after['h'] == 0.25
    ok &= good
    print(f"1. Start at 19:40 -> reserved, no clock; shift started 19:45 -> clock {at_start['start']}, "
          f"{before['h']} h at 19:59 ('{tag}'), {after['h']} h at 20:15: {good}")

    # 2. Start tapped mid-shift
    pg.clock.set_system_time(T(25, 20, 40)); start(pg, 'Matt')
    m = info(pg, 'Matt')
    good = m['start'] == '20:00' and m['h'] == 0.67
    ok &= good
    print(f"2. Start tapped at 20:40 -> clock {m['start']}, {m['h']} h: {good}")

    # 3. auto start picks up a reservation
    fresh(pg)
    pg.clock.set_system_time(T(26, 19, 50)); start(pg, 'Lorena')
    pg.clock.set_system_time(T(26, 20, 0)); pg.evaluate("()=>autoShiftTick()")
    l = info(pg, 'Lorena')
    st = pg.evaluate("()=>shiftState")
    good = st == 'live' and l['start'] == '20:00' and l['h'] == 0
    ok &= good
    print(f"3. reserved 19:50, Auto Start at 20:00 ({st}) -> clock {l['start']}: {good}")

    # 4. Friday 19:30
    fresh(pg)
    pg.clock.set_system_time(T(27, 19, 15)); start(pg, 'Russell')
    pg.clock.set_system_time(T(27, 19, 20)); pg.evaluate("()=>confirmStartShift(true)")
    r1 = info(pg, 'Russell')
    pg.clock.set_system_time(T(27, 20, 30))
    r2 = info(pg, 'Russell')
    good = r1['start'] == '19:30' and r1['h'] == 0 and r2['h'] == 1.0
    ok &= good
    print(f"4. Friday: Start Shift 19:20 -> clock {r1['start']}, {r1['h']} h then, {r2['h']} h at 20:30: {good}")

    # 5. after midnight + reload: still Friday evening's 19:30
    pg.clock.set_system_time(datetime.datetime(2026, 11, 28, 0, 30))
    pg.reload(); pg.wait_for_selector("text=Home", timeout=10000); pg.wait_for_timeout(300)
    r3 = info(pg, 'Russell')
    pg.evaluate("()=>{window.confirm=()=>true;window.alert=()=>{}}")
    start(pg, 'Tre')
    t = info(pg, 'Tre')
    good = r3['start'] == '19:30' and r3['day'] == 27 and r3['h'] == 5.0 and t['start'] == '19:30' and t['day'] == 27
    ok &= good
    print(f"5. 00:30 after reload: Russell {r3['start']} on the 27th, {r3['h']} h; Start tapped now -> {t['start']} on the {t['day']}th: {good}")

    # 6. custom start wins
    pg.evaluate("()=>{const e=hoursState.employees.find(x=>x.name==='David');e.customStartStr='22:00';htActivateEmployee(e.id)}")
    d = info(pg, 'David')
    good = d['start'] == '22:00' and d['h'] == 2.5
    ok &= good
    print(f"6. custom start 22:00 -> clock {d['start']}, {d['h']} h at 00:30: {good}")

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
