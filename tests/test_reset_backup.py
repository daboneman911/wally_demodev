"""Reset keeps the setup around the shift, and a backup round-trips everything."""
import json, os, tempfile
from _boot import boot
from playwright.sync_api import sync_playwright

SEED = """()=>{
  if(!teamNames.includes('Night Hire A'))teamNames.push('Night Hire A');
  refreshTeamNamesSorted();saveTeam();
  const k=(n)=>{const d=new Date();d.setDate(d.getDate()-n);return dateKeyFromTs(d.getTime())};
  obsState={assignments:{},cycle:3};
  obsState.assignments[k(2)]={name:'Robert W',status:'done',cycle:3};
  obsState.assignments[k(1)]={name:'Matt R',status:'done',cycle:3};
  saveObsState();
  checklistState={tasks:{presort:true,slide:true},shared:false};saveChecklistState();
  pphLog=[{ts:Date.now(),volume:5000,hrs:10,pph:500}];savePphLog();
  doors[9]={status:'active',start:Date.now(),laborStart:Date.now(),id:'99999',type:'Wally',
            unloader:'',unavailable:false,lastCompletionTime:null,assignments:[]};saveDoors();
  wallyNotes={'99999':{tags:[{value:'Heavy',type:'preset'}],history:[]}};saveNotes();
  saveShiftSchedule(Object.assign(getShiftSchedule(),{1:'21:30'}));
}"""

SNAP = """()=>({team:teamNames.length, nightHire:teamNames.includes('Night Hire A'),
  obsDays:Object.keys(obsState.assignments).length, cycle:obsState.cycle,
  checklist:Object.keys(checklistState.tasks).length, pph:pphLog.length,
  door9:doors[9]?doors[9].status:null, notes:Object.keys(wallyNotes||{}).length,
  monday:getShiftSchedule()[1]})"""

with sync_playwright() as p:
    b, pg, errs = boot(p)
    pg.on('dialog', lambda d: d.accept())
    ok = True

    pg.evaluate(SEED); pg.wait_for_timeout(300)
    before = pg.evaluate(SNAP)
    print('seeded:', before)
    dupe = pg.eval_on_selector_all('#restore-file-input', 'e=>e.length')
    ok &= dupe == 1
    print(f'restore input id is unique: {dupe == 1}')

    # ---- 1. reset keeps the setup, clears the night ----
    pg.evaluate("()=>resetData()")
    pg.wait_for_timeout(1200); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(600)
    after = pg.evaluate(SNAP)
    print('after reset:', after)

    kept = {'team': after['team'] == before['team'], 'night hire': after['nightHire'],
            'observation days': after['obsDays'] >= before['obsDays'],
            'observation cycle': after['cycle'] == 3,
            'notes': after['notes'] == before['notes'],
            'shift schedule': after['monday'] == '21:30'}
    cleared = {'trailers': after['door9'] in (None, 'empty'),
               'checklist': after['checklist'] == 0, 'volume log': after['pph'] == 0}
    for k, v in kept.items():
        print(f'  kept {k:<18} {v}'); ok &= v
    for k, v in cleared.items():
        print(f'  cleared {k:<15} {v}'); ok &= v

    # ---- 2. backup round-trip ----
    pg.evaluate(SEED); pg.wait_for_timeout(300)
    full = pg.evaluate(SNAP)
    out = tempfile.mkdtemp()
    with pg.expect_download() as dl:
        pg.evaluate("()=>exportBackup()")
    path = os.path.join(out, 'backup.json')
    dl.value.save_as(path)
    doc = json.load(open(path))
    must = ['ps9_team', 'ps9_observations', 'ps9_wally_notes', 'ps9_checklist',
            'ps9_pph_log', 'ps9_doors', 'ps9_shift_schedule']
    missing = [k for k in must if k not in doc['data']]
    ok &= doc['app'] == 'wally-dashboard' and doc['format'] == 1 and not missing
    print(f"\nbackup: {dl.value.suggested_filename}, v{doc['version']}, {len(doc['data'])} keys")
    print(f'   carries roster, observations, notes, checklist, volume, doors, schedule: {not missing}')
    if missing:
        print('   missing:', missing)

    # wipe the device completely, then restore
    pg.evaluate("()=>localStorage.clear()")
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(600)
    wiped = pg.evaluate(SNAP)
    print(f"after a full wipe: night hire={wiped['nightHire']}, cycle={wiped['cycle']}, monday={wiped['monday']}")
    ok &= not wiped['nightHire']

    pg.set_input_files('#restore-file-input', path)
    pg.wait_for_timeout(1500); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(700)
    back = pg.evaluate(SNAP)
    print('after restore:', back)
    # obsDays is expected to grow by one: the reload re-runs obsEnsureToday() and adds
    # today's pick on top of the restored history.
    fields = [k for k in full if k != 'obsDays']
    same = all(back[k] == full[k] for k in fields)
    seeded_back = pg.evaluate("""()=>{const k=(n)=>{const d=new Date();d.setDate(d.getDate()-n);
        return dateKeyFromTs(d.getTime())};
        return !!obsState.assignments[k(1)] && !!obsState.assignments[k(2)];}""")
    ok &= same and seeded_back and back['obsDays'] == full['obsDays'] + 1
    print(f'restore reproduces the device: {same}')
    print(f'   both seeded observation days came back: {seeded_back}')
    print(f"   plus today's pick re-added on load: {back['obsDays'] == full['obsDays'] + 1}")
    if not same:
        print('  differs:', {k: (full[k], back[k]) for k in fields if full[k] != back[k]})

    # ---- 3. junk and mismatched files are refused ----
    for name, body in [('not json', 'hello'),
                       ('wrong app', '{"app":"something-else","data":{}}'),
                       ('newer format', '{"app":"wally-dashboard","format":99,"data":{}}'),
                       ('damaged', '{"app":"wally-dashboard","format":1,"data":{"ps9_team":"{{{"}}')]:
        f = os.path.join(out, 'bad.json'); open(f, 'w').write(body)
        pg.set_input_files('#restore-file-input', f)
        pg.wait_for_timeout(500)
        survived = pg.evaluate("()=>teamNames.includes('Night Hire A')")
        ok &= survived
        print(f'  refused {name:<14} device untouched: {survived}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
