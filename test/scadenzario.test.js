import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scadenzaArchivio, durataArchivio, revisioneDocumento, raccogliScadenze, statoScadenza, raggruppaScadenze, conteggiScadenze, testoPromemoria, daNotificare, testoNotifica, perServiceWorker, aggiungiGiorni } from '../js/scadenzario.js';
import { generaPiano, situazioneLavoratore, situazioneAttrezzatura, creaContesto } from '../js/engine.js';
import { MODELLI } from '../js/modelli.js';

const j = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const archivioDef = j('archivio.json');
const conoscenza = j('conoscenza.json');
const catalogo = j('catalogo.json');
const tipo = (id) => archivioDef.certificati.find((t) => t.id === id);
const OGGI = '2026-11-25';

test('scadenze dei certificati secondo la norma', () => {
  assert.equal(scadenzaArchivio(tipo('verifica-terra'), '2022-03-10').scadenza, '2027-03-10', 'DPR 462: 5 anni');
  assert.equal(scadenzaArchivio(tipo('verifica-terra'), '2025-03-10', 'speciali').scadenza, '2027-03-10', 'cantieri: 2 anni');
  assert.equal(scadenzaArchivio(tipo('cpi'), '2021-06-30').scadenza, '2026-06-30');
  assert.equal(scadenzaArchivio(tipo('cpi'), '2021-06-30', 'dieci').scadenza, '2031-06-30');
  assert.equal(scadenzaArchivio(tipo('manutenzione-antincendio'), '2026-08-31').scadenza, '2027-02-28', 'fine mese gestita');
  assert.equal(scadenzaArchivio(tipo('durc'), '2026-11-01').scadenza, '2027-03-01', 'DURC: 120 giorni');
  assert.equal(scadenzaArchivio(tipo('caldaia'), '2024-10-01', 'liquido-oltre').scadenza, '2025-10-01');
  assert.equal(scadenzaArchivio(tipo('autorizzazione-ambientale'), '2020-01-15').scadenza, '2035-01-15', 'AUA 15 anni');
  assert.equal(scadenzaArchivio(tipo('agibilita'), '2020-01-15'), null, 'senza scadenza');
  assert.equal(scadenzaArchivio(tipo('cpi'), ''), null);
  assert.equal(durataArchivio(tipo('cpi'), 'inesistente').id, 'cinque', 'scelta sconosciuta: la prima');
});

test('ogni durata dei certificati ha etichetta, norma e una durata valida', () => {
  for (const t of archivioDef.certificati)
    for (const d of t.durate || []) {
      assert.ok(d.id && d.etichetta && d.norma && d.obbligo, `${t.id}/${d.id}`);
      assert.ok((d.mesi > 0) !== (d.giorni > 0), `${t.id}/${d.id}: mesi oppure giorni`);
    }
});

test('regole di revisione dei documenti', () => {
  for (const [id, d] of Object.entries(conoscenza.documenti)) {
    if (!d.revisione) continue;
    const r = d.revisione;
    if (r.scheda) assert.ok(catalogo.schede.some((s) => s.id === r.scheda && s.tipoScadenza === 'periodica'), `${id}: scheda periodica ${r.scheda}`);
    else assert.ok(r.norma && (r.mesi > 0 || r.evento), id);
  }
  assert.deepEqual(revisioneDocumento({ mesi: 36, norma: 'X', obbligo: 'contratto' }, '2024-05-20'), { tipo: 'periodica', scadenza: '2027-05-20', mesi: 36, norma: 'X', obbligo: 'contratto', nota: '' });
  assert.equal(revisioneDocumento({ scheda: 'dvr' }, '2024-05-20').tipo, 'scheda');
  assert.equal(revisioneDocumento({ evento: 'quando cambia', norma: 'Y' }).tipo, 'evento');
  assert.equal(revisioneDocumento(null).tipo, 'nessuna');
  assert.equal(revisioneDocumento({ mesi: 12 }, '').scadenza, null);
});

test('stato e gruppi delle scadenze', () => {
  assert.equal(statoScadenza('2026-11-24', OGGI), 'scaduta');
  assert.equal(statoScadenza(OGGI, OGGI), 'entro30');
  assert.equal(statoScadenza('2026-12-25', OGGI), 'entro30');
  assert.equal(statoScadenza('2027-02-23', OGGI), 'entro90');
  assert.equal(statoScadenza('2027-03-01', OGGI), 'oltre');
  assert.equal(statoScadenza(null, OGGI), 'dafare');
});

function scenario() {
  const questionario = j('questionario.json');
  const ateco = j('ateco.json');
  const risposte = { __completato: true, composizione: 'dipendenti', numero_lavoratori: 2, sede: true, dl_rspp: true, rumore_vibrazioni: true };
  const ctx = creaContesto(risposte, questionario, ateco);
  const adempimenti = [
    { id: 'a1', schedaId: 'presidi-antincendio', fatto: true, dataFatto: '2026-05-01' },
    { id: 'a2', schedaId: 'rumore-vibrazioni', fatto: true, dataFatto: '2022-12-10' },
    { id: 'a3', schedaId: 'dvr', fatto: true, dataFatto: '2026-02-01' }
  ];
  const piano = generaPiano({ catalogo, questionario, risposte, adempimenti, oggi: OGGI, ateco });
  const lav = { id: 'l1', nome: 'Anna', cognome: 'Verdi', mansione: 'Operaia', ruoli: ['primo_soccorso'] };
  const registri = [{ id: 'r1', lavoratoreId: 'l1', requisitoId: 'corso-primo-soccorso', data: '2023-12-01' }];
  const situazioni = [situazioneLavoratore({ lavoratore: lav, defLavoratori: j('lavoratori.json'), registri, ctx, oggi: OGGI })];
  const att = { id: 'm1', nome: 'Muletto', tipo: 'carrello' };
  const macchine = [situazioneAttrezzatura({ attrezzatura: att, defAttr: j('attrezzature.json'), controlli: [{ id: 'c1', attrezzaturaId: 'm1', controlloId: 'controllo', data: '2025-12-20' }], ctx, oggi: OGGI })];
  const archivio = [
    { id: 'ar1', genere: 'certificato', tipo: 'verifica-terra', titolo: 'Messa a terra capannone', scadenza: '2027-01-10', durata: 'ordinari' },
    { id: 'ar0', genere: 'certificato', tipo: 'verifica-terra', titolo: 'Vecchia', scadenza: '2022-01-10', sostituitoDa: 'ar1' },
    { id: 'ar2', genere: 'certificato', tipo: 'agibilita', titolo: 'Agibilità' }
  ];
  const documenti = [{ modello: MODELLI.find((m) => m.id === 'verbale-elezione-rls'), data: '2024-01-15', regola: conoscenza.documenti['verbale-elezione-rls'].revisione }];
  const eventi = [{ id: 'e1', tipo: 'infortunio', data: '2026-11-24', giorniPrognosi: 10 }];
  return raccogliScadenze({ piano, situazioni, macchine, archivio, defArchivio: archivioDef, documenti, eventi, catalogo, nomeCompleto: (l) => `${l.nome} ${l.cognome}`, oggi: OGGI });
}

test('raccolta di tutte le scadenze dell\'impresa', () => {
  const s = scenario();
  const per = (id) => s.find((x) => x.id === id);
  assert.equal(per('impresa:presidi-antincendio').data, '2026-11-01');
  assert.equal(per('impresa:presidi-antincendio').stato, 'scaduta');
  assert.equal(per('impresa:rumore-vibrazioni').data, '2026-12-10', 'rumore: 4 anni');
  assert.equal(per('impresa:dvr').obbligo, 'prassi', 'il controllo annuale del DVR è buona prassi');
  assert.equal(per('impresa:rumore-vibrazioni').obbligo, 'legge');
  const ps = per('lavoratore:l1:corso-primo-soccorso');
  assert.equal(ps.data, '2026-12-01');
  assert.match(ps.titolo, /^Anna Verdi: Corso addetto primo soccorso/);
  assert.doesNotMatch(ps.riservato, /Anna/);
  assert.match(ps.norma, /388\/2003/);
  assert.equal(per('attrezzatura:m1:controllo').data, '2026-12-20');
  assert.equal(per('archivio:ar1').norma, 'DPR 462/2001 art. 4');
  assert.ok(!per('archivio:ar0'), 'versione sostituita esclusa');
  assert.ok(!per('archivio:ar2'), 'senza scadenza esclusa');
  assert.equal(per('documento:verbale-elezione-rls').data, '2027-01-15');
  assert.equal(per('documento:verbale-elezione-rls').obbligo, 'contratto');
  assert.equal(per('evento:e1').data, '2026-11-26', 'denuncia INAIL entro 2 giorni');
  assert.ok(s.some((x) => x.stato === 'dafare'), 'adempimenti mai fatti compaiono senza data');
  // ordinamento: prima scadute, poi da fare, poi per data
  const ord = { scaduta: 0, entro30: 1, dafare: 2, entro90: 3, oltre: 4 };
  for (let i = 1; i < s.length; i++) assert.ok(ord[s[i - 1].stato] <= ord[s[i].stato]);
  const g = raggruppaScadenze(s);
  assert.equal(g[0].stato, 'scaduta');
  const c = conteggiScadenze(s);
  assert.equal(Object.values(c).reduce((a, b) => a + b, 0), s.length);
  assert.ok(s.every((x) => x.href && x.titolo && x.riservato));
});

test('promemoria per il responsabile, con o senza nomi', () => {
  const s = scenario();
  const p = testoPromemoria(s, { impresa: 'Officina Rossi', oggi: OGGI, giorni: 30, responsabile: 'Ing. Bianchi' });
  assert.match(p.oggetto, /Scadenze sicurezza – Officina Rossi al 25\/11\/2026/);
  assert.match(p.testo, /^Ciao Ing\. Bianchi/);
  assert.match(p.testo, /SCADUTE \(\d+\)/);
  assert.match(p.testo, /01\/11\/2026 Controllo di estintori/);
  assert.match(p.testo, /\[DM 1 settembre 2021\]/);
  assert.doesNotMatch(p.testo, /Anna/);
  assert.doesNotMatch(p.testo, /15\/01\/2027/, 'oltre i 30 giorni non compare');
  assert.match(testoPromemoria(s, { oggi: OGGI, conNomi: true }).testo, /Anna Verdi: Corso addetto primo soccorso/);
  assert.equal(testoPromemoria([], { oggi: OGGI }).numero, 0);
});

test('notifiche: una per soglia (30, 7, 0 giorni) e senza nomi', () => {
  const voce = (id, data) => ({ id, data, riservato: `R ${id}`, titolo: `T ${id}` });
  const lista = [voce('a', '2026-12-20'), voce('b', '2026-12-01'), voce('c', '2026-11-20'), voce('d', '2027-06-01'), { id: 'e', data: null }];
  const n = daNotificare(lista, OGGI);
  assert.deepEqual(n.map((x) => [x.voce.id, x.soglia]), [['a', 30], ['b', 7], ['c', 0]]);
  const gia = new Set(n.map((x) => x.chiave));
  assert.deepEqual(daNotificare(lista, OGGI, gia), [], 'non si ripete');
  assert.deepEqual(daNotificare(lista, '2026-12-13', gia).map((x) => [x.voce.id, x.soglia]), [['a', 7], ['b', 0]], 'nuove soglie raggiunte');
  assert.deepEqual(daNotificare([voce('a', '2026-12-22')], OGGI, gia).map((x) => x.soglia), [30], 'se cambia la data si riparte');
  const t = testoNotifica(n);
  assert.match(t.titolo, /3 scadenze sulla sicurezza \(1 superate\)/);
  assert.match(t.corpo, /R a/);
  assert.doesNotMatch(t.corpo, /T a/);
  assert.equal(testoNotifica([n[0]]).titolo, 'Scade tra 25 giorni');
  assert.deepEqual(perServiceWorker(lista)[0], { id: 'a', data: '2026-12-20', riservato: 'R a' });
  assert.equal(perServiceWorker(lista).length, 4);
  assert.equal(aggiungiGiorni('2026-12-30', 3), '2027-01-02');
});
