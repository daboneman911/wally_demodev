"""Idle time between trailers on a door (v7.21).

Onboarding a trailer used to reset the door's lastCompletionTime to null, so
idleBeforeMinutes (sheet column "Idle Time") was blank for every real trailer;
only demo arrivals kept it. Driven through the real arrival form here.

1. Door finishes 22:00, re-onboarded 22:30 -> the next completion logs 30 min idle.
2. The first trailer on a door this shift has no idle time.
3. A completion left over from last night is not counted as idle tonight.

v7.22:
5. Time the door is marked unavailable is left out of idle.
6. The dashboard's live idle timer leaves it out too.
7. A new Start Shift restarts idle, even within the same shift day.
"""
import datetime, os
from playwright.sync_api import sync_playwright

PORT = os.environ.get('WALLY_TEST_PORT', '8899')
T = lambda h, m, day=25, sec=0: datetime.datetime(2026, 11, day, h, m, sec)


def onboard(pg, door, wid):
    pg.evaluate("""([door,wid])=>{openArrivalModal(door);currentType='Wally';
        byId('input-wally-id').value=wid;byId('select-unloader').value='';
        const t=byId('input-onboard-time');if(t)t.value='';confirmArrival()}""", [door, wid])


def complete(pg, door):
    pg.evaluate("(door)=>finalizeCompletion(door,Date.now(),0)", door)
    return pg.evaluate("()=>historyLog[0]")


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 393, "height": 852})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://script.google.com/**", lambda r: r.abort())
    ok = True

    pg.clock.install(time=T(19, 50))                      # Wednesday evening
    pg.goto(f"http://localhost:{PORT}/index.html")
    pg.wait_for_selector("text=Home", timeout=10000)
    pg.evaluate("()=>{window.obsValidateAgainstDOP=()=>false;window.confirm=()=>true;window.alert=()=>{}}")
    pg.evaluate("()=>{doors[12].lastCompletionTime=new Date(2026,10,25,3,0).getTime();saveDoors()}")
    pg.clock.set_system_time(T(20, 5))
    pg.evaluate("()=>confirmStartShift(true)")            # keep bays, so door 12 keeps last night's time

    # door 11: first trailer 21:00-22:00, second onboarded 22:30, completed 23:15
    pg.clock.set_system_time(T(21, 0)); onboard(pg, 11, 'IDLE1')
    pg.clock.set_system_time(T(22, 0)); first = complete(pg, 11)
    pg.clock.set_system_time(T(22, 30)); onboard(pg, 11, 'IDLE2')
    pg.clock.set_system_time(T(23, 15)); second = complete(pg, 11)

    good = second['id'] == 'IDLE2' and second['idleBeforeMinutes'] == 30
    ok &= good
    print(f"1. door 11 done 22:00, onboarded 22:30 -> idle {second['idleBeforeMinutes']} (want 30): {good}")
    good = first['idleBeforeMinutes'] is None
    ok &= good
    print(f"2. first trailer on the door this shift has no idle: {good} ({first['idleBeforeMinutes']})")

    # door 12 carries a 03:00 completion from the previous shift
    pg.clock.set_system_time(T(21, 10)); onboard(pg, 12, 'IDLE3')
    pg.clock.set_system_time(T(21, 40)); third = complete(pg, 12)
    good = third['idleBeforeMinutes'] is None
    ok &= good
    print(f"3. last night's completion not counted as idle: {good} ({third['idleBeforeMinutes']})")

    # the idle value reaches the sheet payload
    q = pg.evaluate("()=>JSON.parse(localStorage.getItem('ps9_webhook_queue')||'[]')")
    sent = [x for x in q if x.get('id') == 'IDLE2' and x.get('end')]
    good = bool(sent) and sent[-1].get('idleBeforeMinutes') == 30
    ok &= good
    print(f"4. completion sent to the sheet carries Idle Time 30: {good}")

    # 5. unavailable time is not idle: done 23:15, unavailable 23:25-23:45, onboarded 23:55
    pg.clock.set_system_time(T(23, 25)); pg.evaluate("()=>{openArrivalModal(11);handleAvailabilityToggle()}")
    pg.clock.set_system_time(T(23, 45)); pg.evaluate("()=>{openArrivalModal(11);handleAvailabilityToggle()}")
    pg.clock.set_system_time(T(23, 55)); onboard(pg, 11, 'IDLE4')
    pg.clock.set_system_time(T(0, 20, 26)); fourth = complete(pg, 11)
    good = fourth['idleBeforeMinutes'] == 20
    ok &= good
    print(f"5. 40 min gap with 20 min unavailable -> idle {fourth['idleBeforeMinutes']} (want 20): {good}")

    # 6. still unavailable when the dashboard shows the empty door: timer leaves it out
    pg.clock.set_system_time(T(0, 30, 26)); pg.evaluate("()=>{openArrivalModal(11);handleAvailabilityToggle()}")
    pg.clock.set_system_time(T(0, 50, 26)); pg.evaluate("()=>{openArrivalModal(11);handleAvailabilityToggle()}")
    pg.clock.set_system_time(T(0, 55, 26, 30)); pg.evaluate("()=>renderDashboard()")
    timer = pg.evaluate("""()=>{const b=document.querySelector('#open-bays-grid .bay-circle[data-door="11"] .bay-timer');
        return b?b.textContent:null}""")
    good = timer == '15m'
    ok &= good
    print(f"6. dashboard idle timer leaves out unavailable time: {timer} (want 15m): {good}")

    # 7. a new Start Shift, even within the same shift day, restarts idle
    pg.clock.set_system_time(T(1, 0, 26)); pg.evaluate("()=>confirmStartShift(true)")
    pg.clock.set_system_time(T(1, 10, 26)); onboard(pg, 11, 'IDLE5')
    pg.clock.set_system_time(T(1, 40, 26)); fifth = complete(pg, 11)
    good = fifth['idleBeforeMinutes'] is None
    ok &= good
    print(f"7. completion before Start Shift not counted after it: {good} ({fifth['idleBeforeMinutes']})")

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
