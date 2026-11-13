"""Builds one MusicXML score with the Myth and Blood music loops and a second set of cues.
Each piece is followed by silent bars so reverb tails are captured. Tempo 120, 2 s per bar."""
import json
from gen_cues import PARTS, note, R, BAR_REST, DIV

def line(spec):
    """'f| D2:4> A2:2 r:2 [D3,A3]:8t' -> list of bars (each a string summing to 16).
    Flags after the duration: t = tremolo, > = accent. A leading 'dyn|' sets a dynamic on the next note."""
    bars, cur, total, dyn = [], '', 0, None
    for tok in spec.split():
        if tok == '|':
            continue
        if tok.endswith('|') and tok[:-1] in ('pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'):
            dyn = tok[:-1]
            continue
        head, rest = tok.rsplit(':', 1)
        trem = 't' in rest
        acc = '>' in rest
        dur = int(rest.replace('t', '').replace('>', ''))
        pitches = [] if head == 'r' else head.strip('[]').split(',')
        cur += note(pitches, dur, dyn, trem=trem, accent=acc)
        dyn = None
        total += dur
        assert total <= 16, f'bar overflow near {tok} in: {spec[:60]}'
        if total == 16:
            bars.append(cur)
            cur, total = '', 0
    assert total == 0, f'incomplete bar ({total}/16) in: {spec[:60]}'
    return bars

def rep(spec, n):
    return ' '.join([spec] * n)

REST_BAR = 'r:16'

# ------------------------------------------------------------------ menu theme (16 bars)
menu = {
  'vc':   'p| ' + rep('D3:8 A2:8 Bb2:8 A2:8 G2:8 A2:8 D2:16', 2) + ' mf| ' + rep('D3:8 A2:8 Bb2:8 A2:8 G2:8 A2:8 D2:16', 2),
  'cb':   'p| ' + rep('D2:16 Bb1:16 G1:16 D2:16', 2) + ' mf| ' + rep('D2:16 Bb1:16 G1:16 D2:16', 2),
  'harp': 'mp| ' + rep('D3:2 A3:2 D4:2 F4:2 A4:2 F4:2 D4:2 A3:2 Bb2:2 F3:2 Bb3:2 D4:2 F4:2 D4:2 Bb3:2 F3:2 G2:2 D3:2 G3:2 Bb3:2 D4:2 Bb3:2 G3:2 D3:2 D3:2 A3:2 D4:2 F4:2 A4:8', 4),
  'horn': rep(REST_BAR, 4) + ' mf| A3:8 D4:8 F4:12 E4:4 D4:8 Bb3:8 A3:16 f| D4:8 F4:8 A4:12 G4:4 F4:8 E4:8 D4:16 ff| A4:8 G4:8 F4:12 E4:4 D4:8 C#4:8 D4:16',
  'vln':  rep(REST_BAR, 8) + ' pp| ' + rep('A5:16t', 4) + ' f| D5:8 F5:8 A5:16 G5:8 E5:8 D5:16',
  'timp': rep(REST_BAR, 12) + ' mp| D2:16t mf| A2:16t f| D2:16t ff| D2:4> r:12',
  'tbn':  rep(REST_BAR, 12) + ' f| [D3,A3]:16 [D3,F3]:16 [Bb2,G3]:8 [A2,E3]:8 [D3,A3]:16',
  'tuba': rep(REST_BAR, 12) + ' f| D2:16 D2:16 G1:8 A1:8 D2:16',
}

# ------------------------------------------------------------------ siege loop (16 bars)
ost_lo = 'D2:2 D2:2 F2:2 D2:2 G2:2 D2:2 F2:2 E2:2 D2:2 D2:2 F2:2 D2:2 A2:2 G2:2 F2:2 E2:2 Bb1:2 Bb1:2 D2:2 Bb1:2 C2:2 C2:2 E2:2 C2:2 A1:2 A1:2 C#2:2 A1:2 E2:2 A1:2 C#2:2 E2:2'
ost_hi = 'D3:2 D3:2 F3:2 D3:2 G3:2 D3:2 F3:2 E3:2 D3:2 D3:2 F3:2 D3:2 A3:2 G3:2 F3:2 E3:2 Bb2:2 Bb2:2 D3:2 Bb2:2 C3:2 C3:2 E3:2 C3:2 A2:2 A2:2 C#3:2 A2:2 E3:2 A2:2 C#3:2 E3:2'
timp_ph = 'D2:4> D2:2 D2:2 A2:4> D2:2 D2:2 D2:4> D2:2 D2:2 A2:4> D2:2 D2:2 D2:4> D2:2 D2:2 A2:4> D2:2 D2:2 A2:2 A2:2 A2:2 A2:2 A2:1 A2:1 A2:1 A2:1 A2:4>'
stab_ph = '[D3,A3]:2> r:6 [D3,A3]:2> r:6 [D3,A3]:2> r:6 [D3,A3]:2> r:6 [Bb2,F3]:2> r:6 [Bb2,F3]:2> r:6 [A2,E3]:2> r:6 [A2,E3]:2> r:6'
siege = {
  'cb':   'f| ' + rep(ost_lo, 4),
  'vc':   'f| ' + rep(ost_hi, 4),
  'timp': 'f| ' + rep(timp_ph, 4),
  'tbn':  rep(REST_BAR, 4) + ' f| ' + rep(stab_ph, 3),
  'tuba': rep(REST_BAR, 8) + ' f| ' + rep('D2:16 D2:16 Bb1:16 A1:16', 2),
  'horn': rep(REST_BAR, 8) + ' f| D4:6 F4:2 A4:8 G4:6 F4:2 E4:8 F4:6 D4:2 Bb3:8 A3:12 C#4:4 ff| D4:4 F4:4 A4:4 D5:4 C5:6 A4:2 G4:8 F4:4 G4:4 Bb4:8 A4:16',
  'vln':  rep(REST_BAR, 4) + ' mp| ' + rep('D5:16t D5:16t D5:16t C#5:16t', 3),
}

# ------------------------------------------------------------------- boss loop (16 bars)
riff_lo = 'D2:3 D2:1 Eb2:4 D2:3 D2:1 F2:4 D2:3 D2:1 Eb2:4 Ab2:4 G2:4'
riff_hi = '[D3,A3]:3 [D3,A3]:1 [Eb3,Bb3]:4 [D3,A3]:3 [D3,A3]:1 [F3,C4]:4 [D3,A3]:3 [D3,A3]:1 [Eb3,Bb3]:4 [Ab3,Eb4]:4 [G3,D4]:4'
boss = {
  'tuba': 'ff| ' + rep(riff_lo, 8),
  'tbn':  'ff| ' + rep(riff_hi, 8),
  'timp': 'f| ' + rep('D2:1 D2:1 D2:1 D2:1 D2:1 D2:1 D2:1 D2:1 D2:2 D2:2 A2:4>', 16),
  'cb':   'f| ' + rep('D2:16t', 16),
  'vc':   'f| ' + rep(riff_lo.replace('2:', '3:'), 8),
  'horn': rep(REST_BAR, 4) + ' ff| ' + rep('[Eb4,A3]:8> r:8 [D4,Ab3]:8> r:8 [F4,B3]:12> r:4 [E4,Bb3]:16', 3),
  'vln':  'mf| ' + rep('A5:16t Bb5:16t A5:16t Ab5:16t', 3) + ' ff| D6:8 C#6:8 C6:8 B5:8 Bb5:8 A5:8 Ab5:16t',
}

# --------------------------------------------------------------------- cues (4 bars each)
def cue(parts):
    return {k: v + ' ' + rep(REST_BAR, 4 - len(line(v))) if len(line(v)) < 4 else v for k, v in parts.items()}

victory = cue({
  'horn': 'ff| D4:2 D4:2 D4:4 A4:8 [D5,A4,F#4]:16',
  'tbn':  'ff| [D3,A3]:8 [D3,A3]:8 [D3,F#3,A3]:16',
  'tuba': 'ff| D2:16 D2:16',
  'timp': 'ff| D2:2 D2:2 D2:4> A2:8t D2:16t',
  'glock':'f| r:8 D6:4 F#6:4 A6:16',
})
ribbon = cue({
  'harp': 'f| D4:2 F#4:2 A4:2 D5:2 F#5:8 r:16',
  'glock':'mf| r:8 A5:4 D6:4 F#6:8 r:8',
  'horn': 'mf| r:8 [D4,A3]:8 [D4,F#4]:8 r:8',
})
fallen = cue({
  'vc':   'mp| A3:8 F3:8 D3:16',
  'cb':   'p| D2:16 D2:16',
  'vln':  'pp| r:16 D5:16',
})
nightfall = cue({
  'cb':   'p| D2:16 D2:16',
  'vc':   'p| [A2,D3]:16 [A2,F3]:16',
  'harp': 'mp| D4:4 A3:4 F3:4 D3:4 r:16',
  'vln':  'pp| A5:16t A5:16t',
})
runner = cue({
  'horn': 'ff| A4:2> A4:2> r:4 A4:2> A4:2> r:4',
  'timp': 'f| A2:2 A2:2 r:12',
})
horde = cue({
  'tuba': 'f| D2:8 Eb2:8 D2:16',
  'tbn':  'f| [D3,Ab3]:16 [D3,A3]:16',
  'timp': 'mf| D2:16t f| D2:8t D2:4> r:4',
  'cb':   'f| D2:16t D2:16t',
})

PIECES = [
  ('music_menu', menu, 16, 2, True),
  ('music_siege', siege, 16, 2, True),
  ('music_boss', boss, 16, 2, True),
  ('victory_fanfare', victory, 4, 0, False),
  ('ribbon_earned', ribbon, 4, 0, False),
  ('veteran_fallen', fallen, 4, 0, False),
  ('nightfall', nightfall, 4, 0, False),
  ('runner_alarm', runner, 4, 0, False),
  ('horde_warning', horde, 4, 0, False),
]

def build():
    ids = list(PARTS)
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
           '<score-partwise version="4.0"><work><work-title>Myth and Blood music</work-title></work><part-list>']
    for i, k in enumerate(ids, 1):
        name, prog, _, snd = PARTS[k]
        out.append(f'<score-part id="P{i}"><part-name>{name}</part-name><score-instrument id="P{i}-I1"><instrument-name>{name}</instrument-name><instrument-sound>{snd}</instrument-sound></score-instrument><midi-instrument id="P{i}-I1"><midi-channel>{i if i < 10 else i + 1}</midi-channel><midi-program>{prog}</midi-program></midi-instrument></score-part>')
    out.append('</part-list>')
    layout, bar0 = [], 0
    for name, parts, bars, tail, loop in PIECES:
        layout.append({'name': name, 'startBar': bar0, 'bars': bars, 'tailBars': tail, 'loop': loop,
                       'start': bar0 * 2, 'seconds': bars * 2, 'tailSeconds': tail * 2})
        bar0 += bars + tail
    for i, k in enumerate(ids, 1):
        _, _, (sign, ln), _ = PARTS[k]
        out.append(f'<part id="P{i}">')
        m = 0
        for name, parts, bars, tail, loop in PIECES:
            got = line(parts[k]) if k in parts else []
            assert len(got) <= bars, f'{name}/{k}: {len(got)} bars > {bars}'
            got = got + [BAR_REST] * (bars - len(got) + tail)
            for b, bar in enumerate(got):
                m += 1
                attrs = ''
                if m == 1:
                    attrs = f'<attributes><divisions>{DIV}</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>{sign}</sign><line>{ln}</line></clef></attributes>'
                    if i == 1:
                        attrs += '<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type><sound tempo="120"/></direction>'
                label = f'<direction placement="above"><direction-type><rehearsal>{name}</rehearsal></direction-type></direction>' if b == 0 and i == 1 else ''
                out.append(f'<measure number="{m}">{attrs}{label}{bar}</measure>')
        out.append('</part>')
    out.append('</score-partwise>')
    return '\n'.join(out), layout

if __name__ == '__main__':
    xml, layout = build()
    open('myth_and_blood_music.musicxml', 'w', encoding='utf-8').write(xml)
    json.dump({'bpm': 120, 'pieces': layout}, open('music.json', 'w'), indent=2)
    print('bars:', layout[-1]['startBar'] + layout[-1]['bars'], 'seconds:', (layout[-1]['startBar'] + layout[-1]['bars']) * 2)
    for p in layout:
        print(f"  {p['name']:16s} start {p['start']:4d}s  {p['seconds']}s  loop={p['loop']}")
