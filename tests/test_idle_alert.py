"""Dashboard idle timers (v7.25).

1. An empty door shows its idle time (completion -> now) in a readable timer.
2. Past 10 minutes during a running shift: red timer and a red ring; just under, not yet.
3. Works on every door 9-16.
4. "Avg idle Xm" next to Open Bays: average of this shift's completed gaps, red over 10.
5. After End Shift: no red alerts and no average label.
6. An unavailable door shows no timer.
"""
import datetime, os, sys
from playwright.sync_api import sync_playwright

PORT = os.environ.get('WALLY_TEST_PORT', '8899')
SHOT = os.environ.get('WALLY_SHOT')
T = lambda h, m, s=0: datetime.datetime(2026, 11, 25, h, m, s)
INJECT = ":root{--safe-top:59px!important;--safe-bottom:34px!important}"


def onboard(pg, door, wid):
    pg.evaluate("""([door,wid])=>{openArrivalModal(door);currentType='Wally';
        byId('input-wally-id').value=wid;byId('select-unloader').value='Matt R';
        const t=byId('input-onboard-time');if(t)t.value='';confirmArrival()}""", [door, wid])


def timer(pg, door):
    return pg.evaluate("""(d)=>{const b=document.querySelector(`#open-bays-grid .bay-circle[data-door="${d}"]`);
        if(!b)return null;const t=b.querySelector('.bay-timer');
        return {text:t?t.textContent:null,red:!!(t&&t.classList.contains('alert')),ring:b.classList.contains('idle-alert')}}""", door)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 375, "height": 812})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://script.google.com/**", lambda r: r.abort())
    ok = True

    pg.clock.install(time=T(19, 50))
    pg.goto(f"http://localhost:{PORT}/index.html")
    pg.wait_for_selector("text=Home", timeout=10000)
    pg.add_style_tag(content=INJECT)
    pg.evaluate("()=>{window.obsValidateAgainstDOP=()=>false;window.confirm=()=>true;window.alert=()=>{}}")
    pg.clock.set_system_time(T(20, 0)); pg.evaluate("()=>confirmStartShift(false)")

    # door 9: onboarded 21:00, completed 21:30
    pg.clock.set_system_time(T(21, 0)); onboard(pg, 9, 'AL1')
    pg.clock.set_system_time(T(21, 30)); pg.evaluate("()=>finalizeCompletion(9,Date.now(),0)")

    pg.clock.set_system_time(T(21, 39, 30)); pg.evaluate("()=>renderDashboard()")
    t = timer(pg, 9)
    good = t['text'] == '9m' and not t['red'] and not t['ring']
    ok &= good
    print(f"1. 9 min idle: timer {t['text']}, not red: {good}")

    pg.clock.set_system_time(T(21, 39, 50)); pg.evaluate("()=>renderDashboard()")
    at10 = timer(pg, 9)
    pg.clock.set_system_time(T(21, 40, 30)); pg.evaluate("()=>renderDashboard()")
    over = timer(pg, 9)
    good = not at10['red'] and over['text'] == '10m' and over['red'] and over['ring']
    ok &= good
    print(f"2. 9:50 not red ({at10['red']}); 10:30 -> {over['text']} red timer + red ring: {good}")

    # every door 9-16: onboard 21:45, complete 21:50, check at 22:05
    for d in range(10, 17):
        pg.clock.set_system_time(T(21, 45)); onboard(pg, d, f'AL{d}')
        pg.clock.set_system_time(T(21, 50)); pg.evaluate("(d)=>finalizeCompletion(d,Date.now(),0)", d)
    pg.clock.set_system_time(T(22, 5)); pg.evaluate("()=>renderDashboard()")
    all_doors = {d: timer(pg, d) for d in range(9, 17)}
    good = all(v and v['red'] and v['text'] for v in all_doors.values())
    ok &= good
    print(f"3. all doors 9-16 show a red timer: {good}  {[v['text'] if v else None for v in all_doors.values()]}")
    if SHOT:
        pg.screenshot(path=SHOT)

    # 4. average: door 9 re-onboarded 22:10 after completing 21:30 -> 40m gap; completed 22:20
    lbl0 = pg.evaluate("()=>byId('open-bays-avg-idle').textContent")
    pg.clock.set_system_time(T(22, 10)); onboard(pg, 9, 'AL9b')
    pg.clock.set_system_time(T(22, 20)); pg.evaluate("()=>finalizeCompletion(9,Date.now(),0)")
    pg.evaluate("()=>renderDashboard()")
    lbl = pg.evaluate("()=>byId('open-bays-avg-idle').textContent")
    red = pg.evaluate("()=>byId('open-bays-avg-idle').classList.contains('alert')")
    good = lbl0 == '' and 'Avg idle 40m' in lbl and red
    ok &= good
    print(f"4. no average before any gap ('{lbl0}'); after a 40m gap: '{lbl}', red: {good}")

    # 6. unavailable door: no timer
    pg.evaluate("()=>{openArrivalModal(12);handleAvailabilityToggle()}")
    t12 = timer(pg, 12)
    good = t12 and t12['text'] is None and not t12['ring']
    ok &= good
    print(f"6. unavailable door has no timer: {good}")

    # 5. End Shift: no alerts, no average
    pg.clock.set_system_time(T(23, 0)); pg.evaluate("()=>confirmEndShift(true)")
    pg.evaluate("()=>renderDashboard()")
    reds = pg.evaluate("()=>document.querySelectorAll('.idle-alert,.bay-timer.alert').length")
    lbl = pg.inner_text('#open-bays-avg-idle')
    good = reds == 0 and lbl == ''
    ok &= good
    print(f"5. after End Shift: {reds} red alerts, label '{lbl}': {good}")

    over = pg.evaluate("()=>document.documentElement.scrollWidth-document.documentElement.clientWidth")
    ok &= over <= 0
    print(f"   no sideways overflow at 375px: {over <= 0}")

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
