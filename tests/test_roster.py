"""Roster: PS9 Twilight badging, blue vests, permanent members, shift-end purge,
and the per-step migration that carries roster changes onto existing devices."""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')
CORE = ["Robert W", "Matt R", "Lorena R", "Russell H", "Trevon C",
        "David F", "Arce J", "Fonseca J", "Eddie F", "Luis", "Gilbert"]
BLUE_VEST = ["Luis", "Gilbert"]
EXTRA = ["Solis", "Damian", "Johnny", "Evan"]
RETIRED = ["Juan F", "Jeff", "Anthony", "Josh", "Jarrett"]

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 393, 'height': 852})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)

    # seed a device holding the OLD 16-name roster, then reload to migrate
    pg.evaluate("""(old)=>{localStorage.setItem('ps9_team',JSON.stringify(old));
        localStorage.removeItem('ps9_roster_v7');localStorage.removeItem('ps9_roster_v708');}""",
        CORE[:1] + RETIRED + CORE[1:9] + ["Solis", "Damian"])
    pg.reload()
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.wait_for_timeout(400)
    ok = True

    team = pg.evaluate("()=>teamNames.slice()")
    retired_gone = not any(n in team for n in RETIRED)
    added = all(n in team for n in EXTRA)
    core_ok = all(n in team for n in CORE)
    ok &= retired_gone and added and core_ok
    print(f'migrated roster ({len(team)}): {", ".join(team)}')
    print(f'   retired removed (Juan F, Jeff, Anthony, Josh, Jarrett): {retired_gone}')
    print(f'   Johnny + Evan present: {added}   all {len(CORE)} core present: {core_ok}')

    # a device that already ran the v7 step must still receive a later roster change
    pg.evaluate("""(bv)=>{localStorage.setItem('ps9_roster_v7','1');
        localStorage.removeItem('ps9_roster_v708');
        teamNames=teamNames.filter(n=>!bv.includes(n));saveTeam();}""", BLUE_VEST)
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(400)
    late = pg.evaluate("()=>teamNames.slice()")
    late_ok = all(n in late for n in BLUE_VEST)
    ok &= late_ok
    print(f'   v708 step reaches a device already on v7 (Luis, Gilbert): {late_ok}')

    # the migration is one-time: re-adding a retired name must stick
    pg.evaluate("()=>{teamNames.push('Jeff');refreshTeamNamesSorted();saveTeam();}")
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(400)
    sticks = pg.evaluate("()=>teamNames.includes('Jeff')")
    ok &= sticks
    print(f'   re-adding a retired name sticks across reload: {sticks}')

    # PS9 badge shows on exactly the core crew
    pg.click('#tab-btn-settings'); pg.wait_for_timeout(250)
    pg.click('text=Team Management'); pg.wait_for_timeout(450)
    badged = pg.eval_on_selector_all('#team-management-list .settings-row',
        """els=>els.filter(e=>e.querySelector('.ps9-core-tag'))
                  .map(e=>e.querySelector('.settings-label').firstChild.textContent.trim())""")
    badge_ok = sorted(badged) == sorted(CORE)
    ok &= badge_ok
    print(f'\nPS9 Twilight badge on {len(badged)} rows, exactly the {len(CORE)} core: {badge_ok}')

    # the blue-vest chip is additional to the PS9 chip, not instead of it
    vests = pg.eval_on_selector_all('#team-management-list .settings-row',
        """els=>els.filter(e=>e.querySelector('.blue-vest-tag'))
                  .map(e=>({name:e.querySelector('.settings-label').firstChild.textContent.trim(),
                            ps9:!!e.querySelector('.ps9-core-tag')}))""")
    vest_ok = (sorted(v['name'] for v in vests) == sorted(BLUE_VEST)
               and all(v['ps9'] for v in vests))
    ok &= vest_ok
    print(f'blue-vest BV chip on exactly {BLUE_VEST}, each still PS9-chipped: {vest_ok}')
    pg.screenshot(path=f'{SHOT}/roster_badges.png', full_page=True)

    # shift-end purge: temporary adds go, permanent stays
    pg.evaluate("""()=>{['Temp Aaa','Temp Bbb'].forEach(n=>{if(!teamNames.includes(n))teamNames.push(n)});
        refreshTeamNamesSorted();saveTeam();}""")
    before = pg.evaluate("()=>teamNames.slice()")
    removed = pg.evaluate("()=>purgeTemporaryEmployees()")
    after = pg.evaluate("()=>teamNames.slice()")
    temps_gone = not any(n.startswith('Temp ') for n in after)
    perm_kept = all(n in after for n in CORE + EXTRA)
    jeff_gone = 'Jeff' not in after      # not permanent, so a purge removes it
    ok &= temps_gone and perm_kept and jeff_gone
    print(f'\npurge removed {removed}: {sorted(set(before)-set(after))}')
    print(f'   temporary adds cleared: {temps_gone}')
    print(f'   all {len(CORE) + len(EXTRA)} permanent kept:  {perm_kept}')

    # the DOP roster follows
    synced = pg.evaluate("()=>{htReconcileRoster();return hoursState.employees.map(e=>e.name).join('|')===teamNames.join('|');}")
    ok &= synced
    print(f'   DOP roster still matches the master list: {synced}')

    # observation rotation is exactly the core crew
    rot = pg.evaluate("()=>obsEligible()")
    rot_ok = rot == CORE
    ok &= rot_ok
    print(f'\nobservation rotation == the {len(CORE)} core (cycle is {len(CORE)} days): {rot_ok}')

    # blue vests show the BV chip on DOP rows too
    dop_vests = pg.evaluate("()=>{htRenderAll();return [...document.querySelectorAll('.ht-emp-row')]"
                            ".filter(r=>r.querySelector('.blue-vest-tag'))"
                            ".map(r=>r.querySelector('.ht-emp-name').textContent.trim());}")
    dop_ok = sorted(dop_vests) == sorted(BLUE_VEST)
    ok &= dop_ok
    print(f'BV chip on DOP rows for exactly {BLUE_VEST}: {dop_ok}  (got {dop_vests})')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
