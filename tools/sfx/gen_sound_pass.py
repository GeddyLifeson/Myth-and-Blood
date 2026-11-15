"""Builds the third score: sapper blasts, dawn and last-breach cues, a theme per enemy faction,
and five more battle loops. Same layout rules as gen_music.py (120 bpm, 2 s per bar)."""
import json
import os
from gen_music import build, rep, REST_BAR, cue

def sixteenths(cell):
    """Four-note cell repeated to fill one bar of sixteenths."""
    return ' '.join([' '.join(f'{n}:1' for n in cell.split())] * 4)

def eighths(n):
    return ' '.join([f'{n}:2'] * 8)

# --------------------------------------------------------------------- sapper and banners
mine_blast = cue({
  'timp': 'fff| D2:4> p| D2:12t r:16',
  'tuba': 'fff| D1:6> r:10',
  'cb':   'ff| E1:4> r:12',
  'vc':   'ff| [D2,Eb2]:2> r:14',
  'tbn':  'ff| [E2,F2]:2> r:14',
})
satchel_blast = cue({
  'timp': 'ff| A2:2> D2:2> r:12',
  'vln':  'ff| [C#5,D5]:1> r:15',
  'tbn':  'ff| [A2,Bb2]:2> r:14',
  'cb':   'f| A1:2> r:14',
})
fuse_hiss = cue({
  'vln':  'pp| [G6,Ab6]:12t r:4',
  'vc':   'pp| [C#4,D4]:8t r:8',
})
dawn_horn = cue({
  'horn': 'mp| D4:4 A4:12 mf| A4:16',
  'harp': 'p| r:8 D4:2 F#4:2 A4:2 D5:2 F#5:16',
  'timp': 'pp| D2:16t p| A2:8t r:8',
  'cb':   'p| D2:16 D2:16',
})
last_breach = cue({
  'glock':'f| C#6:8 r:8 C#6:8 r:8',
  'horn': 'ff| A3:4> r:4 A3:4> r:4 Bb3:16>',
  'cb':   'f| [D2,Eb2]:16t [D2,Eb2]:16t',
  'timp': 'f| D2:16t r:16',
})

# ------------------------------------------------------------------------- faction themes
faction_goblin = cue({
  'harp': 'mf| D4:1 Eb4:1 D4:1 C#4:1 D4:2 r:2 F4:1 E4:1 Eb4:1 D4:1 A3:2 r:2 D4:1 Eb4:1 F4:1 Gb4:1 A4:2 Ab4:2 G4:4 r:4',
  'glock':'mp| r:12 D6:1 r:3 r:8 Ab6:2 r:6',
  'vc':   'mf| D3:2 r:2 A2:2 r:2 D3:2 r:2 Ab2:2 r:2 D3:2 r:6 D2:2> r:6',
})
faction_orc = cue({
  'tbn':  'ff| D3:6> D3:2 F3:4 D3:4 C3:6> Bb2:2 A2:8>',
  'tuba': 'ff| D2:6> D2:2 F2:4 D2:4 C2:6> Bb1:2 A1:8>',
  'timp': 'ff| D2:4> D2:4 D2:2 D2:2 A2:4> D2:4> D2:4 A2:8>',
  'cb':   'f| D2:16t A1:16t',
})
faction_dark = cue({
  'cb':   'p| [D2,Eb2]:16t mp| [D2,Eb2]:16t',
  'vc':   'p| [F2,Gb2]:16t mp| [F2,Ab2]:16t',
  'vln':  'pp| [D6,Eb6]:16t [D6,Eb6]:8t r:8',
  'horn': 'mf| r:8 D3:8 Eb3:12 D3:4',
})
faction_void = cue({
  'glock':'p| F6:4 r:4 B6:4 r:4 E6:8 r:8',
  'vln':  'pp| [B5,C6]:16t [B5,F6]:16t',
  'cb':   'pp| E1:16 E1:16',
  'harp': 'mp| r:8 B2:2 F3:2 C4:2 Gb4:2 r:16',
})
faction_wild = cue({
  'horn': 'f| A3:3 D4:1 F4:3 A4:1 A4:4 G4:2 F4:2 E4:3 D4:1 C#4:4 D4:8',
  'timp': 'mf| D2:3 D2:1 D2:3 D2:1 A2:4 A2:4 D2:3 D2:1 A2:4 D2:8',
  'cb':   'mf| D2:4 r:4 A1:4 r:4 D2:4 A1:4 D2:8',
})
faction_cinder = cue({
  'vln':  'f| D5:1 E5:1 F5:1 G5:1 A5:1 Bb5:1 C6:1 D6:1 [D6,A6]:8t ff| C#6:1 D6:1 E6:1 F6:1 G6:1 A6:1 Bb6:1 A6:1 [A5,A6]:8>',
  'tbn':  'f| r:8 [D3,A3]:8> [Eb3,Bb3]:8> [D3,A3]:8>',
  'timp': 'f| r:8 D2:8t A2:8t D2:4> r:4',
})
faction_mirror = cue({
  'harp': 'mf| D4:2 F4:2 A4:2 D5:2 D5:2 A4:2 F4:2 D4:2 Bb3:2 D4:2 F4:2 Bb4:2 A4:8',
  'horn': 'mf| D4:8 A3:8 Bb3:8 A3:8',
  'vc':   'mf| r:8 D3:8 A2:8 Bb2:4 A2:4',
  'glock':'p| r:16 r:8 A5:8',
})

# ---------------------------------------------------------------------------- loops (16 bars)
night = {
  'cb':   'pp| ' + rep('D2:16', 4) + ' ' + rep('Bb1:16', 2) + ' ' + rep('A1:16', 2) + ' ' + rep('D2:16', 4) + ' G1:16 G1:16 A1:16 A1:16',
  'vc':   'p| ' + rep('[A2,F3]:16', 4) + ' [Bb2,F3]:16 [Bb2,D3]:16 [A2,E3]:16 [A2,C#3]:16 ' + rep('[A2,F3]:16', 4) + ' [G2,D3]:16 [G2,Bb2]:16 [A2,E3]:16 [A2,C#3]:16',
  'harp': 'p| ' + rep('D3:2 A3:2 F4:4 r:8 r:16', 8),
  'horn': rep(REST_BAR, 4) + ' mp| A3:8 D4:8 F4:12 E4:4 D4:16 r:16 F4:8 E4:8 D4:8 C#4:8 D4:16 r:16 ' + rep(REST_BAR, 4),
  'timp': rep(REST_BAR, 7) + ' pp| D2:16t ' + rep(REST_BAR, 7) + ' D2:16t',
  'vln':  rep(REST_BAR, 8) + ' pp| ' + rep('A5:16t', 4) + ' ' + rep(REST_BAR, 4),
}

mid_ost = ' '.join(sixteenths(c) for c in ['D3 D3 A3 D3', 'C3 C3 G3 C3', 'Bb2 Bb2 F3 Bb2', 'A2 A2 E3 A2'])
siege_mid = {
  'vc':   'f| ' + rep(mid_ost, 4),
  'cb':   'f| ' + rep('D2:4> D2:4 D2:4 D2:4 C2:4> C2:4 C2:4 C2:4 Bb1:4> Bb1:4 Bb1:4 Bb1:4 A1:4> A1:4 A1:4 A1:4', 4),
  'timp': 'mf| ' + rep('D2:4> r:4 D2:2 D2:2 r:4 r:16 r:16 A2:4> r:4 A2:2 A2:2 A2:4', 4),
  'horn': 'mf| D4:8 F4:8 E4:8 G4:8 F4:12 D4:4 E4:16 D4:8 F4:8 A4:8 G4:4 F4:4 F4:8 E4:4 D4:4 C#4:16 '
          'ff| A4:8 F4:8 G4:8 E4:8 F4:8 D4:8 C#4:16 A4:8 Bb4:4 A4:4 G4:8 E4:8 F4:4 E4:4 D4:4 C4:4 C#4:16',
  'tbn':  rep(REST_BAR, 8) + ' f| ' + rep('[D3,A3]:2> r:6 [D3,A3]:2> r:6 [C3,G3]:2> r:6 [C3,G3]:2> r:6 [Bb2,F3]:2> r:6 [Bb2,F3]:2> r:6 [A2,E3]:2> r:6 [A2,C#3]:2> r:6', 2),
  'vln':  rep(REST_BAR, 8) + ' mf| ' + rep('A5:16t G5:16t F5:16t E5:16t', 2),
}

late_roots = ['D3', 'Eb3', 'D3', 'C3', 'Bb2', 'Eb3', 'A2', 'A2']
siege_late = {
  'cb':   'ff| ' + rep('D2:16t Eb2:16t D2:16t C2:16t Bb1:16t Eb2:16t A1:16t A1:16t', 2),
  'vc':   'ff| ' + rep(' '.join(eighths(n) for n in late_roots), 2),
  'tuba': 'ff| ' + rep('D2:4> r:4 D2:4> r:4 Eb2:4> r:4 Eb2:4> r:4 D2:4> r:4 D2:4> r:4 C2:4> r:4 C2:4> r:4 '
                       'Bb1:4> r:4 Bb1:4> r:4 Eb2:4> r:4 Eb2:4> r:4 A1:4> r:4 A1:4> r:4 A1:8> A1:8>', 2),
  'tbn':  'ff| ' + rep('[D3,A3]:12> [D3,A3]:4 [Eb3,Bb3]:12> [Eb3,Bb3]:4 [D3,A3]:12> [D3,F3]:4 [C3,G3]:16> '
                       '[Bb2,F3]:12> [Bb2,D3]:4 [Eb3,G3]:16> [A2,E3]:8> [A2,C#3]:8> [A2,E3]:16>', 2),
  'timp': 'ff| ' + rep('D2:2> D2:2 D2:2 D2:2 A2:4> D2:4>', 16),
  'horn': 'ff| A4:8 D5:8 C5:6 Bb4:2 A4:8 Bb4:12 A4:4 G4:16 F4:8 G4:4 A4:4 Bb4:8 C5:8 A4:16 A4:16 '
          'D5:8 C5:8 Bb4:8 A4:8 G4:8 Bb4:8 A4:16 F4:8 E4:8 D4:16 E4:16 r:16',
  'vln':  'f| ' + rep('D6:16t Eb6:16t D6:16t C6:16t Bb5:16t Eb6:16t A5:16t A5:16t', 2),
}

horde = {
  'timp': 'ff| ' + rep('D2:2> D2:1 D2:1 D2:2 D2:2 A2:2> A2:1 A2:1 A2:2 A2:2', 16),
  'tuba': 'ff| ' + rep('D2:2> r:6 D2:2> r:2 Eb2:2> r:2', 16),
  'tbn':  rep(REST_BAR, 4) + ' ff| ' + rep('[D3,Ab3]:2> r:2 [D3,Ab3]:2> r:10 [D3,A3]:12> r:4', 6),
  'cb':   'f| ' + rep('D2:16t', 8) + ' ' + rep('Eb2:16t D2:16t', 4),
  'vc':   rep(REST_BAR, 8) + ' ff| ' + rep('D3:2 D3:2 F3:2 D3:2 Ab3:2 G3:2 F3:2 Eb3:2', 8),
  'horn': rep(REST_BAR, 8) + ' ff| ' + rep('D4:4> r:4 Ab4:4> r:4 G4:8> F4:4 Eb4:4 D4:16', 2) + ' ' + rep(REST_BAR, 2),
}

last_stand = {
  'vln':  'mf| ' + rep('[A5,D6]:16t [Bb5,D6]:16t [A5,C#6]:16t [A5,C#6]:16t', 4),
  'vc':   'mf| ' + rep('[D3,F3]:16t [D3,G3]:16t [E3,A3]:16t [C#3,A3]:16t', 4),
  'cb':   'f| ' + rep('D2:16 G1:16 A1:16 A1:16', 4),
  'timp': 'f| ' + rep('D2:8> r:8', 12) + ' ' + rep('D2:4> D2:4 A2:8>', 4),
  'horn': rep(REST_BAR, 4) + ' f| D4:12 E4:4 F4:8 G4:8 A4:16 A4:16 Bb4:8 A4:8 G4:8 F4:8 E4:16 E4:16 '
          'ff| D5:12 C5:4 Bb4:8 A4:8 G4:8 F4:4 E4:4 D4:16',
  'tbn':  rep(REST_BAR, 12) + ' ff| [D3,F3]:16 [D3,G3]:16 [E3,A3]:16 [C#3,A3]:16',
}

PIECES = [
  ('mine_blast', mine_blast, 4, 0, False),
  ('satchel_blast', satchel_blast, 4, 0, False),
  ('fuse_hiss', fuse_hiss, 4, 0, False),
  ('dawn_horn', dawn_horn, 4, 0, False),
  ('last_breach', last_breach, 4, 0, False),
  ('faction_goblin', faction_goblin, 4, 0, False),
  ('faction_orc', faction_orc, 4, 0, False),
  ('faction_dark', faction_dark, 4, 0, False),
  ('faction_void', faction_void, 4, 0, False),
  ('faction_wild', faction_wild, 4, 0, False),
  ('faction_cinder', faction_cinder, 4, 0, False),
  ('faction_mirror', faction_mirror, 4, 0, False),
  ('music_night', night, 16, 2, True),
  ('music_siege_mid', siege_mid, 16, 2, True),
  ('music_siege_late', siege_late, 16, 2, True),
  ('music_horde', horde, 16, 2, True),
  ('music_last_stand', last_stand, 16, 2, True),
]

if __name__ == '__main__':
    xml, layout = build(PIECES, 'Myth and Blood sound pass')
    open('myth_and_blood_pass.musicxml', 'w', encoding='utf-8').write(xml)
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, 'pass.json'), 'w', newline='\n') as f:
        json.dump({'bpm': 120, 'pieces': layout}, f, indent=2)
        f.write('\n')
    print('pieces:', len(layout), 'seconds:', (layout[-1]['startBar'] + layout[-1]['bars']) * 2)
