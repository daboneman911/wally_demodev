"""Idle Time section on the Logs tab (v7.23).

1. Empty state before any gap is recorded.
2. Totals: total, average gap, longest gap and its door.
3. Per-door rows, worst door first, with gaps / avg / longest / total.
4. Logs from another shift and logs without idle are ignored.
5. Fits a 375px phone with no sideways overflow.
"""
import os, sys
from _boot import boot
from playwright.sync_api import sync_playwright

SHOT = sys.argv[1] if len(sys.argv) > 1 else None

ADD = """(rows)=>{const now=Date.now(),k=currentShiftKey();
  rows.forEach(([door,idle,other],n)=>historyLog.unshift({door,id:'I'+n,type:'Wally',unloader:'X',assistants:[],
    start:now-600000,laborStart:now-600000,end:now,dateKey:dateKeyFromTs(now),duration:600000,durationMinutes:10,
    statOffset:0,logId:'i'+n,completionHour:1,shiftKey:other?'2000-01-01':k,cpuOptions:[],status:'completed',
    idleBeforeMinutes:idle}));saveHistory()}"""

with sync_playwright() as p:
    b, pg, errs = boot(p, 375, 812)
    ok = True
    pg.evaluate("()=>{historyLog=[];saveHistory()}")
    pg.click('#tab-btn-logs'); pg.wait_for_timeout(250)
    pg.click("button.stats-collapse-btn:has-text('Idle Time')"); pg.wait_for_timeout(200)

    empty = pg.inner_text('#idle-stats-body')
    good = 'No idle gaps recorded yet' in empty
    ok &= good
    print(f'1. empty state shown: {good}')

    # door 11: 30 + 20, door 9: 75, door 12: none (first trailer), plus another shift's 300
    pg.evaluate(ADD, [[11, 30, False], [11, 20, False], [9, 75, False], [12, None, False], [10, 300, True]])
    pg.evaluate("()=>renderDashboard()"); pg.wait_for_timeout(150)   # section refreshes while open
    summary = pg.inner_text('#idle-summary').replace('\n', ' ')
    good = all(x in summary for x in ['125m', '42m', '75m', 'D9'])
    ok &= good
    print(f'2. total 125m, avg 42m, longest 75m on D9: {good}  ({summary})')

    rows = pg.eval_on_selector_all('#idle-stats-body tr', 'rs=>rs.map(r=>[...r.cells].map(c=>c.textContent))')
    good = rows == [['Door 9', '1', '75m', '75m', '75m'], ['Door 11', '2', '25m', '30m', '50m']]
    ok &= good
    print(f'3. per door, worst first: {good}  {rows}')
    good = not any(r[0] in ('Door 10', 'Door 12') for r in rows)
    ok &= good
    print(f'4. other shift and no-idle logs ignored: {good}')

    over = pg.evaluate("()=>document.documentElement.scrollWidth-document.documentElement.clientWidth")
    good = over <= 0
    ok &= good
    print(f'5. no sideways overflow at 375px: {good} ({over}px)')

    if SHOT:
        pg.locator('#idle-content').scroll_into_view_if_needed()
        pg.screenshot(path=SHOT)

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
