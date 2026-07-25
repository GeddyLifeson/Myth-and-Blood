#!/usr/bin/env node
/**
 * Post-build compression — minify JSON, emit .gz + .br sidecars for text assets.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { gzipSync, brotliCompressSync, constants } from 'zlib';

const COMPRESS_EXTS = new Set(['.js', '.css', '.html', '.json', '.svg', '.txt', '.map']);
const SKIP_NAMES = new Set(['build-info.json']);

export function minifyJsonInTree(root) {
  let count = 0;
  walk(root, (file) => {
    if (extname(file) !== '.json' || SKIP_NAMES.has(file.split(/[/\\]/).pop())) return;
    try {
      const raw = readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      const compact = JSON.stringify(parsed);
      if (compact.length < raw.length) {
        writeFileSync(file, compact);
        count++;
      }
    } catch {
      /* skip invalid json */
    }
  });
  return count;
}

export function minifyHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function walk(dir, fn) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, fn);
    else fn(path);
  }
}

export function compressTree(root, opts = {}) {
  const minGzip = opts.minGzipRatio ?? 0.04;
  const stats = [];
  walk(root, (file) => {
    const ext = extname(file);
    if (!COMPRESS_EXTS.has(ext)) return;
    if (file.endsWith('.gz') || file.endsWith('.br')) return;
    const name = file.split(/[/\\]/).pop();
    if (SKIP_NAMES.has(name)) return;

    const raw = readFileSync(file);
    const gzip = gzipSync(raw, { level: 9 });
    const brotli = brotliCompressSync(raw, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    });

    writeFileSync(`${file}.gz`, gzip);
    writeFileSync(`${file}.br`, brotli);

    const rel = file.slice(root.length + 1).replace(/\\/g, '/');
    const entry = {
      file: rel,
      raw: raw.length,
      gzip: gzip.length,
      brotli: brotli.length,
      gzipPct: pct(raw.length, gzip.length),
      brotliPct: pct(raw.length, brotli.length),
    };
    stats.push(entry);

    if (opts.dropRawWhenSmaller && gzip.length < raw.length * (1 - minGzip)) {
      /* keep raw — runtime + dev fallback always need uncompressed copies */
    }
  });
  return stats;
}

function pct(raw, compressed) {
  if (!raw) return 0;
  return Math.round((1 - compressed / raw) * 1000) / 10;
}

export function summarizeCompression(stats) {
  const totals = stats.reduce(
    (a, s) => {
      a.raw += s.raw;
      a.gzip += s.gzip;
      a.brotli += s.brotli;
      return a;
    },
    { raw: 0, gzip: 0, brotli: 0 }
  );
  return {
    files: stats.length,
    raw: totals.raw,
    gzip: totals.gzip,
    brotli: totals.brotli,
    gzipPct: pct(totals.raw, totals.gzip),
    brotliPct: pct(totals.raw, totals.brotli),
    items: stats.sort((a, b) => b.raw - a.raw),
  };
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}