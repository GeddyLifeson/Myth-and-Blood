"""Cuts a MuseScore WAV export into the game's OGG files.

    python cut.py <export.wav> <layout.json> <out dir> [name ...]

The layout is cues.json, music.json or pass.json. Short cues are trimmed after their last
audible sound, peaked at -2 dB and written as mono OGG. Loops keep their 32 s body with the
ring-out mixed over the start, so the end rings into the beginning; peaked at -3 dB, stereo.
Needs soundfile and numpy (pip install soundfile).
"""
import json
import os
import sys

import numpy as np
import soundfile as sf

SILENCE_DB = -40  # below the cue's own peak counts as its tail being over
LEAK_BLOCKS = 6  # 20 ms blocks
FADE_S = 0.05


def pieces_of(layout):
    if 'pieces' in layout:
        return layout['pieces']
    step = layout['secondsPerCue']
    return [{'name': c, 'start': i * step, 'seconds': step, 'tailSeconds': 0, 'loop': False}
            for i, c in enumerate(layout['cues'])]


def peak_to(x, db):
    peak = np.abs(x).max()
    return x if peak == 0 else x * (10 ** (db / 20) / peak)


def cut_cue(audio, sr, p):
    a = int(p['start'] * sr)
    seg = audio[a:a + int((p['seconds'] + p['tailSeconds']) * sr)].mean(axis=1)
    blk = int(0.02 * sr)
    env = np.abs(seg[:len(seg) // blk * blk]).reshape(-1, blk).max(axis=1)
    # The next cue's attack leaks into the last few blocks of a slot; leave them out.
    env = env[:-LEAK_BLOCKS]
    loud = np.nonzero(env > env.max() * 10 ** (SILENCE_DB / 20))[0]
    end = min(len(seg) - LEAK_BLOCKS * blk, (int(loud[-1]) + 1) * blk + int(0.05 * sr))
    seg = seg[:end].copy()
    fade = min(len(seg), int(FADE_S * sr))
    seg[-fade:] *= np.linspace(1, 0, fade)
    return peak_to(seg, -2), 0.6


def cut_loop(audio, sr, p):
    a = int(p['start'] * sr)
    n = int(p['seconds'] * sr)
    tail = int(p['tailSeconds'] * sr)
    body = audio[a:a + n].copy()
    body[:tail] += audio[a + n:a + n + tail]
    return peak_to(body, -3), 0.7


def main(wav, layout_path, out_dir, only):
    audio, sr = sf.read(wav, always_2d=True)
    os.makedirs(out_dir, exist_ok=True)
    for p in pieces_of(json.load(open(layout_path))):
        if only and p['name'] not in only:
            continue
        data, level = (cut_loop if p['loop'] else cut_cue)(audio, sr, p)
        path = os.path.join(out_dir, p['name'] + '.ogg')
        # compression_level is libsndfile's inverse Vorbis quality: 0.6 ~ q4, 0.7 ~ q3.
        with sf.SoundFile(path, 'w', sr, data.shape[1] if data.ndim > 1 else 1, 'VORBIS', format='OGG',
                          compression_level=level) as f:
            # One big write overflows libsndfile's stack in its Vorbis encoder.
            for i in range(0, len(data), 4096):
                f.write(data[i:i + 4096])
        print(f"{p['name']:18s} {len(data) / sr:5.2f}s  {os.path.getsize(path) // 1024} KB")


if __name__ == '__main__':
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3], set(sys.argv[4:]))
