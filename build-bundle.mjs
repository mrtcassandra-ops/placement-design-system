#!/usr/bin/env node
// Builds a standalone offline bundle: index.html + styles.css + all assets → bundle.html
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { extname, join } from 'path';

const ROOT = new URL('.', import.meta.url).pathname;

function b64(filepath) {
  return readFileSync(filepath).toString('base64');
}

function mime(ext) {
  return {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ttf': 'font/truetype',
    '.woff2': 'font/woff2',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }[ext] ?? 'application/octet-stream';
}

function dataUrl(filepath) {
  const ext = extname(filepath).toLowerCase();
  return `data:${mime(ext)};base64,${b64(filepath)}`;
}

// ── 1. Fonts → @font-face CSS block ──────────────────────────────────────────
const fontFiles = readdirSync(join(ROOT, 'fonts')).filter(f => f.endsWith('.ttf'));
const fontFaces = fontFiles.map(f => {
  const name = f.replace('EuclidCircular', 'Euclid Circular ').replace('.ttf', '');
  // Derive family / weight / style from filename
  let family = name.includes(' A') ? 'Euclid Circular A' : 'Euclid Circular B';
  let weight = '400';
  let style = 'normal';
  const base = f.replace('EuclidCircularA-', '').replace('EuclidCircularB-', '').replace('.ttf', '');
  if (base.includes('Bold'))     weight = '700';
  if (base.includes('SemiBold')) weight = '600';
  if (base.includes('Medium'))   weight = '500';
  if (base.includes('Light'))    weight = '300';
  if (base.includes('Italic'))   style  = 'italic';
  return `@font-face{font-family:'${family}';src:url('${dataUrl(join(ROOT,'fonts',f))}') format('truetype');font-weight:${weight};font-style:${style};font-display:swap;}`;
}).join('\n');

// ── 2. CSS → inline, strip external font imports, inject @font-face ──────────
let css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
// Remove Google Fonts @import if any
css = css.replace(/@import\s+url\([^)]+\)[^;]*;/g, '');

// ── 3. Assets → data URLs map ─────────────────────────────────────────────────
function assetDataUrl(relPath) {
  try { return dataUrl(join(ROOT, relPath)); } catch { return relPath; }
}

const iconFiles = readdirSync(join(ROOT, 'assets/icons')).filter(f => f.endsWith('.png'));
const iconMap = Object.fromEntries(
  iconFiles.map(f => {
    const key = 'icon_' + f.replace('.png','').replace(/-/g,'_');
    return [key, assetDataUrl(`assets/icons/${f}`)];
  })
);

// ── 4. Read index.html and patch all src= / url() references ─────────────────
let html = readFileSync(join(ROOT, 'index.html'), 'utf8');

// Remove <link rel="stylesheet" href="styles.css">
html = html.replace(/<link rel="stylesheet" href="styles\.css"[^>]*>/g, '');

// Remove Google Fonts <link> tags
html = html.replace(/<link[^>]+fonts\.googleapis[^>]+>/g, '');
html = html.replace(/<link[^>]+fonts\.gstatic[^>]+>/g, '');

// Remove ext-resource-dependency meta tags
html = html.replace(/<meta name="ext-resource-dependency"[^>]+>\s*/g, '');

// Patch asset src attributes: assets/... → data URL
html = html.replace(/src="(assets\/[^"]+)"/g, (_, relPath) => `src="${assetDataUrl(relPath)}"`);

// Patch download href attributes: href="assets/...")" → data URL (e.g. the .pptx deck)
html = html.replace(/href="(assets\/[^"]+)"(\s+download)/g, (_, relPath, dl) => `href="${assetDataUrl(relPath)}"${dl}`);

// Patch url() in inline styles: url(assets/...) → data URL
html = html.replace(/url\((assets\/[^)]+)\)/g, (_, relPath) => `url(${assetDataUrl(relPath)})`);

// ── 5. Patch JS icon renderer to use embedded map ─────────────────────────────
const iconMapJson = JSON.stringify(iconMap);

// Inject __bundledIcons before the ICON DATA section
html = html.replace(
  '/* ============================================================\n   ICON DATA',
  `window.__bundledIcons = ${iconMapJson};\n/* ============================================================\n   ICON DATA`
);

// Patch window.__resources references to use bundled map
html = html.replace(
  /window\.__resources\s*&&\s*window\.__resources\[/g,
  'window.__bundledIcons && window.__bundledIcons['
);
html = html.replace(
  /window\.__resources\[/g,
  'window.__bundledIcons['
);

// ── 6. Inject font CSS + inlined stylesheet in <head> ─────────────────────────
const styleBlock = `<style>\n${fontFaces}\n${css}\n</style>`;
html = html.replace('</head>', `${styleBlock}\n</head>`);

// ── 7. Write output ───────────────────────────────────────────────────────────
const out = join(ROOT, 'stellium-design-system.bundle.html');
writeFileSync(out, html);

const sizeMb = (readFileSync(out).length / 1024 / 1024).toFixed(1);
console.log(`✓ Bundle écrit : stellium-design-system.bundle.html (${sizeMb} Mo)`);
console.log(`  Fonts    : ${fontFiles.length} fichiers TTF inlinés`);
console.log(`  Icônes   : ${iconFiles.length} PNG inlinés`);
console.log(`  Logos    : 4 assets inlinés`);
