// Wally Dashboard -- Globals, config, guarded storage loading, shift-day keys, app state.
// Loaded as a classic script from index.html; all files share one global scope.

    let demoActive=false,duplicateWallyFlag=false,pendingWallyDuplicate=null,currentDoor=null,currentType='Wally',detailDoor=null,currentLogFilter='All',activeLogFilter={door:'All',unloader:'All',type:'All',timeRange:'All',search:'',date:'All'},statsVisible=false,hourlyVisible=false,lastSortStartTime=null,isFirstOnboard=false,dashboardRefreshTimer=null,wallyNotes={},manualType='Wally',pendingMoveDest=null,shiftState='idle',shiftEndTime=null;
    const APP_VERSION='7.31',DOORS_START=9,DOORS_END=16,DEFAULT_TEAM=['Robert','Matt','Lorena','Russell','Tre','David','Eddie','Luis','Elliot','Solis','Damian','Johnny','Jeremiah'];
    const WEBHOOK_URL='https://script.google.com/macros/s/AKfycbwss7dFIVBNUuQQHzp5KDURwpRJyH58wUrlJR3XbSrL3SjrF4tvAFSaQiLjJJeOmH9m/exec';
    // Apps Script doPost must return ContentService.createTextOutput(JSON.stringify({ok:true/false})).setMimeType(ContentService.MimeType.JSON)
    const byId=(id)=>document.getElementById(id);
    // -- CORRUPT STORAGE ------------------------------------
    // Every one of these keys was being JSON.parsed without a guard somewhere, and a
    // throw inside init() stops it dead: nothing renders, so Settings -- and with it
    // Restore From Backup and Reset -- is unreachable. The only way out was clearing
    // site data, which destroys the roster and the observation rotation too.
    //
    // Parsing is not enough on its own either. A value can parse and still be the wrong
    // shape: ps9_team holding the string "Robert W" gives teamNames.length === 8 (the
    // string's length), so truthiness guards downstream pass and the app misbehaves in
    // ways that look nothing like a storage problem.
    //
    // Damaged values are never discarded. They are moved aside under ps9_corrupt_<key>
    // so the data still exists if it turns out to be recoverable by hand.
    const loadIssues=[];
    function loadJSON(key,validate,fallback){
        let raw=null;
        try{raw=localStorage.getItem(key)}catch(e){return fallback()}
        if(raw===null||raw==='')return fallback();
        let val;
        try{val=JSON.parse(raw)}
        catch(e){quarantine(key,raw,'unreadable');return fallback()}
        if(!validate(val)){quarantine(key,raw,'wrong shape');return fallback()}
        return val;
    }
    function quarantine(key,raw,why){
        loadIssues.push({key,why});
        try{localStorage.setItem('ps9_corrupt_'+key,raw);localStorage.removeItem(key)}catch(e){}
        console.error('[storage] '+key+' was '+why+' and has been set aside as ps9_corrupt_'+key);
    }
    const isArray=(v)=>Array.isArray(v);
    const isNameList=(v)=>Array.isArray(v)&&v.every(n=>typeof n==='string');
    const isObject=(v)=>!!v&&typeof v==='object'&&!Array.isArray(v);
    // Shown once after a recovered load, so a silently dropped roster is never silent.
    function reportLoadIssues(){
        if(!loadIssues.length)return;
        const names=loadIssues.map(i=>i.key.replace('ps9_','')+' ('+i.why+')').join(', ');
        setTimeout(()=>alert('Some saved data could not be read and was set aside:\n\n'+names
            +'\n\nThe app has started with defaults for those. Nothing was deleted \u2014 if you have a backup, '
            +'Settings \u203a Shift Management \u203a Restore From Backup will put things right.'),600);
    }
    // Last line of defence. If boot throws for any reason at all, put a usable screen up
    // rather than leaving a white page with no way to reach Restore or Reset.
    function showRecoveryScreen(err){
        console.error('[boot] failed:',err);
        const html='<div style="position:fixed;inset:0;z-index:99999;background:#f2f2f7;color:#1a1a1a;'
            +'font:400 16px -apple-system,system-ui,sans-serif;overflow:auto;padding:28px 22px;">'
            +'<h1 style="font-size:22px;margin:0 0 12px;">The dashboard could not start</h1>'
            +'<p style="color:#757575;line-height:1.5;">Something in this device\u2019s saved data could not be read. '
            +'Your data has not been deleted.</p>'
            +'<p style="color:#757575;font-size:13px;word-break:break-word;">'+String(err&&err.message||err)+'</p>'
            +'<button id="rec-restore" style="width:100%;padding:15px;margin:18px 0 10px;border:none;border-radius:12px;'
            +'background:#2563eb;color:#fff;font-size:16px;font-weight:700;">Restore From Backup</button>'
            +'<button id="rec-reload" style="width:100%;padding:15px;margin-bottom:10px;border:2px solid #e5e5ea;'
            +'border-radius:12px;background:#fff;font-size:16px;font-weight:700;">Try Again</button>'
            +'<button id="rec-reset" style="width:100%;padding:15px;border:2px solid #e5e5ea;border-radius:12px;'
            +'background:#fff;color:#b91c1c;font-size:16px;font-weight:700;">Clear the damaged data</button>'
            +'<p style="color:#757575;font-size:13px;line-height:1.5;margin-top:16px;">Clearing keeps your notes, '
            +'team list and observation history wherever they are still readable \u2014 it only removes what could not be loaded.</p></div>';
        const w=document.createElement('div');w.innerHTML=html;document.body.appendChild(w);
        byId('rec-reload').onclick=()=>location.reload();
        byId('rec-restore').onclick=()=>{const i=byId('restore-file-input');if(i)i.click();else alert('Restore is unavailable on this screen.')};
        byId('rec-reset').onclick=()=>{
            if(!confirm('Remove only the saved data that could not be read?'))return;
            try{Object.keys(localStorage).filter(k=>k.indexOf('ps9_corrupt_')===0)
                    .forEach(k=>localStorage.removeItem(k));
                ['ps9_team','ps9_history','ps9_doors','ps9_v4'].forEach(k=>{
                    try{JSON.parse(localStorage.getItem(k)||'null')}catch(e){localStorage.removeItem(k)}});
            }catch(e){}
            location.reload();
        };
    }
    // -- WHICH SHIFT DOES THIS LOG BELONG TO ----------------
    // dateKey is the calendar date, which splits a shift in half at midnight. The stats
    // need the SHIFT day -- the evening the shift began -- and they need it stamped on
    // the record rather than recomputed, because historyLog is not cleared at shift end
    // and is only pruned at 24 hours. Without this, the dashboard totals, the
    // per-unloader table and the End Shift summary all counted the previous night's
    // completions for up to a day, and the hourly table rendered rows like "-20th hour".
    // Same before-noon rollback used by obsTodayKey() and getShiftDayIndex().
    function shiftKeyFromTs(ts){const d=new Date(ts);if(d.getHours()<12)d.setDate(d.getDate()-1);return dateKeyFromTs(d.getTime())}
    function currentShiftKey(){return shiftKeyFromTs(Date.now())}
    // The one list every shift statistic is computed from.
    function thisShiftLogs(){const k=currentShiftKey();return historyLog.filter(l=>(l.shiftKey||shiftKeyFromTs(l.end))===k)}
    function debounce(func,wait){let timeout;return function(...args){clearTimeout(timeout);timeout=setTimeout(()=>func.apply(this,args),wait)}}
    let doors={},historyLog=[],teamNames=[],teamNamesSorted=[];
    let config={replenish:false,randomHistory:false,doorCount:2,mixedTypes:true,demoType:'Wally',simulateWindow:false,disableWindow:false,shareOnComplete:true,autoComplete:false,noWebhook:false};
    let attributionConfig={enabled:true},pendingCompletion=null,tempSortStartTime="";
