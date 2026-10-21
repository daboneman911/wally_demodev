"""Roster membership is editable in the app, not only in the source.

Before v7.16, making someone PS9 Twilight or permanent meant editing PS9_CORE in
index.html: a version bump, a migration step, a test update, a deploy and a service
worker cache bump per hire. Those are now per-person flags in ps9_roster_flags.

The important property is that the flags are an OVERLAY: only names the user has
actually changed get an entry, and everyone else falls through to the hardcoded lists.
That is what makes this need no migration -- the fallback is the default -- and it is
what this file pins down.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from _boot import boot
from playwright.sync_api import sync_playwright


def open_team(pg):
    pg.click('#tab-btn-settings'); pg.wait_for_timeout(250)
    if not pg.eval_on_selector('#team-management-list', 'e=>e.children.length'):
        pg.click('text=Team Management')
    pg.wait_for_timeout(400)


def row_index(pg, name):
    return pg.evaluate("""(n)=>[...document.querySelectorAll('#team-management-list .settings-row')]
        .findIndex(r=>r.querySelector('.settings-label').firstChild.textContent.trim()===n)""", name)


def state(pg, name):
    return pg.evaluate("""(n)=>({core:isPS9Core(n), perm:isPermanentMember(n),
        inRotation:obsEligible().includes(n),
        stored:JSON.parse(localStorage.getItem('ps9_roster_flags')||'{}')[n]||null})""", name)


with sync_playwright() as p:
    b, pg, errs = boot(p)
    pg.on('dialog', lambda d: d.accept())
    ok = True

    # ---- 1. with nothing stored, behaviour is exactly the hardcoded default ----
    base = pg.evaluate("""()=>{localStorage.removeItem('ps9_roster_flags');
        return {flags:localStorage.getItem('ps9_roster_flags'),
                core:teamNames.filter(isPS9Core),
                perm:teamNames.filter(isPermanentMember).length,
                rotation:obsEligible()};}""")
    default_ok = (base['flags'] is None and base['core'] == base['rotation']
                  and len(base['core']) == 13 and base['perm'] == 17)
    ok &= default_ok
    print(f'1. no flags stored -> hardcoded defaults intact: {default_ok}')
    print(f'   core={len(base["core"])}, permanent={base["perm"]}, rotation={len(base["rotation"])}')

    # ---- 2. promoting a non-core member is immediate and complete ----
    before = state(pg, 'Solis')
    pg.evaluate("()=>setRosterFlags('Solis',{core:true})")
    after = state(pg, 'Solis')
    promoted = (not before['core'] and before['perm']
                and after['core'] and after['perm'] and after['inRotation'])
    ok &= promoted
    print(f'\n2. promoting Solis to PS9 Twilight: {promoted}')
    print(f'   before {before["core"]=}/{before["inRotation"]=} -> after {after["core"]=}/{after["inRotation"]=}')

    rot = pg.evaluate("()=>obsEligible()")
    ok &= len(rot) == 14 and 'Solis' in rot
    print(f'   rotation grew to {len(rot)} and includes Solis: {len(rot) == 14}')

    # the chip follows, with no reload (this path set the flag directly, so re-render
    # explicitly -- the real toggle in check 7 does that itself)
    open_team(pg)
    pg.evaluate("()=>renderTeamManagement()")
    chip = pg.evaluate("""(i)=>!!document.querySelectorAll('#team-management-list .settings-row')[i]
        .querySelector('.ps9-core-tag')""", row_index(pg, 'Solis'))
    ok &= chip
    print(f'   PS9 chip now renders on the Solis row: {chip}')

    # ---- 3. demoting a hardcoded core member works too, not just promoting ----
    pg.evaluate("()=>setRosterFlags('Gilbert',{core:false})")
    g = state(pg, 'Gilbert')
    demoted = not g['core'] and not g['inRotation']
    ok &= demoted
    print(f'\n3. demoting Gilbert (hardcoded core) off PS9 Twilight: {demoted}  {g["stored"]}')

    # ---- 4. core and permanent cannot disagree ----
    # Core but not permanent is incoherent: the shift-end purge would drop them that
    # same night and they would silently leave the rotation.
    pg.evaluate("()=>setRosterFlags('Solis',{permanent:false})")
    s1 = state(pg, 'Solis')
    pg.evaluate("()=>setRosterFlags('Damian',{core:true})")
    s2 = state(pg, 'Damian')
    coherent = (not s1['core'] and not s1['perm']) and (s2['core'] and s2['perm'])
    ok &= coherent
    print(f'\n4. the two flags are kept consistent: {coherent}')
    print(f'   permanent off -> core off: {not s1["core"]}   core on -> permanent on: {s2["perm"]}')

    # ---- 5. the purge honours the flags, not the hardcoded list ----
    purge = pg.evaluate("""()=>{localStorage.removeItem('ps9_roster_flags');
        setRosterFlags('Damian',{permanent:false});     // hardcoded permanent, demoted
        setRosterFlags('Temp Promoted',{core:true});    // a night hire, promoted
        if(!teamNames.includes('Temp Promoted'))teamNames.push('Temp Promoted');
        refreshTeamNamesSorted();saveTeam();
        purgeTemporaryEmployees();
        return {damian:teamNames.includes('Damian'), promoted:teamNames.includes('Temp Promoted')};}""")
    purge_ok = purge['damian'] is False and purge['promoted'] is True
    ok &= purge_ok
    print(f'\n5. shift-end purge follows the flags: {purge_ok}')
    print(f'   demoted Damian removed: {not purge["damian"]}   promoted night hire kept: {purge["promoted"]}')

    # ---- 6. flags survive a rename and go when the person is removed ----
    pg.evaluate("()=>{window.prompt=()=>'Temp Renamed';window.confirm=()=>true;}")
    pg.evaluate("()=>editTeamMember('Temp Promoted')")
    pg.wait_for_timeout(400)
    moved = pg.evaluate("""()=>{const f=JSON.parse(localStorage.getItem('ps9_roster_flags')||'{}');
        return {old:!!f['Temp Promoted'], new:!!f['Temp Renamed'], core:isPS9Core('Temp Renamed')};}""")
    ok &= (not moved['old']) and moved['new'] and moved['core']
    print(f'\n6. flags follow a rename: {moved}')

    pg.evaluate("()=>deleteTeamMember('Temp Renamed')")
    pg.wait_for_timeout(400)
    orphan = pg.evaluate("()=>!!JSON.parse(localStorage.getItem('ps9_roster_flags')||'{}')['Temp Renamed']")
    ok &= not orphan
    print(f'   and are cleared on delete (no orphan entry): {not orphan}')

    # ---- 7. the sheet drives it, and survives a reload ----
    pg.evaluate("()=>{localStorage.removeItem('ps9_roster_flags');}")
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(400)
    open_team(pg)
    idx = row_index(pg, 'Evan')
    pg.eval_on_selector_all('#team-management-list .settings-row',
                            '(els,i)=>els[i].querySelector(".role-btn").click()', idx)
    pg.wait_for_timeout(400)
    sheet = pg.evaluate("""()=>({open:document.getElementById('team-role-modal').style.display,
        name:document.getElementById('team-role-name').textContent,
        core:document.getElementById('switch-team-core').classList.contains('checked'),
        perm:document.getElementById('switch-team-permanent').classList.contains('checked')})""")
    sheet_ok = sheet['open'] == 'flex' and sheet['name'] == 'Evan' and not sheet['core'] and sheet['perm']
    ok &= sheet_ok
    print(f'\n7. role sheet opens with the right state: {sheet_ok}  {sheet}')

    pg.click('#switch-team-core'); pg.wait_for_timeout(400)
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(500)
    persisted = pg.evaluate("()=>({core:isPS9Core('Evan'),rot:obsEligible().includes('Evan')})")
    ok &= persisted['core'] and persisted['rot']
    print(f'   toggled in the sheet and survived a reload: {persisted}')

    # ---- 8. a corrupt flags blob must not take the app down ----
    bad = pg.evaluate("""()=>{localStorage.setItem('ps9_roster_flags','{{{nope');
        try{return {core:isPS9Core('Robert W'), perm:isPermanentMember('Robert W')}}
        catch(e){return 'threw: '+e.message}}""")
    ok &= bad == {'core': True, 'perm': True}
    print(f'\n8. unreadable flags fall back to the defaults instead of throwing: {bad}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
