import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizza, radice, normeCitate, rischiDaTesto, costruisciIndice, cerca, raggruppa, collegati, voce, perDocumento, verifiche, verifichePer, interpreta, sigleNelTesto } from '../js/conoscenza.js';
import { creaContesto } from '../js/engine.js';
import { MODELLI } from '../js/modelli.js';

const j = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const conoscenza = j('conoscenza.json');
const dvr = j('dvr.json');
const catalogo = j('catalogo.json');
const defAttr = j('attrezzature.json');
const lavorazioni = j('lavorazioni.json');
const defLav = j('lavoratori.json');
const defArchivio = j('archivio.json');
const questionario = j('questionario.json');
const ateco = j('ateco.json');
const indice = costruisciIndice({ conoscenza, dvr, catalogo, modelli: MODELLI, defAttr, lavorazioni, defLav, defArchivio });
const primi = (q, n = 3) => cerca(indice, q).risultati.slice(0, n).map((r) => `${r.tipo}:${r.id}`);

test('normalizzazione e radici', () => {
  assert.equal(normalizza('  Perché l’RSPP è già…? '), 'perche l rspp e gia');
  assert.equal(radice('ponteggi'), radice('ponteggio'));
  assert.equal(radice('formazione'), radice('formazioni'));
  assert.equal(radice('81'), '81');
  assert.equal(radice('gru'), 'gru');
});

test('le norme citate nei testi si riconoscono, anche scritte in modi diversi', () => {
  const n = conoscenza.norme;
  assert.deepEqual(normeCitate('D.Lgs. 81/2008 art. 45; DM 388/2003', n), ['dlgs-81-2008', 'dm-388-2003']);
  assert.deepEqual(normeCitate('DM 1, 2 e 3 settembre 2021', n).sort(), ['dm-1-9-2021', 'dm-2-9-2021', 'dm-3-9-2021']);
  assert.deepEqual(normeCitate('Reg. UE 2016/679 (GDPR)', n), ['gdpr']);
  assert.deepEqual(normeCitate('DL 1/1990', n), [], 'L. 1/1990 non deve scattare dentro un altro numero');
  assert.deepEqual(normeCitate('', n), []);
});

test('ogni norma della banca ha sigla, titolo e almeno un alias; gli id sono unici', () => {
  const ids = new Set();
  for (const x of conoscenza.norme) {
    assert.ok(x.sigla && x.titolo && x.alias.length && x.ambito, x.id);
    assert.ok(!ids.has(x.id), `id doppio ${x.id}`);
    ids.add(x.id);
  }
});

test('le norme citate nel catalogo e nel DVR sono quasi tutte riconosciute', () => {
  const schede = catalogo.schede.filter((s) => s.riferimento && !normeCitate(s.riferimento, conoscenza.norme).length).map((s) => s.id);
  assert.ok(schede.length <= 2, `schede senza norme riconosciute: ${schede}`);
  for (const r of dvr.pericoli) assert.ok(normeCitate(r.norma, conoscenza.norme).length, `rischio ${r.id}`);
});

test('i collegamenti della banca puntano a voci esistenti', () => {
  const rischi = new Set(dvr.pericoli.map((r) => r.id));
  const schede = new Set(catalogo.schede.map((s) => s.id));
  const norme = new Set(conoscenza.norme.map((n) => n.id));
  for (const [mod, d] of Object.entries(conoscenza.documenti)) {
    assert.ok(MODELLI.some((m) => m.id === mod), mod);
    d.rischi.forEach((r) => assert.ok(rischi.has(r), `${mod}: ${r}`));
    d.adempimenti.forEach((s) => assert.ok(schede.has(s), `${mod}: ${s}`));
    d.norme.forEach((n) => assert.ok(norme.has(n), `${mod}: ${n}`));
    assert.ok(d.consigli.length >= 2, `${mod}: pochi consigli`);
  }
  for (const m of MODELLI) assert.ok(conoscenza.documenti[m.id], `manca l'aiuto per ${m.id}`);
  for (const r of Object.values(conoscenza.pericoliAttrezzature)) assert.ok(rischi.has(r), r);
  for (const x of defAttr.pericoli) assert.ok(conoscenza.pericoliAttrezzature[x.id], `pericolo attrezzatura senza rischio: ${x.id}`);
  for (const x of conoscenza.parolePericoli) x.pericoli.forEach((r) => assert.ok(rischi.has(r), r));
  for (const r of dvr.pericoli) assert.ok(r.miglioramenti?.length >= 2, `miglioramenti per ${r.id}`);
});

test("l'indice contiene tutte le banche dati", () => {
  const conta = (t) => indice.voci.filter((v) => v.tipo === t).length;
  assert.equal(conta('rischio'), dvr.pericoli.length);
  assert.equal(conta('adempimento'), catalogo.schede.length);
  assert.equal(conta('documento'), MODELLI.length);
  assert.equal(conta('attrezzatura'), defAttr.tipi.length);
  assert.equal(conta('fase'), lavorazioni.fasiCantiere.length);
  assert.equal(conta('norma'), conoscenza.norme.length);
  assert.equal(conta('sigla'), conoscenza.glossario.length);
  assert.equal(new Set(indice.voci.map((v) => v.chiave)).size, indice.voci.length, 'chiavi uniche');
});

test('ricerca con le parole di tutti i giorni', () => {
  assert.equal(primi('muletto')[0], 'attrezzatura:carrello');
  assert.ok(primi('eternit').includes('adempimento:amianto'));
  assert.ok(primi('frullino', 5).some((x) => x.startsWith('fase:')));
  assert.equal(primi('ponteggi', 2).includes('attrezzatura:ponteggio'), true);
  assert.equal(primi('corso preposto')[0], 'requisito:corso-preposto');
  assert.equal(primi('DUVRI')[0], 'sigla:duvri');
  assert.equal(primi('D.Lgs. 81/2008')[0], 'norma:dlgs-81-2008');
  assert.ok(primi('incinta').includes('rischio:tutele'));
  assert.ok(primi('telecamere').includes('adempimento:videosorveglianza'));
  assert.ok(primi('saldatura', 4).includes('documento:permesso-lavoro-caldo'));
  assert.equal(primi('rumore')[0], 'rischio:rumore');
});

test('ricerca: plurali, accenti, maiuscole e parole a metà', () => {
  assert.deepEqual(primi('ESTINTORI', 1), primi('estintore', 1));
  assert.ok(cerca(indice, 'idoneita').risultati.length);
  assert.ok(cerca(indice, 'ponteg').risultati.some((r) => r.id === 'ponteggio'));
});

test('ricerca: domanda vuota, parole inutili e parole sconosciute', () => {
  assert.deepEqual(cerca(indice, '').risultati, []);
  assert.deepEqual(cerca(indice, 'cosa devo fare per il').risultati, []);
  assert.deepEqual(cerca(indice, 'xyzzzq').risultati, []);
  const r = cerca(indice, 'ponteggio xyzzzq');
  assert.equal(r.parziale, true, 'se una parola non si trova si mostrano i risultati parziali');
  assert.ok(r.risultati.length);
});

test('sinonimi riconosciuti nella domanda', () => {
  const q = interpreta('Ho un muletto in magazzino', indice.sinonimi);
  assert.ok(q.espansioni.some((e) => e.termini.includes('carrello')));
  assert.ok(!q.termini.includes('un'));
});

test('raggruppamento per tipo nell\'ordine previsto', () => {
  const g = raggruppa(cerca(indice, 'ponteggio').risultati);
  assert.ok(g.length >= 2);
  assert.ok(g.every((x) => x.voci.length && x.titolo));
});

test('collegamenti tra rischi, attrezzature, documenti e norme', () => {
  const quota = collegati(indice, voce(indice, 'rischio', 'quota')).map((x) => x.chiave);
  assert.ok(quota.includes('adempimento:lavori-quota'));
  assert.ok(quota.includes('attrezzatura:ponteggio'));
  assert.ok(quota.includes('documento:pos-bozza'));
  const muletto = voce(indice, 'attrezzatura', 'carrello');
  assert.ok(muletto.rischi.includes('attrezzature-abilitazione'));
  const ps = collegati(indice, voce(indice, 'norma', 'dm-388-2003')).map((x) => x.chiave);
  assert.ok(ps.includes('adempimento:primo-soccorso'));
  assert.deepEqual(collegati(indice, null), []);
});

test('le fasi di cantiere e gli appalti sono collegati ai rischi del DVR', () => {
  assert.ok(voce(indice, 'fase', 'coperture').rischi.includes('quota'));
  assert.ok(voce(indice, 'fase', 'demolizioni').rischi.length >= 2);
  assert.ok(voce(indice, 'appalto', 'manutenzione').rischi.includes('interferenze'));
  assert.deepEqual(rischiDaTesto('Rumore e vibrazioni', conoscenza.parolePericoli).sort(), ['rumore', 'vibrazioni']);
});

test('aiuto per ogni documento', () => {
  for (const m of MODELLI) {
    const a = perDocumento(indice, m.id);
    assert.ok(a && a.consigli.length, m.id);
    assert.ok(a.norme.length, `norme per ${m.id}`);
  }
  const pos = perDocumento(indice, 'pos-bozza');
  assert.ok(pos.adempimenti.some((x) => x.id === 'patente-crediti'));
  assert.ok(pos.sigle.some((g) => g.sigla === 'POS'));
  assert.equal(perDocumento(indice, 'inesistente'), null);
  assert.deepEqual(sigleNelTesto('Il DPI e il DVR', conoscenza.glossario).map((g) => g.sigla).sort(), ['DPI', 'DVR']);
});

// ---------- verifiche ----------

const OGGI = '2026-11-25';
const base = (risposte, extra = {}) => ({
  ctx: creaContesto({ composizione: 'dipendenti', numero_lavoratori: 3, sede: true, dl_rspp: true, ...risposte }, questionario, ateco),
  anagrafica: { rls: 'Mario', medico: 'Dott. Rossi' },
  defAttr,
  oggi: OGGI,
  lavoratori: [{ id: 'l1', nome: 'Anna', mansione: 'Operaia', ruoli: ['primo_soccorso', 'antincendio'] }],
  archivio: [{ id: 'p1', genere: 'planimetria', tipo: 'emergenza' }],
  opzioniDocumenti: { 'valutazione-incendio': {} },
  ...extra
});
const ids = (d) => verifiche(d).map((x) => x.id);

test('impresa in ordine: nessuna verifica aperta', () => {
  assert.deepEqual(ids(base({})), []);
  assert.deepEqual(verifiche({}), []);
});

test('prodotti cancerogeni non valutati nel DVR', () => {
  const d = base({ chimici: true }, { prodotti: [{ id: 'p', nome: 'Diluente X', frasiH: 'H225 H350', dataSds: '2026-01-01' }], opzioniDocumenti: { 'valutazione-incendio': {}, 'valutazione-chimico': { righe: [{ a: 'x', b: 'y' }] } } });
  const v = verifiche(d);
  assert.deepEqual(v.map((x) => x.id), ['cmr-non-valutati']);
  assert.equal(v[0].livello, 'alto');
  assert.match(v[0].spiegazione, /Diluente X/);
  assert.ok(v[0].documenti.includes('dvr-bozza'));
  assert.equal(v[0].azione.href, '#/domanda/polveri_cancerogene');
  d.ctx = creaContesto({ ...d.ctx.risposte, polveri_cancerogene: true }, questionario, ateco);
  assert.deepEqual(ids(d), []);
});

test('prodotti registrati senza rischio chimico, e viceversa', () => {
  assert.ok(ids(base({}, { prodotti: [{ id: 'p', nome: 'Detergente', dataSds: '2026-01-01' }] })).includes('prodotti-senza-rischio-chimico'));
  const v = ids(base({ chimici: true }));
  assert.ok(v.includes('chimico-senza-prodotti'));
  assert.ok(v.includes('valutazione-valutazione-chimico'));
  assert.ok(ids(base({ chimici: true }, { prodotti: [{ id: 'p', nome: 'Colla' }] })).includes('sds-mancanti'));
  assert.ok(!ids(base({ chimici: true }, { prodotti: [{ id: 'p', nome: 'Colla' }], contaAllegati: () => 1 })).includes('sds-mancanti'));
});

test('attrezzature con patentino: risposta e operatori abilitati', () => {
  const att = [{ id: 'a1', nome: 'Muletto', tipo: 'carrello', pericoli: [] }];
  const allegati = () => 1;
  let v = ids(base({}, { attrezzature: att, contaAllegati: allegati }));
  assert.ok(v.includes('abilitazione-risposta'));
  assert.ok(v.includes('abilitazione-operatori'));
  v = ids(base({ attrezzature_abilitazione: true }, { attrezzature: att, contaAllegati: allegati, lavoratori: [{ id: 'l1', mansione: 'Magazziniere', ruoli: ['macchine', 'primo_soccorso', 'antincendio'] }] }));
  assert.deepEqual(v, []);
});

test('lavori in quota, ponteggio e PiMUS', () => {
  const att = [{ id: 'pz', nome: 'Ponteggio Pilosio', tipo: 'ponteggio', pericoli: ['caduta_alto'] }];
  const v = ids(base({}, { attrezzature: att, contaAllegati: (t, id, c) => (c === 'libretto' ? 1 : 0) }));
  assert.ok(v.includes('quota-risposta'));
  assert.ok(v.includes('quota-addestrati'));
  assert.ok(v.includes('pimus'));
  const ok = ids(base({ quota: true }, { attrezzature: att, contaAllegati: () => 1, controlli: [{ attrezzaturaId: 'pz', controlloId: 'controllo', data: '2026-10-01' }], lavoratori: [{ id: 'l', mansione: 'Muratore', ruoli: ['quota', 'primo_soccorso', 'antincendio'] }] }));
  assert.deepEqual(ok, []);
});

test('libretti mancanti e pericoli da confermare', () => {
  const v = verifiche(base({}, { attrezzature: [{ id: 'm', nome: 'Sega a nastro', tipo: 'macchina' }, { id: 'u', nome: 'Trapano', tipo: 'utensile', pericoli: [] }] }));
  const lib = v.find((x) => x.id === 'libretti-mancanti');
  assert.match(lib.spiegazione, /Sega a nastro/);
  assert.doesNotMatch(lib.spiegazione, /Trapano/, 'per gli utensili manuali il libretto non si chiede');
  assert.ok(v.some((x) => x.id === 'pericoli-non-confermati' && x.livello === 'basso'));
  assert.ok(!ids(base({}, { attrezzature: [{ id: 'm', tipo: 'macchina', dismessa: true }] })).length);
});

test('figure della sicurezza e addetti alle emergenze', () => {
  const v = ids(base({ dl_rspp: false, rumore_vibrazioni: true }, { anagrafica: {}, lavoratori: [{ id: 'l', nome: 'A', ruoli: [] }] }));
  for (const id of ['mansioni-mancanti', 'addetti-primo-soccorso', 'addetti-antincendio', 'rspp-mancante', 'medico-mancante', 'rls-mancante']) assert.ok(v.includes(id), id);
  assert.ok(!ids(base({ composizione: 'solo_titolare' }, { lavoratori: [] })).includes('addetti-primo-soccorso'), 'senza dipendenti non servono addetti');
  assert.ok(!ids(base({}, { lavoratori: [{ id: 'x', nome: 'Cessato', dataCessazione: '2026-01-01', ruoli: [] }, ...base({}).lavoratori] })).includes('mansioni-mancanti'));
});

test('archivio: planimetria di emergenza e documenti scaduti', () => {
  assert.ok(ids(base({}, { archivio: [] })).includes('planimetria-emergenza'));
  const v = verifiche(base({}, { archivio: [...base({}).archivio, { id: 'c', genere: 'certificato', titolo: 'Verifica messa a terra', scadenza: '2026-01-01' }, { id: 'v', genere: 'certificato', titolo: 'Vecchio', scadenza: '2020-01-01', sostituitoDa: 'c' }] }));
  const s = v.find((x) => x.id === 'certificati-scaduti');
  assert.match(s.titolo, /Un documento scaduto/);
});

test('infortunio dopo il DVR: va rielaborato (art. 29 c. 3)', () => {
  const adempimenti = [{ id: 'dvr', schedaId: 'dvr', fatto: true, dataFatto: '2026-03-01' }];
  const eventi = [{ id: 'e', tipo: 'infortunio', data: '2026-06-10', giorniPrognosi: 10 }];
  const v = verifiche(base({}, { adempimenti, eventi }));
  const x = v.find((y) => y.id === 'dvr-dopo-infortunio');
  assert.ok(x, JSON.stringify(v.map((y) => y.id)));
  assert.equal(x.livello, 'alto');
  assert.match(x.spiegazione, /01\/03\/2026/);
  assert.ok(!ids(base({}, { adempimenti, eventi: [{ ...eventi[0], data: '2026-02-01' }] })).includes('dvr-dopo-infortunio'));
  assert.ok(!ids(base({}, { adempimenti, eventi: [{ ...eventi[0], tipo: 'quasi_incidente' }] })).includes('dvr-dopo-infortunio'));
});

test('POS: lavorazioni da scegliere e demolizioni senza verifica amianto', () => {
  assert.ok(ids(base({ cantiere: true })).includes('pos-senza-fasi'));
  const od = (fasi) => ({ 'valutazione-incendio': {}, 'pos-bozza': { fasi } });
  assert.ok(ids(base({ cantiere: true }, { opzioniDocumenti: od(['demolizioni']) })).includes('demolizioni-amianto'));
  assert.deepEqual(ids(base({ cantiere: true, amianto: true }, { opzioniDocumenti: od(['demolizioni']) })), []);
  assert.deepEqual(ids(base({ cantiere: true }, { opzioniDocumenti: od(['murature']) })), []);
});

test('valutazioni specifiche richiamate dal DVR', () => {
  const v = ids(base({ rumore_vibrazioni: true, carichi: true }, { opzioniDocumenti: {} }));
  for (const id of ['valutazione-valutazione-rumore', 'valutazione-valutazione-vibrazioni', 'valutazione-valutazione-mmc', 'valutazione-incendio']) assert.ok(v.includes(id), id);
  const piene = { 'valutazione-incendio': {}, 'valutazione-rumore': { righe: [{ attivita: 'Sega', lex: '88' }] }, 'valutazione-vibrazioni': { righe: [{ a: 'Martello', b: '6' }] }, 'valutazione-mmc': { compiti: [{ compito: 'Sacchi', peso: '25' }] } };
  assert.deepEqual(ids(base({ rumore_vibrazioni: true, carichi: true }, { opzioniDocumenti: piene })), []);
  const vuote = { ...piene, 'valutazione-rumore': { righe: [{ attivita: '', lex: '' }] } };
  assert.ok(ids(base({ rumore_vibrazioni: true, carichi: true }, { opzioniDocumenti: vuote })).includes('valutazione-valutazione-rumore'));
});

test('le verifiche sono ordinate per gravità e indicano i documenti interessati', () => {
  const v = verifiche(base({ dl_rspp: false, chimici: true }, { anagrafica: {}, lavoratori: [] , archivio: [] }));
  const ordine = { alto: 0, medio: 1, basso: 2 };
  for (let i = 1; i < v.length; i++) assert.ok(ordine[v[i - 1].livello] <= ordine[v[i].livello]);
  for (const x of v) {
    assert.ok(x.titolo && x.spiegazione && x.azione?.href && x.documenti.length, x.id);
    for (const d of x.documenti) assert.ok(MODELLI.some((m) => m.id === d), `${x.id}: documento ${d}`);
  }
  assert.ok(verifichePer(v, 'nomina-rspp-esterno').some((x) => x.id === 'rspp-mancante'));
});
