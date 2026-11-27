// Wally Dashboard -- Roster lists, roster flags and roster migrations.
// Loaded as a classic script from index.html; all files share one global scope.

    // -- ROSTER -------------------------------------------
    // PS9 Twilight: the core crew. Badged in Team Management and the pool the
    // observation rotation draws from.
    const PS9_CORE=['Robert','Matt','Lorena','Russell','Tre','David','Eddie','Luis','Elliot'];
    // Everyone who survives a reset and a shift end. Anyone else on the roster is a
    // temporary add and is cleared when the shift ends.
    // Doubles: on the roster every shift, but not PS9 staff -- no PS9 chip and not in the
    // observation rotation (obsEligible() filters on isPS9Core()).
    const PS9_DOUBLES=['Solis','Damian','Johnny','Jeremiah'];
    const PS9_PERMANENT=PS9_CORE.concat(PS9_DOUBLES);
    // Removed from the roster in v7.00; retired one time only, so re-adding any of
    // them later sticks rather than being stripped on the next load.
    // Record of everyone retired from the roster. The v7 migration step below carries its
    // own frozen copy of the first five, so adding names here never changes that step.
    const PS9_RETIRED=['Juan F','Jeff','Anthony','Josh','Jarrett','Arce J','Evan'];
    // -- ROSTER FLAGS ---------------------------------------
    // Core membership and permanence used to be editable only by changing PS9_CORE in
    // this file, which meant every new hire was a release: version bump, migration step,
    // test update, deploy and a service worker cache bump. They are per-person flags
    // now, stored as an overlay.
    //
    // Only names the user has actually changed get an entry. Everyone else falls through
    // to the lists below, so those stay the seed for a fresh install and the defaults for
    // the existing crew -- and no migration is needed, because the fallback IS the
    // default. ps9_roster_flags is in BACKUP_KEYS.
    function getRosterFlags(){
        try{const f=JSON.parse(localStorage.getItem('ps9_roster_flags'));
            return(f&&typeof f==='object'&&!Array.isArray(f))?f:{}}catch(e){return{}}
    }
    function saveRosterFlags(f){try{localStorage.setItem('ps9_roster_flags',JSON.stringify(f))}catch(e){console.error('Roster flags not saved:',e)}}
    function isPS9Core(name){
        const f=getRosterFlags()[name];
        return f&&typeof f.core==='boolean'?f.core:PS9_CORE.indexOf(name)!==-1;
    }
    function isPermanentMember(name){
        const f=getRosterFlags()[name];
        return f&&typeof f.permanent==='boolean'?f.permanent:PS9_PERMANENT.indexOf(name)!==-1;
    }
    // Core without permanence is incoherent -- a core member who is purged at shift end
    // drops out of the observation rotation the same night. The two are kept consistent
    // here rather than left to the caller.
    function setRosterFlags(name,next){
        const f=getRosterFlags();
        const merged={core:isPS9Core(name),permanent:isPermanentMember(name)};
        // The implication is applied to the field the caller actually set, in the order
        // they were given. Applying both rules unconditionally lets one silently undo
        // the other -- turning Permanent off used to be reverted by "core implies
        // permanent" on the very same call, so the toggle appeared to do nothing.
        if(Object.prototype.hasOwnProperty.call(next,'core')){
            merged.core=!!next.core;
            if(merged.core)merged.permanent=true;
        }
        if(Object.prototype.hasOwnProperty.call(next,'permanent')){
            merged.permanent=!!next.permanent;
            if(!merged.permanent)merged.core=false;
        }
        f[name]=merged;saveRosterFlags(f);
        return merged;
    }
    let teamRoleName=null;
    function openTeamRoleModal(name){
        teamRoleName=name;
        byId('team-role-name').textContent=name;
        renderTeamRoleModal();
        byId('team-role-modal').style.display='flex';
    }
    function renderTeamRoleModal(){
        if(!teamRoleName)return;
        const core=isPS9Core(teamRoleName),perm=isPermanentMember(teamRoleName);
        const set=(id,on)=>{const el=byId(id);if(!el)return;
            el.classList.toggle('checked',on);el.setAttribute('aria-checked',String(on))};
        set('switch-team-core',core);
        set('switch-team-permanent',perm);
        const note=byId('team-role-note');
        if(note)note.textContent=core
            ?'Carries the PS9 chip, is in the observation rotation, and stays on the roster when the shift ends.'
            :perm?'Stays on the roster when the shift ends. Not in the observation rotation.'
                 :'Cleared from the roster when the shift ends, like any one-off night hire.';
    }
    function toggleTeamRole(which){
        if(!teamRoleName)return;
        const cur=which==='core'?isPS9Core(teamRoleName):isPermanentMember(teamRoleName);
        setRosterFlags(teamRoleName,{[which]:!cur});
        renderTeamRoleModal();
        renderTeamManagement();
        if(typeof obsRenderAll==='function')obsRenderAll();
        if(typeof htRenderIfVisible==='function')htRenderIfVisible();
        showSaveToast();
    }
    function renameRosterFlags(oldName,newName){
        const f=getRosterFlags();
        if(!Object.prototype.hasOwnProperty.call(f,oldName))return;
        f[newName]=f[oldName];delete f[oldName];saveRosterFlags(f);
    }
    function forgetRosterFlags(name){
        const f=getRosterFlags();
        if(!Object.prototype.hasOwnProperty.call(f,name))return;
        delete f[name];saveRosterFlags(f);
    }
    // Roster changes reach devices that already have a saved team list through here.
    // Each step carries its own flag and runs at most once, so adding a step later
    // still lands on a device that ran every earlier one -- a single flag would have
    // meant every roster change after the first silently missed existing devices.
    // A step's removals are one-time by the same token: re-adding a retired name by
    // hand sticks rather than being stripped on the next load.
    // Each step records what that release actually did, as a literal. They used to
    // point at the live PS9_* lists, which meant history rewrote itself every time the
    // roster changed -- and deleting a list the blue-vest step referenced would have
    // broken the whole migration. Frozen now; add a step, never edit one.
    const ROSTER_MIGRATIONS=[
        {key:'ps9_roster_v7',   remove:['Juan F','Jeff','Anthony','Josh','Jarrett'],
         add:['Robert W','Matt R','Lorena R','Russell H','Trevon C','David F','Arce J',
              'Fonseca J','Eddie F','Solis','Damian','Johnny','Evan']},
        {key:'ps9_roster_v708', remove:[], add:['Luis','Gilbert']},
        {key:'ps9_roster_v714', remove:[], add:['Pablo']},
        {key:'ps9_roster_v715', remove:[], add:['Elliot']},
        {key:'ps9_roster_v717', remove:['Pablo','Gilbert','Fonseca J'], add:[]},
        // v7.29: owner's final roster. Last initials dropped (renames carry each person's
        // DOP hours, role flags, observations, doors and logs), Arce J and Evan off,
        // Jeremiah on as a Double.
        {key:'ps9_roster_v729',
         rename:{'Robert W':'Robert','Matt R':'Matt','Lorena R':'Lorena','Russell H':'Russell',
                 'Trevon C':'Tre','David F':'David','Eddie F':'Eddie'},
         remove:['Arce J','Evan'], add:['Jeremiah'], doublesNotCore:true}
    ];
    function migrateTeamRoster(){
        const before=teamNames.slice();
        ROSTER_MIGRATIONS.forEach(m=>{
            if(localStorage.getItem(m.key))return;
            // Renames first, only where the old name is on the team and the new one is not.
            // Roles are NOT copied from the old name here: the code's lists already hold the
            // new names, so the fallback gives each renamed person the right roles.
            Object.entries(m.rename||{}).forEach(([from,to])=>{
                if(teamNames.indexOf(from)===-1||teamNames.indexOf(to)!==-1)return;
                renameTeamMember(from,to,{keepRoles:false});
                renameInRecords(from,to,{resendLogs:false});
            });
            if(m.remove.length){teamNames=teamNames.filter(n=>m.remove.indexOf(n)===-1);
                // same as deleting them in Team Management: no orphan role flags left behind
                m.remove.forEach(forgetRosterFlags)}
            m.add.forEach(n=>{if(teamNames.indexOf(n)===-1)teamNames.push(n)});
            // A Double hand-promoted to core would sit in the observation rotation; the
            // owner's rule is that Doubles never do.
            if(m.doublesNotCore){const f=getRosterFlags();let ch=false;
                PS9_DOUBLES.forEach(n=>{if(f[n]&&f[n].core){delete f[n];ch=true}});if(ch)saveRosterFlags(f)}
            localStorage.setItem(m.key,'1');
        });
        if(before.join('|')!==teamNames.join('|')){refreshTeamNamesSorted();saveTeam();return true}
        return false;
    }
    // Called when a shift ends: temporary hires added for the night drop off, the
    // permanent roster stays.
    function purgeTemporaryEmployees(){
        const before=teamNames.length;
        teamNames=teamNames.filter(n=>isPermanentMember(n));
        const removed=before-teamNames.length;
        if(removed>0){
            refreshTeamNamesSorted();saveTeam();
            if(typeof populateUnloaderSelect==='function')populateUnloaderSelect();
            if(typeof renderTeamManagement==='function')renderTeamManagement();
            if(typeof htReconcileRoster==='function')htReconcileRoster();
        }
        return removed;
    }
