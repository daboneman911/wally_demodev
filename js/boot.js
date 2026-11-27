// Wally Dashboard -- Boot: runs init() on DOMContentLoaded.
// Loaded as a classic script from index.html; all files share one global scope.

    // -- Boot: wrapped in DOMContentLoaded for reliable cross-browser execution --
    // Guarantees full DOM is parsed before init() runs, regardless of CDN timing.
    document.addEventListener('DOMContentLoaded', function() {
        try{
            init();
            htLoadState();
            htSyncDOPButtons();
            reportLoadIssues();
        }catch(err){
            showRecoveryScreen(err);
        }
    });
