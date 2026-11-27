// Wally Dashboard -- Shift state, live PPH, start/end shift, dashboard rendering and init().
// Loaded as a classic script from index.html; all files share one global scope.

    // -- SHIFT STATE MACHINE ---------------------------------
    function loadShiftState(){const s=localStorage.getItem('ps9_shift_state');if(s==='live'||s==='demo')shiftState=s;else shiftState='idle';const et=localStorage.getItem('ps9_shift_end_time');shiftEndTime=et?parseInt(et,10):null;}
    function saveShiftState(){localStorage.setItem('ps9_shift_state',shiftState)}
    // -- LIVE PPH -------------------------------------------
    // Volume is entered as a running total once an hour. PPH is measured against the
    // unload hours AT THE MOMENT of that entry, not the current hours -- otherwise the
    // figure would sag all hour and snap back on each entry, looking like lost
    // performance when it is really just a stale count.
    let pphLog=[];
    function loadPphLog(){try{pphLog=JSON.parse(localStorage.getItem('ps9_pph_log'))||[]}catch(e){pphLog=[]}
        if(!Array.isArray(pphLog))pphLog=[]}
    function savePphLog(){localStorage.setItem('ps9_pph_log',JSON.stringify(pphLog))}
    function clearPphLog(){pphLog=[];savePphLog()}
    function latestPphEntry(){return pphLog.length?pphLog[pphLog.length-1]:null}
    function recordVolume(vol){
        const hrs=getUnloadHours();
        pphLog.push({ts:Date.now(),volume:vol,hrs,pph:hrs>0?Math.round(vol/hrs):null});
        savePphLog();
        updateNameplateHours();renderPphHistory();}
    // A count older than this is probably no longer representative.
    const PPH_STALE_MS=75*60*1000;

    // Mirrors the DOP tab's UNLOAD tile (unload-role hours only, active + cut).
    function getUnloadHours(){
        if(typeof hoursState==='undefined'||!hoursState||!Array.isArray(hoursState.employees))return 0;
        if(!hoursState.shiftStarted||!hoursState.shiftStartTime)return 0;
        return hoursState.employees
            .filter(e=>(e.status==='active'||e.status==='cut')&&e.role==='unload')
            .reduce((s,e)=>s+htCalcHours(e),0);
    }
    function updateNameplateHours(){
        const hEl=byId('nameplate-hours-val'),pEl=byId('nameplate-pph-val');if(!hEl||!pEl)return;
        const hrs=getUnloadHours();
        hEl.textContent=(typeof htFmtHrs==='function')?htFmtHrs(hrs):hrs.toFixed(2);
        const e=latestPphEntry(),pph=(e&&e.pph!=null)?e.pph:null;
        pEl.textContent=pph!=null?pph:'\u2014';
        const box=byId('nameplate-hours');
        if(box){
            // Under the target turns the figure and the ring red. Demo keeps its own
            // ring colour, so the CSS lets .demo win over .under.
            box.classList.toggle('under',pph!=null&&pph<PPH_TARGET);
            box.classList.toggle('no-count',pph==null);
        }
        // A stale count dims the row rather than recolouring it, so the red/green
        // reading stays intact.
        const line=byId('nameplate-pph-line');
        if(line)line.classList.toggle('stale',!!e&&(Date.now()-e.ts)>PPH_STALE_MS);
    }
    function updateNameplate(){
        const btn=byId('btn-shift-action'),btnIcon=byId('btn-shift-icon'),btnLabel=byId('btn-shift-label');
        const sub=byId('nameplate-sub');
        const eff=getShiftStartTime();const[sh,sm]=eff.split(':').map(Number);const ampm=sh>=12?'PM':'AM';const sh12=sh===0?12:(sh>12?sh-12:sh);const startDisp=' \u00b7 Start '+sh12+':'+String(sm).padStart(2,'0')+' '+ampm;
        if(shiftState==='idle'){
            btn.className='btn-shift start';
            btnIcon.className='ph ph-play-circle';
            btnLabel.textContent='Start Shift';
            sub.textContent='by Fitz Joseph \u00b7 v'+APP_VERSION+startDisp}
        else if(shiftState==='live'){
            btn.className='btn-shift end';
            btnIcon.className='ph ph-stop-circle';
            btnLabel.textContent='End Shift';
            sub.textContent='by Fitz Joseph \u00b7 v'+APP_VERSION+startDisp}
        else if(shiftState==='demo'){
            btn.className='btn-shift end';
            btnIcon.className='ph ph-stop-circle';
            btnLabel.textContent='End Demo';
            sub.textContent='by Fitz Joseph \u00b7 v'+APP_VERSION+' \u00b7 DEMO'+startDisp}
        // One centred control: the Start button becomes the running hours meter.
        const meter=byId('nameplate-hours'),live=shiftState!=='idle';
        if(meter){meter.classList.toggle('visible',live);meter.classList.toggle('demo',shiftState==='demo');}
        if(btn)btn.style.display=live?'none':'flex';}

    function handleShiftAction(){
        if(shiftState==='idle')openStartShiftConfirm();
        else openEndShiftModal()}

    // Tapping the running meter offers the two things you'd want mid-shift.
    function openShiftMenu(){
        if(shiftState==='idle')return;
        const sub=byId('shift-menu-sub');
        if(sub)sub.textContent=(typeof htFmtHrs==='function'?htFmtHrs(getUnloadHours()):getUnloadHours().toFixed(2))+' unload hours so far.';
        byId('shift-menu-modal').style.display='flex'}
    function shiftMenuVolume(){closeModal('shift-menu-modal');openVolumeModal()}
    function openVolumeModal(){
        const e=latestPphEntry(),inp=byId('pph-volume-input');
        if(inp){inp.value=e?e.volume:'';inp.oninput=updateVolumePreview}
        updateVolumePreview();renderPphHistory();
        byId('pph-volume-modal').style.display='flex';
        setTimeout(()=>{if(inp)inp.focus()},120)}
    function updateVolumePreview(){
        const inp=byId('pph-volume-input');if(!inp)return;
        const vol=parseFloat(inp.value),hrs=getUnloadHours();
        const v=byId('pph-volume-preview-val'),s=byId('pph-volume-preview-sub');
        if(s)s.textContent='over '+((typeof htFmtHrs==='function')?htFmtHrs(hrs):hrs.toFixed(2))+' unload hrs';
        if(!v)return;
        v.textContent=(!isNaN(vol)&&vol>=0&&hrs>0)?Math.round(vol/hrs)+' PPH':'\u2014 PPH'}
    function confirmVolume(){
        const inp=byId('pph-volume-input'),vol=parseFloat(inp.value);
        if(isNaN(vol)||vol<0)return alert('Enter the running package count.');
        if(getUnloadHours()<=0)return alert('No unload hours recorded yet \u2014 start unloaders on the DOP tab first.');
        recordVolume(vol);
        closeModal('pph-volume-modal');showSaveToast()}
    function renderPphHistory(){
        const list=byId('pph-history-list'),lbl=byId('pph-history-label');if(!list)return;
        if(lbl)lbl.style.display=pphLog.length?'block':'none';
        list.innerHTML=pphLog.slice().reverse().map((e,i,arr)=>{
            const prev=arr[i+1];
            const dv=prev?e.volume-prev.volume:e.volume;
            const dh=prev?e.hrs-prev.hrs:e.hrs;
            const inc=(dh>0)?Math.round(dv/dh):null;
            const t=new Date(e.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            return'<div class="note-history-entry"><div class="note-history-entry-date">'+t+'</div>'+
                '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;">'+
                '<span style="font-size:13px;font-weight:700;color:var(--text-sub);">'+e.volume.toLocaleString()+' pkgs \u00b7 '+e.hrs.toFixed(2)+' hrs</span>'+
                '<span style="font-size:15px;font-weight:900;color:var(--text-main);">'+(e.pph!=null?e.pph:'\u2014')+' PPH</span></div>'+
                (inc!=null?'<div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-top:3px;">this interval: '+inc+' PPH</div>':'')+
                '</div>'}).join('')}
    function shiftMenuBreakdown(){closeModal('shift-menu-modal');switchTab('hours')}
    function shiftMenuEnd(){closeModal('shift-menu-modal');openEndShiftModal()}

    // Onboarding while idle means timers and stats aren't running yet. Ask once per
    // idle period rather than on every trailer, so setting up several bays isn't a nag.
    let startPromptShown=false;
    function maybePromptStartShift(id){
        if(shiftState!=='idle'||startPromptShown)return;
        startPromptShown=true;
        const sub=byId('onboard-start-sub');
        if(sub)sub.textContent=(id?'Wally '+id+' is onboarded':'A trailer is onboarded')+', but the shift hasn\u2019t been started yet \u2014 timers and stats only run once it does.';
        byId('onboard-start-shift-modal').style.display='flex'}
    // They just onboarded, so keep the bays rather than asking again what to do with them.
    function promptStartShiftYes(){closeModal('onboard-start-shift-modal');confirmStartShift(true)}

    function openStartShiftConfirm(){
        if(demoActive){startDemoShift();return}
        let activeBayCount=0;
        for(let i=DOORS_START;i<=DOORS_END;i++){
            if(doors[i].status==='active'||doors[i].status==='staged')activeBayCount++;
        }
        if(activeBayCount>0){
            byId('start-shift-bay-count').textContent=activeBayCount;
            byId('start-shift-bays-modal').style.display='flex';
            return;
        }
        if(!confirm('Start a new shift? This will clear all logs, but keep your notes and team names.'))return;
        confirmStartShift(false);
    }

    function confirmStartShift(keepBays){
        // Pick up tonight's scheduled start before the shift locks it in. init() is the
        // only other place this runs, and a Home Screen app is often left open from one
        // shift to the next without a reload, so it could still hold yesterday's time.
        syncShiftStartToSchedule();
        closeModal('start-shift-bays-modal');
        startPromptShown=false;
        clearPphLog();
        if(!keepBays){
            for(let i=DOORS_START;i<=DOORS_END;i++)doors[i]={status:'empty',start:0,laborStart:null,id:'',type:'',unloader:'',unavailable:false,lastCompletionTime:null,assignments:[]};
        }
        // Idle only counts within a shift: no door carries a completion (or unavailable
        // time) from before this Start Shift, including bays kept open across it.
        {const now=Date.now();for(let i=DOORS_START;i<=DOORS_END;i++){const d=doors[i];if(!d)continue;
            d.lastCompletionTime=null;d.idleExcludeMs=0;d.unavailableMs=0;if(d.unavailable)d.unavailableSince=now;else delete d.unavailableSince}}
        historyLog=[];
        lastSortStartTime=null;isFirstOnboard=false;
        saveDoors();saveHistory();saveData();
        shiftState='live';saveShiftState();setShiftMeta(currentShiftKey(),Date.now());
        shiftEndTime=null;
        localStorage.removeItem('ps9_shift_end_time');
        startDashboardRefresh();
        updateNameplate();renderDashboard();renderActiveTab();updateTabBadges();
        attemptWebhook({dataType:'NEW_SHIFT',dateKey:dateKeyFromTs(Date.now()),shiftStart:getShiftStartTime()});
        showToast(keepBays?'New shift started — bays carried over':'Shift started');
        htSyncFromWallyShift();
    }

    function startDemoShift(){
        // Demo path -- does NOT clear data, just activates demo and marks state
        shiftState='demo';saveShiftState();
        shiftEndTime=null; // unfreeze timers
        startDashboardRefresh(); // restart auto-refresh
        demoActive=true;
        byId('switch-demo-mode').classList.add('checked');
        updateDemoBanner();updateNameplate();htSyncFromWallyShift();
        for(let i=DOORS_START;i<=DOORS_END;i++)if(doors[i].status==='empty'&&(i-DOORS_START)<config.doorCount)randomArrival(i);
        saveDoors();switchTab('dashboard');updateTabBadges();
        showToast('Demo shift started')}

    function openEndShiftModal(){
        // Build summary for the modal
        let activeCt=0,stagedCt=0,wallyCt=0,cpuCt=0,incompleteCt=0;
        for(let i=DOORS_START;i<=DOORS_END;i++){
            if(doors[i].status==='active'){activeCt++;if(doors[i].type==='Wally')wallyCt++;else cpuCt++}
            if(doors[i].status==='staged')stagedCt++}
        const shiftLogs=thisShiftLogs();
        shiftLogs.forEach(l=>{if(l.status==='incomplete')incompleteCt++});
        const completedW=shiftLogs.filter(l=>l.status==='completed'&&l.type==='Wally').length;
        const completedC=shiftLogs.filter(l=>l.status==='completed'&&l.type==='CPU').length;
        const summaryEl=byId('end-shift-summary');
        summaryEl.innerHTML=`
            <div style="display:flex;justify-content:space-between;font-size:14px;"><span style="color:var(--text-muted);font-weight:600;">Wallies completed</span><span style="font-weight:800;">${completedW}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:14px;"><span style="color:var(--text-muted);font-weight:600;">CPUs completed</span><span style="font-weight:800;">${completedC}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:14px;border-top:1px solid var(--bg);padding-top:8px;margin-top:2px;"><span style="color:var(--accent-red);font-weight:600;">Active bays remaining</span><span style="font-weight:800;color:var(--accent-red);">${activeCt+stagedCt}</span></div>
            `+(htBuildBreakdown()?`<div style="margin-top:8px;">${htBuildBreakdown()}</div>`:'');
        const shareTotalChk=byId('chk-share-total');if(shareTotalChk)shareTotalChk.checked=false;
        byId('end-shift-modal').style.display='flex'}

    function confirmEndShift(keepBays){
        const now=Date.now();
        shiftEndTime=now; // freeze all bay timers at this moment
        localStorage.setItem('ps9_shift_end_time',String(now));
        const isDemo=shiftState==='demo';
        let closedCount=0;
        if(!keepBays){
            // Close all remaining active/staged bays as incomplete
            for(let i=DOORS_START;i<=DOORS_END;i++){
                const d=doors[i];
                if(d.status==='active'||d.status==='staged'){
                    const logEntry={door:i,id:d.id,account:d.account||'',type:d.type,
                        unloader:d.unloader||'Unassigned',assistants:[],
                        start:d.start,laborStart:d.laborStart||d.start,end:now,
                        dateKey:dateKeyFromTs(now),duration:now-d.start,
                        durationMinutes:Math.round((now-d.start)/60000),
                        unloadDurationMinutes:Math.round((now-(d.laborStart||d.start))/60000),
                        dwellMinutes:0,idleBeforeMinutes:null,statOffset:0,
                        logId:d.logId||Date.now().toString(36)+i,
                        duplicate:false,completionHour:getCompletionHour(now),
                        shiftKey:currentShiftKey(),
                        cpuOptions:d.cpuOptions||[],status:'incomplete',
                        noteSnapshot:d.type==='Wally'?getNoteObj(d.id):null};
                    historyLog.unshift(logEntry);
                    sendToWebhook(logEntry,'end');
                    doors[i]={status:'empty',start:0,laborStart:null,id:'',type:'',unloader:'',unavailable:false,lastCompletionTime:now,assignments:[]};
                    closedCount++}}}
        // Fire SHIFT_END summary webhook
        const endLogs=thisShiftLogs();
        const completedW=endLogs.filter(l=>l.status==='completed'&&l.type==='Wally').length;
        const completedC=endLogs.filter(l=>l.status==='completed'&&l.type==='CPU').length;
        const incompleteN=endLogs.filter(l=>l.status==='incomplete').length;
        // shiftDate is the shift day (the evening it began), not the calendar date at End --
        // a shift ended after midnight was being filed under the next day in Shift Log.
        queuePayload({dataType:'SHIFT_END',shiftDate:currentShiftKey(),endTime:now,
            shiftStart:getShiftStartTime(),totalWallies:completedW,totalCPUs:completedC,
            totalIncomplete:incompleteN,baysClosedNow:closedCount,keepBays,isDemo});
        processWebhookQueue();
        // Reset state
        shiftState='idle';saveShiftState();
        // Stop dashboard auto-refresh -- timers are now frozen
        if(dashboardRefreshTimer){clearInterval(dashboardRefreshTimer);dashboardRefreshTimer=null;}
        demoActive=false;
        byId('switch-demo-mode').classList.remove('checked');
        updateDemoBanner();
        if(!keepBays){saveDoors()}
        saveHistory();
        // Share total wallies if requested
        const shareTotal=!!(byId('chk-share-total')&&byId('chk-share-total').checked);
        purgeTemporaryEmployees();
        clearChecklist();
        closeModal('end-shift-modal');
        updateNameplate();renderDashboard();renderActiveTab();updateTabBadges();
        showToast(keepBays?`Shift ended \u2014 ${completedW+completedC} completions synced`:`Shift ended \u2014 ${closedCount} bay${closedCount!==1?'s':''} closed`);
        try{htEndShift();}catch(e){console.error('htEndShift error:',e);}finally{htSilentReset();}
        // htSilentReset() always runs via finally block above
        if(shareTotal&&navigator.share){
            const wallyShareCount=completedW;
            navigator.share({text:`PS9 - ${wallyShareCount} number of wallies`}).catch(err=>console.log('Share dismissed:',err));
        }
    }

    function showToast(msg){const t=byId('save-toast');t.querySelector('span').textContent=msg;t.classList.add('visible');setTimeout(()=>{t.querySelector('span').textContent='Saved';t.classList.remove('visible')},2500)}
    // --------------------------------------------------------

    function newShift(){
        if(!confirm("Start a new shift? This will clear all active trailers and logs, but keep your notes, accounts, and team names."))return;
        for(let i=DOORS_START;i<=DOORS_END;i++)doors[i]={status:'empty',start:0,laborStart:null,id:'',type:'',unloader:'',unavailable:false,lastCompletionTime:null,assignments:[]};
        historyLog=[];
        lastSortStartTime=null;
        isFirstOnboard=false;
        saveDoors();saveHistory();saveData();
        renderDashboard();renderActiveTab();updateTabBadges();showSaveToast();
        // Ping Google Sheets so the Live View resets to zero immediately
        attemptWebhook({dataType:'NEW_SHIFT',dateKey:dateKeyFromTs(Date.now()),shiftStart:getShiftStartTime()});
    }
    function confirmMoveDoor(){const dest=byId('move-dest-select').value;if(!dest)return alert("Please select a destination");pendingMoveDest=dest;closeModal('move-menu-modal');if(dest==='Incomplete')moveDoor(dest,false);else byId('move-count-modal').style.display='flex'}
    function handleMoveCount(countAsCompletion){closeModal('move-count-modal');moveDoor(pendingMoveDest,countAsCompletion);pendingMoveDest=null}
    function openAddUnloaderModal(){byId('input-new-unloader-name').value='';byId('add-unloader-modal').style.display='flex';setTimeout(()=>{byId('input-new-unloader-name').focus()},100)}
    function confirmAddUnloader(){const raw=byId('input-new-unloader-name').value.trim();if(!raw)return alert("Please enter a name");const formatted=formatPersonName(raw);if(teamHasName(formatted)){alert(`"${formatted}" is already on the team list.`);return}teamNames.push(formatted);refreshTeamNamesSorted();saveTeam();populateUnloaderSelect();renderTeamManagement();htReconcileRoster();closeModal('add-unloader-modal');showSaveToast()}
    function init(){console.log(`Wally Dashboard v${APP_VERSION} initialized`);doors=loadJSON('ps9_doors',isObject,()=>({}));for(let i=DOORS_START;i<=DOORS_END;i++){if(!doors[i])doors[i]={status:'empty',start:0,laborStart:null,id:'',type:'',unloader:'',unavailable:false,lastCompletionTime:null,assignments:[]};else if(doors[i].laborStart===undefined)doors[i].laborStart=doors[i].start||null}byId('active-trailers-grid').addEventListener('click',(e)=>{const btn=e.target.closest('.bay-circle');if(btn)openActiveDetails(parseInt(btn.dataset.door))});byId('open-bays-grid').addEventListener('click',(e)=>{const btn=e.target.closest('.bay-circle');if(btn)openArrivalModal(parseInt(btn.dataset.door))});const searchInput=byId('log-search');if(searchInput)searchInput.addEventListener('input',debounce(()=>renderLogs(),300));const notesSearch=byId('notes-search');if(notesSearch)notesSearch.addEventListener('input',debounce(()=>renderNotesList(),300));loadNotes();loadPreferences();loadPphLog();loadObsState();loadChecklistState();loadShiftState();migrateShiftSchedule();syncShiftStartToSchedule();initAttributionSettings();const shiftStart=localStorage.getItem('ps9_shift_start')||"20:00";lastSortStartTime=localStorage.getItem('ps9_last_sort_start');isFirstOnboard=localStorage.getItem('ps9_is_first_onboard')==='true';historyLog=loadJSON('ps9_history',isArray,()=>[]);if(Array.isArray(historyLog)){const now=Date.now(),ONE_DAY_MS=24*60*60*1000;let pruned=false;historyLog=historyLog.filter(l=>{if(!l.end)return true;if(now-l.end>ONE_DAY_MS){pruned=true;return false}if(!l.dateKey)l.dateKey=dateKeyFromTs(l.end);if(!l.completionHour)l.completionHour=getCompletionHour(l.end-(l.statOffset||0));if(!l.cpuOptions)l.cpuOptions=[];if(!l.status)l.status='completed';if(!l.assistants)l.assistants=[];if(!l.shiftKey)l.shiftKey=shiftKeyFromTs(l.end);return true});if(pruned)saveHistory()}teamNames=loadJSON('ps9_team',v=>isNameList(v)&&v.length>0,()=>[...DEFAULT_TEAM]);refreshTeamNamesSorted();migrateTeamRoster();const startInput=byId('setting-shift-start');if(startInput)startInput.value=getShiftStartTime();populateUnloaderSelect();renderTeamManagement();renderShiftSchedule();obsEnsureToday();obsRenderAll();checklistRenderAll();renderDashboard();updateNameplate();setTimeout(()=>{updateAttributionUI();setupAttributionSlider();updateOfflineStatus()},100);setInterval(updateTabBadges,2000);updateTabBadges();startDashboardRefresh();window.addEventListener('online',processWebhookQueue);document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;if(syncShiftStartToSchedule()){renderShiftSchedule();renderDashboard();updateNameplate()}autoShiftTick()});processWebhookQueue();{const sw=byId('switch-auto-shift');if(sw){const on=autoShiftEnabled();sw.classList.toggle('checked',on);sw.setAttribute('aria-checked',String(on))}}autoShiftTick();setInterval(autoShiftTick,30000)}
    function updateShiftSummaryBar(){
        const{shiftStart}=getShiftTimeWindows();
        const now=Date.now();
        const elapsed=now-shiftStart.getTime();
        if(elapsed<0){byId('shift-clock-display').textContent='0:00';byId('shift-current-hour-display').textContent='Hr 1';byId('shift-pph-display').textContent='--';return}
        const hrs=Math.floor(elapsed/3600000);
        const mins=Math.floor((elapsed%3600000)/60000);
        byId('shift-clock-display').textContent=`${hrs}:${String(mins).padStart(2,'0')}`;
        byId('shift-current-hour-display').textContent=`Hr ${Math.min(hrs+1,9)}`;
        // live PPH = total completions / elapsed hours
        const elapsedHrs=elapsed/3600000;
        const total=thisShiftLogs().filter(l=>l.status==='completed'&&l.end>=shiftStart.getTime()).length;
        byId('shift-pph-display').textContent=elapsedHrs>0.05?Math.round(total/elapsedHrs):'--'}
    function startDashboardRefresh(){if(dashboardRefreshTimer)clearInterval(dashboardRefreshTimer);dashboardRefreshTimer=setInterval(()=>{if(byId('tab-dashboard').classList.contains('active'))renderDashboard();if(byId('tab-active').classList.contains('active'))renderActiveTab()},15000)}
    function loadPreferences(){const saved=localStorage.getItem('ps9_preferences');if(saved){try{const prefs=JSON.parse(saved);if(prefs.shareOnComplete!==undefined)config.shareOnComplete=prefs.shareOnComplete}catch(e){}}setTimeout(()=>{const el=byId('switch-share-on-complete');if(el){if(config.shareOnComplete)el.classList.add('checked');else el.classList.remove('checked')}},50)}
    function savePreferences(){localStorage.setItem('ps9_preferences',JSON.stringify({shareOnComplete:config.shareOnComplete}))}
    function saveDoors(){localStorage.setItem('ps9_doors',JSON.stringify(doors))}function saveHistory(){localStorage.setItem('ps9_history',JSON.stringify(historyLog))}function saveTeam(){localStorage.setItem('ps9_team',JSON.stringify(teamNames))}function saveData(){saveDoors();saveHistory();saveTeam()}function refreshTeamNamesSorted(){teamNamesSorted=[...teamNames].sort((a,b)=>a.localeCompare(b))}
