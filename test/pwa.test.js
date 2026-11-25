import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const radice = new URL('../', import.meta.url);
const leggi = (f) => readFileSync(new URL(f, radice), 'utf8');
const sw = leggi('sw.js');
const inCache = new Set([...sw.matchAll(/^\s*'([^']+)',?$/gm)].map((m) => m[1]));

/** File locali usati dall'app: moduli importati, dati letti, icone, stile. */
function fileUsati() {
  const usati = new Set(['index.html', 'manifest.webmanifest', 'css/style.css', 'js/app.js']);
  for (const f of readdirSync(new URL('js/', radice)).filter((x) => x.endsWith('.js'))) {
    const testo = leggi(`js/${f}`);
    for (const m of testo.matchAll(/(?:from|import\()\s*'\.\/([^']+)'/g)) usati.add(`js/${m[1]}`);
    for (const m of testo.matchAll(/'(data\/[a-z]+\.json)'/g)) usati.add(m[1]);
    for (const m of testo.matchAll(/new URL\('\.\/([^']+)', import\.meta\.url\)/g)) usati.add(`js/${m[1]}`);
  }
  const manifest = JSON.parse(leggi('manifest.webmanifest'));
  for (const i of manifest.icons) usati.add(i.src);
  for (const m of leggi('index.html').matchAll(/(?:href|src)="([^"#:]+)"/g)) usati.add(m[1]);
  return usati;
}

test('ogni file usato dall\'app è nella cache per l\'uso senza connessione', () => {
  for (const f of fileUsati()) {
    assert.ok(existsSync(new URL(f, radice)), `il file ${f} non esiste`);
    assert.ok(inCache.has(f), `${f} manca nell'elenco FILE di sw.js`);
  }
  for (const f of inCache) if (f !== './') assert.ok(existsSync(new URL(f, radice)), `sw.js elenca ${f} che non esiste`);
});

test('la versione della cache segue la versione dell\'app', () => {
  const app = leggi('js/app.js').match(/VERSIONE_APP = '([\d.]+)'/)[1];
  assert.ok(sw.includes(`'safetydoc-v${app}'`), `sw.js deve usare safetydoc-v${app}`);
  assert.equal(JSON.parse(leggi('package.json')).version, app);
});

function dimensioniPng(f) {
  const b = readFileSync(new URL(f, radice));
  assert.equal(b.toString('ascii', 1, 4), 'PNG', `${f} non è un PNG`);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

test('manifest completo per l\'installazione', () => {
  const m = JSON.parse(leggi('manifest.webmanifest'));
  for (const k of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color', 'lang']) assert.ok(m[k], `manca ${k}`);
  assert.equal(m.display, 'standalone');
  const png = m.icons.filter((i) => i.type === 'image/png');
  for (const [lato, scopo] of [[192, 'any'], [512, 'any'], [192, 'maskable'], [512, 'maskable']]) {
    const icona = png.find((i) => i.sizes === `${lato}x${lato}` && i.purpose.split(' ').includes(scopo));
    assert.ok(icona, `manca l'icona ${lato} ${scopo}`);
    assert.equal(dimensioniPng(icona.src), `${lato}x${lato}`);
  }
  for (const s of m.screenshots) assert.equal(dimensioniPng(s.src), s.sizes, s.src);
  assert.ok(m.screenshots.some((s) => s.form_factor === 'wide') && m.screenshots.some((s) => s.form_factor === 'narrow'));
  for (const s of m.shortcuts) assert.ok(s.url.startsWith('./#/'), s.url);
  const html = leggi('index.html');
  for (const x of ['rel="manifest"', 'apple-touch-icon', 'apple-mobile-web-app-capable', 'name="theme-color"', 'name="viewport"']) assert.ok(html.includes(x), `index.html: manca ${x}`);
  assert.equal(dimensioniPng('icons/apple-touch-icon.png'), '180x180');
});

test('tutti i file JavaScript sono validi (nessun nome dichiarato due volte)', async () => {
  const { spawnSync } = await import('node:child_process');
  const { readdirSync } = await import('node:fs');
  const dir = new URL('../js/', import.meta.url);
  for (const f of [...readdirSync(dir).filter((x) => x.endsWith('.js')).map((x) => new URL(x, dir)), new URL('../sw.js', import.meta.url)]) {
    const r = spawnSync(process.execPath, ['--check', f.pathname], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f.pathname}: ${r.stderr}`);
  }
});
