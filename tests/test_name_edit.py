"""Editing employee names after they are entered (v7.20).

1. Renaming a default-crew member keeps their roles. They had no stored flags, so the
   new name used to fall out of PS9_CORE / PS9_PERMANENT and was purged at End Shift.
2. Capitalization-only edits stick (Mcdonald -> McDonald). The old formatter lowercased
   every word, turned the edit back into the old name and silently did nothing.
3. Renaming onto an existing name is refused regardless of case.
4. The observation tracker follows a rename.
5. Editing a past log whose unloader is not on the team list keeps that name instead
   of blanking it.
"""
from _boot import boot
from playwright.sync_api import sync_playwright

STUB = """(answer)=>{window.__alerts=[];
  window.prompt=()=>answer; window.confirm=()=>false;
  window.alert=(m)=>{window.__alerts.push(String(m))};}"""

with sync_playwright() as p:
    b, pg, errs = boot(p)
    ok = True

    # 1. default crew rename keeps roles and survives the End Shift purge
    pg.evaluate("()=>{localStorage.removeItem('ps9_roster_flags')}")
    pg.evaluate(STUB, 'Robert Williams')
    pg.evaluate("()=>editTeamMember('Robert')")
    r = pg.evaluate("""()=>({core:isPS9Core('Robert Williams'),perm:isPermanentMember('Robert Williams'),
        removed:purgeTemporaryEmployees(),onTeam:teamNames.includes('Robert Williams'),
        oldGone:!teamNames.includes('Robert')})""")
    good = r['core'] and r['perm'] and r['onTeam'] and r['oldGone']
    ok &= good
    print(f'1. renamed default crew keeps PS9 + permanent and survives End Shift: {good}  {r}')

    # a temporary hire renamed stays temporary
    pg.evaluate("()=>{teamNames.push('Temp Guy');refreshTeamNamesSorted();saveTeam()}")
    pg.evaluate(STUB, 'Temp Person')
    pg.evaluate("()=>editTeamMember('Temp Guy')")
    t = pg.evaluate("()=>isPermanentMember('Temp Person')===false&&teamNames.includes('Temp Person')")
    ok &= t
    print(f'   renamed temporary hire stays temporary: {t}')

    # 2. capitalization-only edit sticks
    pg.evaluate("()=>{teamNames.push('Mcdonald');refreshTeamNamesSorted();saveTeam()}")
    pg.evaluate(STUB, 'McDonald')
    pg.evaluate("()=>editTeamMember('Mcdonald')")
    cap = pg.evaluate("()=>teamNames.includes('McDonald')&&!teamNames.includes('Mcdonald')")
    lower = pg.evaluate("()=>formatPersonName('  matt   r ')") == 'Matt R'
    ok &= cap and lower
    print(f'2. Mcdonald -> McDonald sticks: {cap}; all-lowercase input still title-cased: {lower}')

    # 3. renaming onto an existing name, different case, is refused
    pg.evaluate(STUB, 'maTT')
    pg.evaluate("()=>{teamNames.push('Someone');refreshTeamNamesSorted();saveTeam();editTeamMember('Someone')}")
    d = pg.evaluate("()=>({still:teamNames.includes('Someone'),alerts:window.__alerts.length,"
                    "matts:teamNames.filter(n=>n.toLowerCase()==='matt').length})")
    good = d['still'] and d['alerts'] == 1 and d['matts'] == 1
    ok &= good
    print(f'3. case-insensitive duplicate refused: {good}  {d}')

    # 4. observation assignments follow the rename
    pg.evaluate("()=>{obsState.assignments['2026-11-01']={name:'Matt',cycle:obsState.cycle,status:'done'};saveObsState()}")
    pg.evaluate(STUB, 'Matthew R')
    pg.evaluate("()=>editTeamMember('Matt')")
    o = pg.evaluate("()=>obsState.assignments['2026-11-01'].name")
    ok &= o == 'Matthew R'
    print(f'4. observation history follows the rename: {o == "Matthew R"}  ({o})')

    # 5. a log with an off-list unloader keeps it through an edit
    pg.evaluate("""()=>{const now=Date.now();historyLog.unshift({door:9,id:'W1',type:'Wally',unloader:'Visitor X',
        assistants:[],start:now-600000,laborStart:now-600000,end:now,dateKey:dateKeyFromTs(now),duration:600000,
        durationMinutes:10,statOffset:0,logId:'t1',completionHour:1,shiftKey:currentShiftKey(),cpuOptions:[],
        status:'completed'});saveHistory();openEditLogModal(0);confirmLogEdit()}""")
    u = pg.evaluate("()=>historyLog[0].unloader")
    ok &= u == 'Visitor X'
    print(f'5. editing a log keeps an off-team unloader: {u == "Visitor X"}  ({u!r})')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
