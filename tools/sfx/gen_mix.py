"""Builds the fourth score: cues for events that shared one sound before (boss death, the General
falling, a building collapsing, thunder, promotions, era change, doctrines, a hero hired).
Same layout rules as gen_music.py (120 bpm, 2 s per bar, four bars per cue)."""
import json
import os
from gen_music import build, cue

boss_death = cue({
  'timp': 'fff| D2:4> A1:4> D2:8t mf| D2:16t p| D2:8t r:8',
  'tbn':  'fff| [D3,A3]:8> [C3,G3]:8> ff| [Bb2,F3]:16> mf| [A2,E3]:16',
  'tuba': 'fff| D2:8> C2:8> ff| Bb1:16 mf| A1:16',
  'horn': 'ff| r:8 A4:8 G4:8 F4:8 mf| E4:16 D4:16',
  'cb':   'ff| D2:16t Bb1:16t A1:16t p| D1:16t',
})
general_down = cue({
  'horn': 'f| D4:12 C4:4 Bb3:16 mp| A3:16',
  'vc':   'mf| [D3,F3]:16 [Bb2,D3]:16 p| [A2,C#3]:16',
  'cb':   'mf| D2:16 Bb1:16 p| A1:16',
  'timp': 'p| D2:16t pp| D2:16t',
  'harp': 'p| r:8 D3:2 F3:2 A3:4 r:16 D3:16',
})
building_collapse = cue({
  'timp': 'fff| A1:2> D2:2> A1:12t mf| A1:8t r:8',
  'tuba': 'fff| [D1]:4> r:12',
  'cb':   'ff| [D1,Eb1]:16t mp| [D1,Eb1]:8t r:8',
  'vc':   'ff| [D2,Eb2]:2> [Ab2,A2]:2> r:12',
  'tbn':  'ff| r:2 [Eb2,E2]:4> r:10',
})
thunder = cue({
  'timp': 'f| A1:2> ff| D2:2t D2:12t mf| D2:16t p| D2:8t r:8',
  'cb':   'mf| [D1,Eb1]:16t p| [D1,Eb1]:16t',
  'tuba': 'f| D1:4> r:12',
})
promotion = cue({
  'horn': 'mf| D4:2 A4:2 D5:12',
  'harp': 'mf| D4:1 F#4:1 A4:1 D5:1 F#5:12',
  'glock':'mp| r:4 A6:12',
})
era_fanfare = cue({
  'horn': 'ff| D4:2 D4:2 A4:4 D5:8 C5:4 A4:4 D5:8',
  'tbn':  'f| [D3,A3]:8 [F3,A3]:8 [C3,G3]:8 [D3,A3]:8',
  'tuba': 'f| D2:8 F2:8 C2:8 D2:8',
  'timp': 'f| D2:4> D2:4 A2:8 D2:4> A2:4 D2:8t',
})
doctrine = cue({
  'tbn':  'mf| [D3,A3]:8 [Bb2,F3]:8 [A2,E3]:16',
  'vc':   'mf| D3:4 F3:4 Bb3:8 A3:16',
  'timp': 'mf| D2:4> r:12 A2:8t D2:4> r:4',
})
hero_recruit = cue({
  'horn': 'f| A3:2 D4:2 F#4:4 A4:8 A4:16',
  'harp': 'mf| r:4 D4:2 A4:2 D5:8 F#5:16',
  'cb':   'mf| D2:16 D2:16',
  'timp': 'mf| D2:4> r:4 A2:4 D2:4 D2:16t',
})

PIECES = [
  ('boss_death', boss_death, 4, 0, False),
  ('general_down', general_down, 4, 0, False),
  ('building_collapse', building_collapse, 4, 0, False),
  ('thunder', thunder, 4, 0, False),
  ('promotion', promotion, 4, 0, False),
  ('era_fanfare', era_fanfare, 4, 0, False),
  ('doctrine', doctrine, 4, 0, False),
  ('hero_recruit', hero_recruit, 4, 0, False),
]

if __name__ == '__main__':
    xml, layout = build(PIECES, 'Myth and Blood mix pass')
    open('myth_and_blood_mix.musicxml', 'w', encoding='utf-8').write(xml)
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, 'mix.json'), 'w', newline='\n') as f:
        json.dump({'bpm': 120, 'pieces': layout}, f, indent=2)
        f.write('\n')
    print('pieces:', len(layout), 'seconds:', (layout[-1]['startBar'] + layout[-1]['bars']) * 2)
