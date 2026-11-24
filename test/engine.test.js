import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { valuta, creaContesto, generaPiano, domandeVisibili, aggiungiMesi, semaforo, cosaFareAdesso } from '../js/engine.js';

const catalogo = JSON.parse(readFileSync(new URL('../data/catalogo.json', import.meta.url)));
const questionario = JSON.parse(readFileSync(new URL('../data/questionario.json', import.meta.url)));
const ids = (piano) => piano.map((v) => v.scheda.id);

test('ogni scheda del catalogo ha i campi obbligatori e un id unico', () => {
  const visti = new Set();
  const tipi = ['una_tantum', 'periodica', 'manuale', 'evento'];
  for (const s of catalogo.schede) {
    assert.ok(!visti.has(s.id), `id duplicato: ${s.id}`);
    visti.add(s.id);
    for (const campo of ['titolo', 'categoria', 'cosaE', 'perche', 'riferimento', 'chi', 'quando', 'attivaSe']) {
      assert.ok(s[campo], `${s.id}: manca ${campo}`);
    }
    assert.ok(Array.isArray(s.come) && s.come.length, `${s.id}: mancano i passi`);
    assert.ok(tipi.includes(s.tipoScadenza), `${s.id}: tipoScadenza non valido`);
    if (s.tipoScadenza === 'periodica') assert.ok(s.periodicitaMesi > 0, `${s.id}: manca periodicitaMesi`);
    assert.ok(catalogo.categorie[s.categoria], `${s.id}: categoria sconosciuta`);
  }
});

test('le regole citano solo domande o fatti esistenti', () => {
  const domande = new Set(questionario.domande.map((d) => d.id));
  const fatti = new Set(Object.keys(creaContesto({}, questionario).fatti));
  const controlla = (r, dove) => {
    if (!r || r.sempre) return;
    if (r.all || r.any) return (r.all || r.any).forEach((x) => controlla(x, dove));
    if (r.not) return controlla(r.not, dove);
    if (r.fatto) return assert.ok(fatti.has(r.fatto), `${dove}: fatto sconosciuto ${r.fatto}`);
    if (r.q) return assert.ok(domande.has(r.q), `${dove}: domanda sconosciuta ${r.q}`);
    assert.fail(`${dove}: regola non riconosciuta ${JSON.stringify(r)}`);
  };
  for (const s of catalogo.schede) {
    controlla(s.attivaSe, s.id);
    for (const p of s.periodicitaRegole || []) controlla(p.se, s.id);
  }
  for (const d of questionario.domande) if (d.mostraSe) controlla(d.mostraSe, d.id);
});

test('valuta: operatori di base', () => {
  const ctx = { risposte: { a: 5, b: 'x', c: true }, fatti: { f: true } };
  assert.equal(valuta({ q: 'a', gt: 4 }, ctx), true);
  assert.equal(valuta({ q: 'a', gt: 5 }, ctx), false);
  assert.equal(valuta({ q: 'b', in: ['x', 'y'] }, ctx), true);
  assert.equal(valuta({ all: [{ fatto: 'f' }, { q: 'c', eq: true }] }, ctx), true);
  assert.equal(valuta({ not: { fatto: 'f' } }, ctx), false);
  assert.equal(valuta({ q: 'mancante', gt: 0 }, ctx), false);
});

test('chi lavora da solo non vede DVR né domande per i dipendenti', () => {
  const r = { composizione: 'solo', attivita: 'commercio_ufficio', cantiere: false };
  const piano = ids(generaPiano({ catalogo, questionario, risposte: r, adempimenti: [], oggi: '2026-11-23' }));
  assert.ok(piano.includes('art21-autonomo'));
  assert.ok(!piano.includes('dvr'));
  assert.ok(!piano.includes('medico-competente'));
  const domande = domandeVisibili(questionario, r).map((d) => d.id);
  assert.ok(!domande.includes('numero_lavoratori'));
  assert.ok(!domande.includes('videoterminali'));
});

test('impresa edile con dipendenti: pacchetto completo e cantiere', () => {
  const r = {
    composizione: 'dipendenti', numero_lavoratori: 4, attivita: 'edilizia', dl_rspp: true,
    cantiere: true, quota: true, rumore_vibrazioni: true, rifiuti_pericolosi: 'no'
  };
  const piano = ids(generaPiano({ catalogo, questionario, risposte: r, adempimenti: [], oggi: '2026-11-23' }));
  for (const id of ['dvr', 'rspp', 'formazione-dl-rspp', 'formazione-lavoratori', 'preposto', 'medico-competente', 'patente-crediti', 'pos', 'lavori-quota']) {
    assert.ok(piano.includes(id), `manca ${id}`);
  }
  assert.ok(!piano.includes('art21-autonomo'));
  assert.ok(!piano.includes('riunione-periodica'), 'sotto i 16 lavoratori non serve');
  assert.ok(!piano.includes('rentri'));
});

test('riunione periodica solo sopra i 15 lavoratori', () => {
  const base = { composizione: 'dipendenti', attivita: 'commercio_ufficio' };
  const con = (n) => ids(generaPiano({ catalogo, questionario, risposte: { ...base, numero_lavoratori: n }, adempimenti: [], oggi: '2026-11-23' }));
  assert.ok(!con(15).includes('riunione-periodica'));
  assert.ok(con(16).includes('riunione-periodica'));
});

test('officina con rifiuti pericolosi: RENTRI e requisiti professionali', () => {
  const r = { composizione: 'solo', attivita: 'autoriparazione', rifiuti_pericolosi: 'si' };
  const piano = ids(generaPiano({ catalogo, questionario, risposte: r, adempimenti: [], oggi: '2026-11-23' }));
  assert.ok(piano.includes('rentri'));
  assert.ok(piano.includes('requisiti-professionali'));
});

test('aggiungiMesi gestisce fine mese e anni bisestili', () => {
  assert.equal(aggiungiMesi('2026-01-31', 1), '2026-02-28');
  assert.equal(aggiungiMesi('2027-02-28', 12), '2028-02-28');
  assert.equal(aggiungiMesi('2026-11-23', 60), '2031-11-23');
});

test('semaforo: da fare, scaduto, in scadenza, in regola', () => {
  const ctx = creaContesto({ composizione: 'dipendenti' }, questionario);
  const scheda = catalogo.schede.find((s) => s.id === 'preposto'); // ogni 24 mesi
  assert.equal(semaforo(scheda, null, ctx, '2026-11-23').colore, 'rosso');
  assert.equal(semaforo(scheda, { fatto: true, dataFatto: '2024-01-01' }, ctx, '2026-11-23').colore, 'rosso');
  assert.equal(semaforo(scheda, { fatto: true, dataFatto: '2024-12-15' }, ctx, '2026-11-23').colore, 'giallo');
  assert.equal(semaforo(scheda, { fatto: true, dataFatto: '2026-06-01' }, ctx, '2026-11-23').colore, 'verde');
  // una scadenza scritta dall'utente prevale sul calcolo
  assert.equal(semaforo(scheda, { fatto: true, dataFatto: '2026-06-01', scadenzaManuale: '2026-12-01' }, ctx, '2026-11-23').colore, 'giallo');
});

test('messa a terra: ogni 2 anni se si lavora in cantiere', () => {
  const scheda = catalogo.schede.find((s) => s.id === 'messa-a-terra');
  const stato = { fatto: true, dataFatto: '2025-01-10' };
  const fuori = creaContesto({ composizione: 'dipendenti', cantiere: false }, questionario);
  const dentro = creaContesto({ composizione: 'dipendenti', cantiere: true }, questionario);
  assert.equal(semaforo(scheda, stato, fuori, '2026-11-23').prossimaScadenza, '2030-01-10');
  assert.equal(semaforo(scheda, stato, dentro, '2026-11-23').prossimaScadenza, '2027-01-10');
});

test('vale il record più recente tra due postazioni e i cancellati sono ignorati', () => {
  const r = { composizione: 'dipendenti', attivita: 'commercio_ufficio' };
  const adempimenti = [
    { id: 'a', schedaId: 'preposto', fatto: true, dataFatto: '2026-06-01', updatedAt: '2026-06-01T10:00:00Z' },
    { id: 'b', schedaId: 'preposto', fatto: false, updatedAt: '2026-07-01T10:00:00Z', deleted: true }
  ];
  const voce = generaPiano({ catalogo, questionario, risposte: r, adempimenti, oggi: '2026-11-23' }).find((v) => v.scheda.id === 'preposto');
  assert.equal(voce.colore, 'verde');
});

test('cosa fare adesso mostra al massimo tre voci urgenti', () => {
  const r = { composizione: 'dipendenti', numero_lavoratori: 3, attivita: 'legno' };
  const piano = generaPiano({ catalogo, questionario, risposte: r, adempimenti: [], oggi: '2026-11-23' });
  const urgenti = cosaFareAdesso(piano);
  assert.equal(urgenti.length, 3);
  assert.ok(urgenti.every((v) => v.colore === 'rosso'));
});

test('tra le voci da fare, le più importanti per la sicurezza vengono prima', () => {
  const r = { composizione: 'dipendenti', numero_lavoratori: 3, attivita: 'legno', artigiano: true };
  const piano = generaPiano({ catalogo, questionario, risposte: r, adempimenti: [], oggi: '2026-11-23' });
  const primi = cosaFareAdesso(piano).map((v) => v.scheda.id);
  assert.ok(primi.includes('dvr'), `in cima ci sono ${primi}`);
  assert.ok(!primi.includes('iscrizioni-base'));
});

test('piano di emergenza: dai 10 lavoratori, con più di 50 persone o con CPI', () => {
  const base = { composizione: 'dipendenti', attivita: 'commercio_ufficio', sede: true };
  const ha = (r) => ids(generaPiano({ catalogo, questionario, risposte: { ...base, ...r }, adempimenti: [], oggi: '2026-11-23' })).includes('piano-emergenza');
  assert.equal(ha({ numero_lavoratori: 9 }), false);
  assert.equal(ha({ numero_lavoratori: 10 }), true);
  assert.equal(ha({ numero_lavoratori: 3, pubblico_50: true }), true);
  assert.equal(ha({ numero_lavoratori: 3, rischio_incendio: 'si' }), true);
});

test('CPI, impianto elettrico ed emissioni dipendono dal locale', () => {
  const r = { composizione: 'solo', attivita: 'autoriparazione', sede: true, rischio_incendio: 'si', emissioni: true };
  const piano = ids(generaPiano({ catalogo, questionario, risposte: r, adempimenti: [], oggi: '2026-11-23' }));
  for (const id of ['prevenzione-incendi-cpi', 'impianti-elettrici', 'emissioni-atmosfera', 'reati-ambientali']) assert.ok(piano.includes(id), `manca ${id}`);
  const senzaSede = ids(generaPiano({ catalogo, questionario, risposte: { composizione: 'solo', sede: false }, adempimenti: [], oggi: '2026-11-23' }));
  assert.ok(!senzaSede.includes('impianti-elettrici'));
  assert.ok(senzaSede.includes('reati-ambientali'));
  const dubbio = ids(generaPiano({ catalogo, questionario, risposte: { ...r, rischio_incendio: 'non_so' }, adempimenti: [], oggi: '2026-11-23' }));
  assert.ok(dubbio.includes('verifica-cpi') && !dubbio.includes('prevenzione-incendi-cpi'));
});

test('controlli antincendio ogni 6 mesi', () => {
  const scheda = catalogo.schede.find((s) => s.id === 'presidi-antincendio');
  const ctx = creaContesto({ composizione: 'dipendenti', sede: true }, questionario);
  assert.equal(semaforo(scheda, { fatto: true, dataFatto: '2026-06-01' }, ctx, '2026-11-23').prossimaScadenza, '2026-12-01');
});

test('privacy: telecamere, GPS e whistleblowing', () => {
  const base = { composizione: 'dipendenti', numero_lavoratori: 5, sede: true };
  const p = (r) => ids(generaPiano({ catalogo, questionario, risposte: { ...base, ...r }, adempimenti: [], oggi: '2026-11-23' }));
  assert.ok(p({}).includes('privacy-lavoratori'));
  assert.ok(p({}).includes('data-breach'));
  assert.ok(p({ videosorveglianza: true }).includes('videosorveglianza'));
  assert.ok(p({ gps: true }).includes('gps-strumenti'));
  assert.ok(!p({}).includes('whistleblowing'));
  assert.ok(p({ numero_lavoratori: 50 }).includes('whistleblowing'));
});

// ---------- schermate e lavoratori ----------
import { schermate, situazioneLavoratore, urgenzeLavoratori, requisitiLavoratore, lavoratoriAttivi } from '../js/engine.js';
const defLav = JSON.parse(readFileSync(new URL('../data/lavoratori.json', import.meta.url)));

test('le domande sì/no dello stesso gruppo stanno su una sola schermata', () => {
  const solo = schermate(questionario, { composizione: 'solo' });
  const dip = schermate(questionario, { composizione: 'dipendenti', sede: true });
  assert.ok(solo.length <= 10, `troppe schermate: ${solo.length}`);
  assert.ok(dip.length <= 14, `troppe schermate: ${dip.length}`);
  const lav = dip.find((s) => s.gruppo === 'lavorazioni');
  assert.ok(lav.domande.length >= 10 && lav.titolo);
  for (const d of questionario.domande.filter((x) => x.gruppo)) {
    assert.equal(d.tipo, 'sino', `${d.id}: nei gruppi solo domande sì/no`);
    assert.ok(d.breve, `${d.id}: manca il testo breve`);
  }
});

test('requisiti del lavoratore: base, ruoli e lavorazioni', () => {
  const ctxBase = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 3, rumore_vibrazioni: true }, questionario);
  const l = { id: 'l1', nome: 'Mario', ruoli: ['preposto'] };
  const ids = requisitiLavoratore(l, defLav, ctxBase).map((r) => r.id);
  for (const id of ['formazione-generale', 'formazione-specifica', 'visita-medica', 'consegna-dpi', 'corso-preposto']) assert.ok(ids.includes(id), `manca ${id}`);
  assert.ok(!ids.includes('corso-primo-soccorso'));
  assert.ok(!ids.includes('patentino-macchine'), 'serve solo se l\'impresa usa macchine');
  const senzaRischi = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 3 }, questionario);
  assert.ok(!requisitiLavoratore(l, defLav, senzaRischi).some((r) => r.id === 'visita-medica'));
  for (const r of defLav.requisiti) assert.ok(!r.ruolo || defLav.ruoli.some((x) => x.id === r.ruolo), `${r.id}: ruolo sconosciuto`);
  for (const r of defLav.requisiti) assert.ok(catalogo.schede.some((s) => s.id === r.schedaId), `${r.id}: scheda ${r.schedaId} inesistente`);
});

test('situazione del lavoratore: semaforo con registrazioni e visita non idoneo', () => {
  const ctx = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 2, carichi: true }, questionario);
  const l = { id: 'l1', nome: 'Anna', ruoli: [] };
  const registri = [
    { id: 'r1', lavoratoreId: 'l1', requisitoId: 'formazione-generale', data: '2025-03-01' },
    { id: 'r2', lavoratoreId: 'l1', requisitoId: 'formazione-specifica', data: '2021-12-01' },
    { id: 'r3', lavoratoreId: 'l1', requisitoId: 'formazione-specifica', data: '2025-12-01', deleted: true },
    { id: 'r4', lavoratoreId: 'l1', requisitoId: 'visita-medica', data: '2026-10-01', scadenzaManuale: '2027-10-01', esito: 'non_idoneo_temporaneo' }
  ];
  const s = situazioneLavoratore({ lavoratore: l, defLavoratori: defLav, registri, ctx, oggi: '2026-11-24' });
  const col = Object.fromEntries(s.voci.map((v) => [v.requisito.id, v.colore]));
  assert.equal(col['formazione-generale'], 'verde');
  // 2021-12-01 + 60 mesi = 2026-12-01: entro 60 giorni, quindi in scadenza (la registrazione cancellata non conta)
  assert.equal(col['formazione-specifica'], 'giallo');
  assert.equal(col['visita-medica'], 'giallo', 'non idoneo temporaneo va tenuto d\'occhio');
  assert.equal(col['consegna-dpi'], 'rosso');
  assert.equal(s.colore, 'rosso');
  assert.equal(s.voci[0].colore, 'rosso', 'le voci rosse vengono prima');
});

test('urgenze dei lavoratori e lavoratori cessati', () => {
  const ctx = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 2 }, questionario);
  const lavoratori = [
    { id: 'a', nome: 'Bruno', ruoli: [] },
    { id: 'b', nome: 'Carla', ruoli: [], dataCessazione: '2026-01-31' },
    { id: 'c', nome: 'Dario', ruoli: [], deleted: true }
  ];
  assert.deepEqual(lavoratoriAttivi(lavoratori, '2026-11-24').map((l) => l.id), ['a']);
  const urg = urgenzeLavoratori({ lavoratori, defLavoratori: defLav, registri: [], ctx, oggi: '2026-11-24' });
  assert.ok(urg.length > 0 && urg.every((u) => u.lavoratore.id === 'a'));
});
