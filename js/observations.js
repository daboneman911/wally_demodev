// Wally Dashboard -- Observation rotation tracker.
// Loaded as a classic script from index.html; all files share one global scope.

    // -- OBSERVATION TRACKER --------------------------------
    // One employee per shift day, drawn in order from a fixed eligible pool (not the
    // whole roster). A cycle runs until everyone in the pool has been observed, then
    // restarts. Skipping does NOT complete someone -- they stay owed and come back
    // round later in the same cycle.
    let obsState={assignments:{},cycle:1};
    function loadObsState(){
        try{const s=JSON.parse(localStorage.getItem('ps9_observations'));
            if(s&&typeof s==='object'){
                obsState={assignments:s.assignments&&typeof s.assignments==='object'?s.assignments:{},
                          cycle:s.cycle||1};
            }}catch(e){/* keep defaults */}
    }
    function saveObsState(){localStorage.setItem('ps9_observations',JSON.stringify(obsState))}
    // The observation day follows the shift day, so a shift running past midnight
    // keeps the same observee all night.
    function obsTodayKey(){
        const d=new Date();
        if(d.getHours()<12)d.setDate(d.getDate()-1);
        return dateKeyFromTs(d.getTime());
    }
    // The rotation is exactly the core crew, in roster order. Derived from the flags
    // rather than a frozen list, so promoting someone to PS9 Twilight in Settings puts
    // them in the rotation immediately. Roster order currently matches the old PS9_CORE
    // order, so this did not reshuffle anyone when it replaced it.
    function obsEligible(){
        const team=(typeof teamNames!=='undefined'&&teamNames.length)?teamNames:DEFAULT_TEAM;
        return team.filter(n=>isPS9Core(n));
    }
    function obsCompletedThisCycle(){
        return Object.values(obsState.assignments)
            .filter(a=>a.cycle===obsState.cycle&&a.status==='done')
            .map(a=>a.name);
    }
    // Next eligible person who hasn't been completed this cycle. When everyone has,
    // the cycle advances and the pool opens up again.
    function obsPickNext(exclude){
        exclude=exclude||[];
        const pool=obsEligible();
        if(!pool.length)return null;
        let done=obsCompletedThisCycle();
        let avail=pool.filter(n=>!done.includes(n)&&exclude.indexOf(n)===-1);
        if(!avail.length){
            obsState.cycle++;
            avail=pool.filter(n=>exclude.indexOf(n)===-1);
        }
        return avail.length?avail[0]:null;
    }
    function obsToday(){return obsState.assignments[obsTodayKey()]||null}
    // Assign today's observee if the day doesn't have one yet.
    function obsEnsureToday(){
        const key=obsTodayKey();
        if(obsState.assignments[key])return obsState.assignments[key];
        const name=obsPickNext();
        if(!name)return null;
        obsState.assignments[key]={name,status:'pending',cycle:obsState.cycle,auto:false};
        saveObsState();
        return obsState.assignments[key];
    }
    function obsSetManual(name){
        const key=obsTodayKey();
        const cur=obsState.assignments[key];
        obsState.assignments[key]={name,status:'pending',cycle:obsState.cycle,auto:false,
                                   skipped:cur?cur.skipped:undefined};
        saveObsState();obsRenderAll();
    }
    // Skip defers rather than completes: the person is not marked done, so they come
    // up again later in this same cycle.
    function obsSkip(){
        const key=obsTodayKey(),cur=obsState.assignments[key];
        if(!cur)return;
        const passed=(cur.skipped||[]).concat([cur.name]);
        const next=obsPickNext(passed);
        obsState.assignments[key]=next
            ?{name:next,status:'pending',cycle:obsState.cycle,auto:false,skipped:passed}
            :{name:cur.name,status:'pending',cycle:obsState.cycle,auto:false,skipped:passed};
        saveObsState();obsRenderAll();
        if(!next)alert('No other eligible employee is available to observe.');
    }
    function obsMarkDone(){
        const key=obsTodayKey(),cur=obsState.assignments[key];
        if(!cur)return;
        cur.status='done';saveObsState();obsRenderAll();checklistRenderAll();showSaveToast();
    }
    function obsReopen(){
        const key=obsTodayKey(),cur=obsState.assignments[key];
        if(!cur)return;
        cur.status='pending';saveObsState();obsRenderAll();checklistRenderAll();
    }
    // -- DOP cross-check -------------------------------------
    // The observee has to actually be working. Once anyone is clocked in on DOP, if
    // today's pick isn't among them, hand the observation to the next eligible person
    // who is -- and say so, rather than silently swapping.
    function obsActiveNames(){
        if(typeof hoursState==='undefined'||!hoursState||!Array.isArray(hoursState.employees))return [];
        return hoursState.employees.filter(e=>e.status==='active').map(e=>e.name);
    }
    function obsValidateAgainstDOP(){
        const cur=obsToday();
        if(!cur||cur.status==='done')return false;
        // Wait until the shift is actually staffed. Checking on the first clock-in fired
        // far too early -- most of the crew hadn't arrived, so the observee looked absent
        // when they were simply not on yet. delta>=0 means every position is filled.
        const dop=(typeof htCalcDOP==='function')?htCalcDOP():null;
        if(!dop||dop.delta<0)return false;
        const active=obsActiveNames();
        if(!active.length)return false;
        if(active.includes(cur.name))return false;   // still fine
        const passed=(cur.skipped||[]).concat([cur.name]);
        const pool=obsEligible().filter(n=>passed.indexOf(n)===-1&&active.includes(n));
        const done=obsCompletedThisCycle();
        const next=pool.filter(n=>!done.includes(n))[0]||pool[0]||null;
        if(!next)return false;
        const key=obsTodayKey();
        obsState.assignments[key]={name:next,status:'pending',cycle:obsState.cycle,auto:true,skipped:passed};
        saveObsState();obsRenderAll();
        const t=byId('obs-swap-text');
        if(t)t.textContent=cur.name+' isn\u2019t clocked in on DOP, so the observation moved to '+next+'.';
        const m=byId('obs-swap-modal');
        if(m)m.style.display='flex';
        return true;
    }

    // -- EDITING A PAST OBSERVATION --------------------------
    // Any day in the Recent list can be reopened to correct its status or its
    // employee. Status matters beyond the record itself: only 'done' entries count
    // toward the cycle, so marking a day observed retires that person from the
    // rotation and reverting it puts them back in.
    let obsEditKey=null;
    function obsOpenEdit(key){
        if(!obsState.assignments[key])return;
        obsEditKey=key;
        obsRenderEdit();
        byId('obs-edit-modal').style.display='flex';
    }
    function obsRenderEdit(){
        const a=obsState.assignments[obsEditKey];
        if(!a){closeModal('obs-edit-modal');return}
        const d=byId('obs-edit-date');
        if(d)d.textContent=obsEditKey+(obsEditKey===obsTodayKey()?' \u00b7 Today':'');
        ['pending','done'].forEach(s=>{
            const el=byId('obs-edit-status-'+s);
            if(el)el.classList.toggle('selected',a.status===s);
        });
        const sel=byId('obs-edit-name');
        if(sel){
            const team=(typeof teamNamesSorted!=='undefined'&&teamNamesSorted.length)?teamNamesSorted:DEFAULT_TEAM;
            // a past observee who has since left the roster would otherwise vanish
            // from the list and be silently rewritten on the next change
            const names=team.includes(a.name)?team.slice():[a.name].concat(team);
            sel.innerHTML=names.map(n=>'<option value="'+escHTML(n)+'"'+(a.name===n?' selected':'')+'>'+escHTML(n)+'</option>').join('');
        }
        const note=byId('obs-edit-note');
        if(note){
            const bits=[];
            if(a.auto)bits.push('Auto-reassigned because the original pick was not clocked in.');
            if(a.skipped&&a.skipped.length)bits.push('Skipped that day: '+a.skipped.join(', ')+'.');
            bits.push(a.status==='done'
                ?'Counts toward cycle '+(a.cycle||1)+', so '+a.name+' is retired from the rotation until it comes round again.'
                :'Not counted toward the cycle, so '+a.name+' can still come up again.');
            note.textContent=bits.join(' ');
        }
    }
    function obsEditSetStatus(status){
        const a=obsState.assignments[obsEditKey];
        if(!a||a.status===status)return;
        a.status=status;saveObsState();obsRenderEdit();obsRenderAll();checklistRenderAll();showSaveToast();
    }
    function obsEditSetName(name){
        const a=obsState.assignments[obsEditKey];
        if(!a||!name||a.name===name)return;
        a.name=name;a.auto=false;saveObsState();obsRenderEdit();obsRenderAll();showSaveToast();
    }
    function obsEditDelete(){
        const a=obsState.assignments[obsEditKey];
        if(!a)return;
        if(!confirm('Delete the observation record for '+obsEditKey+' ('+a.name+')?'))return;
        const wasToday=obsEditKey===obsTodayKey();
        delete obsState.assignments[obsEditKey];
        saveObsState();
        obsEditKey=null;
        closeModal('obs-edit-modal');
        // today's slot can't be left empty -- the tracker expects a pick for the day
        if(wasToday)obsEnsureToday();
        obsRenderAll();showSaveToast();
    }

    function openObservation(){
        closeModal('methods-modal');
        obsEnsureToday();obsRenderAll();
        byId('observation-modal').style.display='flex';
    }
    function obsRenderAll(){
        const cur=obsToday(),active=obsActiveNames();

        // dashboard line
        const line=byId('nameplate-obs');
        if(line){
            if(cur){
                line.classList.add('show');
                line.classList.toggle('done',cur.status==='done');
                line.innerHTML='<i class="ph ph-eye"></i>Observing <span class="obs-name">'+escHTML(cur.name)+'</span>'
                    +(cur.status==='done'?' <i class="ph ph-check-circle"></i>':'');
            }else{line.classList.remove('show');line.innerHTML=''}
        }
        const mn=byId('methods-obs-name');
        if(mn)mn.textContent=cur?cur.name:'';

        // tracker sheet
        const nameEl=byId('obs-today-name');
        if(nameEl){
            nameEl.textContent=cur?cur.name:'\u2014';
            const sub=byId('obs-today-sub');
            if(sub){
                const bits=[];
                if(!cur)bits.push('No eligible employees in the pool');
                else{
                    bits.push(cur.status==='done'?'Observed':'Pending');
                    if(cur.auto)bits.push('auto-reassigned from DOP');
                    if(cur.skipped&&cur.skipped.length)bits.push('skipped: '+cur.skipped.join(', '));
                    if(active.length)bits.push(active.includes(cur.name)?'on the clock':'not clocked in');
                }
                sub.textContent=bits.join(' \u00b7 ');
            }
            const done=byId('obs-done-btn');
            if(done){
                const isDone=!!cur&&cur.status==='done';
                done.textContent=isDone?'Observed \u2713':'Mark Observed';
                done.onclick=isDone?obsReopen:obsMarkDone;
            }
        }

        // manual override list -- whole team, so you can observe anyone on the day
        const sel=byId('obs-manual-select');
        if(sel){
            const team=(typeof teamNamesSorted!=='undefined'&&teamNamesSorted.length)?teamNamesSorted:DEFAULT_TEAM;
            sel.innerHTML='<option value="">Choose someone else\u2026</option>'
                +team.map(n=>'<option value="'+escHTML(n)+'"'+(cur&&cur.name===n?' selected':'')+'>'+escHTML(n)
                    +(active.includes(n)?' \u2022 on the clock':'')+'</option>').join('');
        }

        // recent history, newest first
        const list=byId('obs-history-list'),lbl=byId('obs-history-label');
        if(list){
            const keys=Object.keys(obsState.assignments).sort().reverse().slice(0,8);
            if(lbl)lbl.style.display=keys.length?'block':'none';
            const todayKey=obsTodayKey();
            list.innerHTML=keys.map(k=>{
                const a=obsState.assignments[k];
                const badge=a.status==='done'
                    ?'<span style="font-size:10px;font-weight:900;color:var(--accent-green);">OBSERVED</span>'
                    :'<span style="font-size:10px;font-weight:900;color:var(--text-muted);">PENDING</span>';
                return'<div class="note-history-entry obs-history-row" onclick="obsOpenEdit(\''+k+'\')" title="Edit this observation">'
                    +'<div class="note-history-entry-date">'+k+(k===todayKey?' \u00b7 today':'')+'</div>'
                    +'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;">'
                    +'<span style="font-size:14px;font-weight:800;color:var(--text-main);">'+escHTML(a.name)+'</span>'
                    +'<span style="display:flex;align-items:center;gap:7px;">'+badge
                    +'<i class="ph ph-caret-right" style="font-size:13px;color:var(--text-muted);"></i></span></div>'
                    +(a.skipped&&a.skipped.length?'<div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-top:3px;">skipped: '+escHTML(a.skipped.join(', '))+'</div>':'')
                    +'</div>';
            }).join('');
        }
    }
