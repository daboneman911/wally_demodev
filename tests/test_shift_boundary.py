"""Shift statistics must describe tonight, and only tonight.

Two bugs from the v7.08 review, one root cause -- no stable notion of which shift a log
belongs to:

  #3  historyLog is never cleared at End Shift and is pruned only at 24 hours, and
      updateStats() had no date filter at all. The dashboard totals, the per-unloader
      table and the End Shift summary therefore counted last night's completions for
      up to a day.

  #4  calculateAndRenderHourlyStats() recomputed each log's bucket against the CURRENT
      shift start, so a log from last night rendered as "-20th hour". And
      getShiftTimeWindows() rolled the start back a day whenever now < start, which is
      right after midnight but wrong in the hour BEFORE a shift begins -- it put the
      start 23 hours in the past and filed pre-shift work as hour 24.

dateKey cannot carry this: it is the calendar date, which splits an overnight shift in
half at midnight. Logs now carry shiftKey, stamped at creation.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from _boot import boot
from playwright.sync_api import sync_playwright

# Two completions: one from last night's shift, one from tonight's. Times are derived
# from the live shift start, never hardcoded -- this suite runs at any hour.
# The key is computed here rather than via the app's helper so this seed also runs
# against builds from before v7.13, making the before/after comparison real.
SEED = """()=>{
  const key=(ts)=>{const d=new Date(ts);if(d.getHours()<12)d.setDate(d.getDate()-1);
      return dateKeyFromTs(d.getTime())};
  const ss=getShiftTimeWindows().shiftStart.getTime();
  const mk=(id,end,type)=>({id,type:type||'Wally',status:'completed',end,duration:600000,
      unloader:'Ann',door:9,statOffset:0,dateKey:dateKeyFromTs(end),
      shiftKey:key(end),completionHour:Math.max(1,Math.floor((end-ss)/3600000)+1)});
  historyLog=[mk('LASTNIGHT', ss-24*3600000+3*3600000), mk('TONIGHT', ss+3600000)];
  saveHistory();
  return {lastNightKey:historyLog[0].shiftKey, tonightKey:historyLog[1].shiftKey,
          currentKey:key(Date.now())};}"""

with sync_playwright() as p:
    b, pg, errs = boot(p)
    pg.on('dialog', lambda d: d.accept())
    pg.evaluate("()=>{window.fetch=()=>Promise.resolve({json:()=>Promise.resolve({ok:true})});}")
    ok = True

    keys = pg.evaluate(SEED)
    distinct = keys['lastNightKey'] != keys['tonightKey'] and keys['tonightKey'] == keys['currentKey']
    ok &= distinct
    print(f'seeded two shifts: last night={keys["lastNightKey"]}, tonight={keys["tonightKey"]}')
    print(f'   the two are distinguishable and tonight is current: {distinct}')

    # ---- 1. dashboard totals count tonight only ----
    stats = pg.evaluate("""()=>{updateStats();calculateAndRenderStats();calculateAndRenderHourlyStats();
        return {totalWally:document.getElementById('stat-total-wally').innerText,
                unloader:[...document.querySelectorAll('#unloader-stats-body tr')].map(r=>r.cells[0].textContent+'='+r.cells[3].textContent),
                hours:[...document.querySelectorAll('#hourly-stats-body tr')].map(r=>r.cells[0].textContent+' = '+r.cells[1].textContent)};}""")
    tile_ok = stats['totalWally'] == '1'
    unl_ok = stats['unloader'] == ['Ann=1']
    ok &= tile_ok and unl_ok
    print(f'\n1. dashboard "Total Wally" tile: {stats["totalWally"]} (expect 1): {tile_ok}')
    print(f'   per-unloader table: {stats["unloader"]} -> {unl_ok}')

    # ---- 2. no negative hour buckets ----
    negative = [h for h in stats['hours'] if h.strip().startswith('-')]
    rows_ok = len(stats['hours']) == 1 and not negative
    ok &= rows_ok
    print(f'\n2. hourly breakdown: {stats["hours"]}')
    print(f'   exactly one row, none negative: {rows_ok}')

    # ---- 3. the End Shift summary reports tonight ----
    summary = pg.evaluate("""()=>{localStorage.removeItem('ps9_webhook_queue');
        const chk=document.getElementById('chk-share-total'); if(chk)chk.checked=false;
        confirmEndShift(true);
        const q=JSON.parse(localStorage.getItem('ps9_webhook_queue')||'[]');
        const se=q.find(p=>p.dataType==='SHIFT_END')||{};
        return {wallies:se.totalWallies, kept:historyLog.length};}""")
    se_ok = summary['wallies'] == 1
    ok &= se_ok
    print(f'\n3. SHIFT_END reported totalWallies={summary["wallies"]} (expect 1): {se_ok}')
    print(f'   history still holds both rows for the Logs tab: {summary["kept"] == 2}')
    ok &= summary['kept'] == 2

    # ---- 4. the hour before a shift starts ----
    # getShiftTimeWindows() must not treat "the shift has not begun" as "the shift began
    # yesterday". Set the start an hour ahead and check the arithmetic stays sane.
    pre = pg.evaluate("""()=>{
        const soon=new Date(Date.now()+60*60000);
        const hhmm=String(soon.getHours()).padStart(2,'0')+':'+String(soon.getMinutes()).padStart(2,'0');
        const prev=localStorage.getItem('ps9_shift_start');
        localStorage.setItem('ps9_shift_start',hhmm);
        const w=getShiftTimeWindows();
        const out={hoursBack:Math.round((Date.now()-w.shiftStart.getTime())/360000)/10,
                   hourNow:getCompletionHour(Date.now()),
                   beforeNoon:new Date().getHours()<12};
        if(prev===null)localStorage.removeItem('ps9_shift_start');else localStorage.setItem('ps9_shift_start',prev);
        return out;}""")
    # in the afternoon/evening a future start must stay in the future (hour 1, clamped);
    # before noon the rollback is still correct, because that is a shift already running
    if pre['beforeNoon']:
        pre_ok = pre['hourNow'] >= 20
        note = 'before noon -- rollback is correct here, tail of a running shift'
    else:
        pre_ok = pre['hourNow'] == 1 and pre['hoursBack'] < 0
        note = 'afternoon/evening -- the shift simply has not started'
    ok &= pre_ok
    print(f'\n4. shift start set one hour ahead ({note}):')
    print(f'   shift start resolves {pre["hoursBack"]}h back, a completion now = hour {pre["hourNow"]}')
    print(f'   -> {pre_ok}')

    # ---- 5. a log with no shiftKey (written before v7.13) is still placed ----
    legacy = pg.evaluate("""()=>{const ss=getShiftTimeWindows().shiftStart.getTime();
        historyLog=[{id:'OLD',type:'Wally',status:'completed',end:ss+3600000,duration:600000,
                     unloader:'Bob',door:9,statOffset:0,completionHour:2}];
        saveHistory();updateStats();
        return document.getElementById('stat-total-wally').innerText;}""")
    ok &= legacy == '1'
    print(f'\n5. a pre-v7.13 log with no shiftKey is still counted for tonight: {legacy == "1"} ({legacy})')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
