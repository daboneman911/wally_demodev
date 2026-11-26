"""Auto Start & End Shift (v7.26).

Default schedule: Mon-Thu 20:00, Fri 19:30. Every shift ends at 03:00 (fixed, v7.27).

1. Before the start time nothing happens; just after it, the 30-second check starts the
   shift and keeps an already-onboarded bay.
2. At the end time the shift ends and an open bay is logged as incomplete.
3. Ending early by hand is not undone: no restart the same night.
4. A shift started by hand after its end time is left running.
5. Catch-up: app closed across the end time, reopened during the next shift's window
   -> the old shift is ended, then the new one is started.
6. The Settings switch turns it off.
7. The schedule is start times only; the end is a fixed 03:00.
"""
import datetime, os
from playwright.sync_api import sync_playwright

PORT = os.environ.get('WALLY_TEST_PORT', '8899')
T = lambda d, h, m, s=0: datetime.datetime(2026, 11, d, h, m, s)   # 25 = Wednesday


def state(pg):
    return pg.evaluate("()=>({s:shiftState,meta:getShiftMeta()})")


def onboard(pg, door, wid):
    pg.evaluate("""([door,wid])=>{openArrivalModal(door);currentType='Wally';
        byId('input-wally-id').value=wid;byId('select-unloader').value='Matt R';
        const t=byId('input-onboard-time');if(t)t.value='';confirmArrival()}""", [door, wid])


def tick(pg):
    pg.evaluate("()=>autoShiftTick()")


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 375, "height": 812})
    ctx.add_init_script("window.__wallyAutoShiftUnderTest=true")
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://script.google.com/**", lambda r: r.abort())
    ok = True

    pg.clock.install(time=T(25, 19, 40))
    pg.goto(f"http://localhost:{PORT}/index.html")
    pg.wait_for_selector("text=Home", timeout=10000)
    pg.evaluate("()=>{window.obsValidateAgainstDOP=()=>false;window.confirm=()=>true;window.alert=()=>{}}")
    pg.evaluate("()=>maybePromptStartShift=()=>{}")   # skip the 'start shift?' prompt on onboard

    # 1. Wed: a bay onboarded before the start, then the shift starts on its own
    onboard(pg, 9, 'AS1')
    pg.clock.set_system_time(T(25, 19, 59)); tick(pg)
    before = state(pg)['s']
    pg.clock.set_system_time(T(25, 20, 0, 10)); pg.clock.run_for(31000)      # the 30s interval
    st = state(pg); kept = pg.evaluate("()=>doors[9].status")
    good = before == 'idle' and st['s'] == 'live' and st['meta']['key'] == '2026-11-25' and kept == 'active'
    ok &= good
    print(f"1. idle at 19:59 ({before}); after 20:00 -> {st['s']} for {st['meta']['key']}, bay 9 kept ({kept}): {good}")

    # 2. 03:00 Thu morning: ends, bay 9 closed as incomplete
    pg.clock.set_system_time(T(26, 3, 0, 20)); tick(pg)
    st = state(pg)
    door9 = pg.evaluate("()=>doors[9].status")
    inc = pg.evaluate("()=>historyLog.filter(l=>l.id==='AS1'&&l.status==='incomplete').length")
    q = pg.evaluate("()=>JSON.parse(localStorage.getItem('ps9_webhook_queue')||'[]').map(x=>x.dataType||x.stage)")
    good = st['s'] == 'idle' and door9 == 'empty' and inc == 1 and 'SHIFT_END' in q
    ok &= good
    print(f"2. 03:00 -> {st['s']}, bay 9 {door9}, incomplete logged {inc}, SHIFT_END sent {'SHIFT_END' in q}: {good}")
    pg.clock.set_system_time(T(26, 3, 5)); tick(pg)
    ok &= state(pg)['s'] == 'idle'

    # 3. Thu: auto start 20:00, ended by hand at 22:00, no restart at 22:01
    pg.clock.set_system_time(T(26, 20, 1)); tick(pg)
    started = state(pg)['s']
    pg.clock.set_system_time(T(26, 22, 0)); pg.evaluate("()=>confirmEndShift(true)")
    pg.clock.set_system_time(T(26, 22, 1)); tick(pg)
    good = started == 'live' and state(pg)['s'] == 'idle'
    ok &= good
    print(f"3. Thu started ({started}), ended by hand, not restarted: {good}")

    # 4. started by hand at 03:30 (after the 03:00 end) -> left running
    pg.clock.set_system_time(T(27, 3, 30)); pg.evaluate("()=>confirmStartShift(false)")
    pg.clock.set_system_time(T(27, 3, 31)); tick(pg)
    good = state(pg)['s'] == 'live'
    ok &= good
    print(f"4. manual start after end time is not auto-ended: {good}")
    pg.evaluate("()=>confirmEndShift(true)")

    # 5. Fri shift started 19:30, app closed until Sat 21:00 -> end Fri, start Sat
    pg.clock.set_system_time(T(27, 19, 31)); tick(pg)
    fri = state(pg)
    pg.clock.set_system_time(T(28, 21, 0))
    pg.reload(); pg.wait_for_selector("text=Home", timeout=10000); pg.wait_for_timeout(300)
    st = state(pg)
    q = pg.evaluate("()=>JSON.parse(localStorage.getItem('ps9_webhook_queue')||'[]').map(x=>x.dataType).filter(Boolean)")
    good = fri['s'] == 'live' and fri['meta']['key'] == '2026-11-27' and st['s'] == 'live' and \
        st['meta']['key'] == '2026-11-28' and q[-2:] == ['SHIFT_END', 'NEW_SHIFT']
    ok &= good
    print(f"5. reopened Sat 21:00: Fri ended then Sat started ({st['meta']['key']}), last sent {q[-2:]}: {good}")

    # 6. switch off -> no auto start
    pg.evaluate("()=>{confirmEndShift(true);toggleSwitch('auto-shift')}")
    off = pg.evaluate("()=>localStorage.getItem('ps9_auto_shift')")
    pg.clock.set_system_time(T(30, 20, 5)); tick(pg)       # Monday night, in the window
    good = off == '0' and state(pg)['s'] == 'idle'
    ok &= good
    print(f"6. switch off ({off}) -> Monday 20:05 stays idle: {good}")

    # 7. schedule is start times only (one per day); the end is fixed at 3:00 AM
    pg.evaluate("()=>switchTab('settings')")
    pg.wait_for_timeout(200)
    pg.evaluate("()=>{const b=[...document.querySelectorAll('.settings-collapse-btn')].find(x=>/Shift/.test(x.textContent));if(b&&b.getAttribute('aria-expanded')!=='true')b.click()}")
    pg.wait_for_timeout(300)
    n = pg.evaluate("()=>document.querySelectorAll('#shift-schedule-group input[type=time]').length")
    end = pg.evaluate("()=>SHIFT_END_TIME")
    over = pg.evaluate("()=>document.documentElement.scrollWidth-document.documentElement.clientWidth")
    good = n == 7 and end == '03:00' and over <= 0
    ok &= good
    print(f"7. one start time per day ({n}), fixed end {end}, no overflow ({over}px): {good}")
    if os.environ.get('WALLY_SHOT'):
        pg.locator('#shift-schedule-group').scroll_into_view_if_needed()
        pg.screenshot(path=os.environ['WALLY_SHOT'])

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
