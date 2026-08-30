import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 393, 'height': 852})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)
    ok = True

    # --- 1. a span now ignores seconds, matching whole-minute TMS maths ---
    print('=== span from 20:00, measured at 22:00 + N seconds ===')
    rows = pg.evaluate("""()=>{
        const start=new Date(); start.setHours(20,0,0,0);
        return [0,1,15,30,45,59].map(sec=>{
            const end=new Date(); end.setHours(22,0,sec,0);
            const app=htSpanHours(start.getTime(),end.getTime());
            const tms=((end.getHours()*60+end.getMinutes())-(start.getHours()*60+start.getMinutes()))/60;
            return [sec, app.toFixed(4), htFmtHrs(app), tms.toFixed(2), Math.abs(app-tms)<1e-9];});}""")
    print(f"   {'sec':>4} {'app raw':>9} {'shows':>7} {'TMS':>7}  match")
    for sec, raw, shown, tms, match in rows:
        ok &= match
        print(f'   {sec:>4} {raw:>9} {shown:>7} {tms:>7}  {"OK" if match else "FAIL"}')

    # --- 2. the minute must still tick over correctly ---
    print('\n=== the minute boundary still advances ===')
    rows = pg.evaluate("""()=>{
        const start=new Date(); start.setHours(20,0,0,0);
        return [[22,0,59],[22,1,0],[22,1,59],[22,2,0]].map(([h,m,s])=>{
            const end=new Date(); end.setHours(h,m,s,0);
            return [h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'),
                    htFmtHrs(htSpanHours(start.getTime(),end.getTime()))];});}""")
    for t, v in rows:
        print(f'   at {t} -> {v} hrs')
    ticks = rows[0][1] != rows[1][1] and rows[2][1] != rows[3][1]
    ok &= ticks
    print(f'   value advances on each whole minute: {ticks}')

    # --- 3. live path and edited-cut path must now agree ---
    print('\n=== live vs edited cut, same nominal window ===')
    r = pg.evaluate("""()=>{
        const s=new Date(); s.setHours(20,0,0,0);
        const eEdited=new Date(); eEdited.setHours(22,0,0,0);
        const eLive=new Date();   eLive.setHours(22,0,45,0);
        return {edited:htSpanHours(s.getTime(),eEdited.getTime()).toFixed(4),
                live:htSpanHours(s.getTime(),eLive.getTime()).toFixed(4)};}""")
    agree = r['edited'] == r['live']
    ok &= agree
    print(f"   cut edited to 22:00      -> {r['edited']} hrs")
    print(f"   cut taken live 22:00:45  -> {r['live']} hrs")
    print(f'   paths agree: {agree}')

    # --- 4. end to end through a real employee ---
    print('\n=== through htCalcHours on a live employee ===')
    r = pg.evaluate("""()=>{htSyncFromWallyShift();
        const e=hoursState.employees[0];
        htActivateEmployee(e.id);
        // started exactly 2h ago, plus 45s of noise that must NOT be counted
        e.startTime=new Date(Date.now()-2*3600000-45000);
        e.startTime.setSeconds(0,0);
        htSaveState();
        const hrs=htCalcHours(e);
        const mins=hrs*60;
        return {hrs:hrs.toFixed(4), shown:htFmtHrs(hrs), mins:mins,
                whole:Math.abs(mins-Math.round(mins))<1e-9};}""")
    print(f"   htCalcHours -> {r['hrs']} ({r['shown']} shown) = {r['mins']:.6f} min")
    ok &= r['whole']
    print(f"   resolves to a whole number of minutes: {r['whole']}")

    # --- 5. overnight span still correct ---
    print('\n=== overnight span (20:00 -> 02:30 next day) ===')
    r = pg.evaluate("""()=>{
        const s=new Date(); s.setHours(20,0,0,0);
        const e=new Date(s); e.setDate(e.getDate()+1); e.setHours(2,30,0,0);
        return htSpanHours(s.getTime(),e.getTime()).toFixed(2);}""")
    ok &= (r == '6.50')
    print(f'   -> {r} hrs (expect 6.50)  {"OK" if r=="6.50" else "FAIL"}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
