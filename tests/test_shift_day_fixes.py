"""Shift-day fixes from v7.19.

1. Start Shift picks up tonight's scheduled start even when the app was left open
   (no reload) since the previous shift. It used to keep yesterday's time.
2. SHIFT_END's shiftDate is the shift day, not the calendar date at End, so a shift
   ended after midnight is filed under the evening it began.
3. Sharing the wally total sends the real count (it used to send one extra).
"""
import datetime, json, os
from playwright.sync_api import sync_playwright

PORT = os.environ.get('WALLY_TEST_PORT', '8899')

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 393, "height": 852})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    # Keep webhook posts in the queue so the payload can be read back.
    pg.route("https://script.google.com/**", lambda r: r.abort())
    ok = True

    # Thursday 26 Nov 2026, 13:00 -- idle, default schedule (Thu 20:00, Fri 19:30).
    pg.clock.install(time=datetime.datetime(2026, 11, 26, 13, 0))
    pg.goto(f"http://localhost:{PORT}/index.html")
    pg.wait_for_selector("text=Home", timeout=10000)
    pg.evaluate("()=>{window.obsValidateAgainstDOP=()=>false;"
                "window.__shared=null;navigator.share=(d)=>{window.__shared=d.text;return Promise.resolve()}}")
    thu = pg.evaluate("()=>getShiftStartTime()")

    # 1. App left open into Friday evening, then Start Shift with no reload.
    pg.clock.set_system_time(datetime.datetime(2026, 11, 27, 19, 0))
    pg.evaluate("()=>confirmStartShift(false)")
    fri = pg.evaluate("()=>getShiftStartTime()")
    good = thu == '20:00' and fri == '19:30'
    ok &= good
    print(f'1. Thu load {thu}, Fri Start Shift without reload -> {fri} (want 19:30): {good}')

    # 2. End the Friday shift at 02:00 Saturday.
    pg.clock.set_system_time(datetime.datetime(2026, 11, 28, 2, 0))
    pg.evaluate("()=>{const c=byId('chk-share-total');if(c)c.checked=true;confirmEndShift(false)}")
    pg.wait_for_timeout(200)
    q = pg.evaluate("()=>JSON.parse(localStorage.getItem('ps9_webhook_queue')||'[]')")
    end = [x for x in q if x.get('dataType') == 'SHIFT_END']
    date = end[-1]['shiftDate'] if end else None
    good = date == '2026-11-27'
    ok &= good
    print(f'2. SHIFT_END at 02:00 Sat files under shift day {date} (want 2026-11-27): {good}')

    # 3. No wallies completed, so the share says 0.
    shared = pg.evaluate("()=>window.__shared")
    good = shared == 'PS9 - 0 number of wallies'
    ok &= good
    print(f'3. shared total with 0 completions: {shared!r}: {good}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
