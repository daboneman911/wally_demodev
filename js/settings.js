// Wally Dashboard -- Backup/restore, reset, settings toggles and Team Management UI.
// Loaded as a classic script from index.html; all files share one global scope.

    // -- BACKUP / RESTORE ------------------------------------
    // Everything lives in this browser's localStorage and nothing but the logs was
    // recoverable if the device wiped its site data. This captures the lot -- roster,
    // observation rotation, notes, hours, schedule, settings -- as one JSON file.
    const BACKUP_KEYS=['ps9_doors','ps9_history','ps9_team','ps9_wally_notes','ps9_observations',
        'ps9_checklist','ps9_pph_log','ps9_preferences','ps9_roster_flags','ps9_shift_schedule','ps9_shift_start','ps9_shift_meta','ps9_auto_shift',
        'ps9_shift_state','ps9_shift_end_time','ps9_last_sort_start','ps9_is_first_onboard',
        'ps9_attribution_config_v2','ps9_roster_v7','ps9_roster_v708','ps9_roster_v714','ps9_roster_v715','ps9_roster_v717','ps9_roster_v729','ps9_schedule_v718',
        'ps9_webhook_queue','ps9_webhook_failed',
        'ps9_v3','ps9_v4'];
    const BACKUP_FORMAT=1;
    function buildBackup(){
        const data={};
        BACKUP_KEYS.forEach(k=>{const v=localStorage.getItem(k);if(v!==null)data[k]=v;});
        return{app:'wally-dashboard',format:BACKUP_FORMAT,version:APP_VERSION,
               exportedAt:new Date().toISOString(),data};
    }
    function exportBackup(){
        try{
            const blob=new Blob([JSON.stringify(buildBackup(),null,2)],{type:'application/json'});
            const url=URL.createObjectURL(blob),a=document.createElement('a');
            const d=new Date();if(d.getHours()<12)d.setDate(d.getDate()-1);
            a.href=url;a.download='wally-backup-'+dateKeyFromTs(d.getTime())+'.json';
            document.body.appendChild(a);a.click();a.remove();
            setTimeout(()=>URL.revokeObjectURL(url),1000);
            showSaveToast();
        }catch(e){alert('Could not create the backup: '+e.message)}
    }
    function importBackup(input){
        const file=input&&input.files&&input.files[0];
        input.value='';                       // so re-picking the same file still fires
        if(!file)return;
        const reader=new FileReader();
        reader.onerror=()=>alert('Could not read that file.');
        reader.onload=()=>{
            let b;
            try{b=JSON.parse(reader.result)}catch(e){return alert('That is not a valid backup file.')}
            if(!b||b.app!=='wally-dashboard'||!b.data||typeof b.data!=='object')
                return alert('That file is not a Wally backup.');
            if(typeof b.format!=='number'||!isFinite(b.format))
                return alert('That file is missing its backup format version, so it cannot be read safely.');
            if(b.format>BACKUP_FORMAT)
                return alert('That backup was made by a newer version of the app (format '+b.format+'). Update first, then restore.');
            // every value must still parse, or a half-written restore leaves the app broken
            const bad=Object.keys(b.data).filter(k=>{
                if(BACKUP_KEYS.indexOf(k)===-1)return false;
                const v=b.data[k];
                if(typeof v!=='string')return true;
                if(k==='ps9_shift_start'||k==='ps9_shift_state'||k==='ps9_shift_end_time'
                   ||k==='ps9_last_sort_start'||k==='ps9_is_first_onboard'
                   ||k==='ps9_roster_v7'||k==='ps9_roster_v708'
                   ||k==='ps9_roster_v714'||k==='ps9_roster_v715'||k==='ps9_roster_v717'||k==='ps9_roster_v729'||k==='ps9_schedule_v718')return false;
                try{JSON.parse(v);return false}catch(e){return true}
            });
            if(bad.length)return alert('That backup looks damaged and was not restored.\n\nUnreadable: '+bad.join(', '));
            const when=b.exportedAt?new Date(b.exportedAt).toLocaleString():'an unknown date';
            const keys=Object.keys(b.data).filter(k=>BACKUP_KEYS.indexOf(k)!==-1);
            if(!confirm('Restore the backup from '+when+' (v'+(b.version||'?')+')?\n\n'
                +'This replaces everything currently on this device \u2014 trailers, logs, team list, '
                +'notes, observation rotation and settings.'))return;
            BACKUP_KEYS.forEach(k=>localStorage.removeItem(k));
            keys.forEach(k=>localStorage.setItem(k,b.data[k]));
            alert('Restored '+keys.length+' items. The app will reload.');
            setTimeout(()=>location.reload(),300);
        };
        reader.readAsText(file);
    }

    // A reset clears the night's work, not the setup around it. This is an explicit
    // list of what to REMOVE rather than a localStorage.clear() with a couple of keys
    // rescued afterwards -- under the old approach every new key was silently
    // destroyed the moment it was added, which is how the roster, the observation
    // rotation and the checklist all came to be wiped without the prompt saying so.
    const RESET_CLEARS=['ps9_doors','ps9_history','ps9_shift_state','ps9_shift_end_time',
                        'ps9_last_sort_start','ps9_is_first_onboard','ps9_pph_log',
                        'ps9_checklist','ps9_v3','ps9_v4'];
    function resetData(){
        if(confirm("Reset all data? This clears active trailers, logs, the volume counts and tonight's checklist.\n\nYour team list, notes, observation rotation, shift schedule and settings are kept.")){
            RESET_CLEARS.forEach(k=>localStorage.removeItem(k));
            const resetStart=getScheduledShiftStart();
            localStorage.setItem('ps9_shift_start',resetStart);
            attemptWebhook({dataType:'NEW_SHIFT',dateKey:dateKeyFromTs(Date.now()),shiftStart:resetStart});
            setTimeout(function(){location.reload();},500);
        }
    }
    function showSaveToast(){const t=byId('save-toast');t.classList.add('visible');setTimeout(()=>t.classList.remove('visible'),2000)}function viewChangelog(){byId('changelog-content').textContent=CHANGELOG;byId('changelog-modal').style.display='flex'}
    function initAttributionSettings(){const parsed=loadJSON('ps9_attribution_config_v2',isObject,()=>null);if(parsed)attributionConfig={enabled:parsed.enabled!==undefined?parsed.enabled:true};updateAttributionUI()}
    function updateAttributionUI(){const sw=byId('switch-en-window');if(sw){const enabled=attributionConfig.enabled;sw.classList.toggle('checked',!!enabled);sw.setAttribute('aria-checked',String(!!enabled))}
        const note=byId('grace-window-note');
        if(note)note.textContent='When enabled, Wallies completed in the first '+GRACE_WINDOW_MINUTES+' minutes after each hour boundary can be counted toward the previous hour. The window follows the shift start time \u2014 tonight it is '+getGraceWindowLabel()+'.'}
    function saveAttributionSetting(){localStorage.setItem('ps9_attribution_config_v2',JSON.stringify(attributionConfig));showSaveToast()}
    function setupAttributionSlider(){}
    function updateTabBadges(){let activeCount=0;for(let i=DOORS_START;i<=DOORS_END;i++)if(doors[i]&&(doors[i].status==='active'||doors[i].status==='staged'))activeCount++;const badge=byId('badge-active');if(badge){if(activeCount===0)badge.style.display='none';else{badge.textContent=activeCount>99?'99+':activeCount.toString();badge.setAttribute('aria-label',activeCount+' active trailer'+(activeCount===1?'':'s'));badge.style.display='flex';if(activeCount>=6){badge.classList.add('warning');badge.classList.remove('success','zero')}else if(activeCount>=3){badge.classList.add('success');badge.classList.remove('warning','zero')}else badge.classList.remove('warning','success','zero')}}}
    function toggleSection(id){const body=byId(id);const caret=byId('caret-'+id);if(!body)return;const isOpen=body.classList.contains('open');body.classList.toggle('open',!isOpen);if(caret){caret.className=isOpen?'ph ph-caret-down':'ph ph-caret-up';const btn=caret.closest('button');if(btn)btn.setAttribute('aria-expanded',String(!isOpen))}}
    function openAddTeamMemberInline(){const inp=byId('add-team-inline');if(!inp)return;inp.style.display=inp.style.display==='none'?'block':'none';if(inp.style.display==='block')setTimeout(()=>{const f=byId('inline-team-name');if(f)f.focus()},100)}
    function confirmAddTeamInline(){const raw=byId('inline-team-name').value.trim();if(!raw)return;const formatted=formatPersonName(raw);if(teamHasName(formatted)){alert(`"${formatted}" is already on the team list.`);return}teamNames.push(formatted);refreshTeamNamesSorted();saveTeam();populateUnloaderSelect();renderTeamManagement();htReconcileRoster();byId('inline-team-name').value='';byId('add-team-inline').style.display='none';showSaveToast()}
    function renderTeamManagement(){
        const list=byId('team-management-list');if(!list)return;
        list.innerHTML='';
        if(teamNamesSorted.length===0){list.innerHTML='<div style="padding:15px 0;color:var(--text-muted);text-align:center;">No team members yet</div>';return}
        teamNamesSorted.forEach((name)=>{
            const div=document.createElement('div');
            div.className='settings-row';
            div.innerHTML=`<span class="settings-label">${escHTML(name)}${isPS9Core(name)?'<span class="ps9-core-tag" title="PS9 Twilight">PS9</span>':''}</span><div style="display:flex;gap:16px;align-items:center;"><i class="ph ph-sliders-horizontal role-btn" style="font-size:21px;cursor:pointer;color:var(--text-sub);" title="Role"></i><i class="ph ph-pencil-simple" style="font-size:22px;cursor:pointer;color:var(--text-main);"></i><i class="ph ph-minus-circle delete-acct-btn"></i></div>`;
            // bound as closures rather than baked into onclick strings: a name holding
            // an apostrophe used to break the handler and kill both buttons on the row
            div.querySelector('.role-btn').onclick=()=>openTeamRoleModal(name);
            div.querySelector('.ph-pencil-simple').onclick=()=>editTeamMember(name);
            div.querySelector('.delete-acct-btn').onclick=()=>deleteTeamMember(name);
            list.appendChild(div)
        })
    }
    function deleteTeamMember(name){
        const warn=htHasActivity(name)?`\n\n${name} has hours recorded on the DOP tab. Removing them discards those hours.`:'';
        if(confirm(`Remove ${name} from your saved team list?\nThis also removes them from the DOP roster.${warn}`)){
            teamNames=teamNames.filter(n=>n!==name);forgetRosterFlags(name);refreshTeamNamesSorted();saveTeam();renderTeamManagement();populateUnloaderSelect();
            htReconcileRoster();
            showSaveToast()}}
    // A rename onto a name already on the list used to go through, leaving teamNames
    // holding it twice: two rows in Team Management, two entries in every unloader
    // dropdown, and two separate DOP rows for one person with the night's hours split
    // between them. Refused the way confirmAddTeamInline() already refuses an add.
    // Names are formatted the same way everywhere they are entered. Only all-lower or
    // all-caps input is title-cased; anything with its own capitals is kept as typed,
    // so McDonald and O'Brien survive and a capitalization-only edit is not undone.
    function formatPersonName(raw){
        const t=String(raw).trim().replace(/\s+/g,' ');
        if(t===t.toLowerCase()||t===t.toUpperCase())return t.toLowerCase().split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
        return t.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')}
    // Case-insensitive, so "Matt r" cannot sit beside "Matt R". except: the name being renamed.
    function teamHasName(name,except){const k=name.toLowerCase();return teamNames.some(n=>n!==except&&n.toLowerCase()===k)}
    // Rename everywhere a name lives except trailers and logs (renameInRecords()): team
    // list, role flags, observation history and DOP hours -- including the SAVED DOP state,
    // because the roster migration runs before htLoadState() and a rename that only touched
    // the in-memory roster would let htReconcileRoster() drop the old name's hours.
    // keepRoles: copy the old name's core/permanent onto the new name (a hand rename of a
    // default-crew member would otherwise lose both); the migration passes false.
    function renameTeamMember(oldName,newName,opts){
        opts=opts||{};
        const wasCore=isPS9Core(oldName),wasPermanent=isPermanentMember(oldName);
        const index=teamNames.indexOf(oldName);if(index>-1)teamNames[index]=newName;else teamNames.push(newName);
        renameRosterFlags(oldName,newName);
        if(opts.keepRoles!==false&&(isPS9Core(newName)!==wasCore||isPermanentMember(newName)!==wasPermanent)){
            const f=getRosterFlags();f[newName]={core:wasCore,permanent:wasPermanent};saveRosterFlags(f)}
        let obsChanged=false;Object.values(obsState.assignments).forEach(a=>{if(a&&a.name===oldName){a.name=newName;obsChanged=true}});
        if(obsChanged){saveObsState();if(typeof obsRenderAll==='function')obsRenderAll()}
        refreshTeamNamesSorted();saveTeam();renderTeamManagement();populateUnloaderSelect();
        htRenameEmployee(oldName,newName);htRenameInSavedState(oldName,newName);
    }
    // Active trailers and this shift's logs. resendLogs re-posts edited records to the
    // sheet; the migration passes false so updating phones do not re-post the night.
    function renameInRecords(oldName,newName,opts){
        opts=opts||{};let updatedCount=0;
        for(let i=DOORS_START;i<=DOORS_END;i++){const d=doors[i];if(!d||(d.status!=='active'&&d.status!=='staged'))continue;
            let doorUpdated=false;if(d.unloader===oldName){d.unloader=newName;doorUpdated=true}
            if(d.assignments){d.assignments.forEach(a=>{if(a.name===oldName){a.name=newName;doorUpdated=true}})}
            if(doorUpdated&&opts.resendLogs){sendToWebhook({stage:'update',door:i,id:d.id,account:d.account||'',type:d.type,unloader:d.unloader||'',assistants:d.assignments?d.assignments.map(a=>a.name).filter(n=>n!==d.unloader):[],start:d.start,end:null,dateKey:dateKeyFromTs(d.start),durationMinutes:null,statOffset:0,logId:d.logId,duplicate:d.isDuplicate||false,completionHour:null,cpuOptions:d.cpuOptions||[],status:d.status,manual:false,shiftStart:getShiftStartTime()},'update')}}
        historyLog.forEach(l=>{let logUpdated=false;if(l.unloader===oldName){l.unloader=newName;logUpdated=true}
            if(l.assistants&&l.assistants.includes(oldName)){l.assistants=l.assistants.map(a=>a===oldName?newName:a);logUpdated=true}
            if(logUpdated){updatedCount++;if(opts.resendLogs)sendToWebhook(l,'end')}});
        saveDoors();saveHistory();
        return updatedCount}
    function editTeamMember(oldName){const newName=prompt(`Edit name for ${oldName}:`,oldName);if(newName===null||newName.trim()==='')return;const formattedName=formatPersonName(newName);if(formattedName===oldName)return;if(teamHasName(formattedName,oldName)){alert(`"${formattedName}" is already on the team list. Remove one of them instead of renaming onto the other.`);return}
        renameTeamMember(oldName,formattedName,{keepRoles:true});
        if(confirm(`Update all existing active trailers and past logs from "${oldName}" to "${formattedName}"?`)){
            const updatedCount=renameInRecords(oldName,formattedName,{resendLogs:true});
            renderDashboard();renderActiveTab();if(byId('tab-logs').classList.contains('active'))renderLogs();
            alert(`Successfully updated ${updatedCount} completed logs to "${formattedName}".`)}}
    function toggleSwitch(id){const el=byId('switch-'+id);if(!el)return;el.classList.toggle('checked');const checked=el.classList.contains('checked');el.setAttribute('aria-checked',String(checked));if(id==='demo-mode'){demoActive=checked;if(!checked&&shiftState==='demo'){shiftState='idle';saveShiftState()}updateDemoBanner();updateNameplate();updateTabBadges()}if(id==='demo-replenish')config.replenish=checked;if(id==='demo-random')config.randomHistory=checked;if(id==='sim-window')config.simulateWindow=checked;if(id==='en-window'){attributionConfig.enabled=checked;saveAttributionSetting()}if(id==='share-on-complete'){config.shareOnComplete=checked;savePreferences()}if(id==='demo-autocomplete')config.autoComplete=checked;if(id==='demo-nowebhook')config.noWebhook=checked;if(id==='auto-shift'){localStorage.setItem('ps9_auto_shift',checked?'1':'0');autoShiftTick()}renderDashboard()}
    function updateDemoBanner(){const b=byId('demo-banner');if(!b)return;if(demoActive)b.classList.add('visible');else b.classList.remove('visible')}
    function stepDoor(delta){let val=parseInt(byId('demo-door-val').innerText)+delta;if(val<1)val=1;if(val>8)val=8;byId('demo-door-val').innerText=val;config.doorCount=val}function setDemoType(t){config.demoType=t;byId('seg-wally').classList.toggle('selected',t==='Wally');byId('seg-cpu').classList.toggle('selected',t==='CPU')}
    function startDemo(){startDemoShift()}
    function randomArrival(doorNum){let type=config.mixedTypes?(Math.random()>0.5?'Wally':'CPU'):config.demoType;const id=Math.floor(1000+Math.random()*9000).toString(),unloader=teamNames[Math.floor(Math.random()*teamNames.length)],account=type==='CPU'?"DEMO"+Math.floor(Math.random()*100):"",startTime=Date.now(),logId=Date.now().toString(36)+Math.random().toString(36).substr(2);doors[doorNum]={status:'active',start:startTime,laborStart:startTime,id:id.toUpperCase(),account:account,type:type,unloader:unloader,unavailable:false,lastCompletionTime:doors[doorNum]?doors[doorNum].lastCompletionTime:null,idleExcludeMs:doorIdleExcludedMs(doors[doorNum],Date.now()),cpuOptions:[],assignments:[{name:unloader,start:startTime,end:null}],logId:logId};sendToWebhook({door:doorNum,id:id.toUpperCase(),account:account,type:type,unloader:unloader,assistants:[],start:startTime,laborStart:startTime,end:null,dateKey:dateKeyFromTs(startTime),durationMinutes:null,statOffset:0,logId:logId,duplicate:false,completionHour:null,cpuOptions:[],status:'active',manual:false},'start');renderDashboard();updateTabBadges();
        // Auto-complete after 15s if demo autocomplete is enabled
        // Auto-complete after 15s + random 3-10s so doors never fire simultaneously
        if(demoActive&&config.autoComplete){
            const randomExtra=Math.floor(Math.random()*8000)+3000; // 3000-10999ms
            setTimeout(()=>{if(demoActive&&doors[doorNum]&&doors[doorNum].logId===logId&&doors[doorNum].status==='active'){finalizeCompletion(doorNum,Date.now(),0)}},15000+randomExtra);
        }
    }
