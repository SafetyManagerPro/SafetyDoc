import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { frasiCmr, situazioneProdotto, situazioneEvento, urgenzeEventi, eventiPerAnno, creaContesto } from '../js/engine.js';
import { generaDocumento, modelliDisponibili, ALLERGENI, RISCHI_MATERNITA } from '../js/modelli.js';
import { COLLEZIONI, migra, SCHEMA_VERSION } from '../js/merge.js';

const json = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const questionario = json('questionario.json');
const ateco = json('ateco.json');
const dvr = json('dvr.json');
const anagrafica = { ragioneSociale: 'Edil Rossi', titolare: 'Luca Rossi', comune: 'Avellino' };

test('frasi H per cancerogeni, mutageni e tossici per la riproduzione', () => {
  assert.deepEqual(frasiCmr('H225 H319 h350i H360FD'), ['H350I', 'H360FD']);
  assert.deepEqual(frasiCmr('H315 H317'), []);
});

test('semaforo dei prodotti', () => {
  assert.equal(situazioneProdotto({ nome: 'X' }).colore, 'rosso');
  assert.equal(situazioneProdotto({ nome: 'X' }, 1).colore, 'verde');
  assert.equal(situazioneProdotto({ nome: 'X', dataSds: '2025-01-01', frasiH: 'H350' }).colore, 'giallo');
});

test('infortuni: denuncia INAIL, comunicazione statistica e misure', () => {
  const oggi = '2026-11-24';
  const grave = situazioneEvento({ tipo: 'infortunio', data: '2026-11-20', dataCertificato: '2026-11-23', giorniPrognosi: 10 }, oggi);
  assert.equal(grave.colore, 'rosso');
  assert.equal(grave.scadenza, '2026-11-25');
  assert.match(grave.motivo, /Denuncia/);
  const lieve = situazioneEvento({ tipo: 'infortunio', data: '2026-11-23', giorniPrognosi: 2 }, oggi);
  assert.equal(lieve.colore, 'giallo');
  assert.match(lieve.motivo, /fini statistici/);
  const tardi = situazioneEvento({ tipo: 'infortunio', data: '2026-11-01', giorniPrognosi: 2 }, oggi);
  assert.equal(tardi.colore, 'rosso');
  assert.equal(situazioneEvento({ tipo: 'infortunio', data: '2026-11-01' }, oggi).motivo, 'Scrivi i giorni di prognosi del certificato medico');
  const chiuso = situazioneEvento({ tipo: 'infortunio', data: '2026-11-01', giorniPrognosi: 5, dataDenuncia: '2026-11-02', misureFatte: true }, oggi);
  assert.equal(chiuso.colore, 'verde');
  assert.equal(situazioneEvento({ tipo: 'quasi_incidente', data: '2026-11-01' }, oggi).colore, 'giallo');
  assert.equal(urgenzeEventi([{ tipo: 'quasi_incidente', data: '2026-11-01', misureFatte: true }, { tipo: 'quasi_incidente', data: '2026-11-01', deleted: true }], oggi).length, 0);
});

test('eventi per anno', () => {
  const r = eventiPerAnno([{ tipo: 'infortunio', data: '2025-03-01' }, { tipo: 'infortunio', data: '2025-05-01' }, { tipo: 'quasi_incidente', data: '2026-01-01' }, { tipo: 'infortunio', data: '2020-01-01' }], [2024, 2025, 2026]);
  assert.equal(r[2025].infortunio, 2);
  assert.equal(r[2026].quasi_incidente, 1);
  assert.equal(r[2024].infortunio, 0);
});

test('backup: le nuove raccolte esistono e i vecchi file vengono migrati', () => {
  assert.equal(SCHEMA_VERSION, 5);
  for (const c of ['prodotti', 'eventi']) assert.ok(COLLEZIONI.includes(c));
  const m = migra({ schemaVersion: 3, collezioni: { profilo: [] } });
  assert.deepEqual(m.collezioni.prodotti, []);
  assert.deepEqual(m.collezioni.eventi, []);
});

test('modelli disponibili secondo le risposte', () => {
  const base = { composizione: 'dipendenti', numero_lavoratori: 4, ateco: '56.10' };
  const ids = (r) => modelliDisponibili(creaContesto({ ...base, ...r }, questionario, ateco)).map((m) => m.id);
  assert.ok(ids({}).includes('informativa-lavoratrici-madri'));
  assert.ok(!ids({}).includes('cartello-allergeni'));
  assert.ok(ids({ alimenti: true }).includes('cartello-allergeni'));
  assert.ok(ids({ alimenti: true }).includes('registro-temperature'));
  assert.ok(ids({ cantiere: true }).includes('pos-bozza'));
  assert.ok(ids({ lavori_presso_clienti: true }).includes('autocertificazione-idoneita'));
  assert.ok(ids({ appalti_in_sede: true }).includes('duvri-bozza'));
  assert.ok(ids({ minori: true }).includes('informativa-minori'));
});

test('informativa lavoratrici: solo i rischi presenti, più quelli sempre validi', () => {
  const ctx = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 3, carichi: true, notte_guida: false }, questionario, ateco);
  const html = generaDocumento('informativa-lavoratrici-madri', { anagrafica, oggi: '2026-11-24', dvr, ctx, lavoratori: [] }).html;
  assert.ok(html.includes('Sollevamento e trasporto di pesi'));
  assert.ok(html.includes('Lavoro in piedi'));
  assert.ok(!html.includes('Lavoro notturno'));
  for (const r of RISCHI_MATERNITA) if (r.pericolo) assert.ok(dvr.pericoli.some((p) => p.id === r.pericolo), `pericolo ${r.pericolo} inesistente`);
});

test('POS, registri, allergeni e stress si compilano con i dati', () => {
  const ctx = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 2, cantiere: true }, questionario, ateco);
  const lavoratori = [{ id: 'l1', nome: 'Mario', cognome: 'Bianchi', mansione: 'Muratore', ruoli: ['preposto'] }];
  const pos = generaDocumento('pos-bozza', { anagrafica, oggi: '2026-11-24', ctx, lavoratori, attrezzature: [{ nome: 'Trabattello' }], prodotti: [{ nome: 'Malta', pittogrammi: ['GHS05'] }], ruoli: { preposto: 'Preposto' } }).html;
  for (const x of ['Bianchi Mario', 'Muratore', 'Preposto', 'Trabattello', 'Malta', 'GHS05', 'Allegato XV']) assert.ok(pos.includes(x) || pos.includes('Mario Bianchi'), x);
  const reg = generaDocumento('registro-eventi', { anagrafica, oggi: '2026-11-24', lavoratori, eventi: [{ id: 'e1', tipo: 'infortunio', data: '2026-11-20', lavoratoreId: 'l1', giorniPrognosi: 5, dataDenuncia: '2026-11-21', misure: 'Nuova scala', misureFatte: true }] }).html;
  assert.ok(reg.includes('5 gg') && reg.includes('21/11/2026') && reg.includes('Nuova scala ✓'));
  const all = generaDocumento('cartello-allergeni', { anagrafica, oggi: '2026-11-24' }).html;
  assert.equal(ALLERGENI.length, 14);
  assert.ok(all.includes('Molluschi'));
  const stress = generaDocumento('stress-preliminare', { anagrafica, oggi: '2026-11-24', perAnno: { 2024: { infortunio: 0 }, 2025: { infortunio: 3 }, 2026: { infortunio: 1 } } }).html;
  assert.ok(stress.includes('<th>2025</th>') && stress.includes('<td>3</td>'));
});

test('esempi per settore: un pacchetto per ogni attività e tipi di attrezzatura validi', () => {
  const settori = json('settori.json').settori;
  const tipi = new Set(json('attrezzature.json').tipi.map((t) => t.id));
  const attivita = questionario.domande.find((d) => d.id === 'attivita').opzioni.map((o) => o.valore);
  for (const a of attivita) assert.ok(settori[a], `manca il settore ${a}`);
  for (const [k, s] of Object.entries(settori)) {
    for (const a of s.attrezzature) assert.ok(tipi.has(a.tipo), `${k}: tipo ${a.tipo}`);
    assert.equal(new Set(s.attrezzature.map((a) => a.nome)).size, s.attrezzature.length, `${k}: doppioni`);
  }
});

import { confrontaVersioni, domandeSenzaRisposta, schermataSenzaRisposta, novitaDaMostrare } from '../js/engine.js';
import { LINGUE, TESTI } from '../js/lingue.js';

test('versioni, novità e domande nuove', () => {
  assert.ok(confrontaVersioni('0.10.0', '0.9.0') > 0);
  assert.equal(confrontaVersioni('0.6.0', '0.6'), 0);
  const catalogo = json('catalogo.json');
  const n = novitaDaMostrare(catalogo, '0.5.0', ['duvri', 'dvr']);
  assert.equal(n.length, 1);
  assert.deepEqual(n[0].schede, ['duvri']);
  assert.equal(novitaDaMostrare(catalogo, catalogo.versione, ['duvri']).length, 0);
  const ids = new Set(catalogo.schede.map((s) => s.id));
  for (const x of catalogo.novita) for (const id of x.schede) assert.ok(ids.has(id), id);
  const vecchie = { __completato: true, nome_impresa: 'X', ateco: '', attivita: 'altro', forma_giuridica: 'individuale', artigiano: false, composizione: 'solo', sede: true, rischio_incendio: 'no', rifiuti_pericolosi: 'no' };
  const mancanti = domandeSenzaRisposta(questionario, vecchie).map((d) => d.id);
  assert.ok(mancanti.includes('alimenti') && mancanti.includes('lavori_presso_clienti'));
  assert.ok(!mancanti.includes('minori'), 'solo per chi ha dipendenti');
  const i = schermataSenzaRisposta(questionario, vecchie);
  assert.ok(i > 0);
  const tutte = Object.fromEntries(mancanti.map((id) => [id, false]));
  assert.equal(schermataSenzaRisposta(questionario, { ...vecchie, ...tutte }), -1);
});

test('regole tradotte: stesse voci in tutte le lingue', () => {
  for (const k of Object.keys(LINGUE)) {
    assert.ok(TESTI[k], k);
    assert.equal(TESTI[k].regole.length, TESTI.it.regole.length, k);
    for (const campo of Object.keys(TESTI.it)) assert.ok(TESTI[k][campo], `${k}.${campo}`);
  }
  const html = generaDocumento('regole-lavoratore', { anagrafica, oggi: '2026-11-24', lavoratore: { nome: 'Ahmed', cognome: 'Karim', lingua: 'ar' }, lavoratori: [] }).html;
  assert.ok(html.includes('dir="rtl"') && html.includes('Regole di sicurezza sul lavoro'));
});

const lavorazioni = json('lavorazioni.json');

test('dati per DVR, POS e DUVRI completi e coerenti', () => {
  for (const p of dvr.pericoli) {
    for (const k of ['danno', 'probabilita', 'magnitudo', 'dpi', 'formazione', 'norma']) assert.ok(p[k] !== undefined, `${p.id}.${k}`);
    assert.ok(p.probabilita >= 1 && p.probabilita <= 4 && p.magnitudo >= 1 && p.magnitudo <= 4, p.id);
  }
  for (let R = 1; R <= 16; R++) if ([1, 2, 3, 4, 6, 8, 9, 12, 16].includes(R)) assert.ok(dvr.criteri.livelli.some((l) => R >= l.da && R <= l.a), `R=${R} senza livello`);
  for (const f of lavorazioni.fasiCantiere) for (const k of ['attrezzature', 'rischi', 'misure', 'dpi']) assert.ok(f[k].length, `${f.id}.${k}`);
  for (const t of lavorazioni.tipiAppalto) assert.ok(t.interferenze.length && t.costi.length, t.id);
});

test('POS dettagliato con cantiere, lavorazioni scelte e lavoratori', () => {
  const ctx = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 2, cantiere: true }, questionario, ateco);
  const lavoratori = [{ id: 'l1', nome: 'Mario', cognome: 'Bianchi', mansione: 'Muratore', ruoli: ['preposto', 'primo_soccorso'] }, { id: 'l2', nome: 'Gianni', cognome: 'Neri', mansione: 'Manovale', ruoli: [] }];
  const html = generaDocumento('pos-bozza', {
    anagrafica, oggi: '2026-11-24', ctx, lavoratori, lavorazioni, ruoli: { preposto: 'Preposto' },
    macchine: [{ attrezzatura: { nome: 'Betoniera', tipo: 'macchina' }, tipo: { etichetta: 'Macchina' }, colore: 'verde', voci: [] }],
    opzioni: { indirizzo: 'Via Roma 1, Avellino', cse: 'Ing. Verdi', fasi: ['murature', 'ponteggi'], lavoratori: ['l1'], capocantiere: 'l1' }
  }).html;
  for (const x of ['Via Roma 1, Avellino', 'Ing. Verdi', 'Murature e tramezzature', 'Montaggio, uso e smontaggio di ponteggi', 'PiMUS', 'Betoniera', 'Casco', 'Allegato XV']) assert.ok(html.includes(x), `manca ${x}`);
  assert.ok(!html.includes('Gianni'), 'solo i lavoratori scelti');
  assert.ok(!html.includes('Scavi e movimento terra'), 'solo le fasi scelte');
});

test('DUVRI dettagliato: interferenze del tipo di appalto, costi e applicabilità', () => {
  const ctx = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 3, appalti_in_sede: true, sede: true }, questionario, ateco);
  const base = { anagrafica, oggi: '2026-11-24', ctx, dvr, lavoratori: [], lavorazioni };
  const html = generaDocumento('duvri-bozza', { ...base, opzioni: { tipo: 'impianti', appaltatore: 'Elettro Sud srl', uominiGiorno: '12' } }).html;
  for (const x of ['Elettro Sud srl', 'Lavori a caldo', 'Permesso di lavoro a caldo', 'Estintore aggiuntivo', 'Il DUVRI è obbligatorio', 'R = P × D']) assert.ok(html.includes(x), `manca ${x}`);
  const breve = generaDocumento('duvri-bozza', { ...base, opzioni: { tipo: 'pulizie', uominiGiorno: '3' } }).html;
  assert.ok(breve.includes('non sarebbe obbligatorio'));
});

test('nuovi documenti: emergenza, informazione, addestramento, elezione RLS', () => {
  const ctx = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 3, carichi: true }, questionario, ateco);
  const lavoratori = [{ id: 'l1', nome: 'Anna', cognome: 'Verdi', mansione: 'Commessa', ruoli: ['antincendio'] }];
  const em = generaDocumento('piano-emergenza-doc', { anagrafica, oggi: '2026-11-24', lavoratori, opzioni: { raccolta: 'Parcheggio' } }).html;
  assert.ok(em.includes('Parcheggio') && em.includes('Verdi') && em.includes('Fuga di gas'));
  const inf = generaDocumento('informazione-art36', { anagrafica, oggi: '2026-11-24', lavoratore: lavoratori[0], lavoratori, dvr, ctx }).html;
  assert.ok(inf.includes('Movimentazione manuale') && inf.includes('art. 36'));
  const add = generaDocumento('verbale-addestramento', { anagrafica, oggi: '2026-11-24', lavoratore: lavoratori[0], attrezzature: [{ nome: 'Transpallet' }], opzioni: {} }).html;
  assert.ok(add.includes('Transpallet'));
  const rls = generaDocumento('verbale-elezione-rls', { anagrafica, oggi: '2026-11-24', lavoratori, opzioni: { modalita: 'territoriale' } }).html;
  assert.ok(rls.includes('territoriale') && !rls.includes('accettazione'));
});

test('valutazioni specifiche, incarico RSPP, richiesta visite e lavoro a caldo', () => {
  const g = (id, extra) => generaDocumento(id, { anagrafica, oggi: '2026-11-24', ...extra }).html;
  const rumore = g('valutazione-rumore', { opzioni: { mansione: 'Falegname', righe: [{ attivita: 'Sega circolare', livello: '95', ore: '2' }, { attivita: 'Banco', livello: '70', ore: '6' }] } });
  assert.ok(rumore.includes('LEX,8h = 89') && rumore.includes('87 dB(A)'));
  const vib = g('valutazione-vibrazioni', { opzioni: { righe: [{ attrezzo: 'Martello demolitore', sistema: 'HAV', accelerazione: '12', ore: '1' }] } });
  assert.ok(vib.includes('4.24') || vib.includes('4,24'));
  const mmc = g('valutazione-mmc', { opzioni: { genere: 'uomo', fascia: 'adulto', compiti: [{ compito: 'Sacchi di cemento', peso: '25', altezza: '10', distanza: '40', dislocazione: '90', angolo: '30', frequenza: '1', durata: 'lunga', presa: 'discreta' }] } });
  assert.ok(mmc.includes('Sacchi di cemento') && mmc.includes('Indice oltre 1'));
  const chim = g('valutazione-chimico', { opzioni: { righe: [{ prodotto: 'Diluente', frasiH: 'H225 H336', quantita: 'media', frequenza: 'quotidiana', modalita: 'aperto', ventilazione: 'generale' }] } });
  assert.ok(chim.includes('Diluente') && chim.includes('doc__esito--'));
  const inc = g('valutazione-incendio', { lavoratori: [], opzioni: { soggetta: 'no', persone: '20', superficie: '150', quote: 'si', combustibili: 'no', sostanze: 'no', lavorazioni: 'no' } });
  assert.ok(inc.includes('basso rischio di incendio') && inc.includes('livello 1'));
  const rspp = g('nomina-rspp-esterno', { opzioni: { nome: 'Ing. Bruno', tipo: 'esterno', compenso: '800 €' } });
  assert.ok(rspp.includes('Ing. Bruno') && rspp.includes('art. 36') && rspp.includes('800 €'));
  const sit = [{ lavoratore: { nome: 'Anna', cognome: 'Verdi', mansione: 'Barista' }, voci: [{ requisito: { id: 'visita-medica' }, registro: { data: '2025-12-01' }, prossimaScadenza: '2026-12-10' }] },
    { lavoratore: { nome: 'Paolo', cognome: 'Neri' }, voci: [{ requisito: { id: 'visita-medica' }, registro: null, prossimaScadenza: null }] },
    { lavoratore: { nome: 'Lia', cognome: 'Bo' }, voci: [{ requisito: { id: 'visita-medica' }, registro: { data: '2026-01-01' }, prossimaScadenza: '2027-06-01' }] }];
  const vis = g('richiesta-visite', { situazioni: sit, dvr, ctx: creaContesto({ composizione: 'dipendenti', numero_lavoratori: 3, carichi: true }, questionario, ateco), opzioni: { giorni: '60' } });
  assert.ok(vis.includes('Verdi') && vis.includes('Preventiva') && !vis.includes('Lia'));
  const caldo = g('permesso-lavoro-caldo', { opzioni: { ditta: 'Idro srl', lavoro: ['Brasatura con cannello'] } });
  assert.ok(caldo.includes('Idro srl') && caldo.includes('60 minuti'));
});

test('catalogo: «daVerificare», quando c\'è, è sempre un elenco', () => {
  const c = JSON.parse(readFileSync(new URL('../data/catalogo.json', import.meta.url)));
  for (const s of c.schede) if ('daVerificare' in s) assert.ok(Array.isArray(s.daVerificare), s.id);
});
