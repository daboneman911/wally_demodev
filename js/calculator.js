// Wally Dashboard -- Methods sheet, PPH calculator and PPH upload.
// Loaded as a classic script from index.html; all files share one global scope.

    function openMethods(){byId('methods-modal').style.display='flex'}
    // Expected packages-per-hour the calculator measures against.
    const PPH_TARGET=500;
    function openPPHCalculator(){const tl=byId('pph-target-lbl');if(tl)tl.textContent=PPH_TARGET;byId('pph-volume').value='';byId('pph-hours').value='';byId('pph-result').innerText='0';byId('pph-diff').innerText='0.00 hrs';byId('pph-diff').style.background='var(--border)';byId('pph-diff').style.color='var(--text-main)';byId('pph-modal').style.display='flex'}
    function calculatePPH(){
        const vol=parseFloat(byId('pph-volume').value),hrs=parseFloat(byId('pph-hours').value),
              resEl=byId('pph-result'),diffEl=byId('pph-diff');
        diffEl.classList.remove('under','over');
        if(isNaN(vol)||isNaN(hrs)||hrs<=0){resEl.innerText='0';diffEl.innerText='0.00 hrs';return}
        resEl.innerText=Math.round(vol/hrs);
        const diff=hrs-(vol/PPH_TARGET);
        diffEl.innerText=(diff>0?'+'+diff.toFixed(2):diff.toFixed(2))+' hrs';
        diffEl.classList.add(diff<=0?'under':'over')}
    const PPH_PUSH_LABEL='Push to Sheets';
    let pphPushTimer=null;
    function uploadPPH(){
        const vol=parseFloat(byId('pph-volume').value),hrs=parseFloat(byId('pph-hours').value);
        if(isNaN(vol)||isNaN(hrs)||hrs<=0)return alert("Please enter valid volume and hours first.");
        const pph=Math.round(vol/hrs),diff=(hrs-vol/PPH_TARGET).toFixed(2);
        attemptWebhook({dataType:'PPH_UPLOAD',dateKey:dateKeyFromTs(Date.now()),shiftStart:getShiftStartTime(),volume:vol,hours:hrs,pph:pph,diffHours:diff});
        // Restore from a fixed label, not the button's current text -- reading the current
        // text meant a second tap within the window captured "Pushed!" as the original and
        // the button never went back.
        const btn=byId('pph-push-btn');
        btn.textContent='Pushed!';btn.classList.add('pph-pushed');
        clearTimeout(pphPushTimer);
        pphPushTimer=setTimeout(()=>{btn.textContent=PPH_PUSH_LABEL;btn.classList.remove('pph-pushed')},2000)}
