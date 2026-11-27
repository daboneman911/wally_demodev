// Wally Dashboard -- Nightly checklist.
// Loaded as a classic script from index.html; all files share one global scope.

    // -- NIGHTLY CHECKLIST -----------------------------------
    // The Observation row is deliberately NOT stored here. It reads from, and writes
    // to, the Observation Tracker, so the two can never disagree about whether the
    // night's observation happened.
    const CHECKLIST_TASKS=[
        {id:'presort',   label:'Pre-sort DECR'},
        {id:'postsort',  label:'Post-sort DECR'},
        {id:'observation',label:'Observation', obs:true},
        {id:'staffing',  label:'Validate staffing'},
        {id:'slide',     label:'Check slide'},
        {id:'belt',      label:'Walk belt'},
        {id:'gratings',  label:'Gratings clear'}
    ];
    let checklistState={tasks:{},shared:false};
    function loadChecklistState(){
        try{const s=JSON.parse(localStorage.getItem('ps9_checklist'));
            if(s&&typeof s==='object')checklistState={tasks:s.tasks&&typeof s.tasks==='object'?s.tasks:{},shared:!!s.shared};
        }catch(e){/* keep defaults */}
    }
    function saveChecklistState(){localStorage.setItem('ps9_checklist',JSON.stringify(checklistState))}
    function clearChecklist(){checklistState={tasks:{},shared:false};saveChecklistState();checklistRenderAll()}
    function checklistIsDone(t){
        if(t.obs){const cur=(typeof obsToday==='function')?obsToday():null;return !!cur&&cur.status==='done'}
        return !!checklistState.tasks[t.id];
    }
    function checklistDoneCount(){return CHECKLIST_TASKS.filter(checklistIsDone).length}
    function checklistComplete(){return checklistDoneCount()===CHECKLIST_TASKS.length}
    function checklistToggle(id){
        const t=CHECKLIST_TASKS.find(x=>x.id===id);
        if(!t)return;
        const wasComplete=checklistComplete();
        if(t.obs){
            const cur=(typeof obsToday==='function')?obsToday():null;
            if(!cur){alert('No one is assigned to observe tonight. Open the Observation Tracker to pick someone.');return}
            if(cur.status==='done')obsReopen();else obsMarkDone();
        }else{
            checklistState.tasks[id]=!checklistState.tasks[id];
            saveChecklistState();
        }
        checklistRenderAll();
        // the tap that ticks the last box is a real user gesture, which is what iOS
        // requires before it will open a share sheet
        if(!wasComplete&&checklistComplete())checklistShare();
    }
    function checklistObservee(){
        const cur=(typeof obsToday==='function')?obsToday():null;
        return cur?cur.name:null;
    }
    // Roster names are stored "First LastInitial" (Robert W), so the last token is
    // the surname where there is one and the initial otherwise.
    function checklistObserveeLastName(){
        const n=checklistObservee();
        if(!n)return null;
        const parts=n.trim().split(/\s+/);
        return parts[parts.length-1];
    }
    function checklistReportText(){
        const last=checklistObserveeLastName();
        return'DECR/OBS - '+(last||'\u2014');
    }
    async function checklistShare(){
        if(!checklistComplete()){alert('Finish every task first \u2014 '+checklistDoneCount()+' of '+CHECKLIST_TASKS.length+' done.');return}
        const text=checklistReportText();
        try{
            if(navigator.share){await navigator.share({text});checklistState.shared=true;saveChecklistState();checklistRenderAll();return}
        }catch(e){if(e&&e.name==='AbortError')return}   // user dismissed the sheet
        // no share sheet on this device -- put it on the clipboard instead
        try{await navigator.clipboard.writeText(text);showSaveToast();alert('Report copied to the clipboard:\n\n'+text)}
        catch(e){alert(text)}
        checklistState.shared=true;saveChecklistState();checklistRenderAll();
    }
    function checklistRenderAll(){
        const done=checklistDoneCount(),total=CHECKLIST_TASKS.length,complete=done===total;
        const sub=byId('checklist-tool-sub');
        if(sub)sub.textContent=done+'/'+total;
        const prog=byId('checklist-progress');
        if(prog)prog.textContent=complete?'All tasks complete':(done+' of '+total+' complete');
        const list=byId('checklist-items');
        if(list){
            const who=checklistObservee();
            list.innerHTML=CHECKLIST_TASKS.map(t=>{
                const on=checklistIsDone(t);
                return'<div class="cl-item'+(on?' done':'')+'" role="checkbox" tabindex="0" aria-checked="'+on+'"'
                    +' onclick="checklistToggle(\''+t.id+'\')"'
                    +' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click()}">'
                    +'<span class="cl-box"><i class="ph ph-check"></i></span>'
                    +'<span class="cl-label">'+t.label+'</span>'
                    +(t.obs&&who?'<span class="cl-meta">'+who+'</span>':'')+'</div>';
            }).join('');
        }
        const btn=byId('checklist-share-btn');
        if(btn){
            btn.disabled=!complete;
            btn.style.opacity=complete?'1':'0.45';
            btn.textContent=complete?(checklistState.shared?'Share Again':'Share Report'):'Share Report \u00b7 '+done+'/'+total;
        }
    }
    function openChecklist(){checklistRenderAll();byId('checklist-modal').style.display='flex'}
