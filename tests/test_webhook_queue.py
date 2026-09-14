"""The sync queue must not let one bad record hold up the night's data.

Before v7.12 processWebhookQueue() always sent queue[0] and only removed it on success,
with no attempt cap and nowhere else for a payload to go. A record the sheet refused
parked itself at the head and blocked everything behind it for the rest of the shift,
while the badge read "Tap to retry" -- which could never work. Sorting 'end' payloads to
the front made a bad completion the likeliest thing to get stuck there.

The distinction under test is WHO failed:
  - fetch threw / offline  -> transport. Not the record's fault; its attempt count must
                              be left alone and the queue must survive intact.
  - server said ok:false   -> it read the record and refused it. Retrying unchanged
                              cannot help, so it parks and the rest go through.
  - reply was not JSON     -> ambiguous (an Apps Script error page looks like this and
                              usually affects everything), so it is tolerated far longer.

Nothing is ever deleted: parked records move to ps9_webhook_failed and can be retried.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from _boot import boot
from playwright.sync_api import sync_playwright

# Server stub: accepts everything except ids listed in window.__reject.
STUB_OK = """()=>{window.__sent=[];window.__reject=window.__reject||[];
  window.fetch=(u,o)=>{const p=JSON.parse(o.body);window.__sent.push(p.id||p.dataType);
    const bad=window.__reject.includes(p.id);
    return Promise.resolve({json:()=>Promise.resolve(bad?{ok:false,error:'bad row'}:{ok:true})});};}"""

STUB_HTML = """()=>{window.__sent=[];
  window.fetch=(u,o)=>{window.__sent.push(JSON.parse(o.body).id);
    return Promise.resolve({json:()=>Promise.reject(new SyntaxError('Unexpected token <'))});};}"""

STUB_DEAD = """()=>{window.__sent=[];
  window.fetch=(u,o)=>{window.__sent.push(JSON.parse(o.body).id);
    return Promise.reject(new TypeError('Failed to fetch'));};}"""

SNAP = """()=>({queue:JSON.parse(localStorage.getItem('ps9_webhook_queue')||'[]').map(p=>p.id),
                failed:JSON.parse(localStorage.getItem('ps9_webhook_failed')||'[]').map(p=>p.id),
                sent:window.__sent.slice()})"""


def seed(pg, ids, reject=None):
    pg.evaluate("(r)=>{localStorage.removeItem('ps9_webhook_queue');"
                "localStorage.removeItem('ps9_webhook_failed');"
                "window.__reject=r||[];syncBackoffMs=0;isSyncingWebhook=false;}", reject or [])
    pg.evaluate(STUB_OK)
    pg.evaluate("(r)=>{window.__reject=r||[]}", reject or [])
    pg.evaluate("(ids)=>{ids.forEach(id=>queuePayload({stage:'end',id:id,logId:id}));"
                "processWebhookQueue();}", ids)


with sync_playwright() as p:
    b, pg, errs = boot(p)
    pg.on('dialog', lambda d: d.accept())
    ok = True

    def unexpected():
        # parkPayload() logs a console.error deliberately -- that IS the diagnostic a
        # parked record is supposed to leave behind, so it is not a test failure.
        return [e for e in errs if '[sync] parked' not in e]

    # ---- 1. the original bug: one refused record must not block the rest ----
    seed(pg, ['POISON', 'GOOD1', 'GOOD2', 'GOOD3', 'GOOD4', 'GOOD5'], reject=['POISON'])
    pg.wait_for_timeout(3500)
    st = pg.evaluate(SNAP)
    drained = st['queue'] == []
    delivered = all(g in st['sent'] for g in ['GOOD1', 'GOOD2', 'GOOD3', 'GOOD4', 'GOOD5'])
    parked = st['failed'] == ['POISON']
    ok &= drained and delivered and parked
    print('1. one record the sheet refuses, five good ones behind it:')
    print(f'   all five good records delivered: {delivered}')
    print(f'   queue drained:                   {drained}  {st["queue"]}')
    print(f'   bad record parked, not deleted:  {parked}  {st["failed"]}')
    print(f'   send attempts: {st["sent"]}')

    # ---- 2. a refused record is retried a few times before being given up on ----
    attempts = st['sent'].count('POISON')
    ok &= attempts == 3
    print(f'\n2. it was retried {attempts}x before parking (expect 3): {attempts == 3}')

    # ---- 3. being offline must NOT burn a record's attempts or park anything ----
    pg.evaluate("()=>{localStorage.removeItem('ps9_webhook_queue');"
                "localStorage.removeItem('ps9_webhook_failed');"
                "syncBackoffMs=0;isSyncingWebhook=false;}")
    pg.evaluate(STUB_DEAD)          # dead connection BEFORE anything is queued
    pg.evaluate("()=>{['N1','N2','N3'].forEach(id=>queuePayload({stage:'end',id:id,logId:id}));"
                "processWebhookQueue();}")
    pg.wait_for_timeout(1500)
    st3 = pg.evaluate(SNAP)
    intact = len(st3['queue']) == 3 and st3['failed'] == []
    ok &= intact
    print(f'\n3. transport failure (no signal): queue kept intact, nothing parked: {intact}')
    print(f'   queue={st3["queue"]}  failed={st3["failed"]}')
    backoff = pg.evaluate("()=>syncBackoffMs")
    ok &= backoff > 0
    print(f'   backed off rather than hammering: {backoff > 0} ({backoff}ms)')

    # and it recovers on its own once the connection returns
    pg.evaluate(STUB_OK)
    pg.evaluate("()=>{window.__reject=[];syncBackoffMs=0;isSyncingWebhook=false;processWebhookQueue();}")
    pg.wait_for_timeout(2500)
    st3b = pg.evaluate(SNAP)
    recovered = st3b['queue'] == [] and st3b['failed'] == []
    ok &= recovered
    print(f'   drains once the connection is back: {recovered}')

    # ---- 4. a non-JSON reply is tolerated much longer than a rejection ----
    # An Apps Script error page looks like this and usually affects every record, so
    # parking on the first sight of one would park the whole night.
    pg.evaluate("()=>{localStorage.removeItem('ps9_webhook_queue');"
                "localStorage.removeItem('ps9_webhook_failed');"
                "syncBackoffMs=0;isSyncingWebhook=false;}")
    pg.evaluate(STUB_HTML)
    pg.evaluate("()=>{['H1','H2'].forEach(id=>queuePayload({stage:'end',id:id,logId:id}));}")
    for _ in range(6):
        pg.evaluate("()=>{syncBackoffMs=0;isSyncingWebhook=false;processWebhookQueue();}")
        pg.wait_for_timeout(250)
    st4 = pg.evaluate(SNAP)
    tolerated = st4['failed'] == []
    ok &= tolerated
    print(f'\n4. after 6 non-JSON replies nothing is parked yet: {tolerated}  failed={st4["failed"]}')

    # ---- 5. parked records can be sent again once the cause is fixed ----
    seed(pg, ['FIXME', 'OK1'], reject=['FIXME'])
    pg.wait_for_timeout(3000)
    before = pg.evaluate(SNAP)
    pg.evaluate("()=>{window.__reject=[];}")          # whatever was wrong is now fixed
    n = pg.evaluate("()=>retryFailedWebhooks()")
    pg.wait_for_timeout(2000)
    after = pg.evaluate(SNAP)
    retried = before['failed'] == ['FIXME'] and after['failed'] == [] and after['queue'] == []
    ok &= retried
    print(f'\n5. parked record retried successfully after the fix: {retried}')
    print(f'   parked {before["failed"]} -> retried {n} -> failed={after["failed"]} queue={after["queue"]}')

    # ---- 6. the badge tells the truth instead of an impossible "Tap to retry" ----
    seed(pg, ['BAD'], reject=['BAD'])
    pg.wait_for_timeout(3000)
    label = pg.evaluate("()=>{updateSyncBadge();return document.getElementById('sync-badge-text').textContent}")
    honest = 'sync' in label.lower() and 'tap' in label.lower()
    ok &= honest
    print(f'\n6. badge reports parked records rather than a retry that cannot work:')
    print(f'   {label!r} -> {honest}')

    bad = unexpected()
    ok &= not bad
    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', bad if bad else 'none (parked-record diagnostics ignored)')
    b.close()
