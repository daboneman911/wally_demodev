// Wally Dashboard -- Weekly shift schedule, auto start/end and shift time windows.
// Loaded as a classic script from index.html; all files share one global scope.

    // -- WEEKLY SHIFT SCHEDULE -------------------------------
    // Mon-Thu 20:00, Fri 19:30. Sat/Sun are unused but kept editable so the
    // schedule stays complete if weekend shifts ever start.
    const SHIFT_SCHEDULE_DEFAULT={0:'20:00',1:'20:00',2:'20:00',3:'20:00',4:'20:00',5:'19:30',6:'20:00'};
    const DAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    function getShiftSchedule(){
        let s={};try{s=JSON.parse(localStorage.getItem('ps9_shift_schedule'))||{}}catch(e){s={}}
        const out={};for(let d=0;d<7;d++)out[d]=/^\d{2}:\d{2}$/.test(s[d])?s[d]:SHIFT_SCHEDULE_DEFAULT[d];
        return out}
    function saveShiftSchedule(sched){localStorage.setItem('ps9_shift_schedule',JSON.stringify(sched))}
    // Every shift ends at 03:00 the next morning, whatever day it started.
    const SHIFT_END_TIME='03:00';
    // -- AUTO START / END ------------------------------------
    // The app can only act while it is open (a Home Screen app is paused in the
    // background), so this runs on load, on returning to the app and every 30s.
    //   idle, inside tonight's start-end window, and tonight's shift not yet run
    //       -> start it, keeping any bays already onboarded
    //   live, and the end time of the shift it is running has passed
    //       -> end it, closing open bays as incomplete
    // ps9_shift_meta {key,startedAt} records which shift day is running / last ran, so a
    // shift ended early by hand is not restarted the same night, and a shift started by
    // hand after its end time is left alone rather than ended straight away.
    // Off under browser automation (navigator.webdriver, never set on a real phone) so the
    // test suite is not changed by the wall clock; tests of this feature set
    // window.__wallyAutoShiftUnderTest before the page loads.
    function autoShiftEnabled(){if(navigator.webdriver&&!window.__wallyAutoShiftUnderTest)return false;try{return localStorage.getItem('ps9_auto_shift')!=='0'}catch(e){return true}}
    function getShiftMeta(){try{const m=JSON.parse(localStorage.getItem('ps9_shift_meta'));return m&&typeof m.key==='string'?m:null}catch(e){return null}}
    function setShiftMeta(key,startedAt){localStorage.setItem('ps9_shift_meta',JSON.stringify({key,startedAt}))}
    function shiftWindowForKey(key){
        const[y,m,d]=key.split('-').map(Number),day=new Date(y,m-1,d).getDay();
        const[sh,sm]=getShiftSchedule()[day].split(':').map(Number),[eh,em]=SHIFT_END_TIME.split(':').map(Number);
        const start=new Date(y,m-1,d,sh,sm,0,0).getTime();let end=new Date(y,m-1,d,eh,em,0,0).getTime();
        if(end<=start)end+=24*3600000;
        return{start,end}}
    let autoShiftBusy=false;
    function autoShiftTick(){
        if(autoShiftBusy||!autoShiftEnabled()||shiftState==='demo'||demoActive)return;
        autoShiftBusy=true;
        try{
            const now=Date.now();
            if(shiftState==='live'){
                let meta=getShiftMeta();
                if(!meta){meta={key:currentShiftKey(),startedAt:now};setShiftMeta(meta.key,meta.startedAt)}
                const w=shiftWindowForKey(meta.key);
                if(now>=w.end&&meta.startedAt<w.end){
                    const c=byId('chk-share-total');if(c)c.checked=false;
                    confirmEndShift(false);
                    showToast('Shift ended automatically at 3:00 AM');
                }
            }
            if(shiftState==='idle'){
                const key=currentShiftKey(),w=shiftWindowForKey(key),meta=getShiftMeta();
                if(now>=w.start&&now<w.end&&(!meta||meta.key!==key)){
                    confirmStartShift(true);
                    showToast('Shift started automatically');
                }
            }
        }catch(e){console.error('autoShiftTick:',e)}
        finally{autoShiftBusy=false}}
    // Wed/Thu moved from 20:15 to 20:00 in v7.18. Editing any one day saves the whole
    // week, so most devices carry the old 20:15 as a stored value and would never see the
    // new default. One time only: a day still on exactly the old 20:15 is moved, anything
    // else was set by hand and is left alone, and setting 20:15 again later sticks.
    function migrateShiftSchedule(){
        if(localStorage.getItem('ps9_schedule_v718'))return false;
        let changed=false;
        try{const s=JSON.parse(localStorage.getItem('ps9_shift_schedule'));
            if(s&&typeof s==='object'){
                [3,4].forEach(d=>{if(s[d]==='20:15'){s[d]='20:00';changed=true}});
                if(changed)saveShiftSchedule(s);
            }}catch(e){/* unreadable: getShiftSchedule() already falls back to defaults */}
        localStorage.setItem('ps9_schedule_v718','1');
        return changed}
    // Shifts start in the evening and run past midnight, so the "shift day" is the day
    // the shift STARTED. Before noon we are still in the tail of the previous day's shift.
    function getShiftDayIndex(ref){const d=ref?new Date(ref):new Date();if(d.getHours()<12)d.setDate(d.getDate()-1);return d.getDay()}
    function getScheduledShiftStart(){return getShiftSchedule()[getShiftDayIndex()]}
    function getDefaultShiftStartByDay(){return getScheduledShiftStart()}
    function getShiftStartTime(){return localStorage.getItem('ps9_shift_start')||getScheduledShiftStart();}
    function saveShiftStart(val){localStorage.setItem('ps9_shift_start',val);renderDashboard();updateNameplate();}
    // While idle, the dashboard follows the weekly schedule. A live shift keeps whatever
    // time it started with so stats and Hours math never shift underneath a running shift.
    function syncShiftStartToSchedule(){
        if(shiftState!=='idle')return false;
        const s=getScheduledShiftStart();
        if(localStorage.getItem('ps9_shift_start')===s)return false;
        localStorage.setItem('ps9_shift_start',s);
        const inp=byId('setting-shift-start');if(inp)inp.value=s;
        return true}
    function renderShiftSchedule(){
        const g=byId('shift-schedule-group');if(!g)return;
        const sched=getShiftSchedule(),today=getShiftDayIndex();
        g.innerHTML=[1,2,3,4,5,6,0].map(d=>{
            const tag=d===today?' <span style="font-size:9px;font-weight:900;color:var(--accent-green);letter-spacing:0.6px;">TONIGHT</span>':'';
            return`<div class="settings-row"><span class="settings-label">${DAY_NAMES[d]}${tag}</span><input type="time" class="settings-input-inline" aria-label="${DAY_NAMES[d]} start" value="${sched[d]}" onchange="updateShiftScheduleDay(${d},this.value)"></div>`}).join('')}
    function updateShiftScheduleDay(day,val){
        if(!/^\d{2}:\d{2}$/.test(val)){renderShiftSchedule();return}
        const s=getShiftSchedule();s[day]=val;saveShiftSchedule(s);
        syncShiftStartToSchedule();renderShiftSchedule();renderDashboard();updateNameplate();showSaveToast()}
    function getShiftTimeWindows(){const[h,m]=getShiftStartTime().split(':').map(Number);const now=new Date();let start=new Date(now);start.setHours(h,m,0,0);
        // Before noon we are in the tail of a shift that began yesterday evening, so roll
        // back. Later in the day a start time still ahead of us means the shift simply has
        // not begun yet -- rolling back there put the shift start 23 hours in the past and
        // filed anything done pre-shift as hour 24. Assumes evening shifts, as every other
        // shift-day calculation in this file does.
        if(now<start&&now.getHours()<12)start.setDate(start.getDate()-1);const hoursElapsed=Math.floor((now-start)/3600000),thisHourStart=new Date(start.getTime()+(hoursElapsed*3600000));return{thisHourStart,thisHourEnd:new Date(thisHourStart.getTime()+3600000),lastHourStart:new Date(thisHourStart.getTime()-3600000),lastHourEnd:thisHourStart,shiftStart:start}}
    function getCompletionHour(ts){const{shiftStart}=getShiftTimeWindows();return Math.max(1,Math.floor((ts-shiftStart.getTime())/3600000)+1)}
