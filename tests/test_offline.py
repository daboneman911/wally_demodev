"""Offline launch: the service worker must let the app start with no network at all.

This is the white-screen-in-a-dead-zone fix. GitHub Pages serves index.html with
Cache-Control: max-age=600, so past that window a launch has to reach the network
before anything renders -- and a Home Screen app has no browser UI to show the stall
in. The worker has to make a launch independent of the network, so that is what is
asserted here: fully offline, does the app actually come up and work.

Playwright's contexts are ephemeral, so the worker is registered from scratch here
rather than inherited from another test.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

URL = f'http://localhost:{PORT}/index.html'


def ready(pg):
    """Wait until a worker is installed AND controlling the page."""
    pg.wait_for_function("""()=>navigator.serviceWorker
        && navigator.serviceWorker.controller
        && navigator.serviceWorker.controller.state==='activated'""", timeout=15000)


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 393, 'height': 852})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:100]))
    ok = True

    # ---- 1. first load registers and takes control ----
    pg.goto(URL)
    pg.wait_for_selector('text=Home', timeout=10000)
    ready(pg)
    controlled = pg.evaluate("()=>!!navigator.serviceWorker.controller")
    cached = pg.evaluate("()=>caches.keys().then(k=>k.filter(x=>x.startsWith('wally-')))")
    ok &= controlled and len(cached) == 1
    print(f'1. worker controls the page after one load: {controlled}')
    print(f'   cache created: {cached}')

    # the cache name must track APP_VERSION, or updates never reach a phone
    ver = pg.evaluate("()=>APP_VERSION")
    match = cached == [f'wally-{ver}']
    ok &= match
    print(f'   cache name tracks APP_VERSION ({ver}): {match}')

    # ---- 2. the shell is genuinely stored, not just registered ----
    stored = pg.evaluate("""()=>caches.open('wally-'+APP_VERSION)
        .then(c=>c.match('./index.html')).then(r=>!!r)""")
    ok &= stored
    print(f'2. index.html stored in the cache: {stored}')

    # ---- 3. the real test: full network loss, then relaunch ----
    ctx.set_offline(True)
    errs.clear()
    pg.goto(URL)
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.wait_for_timeout(600)
    state = pg.evaluate("""()=>({bays:document.getElementById('open-bays-grid').children.length,
        tabs:document.querySelectorAll('.tab-btn').length,
        roster:(typeof teamNames!=='undefined'&&teamNames.length)||0,
        version:typeof APP_VERSION!=='undefined'?APP_VERSION:null})""")
    launched = state['bays'] == 8 and state['tabs'] == 6 and state['roster'] > 0
    ok &= launched
    print(f'\n3. relaunched with the network fully off: {launched}')
    print(f'   {state}')
    ok &= not errs
    print(f'   page errors while offline: {errs if errs else "none"}')

    # and it is still usable, not just rendered
    usable = pg.evaluate("""()=>{try{switchTab('hours');htRenderAll();
        return document.querySelectorAll('.ht-emp-row').length>0}catch(e){return 'threw: '+e.message}}""")
    ok &= usable is True
    print(f'   DOP tab still renders offline: {usable}')

    # ---- 4. a POST must never be served from the cache ----
    # The webhook is the system of record; a replayed or cached response would be worse
    # than a failed one.
    posted = pg.evaluate("""()=>fetch('https://example.invalid/hook',{method:'POST',body:'x'})
        .then(()=>'resolved').catch(()=>'failed')""")
    ok &= posted == 'failed'
    print(f'\n4. a POST offline fails rather than being served from cache: {posted == "failed"}')

    ctx.set_offline(False)

    # ---- 5. the kill switch really removes it ----
    pg.goto(URL); pg.wait_for_selector('text=Home', timeout=10000); ready(pg)
    pg.evaluate("()=>{window.confirm=()=>true;window.alert=()=>{};}")
    pg.evaluate("()=>toggleOfflineMode()")
    pg.wait_for_timeout(2000)
    # the reload it triggers must NOT bring the worker back -- the opt-out is a stored
    # flag for exactly this reason
    pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(800)
    left = pg.evaluate("""()=>Promise.all([
        navigator.serviceWorker.getRegistrations().then(r=>r.length),
        caches.keys().then(k=>k.filter(x=>x.startsWith('wally-')).length)])""")
    gone = left == [0, 0]
    ok &= gone
    print(f'\n5. opt-out removed worker and caches, and survived the reload: {gone}')
    print(f'   (registrations, caches = {left})')

    # ---- 6. and it can be turned back on ----
    pg.evaluate("()=>{window.confirm=()=>true;window.alert=()=>{};}")
    label = pg.evaluate("()=>{updateOfflineStatus();return document.getElementById('offline-toggle-label').textContent}")
    pg.wait_for_timeout(300)
    label = pg.evaluate("()=>document.getElementById('offline-toggle-label').textContent")
    print(f'6. the row now offers to turn it back on: {label!r}')
    ok &= 'On' in label
    pg.evaluate("()=>toggleOfflineMode()")
    pg.wait_for_timeout(2000); pg.wait_for_selector('text=Home', timeout=10000)
    ready(pg)
    back = pg.evaluate("()=>caches.keys().then(k=>k.filter(x=>x.startsWith('wally-')).length)")
    ok &= back == 1
    print(f'   turning it back on re-registers and re-caches: {back == 1}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
