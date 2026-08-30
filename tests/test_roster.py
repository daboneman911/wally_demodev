"""Roster: PS9 Twilight badging, permanent members, and shift-end purge."""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')
CORE = ["Robert W", "Matt R", "Lorena R", "Russell H", "Trevon C",
        "David F", "Arce J", "Fonseca J", "Eddie F"]
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
        localStorage.removeItem('ps9_roster_v7');}""",
        CORE[:1] + RETIRED + CORE[1:] + ["Solis", "Damian"])
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
    print(f'   Johnny + Evan present: {added}   all 9 core present: {core_ok}')

    # the migration is one-time: re-adding a retired name must stick
    pg.evaluate("()=>{teamNames.push('Jeff');refreshTeamNamesSorted();saveTeam();}")
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(400)
    sticks = pg.evaluate("()=>teamNames.includes('Jeff')")
    ok &= sticks
    print(f'   re-adding a retired name sticks across reload: {sticks}')

    # badge shows on exactly the 9 core
    pg.click('#tab-btn-settings'); pg.wait_for_timeout(250)
    pg.click('text=Team Management'); pg.wait_for_timeout(450)
    badged = pg.eval_on_selector_all('#team-management-list .settings-row',
        """els=>els.filter(e=>e.querySelector('.ps9-core-tag'))
                  .map(e=>e.querySelector('.settings-label').firstChild.textContent.trim())""")
    badge_ok = sorted(badged) == sorted(CORE)
    ok &= badge_ok
    print(f'\nPS9 Twilight badge on {len(badged)} rows, exactly the core nine: {badge_ok}')
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
    print(f'   all 13 permanent kept:  {perm_kept}')

    # the DOP roster follows
    synced = pg.evaluate("()=>{htReconcileRoster();return hoursState.employees.map(e=>e.name).join('|')===teamNames.join('|');}")
    ok &= synced
    print(f'   DOP roster still matches the master list: {synced}')

    # observation rotation is exactly the core nine
    rot = pg.evaluate("()=>obsEligible()")
    rot_ok = rot == CORE
    ok &= rot_ok
    print(f'\nobservation rotation == core nine: {rot_ok}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
