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
// CACHE carries the app version. Bumping APP_VERSION in index.html without bumping
// VERSION here would leave every phone running the old cached build, so the two move
// together -- see the release checklist in CHANGELOG.md.

const VERSION = '7.13';
const CACHE = 'wally-' + VERSION;

// The app is a single file. A launch asks for './' or './index.html' depending on how
// it was opened, so both keys are primed and both resolve to the same stored response.
const SHELL = ['./', './index.html'];

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
        await cache.addAll(SHELL).catch(() => {});
        await Promise.all(CDN_ASSETS.map(u =>
            fetch(u, { mode: 'no-cors' })
                .then(r => cache.put(new Request(u, { mode: 'no-cors' }), r))
                .catch(() => {})));
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
    if (CDN_HOSTS.includes(url.hostname)) {
        e.respondWith(cacheFirst(e));
    }
    // Anything else is left to the network untouched.
});

// Cache first so the launch is instant, then refresh the stored copy in the background
// so the NEXT launch gets the newer build. Deliberately not network-first: the whole
// point is that a launch must not depend on the network being usable.
async function shellFirst(event) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match('./index.html');
    const fetching = fetch(event.request).then(res => {
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
    }).catch(() => null);

    if (cached) {
        event.waitUntil(fetching);   // keeps the worker alive for the background refresh
        return cached;
    }
    const res = await fetching;
    return res || new Response(OFFLINE_HTML, {
        status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
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
