import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIPI_RICHIESTA, STATI_RICHIESTA, datiRichiesta, erroriRichiesta, erroreRichiesta, daLeggere, avvisoRisposta } from '../js/richieste.js';
import { applicaVerifica } from '../js/account.js';

test('modulo della richiesta: pulizia e controlli', () => {
  const d = datiRichiesta({ tipo: 'aiuto', oggetto: '  POS stradale ', testo: 'Come compilo il POS?', schermata: 'documento:pos-bozza' });
  assert.equal(d.oggetto, 'POS stradale');
  assert.deepEqual(erroriRichiesta(d), []);
  assert.equal(erroriRichiesta(datiRichiesta({ tipo: 'boh', oggetto: 'x', testo: '' })).length, 3);
  assert.equal(datiRichiesta({ testo: 'a'.repeat(5000) }).testo.length, 4000);
});

test('tipi e stati coincidono con quelli ammessi dal database', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261125200000_safetydoc_richieste.sql', import.meta.url), 'utf8');
  const tipi = sql.match(/tipo in \(([^)]+)\)/)[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1)).sort();
  const stati = sql.match(/stato in \(([^)]+)\)/)[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1)).sort();
  assert.deepEqual(Object.keys(TIPI_RICHIESTA).sort(), tipi);
  assert.deepEqual(Object.keys(STATI_RICHIESTA).sort(), stati);
});

test('messaggi di errore leggibili', () => {
  assert.match(erroreRichiesta({ stato: 404, codice: 'PGRST202' }), /non è ancora attivo/);
  assert.match(erroreRichiesta({ message: 'troppe richieste' }), /domani/);
  assert.match(erroreRichiesta({ message: 'dispositivo non attivo' }), /attivazione/);
  assert.match(erroreRichiesta({ message: 'x' }), /connessione/);
});

test('risposte da leggere e avviso su WhatsApp', () => {
  assert.equal(daLeggere([{ letta: false }, { letta: true }, { letta: false }]), 2);
  assert.match(avvisoRisposta({ numero: 7, oggetto: 'POS', impresa: { referente: 'Mario' } }), /^Ciao Mario, ho risposto alla tua richiesta n\. 7 «POS»/);
  const a = applicaVerifica({ chiave: 'k', verificatoIl: 1 }, { stato: 'attivo', risposte_da_leggere: 2 }, 10);
  assert.equal(a.risposte, 2);
});

test('script del database: l\'impresa vede solo le sue richieste, le funzioni admin sono chiuse agli anonimi', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261125200000_safetydoc_richieste.sql', import.meta.url), 'utf8');
  for (const f of ['safetydoc_richieste_elenco', 'safetydoc_richiesta_nuova', 'safetydoc_richiesta_scrivi']) {
    const corpo = sql.split(`function public.${f}(`)[1].split('$$;')[0];
    assert.match(corpo, /safetydoc\.impresa_del_dispositivo\(dispositivo, chiave\)/, f);
    assert.match(corpo, /dispositivo non attivo/, f);
  }
  assert.match(sql.split('function public.safetydoc_richieste_elenco(')[1], /where r\.impresa_id = v_impresa/);
  for (const f of ['safetydoc_admin_richieste', 'safetydoc_admin_richiesta']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon;`));
    assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to anon`));
  }
  assert.equal((sql.match(/if not safetydoc\.e_admin\(\)/g) || []).length, 2);
  assert.match(sql, /alter table safetydoc\.richieste enable row level security/);
  assert.match(sql, /alter table safetydoc\.messaggi enable row level security/);
});
