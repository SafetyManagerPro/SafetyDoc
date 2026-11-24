import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessoOfflineValido, tokenDaRinnovare, messaggioErrore, contestoTicket } from '../js/accesso.js';
import { readFileSync } from 'node:fs';

test('accesso senza connessione solo entro il periodo consentito', () => {
  const ora = new Date('2026-11-24T12:00:00Z');
  assert.equal(accessoOfflineValido(null, ora), false);
  assert.equal(accessoOfflineValido({ userId: 'u', ultimoOk: '2026-11-10T12:00:00Z' }, ora, 30), true);
  assert.equal(accessoOfflineValido({ userId: 'u', ultimoOk: '2026-10-01T12:00:00Z' }, ora, 30), false);
  assert.equal(accessoOfflineValido({ userId: 'u', ultimoOk: '2026-12-01T12:00:00Z' }, ora, 30), false, 'data nel futuro');
});

test('rinnovo del token', () => {
  assert.equal(tokenDaRinnovare(null), true);
  assert.equal(tokenDaRinnovare({ expires_at: 1000 }, 900), false);
  assert.equal(tokenDaRinnovare({ expires_at: 1000 }, 950), true);
});

test('errori comprensibili', () => {
  assert.equal(messaggioErrore({ error_description: 'Invalid login credentials' }), 'Email o password non corretti.');
  assert.match(messaggioErrore(new TypeError('Failed to fetch')), /Connessione assente/);
});

test('il contesto del ticket non contiene dati dei lavoratori', () => {
  const c = contestoTicket({
    fatti: { ateco: { codice: '43.99', descrizione: 'Lavori edili' }, classeRischio: 'alto', lavoratori: 3 },
    risposte: { composizione: 'dipendenti', attivita: 'edilizia', nome_impresa: 'X' },
    scheda: { titolo: 'Corso antincendio' },
    voce: { motivo: 'Da fare' },
    versioneApp: '0.9.0'
  });
  assert.deepEqual(c, { versioneApp: '0.9.0', ateco: '43.99 Lavori edili', classeRischio: 'alto', lavoratori: 3, composizione: 'dipendenti', attivita: 'edilizia', scheda: 'Corso antincendio', statoVoce: 'Da fare' });
});

test('la migrazione protegge tabelle e funzioni', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261124120000_safetydoc_accesso_ticket.sql', import.meta.url), 'utf8');
  for (const t of ['sd_user_profiles', 'sd_user_devices', 'sd_tickets', 'sd_ticket_messaggi']) {
    assert.ok(sql.includes(`alter table public.${t} enable row level security`), `RLS mancante su ${t}`);
  }
  assert.ok(!/grant[^;]*(update|delete)[^;]*sd_tickets/i.test(sql), 'le imprese non devono poter modificare i ticket direttamente');
  const config = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
  assert.ok(!/sb_secret_|eyJhbGciOi/.test(config), 'nessuna chiave segreta nel browser');
});
