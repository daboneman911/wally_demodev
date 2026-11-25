"""Dwell time: arrival -> labor start (v7.24).

Driven through the real arrival form and the Edit Active modal.

1. Staged at 21:00, unloader assigned through Edit at 21:25 with the Labor Start
   field untouched -> 25 min dwell (was 0: the field's arrival-time placeholder
   was saved as the labor start).
2. Saving Edit on a door that stays staged sets no labor start, so assigning
   someone later still measures the real wait.
3. A Labor Start time typed by hand is respected.
4. Onboarded with an unloader -> dwell 0, sent to the sheet as 0 (was blank).
5. Logs tab Dwell Time section: waited count, average, longest and door, per door.
6. Editing a door keeps the unavailable time excluded from idle (v7.22).
"""
import datetime, os
from playwright.sync_api import sync_playwright

PORT = os.environ.get('WALLY_TEST_PORT', '8899')
T = lambda h, m: datetime.datetime(2026, 11, 25, h, m)


def onboard(pg, door, wid, unloader='', stage=False):
    pg.evaluate("""([door,wid,unl,stage])=>{openArrivalModal(door);currentType='Wally';
        byId('input-wally-id').value=wid;byId('select-unloader').value=unl;
        const t=byId('input-onboard-time');if(t)t.value='';confirmArrival(stage)}""", [door, wid, unloader, stage])


def edit(pg, door, unloader, labor=None):
    pg.evaluate("""([door,unl,labor])=>{openEditActiveModal(door);byId('edit-active-unloader').value=unl;
        if(labor)byId('edit-active-labor-time').value=labor;saveActiveEdit()}""", [door, unloader, labor])


def complete(pg, door):
    pg.evaluate("(door)=>finalizeCompletion(door,Date.now(),0)", door)
    return pg.evaluate("()=>historyLog[0]")


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
    pg.evaluate("()=>{window.obsValidateAgainstDOP=()=>false;window.confirm=()=>true;window.alert=()=>{}}")
    pg.clock.set_system_time(T(20, 0)); pg.evaluate("()=>confirmStartShift(false)")

    # 1. staged 21:00, assigned via Edit at 21:25, labor field untouched
    pg.clock.set_system_time(T(21, 0)); onboard(pg, 9, 'DW1', stage=True)
    pg.clock.set_system_time(T(21, 25)); edit(pg, 9, 'Matt R')
    pg.clock.set_system_time(T(22, 0)); r = complete(pg, 9)
    good = r['dwellMinutes'] == 25
    ok &= good
    print(f"1. staged 21:00, unloader via Edit 21:25 -> dwell {r['dwellMinutes']} (want 25): {good}")

    # 2. Edit saved while still staged, then assigned at 21:40
    pg.clock.set_system_time(T(21, 10)); onboard(pg, 10, 'DW2', stage=True)
    pg.clock.set_system_time(T(21, 20)); edit(pg, 10, 'Unassigned')
    labor = pg.evaluate("()=>doors[10].laborStart")
    pg.clock.set_system_time(T(21, 40)); edit(pg, 10, 'Matt R')
    pg.clock.set_system_time(T(22, 5)); r = complete(pg, 10)
    good = labor is None and r['dwellMinutes'] == 30
    ok &= good
    print(f"2. Edit while staged keeps no labor start ({labor}); assigned 21:40 -> dwell {r['dwellMinutes']} (want 30): {good}")

    # 3. a typed Labor Start time wins
    pg.clock.set_system_time(T(22, 0)); onboard(pg, 11, 'DW3', stage=True)
    pg.clock.set_system_time(T(22, 30)); edit(pg, 11, 'Matt R', labor='22:15')
    pg.clock.set_system_time(T(23, 0)); r = complete(pg, 11)
    good = r['dwellMinutes'] == 15
    ok &= good
    print(f"3. typed Labor Start 22:15 -> dwell {r['dwellMinutes']} (want 15): {good}")

    # 4. onboarded with an unloader: 0 dwell, and the sheet gets 0 not blank
    pg.clock.set_system_time(T(22, 10)); onboard(pg, 12, 'DW4', unloader='Matt R')
    pg.clock.set_system_time(T(22, 40)); r = complete(pg, 12)
    q = pg.evaluate("()=>JSON.parse(localStorage.getItem('ps9_webhook_queue')||'[]')")
    sent = [x for x in q if x.get('id') == 'DW4' and x.get('end')]
    good = r['dwellMinutes'] == 0 and bool(sent) and sent[-1].get('dwellMinutes') == 0
    ok &= good
    print(f"4. direct onboard dwell 0, sheet gets 0: {good}  ({sent[-1].get('dwellMinutes') if sent else 'not sent'})")

    # 5. Dwell Time section: 3 of 4 waited, avg (25+30+15)/3 = 23m, longest 30m on D10
    pg.click('#tab-btn-logs'); pg.wait_for_timeout(250)
    pg.click("button.stats-collapse-btn:has-text('Dwell Time')"); pg.wait_for_timeout(200)
    summary = pg.inner_text('#dwell-summary').replace('\n', ' ')
    rows = pg.eval_on_selector_all('#dwell-stats-body tr', 'rs=>rs.map(r=>[...r.cells].map(c=>c.textContent))')
    good = all(x in summary for x in ['3 of 4', '23m', '30m', 'D10']) and \
        rows == [['Door 10', '1/1', '30m', '30m', '30m'], ['Door 9', '1/1', '25m', '25m', '25m'],
                 ['Door 11', '1/1', '15m', '15m', '15m']]
    ok &= good
    print(f"5. section: {summary} / {rows}: {good}")
    over = pg.evaluate("()=>document.documentElement.scrollWidth-document.documentElement.clientWidth")
    ok &= over <= 0
    print(f"   no sideways overflow at 375px: {over <= 0}")

    # 6. Edit keeps the unavailable time excluded from idle
    pg.clock.set_system_time(T(23, 0)); onboard(pg, 13, 'DW5', unloader='Matt R')
    pg.evaluate("()=>{doors[13].idleExcludeMs=600000;saveDoors()}")
    edit(pg, 13, 'Matt R')
    kept = pg.evaluate("()=>doors[13].idleExcludeMs")
    good = kept == 600000
    ok &= good
    print(f"6. Edit keeps idle's unavailable time: {good} ({kept})")

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
