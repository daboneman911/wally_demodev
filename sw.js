// Wally Dashboard -- offline launch.
//
// Why this exists: GitHub Pages serves index.html with `Cache-Control: max-age=600`,
// and that header cannot be changed on Pages. Ten minutes after a load the browser is
// required to revalidate over the network before it will render anything. Launch the
// Home Screen app past that window on weak signal and the request does not fail, it
// hangs -- and a standalone web app has no browser UI to show a spinner or an error
// in, so the whole screen is white until the transfer finishes. That is the white
// screen seen in low-coverage areas.
//
// Serving the shell from the cache first means a launch never waits on the network.
//
// CACHE carries the app version. Bumping APP_VERSION in js/core.js without bumping
// VERSION here would leave every phone running the old cached build, so the two move
// together -- see the release checklist in CHANGELOG.md.

const VERSION = '7.31';
const CACHE = 'wally-' + VERSION;

// A launch asks for './' or './index.html' depending on how it was opened, so both
// keys are primed and both resolve to the same stored response.
const SHELL = ['./', './index.html'];

// The page's own CSS and JS. Keep in step with the <link>/<script> tags in index.html;
// test_offline checks that every one of them is listed here.
const APP_FILES = [
    './css/app.css',
    './js/core.js', './js/offline.js', './js/changelog.js', './js/webhook.js',
    './js/calculator.js', './js/notes.js', './js/shift.js', './js/settings.js',
    './js/roster.js', './js/observations.js', './js/checklist.js', './js/schedule.js',
    './js/doors.js', './js/boot.js', './js/hours.js'
];

// Icons, PDF export and the webfont. Every one of these URLs is version-pinned and
// immutable, so they are safe to keep until the whole cache is retired.
const CDN_HOSTS = ['unpkg.com', 'cdnjs.cloudflare.com',
                   'fonts.googleapis.com', 'fonts.gstatic.com'];

// Pulled in at install time. On the FIRST load the worker is not controlling the page
// yet -- it only takes over at activate -- so the deferred <script> tags go straight to
// the network and the fetch handler never sees them. Without this, nothing but the
// shell is stored until a second online load.
//
// Not a complete offline picture even so: the Phosphor script fetches its own
// stylesheets and woff2 at runtime, and the Google CSS resolves to gstatic font files.
// Those are discovered rather than listed, so they land via the fetch handler on the
// next online load. The shell -- the part that decides whether the app opens at all --
// is covered from the first load.
const CDN_ASSETS = [
    'https://unpkg.com/@phosphor-icons/web@2.1.1',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js'
];

const OFFLINE_HTML = `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wally Dashboard</title>
<body style="margin:0;display:grid;place-items:center;height:100vh;font:600 16px -apple-system,system-ui,sans-serif;background:#f2f2f7;color:#1a1a1a;text-align:center">
<div style="padding:24px"><div style="font-size:34px">&#128246;</div>
<p>The dashboard has not been saved for offline use yet.</p>
<p style="font-weight:400;color:#757575">Open it once with a signal and it will launch without one from then on.</p>
</div>`;

self.addEventListener('install', (e) => {
    e.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        // The shell and the CDN assets are stored independently and neither is fatal.
        // A single unreachable CDN must not take the shell down with it -- that would
        // trade the white screen for a worse version of the same problem.
        // cache:'reload' skips the browser's HTTP cache, so a worker installed right
        // after a deploy stores the new files rather than ones up to 10 minutes old.
        await cache.addAll(SHELL.concat(APP_FILES).map(u => new Request(u, { cache: 'reload' })))
            .catch(() => {});
        await Promise.all(CDN_ASSETS.map(u =>
            fetch(u, { mode: 'no-cors' })
                .then(r => cache.put(new Request(u, { mode: 'no-cors' }), r))
                .catch(() => {})));
        // Take over at once rather than waiting for every window to close. Before 7.19
        // the app was one file and the previous worker does not know about js/ and css/:
        // left in charge, it could serve a newly cached index.html offline with nothing
        // behind it. A page already open has loaded all its files, so it is unaffected.
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter(k => k.startsWith('wally-') && k !== CACHE)
            .map(k => caches.delete(k)));
        // Take over the page that registered us, so the very first install starts
        // protecting launches immediately instead of from the next one.
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    // The Apps Script webhook is a POST and must never be served from a cache or
    // replayed. Excluding non-GET covers it outright.
    if (req.method !== 'GET') return;

    let url;
    try { url = new URL(req.url); } catch (err) { return; }

    if (req.mode === 'navigate' ||
        (url.origin === self.location.origin && /(^|\/)(index\.html)?$/.test(url.pathname))) {
        e.respondWith(shellFirst(e));
        return;
    }
    if (url.origin === self.location.origin && isAppFile(url)) {
        e.respondWith(appFileFirst(req));
        return;
    }
    if (CDN_HOSTS.includes(url.hostname)) {
        e.respondWith(cacheFirst(e));
    }
    // Anything else is left to the network untouched.
});

function isAppFile(url) {
    const scope = new URL(self.registration.scope);
    return APP_FILES.some(f => new URL(f, scope).pathname === url.pathname);
}

// Cache first so the launch is instant, then refresh the stored copy in the background
// so the NEXT launch gets the newer build. Deliberately not network-first: the whole
// point is that a launch must not depend on the network being usable.
//
// The page is split across index.html and APP_FILES, and they only work as a matched
// set: a new index.html with an old js/ file (or the reverse) could break the app. So
// the refresh fetches every file first and stores them only if ALL of them arrived.
// cache:'no-cache' makes each request revalidate, so the browser's 10-minute HTTP cache
// cannot hand back a stale file next to a fresh one.
async function shellFirst(event) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match('./index.html');
    const refreshing = refreshShell(cache, event.request);

    if (cached) {
        event.waitUntil(refreshing);   // keeps the worker alive for the background refresh
        return cached;
    }
    const res = await refreshing;
    return res || new Response(OFFLINE_HTML, {
        status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

async function refreshShell(cache, pageRequest) {
    try {
        const page = await fetch(pageRequest, { cache: 'no-cache' });
        if (!page || !page.ok) return page || null;
        const files = await Promise.all(APP_FILES.map(f => fetch(f, { cache: 'no-cache' })));
        if (files.every(r => r && r.ok)) {
            await cache.put('./index.html', page.clone());
            await Promise.all(files.map((r, i) => cache.put(APP_FILES[i], r)));
        }
        return page;
    } catch (err) {
        return null;
    }
}

// Stored with the shell, so served from the cache to keep the set matched. Falls back
// to the network only if the file was never stored (e.g. install ran offline).
async function appFileFirst(req) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
    } catch (err) {
        return Response.error();
    }
}

async function cacheFirst(event) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
        const res = await fetch(event.request);
        // Cross-origin <script src> and <link rel=stylesheet> are no-cors requests, so
        // these come back opaque. Opaque responses replay fine, they just cannot be
        // inspected -- which is all that is needed here.
        if (res && (res.ok || res.type === 'opaque')) {
            cache.put(event.request, res.clone()).catch(() => {});
        }
        return res;
    } catch (err) {
        // Icons and the PDF library are optional; the app renders without them.
        return Response.error();
    }
}
