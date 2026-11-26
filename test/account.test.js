import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAZIA_MS, decidiAccesso, daRiverificare, applicaVerifica, erroreAttivazione, datiAttivazione, erroriAttivazione, linkInvito, numeroWhatsApp, messaggioInvito, urlWhatsApp, csvImprese, sessioneValida, ROTTE_LIBERE } from '../js/account.js';
import { rpc, accedi } from '../js/supabase.js';

const ORA = Date.parse('2026-11-25T18:00:00Z');
const attivo = { dispositivo: 'd', chiave: 'k', stato: 'attivo', verificatoIl: ORA - 1000 };

test('accesso: senza account serve l\'attivazione, sospeso blocca, oltre 24 ore senza verifica serve la rete', () => {
  assert.equal(decidiAccesso({ account: null, adesso: ORA }), 'attivazione');
  assert.equal(decidiAccesso({ account: attivo, adesso: ORA }), 'ok');
  assert.equal(decidiAccesso({ account: { ...attivo, stato: 'sospeso' }, adesso: ORA }), 'bloccato');
  assert.equal(decidiAccesso({ account: { ...attivo, stato: 'bloccato' }, adesso: ORA }), 'bloccato');
  assert.equal(decidiAccesso({ account: { ...attivo, verificatoIl: ORA - GRAZIA_MS + 60000 }, adesso: ORA }), 'ok');
  assert.equal(decidiAccesso({ account: { ...attivo, verificatoIl: ORA - GRAZIA_MS - 1 }, adesso: ORA }), 'serve-rete');
  assert.equal(decidiAccesso({ account: null, adminValido: true, adesso: ORA }), 'ok', 'l\'amministratore collegato usa l\'app');
  assert.ok(ROTTE_LIBERE.has('invito') && ROTTE_LIBERE.has('admin'));
});

test('verifica: esiti del server e server non raggiungibile', () => {
  const a = { ...attivo, verificatoIl: ORA - 5 * 3600000 };
  const ok = applicaVerifica(a, { stato: 'attivo', impresa: { ragione_sociale: 'X' } }, ORA);
  assert.equal(ok.verificatoIl, ORA);
  assert.equal(ok.impresa.ragione_sociale, 'X');
  const sosp = applicaVerifica(a, { stato: 'sospeso', motivo: 'Uso non conforme' }, ORA);
  assert.equal(sosp.stato, 'sospeso');
  assert.equal(sosp.verificatoIl, a.verificatoIl, 'la sospensione non rinnova le 24 ore');
  assert.equal(decidiAccesso({ account: sosp, adesso: ORA }), 'bloccato');
  const riattivato = applicaVerifica(sosp, { stato: 'attivo' }, ORA + 1);
  assert.equal(decidiAccesso({ account: riattivato, adesso: ORA + 2 }), 'ok');
  const offline = applicaVerifica(a, null, ORA);
  assert.equal(offline.verificatoIl, a.verificatoIl);
  assert.equal(offline.controllatoIl, ORA);
  assert.equal(applicaVerifica(a, { stato: 'sconosciuto' }, ORA), null, 'dispositivo eliminato: si riattiva');
  assert.equal(daRiverificare({ controllatoIl: ORA - 60000 }, ORA), false);
  assert.equal(daRiverificare({ controllatoIl: ORA - 11 * 60000 }, ORA), true);
});

test('modulo di attivazione: pulizia e controlli', () => {
  const d = datiAttivazione({ ragione_sociale: ' Edil Rossi ', partita_iva: '012 345 678 90', provincia: 'av', email: 'a@b.it', termini: 'on' });
  assert.equal(d.partita_iva, '01234567890');
  assert.equal(d.provincia, 'AV');
  assert.deepEqual(erroriAttivazione(d), []);
  const e = erroriAttivazione(datiAttivazione({ ragione_sociale: 'X', partita_iva: '123', provincia: 'Avellino', email: 'no', termini: '' }));
  assert.equal(e.length, 5);
  assert.match(erroreAttivazione('link non valido'), /nuovo link/);
  assert.match(erroreAttivazione('troppi dispositivi'), /massimo/);
  assert.match(erroreAttivazione('qualcosa'), /connessione/);
});

test('link di attivazione e messaggio WhatsApp', () => {
  assert.equal(linkInvito('abc123', 'https://safetydoc.vercel.app/#/admin'), 'https://safetydoc.vercel.app/#/invito/abc123');
  assert.equal(linkInvito('abc', 'http://localhost:8790/'), 'http://localhost:8790/#/invito/abc');
  assert.equal(numeroWhatsApp('333 123 4567'), '393331234567');
  assert.equal(numeroWhatsApp('+39 333 1234567'), '393331234567');
  const m = messaggioInvito({ referente: 'Mario', ragione_sociale: 'Edil Rossi' }, 'https://x/#/invito/a');
  assert.match(m, /^Ciao Mario, ecco il link per attivare safetyDoc per Edil Rossi:\nhttps:\/\/x\/#\/invito\/a/);
  assert.match(urlWhatsApp('3331234567', 'ciao a tutti'), /^https:\/\/wa\.me\/393331234567\?text=ciao%20a%20tutti$/);
});

test('esportazione CSV delle imprese', () => {
  const csv = csvImprese([{ ragione_sociale: 'Rossi; Bianchi "srl"', partita_iva: '01234567890', stato: 'attiva', dispositivi: [{}, {}], note: 'riga1\nriga2' }]);
  const righe = csv.replace('﻿', '').split('\n');
  assert.match(righe[0], /^ragione_sociale;partita_iva;/);
  assert.match(csv, /"Rossi; Bianchi ""srl"""/);
  assert.match(csv, /;2;"riga1\nriga2"/);
});

test('sessione amministratore e chiamate al database', async () => {
  assert.equal(sessioneValida({ accessToken: 't', scade: ORA + 120000 }, ORA), true);
  assert.equal(sessioneValida({ accessToken: 't', scade: ORA + 30000 }, ORA), false);
  assert.equal(sessioneValida(null, ORA), false);
  const chiamate = [];
  const finto = async (url, o) => (chiamate.push({ url, o }), { ok: true, status: 200, text: async () => '{"stato":"attivo"}', json: async () => ({ access_token: 'A', refresh_token: 'R', expires_in: 3600, user: { email: 'x@y.it' } }) });
  assert.deepEqual(await rpc('safetydoc_verifica', { dispositivo: 'd' }, { fetchFn: finto }), { stato: 'attivo' });
  await rpc('safetydoc_admin_elenco', {}, { accessToken: 'TOKEN', fetchFn: finto });
  assert.equal(chiamate[1].o.headers.Authorization, 'Bearer TOKEN');
  const s = await accedi('x@y.it', 'segreta', finto);
  assert.equal(s.accessToken, 'A');
  assert.match(chiamate[2].url, /grant_type=password$/);
  const errore = async () => ({ ok: false, status: 400, text: async () => '{"message":"link non valido","code":"P0001"}' });
  await assert.rejects(rpc('safetydoc_attiva', {}, { fetchFn: errore }), (e) => e.message === 'link non valido' && e.stato === 400 && e.codice === 'P0001');
});

test('script del database: niente IP, funzioni admin solo per utenti autenticati, tabelle protette', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261125180000_safetydoc_account.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /\bip\b|inet|x-forwarded-for/i);
  for (const f of ['safetydoc_admin_elenco', 'safetydoc_admin_salva_impresa', 'safetydoc_admin_nuovo_invito', 'safetydoc_admin_stato_impresa', 'safetydoc_admin_stato_dispositivo', 'safetydoc_admin_elimina_impresa']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon;`), f);
    assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to anon`), f);
  }
  assert.equal((sql.match(/if not safetydoc\.e_admin\(\)/g) || []).length, 6, 'ogni funzione admin controlla l\'amministratore');
  for (const t of ['amministratori', 'imprese', 'inviti', 'dispositivi', 'accessi']) assert.match(sql, new RegExp(`alter table safetydoc\\.${t} enable row level security`));
});

test('amministratore: l\'app si apre su Admin e la barra Home | Admin ricorda l\'ultima scelta', async () => {
  const { vistaDaRotta, rottaIniziale } = await import('../js/account.js');
  assert.equal(rottaIniziale({ hash: '', adminCollegato: true }), '#/admin', 'indirizzo vuoto: si apre Admin');
  assert.equal(rottaIniziale({ hash: '#/', adminCollegato: true, vista: 'admin' }), '#/admin');
  assert.equal(rottaIniziale({ hash: '#/', adminCollegato: true, vista: 'app' }), null, 'ultima scelta Home: resta su Home');
  assert.equal(rottaIniziale({ hash: '#/piano', adminCollegato: true }), null, 'una pagina precisa (link, scorciatoia) si rispetta');
  assert.equal(rottaIniziale({ hash: '#/invito/abc', adminCollegato: true }), null);
  assert.equal(rottaIniziale({ hash: '', adminCollegato: false }), null, 'le imprese non vedono mai Admin');
  assert.equal(vistaDaRotta('admin', 'app'), 'admin');
  assert.equal(vistaDaRotta('', 'admin'), 'app');
  assert.equal(vistaDaRotta('piano', 'admin'), 'app');
  assert.equal(vistaDaRotta('termini', 'admin'), 'admin', 'i termini non cambiano la scelta');
});

test('barra Home | Admin presente nella pagina e nascosta in stampa', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  assert.match(html, /class="barra-admin"[^>]*hidden/);
  assert.match(html, /href="#\/" data-vista="app"/);
  assert.match(html, /href="#\/admin" data-vista="admin"/);
  assert.match(css, /\.nav, \.barra-admin,/);
  assert.match(css, /safe-area-inset-top/);
});
