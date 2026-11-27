// Wally Dashboard -- Offline launch: service worker registration and the offline switch.
// Loaded as a classic script from index.html; all files share one global scope.

    // -- OFFLINE LAUNCH ------------------------------------
    // GitHub Pages serves this file with Cache-Control: max-age=600 and that cannot be
    // changed on Pages, so ten minutes after a load the browser must reach the network
    // before it renders anything. On weak signal the request hangs rather than failing,
    // and a Home Screen app has no browser UI to show that in -- hence the white screen
    // in low-coverage areas. sw.js serves the shell from cache so a launch never waits
    // on the network. isSecureContext covers both https and localhost.
    // Keep VERSION in sw.js in step with APP_VERSION above, or phones keep the old build.
    // The opt-out is a stored flag, not just an unregister: unregistering and reloading
    // would only re-register on the way back up. Deliberately NOT in BACKUP_KEYS -- it
    // describes this device, and restoring another phone's backup should not turn off
    // offline mode here.
    function offlineModeOff(){try{return localStorage.getItem('ps9_offline_off')==='1'}catch(e){return false}}
    if('serviceWorker' in navigator&&window.isSecureContext&&!offlineModeOff()){
        window.addEventListener('load',()=>{
            navigator.serviceWorker.register('sw.js')
                .catch(e=>console.warn('Offline mode unavailable:',e));
        });
    }
    // Settings escape hatch. A service worker is the one thing that can keep serving a
    // broken build to a device, so there is a way off it that does not involve digging
    // through browser settings.
    async function toggleOfflineMode(){
        if(offlineModeOff()){
            localStorage.removeItem('ps9_offline_off');
            alert('Offline mode is back on. The app will reload and save itself for offline use.');
            setTimeout(()=>location.reload(),300);
            return;
        }
        if(!confirm('Turn off offline mode?\n\nThe app will need a connection every time it opens. Your data is not affected.'))return;
        try{
            localStorage.setItem('ps9_offline_off','1');
            if('serviceWorker' in navigator){
                const regs=await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r=>r.unregister()));
            }
            if(window.caches){
                const keys=await caches.keys();
                await Promise.all(keys.filter(k=>k.startsWith('wally-')).map(k=>caches.delete(k)));
            }
            alert('Offline mode is off. The app will reload.');
            setTimeout(()=>location.reload(),300);
        }catch(e){alert('Could not turn off offline mode: '+e.message)}
    }
    // Shown in Settings so the state is visible rather than something you have to trust.
    async function updateOfflineStatus(){
        const el=byId('offline-status');if(!el)return;
        const btn=byId('offline-toggle-label');
        if(!('serviceWorker' in navigator)||!window.isSecureContext){el.textContent='Unavailable here';if(btn)btn.textContent='Turn Off Offline Mode';return}
        if(offlineModeOff()){el.textContent='Off';if(btn)btn.textContent='Turn On Offline Mode';return}
        if(btn)btn.textContent='Turn Off Offline Mode';
        try{
            const regs=await navigator.serviceWorker.getRegistrations();
            const keys=window.caches?await caches.keys():[];
            const mine=keys.filter(k=>k.startsWith('wally-'));
            el.textContent=(regs.length&&mine.length)?('Ready \u2014 '+mine[0].replace('wally-','v')):
                           regs.length?'Installing\u2026':'Not saved yet';
        }catch(e){el.textContent='Unknown'}
    }
    // Roster names are free text. Escape them wherever one reaches innerHTML -- an
    // apostrophe (O'Brien) or a quote otherwise breaks the markup built around it.
    const escHTML=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function dateKeyFromTs(ts){const d=new Date(ts);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
