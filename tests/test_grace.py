"""Grace period window must follow the shift start MINUTE, not a fixed :00-:10.

20:00 -> :00-:10, 20:15 -> :15-:25, 19:30 -> :30-:40.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

# (shift start, completion minute, expected in-window?)
CASES = [
    ('20:00', 0, True), ('20:00', 5, True), ('20:00', 9, True),
    ('20:00', 10, False), ('20:00', 17, False), ('20:00', 59, False),
    ('20:15', 15, True), ('20:15', 20, True), ('20:15', 24, True),
    ('20:15', 25, False), ('20:15', 5, False), ('20:15', 0, False),
    ('19:30', 30, True), ('19:30', 35, True), ('19:30', 39, True),
    ('19:30', 40, False), ('19:30', 0, False), ('19:30', 29, False),
]

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 393, 'height': 852})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)
    ok = True

    rows = pg.evaluate("""(cases)=>cases.map(([start,min,want])=>{
        localStorage.setItem('ps9_shift_start',start);
        const d=new Date(); d.setHours(22,min,0,0);
        const got=isInGraceWindow(d);
        return [start,min,got,want,got===want,getGraceWindowLabel()];})""", CASES)

    print(f"{'start':7s} {'done at':8s} {'window':9s} {'in?':6s} {'want':6s} result")
    for start, mn, got, want, good, label in rows:
        ok &= good
        print(f'{start:7s} :{mn:<7d} {label:9s} {str(got):6s} {str(want):6s} {"OK" if good else "FAIL"}')

    # "Previous hour" must rewind past the shift-anchored boundary, landing exactly
    # one hour bucket back -- not past :00.
    print()
    prev = pg.evaluate("""()=>[['20:00',5],['20:15',20],['19:30',35]].map(([start,min])=>{
        localStorage.setItem('ps9_shift_start',start);
        const d=new Date(); d.setHours(22,min,0,0);
        const cur=getCompletionHour(d.getTime());
        const off=(minutesIntoShiftHour(d)+1)*60000;
        const back=getCompletionHour(d.getTime()-off);
        return [start,min,cur,back,back===cur-1];})""")
    for start, mn, cur, back, good in prev:
        ok &= good
        print(f'{start} at :{mn:<3d} Current=hour {cur}, Previous=hour {back}  {"OK" if good else "FAIL"}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
