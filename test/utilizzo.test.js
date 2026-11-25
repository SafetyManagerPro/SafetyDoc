import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nomePulito, fasciaLavoratori, divisioneAteco, piattaforma, accoda, pacchetto, invia, cancellaDati, MAX_CODA, MAX_PER_INVIO, SUPABASE_CHIAVE_PUBBLICA, TIPI_EVENTO } from '../js/utilizzo.js';

test('i nomi inviati rispettano il formato del database e non portano testo libero', () => {
  assert.equal(nomePulito('dvr-bozza'), 'dvr-bozza');
  assert.equal(nomePulito('Mario Rossi è qui'), 'mariorossiqui');
  assert.equal(nomePulito('x'.repeat(60)).length, 40);
  assert.equal(nomePulito(undefined), '');
});

test('fascia di lavoratori, divisione ATECO e tipo di dispositivo', () => {
  assert.deepEqual([0, 1, 5, 6, 9, 10, 15, 16, 49, 50, 300, 'x'].map(fasciaLavoratori), ['0', '1-5', '1-5', '6-9', '6-9', '10-15', '10-15', '16-49', '16-49', '50+', '50+', '0']);
  assert.equal(divisioneAteco('41.20.00'), '41');
  assert.equal(divisioneAteco(''), null);
  assert.equal(piattaforma('Mozilla/5.0 (Linux; Android 14; Pixel 7)'), 'android');
  assert.equal(piattaforma('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'ios');
  assert.equal(piattaforma('Mozilla/5.0 (Windows NT 10.0; Win64)'), 'windows');
  assert.equal(piattaforma(''), 'altro');
});

test('coda degli eventi: tipi ammessi, niente doppioni di schermata, lunghezza massima', () => {
  let c = accoda([], 'schermata', 'oggi', '2026-11-25T10:00:00Z');
  c = accoda(c, 'schermata', 'oggi', '2026-11-25T10:00:05Z');
  assert.equal(c.length, 1);
  c = accoda(c, 'documento', 'dvr-bozza');
  c = accoda(c, 'documento', 'dvr-bozza');
  assert.equal(c.length, 3, 'i documenti aperti più volte contano');
  assert.equal(accoda(c, 'pericoloso', 'x').length, 3);
  let lunga = [];
  for (let i = 0; i < MAX_CODA + 20; i++) lunga = accoda(lunga, 'documento', `d${i}`);
  assert.equal(lunga.length, MAX_CODA);
  assert.equal(lunga[0].n, 'd20', 'si tengono i più recenti');
});

test('il pacchetto contiene solo dati anonimi e al massimo 100 eventi', () => {
  const coda = Array.from({ length: 150 }, (_, i) => ({ ts: '2026-11-25T10:00:00Z', t: 'schermata', n: `s${i}` }));
  const p = pacchetto({ id: 'abc', versione: '0.18.2', ua: 'Android', installata: 1, ateco: '43.21', numeroLavoratori: 7, coda });
  assert.deepEqual(Object.keys(p).sort(), ['ateco', 'eventi', 'fascia', 'id', 'installata', 'piattaforma', 'versione']);
  assert.equal(p.eventi.length, MAX_PER_INVIO);
  assert.equal(p.ateco, '43');
  assert.equal(p.fascia, '6-9');
  assert.equal(p.installata, true);
});

test('invio e cancellazione chiamano solo le due funzioni del database con la chiave pubblica', async () => {
  const chiamate = [];
  const finto = async (url, opz) => (chiamate.push({ url, opz }), { ok: true, status: 204 });
  await invia({ id: 'abc', eventi: [] }, finto);
  await cancellaDati('abc', finto);
  assert.match(chiamate[0].url, /\/rest\/v1\/rpc\/safetydoc_registra$/);
  assert.match(chiamate[1].url, /\/rest\/v1\/rpc\/safetydoc_cancella$/);
  assert.deepEqual(JSON.parse(chiamate[1].opz.body), { id: 'abc' });
  assert.equal(chiamate[0].opz.headers.apikey, SUPABASE_CHIAVE_PUBBLICA);
  await assert.rejects(invia({}, async () => ({ ok: false, status: 400 })), /400/);
  const ruolo = JSON.parse(Buffer.from(SUPABASE_CHIAVE_PUBBLICA.split('.')[1], 'base64url')).role;
  assert.equal(ruolo, 'anon', 'nell\'app solo la chiave pubblica, mai quella di servizio');
});

test('lo script del database accetta gli stessi tipi di evento e non espone lo schema', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261125160000_safetydoc_utilizzo.sql', import.meta.url), 'utf8');
  for (const t of TIPI_EVENTO) assert.match(sql, new RegExp(`'${t}'`));
  assert.match(sql, /revoke all on schema safetydoc from public, anon, authenticated/);
  assert.match(sql, /enable row level security/);
  assert.doesNotMatch(sql, /grant [a-z, ]+ on (table|all tables)[^;]*to anon/i);
});
