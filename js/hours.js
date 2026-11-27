// Wally Dashboard -- Hours / DOP tracker (ht* functions).
// Loaded as a classic script from index.html; all files share one global scope.

    // ======================================================
    // HOURS TRACKER -- all functions prefixed ht* to avoid
    // conflicts with existing Wally functions and globals
    // ======================================================

    // -- Panel open/close ---------------------------------
    function openHoursTool(){
        // Legacy: if called directly, switch to the hours tab
        switchTab('hours', document.getElementById('tab-btn-hours'));
    }
    function closeHoursTool(){
        switchTab('dashboard', document.getElementById('tab-btn-dashboard'));
    }

    // -- Constants ----------------------------------------
    // REQ3: HT_PRESET_NAMES removed -- htInitEmployees pulls from teamNames instead
    const HT_ROLES={
        belt:{icon:'\u26a1',label:'Belt Tender',tagCls:'ht-tag-belt'},
        bulk:{icon:'\u2699\ufe0f',label:'Bulk Sweep',tagCls:'ht-tag-bulk'},
        unload:{icon:'\ud83d\udce6',label:'Unloader',tagCls:'ht-tag-unload'}
    };
    // Unloader counts the plan picker offers; every plan is N/2 (2 bulk sweep + 1 belt on top).
    const HT_DOP_PLANS=[5,6,7,8,9];
    const HT_DOP_ICON_MAP={none:'\u2b1c',met:'\u2705',low:'\u26a0\ufe0f',over:'\ud83d\udea8'};

    // -- State --------------------------------------------
    let hoursState={
        shiftStarted:false,shiftEnded:false,shiftStartTime:null,
        shiftStartStr:'20:00',dopConfig:6,employees:[],nextId:1,
        overDopMuted:false,pendingTimeId:null,pendingRoleId:null,pendingCutTimeId:null
    };

    // -- Employee factory ----------------------------------
    function htMakeEmployee(name){
        return{id:hoursState.nextId++,name,status:'inactive',startTime:null,
               customStartStr:null,frozenHours:0,role:null,manualRole:null,prevRole:null,
               pausedMs:0};
    }

    // The DOP roster and Wally's team list are ONE list. Keep them reconciled in both
    // directions instead of only merging on load, so adds/renames/removals made in
    // either place show up in the other immediately.
    function htRosterReady(){return hoursState&&Array.isArray(hoursState.employees)}
    function htRenderIfVisible(){const t=document.getElementById('tab-hours');if(t&&t.classList.contains('active'))htRenderAll()}
    // teamNames IS the employee list. The DOP roster is derived from it: same people,
    // same order, with each person's per-shift state (hours, role, status) carried over
    // by name. Anyone not on the master list is dropped, so the two cannot drift.
    function htReconcileRoster(){
        if(!htRosterReady())return false;
        const source=(typeof teamNames!=='undefined'&&teamNames.length>0)?teamNames:DEFAULT_TEAM;
        const byName=new Map();
        hoursState.employees.forEach(e=>{if(!byName.has(e.name))byName.set(e.name,e)});
        const next=source.map(n=>byName.get(n)||htMakeEmployee(n));
        const changed=next.length!==hoursState.employees.length||next.some((e,i)=>e!==hoursState.employees[i]);
        if(changed){hoursState.employees=next;htSaveState()}
        return changed}
    function htRenameEmployee(oldName,newName){
        if(!htRosterReady())return false;
        let changed=false;
        hoursState.employees.forEach(e=>{if(e.name===oldName){e.name=newName;changed=true}});
        // a rename onto an existing name would leave two rows for one person
        const seen=new Set();
        hoursState.employees=hoursState.employees.filter(e=>{if(seen.has(e.name))return false;seen.add(e.name);return true});
        if(changed){htSaveState();htRenderIfVisible()}
        return changed}
    // Same rename applied to the saved DOP state (ps9_v4), for when the roster changes
    // before htLoadState() has run.
    function htRenameInSavedState(oldName,newName){
        try{const raw=localStorage.getItem('ps9_v4');if(!raw)return false;const p=JSON.parse(raw);
            if(!p||!Array.isArray(p.employees)||!p.employees.some(e=>e.name===oldName))return false;
            p.employees.forEach(e=>{if(e.name===oldName)e.name=newName});
            const seen=new Set();p.employees=p.employees.filter(e=>{if(seen.has(e.name))return false;seen.add(e.name);return true});
            localStorage.setItem('ps9_v4',JSON.stringify(p));return true}catch(e){return false}}
    // Does this person have DOP activity that removing them would discard?
    function htHasActivity(name){
        if(!htRosterReady())return false;
        return hoursState.employees.some(e=>e.name===name&&(e.status==='active'||e.startTime||e.frozenHours>0))}

    // REQ3: Build employee list from Wally's live teamNames
    function htInitEmployees(){
        const source=(typeof teamNames!=='undefined'&&teamNames.length>0)?teamNames:DEFAULT_TEAM;
        hoursState.employees=source.map(n=>htMakeEmployee(n));
    }

    // -- Persistence ---------------------------------------
    function htSaveState(){
        try{localStorage.setItem('ps9_v4',JSON.stringify(hoursState));}catch(e){}
    }

    // REQ6: Load with forward-compat migration
    function htLoadState(){
        localStorage.removeItem('ps9_v3');
        try{
            const raw=localStorage.getItem('ps9_v4');
            if(!raw){htInitEmployees();return;}
            const p=JSON.parse(raw);
            if(p.shiftStartTime)p.shiftStartTime=new Date(p.shiftStartTime);
            p.employees.forEach(e=>{if(e.startTime)e.startTime=new Date(e.startTime);});
            hoursState=p;
            if(!HT_DOP_PLANS.includes(hoursState.dopConfig))hoursState.dopConfig=6;
            if(hoursState.employees.length)
                hoursState.nextId=Math.max(...hoursState.employees.map(e=>e.id))+1;
            // Roster is derived from the master team list on every load.
            htReconcileRoster();
        }catch(e){htInitEmployees();}
        // Reconcile hoursState against ps9_shift_state on every load
        const wallyShiftLive=localStorage.getItem('ps9_shift_state')==='live'||
                             localStorage.getItem('ps9_shift_state')==='demo';
        if(wallyShiftLive&&!hoursState.shiftStarted){
            htSyncFromWallyShift();
        }
        if(!wallyShiftLive&&hoursState.shiftStarted&&!hoursState.shiftEnded){
            hoursState.shiftEnded=true;
            htSaveState();
        }
    }

    // -- Time helpers --------------------------------------
    function htParseHHMM(str){
        const[h,m]=str.split(':').map(Number);
        const d=new Date();d.setHours(h,m,0,0);
        // Overnight shift wrap: after midnight, times like "20:00" or "23:50"
        // refer to yesterday evening. A result far in the future (>6h) can only
        // be a wrapped time, so roll it back one day. Near-future times (<6h,
        // e.g. a pre-shift custom start) are left on today intentionally.
        if(d.getTime()-Date.now()>6*3600000)d.setDate(d.getDate()-1);
        return d;
    }
    function htFmtTime(date){return date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
    function htFmtTimeShort(date){return date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).replace(/\s*[AP]M$/i,'');}
    // Labor hours are counted in WHOLE MINUTES, matching the TMS: seconds don't count
    // until the minute ticks over. Start times are already minute-exact (htParseHHMM
    // zeroes seconds), but the running clock carried seconds, so a span read up to a
    // minute high -- always high, never low. Flooring both ends keeps every span
    // measured the same way, whether it is live or reconstructed from edited times.
    function htFloorMin(ms){return Math.floor(ms/60000)*60000}
    function htNowMin(){return htFloorMin(Date.now())}
    function htSpanHours(startMs,endMs){return Math.max(0,htFloorMin(endMs)-htFloorMin(startMs))/3600000}
    // Time spent cut never counts. Rather than move the clock-in time (which would
    // misreport when they actually started), the cut gap is banked in pausedMs and
    // subtracted, so a reinstated employee resumes from the hours they had already
    // accumulated and starts adding again from that moment.
    function htPausedHours(emp){return Math.max(0,(emp.pausedMs||0))/3600000}
    function htCalcHours(emp){
        if(emp.status==='cut'||emp.status==='moved')return emp.frozenHours||0;
        if(emp.status!=='active'||!emp.startTime)return 0;
        return Math.max(0,htSpanHours(emp.startTime.getTime(),Date.now())-htPausedHours(emp));
    }
    function htFmtHrs(h){return h.toFixed(2);}

    // REQ6: Elapsed shift time in decimal hours (single source for KPI calc)
    function htShiftElapsed(){
        if(!hoursState.shiftStartTime)return 0;
        return htSpanHours(hoursState.shiftStartTime.getTime(),Date.now());
    }

    // -- REQ1: htSyncFromWallyShift -- called when Wally shift starts ------
    // Single source of truth: Wally's ps9_shift_start drives everything
    function htSyncFromWallyShift(){
        const wallyTime=getShiftStartTime();
        hoursState.shiftStartStr=wallyTime;
        hoursState.shiftStartTime=htParseHHMM(wallyTime);
        hoursState.shiftStarted=true;
        hoursState.shiftEnded=false;
        hoursState.overDopMuted=false;
        // Backfill startTime for any employees pre-activated before shift began
        hoursState.employees.forEach(e=>{
            if(e.status==='active'&&!e.startTime){
                e.startTime=e.customStartStr?htParseHHMM(e.customStartStr):new Date(hoursState.shiftStartTime);
            }
        });
        htSaveState();
        htRenderAll();
    }

    // -- REQ2: htEndShift -- called by Wally's confirmEndShift -------------
    function htEndShift(){
        if(!hoursState.shiftStarted)return;
        const endNow=Date.now();
        hoursState.employees.forEach(e=>{
            if(e.status==='active'){e.frozenHours=htCalcHours(e);e.cutTime=endNow;e.status='cut';}
        });
        hoursState.shiftEnded=true;
        htSaveState();
        // If hours tab is visible, re-render it
        const hoursTab=document.getElementById('tab-hours');
        if(hoursTab&&hoursTab.classList.contains('active'))htRenderAll();
    }

    // REQ2: Build employee hours breakdown HTML for end-shift-summary.
    // Uses optimized hours-ranked assignment (separate from live htAssignRoles).
    // Goal: minimize total Unloader group hours.
    // Highest-hours employee → Belt Tender (Robert Rule satisfied automatically).
    // Next 2 highest → Bulk Sweep. Remainder → Unloader (lowest hours, least total).
    function htBuildBreakdown(){
        if(!hoursState.shiftStarted)return '';
        const engaged=hoursState.employees.filter(e=>e.status==='active'||e.status==='cut'||e.status==='moved');
        if(!engaged.length)return '';
        // Sort descending by hours — no special Robert default, pure merit-based
        const sorted=[...engaged].sort((a,b)=>htCalcHours(b)-htCalcHours(a));
        const bulkSlots=2; // every plan is N/2: always 2 bulk sweep
        const byRole={belt:[],bulk:[],unload:[]};
        sorted.forEach((e,i)=>{
            if(i===0)byRole.belt.push(e);
            else if(i<=bulkSlots)byRole.bulk.push(e);
            else byRole.unload.push(e);
        });
        const ROLE_LABELS={belt:'Belt Tender',bulk:'Bulk Sweep',unload:'Unloader'};
        const ROLE_COLORS={belt:'var(--accent-amber)',bulk:'var(--accent-blue)',unload:'var(--text-sub)'};
        let html='<div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Employee Hours Breakdown</div>';
        ['belt','bulk','unload'].forEach(role=>{
            const emps=byRole[role];
            if(!emps.length)return;
            html+='<div style="background:var(--border-light);border-radius:10px;padding:10px 12px;border-left:3px solid '+ROLE_COLORS[role]+';margin-bottom:4px;">';
            html+='<div style="font-size:11px;font-weight:800;color:'+ROLE_COLORS[role]+';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">'+ROLE_LABELS[role]+'</div>';
            emps.forEach(e=>{
                const hrs=htCalcHours(e);
                html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;">';
                html+='<span style="font-size:13px;font-weight:600;color:var(--text-main);">'+e.name+'</span>';
                html+='<span style="font-size:13px;font-weight:800;color:'+ROLE_COLORS[role]+';">'+htFmtHrs(hrs)+'h</span>';
                html+='</div>';
            });
            html+='</div>';
        });
        return html;
    }

    // -- Shift controls (Hours tab Begin button) ---------------------------
    // REQ1: Begin button triggers Wally's shift start (single source of truth)
    function htHandleShiftBtn(){
        if(!hoursState.shiftStarted){
            // Delegate to Wally's shift start -- this syncs everything
            if(shiftState==='idle'){
                openStartShiftConfirm();
            }else if(shiftState==='live'||shiftState==='demo'){
                // Wally shift already live, just sync HT
                htSyncFromWallyShift();
            }
        }else if(!hoursState.shiftEnded){
            if(confirm('End shift and lock all hours?'))htEndShift();
        }
    }

    function htConfirmReset(){
        if(!confirm('Reset all hours data?'))return;
        localStorage.removeItem('ps9_v4');
        hoursState={shiftStarted:false,shiftEnded:false,shiftStartTime:null,
            shiftStartStr:'20:00',dopConfig:6,employees:[],nextId:1,
            overDopMuted:false,pendingTimeId:null,pendingRoleId:null,pendingCutTimeId:null};
        htInitEmployees();htSaveState();htRenderAll();
    }
    function htSilentReset(){
        localStorage.removeItem('ps9_v4');
        const prevDop=hoursState.dopConfig||6;
        hoursState={shiftStarted:false,shiftEnded:false,shiftStartTime:null,
            shiftStartStr:'20:00',dopConfig:prevDop,employees:[],nextId:1,
            overDopMuted:false,pendingTimeId:null,pendingRoleId:null,pendingCutTimeId:null};
        htInitEmployees();htSaveState();
        if(byId('tab-hours')&&byId('tab-hours').classList.contains('active'))htRenderAll();
    }

    // -- DOP config ----------------------------------------
    function htSetDOP(n){
        if(!HT_DOP_PLANS.includes(n))return;
        hoursState.dopConfig=n;htSyncDOPButtons();htSaveState();htRenderAll();
    }
    function htSyncDOPButtons(){
        HT_DOP_PLANS.forEach(n=>{const b=document.getElementById('ht-dop'+n);if(b)b.classList.toggle('active',hoursState.dopConfig===n)});
    }

    // -- Employee actions ----------------------------------
    function htActivateEmployee(id){
        const emp=hoursState.employees.find(e=>e.id===id);
        if(!emp||emp.status!=='inactive')return;
        emp.status='active';
        emp.pausedMs=0;
        if(hoursState.shiftStarted&&hoursState.shiftStartTime){
            // Shift already live — clock starts now (or custom time)
            emp.startTime=emp.customStartStr?htParseHHMM(emp.customStartStr):new Date(hoursState.shiftStartTime);
        }else{
            // Pre-shift — slot reserved, clock starts when global shift triggers
            emp.startTime=null;
        }
        htSaveState();htRenderAll();htCheckOverDOP();
    }
    // -- Tap a name: put on / take off the board ----------------
    // Cut, moved (working another line) and locked people do not toggle -- a stray tap
    // must not wipe someone's night. Their row shakes and points at the options.
    function htTapEmployee(id){
        const emp=hoursState.employees.find(e=>e.id===id);if(!emp)return;
        const why=emp.locked?'is locked':emp.status==='cut'?'is cut':emp.status==='moved'?'is on '+(emp.movedTo||'another line'):null;
        if(why){
            const row=document.getElementById('ht-row-'+id);
            if(row){row.classList.remove('ht-shake');void row.offsetWidth;row.classList.add('ht-shake');setTimeout(()=>row.classList.remove('ht-shake'),420)}
            showToast(emp.name+' '+why+' — use ⋯ options');return}
        if(emp.status==='inactive')htActivateEmployee(id);
        else if(emp.status==='active')htDeactivateEmployee(id);
    }
    // Back to inactive with a clean slate. Asks first if it would throw away hours.
    function htDeactivateEmployee(id,opts){
        const emp=hoursState.employees.find(e=>e.id===id);
        if(!emp||emp.status==='inactive')return false;
        const hrs=htCalcHours(emp);
        if(!(opts&&opts.skipConfirm)&&hrs>=0.005&&!confirm('Take '+emp.name+' off the board? Their '+htFmtHrs(hrs)+' hours will be cleared.'))return false;
        emp.status='inactive';emp.startTime=null;emp.customStartStr=null;emp.frozenHours=0;emp.cutTime=null;
        emp.pausedMs=0;emp.manualRole=null;emp.movedTo=null;delete emp.preCutManualRole;emp.role=null;
        htSaveState();htRenderAll();htCheckOverDOP();
        return true;
    }
    // Working another PS line for a while: the PS9 clock stops (hours frozen, like a
    // cut) and they drop out of the PS9 roles and the DOP count until they return.
    const HT_OTHER_LINES=['PS1','PS2','PS3','PS4','PS5','PS6','PS7','PS8','PS10','PS11','PS12'];
    function htMoveEmployee(id,line){
        const emp=hoursState.employees.find(e=>e.id===id);
        if(!emp||!HT_OTHER_LINES.includes(line))return false;
        if(emp.status==='active'){
            emp.preCutManualRole=emp.manualRole||null;
            emp.frozenHours=htCalcHours(emp);emp.cutTime=Date.now();emp.manualRole=null;
        }else if(emp.status!=='cut')return false;
        emp.status='moved';emp.movedTo=line;emp.role=null;
        htSaveState();htRenderAll();htCheckOverDOP();
        return true;
    }
    // Back on the PS9 clock; the time away is banked so it is not credited.
    function htReturnEmployee(id){
        const emp=hoursState.employees.find(e=>e.id===id);
        if(!emp||emp.status!=='moved')return false;
        if(!emp.startTime){alert(emp.name+' has no start time to resume from.');return false}
        if(emp.cutTime)emp.pausedMs=(emp.pausedMs||0)+Math.max(0,htFloorMin(Date.now())-htFloorMin(emp.cutTime));
        emp.status='active';emp.cutTime=null;emp.frozenHours=0;emp.movedTo=null;
        if(emp.preCutManualRole!==undefined){emp.manualRole=emp.preCutManualRole;delete emp.preCutManualRole;}
        hoursState.shiftEnded=false;
        htSaveState();htRenderAll();htCheckOverDOP();
        return true;
    }
    function htToggleLock(id){
        const emp=hoursState.employees.find(e=>e.id===id);if(!emp)return;
        emp.locked=!emp.locked;htSaveState();htRenderAll();
    }
    function htUseShiftStart(id){
        const emp=hoursState.employees.find(e=>e.id===id);if(!emp)return;
        emp.customStartStr=null;
        if(emp.status==='active'&&hoursState.shiftStartTime)emp.startTime=new Date(hoursState.shiftStartTime);
        htSaveState();htRenderAll();
    }
    // -- Options sheet (the row's more button) ----------------
    function htOpenOptions(id,view){
        const emp=hoursState.employees.find(e=>e.id===id);if(!emp)return;
        const opt=(icon,label,sub,act,danger)=>`<div class="ht-role-option" role="button" tabindex="0" onclick="${act}">
            <div class="ht-role-opt-icon">${icon}</div><div><div class="ht-role-opt-label"${danger?' style="color:var(--accent-red);"':''}>${label}</div>
            <div class="ht-role-opt-sub">${sub}</div></div></div>`;
        const close="htCloseModal('ht-opts-modal');";
        const st=emp.status;
        document.getElementById('ht-opts-title').textContent=emp.name;
        const sub=st==='inactive'?'Not working':st==='active'?(emp.startTime&&emp.startTime.getTime()>Date.now()?'Scheduled · starts '+htFmtTimeShort(emp.startTime):'Working · '+htFmtHrs(htCalcHours(emp))+' hrs'):
            st==='cut'?'Cut · '+htFmtHrs(htCalcHours(emp))+' hrs':'On '+(emp.movedTo||'another line')+' · '+htFmtHrs(htCalcHours(emp))+' hrs on PS9';
        document.getElementById('ht-opts-sub').textContent=sub+(emp.locked?' · Locked':'');
        const list=document.getElementById('ht-opts-list');
        if(view==='lines'){
            list.innerHTML='<div class="ht-line-grid">'+HT_OTHER_LINES.map(l=>`<button class="ht-line-btn" onclick="${close}htMoveEmployee(${id},'${l}')">${l}</button>`).join('')+'</div>'+
                opt('←','Back','',`htOpenOptions(${id})`);
            htOpenModal('ht-opts-modal');return}
        let h='';
        if(st==='inactive')h+=opt('▶️','Mark working','Put on the board now',`${close}htActivateEmployee(${id})`);
        if(st==='active'||st==='cut')h+=opt('🔄','Role','Auto, Belt Tender, Bulk Sweep or Unloader',`${close}htOpenRoleModal(${id})`);
        if(st==='cut')h+=opt('\ud83d\udd52','Edit times','Change the start and cut times',`${close}htOpenEditTimes(${id})`);
        else if(st!=='moved')h+=opt('🕒','Start time',emp.customStartStr?'Set to '+emp.customStartStr:'Uses the shift start',`${close}htOpenCustomTime(${id})`);
        if(emp.customStartStr&&st!=='moved')h+=opt('↩️','Use shift start','Clear the custom start time',`${close}htUseShiftStart(${id})`);
        if(st==='active')h+=opt('✂️','Cut','Stop the clock',`${close}htCutEmployee(${id})`);
        if(st==='cut')h+=opt('⏯️','Put back on the clock','Start a new stretch; the gap is not counted',`${close}htUncutEmployee(${id})`);
        if(st==='active'||st==='cut')h+=opt('➡️','Move to another line','Stops the PS9 clock and keeps the hours',`htOpenOptions(${id},'lines')`);
        if(st==='moved')h+=opt('⬅️','Return to PS9','Back on the PS9 clock; the time away is not counted',`${close}htReturnEmployee(${id})`);
        h+=opt(emp.locked?'🔓':'🔒',emp.locked?'Unlock':'Lock',emp.locked?'Tapping the name works again':'Stops a tap on the name from changing them',`${close}htToggleLock(${id})`);
        if(st!=='inactive')h+=opt('⏹️','Remove from shift','Off the board; their hours are cleared',`${close}htDeactivateEmployee(${id})`,true);
        if(!isPermanentMember(emp.name))h+=opt('🗑️','Delete','Remove this added employee from the team',`${close}deleteTeamMember(${JSON.stringify(emp.name).replace(/"/g,'&quot;')})`,true);
        list.innerHTML=h;
        htOpenModal('ht-opts-modal');
    }
    function htCutEmployee(id){
        const emp=hoursState.employees.find(e=>e.id===id);
        if(!emp||emp.status!=='active')return;
        emp.preCutManualRole=emp.manualRole||null;
        emp.frozenHours=htCalcHours(emp);emp.cutTime=Date.now();emp.status='cut';emp.manualRole=null;
        htSaveState();
        if(!hoursState.employees.some(e=>e.status==='active')){hoursState.shiftEnded=true;htSaveState();}
        htRenderAll();
    }
    // Reverse a cut. Hours resume from the original start time (the person never
    // actually left), the manual role is restored, and if this was the last person
    // cut, the shift is no longer 'ended'.
    function htUncutEmployee(id){
        const emp=hoursState.employees.find(e=>e.id===id);
        if(!emp||emp.status!=='cut')return;
        if(!emp.startTime){alert(emp.name+' has no start time to resume from.');return}
        // bank the stretch they were off the clock so it is not credited back
        if(emp.cutTime)emp.pausedMs=(emp.pausedMs||0)+Math.max(0,htFloorMin(Date.now())-htFloorMin(emp.cutTime));
        emp.status='active';
        emp.cutTime=null;
        emp.frozenHours=0;
        if(emp.preCutManualRole!==undefined){emp.manualRole=emp.preCutManualRole;delete emp.preCutManualRole;}
        hoursState.shiftEnded=false;
        htSaveState();
        htRenderAll();
    }
    function htAddEmployee(){
        const raw=document.getElementById('ht-new-name').value.trim();
        if(!raw)return;
        const name=formatPersonName(raw);
        if(typeof teamNames==='undefined'){return}
        if(teamHasName(name)){alert('"'+name+'" is already on the list.');return}
        teamNames.push(name);
        refreshTeamNamesSorted();
        saveTeam();
        populateUnloaderSelect();
        renderTeamManagement();
        htCloseModal('ht-add-modal');
        htRenderAll();
    }

    // -- Custom start time ---------------------------------
    function htOpenCustomTime(id){
        hoursState.pendingTimeId=id;
        hoursState.pendingCutTimeId=null; // clear any stale cut-time edit (e.g. cancelled modal)
        const emp=hoursState.employees.find(e=>e.id===id);
        document.getElementById('ht-time-modal-title').textContent=emp.name+' -- Start Time';
        document.getElementById('ht-custom-time').value=emp.customStartStr||hoursState.shiftStartStr||'20:00';
        htOpenModal('ht-time-modal');
    }
    function htOpenCutTime(id){
        hoursState.pendingCutTimeId=id;
        hoursState.pendingTimeId=null; // clear any stale start-time edit (e.g. cancelled modal)
        const emp=hoursState.employees.find(e=>e.id===id);
        const cutDate=emp.cutTime?new Date(emp.cutTime):new Date();
        document.getElementById('ht-time-modal-title').textContent=emp.name+' — Cut Time';
        document.getElementById('ht-custom-time').value=htFmtTime(cutDate);
        htOpenModal('ht-time-modal');
    }
    // Cut employees get one editor for both ends of their shift, rather than two
    // unlabelled time buttons where you couldn't tell start from end.
    let htEditTimesId=null;
    function htOpenEditTimes(id){
        const emp=hoursState.employees.find(e=>e.id===id);
        if(!emp)return;
        htEditTimesId=id;
        const pad=n=>String(n).padStart(2,'0');
        const s=emp.startTime?emp.startTime:(hoursState.shiftStartTime||new Date());
        const e=emp.cutTime?new Date(emp.cutTime):new Date();
        byId('ht-edit-times-title').textContent=emp.name+' \u2014 Times';
        byId('ht-edit-start').value=pad(s.getHours())+':'+pad(s.getMinutes());
        byId('ht-edit-end').value=pad(e.getHours())+':'+pad(e.getMinutes());
        htPreviewEditTimes();
        htOpenModal('ht-edit-times-modal');
    }
    // Start and end are wall-clock times; an end earlier than the start means the
    // shift ran past midnight, so roll it to the next day.
    function htEditTimesSpan(){
        const sv=byId('ht-edit-start').value,ev=byId('ht-edit-end').value;
        if(!sv||!ev)return null;
        const s=htParseHHMM(sv);let e=htParseHHMM(ev);
        if(e.getTime()<s.getTime())e=new Date(e.getTime()+86400000);
        return{start:s,end:e};
    }
    function htPreviewEditTimes(){
        const emp=hoursState.employees.find(x=>x.id===htEditTimesId);
        const span=htEditTimesSpan();
        const out=byId('ht-edit-preview'),note=byId('ht-edit-note');
        if(!span||!emp){if(out)out.textContent='0.00';if(note)note.textContent='';return}
        const paused=htPausedHours(emp);
        const hrs=Math.max(0,htSpanHours(span.start.getTime(),span.end.getTime())-paused);
        if(out)out.textContent=htFmtHrs(hrs);
        if(note){
            const bits=[];
            if(span.end.getDate()!==span.start.getDate())bits.push('ends next day');
            if(paused>0)bits.push(htFmtHrs(paused)+' h off the clock excluded');
            note.textContent=bits.join(' \u00b7 ');
        }
    }
    function htApplyEditTimes(){
        const emp=hoursState.employees.find(x=>x.id===htEditTimesId);
        const span=htEditTimesSpan();
        if(!emp||!span)return;
        emp.startTime=span.start;
        emp.customStartStr=byId('ht-edit-start').value;
        emp.cutTime=span.end.getTime();
        emp.frozenHours=Math.max(0,htSpanHours(span.start.getTime(),span.end.getTime())-htPausedHours(emp));
        htSaveState();htCloseModal('ht-edit-times-modal');htRenderAll();showSaveToast();
    }
    function htApplyCustomTime(){
        const val=document.getElementById('ht-custom-time').value;
        if(!val)return;
        if(hoursState.pendingCutTimeId!=null){
            const emp=hoursState.employees.find(e=>e.id===hoursState.pendingCutTimeId);
            if(emp&&emp.status==='cut'){
                const newCutMs=htParseHHMM(val).getTime();
                emp.cutTime=newCutMs;
                const startMs=emp.startTime?emp.startTime.getTime():(hoursState.shiftStartTime?hoursState.shiftStartTime.getTime():newCutMs);
                emp.frozenHours=Math.max(0,htSpanHours(startMs,newCutMs)-htPausedHours(emp));
                htSaveState();
            }
            htCloseModal('ht-time-modal');hoursState.pendingCutTimeId=null;htRenderAll();
            return;
        }
        const emp=hoursState.employees.find(e=>e.id===hoursState.pendingTimeId);
        if(emp){
            emp.customStartStr=val;
            if(emp.status==='active'){
                emp.startTime=htParseHHMM(val);
            }else if(emp.status==='cut'){
                const startMs=htParseHHMM(val).getTime();
                const endMs=emp.cutTime||Date.now();
                emp.startTime=htParseHHMM(val);
                emp.frozenHours=Math.max(0,htSpanHours(startMs,endMs)-htPausedHours(emp));
            }
            htSaveState();
        }
        htCloseModal('ht-time-modal');hoursState.pendingTimeId=null;htRenderAll();
    }

    // -- Constraint checker --------------------------------
    function htGetAvailableRoles(targetEmpId){
        const engaged=hoursState.employees.filter(e=>(e.status==='active'||e.status==='cut')&&e.id!==targetEmpId);
        const beltTaken=engaged.some(e=>e.manualRole==='belt');
        const manualBulk=engaged.filter(e=>e.manualRole==='bulk').length;
        return{belt:!beltTaken,bulk:manualBulk<2,unload:true,auto:true};
    }

    // -- Role modal ----------------------------------------
    function htOpenRoleModal(id,evt){
        if(evt)evt.stopPropagation();
        const emp=hoursState.employees.find(e=>e.id===id);
        if(!emp||emp.status==='inactive')return;
        hoursState.pendingRoleId=id;
        document.getElementById('ht-role-modal-title').textContent=emp.name;
        const avail=htGetAvailableRoles(id);
        const cur=emp.manualRole||'auto';
        const opts=[
            {key:'auto',icon:'\ud83d\udd04',label:'Auto (Rank-Based)',sub:'System assigns based on hours and DOP',disabled:false},
            {key:'belt',icon:'\u26a1',label:'Belt Tender',sub:avail.belt?'Assign as Belt Tender':'Belt already assigned',disabled:!avail.belt},
            {key:'bulk',icon:'\u2699\ufe0f',label:'Bulk Sweep',sub:avail.bulk?'Assign as Bulk Sweep':'Bulk slots full (2/2)',disabled:!avail.bulk},
            {key:'unload',icon:'\ud83d\udce6',label:'Unloader',sub:'Assign as Unloader',disabled:false}
        ];
        document.getElementById('ht-role-options').innerHTML=opts.map(o=>`
            <div class="ht-role-option ${o.disabled?'ht-role-disabled':''} ${cur===o.key?'sel-'+o.key:''}"
                 onclick="${o.disabled?'':'htApplyManualRole(\''+o.key+'\')'}">
              <div class="ht-role-opt-icon" style="${o.disabled?'opacity:0.35;':''}">${o.icon}</div>
              <div>
                <div class="ht-role-opt-label" style="${o.disabled?'color:var(--text-muted);':''}">${o.label}</div>
                <div class="ht-role-opt-sub" style="${o.disabled?'color:var(--text-muted);':''}">${o.sub}</div>
              </div>
              ${cur===o.key?'<i class="ph ph-check-circle" style="margin-left:auto;color:var(--accent-green);font-size:20px;"></i>':''}
              ${o.disabled?'<i class="ph ph-lock" style="margin-left:auto;color:var(--text-muted);font-size:18px;"></i>':''}
            </div>`).join('');
        htOpenModal('ht-role-modal');
    }
    function htApplyManualRole(key){
        const emp=hoursState.employees.find(e=>e.id===hoursState.pendingRoleId);
        if(emp){
            if(key!=='auto'){
                const avail=htGetAvailableRoles(emp.id);
                if(!avail[key]){htCloseModal('ht-role-modal');hoursState.pendingRoleId=null;return;}
            }
            emp.manualRole=key==='auto'?null:key;
            htSaveState();
        }
        htCloseModal('ht-role-modal');hoursState.pendingRoleId=null;htRenderAll();
    }

    // -- REQ4: KPI breakdown modal -------------------------
    function htOpenBreakdownModal(role){
        const elapsed=htShiftElapsed();
        const ROLE_LABELS={belt:'Belt Tender',bulk:'Bulk Sweep',unload:'Unloader'};
        const ROLE_COLORS={belt:'var(--accent-amber)',bulk:'var(--accent-blue)',unload:'var(--text-sub)'};
        const emps=hoursState.employees.filter(e=>e.role===role&&(e.status==='active'||e.status==='cut'));
        document.getElementById('ht-breakdown-title').textContent=ROLE_LABELS[role]+' Hours';
        const totalHrs=emps.length*elapsed;
        let html='<div style="background:var(--border-light);border-radius:12px;padding:14px 16px;margin-bottom:8px;">';
        html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
        html+='<span style="font-size:12px;font-weight:700;color:'+ROLE_COLORS[role]+';text-transform:uppercase;letter-spacing:0.5px;">'+ROLE_LABELS[role]+'</span>';
        html+='<span style="font-size:22px;font-weight:900;color:'+ROLE_COLORS[role]+';">'+htFmtHrs(totalHrs)+'h</span>';
        html+='</div>';
        html+='<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">'+emps.length+' employee'+(emps.length!==1?'s':'')+' x '+htFmtHrs(elapsed)+'h elapsed</div>';
        if(emps.length){
            emps.forEach(e=>{
                const h=htCalcHours(e);
                const isPinned=!!e.manualRole;
                const isDefault=false;
                html+='<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--border);">';
                html+='<div style="width:8px;height:8px;border-radius:50%;background:'+ROLE_COLORS[role]+';flex-shrink:0;"></div>';
                html+='<div style="flex:1;">';
                html+='<div style="font-size:14px;font-weight:700;color:var(--text-main);">'+e.name+'</div>';
                html+='<div style="font-size:11px;color:var(--text-muted);">'+(e.startTime?htFmtTime(e.startTime):'--')+(isPinned?' \u00b7 Manually pinned':isDefault?' \u00b7 Default belt':'')+'</div>';
                html+='</div>';
                html+='<div style="text-align:right;">';
                html+='<div style="font-size:18px;font-weight:900;color:'+ROLE_COLORS[role]+';">'+htFmtHrs(h)+'h</div>';
                html+='<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px;">individual</div>';
                html+='</div>';
                html+='</div>';
            });
        }else{
            html+='<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:12px 0;">No employees in this role</div>';
        }
        html+='</div>';
        document.getElementById('ht-breakdown-body').innerHTML=html;
        htOpenModal('ht-breakdown-modal');
    }

    // -- Role assignment engine ----------------------------
    // Logic: most hours → Belt, next 2 → Bulk, rest → Unload.
    // Robert W special case: auto-assigned Belt when active (unless another employee has belt pinned).
    // Manual role pins always override auto-assignment.
    function htAssignRoles(){
        // Positions are purely time-driven. Cut employees stay in the ranking with their
        // frozen hours -- being cut does not lock in the position they happened to hold.
        // Their clock has stopped, so as active employees accumulate past them they are
        // overtaken and drop down automatically. Their hours are never lost; they simply
        // rank wherever their total puts them.
        const engaged=hoursState.employees.filter(e=>e.status==='active'||e.status==='cut');
        const bulkMax=2;
        // Sort descending by hours (most hours first = belt priority)
        const sorted=[...engaged].sort((a,b)=>{
            const diff=htCalcHours(b)-htCalcHours(a);
            if(Math.abs(diff)>0.0001)return diff;
            if(a.startTime&&b.startTime)return a.startTime-b.startTime;
            return 0;
        });
        // Pass 1: strip invalid manual pins
        const beltPinned=sorted.filter(e=>e.manualRole==='belt');
        if(beltPinned.length>1)beltPinned.slice(1).forEach(e=>{e.manualRole=null;});
        const bulkPinned=sorted.filter(e=>e.manualRole==='bulk');
        if(bulkPinned.length>bulkMax)bulkPinned.slice(bulkMax).forEach(e=>{e.manualRole=null;});
        sorted.forEach(e=>{e.role=null;});
        // Pass 2: assign roles in hours-ranked order -- most hours takes Belt, the next
        // two take Bulk, everyone else unloads. Manual pins still win over the ranking.
        // (There is deliberately no default/preferred Belt Tender: the roster is dynamic.)
        let beltFilled=0,bulkFilled=0;
        // Pinned employees claim their slot FIRST. Assigning in one hours-ranked pass let
        // an unpinned higher-hours employee take Belt before the pinned one was reached,
        // leaving two Belt Tenders.
        sorted.forEach(emp=>{
            if(!emp.manualRole)return;
            emp.role=emp.manualRole;
            if(emp.manualRole==='belt')beltFilled++;
            else if(emp.manualRole==='bulk')bulkFilled++;
        });
        // Then fill whatever is left, most hours first: Belt, then Bulk, then Unload.
        sorted.forEach(emp=>{
            if(emp.manualRole)return;
            if(beltFilled<1){emp.role='belt';beltFilled++;}
            else if(bulkFilled<bulkMax){emp.role='bulk';bulkFilled++;}
            else{emp.role='unload';}
        });
        // Inactive and moved (working another line) hold no PS9 role.
        hoursState.employees.filter(e=>e.status==='inactive'||e.status==='moved').forEach(e=>{e.role=null;});
    }

    // -- DOP calculation -----------------------------------
    function htCalcDOP(){
        const active=hoursState.employees.filter(e=>e.status==='active');
        if(!active.length)return{dopState:'none',label:'NO ACTIVE STAFF',
            sub:'Start employees to evaluate DOP',unloaderCount:0,bulkCount:0,
            targetUnloaders:hoursState.dopConfig,delta:0};
        const bulkCount=active.filter(e=>e.role==='bulk').length;
        const unloaderCount=active.filter(e=>e.role==='unload').length;
        const totalRequired=1+2+hoursState.dopConfig;
        const delta=active.length-totalRequired;
        let dopState,label,sub;
        const dopLabel=hoursState.dopConfig+'/2';
        if(delta===0){dopState='met';label='DOP MET';sub=dopLabel+' · Fully staffed';}
        else if(delta<0){const d=Math.abs(delta);dopState='low';label='DOWN '+d;sub='Need '+d+' more for '+dopLabel+' DOP';}
        else{dopState='over';label='OVER '+delta;sub=delta+' above '+dopLabel+' DOP';}
        return{dopState,label,sub,unloaderCount,bulkCount,targetUnloaders:hoursState.dopConfig,delta};
    }

    // -- Over-DOP toast ------------------------------------
    let htLastDOPOver=false;
    function htCheckOverDOP(){
        const{dopState,delta}=htCalcDOP();
        const isOver=dopState==='over';
        if(isOver&&!htLastDOPOver&&!hoursState.overDopMuted){
            document.getElementById('ht-toast-msg').textContent=
                'You are '+delta+' employee'+(delta>1?'s':'')+' above '+hoursState.dopConfig+'/2 DOP.';
            document.getElementById('ht-toast').classList.add('show');
        }
        htLastDOPOver=isOver;
    }
    function htDismissToast(mute){
        document.getElementById('ht-toast').classList.remove('show');
        if(mute){hoursState.overDopMuted=true;htSaveState();}
    }

    // -- Render DOP bar ------------------------------------
    function htRenderDOPBar(d){
        const bar=document.getElementById('ht-dop-bar');
        if(!bar)return;
        bar.className='ht-dop-bar state-'+d.dopState;
        document.getElementById('ht-dop-label').textContent=d.label;
        document.getElementById('ht-dop-sub').textContent=d.sub;
        const counts=document.getElementById('ht-dop-counts');
        counts.innerHTML=d.dopState!=='none'?
            '<div class="ht-count-chip">Belt '+1+'</div>'+
            '<div class="ht-count-chip">Bulk '+d.bulkCount+'/2</div>'+
            '<div class="ht-count-chip">Unload '+d.unloaderCount+'/'+d.targetUnloaders+'</div>':'';
    }

    // -- Render KPI (sum of individual employee hours per role) ----
    function htRenderKPI(){
        if(!hoursState.shiftStarted||!hoursState.shiftStartTime){
            ['ht-kpi-belt','ht-kpi-bulk','ht-kpi-unload'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='0.00';});
            const bs=document.getElementById('ht-kpi-bulk-sub'),us=document.getElementById('ht-kpi-unload-sub');
            if(bs)bs.textContent='hrs \u00b7 0 people';if(us)us.textContent='hrs \u00b7 0 people';
            updateNameplateHours();
            return;
        }
        const engaged=hoursState.employees.filter(e=>e.status==='active'||e.status==='cut');
        const belt=engaged.filter(e=>e.role==='belt');
        const bulk=engaged.filter(e=>e.role==='bulk');
        const unload=engaged.filter(e=>e.role==='unload');
        const sumHrs=emps=>emps.reduce((s,e)=>s+htCalcHours(e),0);
        const setEl=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
        setEl('ht-kpi-belt',htFmtHrs(sumHrs(belt)));
        setEl('ht-kpi-bulk',htFmtHrs(sumHrs(bulk)));
        const unloadHrs=sumHrs(unload);
        setEl('ht-kpi-unload',htFmtHrs(unloadHrs));
        setEl('ht-kpi-bulk-sub','hrs \u00b7 '+bulk.length+' people');
        setEl('ht-kpi-unload-sub','hrs \u00b7 '+unload.length+' people');
        updateNameplateHours();
        obsValidateAgainstDOP();
    }

    // -- Render employee row -------------------------------
    function htRenderRow(emp,rank){
        const hrs=htCalcHours(emp);
        const roleCfg=emp.role?HT_ROLES[emp.role]:null;
        const isMoved=emp.status==='moved';
        const rowCls=['ht-emp-row',
            emp.status==='active'?'ht-active':'',
            (emp.status==='cut'||isMoved)?'ht-cut':'',
            isMoved?'ht-moved':'',
            emp.role?'ht-role-'+emp.role:''].filter(Boolean).join(' ');
        const rankTxt=(emp.status==='active'||emp.status==='cut')?rank+1:'--';
        const future=emp.status==='active'&&emp.startTime&&emp.startTime.getTime()>Date.now();
        const startTs=emp.startTime?htFmtTime(emp.startTime):(emp.customStartStr||'');
        let meta='';
        if(isPS9Core(emp.name))meta+='<span class="ps9-core-tag" title="PS9 Twilight">PS9</span>';
        if(roleCfg)meta+='<span class="ht-role-tag '+roleCfg.tagCls+'">'+roleCfg.label+'</span>';
        if(emp.status==='cut')meta+='<span class="ht-cut-badge">Cut</span>';
        if(isMoved)meta+='<span class="ht-moved-tag">→ '+escHTML(emp.movedTo||'')+'</span>';
        if(emp.manualRole)meta+='<span class="ht-tag-manual">📌 Pinned</span>';
        if(emp.locked)meta+='<span class="ht-lock-tag">🔒 Locked</span>';
        if(future)meta+='<span class="ht-sched-tag">Starts '+htFmtTimeShort(emp.startTime)+'</span>';
        else if((emp.status==='cut'||isMoved)&&emp.startTime&&emp.cutTime)meta+='<span class="ht-emp-ts">'+htFmtTimeShort(emp.startTime)+'–'+htFmtTimeShort(new Date(emp.cutTime))+'</span>';
        else if(startTs)meta+='<span class="ht-emp-ts">'+startTs+'</span>';
        const hrsHTML=emp.status!=='inactive'
            ?'<div class="ht-hrs">'+htFmtHrs(hrs)+'</div><div class="ht-hrs-lbl">hrs</div>'
            :'<div class="ht-hrs" style="color:var(--text-muted);font-size:18px;">--</div>';
        const rowClick='';
        const more='<button class="ht-btn ht-btn-more" onclick="htOpenOptions('+emp.id+');event.stopPropagation()" aria-label="Options for '+escHTML(emp.name)+'" title="Options">⋯</button>';
        let actHTML='';
        // One main action per state plus the options button; start/end time edits live in
        // the options sheet (the times still show under the name). With a third button
        // the row overflowed a 375px screen.
        if(emp.status==='inactive'){
            actHTML='<div class="ht-actions">'+
                '<button class="ht-btn ht-btn-start" onclick="htActivateEmployee('+emp.id+');event.stopPropagation()">Start</button>'+
                more+'</div>';
        }else if(emp.status==='active'){
            actHTML='<div class="ht-actions">'+
                '<button class="ht-btn ht-btn-cut" onclick="htCutEmployee('+emp.id+');event.stopPropagation()">Cut</button>'+
                more+'</div>';
        }else if(isMoved){
            actHTML='<div class="ht-actions ht-actions-cut">'+
                '<button class="ht-btn ht-btn-undo" onclick="htReturnEmployee('+emp.id+');event.stopPropagation()" title="Return '+escHTML(emp.name)+' to PS9" aria-label="Return to PS9">PS9</button>'+
                more+'</div>';
        }else{
            actHTML='<div class="ht-actions ht-actions-cut">'+
                '<button class="ht-btn ht-btn-undo" onclick="htUncutEmployee('+emp.id+');event.stopPropagation()" title="Undo cut -- put '+escHTML(emp.name)+' back to work" aria-label="Undo cut"><i class="ph ph-arrow-u-up-left"></i></button>'+
                more+'</div>';
        }
        return'<div class="'+rowCls+'" id="ht-row-'+emp.id+'" '+rowClick+'>'+
            '<div class="ht-rank">'+rankTxt+'</div>'+
            '<div class="ht-role-icon">'+( roleCfg?roleCfg.icon:'\u00b7')+'</div>'+
            '<div class="ht-emp-info" onclick="htTapEmployee('+emp.id+')" role="button" tabindex="0" aria-label="'+escHTML(emp.name)+(emp.status==='inactive'?', tap to put on the board':emp.status==='active'?', tap to take off the board':'')+'">'+
                '<div class="ht-emp-name">'+escHTML(emp.name)+'</div>'+
                '<div class="ht-emp-meta">'+meta+'</div>'+
            '</div>'+
            '<div class="ht-hrs-wrap">'+hrsHTML+'</div>'+
            actHTML+
        '</div>';
    }

    // -- Full render ---------------------------------------
    function htRenderAll(){
        htReconcileRoster();
        htAssignRoles();
        const pill=document.getElementById('ht-live-pill');
        const wallyLive=(typeof shiftState!=='undefined')&&(shiftState==='live'||shiftState==='demo');
        if(pill)pill.classList.toggle('show',wallyLive&&hoursState.shiftStarted&&!hoursState.shiftEnded);
        const endBanner=document.getElementById('ht-ended-banner');
        if(endBanner)endBanner.classList.toggle('show',hoursState.shiftEnded);
        const dopInfo=htCalcDOP();
        htRenderDOPBar(dopInfo);htRenderKPI();
        const engaged=hoursState.employees.filter(e=>e.status==='active'||e.status==='cut');
        const inactive=hoursState.employees.filter(e=>e.status==='inactive');
        const ROLE_ORDER={belt:0,bulk:1,unload:2};
        const sortedEngaged=[...engaged].sort((a,b)=>{
            const ra=ROLE_ORDER[a.role]??3,rb=ROLE_ORDER[b.role]??3;
            if(ra!==rb)return ra-rb;
            const diff=htCalcHours(b)-htCalcHours(a);
            if(Math.abs(diff)>0.0001)return diff;
            if(a.startTime&&b.startTime)return a.startTime-b.startTime;
            return 0;
        });
        const moved=hoursState.employees.filter(e=>e.status==='moved');
        const actSect=document.getElementById('ht-active-section');
        if(actSect)actSect.style.display=(engaged.length||moved.length)?'flex':'none';
        const actList=document.getElementById('ht-active-list');
        if(actList)actList.innerHTML=sortedEngaged.map((e,i)=>htRenderRow(e,i)).join('')+moved.map(e=>htRenderRow(e,-1)).join('');
        const inactList=document.getElementById('ht-inactive-list');
        if(inactList)inactList.innerHTML=inactive.map(e=>htRenderRow(e,-1)).join('');
        hoursState.employees.forEach(e=>{e.prevRole=e.role;});
        htCheckOverDOP();
    }

    // -- Tick ---------------------------------------------
    function htTick(){
        const hoursTab=document.getElementById('tab-hours');
        if(!hoursTab||!hoursTab.classList.contains('active'))return;
        if(!hoursState.shiftStarted||hoursState.shiftEnded)return;
        htAssignRoles();
        let rolesChanged=false;
        hoursState.employees.forEach(e=>{if(e.role!==e.prevRole)rolesChanged=true;});
        if(rolesChanged){htRenderAll();return;}
        hoursState.employees.forEach(e=>{
            if(e.status!=='active')return;
            const row=document.getElementById('ht-row-'+e.id);
            if(!row)return;
            const el=row.querySelector('.ht-hrs');
            if(el)el.textContent=htFmtHrs(htCalcHours(e));
        });
        htRenderKPI();
        const dopInfo=htCalcDOP();htRenderDOPBar(dopInfo);
        hoursState.employees.forEach(e=>{e.prevRole=e.role;});
    }

    // -- Modal helpers -------------------------------------
    function htOpenModal(id){document.getElementById(id).classList.add('open');}
    function htCloseModal(id){document.getElementById(id).classList.remove('open');}
    function htOverlayClick(e,id){if(e.target===document.getElementById(id))htCloseModal(id);}
    function htOpenAddModal(){
        document.getElementById('ht-new-name').value='';
        htOpenModal('ht-add-modal');
        setTimeout(()=>document.getElementById('ht-new-name').focus(),350);
    }

    // setInterval for HT tick -- runs once per second when Hours tab is active
    setInterval(htTick,1000);

    // ── ACCESSIBILITY SETUP ──────────────────────────────────
    // Adds dialog role/aria-modal/aria-labelledby to all modal sheets,
    // and auto-focuses the first focusable element when any modal opens.
    (function setupA11y(){
        // Label every modal sheet
        document.querySelectorAll('.modal-sheet').forEach(sheet=>{
            sheet.setAttribute('role','dialog');
            sheet.setAttribute('aria-modal','true');
            const h2=sheet.querySelector('h2');
            if(h2){if(!h2.id)h2.id='mh-'+Math.random().toString(36).substr(2,6);sheet.setAttribute('aria-labelledby',h2.id);}
        });
        document.querySelectorAll('.h-modal-sheet').forEach(sheet=>{
            sheet.setAttribute('role','dialog');
            sheet.setAttribute('aria-modal','true');
            const title=sheet.querySelector('.h-modal-title');
            if(title){if(!title.id)title.id='hmt-'+Math.random().toString(36).substr(2,6);sheet.setAttribute('aria-labelledby',title.id);}
        });
        // Auto-focus first focusable element in .modal-overlay when display:flex
        const focusFirst=sheet=>{const f=sheet.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');if(f.length)setTimeout(()=>f[0].focus(),350);};
        document.querySelectorAll('.modal-overlay').forEach(el=>{
            new MutationObserver(muts=>{muts.forEach(m=>{if(m.attributeName==='style'&&el.style.display==='flex'){const s=el.querySelector('.modal-sheet');if(s)focusFirst(s);}});}).observe(el,{attributes:true,attributeFilter:['style']});
        });
        // Auto-focus in h-modal-overlay when class 'open' added
        document.querySelectorAll('.h-modal-overlay').forEach(el=>{
            new MutationObserver(muts=>{muts.forEach(m=>{if(m.attributeName==='class'&&el.classList.contains('open')){const s=el.querySelector('.h-modal-sheet');if(s)focusFirst(s);}});}).observe(el,{attributes:true,attributeFilter:['class']});
        });
    })();
