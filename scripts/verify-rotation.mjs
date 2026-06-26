/**
 * Verify unit sprite weapon direction matches atan2 rotation convention.
 */
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function luminance(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function sampleWeaponSide(imgData, w, h) {
  const data = imgData.data;
  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 40) continue;
      const lum = luminance(data[i], data[i + 1], data[i + 2]);
      if (lum < 30) continue;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d < 6 || d > 16) continue;
      if (Math.abs(dx) < 3 && dy < -4) top += lum;
      if (Math.abs(dx) < 3 && dy > 4) bottom += lum;
      if (Math.abs(dy) < 3 && dx < -4) left += lum;
      if (Math.abs(dy) < 3 && dx > 4) right += lum;
    }
  }
  return { top, bottom, left, right };
}

function dominantSide(s) {
  const entries = Object.entries(s);
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

const EXPECTED = {
  '-90': 'top',
  '90': 'bottom',
  '0': 'right',
  '180': 'left',
};

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(ROOT, 'electron', 'preload.js'),
    },
  });

  await win.loadFile(path.join(ROOT, 'index.html'));
  await win.webContents.executeJavaScript('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');

  const results = await win.webContents.executeJavaScript(`
    (() => {
      const types = ['footman', 'healer', 'archer'];
      const rots = [-90, 90, 0, 180];
      const out = [];
      for (const type of types) {
        for (const rot of rots) {
          const img = SpriteGen.getUnitCanvas(type, rot, 'player', 0, 1, 'idle');
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          out.push({
            type,
            rot,
            w: img.width,
            h: img.height,
            pixels: Array.from(ctx.getImageData(0, 0, img.width, img.height).data),
          });
        }
      }
      return out;
    })()
  `);

  let failures = 0;
  for (const row of results) {
    const imgData = { data: new Uint8ClampedArray(row.pixels), width: row.w, height: row.h };
    const side = dominantSide(sampleWeaponSide(imgData, row.w, row.h));
    const expected = EXPECTED[String(row.rot)];
    const ok = side === expected;
    if (!ok) failures++;
    console.log(`${ok ? 'OK' : 'FAIL'} ${row.type} rot=${row.rot}: weapon mass on ${side}, expected ${expected}`);
  }

  await app.exit(failures > 0 ? 1 : 0);
});