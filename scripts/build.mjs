#!/usr/bin/env node
/**
 * Production build — bundle + minify JS/CSS, copy assets, emit dist/ for web + Electron.
 * Usage: node scripts/build.mjs [--dev]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import { ROOT, JS_DIR, GAME_SCRIPTS, WORKER_SCRIPTS, COPY_DIRS } from './build-manifest.mjs';
import {
  minifyJsonInTree,
  minifyHtml,
  compressTree,
  summarizeCompression,
  formatBytes as fmtBytes,
} from './compress-dist.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV = process.argv.includes('--dev');
const DIST = join(ROOT, 'dist');
const DIST_JS = join(DIST, 'js');
const DIST_CSS = join(DIST, 'css');

function readJs(name) {
  const p = join(JS_DIR, name);
  if (!existsSync(p)) throw new Error(`Missing script: ${name}`);
  return readFileSync(p, 'utf8');
}

function concatScripts(files) {
  return files
    .map((f) => {
      const src = readJs(f);
      if (f === 'path-worker.js') {
        return src.replace(
          /importScripts\s*\(\s*['"]pathfinding-core\.js['"]\s*,\s*['"]wave-composition-core\.js['"]\s*\)\s*;?/,
          ''
        );
      }
      return src;
    })
    .join('\n;\n');
}

async function minifyJs(code, label) {
  if (DEV) return code;
  const result = await esbuild.transform(code, {
    minify: true,
    target: 'es2020',
    legalComments: 'none',
  });
  return result.code;
}

async function minifyCss(code) {
  if (DEV) return code;
  const result = await esbuild.transform(code, {
    loader: 'css',
    minify: true,
  });
  return result.code;
}

function copyDir(src, dest) {
  cpSync(src, dest, { recursive: true });
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function buildIndexHtml(bundleName, cssName) {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  let out = html.replace(/<link rel="stylesheet" href="css\/style\.css" \/>/, `<link rel="stylesheet" href="${cssName}" />`);
  out = out.replace(/\s*<script src="js\/touch-input\.js"><\/script>\s*/, '\n');
  const scriptRe = /\s*<script src="js\/[^"]+"><\/script>/g;
  const matches = out.match(scriptRe) || [];
  if (!matches.length) throw new Error('No js script tags found in index.html');
  out = out.replace(scriptRe, '');
  const bundleTag = `    <script src="${bundleName}"></script>\n`;
  const insertAt = out.lastIndexOf('</body>');
  if (insertAt < 0) throw new Error('index.html missing </body>');
  out = `${out.slice(0, insertAt)}${bundleTag}${out.slice(insertAt)}`;
  return out;
}

function writeBuildInfo(files) {
  const info = {
    builtAt: new Date().toISOString(),
    dev: DEV,
    files,
  };
  writeFileSync(join(DIST, 'build-info.json'), JSON.stringify(info, null, 2));
}

async function main() {
  console.log(`Building Myth and Blood (${DEV ? 'dev' : 'production'})…`);

  if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST_JS, { recursive: true });
  mkdirSync(DIST_CSS, { recursive: true });

  const gameRaw = concatScripts(GAME_SCRIPTS);
  const gameOut = await minifyJs(gameRaw, 'game');
  const gameFile = DEV ? 'js/game.bundle.js' : 'js/game.bundle.min.js';
  writeFileSync(join(DIST, gameFile), gameOut);

  const workerRaw = concatScripts(WORKER_SCRIPTS);
  const workerOut = await minifyJs(workerRaw, 'path-worker');
  const workerFile = 'js/path-worker.js';
  writeFileSync(join(DIST, workerFile), workerOut);

  const cssRaw = readFileSync(join(ROOT, 'css', 'style.css'), 'utf8');
  const cssOut = await minifyCss(cssRaw);
  const cssFile = DEV ? 'css/style.css' : 'css/style.min.css';
  writeFileSync(join(DIST, cssFile), cssOut);

  for (const dir of COPY_DIRS) {
    const src = join(ROOT, dir);
    if (existsSync(src)) copyDir(src, join(DIST, dir));
  }

  let indexHtml = buildIndexHtml(gameFile, cssFile);
  if (!DEV) indexHtml = minifyHtml(indexHtml);
  writeFileSync(join(DIST, 'index.html'), indexHtml);

  let compression = null;
  if (!DEV) {
    const jsonMinified = minifyJsonInTree(DIST);
    compression = summarizeCompression(compressTree(DIST));
    console.log(`  JSON minified: ${jsonMinified} file(s)`);
    console.log(
      `  Compressed ${compression.files} assets → gzip ${compression.gzipPct}% · brotli ${compression.brotliPct}%`
    );
    console.log(
      `  Total wire: ${fmtBytes(compression.raw)} → ${fmtBytes(compression.gzip)} gzip / ${fmtBytes(compression.brotli)} br`
    );
    for (const item of compression.items.slice(0, 5)) {
      console.log(
        `    ${item.file}  ${fmtBytes(item.raw)} → ${fmtBytes(item.brotli)} br (${item.brotliPct}%)`
      );
    }
  }

  const sizes = {
    game: statSync(join(DIST, gameFile)).size,
    worker: statSync(join(DIST, workerFile)).size,
    css: statSync(join(DIST, cssFile)).size,
    html: statSync(join(DIST, 'index.html')).size,
  };

  writeBuildInfo({
    game: gameFile,
    worker: workerFile,
    css: cssFile,
    sizes,
    compression: compression
      ? {
          files: compression.files,
          raw: compression.raw,
          gzip: compression.gzip,
          brotli: compression.brotli,
          gzipPct: compression.gzipPct,
          brotliPct: compression.brotliPct,
        }
      : null,
  });

  console.log(`  ${gameFile}  ${formatBytes(sizes.game)}`);
  console.log(`  ${workerFile}  ${formatBytes(sizes.worker)}`);
  console.log(`  ${cssFile}  ${formatBytes(sizes.css)}`);
  console.log(`  index.html  ${formatBytes(sizes.html)}`);
  console.log(`  dist/index.html + data/ + mods/`);
  console.log('Build complete → dist/');
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});