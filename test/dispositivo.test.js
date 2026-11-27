import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sistemaOperativo, browser, tipoDispositivo, formato, descriviDispositivo, scorciatoia, tastieraAperta, istruzioniInstallazione, nomeDispositivo } from '../js/dispositivo.js';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Safari/537.36',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1'
};

test('sistema operativo, anche iPad che si presenta come Mac', () => {
  assert.equal(sistemaOperativo({ ua: UA.iphone }), 'ios');
  assert.equal(sistemaOperativo({ ua: UA.ipad, maxTouchPoints: 5 }), 'ipados');
  assert.equal(sistemaOperativo({ ua: UA.mac, maxTouchPoints: 0 }), 'macos');
  assert.equal(sistemaOperativo({ ua: UA.android }), 'android');
  assert.equal(sistemaOperativo({ ua: UA.windowsEdge }), 'windows');
  assert.equal(sistemaOperativo({ ua: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)' }), 'chromeos');
  assert.equal(sistemaOperativo({ ua: 'Mozilla/5.0 (X11; Linux x86_64)' }), 'linux');
  assert.equal(sistemaOperativo({}), 'altro');
});

test('browser', () => {
  assert.equal(browser(UA.iphone), 'safari');
  assert.equal(browser(UA.iphoneChrome), 'chrome');
  assert.equal(browser(UA.samsung), 'samsung');
  assert.equal(browser(UA.windowsEdge), 'edge');
  assert.equal(browser(UA.windowsFirefox), 'firefox');
  assert.equal(browser(UA.mac), 'chrome');
});

test('tipo di apparecchio e formato dello schermo', () => {
  assert.equal(tipoDispositivo({ os: 'ios' }), 'smartphone');
  assert.equal(tipoDispositivo({ os: 'ipados' }), 'tablet');
  assert.equal(tipoDispositivo({ os: 'android', latoCorto: 412 }), 'smartphone');
  assert.equal(tipoDispositivo({ os: 'android', latoCorto: 800 }), 'tablet');
  assert.equal(tipoDispositivo({ os: 'windows', latoCorto: 1080 }), 'pc');
  assert.equal(formato({ larghezza: 390, altezza: 844 }), 'telefono');
  assert.equal(formato({ larghezza: 844, altezza: 390 }), 'telefono-orizzontale');
  assert.equal(formato({ larghezza: 820, altezza: 1180 }), 'tablet');
  assert.equal(formato({ larghezza: 1180, altezza: 820 }), 'notebook');
  assert.equal(formato({ larghezza: 1366, altezza: 768 }), 'notebook');
  assert.equal(formato({ larghezza: 1920, altezza: 1080 }), 'desktop');
  const d = descriviDispositivo({ ua: UA.ipad, maxTouchPoints: 5, larghezza: 1180, altezza: 820, schermoL: 1180, schermoA: 820, puntatoreGrossolano: true, installata: true });
  assert.deepEqual(d, { os: 'ipados', browser: 'safari', dispositivo: 'tablet', formato: 'notebook', input: 'touch', installata: true });
  assert.equal(descriviDispositivo({ ua: UA.windowsEdge, larghezza: 1536, altezza: 864, schermoL: 1920, schermoA: 1080 }).dispositivo, 'pc');
});

test('scorciatoie e tastiera sullo schermo', () => {
  assert.equal(scorciatoia('macos', 'K'), '⌘K');
  assert.equal(scorciatoia('windows', 'K'), 'Ctrl+K');
  assert.equal(tastieraAperta({ altezzaFinestra: 800, altezzaVisibile: 450, touch: true }), true);
  assert.equal(tastieraAperta({ altezzaFinestra: 800, altezzaVisibile: 760, touch: true }), false);
  assert.equal(tastieraAperta({ altezzaFinestra: 800, altezzaVisibile: 450, touch: false }), false, 'sul computer non c\'è tastiera a schermo');
});

test('istruzioni di installazione per sistema e browser', () => {
  assert.match(istruzioniInstallazione('ios', 'safari').passi.join(' '), /Aggiungi alla schermata Home/);
  assert.match(istruzioniInstallazione('ipados', 'firefox').nota, /Safari/);
  assert.match(istruzioniInstallazione('android', 'chrome').passi.join(' '), /Installa app/);
  assert.match(istruzioniInstallazione('android', 'samsung').titolo, /Samsung/);
  assert.match(istruzioniInstallazione('macos', 'safari').passi.join(' '), /Aggiungi al Dock/);
  assert.match(istruzioniInstallazione('windows', 'edge').passi.join(' '), /menu Start/);
  assert.match(istruzioniInstallazione('windows', 'firefox').nota, /Chrome o Edge/);
  assert.ok(istruzioniInstallazione('altro', 'altro').passi.length);
  assert.equal(nomeDispositivo({ os: 'ipados', dispositivo: 'tablet' }), 'iPad');
  assert.equal(nomeDispositivo({ os: 'windows', dispositivo: 'pc' }), 'computer Windows');
  assert.equal(nomeDispositivo({ os: 'android', dispositivo: 'tablet' }), 'tablet Android');
  assert.equal(nomeDispositivo({}), 'computer');
});
