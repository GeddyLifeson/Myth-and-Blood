"""Builds one MusicXML score holding every Myth and Blood cue, 4 bars (8 s at 120 bpm) apiece.
Open it in MuseScore Studio, export audio, and the game's build splits it by time."""
DIV = 4  # divisions per quarter; a bar is 16
STEP = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

def pitch_xml(p):
    # p like 'D3', 'Bb2', 'F#4'
    step = p[0]; rest = p[1:]
    alter = 0
    if rest[0] == 'b': alter = -1; rest = rest[1:]
    elif rest[0] == '#': alter = 1; rest = rest[1:]
    a = f"<alter>{alter}</alter>" if alter else ""
    return f"<pitch><step>{step}</step>{a}<octave>{rest}</octave></pitch>"

TYPES = {16: 'whole', 12: 'half', 8: 'half', 6: 'quarter', 4: 'quarter', 3: 'eighth', 2: 'eighth', 1: '16th'}
DOTTED = {12, 6, 3}

def note(pitches, dur, dyn=None, trem=False, tie=None, accent=False):
    """pitches: list of pitch names (chord) or [] for a rest."""
    out = []
    if dyn:
        out.append(f'<direction placement="below"><direction-type><dynamics><{dyn}/></dynamics></direction-type><sound dynamics="{ {"pp":36,"p":49,"mp":64,"mf":80,"f":96,"ff":112,"fff":127}[dyn] }"/></direction>')
    t = TYPES[dur]; dot = '<dot/>' if dur in DOTTED else ''
    if not pitches:
        out.append(f'<note><rest/><duration>{dur}</duration><voice>1</voice><type>{t}</type>{dot}</note>')
        return ''.join(out)
    for i, p in enumerate(pitches):
        chord = '<chord/>' if i else ''
        ties = ''; tied = ''
        if tie in ('start', 'both'): ties += '<tie type="start"/>'; tied += '<tied type="start"/>'
        if tie in ('stop', 'both'): ties = '<tie type="stop"/>' + ties; tied = '<tied type="stop"/>' + tied
        nots = ''
        orn = '<ornaments><tremolo type="single">3</tremolo></ornaments>' if trem else ''
        art = '<articulations><accent/></articulations>' if accent else ''
        if tied or orn or art: nots = f'<notations>{tied}{orn}{art}</notations>'
        out.append(f'<note>{chord}{pitch_xml(p)}<duration>{dur}</duration>{ties}<voice>1</voice><type>{t}</type>{dot}{nots}</note>')
    return ''.join(out)

R = lambda d: note([], d)
BAR_REST = R(16)

# name: (display, midi program 1-based, clef sign/line, instrument-sound)
PARTS = {
    'horn': ('Horn in F', 61, ('G', 2), 'brass.french-horn'),
    'tbn': ('Trombone', 58, ('F', 4), 'brass.trombone'),
    'tuba': ('Tuba', 59, ('F', 4), 'brass.tuba'),
    'timp': ('Timpani', 48, ('F', 4), 'drum.timpani'),
    'harp': ('Harp', 47, ('G', 2), 'pluck.harp'),
    'glock': ('Glockenspiel', 10, ('G', 2), 'pitched-percussion.glockenspiel'),
    'vln': ('Violins', 49, ('G', 2), 'strings.violin'),
    'vc': ('Violoncellos', 49, ('F', 4), 'strings.cello'),
    'cb': ('Contrabasses', 49, ('F', 4), 'strings.contrabass'),
}

# Each cue: {part: [bar1, bar2, bar3, bar4]} — missing parts rest. Bars are strings of notes summing to 16.
N = note
CUES = [
  ('breach_horn', {
    'horn': [N(['D4','A3'],12,'ff',accent=True)+R(4), N(['Bb3','F3'],16,'ff',accent=True), BAR_REST, BAR_REST],
    'tbn':  [N(['D3'],12,'ff',accent=True)+R(4), N(['Bb2'],16,'ff',accent=True), BAR_REST, BAR_REST],
    'tuba': [N(['D2'],12,'ff')+R(4), N(['Bb1'],16,'ff'), BAR_REST, BAR_REST],
    'timp': [N(['D2'],4,'ff',accent=True)+R(12), N(['D2'],4,'ff',accent=True)+R(12), BAR_REST, BAR_REST],
  }),
  ('muster_drums', {
    'timp': [N(['D2'],4,'f',accent=True)+N(['D2'],4)+N(['D2'],2)+N(['D2'],2)+N(['A2'],4,accent=True),
             N(['D2'],4,'ff',accent=True)+N(['D2'],2)+N(['D2'],2)+N(['A2'],8,accent=True), BAR_REST, BAR_REST],
    'cb':   [N(['D2'],16,'mf'), N(['D2'],16), BAR_REST, BAR_REST],
  }),
  ('boss_roar', {
    'tuba': [N(['Bb1'],16,'mf',tie='start'), N(['Bb1'],16,'fff',tie='stop'), N(['A1'],8,'fff',accent=True)+R(8), BAR_REST],
    'tbn':  [N(['B2','F3'],16,'mf',tie='start'), N(['B2','F3'],16,'fff',tie='stop'), N(['Bb2','E3'],8,'fff',accent=True)+R(8), BAR_REST],
    'horn': [R(16), N(['Eb4','A3'],16,'ff'), N(['D4','Ab3'],8,'fff',accent=True)+R(8), BAR_REST],
    'timp': [N(['D2'],16,'mp',trem=True,tie='start'), N(['D2'],16,'ff',trem=True,tie='stop'), N(['D2'],4,'fff',accent=True)+R(12), BAR_REST],
    'cb':   [N(['D2'],16,'f',trem=True), N(['D2'],16,'ff',trem=True), N(['D2'],8,'fff')+R(8), BAR_REST],
  }),
  ('war_cry', {
    'horn': [N(['D4'],2,'ff')+N(['F4'],2)+N(['A4'],2)+N(['D5'],2)+N(['D5','A4'],8,accent=True), N(['D5','A4','F4'],12,'ff')+R(4), BAR_REST, BAR_REST],
    'tbn':  [R(8)+N(['D3','A3'],8,'ff',accent=True), N(['D3','A3'],12,'ff')+R(4), BAR_REST, BAR_REST],
    'timp': [R(8)+N(['D2'],4,'ff',accent=True)+N(['A2'],4,accent=True), N(['D2'],4,'ff',accent=True)+R(12), BAR_REST, BAR_REST],
  }),
  ('hold_line', {
    'timp': [N(['D2'],4,'ff',accent=True)+N(['D2'],4,accent=True)+N(['D2'],4,accent=True)+R(4), BAR_REST, BAR_REST, BAR_REST],
    'tbn':  [R(12)+N(['D3','A3'],4,'f'), N(['D3','A3'],12,'f')+R(4), BAR_REST, BAR_REST],
    'horn': [R(12)+N(['F4','D4'],4,'f'), N(['F4','D4'],12,'f')+R(4), BAR_REST, BAR_REST],
    'tuba': [R(12)+N(['D2'],4,'f'), N(['D2'],12,'f')+R(4), BAR_REST, BAR_REST],
  }),
  ('spoils_claim', {
    'harp': [N(['G3'],2,'f')+N(['B3'],2)+N(['D4'],2)+N(['G4'],2)+N(['B4'],2)+N(['D5'],2)+N(['G5'],4), N(['G5','D5','B4'],12,'f')+R(4), BAR_REST, BAR_REST],
    'glock':[R(12)+N(['G5'],4,'mf'), N(['D6'],4,'mf')+N(['G6'],8)+R(4), BAR_REST, BAR_REST],
  }),
  ('wave_clear', {
    'horn': [N(['Bb3','F4'],4,'f')+N(['C4','G4'],4)+N(['D4','A4','F#4'],8,'ff',accent=True), N(['D4','A4','F#4'],12,'ff')+R(4), BAR_REST, BAR_REST],
    'tbn':  [N(['Bb2'],4,'f')+N(['C3'],4)+N(['D3','A3'],8,'ff'), N(['D3','A3'],12,'ff')+R(4), BAR_REST, BAR_REST],
    'timp': [R(8)+N(['D2'],8,'ff',accent=True), N(['D2'],12,'f',trem=True)+R(4), BAR_REST, BAR_REST],
  }),
  ('defeat', {
    'vc':   [N(['A3'],8,'f')+N(['G3'],8), N(['F3'],8)+N(['E3'],8), N(['D3'],16,'mf'), BAR_REST],
    'cb':   [N(['D2'],16,'f'), N(['D2'],16), N(['D2'],16,'mf'), BAR_REST],
    'tbn':  [R(16), R(16), N(['D3','A2'],16,'mp'), BAR_REST],
    'timp': [N(['D2'],4,'f',accent=True)+R(12), R(16), N(['D2'],16,'mp',trem=True), BAR_REST],
  }),
  ('night_drone', {
    'vc':   [N(['D2','A2'],16,'pp',trem=True)]*3 + [N(['D2','A2'],16,'pp',trem=True)],
    'cb':   [N(['D2'],16,'pp',tie='start'), N(['D2'],16,tie='both'), N(['D2'],16,tie='both'), N(['D2'],16,tie='stop')],
    'vln':  [R(16), N(['A5'],16,'pp',trem=True), N(['Bb5'],16,'pp',trem=True), N(['A5'],16,'pp',trem=True)],
  }),
  ('wraith_wail', {
    'vln':  [N(['E6'],4,'mp')+N(['Eb6'],4)+N(['D6'],4)+N(['Db6'],4), N(['C6'],8,'p')+N(['B5'],8), N(['Bb5'],16,'pp',trem=True), BAR_REST],
  }),
  ('enrage', {
    'timp': [N(['D2'],12,'mf',trem=True)+N(['D2'],4,'fff',accent=True), BAR_REST, BAR_REST, BAR_REST],
    'tbn':  [N(['D3'],4,'f')+N(['Eb3'],4)+N(['E3'],4)+N(['F3','B2'],4,'fff',accent=True), N(['F3','B2'],8,'fff')+R(8), BAR_REST, BAR_REST],
    'tuba': [N(['D2'],12,'f')+N(['B1'],4,'fff',accent=True), N(['B1'],8,'fff')+R(8), BAR_REST, BAR_REST],
    'horn': [R(12)+N(['F4','B3'],4,'fff',accent=True), N(['F4','B3'],8,'fff')+R(8), BAR_REST, BAR_REST],
  }),
  ('crate_open', {
    'glock':[N(['D6'],2,'f')+N(['A6'],6)+R(8), BAR_REST, BAR_REST, BAR_REST],
    'harp': [N(['D4','A4'],8,'mf')+R(8), BAR_REST, BAR_REST, BAR_REST],
  }),
]

def build():
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
           '<score-partwise version="4.0"><work><work-title>Myth and Blood cues</work-title></work><part-list>']
    ids = list(PARTS)
    for i, k in enumerate(ids, 1):
        name, prog, _, snd = PARTS[k]
        out.append(f'<score-part id="P{i}"><part-name>{name}</part-name><score-instrument id="P{i}-I1"><instrument-name>{name}</instrument-name><instrument-sound>{snd}</instrument-sound></score-instrument><midi-instrument id="P{i}-I1"><midi-channel>{i if i < 10 else i + 1}</midi-channel><midi-program>{prog}</midi-program></midi-instrument></score-part>')
    out.append('</part-list>')
    for i, k in enumerate(ids, 1):
        _, _, (sign, line), _ = PARTS[k]
        out.append(f'<part id="P{i}">')
        m = 0
        for cname, cue in CUES:
            bars = cue.get(k, [BAR_REST] * 4)
            for b, bar in enumerate(bars):
                m += 1
                attrs = ''
                if m == 1:
                    attrs = f'<attributes><divisions>{DIV}</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>{sign}</sign><line>{line}</line></clef></attributes>'
                    if i == 1:
                        attrs += '<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type><sound tempo="120"/></direction>'
                label = ''
                if b == 0 and i == 1:
                    label = f'<direction placement="above"><direction-type><rehearsal>{cname}</rehearsal></direction-type></direction>'
                out.append(f'<measure number="{m}">{attrs}{label}{bar}</measure>')
        out.append('</part>')
    out.append('</score-partwise>')
    return '\n'.join(out)

if __name__ == '__main__':
    import json
    open('myth_and_blood_cues.musicxml', 'w', encoding='utf-8').write(build())
    json.dump({'bpm': 120, 'barsPerCue': 4, 'secondsPerCue': 8, 'cues': [c for c, _ in CUES]}, open('cues.json', 'w'), indent=2)
    print('wrote', len(CUES), 'cues,', len(CUES) * 4, 'bars')
