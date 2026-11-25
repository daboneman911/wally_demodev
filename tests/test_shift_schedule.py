"""Weekly shift schedule: Mon-Thu 20:00, Fri 19:30.

Wed/Thu were 20:15 until v7.18. Editing any day saves the whole week, so devices
carry the old 20:15 as a stored value; a one-time step moves a day still on exactly
20:15 and leaves hand-set times alone.
"""
from _boot import boot
from playwright.sync_api import sync_playwright

WEEK = {'1': '20:00', '2': '20:00', '3': '20:00', '4': '20:00', '5': '19:30'}

with sync_playwright() as p:
    b, pg, errs = boot(p)
    ok = True

    # 1. fresh install
    pg.evaluate("()=>{localStorage.removeItem('ps9_shift_schedule');localStorage.removeItem('ps9_schedule_v718')}")
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(300)
    s = pg.evaluate("()=>getShiftSchedule()")
    fresh = all(s[d] == t for d, t in WEEK.items())
    ok &= fresh
    print(f'1. defaults Mon-Thu 20:00, Fri 19:30: {fresh}  {s}')

    # 2. a device holding the old stored week: Wed on 20:15 moves, Thu hand-set 20:30 stays
    pg.evaluate("""()=>{localStorage.removeItem('ps9_schedule_v718');
        localStorage.setItem('ps9_shift_schedule',JSON.stringify(
            {0:'20:00',1:'20:00',2:'20:00',3:'20:15',4:'20:30',5:'19:30',6:'20:00'}))}""")
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(300)
    s = pg.evaluate("()=>getShiftSchedule()")
    moved = s['3'] == '20:00' and s['4'] == '20:30' and s['5'] == '19:30'
    ok &= moved
    print(f'2. stored 20:15 moved to 20:00, hand-set 20:30 kept: {moved}  {s}')

    # 3. one-time: setting 20:15 by hand afterwards sticks
    pg.evaluate("()=>updateShiftScheduleDay(3,'20:15')")
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(300)
    sticks = pg.evaluate("()=>getShiftSchedule()[3]") == '20:15'
    ok &= sticks
    print(f'3. re-setting 20:15 by hand sticks across reload: {sticks}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
