// Wally Dashboard -- Google Sheets webhook queue: send, retry, park failed records.
// Loaded as a classic script from index.html; all files share one global scope.

    function getHourText(h){if(h===1)return"1st hour";if(h===2)return"2nd hour";if(h===3)return"3rd hour";if(h===4)return"4th hour";if(h===5)return"5th hour";if(h===6)return"6th hour";if(h===7)return"7th hour";if(h===8)return"8th hour";if(h===9)return"9th hour";if(h===10)return"10th hour";if(h===11)return"11th hour";if(h===12)return"12th hour";return`${h}th hour`}
    // --- SEQUENTIAL WEBHOOK QUEUE v6.10 ---
    function sendToWebhook(logEntry,stage='end'){
        const payload={
            stage:stage,door:logEntry.door,id:logEntry.id,account:logEntry.account,
            type:logEntry.type,unloader:logEntry.unloader,assistants:logEntry.assistants||[],
            start:logEntry.start,laborStart:logEntry.laborStart||null,end:logEntry.end,
            dateKey:logEntry.dateKey,durationMinutes:logEntry.durationMinutes,
            unloadDurationMinutes:logEntry.unloadDurationMinutes||null,
            dwellMinutes:logEntry.dwellMinutes!=null?logEntry.dwellMinutes:null,
            idleBeforeMinutes:logEntry.idleBeforeMinutes!=null?logEntry.idleBeforeMinutes:null,
            cpuOptions:logEntry.cpuOptions,duplicate:logEntry.duplicate,manual:logEntry.manual,
            completionHour:logEntry.completionHour,status:logEntry.status,
            moveDest:logEntry.moveDest,shiftStart:getShiftStartTime(),logId:logEntry.logId
        };
        queuePayload(payload);
        processWebhookQueue();
    }
    // attemptWebhook: used for pre-built payloads (PPH uploads, direct calls)
    function attemptWebhook(payload){queuePayload(payload);processWebhookQueue();}
    function queuePayload(payload){
        if(config.noWebhook){console.log('[Webhook suppressed - demo mode]',payload);return;}
        let queue=[];
        try{queue=JSON.parse(localStorage.getItem('ps9_webhook_queue')||'[]');}catch(e){}
        // When a completion arrives, remove any pending start/update for the same
        // logId so Sheets never sees an active record after it has been completed
        if(payload.stage==='end'&&payload.logId){
            queue=queue.filter(p=>!(p.logId===payload.logId&&(p.stage==='start'||p.stage==='update')));
        }
        if(queue.length>200){console.warn('Webhook queue has '+queue.length+' pending items');}
        payload._priority=(payload.stage==='end'||payload.dataType==='SHIFT_END'||payload.dataType==='NEW_SHIFT')?0:1;
        if(!payload._queueId)payload._queueId=Date.now().toString(36)+Math.random().toString(36).substr(2,5);
        queue.push(payload);
        queue.sort(function(a,b){return (a._priority||0)-(b._priority||0);});
        try{localStorage.setItem('ps9_webhook_queue',JSON.stringify(queue));}catch(e){console.error('Queue storage failed:',e);}
        updateSyncBadge();
    }
    let isSyncingWebhook=false,syncBackoffMs=0,syncRetryTimer=null;
    // -- QUEUE FAILURE HANDLING ------------------------------
    // The queue used to send queue[0] and only ever remove it on success, with no
    // attempt cap and nowhere else for a payload to go. One record the server refused
    // therefore parked itself at the head and blocked every record behind it, for the
    // rest of the night, while the badge said "Tap to retry" -- which could never work.
    // Sorting 'end' payloads to the front made a bad completion the likeliest culprit.
    //
    // The distinction that matters is WHO failed:
    //   - fetch threw, or we are offline  -> transport. Not this record's fault, so its
    //     attempt count is untouched and the whole queue simply waits and backs off.
    //   - the server answered ok:false    -> it read this record and refused it. Retrying
    //     unchanged cannot help, so it is counted and parked after MAX_REJECTS.
    //   - the reply was not JSON          -> ambiguous (an Apps Script error page looks
    //     like this, and usually affects every record). Counted, but far more slowly,
    //     so a site-wide outage does not park the night's work.
    // Parked records are never deleted -- they move to ps9_webhook_failed for retry.
    const MAX_REJECTS=3, MAX_UNREADABLE=8, MAX_QUEUE=500;
    const readQ=(k)=>{try{return JSON.parse(localStorage.getItem(k)||'[]')||[]}catch(e){return[]}};
    const writeQ=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){console.error('Queue storage failed:',e)}};
    function parkPayload(payload,reason){
        const failed=readQ('ps9_webhook_failed');
        failed.push(Object.assign({},payload,{_parkedAt:Date.now(),_reason:reason}));
        writeQ('ps9_webhook_failed',failed);
        console.error('[sync] parked a record after repeated failures ('+reason+')',payload);
    }
    function retryFailedWebhooks(){
        const failed=readQ('ps9_webhook_failed');
        if(!failed.length)return 0;
        const queue=readQ('ps9_webhook_queue');
        failed.forEach(p=>{delete p._attempts;delete p._unreadable;delete p._parkedAt;delete p._reason;queue.push(p)});
        writeQ('ps9_webhook_queue',queue);
        writeQ('ps9_webhook_failed',[]);
        syncBackoffMs=0;
        updateSyncBadge();processWebhookQueue();
        return failed.length;
    }
    function updateSyncBadge(){
        const badge=byId('sync-badge'),text=byId('sync-badge-text');
        if(!badge)return;
        const queue=readQ('ps9_webhook_queue'),failed=readQ('ps9_webhook_failed');
        if(!queue.length&&!failed.length){badge.classList.remove('visible','error');badge.onclick=null;return;}
        badge.classList.add('visible');
        // Parked records are the state worth acting on, so they win the label.
        if(failed.length){
            badge.classList.add('error');
            if(text)text.textContent=failed.length+' didn\u2019t sync \u2014 tap';
            badge.onclick=()=>{
                if(confirm(failed.length+' record'+(failed.length===1?'':'s')+' could not be sent to the sheet and '
                    +'have been set aside.\n\nTry sending them again?')) retryFailedWebhooks();
            };
            return;
        }
        if(syncBackoffMs>0){
            badge.classList.add('error');
            if(text)text.textContent='Waiting to retry ('+queue.length+')';
            badge.onclick=()=>{syncBackoffMs=0;badge.classList.remove('error');badge.onclick=null;processWebhookQueue()};
            return;
        }
        badge.classList.remove('error');badge.onclick=null;
        if(text)text.textContent=queue.length===1?'Syncing...':'Syncing ('+queue.length+')...';
    }
    function scheduleRetry(){
        // Transport failures back off rather than hammering a dead connection every 5s.
        syncBackoffMs=syncBackoffMs?Math.min(syncBackoffMs*2,60000):5000;
        updateSyncBadge();
        if(syncRetryTimer)clearTimeout(syncRetryTimer);
        syncRetryTimer=setTimeout(()=>{syncRetryTimer=null;syncBackoffMs=0;processWebhookQueue()},syncBackoffMs);
    }
    // Remove the record we just sent by its own id, never by position: dedup may have
    // rewritten the queue while the request was in flight.
    function dequeue(queueId){
        const q=readQ('ps9_webhook_queue');
        const i=queueId?q.findIndex(p=>p._queueId===queueId):0;
        if(i>-1)q.splice(i,1);else if(!queueId)q.shift();
        writeQ('ps9_webhook_queue',q);
        return q;
    }
    function failHead(payload,field,limit,reason){
        const q=readQ('ps9_webhook_queue');
        const i=q.findIndex(p=>p._queueId===payload._queueId);
        if(i<0)return;                                  // already gone; nothing to do
        q[i][field]=(q[i][field]||0)+1;
        if(q[i][field]>=limit){
            const[bad]=q.splice(i,1);
            writeQ('ps9_webhook_queue',q);
            parkPayload(bad,reason);
        }else{
            writeQ('ps9_webhook_queue',q);
        }
    }
    function processWebhookQueue(){
        if(isSyncingWebhook||syncBackoffMs>0){updateSyncBadge();return;}
        if(!navigator.onLine){updateSyncBadge();return;}
        const queue=readQ('ps9_webhook_queue');
        if(queue.length===0){updateSyncBadge();return;}
        isSyncingWebhook=true;
        updateSyncBadge();
        const payload=queue[0];
        fetch(WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
        .then(resp=>resp.json().then(
            data=>({data}),
            ()=>({unreadable:true})))          // an Apps Script error page is not JSON
        .then(res=>{
            isSyncingWebhook=false;
            if(res.unreadable){
                failHead(payload,'_unreadable',MAX_UNREADABLE,'the sheet did not answer with JSON');
                scheduleRetry();return;
            }
            if(!res.data||!res.data.ok){
                // The server read this record and refused it. Retrying it unchanged
                // cannot succeed, and it must not hold up everything behind it.
                failHead(payload,'_attempts',MAX_REJECTS,(res.data&&res.data.error)||'the sheet rejected it');
                syncBackoffMs=0;
                updateSyncBadge();
                setTimeout(processWebhookQueue,200);return;
            }
            dequeue(payload._queueId);
            syncBackoffMs=0;
            updateSyncBadge();
            setTimeout(processWebhookQueue,200);
        })
        .catch(err=>{
            // fetch itself failed: no signal, DNS, TLS. Nothing to do with this record,
            // so its attempt count is deliberately left alone.
            console.warn('[Sync failed]',err&&err.message);
            isSyncingWebhook=false;
            scheduleRetry();
        });
    }
