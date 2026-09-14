"""Corrupt localStorage must not brick the app.

Before v7.11 a damaged ps9_team or ps9_history threw inside init(), which stopped boot
dead: no bays, no tabs, no Settings -- and therefore no way to reach Restore From Backup
or Reset. The only escape was clearing site data, which also destroys the roster and the
observation rotation.

Two failure shapes matter and only one of them is a parse error:
  - unreadable  -- JSON.parse throws
  - wrong shape -- it parses, but ps9_team holding "Robert W" gives teamNames.length===8
                   (the string's length), so downstream truthiness guards pass

Nothing damaged may be deleted; it is set aside under ps9_corrupt_<key>.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

URL = f'http://localhost:{PORT}/index.html'

# key, stored value, label
CASES = [
    ('ps9_team',    '[[[',                  'unreadable'),
    ('ps9_team',    '"Robert W"',           'a bare string'),
    ('ps9_team',    '[]',                   'an empty list'),
    ('ps9_team',    '[1,2,3]',              'not names'),
    ('ps9_history', '{{{not json',          'unreadable'),
    ('ps9_history', '{"a":1}',              'an object, not a list'),
    ('ps9_doors',   'null',                 'null'),
    ('ps9_doors',   '@@@',                  'unreadable'),
    ('ps9_attribution_config_v2', 'nope',   'unreadable'),
]

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 393, 'height': 852})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:80]))
    pg.on('dialog', lambda d: d.accept())
    ok = True

    pg.goto(URL); pg.wait_for_selector('text=Home', timeout=10000)

    print('the app must still boot and stay usable with each of these stored:')
    for key, val, label in CASES:
        pg.evaluate("(a)=>{localStorage.clear();localStorage.setItem(a[0],a[1]);}", [key, val])
        errs.clear()
        pg.reload()
        try:
            pg.wait_for_selector('text=Home', timeout=8000)
        except Exception:
            pass
        pg.wait_for_timeout(700)
        st = pg.evaluate("""()=>{try{return{
            bays:document.getElementById('open-bays-grid').children.length,
            tabs:document.querySelectorAll('.tab-btn').length,
            roster:(typeof teamNames!=='undefined'&&Array.isArray(teamNames))?teamNames.length:-1,
            recovery:!!document.getElementById('rec-reload')};
          }catch(e){return{err:String(e)}}}""")
        booted = (st.get('bays') == 8 and st.get('tabs') == 6
                  and st.get('roster', 0) > 0 and not st.get('recovery'))
        kept = pg.evaluate("(k)=>localStorage.getItem('ps9_corrupt_'+k)!==null", key)
        ok &= booted and kept
        print(f'   {key:<28} {label:<24} boots: {booted}  set aside: {kept}')
        if not booted:
            print(f'      -> {st}  errors={errs[:1]}')

    # ---- Settings stays reachable, which is the whole point ----
    pg.evaluate("()=>{localStorage.clear();localStorage.setItem('ps9_team','[[[');}")
    pg.reload(); pg.wait_for_selector('text=Home', timeout=8000); pg.wait_for_timeout(700)
    pg.click('#tab-btn-settings'); pg.wait_for_timeout(250)
    pg.click('text=Team Management'); pg.wait_for_timeout(450)
    # The static markup for Settings is in the HTML either way, so its mere presence
    # proves nothing. The team list is RENDERED by init(), so rows here mean boot
    # actually finished -- that is what makes Restore reachable in practice.
    rows = pg.eval_on_selector_all('#team-management-list .settings-row', 'e=>e.length')
    restore_works = pg.evaluate("()=>typeof importBackup==='function'&&!!document.getElementById('restore-file-input')")
    ok &= rows > 0 and restore_works
    print(f'\nafter a corrupt-roster boot: Team Management rendered {rows} rows '
          f'(defaults recovered), Restore wired: {restore_works}')

    # ---- last resort: a real boot failure must show a recovery screen, not white ----
    # Driven by an actual throw from inside init() rather than by calling the recovery
    # screen directly, so this exercises the wiring and not just the markup. A storage
    # read that is NOT routed through loadJSON is the honest way to simulate the class
    # of failure the failsafe exists for -- something unanticipated.
    page2 = ctx.new_page()
    page2.on('dialog', lambda d: d.accept())
    page2.add_init_script("""
        const real = Storage.prototype.getItem;
        Storage.prototype.getItem = function(k){
            if(k==='ps9_shift_start') throw new Error('simulated storage failure');
            return real.call(this,k);
        };""")
    page2.goto(URL)
    page2.wait_for_timeout(1500)
    rec = page2.evaluate("""()=>({
        panel:!!document.getElementById('rec-reload'),
        restore:!!document.getElementById('rec-restore'),
        reset:!!document.getElementById('rec-reset'),
        explains:(document.body.innerText||'').includes('could not start'),
        reassures:(document.body.innerText||'').includes('has not been deleted')})""")
    rec_ok = all(rec.values())
    ok &= rec_ok
    print(f'\na real boot failure shows a recovery screen rather than a white page: {rec_ok}')
    print(f'   {rec}')
    page2.close()

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
