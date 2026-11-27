// Wally Dashboard -- Wally notes, tags and the onboarding note picker.
// Loaded as a classic script from index.html; all files share one global scope.

    const NOTE_TAGS=['BARN DOORS','CPU','GAYLORDS','HEAVY BULK','HEAVY FLATS','HOTT','MIXED','OVERFLOW','SMALLS','SORTABLE','TIRES','WOODEN CRATES'];
    // wallyNotes[id] is an append-only history array: [{tags:[{value,type:'predefined'|'custom'}],text,timestamp}, ...]
    // migrateNoteHistory upgrades legacy shapes (raw string, or the old single {tags:[strings],text,updated} object) lazily on read.
    function migrateNoteHistory(raw){
        if(!raw)return[];
        if(Array.isArray(raw))return raw;
        if(typeof raw==='string')return[{tags:[],text:raw,timestamp:Date.now()}];
        return[{tags:(raw.tags||[]).map(t=>typeof t==='string'?{value:t,type:'predefined'}:t),text:raw.text||'',timestamp:raw.updated||Date.now()}]}
    function getNoteHistory(id){return migrateNoteHistory(wallyNotes[id])}
    function getNoteObj(id){const h=getNoteHistory(id);return h.length?h[h.length-1]:null}
    function noteHasContent(id){const n=getNoteObj(id);return n&&(n.tags.length>0||n.text.trim().length>0)}
    function renderNoteTagsInline(noteObj){if(!noteObj)return'';const chips=noteObj.tags.map(t=>`<span class="note-tag-inline"${''}>${t.value}</span>`).join('');const txt=noteObj.text?`<span style="font-size:12px;color:var(--text-sub);font-weight:500;">${noteObj.text}</span>`:'';return[chips,txt].filter(Boolean).join(' ')}

    function loadNotes(){const saved=localStorage.getItem('ps9_wally_notes');if(saved){try{wallyNotes=JSON.parse(saved)}catch(e){wallyNotes={}}}else wallyNotes={}}
    function saveNotes(){localStorage.setItem('ps9_wally_notes',JSON.stringify(wallyNotes))}

    function openNoteModal(id,source){// source: 'active'|'log'|'manager'|'onboard'
        byId('note-wally-id').value=id||'';
        byId('note-wally-id-display').textContent=id||'New';
        const history=id?getNoteHistory(id):[];
        const noteObj=history.length?history[history.length-1]:null;
        // render predefined tag chips
        const row=byId('note-tag-chips');
        row.innerHTML=NOTE_TAGS.map(t=>{const sel=noteObj&&noteObj.tags.some(tg=>tg.type==='predefined'&&tg.value===t)?'selected':'';return`<div class="note-tag-chip ${sel}" data-tag="${t}" onclick="toggleNoteTag(this)">${t}</div>`}).join('');
        // render current custom tags as removable chips
        editorCustomTags=noteObj?noteObj.tags.filter(tg=>tg.type==='custom').map(tg=>tg.value):[];
        renderEditorCustomTagChips();
        byId('note-text').value=noteObj?noteObj.text||'':'';
        // history list (entries before the current/latest one)
        const histLabel=byId('note-history-label'),histList=byId('note-history-list');
        const pastEntries=history.slice(0,-1);
        if(histLabel)histLabel.style.display=pastEntries.length?'block':'none';
        if(histList)histList.innerHTML=pastEntries.slice().reverse().map(e=>`<div class="note-history-entry"><div class="note-history-entry-date">${new Date(e.timestamp).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div><div class="note-tags-display">${e.tags.map(t=>`<span class="note-tag-inline"${''}>${t.value}</span>`).join('')}</div>${e.text?`<div class="note-card-text">${e.text}</div>`:''}</div>`).join('');
        // if opened from manager and no ID, show a wally ID input
        if(source==='manager'&&!id){
            const idRow=document.createElement('div');
            idRow.id='note-new-id-row';
            idRow.innerHTML=`<div style="margin-bottom:12px;"><label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:6px;">Wally ID</label><input type="text" id="note-new-id-input" class="form-input" style="margin:0;" placeholder="e.g. 5589" inputmode="numeric" pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'');byId('note-wally-id').value=this.value;byId('note-wally-id-display').textContent=this.value||'New'"></div>`;
            const sheet=byId('note-modal').querySelector('.modal-sheet');
            sheet.insertBefore(idRow,sheet.firstChild.nextSibling);
        } else {
            const old=document.getElementById('note-new-id-row');if(old)old.remove();
        }
        byId('note-modal').style.display='flex'}
    function toggleNoteTag(el){el.classList.toggle('selected')}
    let editorCustomTags=[];
    function renderEditorCustomTagChips(){const c=byId('note-custom-tag-chips');if(!c)return;c.innerHTML=editorCustomTags.map((t,i)=>`<div class="note-tag-chip custom selected">${t}<span class="note-tag-chip-x" onclick="event.stopPropagation();removeEditorCustomTag(${i})">&times;</span></div>`).join('')}
    function addEditorCustomTag(){const inp=byId('note-custom-tag-input');if(!inp)return;const v=inp.value.trim();if(!v)return;if(!editorCustomTags.includes(v))editorCustomTags.push(v);inp.value='';renderEditorCustomTagChips()}
    function removeEditorCustomTag(i){editorCustomTags.splice(i,1);renderEditorCustomTagChips()}
    function appendNoteText(text){const ta=byId('note-text');if(!ta)return;const cur=ta.value.trim();ta.value=cur?(cur+' '+text):text;ta.focus();}
    function collectEditorTags(){const predefined=Array.from(document.querySelectorAll('#note-tag-chips .note-tag-chip.selected')).map(c=>({value:c.dataset.tag,type:'predefined'}));const custom=editorCustomTags.map(v=>({value:v,type:'custom'}));return[...predefined,...custom]}
    function saveNote(){
        const id=byId('note-wally-id').value.trim();
        if(!id){alert('Please enter a Wally ID');return}
        const tags=collectEditorTags();
        const text=byId('note-text').value.trim().substring(0,120);
        const history=getNoteHistory(id);
        const entry={tags,text,timestamp:Date.now()};
        if(history.length)history[history.length-1]=entry;else history.push(entry);
        if(tags.length===0&&text===''&&history.length===1)delete wallyNotes[id];
        else wallyNotes[id]=history;
        saveNotes();
        sendNoteWebhook(id,tags.length===0&&text===''?'delete':'upsert',entry);
        closeModal('note-modal');showSaveToast();
        const old=document.getElementById('note-new-id-row');if(old)old.remove();
        if(byId('tab-active').classList.contains('active'))renderActiveTab();
        if(byId('tab-logs').classList.contains('active'))renderLogs();
        renderDashboard()}
    function deleteNote(){
        const id=byId('note-wally-id').value.trim();
        if(id){
            const history=getNoteHistory(id);
            const entry={tags:[],text:'',timestamp:Date.now()};
            if(history.length){history[history.length-1]=entry;wallyNotes[id]=history}else delete wallyNotes[id];
            sendNoteWebhook(id,'delete',entry);
        }
        saveNotes();closeModal('note-modal');showSaveToast();
        const old=document.getElementById('note-new-id-row');if(old)old.remove();
        if(byId('tab-active').classList.contains('active'))renderActiveTab();
        if(byId('tab-logs').classList.contains('active'))renderLogs();
        renderDashboard()}
    function sendNoteWebhook(wallyId,action,entry){
        if(config.noWebhook)return;
        const e=entry||getNoteObj(wallyId);
        queuePayload({dataType:'NOTE',wallyId,tags:e?e.tags:[],text:e?e.text||'':'',action,timestamp:Date.now(),dateKey:dateKeyFromTs(Date.now())});
        processWebhookQueue()}

    function openNotesManager(){renderNotesList();byId('notes-manager-modal').style.display='flex'}
    let notesActiveFilter='All';
    function renderNotesList(){
        const search=(byId('notes-search')||{value:''}).value.toLowerCase();
        // build tag filter chips
        const filterRow=byId('notes-filter-row');
        if(filterRow){
            const allTags=['All',...NOTE_TAGS,'No Tags'];
            filterRow.innerHTML=allTags.map(t=>`<div class="notes-filter-chip ${notesActiveFilter===t?'active':''}" onclick="setNotesFilter('${t}')">${t}</div>`).join('')}
        const container=byId('notes-list-container');container.innerHTML='';
        const entries=Object.keys(wallyNotes).map(id=>{const history=getNoteHistory(id);const n=history.length?history[history.length-1]:null;return[id,n,history.length]}).filter(([id,n])=>{
            if(!n)return false;
            if(search&&!id.includes(search)&&!n.text.toLowerCase().includes(search)&&!n.tags.some(t=>t.value.toLowerCase().includes(search)))return false;
            if(notesActiveFilter==='All')return true;
            if(notesActiveFilter==='No Tags')return n.tags.length===0;
            return n.tags.some(t=>t.value===notesActiveFilter)}).sort((a,b)=>(b[1].timestamp||0)-(a[1].timestamp||0));
        if(entries.length===0){container.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:30px 0;font-weight:600;">No notes found</div>';return}
        entries.forEach(([id,n,entryCount])=>{
            const lastSeen=findLastSeenDate(id);
            const card=document.createElement('div');card.className='note-card';
            card.onclick=()=>{closeModal('notes-manager-modal');openNoteModal(id,'active')};
            card.innerHTML=`<div class="note-card-header"><span class="note-card-id">${id}${entryCount>1?`<span class="note-entries-badge">${entryCount} entries</span>`:''}</span><span class="note-card-date">${lastSeen||''}</span></div><div class="note-tags-display">${n.tags.map(t=>`<span class="note-tag-inline"${''}>${t.value}</span>`).join('')}</div>${n.text?`<div class="note-card-text">${n.text}</div>`:''}`;
            container.appendChild(card)})}
    function setNotesFilter(tag){notesActiveFilter=tag;renderNotesList()}
    function findLastSeenDate(wallyId){const match=historyLog.find(l=>l.id===wallyId&&l.end);return match?new Date(match.end).toLocaleDateString([],{month:'short',day:'numeric'}):null}

    // ONBOARD NOTE TAG PICKER + DUPLICATE PREVIEW
    let onboardCustomTags=[];
    function renderOnboardTagChips(){const row=byId('onboard-tag-chips');if(row)row.innerHTML=NOTE_TAGS.map(t=>`<div class="note-tag-chip" data-tag="${t}" onclick="toggleNoteTag(this)">${t}</div>`).join('')}
    function renderOnboardCustomTagChips(){const c=byId('onboard-custom-tag-chips');if(!c)return;c.innerHTML=onboardCustomTags.map((t,i)=>`<div class="note-tag-chip custom selected">${t}<span class="note-tag-chip-x" onclick="event.stopPropagation();removeOnboardCustomTag(${i})">&times;</span></div>`).join('')}
    function addOnboardCustomTag(){const inp=byId('onboard-custom-tag-input');if(!inp)return;const v=inp.value.trim();if(!v)return;if(!onboardCustomTags.includes(v))onboardCustomTags.push(v);inp.value='';renderOnboardCustomTagChips()}
    function removeOnboardCustomTag(i){onboardCustomTags.splice(i,1);renderOnboardCustomTagChips()}
    function resetOnboardNoteFields(){onboardCustomTags=[];renderOnboardTagChips();renderOnboardCustomTagChips();const t=byId('onboard-note-text');if(t)t.value='';const ci=byId('onboard-custom-tag-input');if(ci)ci.value=''}
    function collectOnboardNoteFields(){const predefined=Array.from(document.querySelectorAll('#onboard-tag-chips .note-tag-chip.selected')).map(c=>({value:c.dataset.tag,type:'predefined'}));const custom=onboardCustomTags.map(v=>({value:v,type:'custom'}));const text=(byId('onboard-note-text')||{value:''}).value.trim().substring(0,120);return{tags:[...predefined,...custom],text}}
    function commitOnboardingNoteFields(wallyId,fields,timestamp){
        if(!fields||(fields.tags.length===0&&fields.text===''))return;
        const history=getNoteHistory(wallyId);
        const entry={tags:fields.tags,text:fields.text,timestamp};
        history.push(entry);
        wallyNotes[wallyId]=history;
        saveNotes();
        sendNoteWebhook(wallyId,'upsert',entry)}
    function copyPreviousNoteTags(wallyId){
        const noteObj=getNoteObj(wallyId);if(!noteObj)return;
        document.querySelectorAll('#onboard-tag-chips .note-tag-chip').forEach(c=>{c.classList.toggle('selected',noteObj.tags.some(t=>t.type==='predefined'&&t.value===c.dataset.tag))});
        onboardCustomTags=noteObj.tags.filter(t=>t.type==='custom').map(t=>t.value);
        renderOnboardCustomTagChips();
        const ta=byId('onboard-note-text');if(ta)ta.value=noteObj.text||''}
    function updateOnboardingNotePreview(wallyId){
        const preview=byId('onboarding-note-preview');if(!preview)return;
        if(!wallyId||wallyId.length<3){preview.style.display='none';preview.innerHTML='';return}
        const history=getNoteHistory(wallyId);
        const noteObj=history.length?history[history.length-1]:null;
        if(noteObj&&(noteObj.tags.length>0||noteObj.text)){
            preview.style.display='block';
            preview.innerHTML=`<div class="onboard-note-card"><div class="onboard-note-header"><div class="onboard-note-label"><i class="ph ph-note-pencil"></i> ${history.length} prior note${history.length>1?'s':''} on file</div><button class="onboard-note-edit-btn" onclick="copyPreviousNoteTags('${wallyId}')">Use These</button></div><div class="note-tags-display" style="margin-bottom:${noteObj.text?'6px':'0'}">${noteObj.tags.map(t=>`<span class="note-tag-inline"${''}>${t.value}</span>`).join('')}</div>${noteObj.text?`<div style="font-size:13px;color:var(--text-sub);margin-top:4px;">${noteObj.text}</div>`:''}</div>`
        } else {
            preview.style.display='none';preview.innerHTML=''}}
