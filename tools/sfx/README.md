# Recorded sound cues

The orchestral cues in `assets/sfx/` were recorded in MuseScore Studio 4 with Muse Sounds
(installed through Muse Hub). The game plays them in place of the synthesized versions and
falls back to the synthesized sound if a file has not loaded.

## Rebuilding them

1. Run `python gen_cues.py`. It writes `myth_and_blood_cues.musicxml` (every cue in one
   score, four bars apiece at 120 bpm, so each cue starts on an 8-second boundary) and
   `cues.json` (the cue order).
2. Open the MusicXML in MuseScore Studio and check the Mixer shows Muse Sounds instruments.
3. File > Export > WAV audio, main score only.
4. Split the WAV by the 8-second slots in `cues.json`, trim the silent tails, bring each
   cue's peak to about -2 dB, and encode mono OGG Vorbis (quality 4) into `assets/sfx/`.

To add a cue, add an entry to `CUES` in `gen_cues.py`, re-export, and map the new file name
in `SAMPLE_FILES` in `js/audio.js`.

| File                   | Used for                       |
| ---------------------- | ------------------------------ |
| `breach_horn`          | an enemy gets through the line |
| `muster_drums`         | a wave forms up                |
| `boss_roar`            | a named warlord arrives        |
| `war_cry`, `hold_line` | the General's orders           |
| `spoils_claim`         | choosing spoils                |
| `wave_clear`, `defeat` | end of a wave, end of a run    |
| `enrage`               | a boss turns at half health    |
| `wraith_wail`          | a Wailing Wraith on the field  |
| `crate_open`           | opening a supply crate         |
| `night_drone`          | night ambience (looped)        |
