// Modelli di documenti compilati con i dati dell'impresa e dei lavoratori.
// Modulo puro: ogni modello restituisce HTML pronto da stampare. Testabile con Node.
// I testi sono bozze da verificare con il consulente prima dell'uso.

import { valuta, nomeCompleto, ESITI_VISITA } from './engine.js';
import { LINGUE, TESTI } from './lingue.js';
import { lex8h, fasciaRumore, a8, fasciaVibrazioni, niosh, fasciaNiosh, costantePeso, pericolositaSalute, esposizioneChimica, esitoChimico, bassoRischioIncendio } from './calcoli.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Un valore, oppure una riga da compilare a mano. */
const v = (x, larghezza = 18) => (x ? `<strong>${esc(x)}</strong>` : `<span class="vuoto">${'&nbsp;'.repeat(larghezza)}</span>`);

function data(iso) {
  if (!iso) return '';
  const [a, m, g] = iso.slice(0, 10).split('-');
  return `${g}/${m}/${a}`;
}

function intestazione(a) {
  return `<header class="doc__intestazione">
    <p>${v(a.ragioneSociale, 30)}</p>
    <p>Sede: ${v(a.sede, 30)} · P.IVA/C.F.: ${v(a.piva, 16)}</p>
  </header>`;
}

function firme(...chi) {
  return `<div class="doc__firme">${chi
    .map(([ruolo, nome]) => `<div><p>${esc(ruolo)}</p><p class="doc__nome">${nome ? esc(nome) : '&nbsp;'}</p><p class="doc__linea">Firma</p></div>`)
    .join('')}</div>`;
}

function luogoData(a, oggi) {
  return `<p class="doc__luogo">${v(a.comune, 14)}, ${v(data(oggi), 10)}</p>`;
}

const titolare = (a) => a.titolare || '';

/** I pericoli del DVR presenti per l'impresa, secondo le risposte. */
function pericoliPresenti(dvr, ctx) {
  return (dvr?.pericoli || []).filter((x) => ctx && valuta(x.presenteSe, ctx));
}

const normalizza = (t) => String(t || '').trim().toLowerCase();

/** Nomi dei lavoratori con un certo ruolo. */
function conRuolo(lavoratori, ruolo) {
  return (lavoratori || []).filter((x) => (x.ruoli || []).includes(ruolo)).map(nomeCompleto).join(', ');
}

/** Lavoratori raggruppati per mansione. */
function raggruppaMansioni(lavoratori) {
  const m = new Map();
  for (const l of lavoratori || []) {
    const k = (l.mansione || '').trim() || 'Mansione da indicare';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(l);
  }
  return [...m].map(([mansione, lav]) => ({ mansione, lavoratori: lav }));
}

/** Livello di rischio dato R = P x D, secondo i criteri del DVR. */
export function livelloRischio(criteri, R) {
  return (criteri?.livelli || []).find((x) => R >= x.da && R <= x.a) || null;
}

function organigramma(a, lavoratori, dlRspp) {
  const righe = [
    ['Datore di lavoro', titolare(a)],
    ['RSPP', dlRspp ? `${titolare(a)} (datore di lavoro)` : a.rspp],
    ['Medico competente', a.medico],
    ['RLS / RLST', a.rls],
    ['Preposti', conRuolo(lavoratori, 'preposto')],
    ['Addetti al primo soccorso', conRuolo(lavoratori, 'primo_soccorso')],
    ['Addetti antincendio ed emergenze', conRuolo(lavoratori, 'antincendio')]
  ];
  return `<table class="doc__tabella doc__tabella--campi"><tbody>${righe.map(([k, x]) => `<tr><th>${esc(k)}</th><td>${esc(x || '')}</td></tr>`).join('')}</tbody></table>`;
}

function tabellaCriteri(c) {
  const colore = (R) => {
    const l = livelloRischio(c, R);
    return l ? `doc__liv--${normalizza(l.etichetta).replace(/[^a-z]+/g, '-')}` : '';
  };
  return `<table class="doc__tabella"><thead><tr><th>P</th><th>Probabilità</th></tr></thead><tbody>${c.probabilita
    .map((x) => `<tr><td>${x.valore}</td><td><strong>${esc(x.etichetta)}</strong> – ${esc(x.descrizione)}</td></tr>`)
    .join('')}</tbody></table>
    <table class="doc__tabella"><thead><tr><th>D</th><th>Danno</th></tr></thead><tbody>${c.magnitudo
      .map((x) => `<tr><td>${x.valore}</td><td><strong>${esc(x.etichetta)}</strong> – ${esc(x.descrizione)}</td></tr>`)
      .join('')}</tbody></table>
    <table class="doc__tabella doc__matrice"><thead><tr><th>P \\ D</th>${[1, 2, 3, 4].map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${[4, 3, 2, 1]
      .map((p) => `<tr><th>${p}</th>${[1, 2, 3, 4].map((dd) => `<td class="${colore(p * dd)}">${p * dd}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>
    <table class="doc__tabella"><thead><tr><th>R</th><th>Livello</th><th>Azione</th></tr></thead><tbody>${c.livelli
      .map((l) => `<tr><td>${l.da}–${l.a}</td><td class="${colore(l.da)}"><strong>${esc(l.etichetta)}</strong></td><td>${esc(l.azione)}</td></tr>`)
      .join('')}</tbody></table>`;
}

/** Pericoli e DPI di un'attrezzatura in testo. */
function pericoliMacchina(a, etichette) {
  const p = (a.pericoli || []).map((id) => (etichette && etichette[id]) || id);
  return { pericoli: p.join(', '), dpi: (a.dpi || []).join(', '), istruzioni: a.istruzioni || '' };
}

/** Riferimenti agli allegati di una voce: "All. A1, A3". */
export function rifAllegati(allegatiDoc, origine, id) {
  const lista = (allegatiDoc || []).filter((x) => x.origine === origine && x.collegatoId === id);
  return lista.length ? lista.map((x) => `<span class="doc__rif-all">All. ${esc(x.n)}</span>`).join(', ') : '';
}

/** Riferimenti a tutte le planimetrie allegate: "Piano terra (All. A2)". */
function rifPlanimetrie(allegatiDoc) {
  const pl = (allegatiDoc || []).filter((x) => x.origine === 'archivio');
  const titoli = [...new Set(pl.map((x) => x.titolo))];
  return titoli.map((t) => `${esc(t)} (${pl.filter((x) => x.titolo === t).map((x) => `<span class="doc__rif-all">All. ${esc(x.n)}</span>`).join(', ')})`).join('; ');
}

/** Tabella dei documenti e certificati in archivio con validità. */
function tabellaArchivio(archivio, oggi) {
  const voci = (archivio || []).filter((r) => r.genere === 'certificato');
  if (!voci.length) return '<p class="doc__nota">Nessun certificato registrato nell\'archivio di safetyDoc.</p>';
  return `<table class="doc__tabella"><thead><tr><th>Documento</th><th>Rilasciato</th><th>Scadenza</th></tr></thead><tbody>${voci
    .map(
      (r) =>
        `<tr><td>${esc(r.titolo)}${r.ente ? `<br><small>${esc(r.ente)}${r.numero ? ` · n. ${esc(r.numero)}` : ''}</small>` : ''}</td><td>${esc(data(r.dataRilascio))}</td><td>${
          r.scadenza ? `${esc(data(r.scadenza))}${r.scadenza < oggi ? ' <strong>SCADUTO</strong>' : ''}` : '—'
        }</td></tr>`
    )
    .join('')}</tbody></table>`;
}

/** Elenco e spazio per le pagine degli allegati, riempito dall'app con le immagini. */
export function appendiceAllegati(allegatiDoc) {
  if (!(allegatiDoc || []).length) return '';
  return `<section class="doc__allegati">
    <h2>Allegati</h2>
    <table class="doc__tabella"><thead><tr><th>N.</th><th>Riferito a</th><th>Documento</th><th>File</th></tr></thead><tbody>
      ${allegatiDoc.map((x) => `<tr><td>${esc(x.n)}</td><td>${esc(x.titolo)}</td><td>${esc(x.categoria)}</td><td><small>${esc(x.nome)}</small></td></tr>`).join('')}
    </tbody></table>
    ${allegatiDoc
      .map(
        (x) => `<figure class="doc__allegato" data-allegato="${esc(x.id)}">
        <figcaption><strong>Allegato ${esc(x.n)}</strong> · ${esc(x.titolo)} · ${esc(x.categoria)}</figcaption>
        <div class="doc__allegato-pagine"><p class="doc__nota solo-schermo">Preparazione delle pagine…</p></div>
      </figure>`
      )
      .join('')}
  </section>`;
}

/** I 14 allergeni dell'Allegato II del Reg. UE 1169/2011. */
export const ALLERGENI = [
  'Cereali contenenti glutine (grano, segale, orzo, avena, farro, kamut)',
  'Crostacei',
  'Uova',
  'Pesce',
  'Arachidi',
  'Soia',
  'Latte e derivati (compreso il lattosio)',
  'Frutta a guscio (mandorle, nocciole, noci, anacardi, pistacchi e altre)',
  'Sedano',
  'Senape',
  'Semi di sesamo',
  'Anidride solforosa e solfiti (oltre 10 mg/kg o 10 mg/l)',
  'Lupini',
  'Molluschi'
];

/**
 * Rischi per gravidanza e allattamento, collegati ai pericoli del DVR (D.Lgs. 151/2001, artt. 7 e 53, Allegati A, B e C).
 * Le righe senza pericolo valgono sempre. Indicazioni da confermare con il medico competente.
 */
export const RISCHI_MATERNITA = [
  { rischio: "Lavoro in piedi per più di metà dell'orario", indicazione: 'Vietato in gravidanza', misura: 'Mansione con possibilità di sedersi' },
  { pericolo: 'mmc', rischio: 'Sollevamento e trasporto di pesi', indicazione: 'Vietato in gravidanza e fino a 7 mesi dopo il parto', misura: 'Spostamento a mansione senza movimentazione di carichi' },
  { pericolo: 'quota', rischio: 'Lavori su scale, ponteggi e impalcature', indicazione: 'Vietato in gravidanza e fino a 7 mesi dopo il parto', misura: 'Esclusione dai lavori in quota' },
  { pericolo: 'vibrazioni', rischio: 'Utensili o macchine che trasmettono intense vibrazioni', indicazione: 'Vietato in gravidanza', misura: "Esclusione dall'uso di questi utensili" },
  { pericolo: 'rumore', rischio: 'Rumore', indicazione: 'Da valutare con il medico competente (vietato con esposizione elevata)', misura: 'Spostamento in zona non rumorosa' },
  { pericolo: 'chimico', rischio: 'Prodotti chimici pericolosi', indicazione: 'Vietati quelli tossici per la salute o la riproduzione (verificare le frasi H nelle schede di sicurezza)', misura: "Esclusione dall'uso dei prodotti indicati dal medico" },
  { pericolo: 'cancerogeni', rischio: 'Agenti cancerogeni e mutageni', indicazione: 'Vietato in gravidanza e fino a 7 mesi dopo il parto', misura: 'Spostamento a mansione non esposta' },
  { pericolo: 'amianto', rischio: 'Amianto', indicazione: 'Vietato in gravidanza e fino a 7 mesi dopo il parto', misura: 'Esclusione dai lavori' },
  { pericolo: 'biologici', rischio: 'Agenti biologici (per esempio toxoplasma, rosolia)', indicazione: 'Vietato se non immunizzata; da valutare con il medico competente', misura: "Verifica dell'immunità ed esclusione dai contatti a rischio" },
  { pericolo: 'notturno', rischio: 'Lavoro notturno', indicazione: "Vietato dalle 24 alle 6 dall'inizio della gravidanza fino a un anno di età del bambino", misura: 'Solo turni diurni' },
  { pericolo: 'strada', rischio: 'Lavori su mezzi di trasporto in movimento', indicazione: 'Vietato in gravidanza', misura: 'Esclusione dalla guida e dal lavoro a bordo di mezzi' },
  { pericolo: 'confinati', rischio: 'Ambienti confinati', indicazione: 'Da escludere (lavoro pericoloso)', misura: 'Esclusione dai lavori' },
  { pericolo: 'lavori-elettrici', rischio: 'Lavori elettrici', indicazione: 'Da escludere (lavoro pericoloso)', misura: 'Esclusione dai lavori' },
  { pericolo: 'vdt', rischio: 'Lavoro al computer', indicazione: 'Consentito, con pause e cambi di posizione più frequenti', misura: 'Pause e postazione regolabile' },
  { pericolo: 'stress', rischio: 'Ritmi e carichi di lavoro', indicazione: 'Da valutare', misura: 'Riduzione di ritmi, straordinari e reperibilità' }
];

// ---------- definizioni ----------

const presentiDvr = (d) => (d?.dvr?.pericoli || []).filter((x) => d?.ctx && valuta(x.presenteSe, d.ctx));
const SCALA = (tipico) => [{ valore: '', etichetta: tipico }, ...[1, 2, 3, 4].map((n) => ({ valore: String(n), etichetta: String(n) }))];

/** Tabella del DVR per confermare P e D di ogni rischio e programmare le misure di miglioramento. */
function campoValutazioni(d) {
  const presenti = presentiDvr(d);
  return {
    id: 'valutazioni',
    etichetta: 'Valutazione personalizzata e misure di miglioramento',
    tipo: 'tabella',
    aiuto: 'Dopo il sopralluogo conferma o cambia probabilità (P) e danno (D) di ogni rischio: «tipico» lascia il valore proposto. Per programmare una misura scegli il rischio, scrivi la misura (ti suggeriamo le più comuni), chi se ne occupa ed entro quando. Per più misure sullo stesso rischio usa più righe.',
    righe: presenti.length + 3,
    iniziali: presenti.map((x) => ({ rischio: x.id, p: '', d: '', misura: '', incaricato: '', entro: '' })),
    colonne: [
      { id: 'rischio', etichetta: 'Rischio', tipo: 'scelta', valori: [{ valore: '', etichetta: '—' }, ...presenti.map((x) => ({ valore: x.id, etichetta: x.pericolo }))] },
      { id: 'p', etichetta: 'P', tipo: 'scelta', valori: SCALA('tipico') },
      { id: 'd', etichetta: 'D', tipo: 'scelta', valori: SCALA('tipico') },
      { id: 'misura', etichetta: 'Misura di miglioramento', suggerimenti: [...new Set(presenti.flatMap((x) => x.miglioramenti || []))] },
      { id: 'incaricato', etichetta: 'Incaricato' },
      { id: 'entro', etichetta: 'Entro il', segnaposto: 'gg/mm/aaaa' }
    ]
  };
}

/** Valori confermati e misure programmate per ogni rischio, dalla tabella del DVR. */
export function valutazioniPersonalizzate(righe) {
  const out = {};
  for (const r of righe || []) {
    if (!r?.rischio) continue;
    const x = (out[r.rischio] ||= { p: null, d: null, misure: [] });
    const p = Number(r.p);
    const dd = Number(r.d);
    if (!x.p && p >= 1 && p <= 4) x.p = p;
    if (!x.d && dd >= 1 && dd <= 4) x.d = dd;
    if (String(r.misura || '').trim()) x.misure.push({ misura: r.misura.trim(), incaricato: String(r.incaricato || '').trim(), entro: String(r.entro || '').trim() });
  }
  return out;
}

export const MODELLI = [
  {
    id: 'stato-sicurezza',
    titolo: 'Stato della sicurezza dell\'impresa',
    descrizione: 'Riepilogo stampabile di tutti gli adempimenti, dei lavoratori e delle macchine, con date e documenti allegati. Utile per il consulente o in caso di controllo.',
    ambito: 'impresa',
    attivaSe: { sempre: true },
    genera: ({ anagrafica: a, oggi, piano, situazioni, macchine, allegati, archivio }) => {
      const n = (k) => (allegati && allegati[k]) || 0;
      const STATO = { rosso: 'Da fare', giallo: 'In scadenza', verde: 'In regola', info: 'Quando capita' };
      const voci = piano || [];
      const conta = (col) => voci.filter((x) => x.colore === col).length;
      const riga = (titolo, fatto, scade, colore, motivo, doc) =>
        `<tr class="doc__riga--${colore}"><td>${esc(titolo)}</td><td>${fatto ? esc(data(fatto)) : '—'}</td><td>${scade ? esc(data(scade)) : '—'}</td><td>${esc(STATO[colore] || '')}${
          motivo && colore !== 'verde' && motivo.toLowerCase() !== (STATO[colore] || '').toLowerCase() ? ` · ${esc(motivo)}` : ''
        }</td><td>${doc || '—'}</td></tr>`;
      const testa = '<thead><tr><th>Voce</th><th>Fatto il</th><th>Scade il</th><th>Stato</th><th>Doc.</th></tr></thead>';
      const adempimenti = voci
        .filter((x) => x.colore !== 'info')
        .map((x) => riga(x.scheda.titolo, x.stato?.fatto ? x.stato.dataFatto : null, x.prossimaScadenza, x.colore, x.motivo, n(`adempimento:${x.stato?.id}`)))
        .join('');
      const lav = (situazioni || [])
        .map(
          (s) => `<tr><th colspan="5">${esc(nomeCompleto(s.lavoratore))}${s.lavoratore.mansione ? ` · ${esc(s.lavoratore.mansione)}` : ''}</th></tr>${s.voci
            .map((x) => riga(x.requisito.titolo, x.registro?.data, x.prossimaScadenza, x.colore, x.motivo, n(`registro:${x.registro?.id}`)))
            .join('')}`
        )
        .join('');
      const mac = (macchine || [])
        .map(
          (s) => `<tr><th colspan="5">${esc(s.attrezzatura.nome || s.tipo?.etichetta || 'Attrezzatura')}${s.attrezzatura.matricola ? ` · matr. ${esc(s.attrezzatura.matricola)}` : ''}</th></tr>${s.voci
            .map((x) => riga(x.controllo.titolo, x.registro?.data, x.prossimaScadenza, x.colore, x.motivo, n(`controllo:${x.registro?.id}`)))
            .join('')}`
        )
        .join('');
      const quandoCapita = voci.filter((x) => x.colore === 'info');
      return `${intestazione(a)}
        <h1>Stato della sicurezza dell'impresa</h1>
        <p>Situazione al ${esc(data(oggi))}: <strong>${conta('rosso')}</strong> da fare, <strong>${conta('giallo')}</strong> in scadenza, <strong>${conta('verde')}</strong> in regola.
        La colonna «Doc.» indica quanti documenti o foto sono allegati nell'app.</p>
        <h2>Adempimenti dell'impresa</h2>
        <table class="doc__tabella">${testa}<tbody>${adempimenti || '<tr><td colspan="5">Nessuna voce.</td></tr>'}</tbody></table>
        ${lav ? `<h2>Lavoratori</h2><table class="doc__tabella">${testa}<tbody>${lav}</tbody></table>` : ''}
        ${mac ? `<h2>Macchine e attrezzature</h2><table class="doc__tabella">${testa}<tbody>${mac}</tbody></table>` : ''}
        <h2>Certificati e documenti in archivio</h2>
        ${tabellaArchivio(archivio, oggi)}
        ${quandoCapita.length ? `<h2>Da applicare quando capita</h2><ul>${quandoCapita.map((x) => `<li>${esc(x.scheda.titolo)}</li>`).join('')}</ul>` : ''}
        <p class="doc__nota">Riepilogo prodotto con safetyDoc sulla base dei dati inseriti dall'impresa. Non sostituisce i documenti originali, che vanno conservati. Per le visite mediche è riportato solo il giudizio di idoneità.</p>
        ${firme(['Il datore di lavoro', titolare(a)])}`;
    }
  },
  {
    id: 'scadenzario',
    titolo: 'Scadenzario della sicurezza',
    descrizione: 'Tutte le scadenze dell\'impresa con la data calcolata e la norma di riferimento: adempimenti, lavoratori, macchine, certificati, revisioni dei documenti. Da consegnare al responsabile o da tenere in ufficio.',
    ambito: 'impresa',
    attivaSe: { sempre: true },
    genera: ({ anagrafica: a, oggi, scadenze, responsabile: r = {} }) => {
      const lista = scadenze || [];
      const GRUPPI = [
        ['scaduta', 'Scadute'],
        ['entro30', 'Entro 30 giorni'],
        ['dafare', 'Da fare o senza data'],
        ['entro90', 'Entro 90 giorni'],
        ['oltre', 'Più avanti']
      ];
      const OBBLIGO = { legge: 'Legge', contratto: 'Contratto', prassi: 'Buona prassi', 'norma tecnica': 'Norma tecnica' };
      const tabella = (voci) => `<table class="doc__tabella"><thead><tr><th>Entro il</th><th>Scadenza</th><th>Riferimento</th><th>Fatto il</th></tr></thead><tbody>${voci
        .map((x) => `<tr><td>${x.data ? esc(data(x.data)) : '—'}</td><td>${esc(x.titolo)}${x.senzaData ? `<br><small>${esc(x.senzaData)}</small>` : ''}</td><td><small>${esc(x.norma || '')}${x.obbligo ? ` · ${esc(OBBLIGO[x.obbligo] || x.obbligo)}` : ''}</small></td><td style="min-width:5em"></td></tr>`)
        .join('')}</tbody></table>`;
      return `${intestazione(a)}
        <h1>Scadenzario della sicurezza</h1>
        <p class="doc__rif">Situazione al ${data(oggi)}${r.nome ? ` · responsabile delle scadenze: ${esc(r.nome)}${r.ruolo ? ` (${esc(r.ruolo)})` : ''}` : ''}</p>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          ${GRUPPI.map(([k, t]) => `<tr><th>${t}</th><td>${lista.filter((x) => x.stato === k).length}</td></tr>`).join('')}
        </tbody></table>
        ${GRUPPI.map(([k, t]) => {
          const voci = lista.filter((x) => x.stato === k);
          return voci.length ? `<h2>${t}</h2>${tabella(voci)}` : '';
        }).join('')}
        ${lista.length ? '' : '<p>Nessuna scadenza registrata.</p>'}
        <p class="doc__nota">Date calcolate da safetyDoc sulla base delle registrazioni e delle norme indicate. «Buona prassi» e «contratto» non sono obblighi di legge. Verificare con il consulente.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['Il responsabile delle scadenze', r.nome])}`;
    }
  },
  {
    id: 'dvr-bozza',
    titolo: 'Documento di valutazione dei rischi (DVR) completo',
    descrizione: 'DVR dettagliato secondo le procedure standardizzate: organigramma, mansioni, criteri, valutazione di ogni rischio con probabilità e danno, attrezzature, prodotti, DPI, formazione, sorveglianza sanitaria, emergenze e programma di miglioramento. Da completare e firmare con RSPP e medico competente.',
    allegati: { planimetrie: ['generale', 'layout', 'emergenza', 'impianti', 'deposito', 'altro'], attrezzature: () => true, prodotti: () => true, categorie: ['libretto', 'ce', 'pericoli', 'sds'] },
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    opzioni: (d) => [
      { id: 'revisione', etichetta: 'Revisione n.', tipo: 'testo', segnaposto: '0' },
      { id: 'orario', etichetta: 'Orario di lavoro', tipo: 'testo', segnaposto: 'es. lun-ven 8-12 e 14-18' },
      { id: 'ciclo', etichetta: 'Descrizione del ciclo lavorativo', tipo: 'area', segnaposto: 'Cosa fa l\'impresa, in quali fasi, in quali locali' },
      { id: 'presidi', etichetta: 'Presidi di emergenza', tipo: 'area', segnaposto: 'es. 2 estintori a polvere all\'ingresso e in laboratorio, cassetta di pronto soccorso in ufficio, punto di raccolta nel cortile' },
      campoValutazioni(d)
    ],
    genera: (d) => {
      const { anagrafica: a, oggi, dvr, ctx, lavoratori, attivita, opzioni: o = {} } = d;
      const pericoli = (dvr?.pericoli || []).map((x) => ({ ...x, presente: ctx ? valuta(x.presenteSe, ctx) : false }));
      const pers = valutazioniPersonalizzate(o.valutazioni);
      const presenti = pericoli
        .filter((x) => x.presente)
        .map((x) => ({ ...x, tipicaP: x.probabilita, tipicaD: x.magnitudo, confermata: Boolean(pers[x.id]?.p || pers[x.id]?.d), probabilita: pers[x.id]?.p || x.probabilita, magnitudo: pers[x.id]?.d || x.magnitudo, programmate: pers[x.id]?.misure || [] }));
      const famiglie = [...new Set(pericoli.map((x) => x.famiglia))];
      const mansioni = raggruppaMansioni(lavoratori);
      const n = ctx?.fatti?.lavoratori || (lavoratori || []).length || '';
      const dlRspp = ctx?.risposte?.dl_rspp;
      const criteri = dvr?.criteri;
      const voce = (id) => (d.piano || []).find((x) => x.scheda.id === id);
      const statoVoce = (id) => {
        const x = voce(id);
        if (!x) return '';
        return x.stato?.fatto ? `fatto il ${data(x.stato.dataFatto)}${x.prossimaScadenza ? `, scade il ${data(x.prossimaScadenza)}` : ''}` : x.colore === 'info' ? 'quando serve' : 'DA FARE';
      };
      const DPI = [...new Set(presenti.flatMap((x) => x.dpi || []))];
      const migliorare = (d.piano || []).filter((x) => x.colore === 'rosso' || x.colore === 'giallo');
      const sit = d.situazioni || [];
      const req = (s, ids) => s.voci.filter((v) => ids.includes(v.requisito.id));
      const anni = Object.keys(d.perAnno || {}).sort();
      return `${intestazione(a)}
        <section class="doc__frontespizio">
          <h1>Documento di valutazione dei rischi</h1>
          <p class="doc__rif">art. 17 c. 1 lett. a, artt. 28 e 29 del D.Lgs. 81/2008 · procedure standardizzate (DM 30/11/2012)</p>
          <table class="doc__tabella doc__tabella--campi"><tbody>
            <tr><th>Impresa</th><td>${esc(a.ragioneSociale || '')}</td></tr>
            <tr><th>Sede</th><td>${esc([a.sede, a.comune].filter(Boolean).join(', '))}</td></tr>
            <tr><th>Revisione</th><td>${v(o.revisione || '0', 4)} del ${v(data(oggi), 10)}</td></tr>
          </tbody></table>
          <p class="doc__nota">BOZZA generata da safetyDoc: va verificata con un sopralluogo, completata e firmata. Il documento deve avere data certa (firma di tutti i soggetti con data, PEC a sé stessi o firma digitale).</p>
        </section>

        <h2>1 · Premessa</h2>
        <p>Il presente documento contiene la valutazione di tutti i rischi per la salute e la sicurezza dei lavoratori, l'indicazione delle misure di prevenzione e protezione e dei dispositivi di protezione individuale adottati, il programma delle misure per migliorare nel tempo i livelli di sicurezza, le procedure e i ruoli di chi deve attuarle, i nominativi di RSPP, RLS e medico competente, e le mansioni che richiedono capacità professionali, formazione e addestramento specifici (art. 28 c. 2).</p>
        <p>Il documento va rielaborato entro 30 giorni in caso di modifiche significative del processo produttivo o dell'organizzazione, di evoluzione della tecnica, di infortuni significativi o quando la sorveglianza sanitaria ne evidenzi la necessità (art. 29 c. 3).</p>

        <h2>2 · Descrizione generale dell'azienda (Modulo 1.1)</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Ragione sociale</th><td>${esc(a.ragioneSociale || '')}</td></tr>
          <tr><th>Attività</th><td>${esc(attivita || '')}</td></tr>
          <tr><th>Codice ATECO</th><td>${esc(ctx?.fatti?.ateco ? `${ctx.fatti.ateco.codice} – ${ctx.fatti.ateco.descrizione}` : '')}</td></tr>
          <tr><th>Classe di rischio (formazione)</th><td>${esc(ctx?.fatti?.classeRischio && ctx.fatti.classeRischio !== 'da_verificare' ? ctx.fatti.classeRischio : '')}</td></tr>
          <tr><th>Sede</th><td>${esc([a.sede, a.comune].filter(Boolean).join(', '))}</td></tr>
          <tr><th>P.IVA / C.F.</th><td>${esc(a.piva || '')}</td></tr>
          <tr><th>Numero di lavoratori</th><td>${esc(String(n))}</td></tr>
          <tr><th>Orario di lavoro</th><td>${esc(o.orario || '')}</td></tr>
        </tbody></table>
        <h3>Luoghi di lavoro: planimetrie e layout</h3>
        <p>${rifPlanimetrie(d.allegatiDoc) || 'Da allegare: planimetria dei locali con indicazione di reparti, postazioni, macchine, vie di esodo e presidi.'}</p>
        <h3>Organigramma della sicurezza</h3>
        ${organigramma(a, lavoratori, dlRspp)}
        <h3>Certificati e documenti dell'impresa</h3>
        ${tabellaArchivio(d.archivio, oggi)}

        <h2>3 · Ciclo lavorativo e mansioni (Modulo 1.2)</h2>
        <p style="min-height:3em">${o.ciclo ? esc(o.ciclo).replace(/\n/g, '<br>') : '&nbsp;'}</p>
        <table class="doc__tabella"><thead><tr><th>Mansione</th><th>Lavoratori</th><th>Attrezzature</th><th>Prodotti</th></tr></thead><tbody>
          ${
            mansioni.length
              ? mansioni
                  .map((m) => `<tr><td>${esc(m.mansione)}</td><td>${m.lavoratori.map((l) => esc(nomeCompleto(l))).join('<br>')}</td><td>${(d.attrezzature || []).map((x) => esc(x.nome)).join(', ')}</td><td>${(d.prodotti || []).map((p) => esc(p.nome)).join(', ')}</td></tr>`)
                  .join('')
              : '<tr><td style="height:3em"></td><td></td><td></td><td></td></tr>'
          }
        </tbody></table>
        <p class="doc__nota">Attrezzature e prodotti sono quelli registrati in safetyDoc: assegnarli alle singole mansioni durante il sopralluogo.</p>

        <h2>4 · Criteri di valutazione</h2>
        <p>Per ogni pericolo presente si stima il rischio R = P × D, dove P è la probabilità che il danno si verifichi e D la gravità del danno, entrambe su una scala da 1 a 4.</p>
        ${criteri ? tabellaCriteri(criteri) : ''}

        <h2>5 · Individuazione dei pericoli (Modulo 2)</h2>
        <table class="doc__tabella"><thead><tr><th>Famiglia</th><th>Pericolo</th><th>Presente</th><th>Riferimento</th></tr></thead><tbody>
          ${famiglie
            .map((f) => {
              const gruppo = pericoli.filter((x) => x.famiglia === f);
              return gruppo
                .map((x, i) => `<tr>${i === 0 ? `<td rowspan="${gruppo.length}">${esc(f)}</td>` : ''}<td>${esc(x.pericolo)}</td><td><strong>${x.presente ? 'SÌ' : 'NO'}</strong></td><td><small>${esc(x.norma || '')}</small></td></tr>`)
                .join('');
            })
            .join('')}
        </tbody></table>
        <p class="doc__nota">Le risposte SÌ/NO derivano dal questionario: vanno confermate con il sopralluogo.</p>

        <h2>6 · Valutazione dei rischi e misure (Modulo 3)</h2>
        ${presenti
          .map((x, i) => {
            const R = (x.probabilita || 0) * (x.magnitudo || 0);
            const liv = livelloRischio(criteri, R);
            const st = x.schedaId && x.schedaId !== 'dvr' ? statoVoce(x.schedaId) : '';
            return `<div class="doc__rischio">
            <h3>6.${i + 1} · ${esc(x.pericolo)}</h3>
            <table class="doc__tabella doc__tabella--campi"><tbody>
              <tr><th>Possibili danni</th><td>${esc(x.danno || '')}</td></tr>
              <tr><th>Mansioni esposte</th><td>${mansioni.map((m) => esc(m.mansione)).join(', ') || '&nbsp;'}</td></tr>
              <tr><th>Valutazione</th><td>P = ${v(String(x.probabilita || ''), 2)} · D = ${v(String(x.magnitudo || ''), 2)} · <strong>R = ${R || ''} (${esc(liv?.etichetta || '')})</strong><br><small>${x.confermata ? `Valori confermati dopo il sopralluogo (valori tipici: P ${x.tipicaP}, D ${x.tipicaD}).` : 'Valori tipici da confermare durante il sopralluogo.'}</small></td></tr>
              <tr><th>Misure di prevenzione e protezione</th><td><ul>${x.misure.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></td></tr>
              <tr><th>DPI</th><td>${(x.dpi || []).map(esc).join(', ') || 'Non necessari'}</td></tr>
              <tr><th>Informazione e formazione</th><td>${esc(x.formazione || '')}</td></tr>
              <tr><th>Sorveglianza sanitaria</th><td>${x.sorveglianza ? 'Sì, secondo il protocollo del medico competente' : 'Non prevista per questo rischio'}</td></tr>
              ${st ? `<tr><th>Valutazione specifica o adempimento</th><td>${esc(st)}</td></tr>` : ''}
              <tr><th>Riferimenti normativi</th><td>${esc(x.norma || '')}</td></tr>
              <tr><th>Misure di miglioramento, incaricato, entro il</th><td style="height:2.2em">${liv && liv.da >= 6 ? `<strong>${esc(liv.azione)}.</strong> ` : ''}${
                x.programmate.length ? `<ul>${x.programmate.map((m) => `<li>${esc(m.misura)}${m.incaricato ? ` – incaricato: ${esc(m.incaricato)}` : ''}${m.entro ? ` – entro il ${esc(m.entro)}` : ''}</li>`).join('')}</ul>` : ''
              }</td></tr>
            </tbody></table></div>`;
          })
          .join('')}

        <h2>7 · Attrezzature di lavoro</h2>
        ${
          (d.macchine || []).length
            ? `<table class="doc__tabella"><thead><tr><th>Attrezzatura</th><th>Pericoli e DPI</th><th>Controlli</th><th>Libretto e documenti</th></tr></thead><tbody>
          ${d.macchine
            .map((s) => {
              const pm = pericoliMacchina(s.attrezzatura, d.etichettePericoli);
              return `<tr><td><strong>${esc(s.attrezzatura.nome)}</strong><br><small>${esc([s.tipo?.etichetta, s.attrezzatura.marcaModello, s.attrezzatura.matricola ? `matr. ${s.attrezzatura.matricola}` : '', s.attrezzatura.marcaturaCE === false ? 'SENZA CE' : 'CE'].filter(Boolean).join(' · '))}</small></td>
              <td>${esc(pm.pericoli) || '<em>da indicare</em>'}${pm.dpi ? `<br><small>DPI: ${esc(pm.dpi)}</small>` : ''}${pm.istruzioni ? `<br><small>${esc(pm.istruzioni)}</small>` : ''}</td>
              <td><small>${s.voci
                .map((x) => `${esc(x.controllo.titolo)}: ${x.registro ? `fatto il ${esc(data(x.registro.data))}` : 'da fare'}${x.prossimaScadenza ? `, scade il ${esc(data(x.prossimaScadenza))}` : ''}`)
                .join('<br>')}</small></td>
              <td>${rifAllegati(d.allegatiDoc, 'attrezzatura', s.attrezzatura.id) || '<em>libretto da allegare</em>'}</td></tr>`;
            })
            .join('')}</tbody></table>
            <p class="doc__nota">I libretti d'uso e manutenzione e le dichiarazioni CE sono riportati negli allegati in fondo al documento.</p>`
            : '<p>Nessuna attrezzatura registrata in safetyDoc.</p>'
        }

        <h2>8 · Prodotti chimici</h2>
        ${
          (d.prodotti || []).length
            ? `<table class="doc__tabella"><thead><tr><th>Prodotto</th><th>Uso</th><th>Pericoli</th><th>Scheda di sicurezza</th><th>DPI</th></tr></thead><tbody>${d.prodotti
                .map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.uso || '')}</td><td>${esc([(p.pittogrammi || []).join(', '), p.frasiH].filter(Boolean).join(' · '))}</td><td>${p.dataSds ? esc(data(p.dataSds)) : 'da acquisire'} ${rifAllegati(d.allegatiDoc, 'prodotto', p.id)}</td><td>${esc(p.dpi || '')}</td></tr>`)
                .join('')}</tbody></table>`
            : '<p>Nessun prodotto registrato.</p>'
        }

        <h2>9 · Dispositivi di protezione individuale</h2>
        ${
          DPI.length
            ? `<table class="doc__tabella"><thead><tr><th>DPI</th>${mansioni.map((m) => `<th>${esc(m.mansione)}</th>`).join('') || '<th>Mansioni</th>'}</tr></thead><tbody>${DPI.map(
                (x) => `<tr><td>${esc(x)}</td>${mansioni.map(() => '<td>☐</td>').join('') || '<td></td>'}</tr>`
              ).join('')}</tbody></table>
          <p class="doc__nota">Spuntare le mansioni a cui ciascun DPI è assegnato. La consegna si registra con il verbale di consegna DPI.</p>`
            : '<p>Non risultano DPI necessari.</p>'
        }

        <h2>10 · Informazione, formazione e addestramento</h2>
        ${
          sit.length
            ? `<table class="doc__tabella"><thead><tr><th>Lavoratore</th><th>Mansione</th><th>Formazione e corsi</th></tr></thead><tbody>${sit
                .map(
                  (s) => `<tr><td>${esc(nomeCompleto(s.lavoratore))}</td><td>${esc(s.lavoratore.mansione || '')}</td><td>${s.voci
                    .filter((x) => !['visita-medica', 'consegna-dpi', 'informativa-privacy', 'autorizzazione-trattamento'].includes(x.requisito.id))
                    .map((x) => `${esc(x.requisito.titolo)}: ${x.registro ? esc(data(x.registro.data)) : '<strong>da fare</strong>'}${x.prossimaScadenza ? ` (scade ${esc(data(x.prossimaScadenza))})` : ''}`)
                    .join('<br>')}</td></tr>`
                )
                .join('')}</tbody></table>`
            : '<p>Inserire i lavoratori in safetyDoc per compilare questa sezione.</p>'
        }

        <h2>11 · Sorveglianza sanitaria</h2>
        <p>Medico competente: ${v(a.medico, 24)}. Il protocollo sanitario è definito dal medico competente in base ai rischi del capitolo 6.</p>
        ${
          sit.length
            ? `<table class="doc__tabella"><thead><tr><th>Lavoratore</th><th>Ultima visita</th><th>Giudizio</th><th>Prossima visita</th></tr></thead><tbody>${sit
                .map((s) => {
                  const vm = req(s, ['visita-medica'])[0];
                  return `<tr><td>${esc(nomeCompleto(s.lavoratore))}</td><td>${vm?.registro ? esc(data(vm.registro.data)) : vm ? 'da fare' : 'non prevista'}</td><td>${esc(vm?.registro?.esito ? ESITI_VISITA[vm.registro.esito] || '' : '')}</td><td>${vm?.prossimaScadenza ? esc(data(vm.prossimaScadenza)) : ''}</td></tr>`;
                })
                .join('')}</tbody></table>`
            : ''
        }
        <p class="doc__nota">Sono riportati solo date e giudizi di idoneità: le cartelle sanitarie restano al medico competente.</p>

        <h2>12 · Gestione delle emergenze</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Addetti al primo soccorso</th><td>${esc(conRuolo(lavoratori, 'primo_soccorso'))}</td></tr>
          <tr><th>Addetti antincendio ed evacuazione</th><td>${esc(conRuolo(lavoratori, 'antincendio'))}</td></tr>
          <tr><th>Presidi</th><td>${o.presidi ? esc(o.presidi).replace(/\n/g, '<br>') : ''}</td></tr>
          <tr><th>Numero di emergenza</th><td>112</td></tr>
          <tr><th>Piano di emergenza</th><td>${esc(statoVoce('piano-emergenza') || 'Istruzioni di emergenza esposte (piano scritto non obbligatorio sotto i 10 lavoratori, salvo casi particolari)')}</td></tr>
        </tbody></table>

        <h2>13 · Infortuni e quasi incidenti</h2>
        ${
          anni.length
            ? `<table class="doc__tabella"><thead><tr><th>Anno</th><th>Infortuni</th><th>Medicazioni</th><th>Quasi incidenti</th></tr></thead><tbody>${anni
                .map((y) => `<tr><td>${y}</td><td>${d.perAnno[y].infortunio}</td><td>${d.perAnno[y].medicazione}</td><td>${d.perAnno[y].quasi_incidente}</td></tr>`)
                .join('')}</tbody></table>`
            : ''
        }

        <h2>14 · Programma delle misure di miglioramento</h2>
        <table class="doc__tabella"><thead><tr><th>Misura o adempimento</th><th>Stato</th><th>Entro il</th><th>Incaricato</th></tr></thead><tbody>
          ${presenti
            .flatMap((x) => x.programmate.map((m) => `<tr><td>${esc(m.misura)}<br><small>Rischio: ${esc(x.pericolo)}</small></td><td>Programmata</td><td>${esc(m.entro)}</td><td>${esc(m.incaricato)}</td></tr>`))
            .join('')}
          ${migliorare.map((x) => `<tr><td>${esc(x.scheda.titolo)}</td><td>${esc(x.motivo)}</td><td>${x.prossimaScadenza ? esc(data(x.prossimaScadenza)) : ''}</td><td></td></tr>`).join('')}
          <tr><td style="height:2em"></td><td></td><td></td><td></td></tr><tr><td style="height:2em"></td><td></td><td></td><td></td></tr>
        </tbody></table>

        <h2>15 · Firme</h2>
        <p>Il presente documento è stato elaborato dal datore di lavoro in collaborazione con l'RSPP e con il medico competente, previa consultazione del rappresentante dei lavoratori per la sicurezza.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', dlRspp ? titolare(a) : a.rspp], ['Il medico competente', a.medico], ['L\'RLS, per consultazione', a.rls])}`;
    }
  },
  {
    id: 'registro-formazione',
    titolo: 'Registro di formazione, visite e scadenze',
    descrizione: 'Riepilogo per ogni lavoratore di corsi, visite mediche e DPI, con le date. Da tenere pronto per i controlli.',
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, oggi, situazioni }) => {
      const righe = (situazioni || [])
        .map(
          (s) => `<tr><th colspan="4">${esc(nomeCompleto(s.lavoratore))}${s.lavoratore.mansione ? ` · ${esc(s.lavoratore.mansione)}` : ''}</th></tr>
          ${s.voci
            .map(
              (x) => `<tr><td>${esc(x.requisito.titolo)}</td><td>${x.registro ? esc(data(x.registro.data)) : '—'}${x.registro?.ente || x.registro?.numeroAttestato ? `<br><small>${esc([x.registro.ente, x.registro.numeroAttestato ? `n. ${x.registro.numeroAttestato}` : ''].filter(Boolean).join(' · '))}</small>` : ''}</td><td>${
                x.prossimaScadenza ? esc(data(x.prossimaScadenza)) : '—'
              }</td><td>${esc(x.motivo)}${x.registro?.esito ? ` (${esc(ESITI_VISITA[x.registro.esito] || '')})` : ''}</td></tr>`
            )
            .join('')}`
        )
        .join('');
      return `${intestazione(a)}
        <h1>Registro di formazione, visite e scadenze</h1>
        <p>Situazione al ${esc(data(oggi))}.</p>
        <table class="doc__tabella"><thead><tr><th>Adempimento</th><th>Fatto il</th><th>Scade il</th><th>Stato</th></tr></thead>
        <tbody>${righe || '<tr><td colspan="4">Nessun lavoratore inserito.</td></tr>'}</tbody></table>
        <p class="doc__nota">Per le visite mediche è riportato solo il giudizio di idoneità. La cartella sanitaria è custodita dal medico competente.</p>
        ${firme(['Il datore di lavoro', titolare(a)])}`;
    }
  },
  {
    id: 'dichiarazione-dl-rspp',
    titolo: 'Datore di lavoro che svolge i compiti di RSPP',
    descrizione: 'Dichiarazione con cui il titolare svolge direttamente i compiti del servizio di prevenzione e protezione, con presa visione dell\'RLS.',
    ambito: 'impresa',
    attivaSe: { all: [{ fatto: 'haDipendenti' }, { q: 'dl_rspp', eq: true }] },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Svolgimento diretto dei compiti del servizio di prevenzione e protezione</h1>
      <p class="doc__rif">Art. 34 e Allegato II del D.Lgs. 81/2008</p>
      <p>Il/La sottoscritto/a ${v(titolare(a), 24)}, in qualità di datore di lavoro dell'impresa ${v(a.ragioneSociale, 24)},</p>
      <p class="doc__centro">DICHIARA</p>
      <ul>
        <li>di svolgere direttamente i compiti propri del servizio di prevenzione e protezione dai rischi, rientrando l'impresa nei casi previsti dall'Allegato II del D.Lgs. 81/2008;</li>
        <li>di aver frequentato il corso di formazione previsto per il datore di lavoro che svolge i compiti di RSPP (attestato del ${v('', 10)}, rilasciato da ${v('', 20)});</li>
        <li>di impegnarsi a frequentare gli aggiornamenti periodici previsti.</li>
      </ul>
      <p>La presente è comunicata in via preventiva al Rappresentante dei lavoratori per la sicurezza.</p>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Per presa visione, l\'RLS / RLST', a.rls])}`
  },
  {
    id: 'nomina-rspp-esterno',
    titolo: 'Incarico al Responsabile del servizio di prevenzione e protezione (RSPP)',
    descrizione: 'Lettera di incarico all\'RSPP esterno o interno con i compiti dell\'art. 33, i requisiti dell\'art. 32, durata e accettazione.',
    ambito: 'impresa',
    attivaSe: { all: [{ fatto: 'haDipendenti' }, { not: { q: 'dl_rspp', eq: true } }] },
    opzioni: (d) => [
      { id: 'tipo', etichetta: 'RSPP', tipo: 'scelta', valori: [{ valore: 'esterno', etichetta: 'Esterno (consulente o società)' }, { valore: 'interno', etichetta: 'Interno (dipendente)' }] },
      { id: 'nome', etichetta: 'Nome dell\'RSPP', tipo: 'testo', valore: d.anagrafica?.rspp || '' },
      { id: 'studio', etichetta: 'Studio o società (se esterno)', tipo: 'testo' },
      { id: 'attestati', etichetta: 'Attestati moduli A, B e C e ultimo aggiornamento', tipo: 'area', segnaposto: 'es. Modulo A 2018, Modulo B ATECO 2022, Modulo C 2018; aggiornamento 40 ore 2024' },
      { id: 'durata', etichetta: 'Durata dell\'incarico', tipo: 'testo', segnaposto: 'es. 12 mesi con rinnovo tacito' },
      { id: 'accessi', etichetta: 'Sopralluoghi previsti all\'anno', tipo: 'numero' },
      { id: 'compenso', etichetta: 'Compenso annuo (se esterno)', tipo: 'testo' }
    ],
    genera: ({ anagrafica: a, oggi, opzioni: o = {} }) => {
      const nome = o.nome || a.rspp || '';
      const esterno = o.tipo !== 'interno';
      return `${intestazione(a)}
        <h1>Lettera di incarico del Responsabile del servizio di prevenzione e protezione</h1>
        <p class="doc__rif">D.Lgs. 81/2008 artt. 17 c. 1 lett. b, 31, 32 e 33</p>
        <p>Il sottoscritto ${v(titolare(a), 24)}, datore di lavoro dell'impresa ${v(a.ragioneSociale, 24)}, con sede in ${v([a.sede, a.comune].filter(Boolean).join(', '), 24)},</p>
        <p class="doc__centro">DESIGNA</p>
        <p>${v(nome, 24)}${esterno && o.studio ? `, dello studio/società ${esc(o.studio)},` : ''} quale <strong>Responsabile del servizio di prevenzione e protezione dai rischi</strong> ${esterno ? 'esterno all\'impresa' : 'interno all\'impresa'}.</p>
        <h2>Requisiti (art. 32)</h2>
        <p>Il datore di lavoro ha verificato che l'RSPP possiede il titolo di studio e gli attestati di frequenza dei corsi previsti, con verifica dell'apprendimento, e il relativo aggiornamento periodico:</p>
        <p style="min-height:2.5em">${o.attestati ? esc(o.attestati).replace(/\n/g, '<br>') : ''}</p>
        <h2>Compiti (art. 33)</h2>
        <ol>
          <li>individuare i fattori di rischio, valutare i rischi e individuare le misure per la sicurezza e la salubrità degli ambienti di lavoro, nel rispetto della normativa e sulla base della conoscenza dell'organizzazione aziendale;</li>
          <li>elaborare, per quanto di competenza, le misure preventive e protettive e i sistemi di controllo di tali misure;</li>
          <li>elaborare le procedure di sicurezza per le varie attività aziendali;</li>
          <li>proporre i programmi di informazione e formazione dei lavoratori;</li>
          <li>partecipare alle consultazioni in materia di tutela della salute e sicurezza e alla riunione periodica;</li>
          <li>fornire ai lavoratori le informazioni previste dall'art. 36.</li>
        </ol>
        <h2>Impegni del datore di lavoro</h2>
        <p>Il datore di lavoro fornisce all'RSPP le informazioni sulla natura dei rischi, sull'organizzazione del lavoro, sulla programmazione e attuazione delle misure, sulla descrizione degli impianti e dei processi produttivi, sui dati del registro degli infortuni e delle malattie professionali e sulle prescrizioni degli organi di vigilanza (art. 18 c. 2). Resta fermo che l'obbligo di valutazione dei rischi e di elaborazione del DVR non è delegabile (art. 17).</p>
        <h2>Condizioni</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Durata</th><td>${esc(o.durata || '')}</td></tr>
          <tr><th>Sopralluoghi all'anno</th><td>${esc(o.accessi || '')}</td></tr>
          ${esterno ? `<tr><th>Compenso</th><td>${esc(o.compenso || '')}</td></tr>` : ''}
        </tbody></table>
        <p>Il nominativo dell'RSPP è riportato nel documento di valutazione dei rischi e comunicato ai lavoratori.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['Per accettazione, l\'RSPP', nome])}`;
    }
  },
  {
    id: 'nomina-medico',
    titolo: 'Nomina del medico competente',
    descrizione: 'Incarico al medico competente per la sorveglianza sanitaria, con accettazione.',
    ambito: 'impresa',
    attivaSe: { all: [{ fatto: 'haDipendenti' }, { fatto: 'rischiConSorveglianza' }] },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Nomina del medico competente</h1>
      <p class="doc__rif">Artt. 18 c. 1 lett. a), 25, 38, 39 e 41 del D.Lgs. 81/2008</p>
      <p>Il/La sottoscritto/a ${v(titolare(a), 24)}, datore di lavoro dell'impresa ${v(a.ragioneSociale, 24)}, essendo emersi dalla valutazione dei rischi rischi per i quali è prevista la sorveglianza sanitaria,</p>
      <p class="doc__centro">NOMINA</p>
      <p>il/la dott./dott.ssa ${v(a.medico, 24)}, in possesso dei titoli e requisiti dell'art. 38, quale medico competente per l'effettuazione della sorveglianza sanitaria.</p>
      <p>Il medico competente collabora alla valutazione dei rischi, programma ed effettua la sorveglianza sanitaria secondo un protocollo sanitario, istituisce e custodisce sotto la propria responsabilità la cartella sanitaria e di rischio di ogni lavoratore e comunica per iscritto al datore di lavoro e al lavoratore il giudizio di idoneità alla mansione.</p>
      <p>Al datore di lavoro sono comunicati solo i giudizi di idoneità. I dati sanitari restano riservati al medico competente.</p>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Per accettazione, il medico competente', a.medico])}`
  },
  {
    id: 'nomina-preposto',
    titolo: 'Individuazione del preposto',
    descrizione: 'Nomina scritta del preposto con i suoi compiti e l\'impegno a frequentare il corso.',
    ambito: 'lavoratore',
    ruolo: 'preposto',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, lavoratore: l, oggi }) => `${intestazione(a)}
      <h1>Individuazione del preposto</h1>
      <p class="doc__rif">Artt. 2 c. 1 lett. e), 18 c. 1 lett. b-bis), 19 e 37 del D.Lgs. 81/2008</p>
      <p>Il/La sottoscritto/a ${v(titolare(a), 24)}, datore di lavoro dell'impresa ${v(a.ragioneSociale, 24)},</p>
      <p class="doc__centro">INDIVIDUA</p>
      <p>il/la sig./sig.ra ${v(nomeCompleto(l), 24)}, mansione ${v(l?.mansione, 16)}, quale <strong>preposto</strong> per le attività ${v('', 30)}.</p>
      <p>Il preposto, nei limiti dei poteri ricevuti, ha il compito di:</p>
      <ul>
        <li>sorvegliare che i lavoratori rispettino le norme di sicurezza e usino i dispositivi di protezione; in caso di comportamenti non conformi, intervenire per modificarli e, se necessario, interrompere l'attività e informare il datore di lavoro;</li>
        <li>verificare che soltanto i lavoratori adeguatamente istruiti accedano alle zone a rischio grave;</li>
        <li>segnalare subito al datore di lavoro le carenze di mezzi, attrezzature e dispositivi di protezione e ogni situazione di pericolo, e interrompere temporaneamente l'attività in caso di pericolo;</li>
        <li>frequentare il corso di formazione per preposti e i relativi aggiornamenti.</li>
      </ul>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Per accettazione, il preposto', nomeCompleto(l)])}`
  },
  {
    id: 'designazione-addetti',
    titolo: 'Designazione degli addetti al primo soccorso e all\'antincendio',
    descrizione: 'Designazione scritta del lavoratore come addetto alle emergenze.',
    ambito: 'lavoratore',
    ruoli: ['primo_soccorso', 'antincendio'],
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, lavoratore: l, oggi }) => {
      const r = new Set(l?.ruoli || []);
      const box = (x) => (x ? '☒' : '☐');
      return `${intestazione(a)}
      <h1>Designazione dei lavoratori incaricati della gestione delle emergenze</h1>
      <p class="doc__rif">Artt. 18 c. 1 lett. b), 43 e 45 del D.Lgs. 81/2008; DM 388/2003; DM 2 settembre 2021</p>
      <p>Il/La sottoscritto/a ${v(titolare(a), 24)}, datore di lavoro dell'impresa ${v(a.ragioneSociale, 24)},</p>
      <p class="doc__centro">DESIGNA</p>
      <p>il/la sig./sig.ra ${v(nomeCompleto(l), 24)}, mansione ${v(l?.mansione, 16)}, quale:</p>
      <p>${box(r.has('primo_soccorso'))} addetto al primo soccorso<br>${box(r.has('antincendio'))} addetto alla prevenzione incendi, lotta antincendio e gestione delle emergenze</p>
      <p>Il lavoratore riceverà la formazione prevista e i relativi aggiornamenti. Ai sensi dell'art. 43 c. 3 del D.Lgs. 81/2008 il lavoratore non può rifiutare la designazione se non per giustificato motivo.</p>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Il lavoratore, per ricevuta', nomeCompleto(l)])}`;
    }
  },
  {
    id: 'consegna-dpi',
    titolo: 'Verbale di consegna dei DPI',
    descrizione: 'Elenco dei dispositivi di protezione consegnati, con firma del lavoratore.',
    ambito: 'lavoratore',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, lavoratore: l, oggi, registro }) => {
      const elenco = (registro?.dettagli || '')
        .split(/[,;\n]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const righe = (elenco.length ? elenco : ['', '', '', '', ''])
        .map((x) => `<tr><td>${x ? esc(x) : '&nbsp;'}</td><td></td><td>${registro?.data ? esc(data(registro.data)) : ''}</td></tr>`)
        .join('');
      return `${intestazione(a)}
      <h1>Verbale di consegna dei dispositivi di protezione individuale</h1>
      <p class="doc__rif">Artt. 18 c. 1 lett. d), 77 e 78 del D.Lgs. 81/2008</p>
      <p>Lavoratore: ${v(nomeCompleto(l), 24)} · Mansione: ${v(l?.mansione, 16)}</p>
      <table class="doc__tabella"><thead><tr><th>Dispositivo (tipo e modello)</th><th>Quantità</th><th>Data di consegna</th></tr></thead><tbody>${righe}</tbody></table>
      <p>Il lavoratore dichiara di aver ricevuto i dispositivi sopra elencati, di essere stato informato e formato sul loro uso corretto (e, per i DPI di III categoria, addestrato) e si impegna a:</p>
      <ul>
        <li>usarli in modo conforme all'informazione, formazione e addestramento ricevuti;</li>
        <li>averne cura e non apportarvi modifiche;</li>
        <li>segnalare subito al datore di lavoro o al preposto qualsiasi difetto o inconveniente;</li>
        <li>riconsegnarli secondo le procedure aziendali al termine dell'utilizzo.</li>
      </ul>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Il lavoratore', nomeCompleto(l)])}`;
    }
  },
  {
    id: 'informativa-lavoratori',
    titolo: 'Informativa privacy per i lavoratori',
    descrizione: 'Informativa sul trattamento dei dati personali del dipendente (art. 13 GDPR), con ricevuta.',
    ambito: 'lavoratore',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, lavoratore: l, oggi }) => `${intestazione(a)}
      <h1>Informativa sul trattamento dei dati personali dei lavoratori</h1>
      <p class="doc__rif">Art. 13 del Regolamento UE 2016/679 (GDPR)</p>
      <p>Gentile ${v(nomeCompleto(l), 24)},</p>
      <p><strong>Titolare del trattamento</strong> è l'impresa ${v(a.ragioneSociale, 24)}, con sede in ${v(a.sede, 24)}, contattabile a ${v(a.contatto, 20)}.</p>
      <p><strong>Finalità e basi giuridiche.</strong> I suoi dati sono trattati per gestire il rapporto di lavoro (art. 6.1.b GDPR); per adempiere agli obblighi di legge in materia retributiva, fiscale, previdenziale, assicurativa e di salute e sicurezza sul lavoro (art. 6.1.c); per gli obblighi in materia di diritto del lavoro e sicurezza che riguardano categorie particolari di dati, come i giudizi di idoneità alla mansione (art. 9.2.b e 9.2.h).</p>
      <p><strong>Dati trattati.</strong> Dati anagrafici e di contatto, dati del rapporto di lavoro, presenze, retribuzione, formazione ricevuta, dispositivi di protezione consegnati, giudizi di idoneità comunicati dal medico competente. Il datore di lavoro non riceve diagnosi né la cartella sanitaria, custodita dal medico competente.</p>
      <p><strong>Destinatari.</strong> Consulente del lavoro, commercialista, RSPP, medico competente, enti previdenziali e assicurativi, enti pubblici quando previsto dalla legge, fornitori di servizi informatici nominati responsabili del trattamento.</p>
      <p><strong>Conservazione.</strong> Per la durata del rapporto e, dopo la cessazione, per il tempo previsto dalle norme civilistiche, fiscali, previdenziali e di sicurezza sul lavoro.</p>
      <p><strong>Obbligatorietà.</strong> Il conferimento dei dati è necessario per instaurare e gestire il rapporto di lavoro.</p>
      <p><strong>Diritti.</strong> Lei può chiedere accesso, rettifica, cancellazione, limitazione, portabilità dei dati e opporsi al trattamento nei casi previsti (artt. 15-22 GDPR), scrivendo al titolare. Ha diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>
      ${luogoData(a, oggi)}
      ${firme(['Il titolare del trattamento', titolare(a)], ['Il lavoratore, per ricevuta', nomeCompleto(l)])}`
  },
  {
    id: 'autorizzazione-trattamento',
    titolo: 'Autorizzazione al trattamento dei dati',
    descrizione: 'Autorizzazione scritta per il lavoratore che usa dati personali di colleghi o clienti, con le istruzioni.',
    ambito: 'lavoratore',
    ruolo: 'tratta_dati',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, lavoratore: l, oggi }) => `${intestazione(a)}
      <h1>Autorizzazione al trattamento dei dati personali</h1>
      <p class="doc__rif">Art. 29 del Regolamento UE 2016/679; art. 2-quaterdecies del D.Lgs. 196/2003</p>
      <p>L'impresa ${v(a.ragioneSociale, 24)}, titolare del trattamento, autorizza il/la sig./sig.ra ${v(nomeCompleto(l), 24)} a trattare i dati personali necessari per le seguenti attività: ${v('', 40)}.</p>
      <p>Istruzioni da rispettare:</p>
      <ul>
        <li>trattare solo i dati necessari alle attività assegnate e per le sole finalità indicate;</li>
        <li>non comunicare i dati a persone non autorizzate e non diffonderli;</li>
        <li>custodire i documenti cartacei in armadi chiusi e non lasciarli incustoditi;</li>
        <li>proteggere computer e telefono con password personali e bloccarli quando ci si allontana;</li>
        <li>segnalare subito al titolare perdite di dati, furti di dispositivi, email inviate per errore o accessi sospetti;</li>
        <li>mantenere la riservatezza anche dopo la fine del rapporto di lavoro.</li>
      </ul>
      ${luogoData(a, oggi)}
      ${firme(['Il titolare del trattamento', titolare(a)], ['La persona autorizzata, per accettazione', nomeCompleto(l)])}`
  },
  {
    id: 'verbale-evacuazione',
    titolo: 'Verbale della prova di evacuazione',
    descrizione: 'Da compilare dopo l\'esercitazione annuale prevista dal piano di emergenza.',
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Verbale della prova di evacuazione</h1>
      <p class="doc__rif">DM 2 settembre 2021</p>
      <table class="doc__tabella doc__tabella--campi"><tbody>
        <tr><th>Data e ora della prova</th><td></td></tr>
        <tr><th>Scenario simulato (es. incendio nel magazzino)</th><td></td></tr>
        <tr><th>Persone presenti / evacuate</th><td></td></tr>
        <tr><th>Tempo per raggiungere il punto di raccolta</th><td></td></tr>
        <tr><th>Addetti alle emergenze intervenuti</th><td></td></tr>
        <tr><th>Problemi riscontrati (uscite bloccate, allarme non udito, ecc.)</th><td></td></tr>
        <tr><th>Azioni da fare e chi le fa</th><td></td></tr>
      </tbody></table>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Un addetto alle emergenze', ''])}`
  },
  {
    id: 'registro-antincendio',
    titolo: 'Registro dei controlli antincendio',
    descrizione: 'Registro di controlli e manutenzioni di estintori, porte, luci di emergenza e uscite.',
    ambito: 'impresa',
    attivaSe: { q: 'sede', eq: true },
    genera: ({ anagrafica: a }) => `${intestazione(a)}
      <h1>Registro dei controlli e delle manutenzioni antincendio</h1>
      <p class="doc__rif">DM 1 settembre 2021</p>
      <table class="doc__tabella"><thead><tr><th>Data</th><th>Cosa è stato controllato</th><th>Esito e interventi</th><th>Ditta o persona</th><th>Firma</th></tr></thead>
      <tbody>${'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>'.repeat(14)}</tbody></table>`
  },
  {
    id: 'verbale-riunione',
    titolo: 'Verbale della riunione periodica',
    descrizione: 'Verbale della riunione annuale obbligatoria sopra i 15 lavoratori.',
    ambito: 'impresa',
    attivaSe: { q: 'numero_lavoratori', gt: 15 },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Verbale della riunione periodica di prevenzione e protezione</h1>
      <p class="doc__rif">Art. 35 del D.Lgs. 81/2008</p>
      <p>In data ${v(data(oggi), 10)} si è svolta la riunione periodica con la partecipazione di: datore di lavoro ${v(titolare(a), 18)}, RSPP ${v(a.rspp, 18)}, medico competente ${v(a.medico, 18)}, RLS ${v(a.rls, 18)}.</p>
      <p>Sono stati esaminati:</p>
      <ol>
        <li>il documento di valutazione dei rischi: ${v('', 40)}</li>
        <li>l'andamento degli infortuni, delle malattie professionali e della sorveglianza sanitaria: ${v('', 40)}</li>
        <li>i criteri di scelta, le caratteristiche tecniche e l'efficacia dei dispositivi di protezione individuale: ${v('', 40)}</li>
        <li>i programmi di informazione e formazione dei dirigenti, dei preposti e dei lavoratori: ${v('', 40)}</li>
      </ol>
      <p>Decisioni e azioni da fare: ${v('', 60)}</p>
      ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', a.rspp], ['Il medico competente', a.medico], ['L\'RLS', a.rls])}`
  },
  {
    id: 'informativa-clienti',
    titolo: 'Informativa privacy per i clienti',
    descrizione: 'Informativa breve da consegnare o esporre per i clienti (art. 13 GDPR).',
    ambito: 'impresa',
    attivaSe: { sempre: true },
    genera: ({ anagrafica: a }) => `${intestazione(a)}
      <h1>Informativa sul trattamento dei dati personali dei clienti</h1>
      <p class="doc__rif">Art. 13 del Regolamento UE 2016/679 (GDPR)</p>
      <p><strong>Titolare del trattamento</strong> è l'impresa ${v(a.ragioneSociale, 24)}, con sede in ${v(a.sede, 24)}, contattabile a ${v(a.contatto, 20)}.</p>
      <p><strong>Perché usiamo i suoi dati.</strong> Per preparare preventivi, eseguire i lavori o i servizi richiesti e gestire i pagamenti (art. 6.1.b GDPR) e per gli obblighi fiscali e contabili (art. 6.1.c).</p>
      <p><strong>A chi li comunichiamo.</strong> Al commercialista, a banche e corrieri quando necessario, ai fornitori di servizi informatici nominati responsabili del trattamento, alle autorità quando lo prevede la legge.</p>
      <p><strong>Per quanto tempo.</strong> Per il tempo necessario al servizio e, per i documenti fiscali, per il periodo previsto dalla legge.</p>
      <p><strong>I suoi diritti.</strong> Può chiedere accesso, rettifica, cancellazione, limitazione e portabilità dei dati e opporsi al trattamento (artt. 15-22 GDPR) scrivendo al titolare, e proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>`
  },
  {
    id: 'nomina-responsabile-esterno',
    titolo: 'Nomina di un responsabile esterno del trattamento',
    descrizione: 'Accordo con chi tratta dati per conto tuo: consulente del lavoro, commercialista, assistenza informatica (art. 28 GDPR).',
    ambito: 'impresa',
    attivaSe: { sempre: true },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Nomina a responsabile del trattamento dei dati personali</h1>
      <p class="doc__rif">Art. 28 del Regolamento UE 2016/679 (GDPR)</p>
      <p>L'impresa ${v(a.ragioneSociale, 24)}, titolare del trattamento, nomina ${v('', 30)} responsabile del trattamento per il servizio di ${v('', 30)}.</p>
      <p><strong>Dati e persone interessate:</strong> ${v('', 40)}</p>
      <p><strong>Durata:</strong> per tutta la durata del servizio.</p>
      <p>Il responsabile si impegna a:</p>
      <ol type="a">
        <li>trattare i dati solo su istruzione documentata del titolare e per le finalità del servizio;</li>
        <li>garantire che le persone autorizzate al trattamento si siano impegnate alla riservatezza;</li>
        <li>adottare misure di sicurezza adeguate ai sensi dell'art. 32 GDPR;</li>
        <li>non ricorrere ad altri responsabili senza autorizzazione scritta del titolare;</li>
        <li>assistere il titolare nel rispondere alle richieste degli interessati e negli obblighi degli artt. 32-36;</li>
        <li>informare il titolare senza ritardo di ogni violazione dei dati personali;</li>
        <li>al termine del servizio, cancellare o restituire i dati, salvo obblighi di legge di conservazione;</li>
        <li>mettere a disposizione le informazioni necessarie a dimostrare il rispetto di questi obblighi e consentire verifiche.</li>
      </ol>
      ${luogoData(a, oggi)}
      ${firme(['Il titolare del trattamento', titolare(a)], ['Il responsabile, per accettazione', ''])}`
  },
  {
    id: 'regole-lavoratore',
    titolo: 'Regole di sicurezza per il lavoratore (anche in altre lingue)',
    descrizione: 'Le regole essenziali e cosa fare in emergenza, in italiano e nella lingua del lavoratore, con firma per ricevuta.',
    ambito: 'lavoratore',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, oggi, lavoratore: l, lavoratori }) => {
      const addetti = (ruolo) => (lavoratori || []).filter((x) => (x.ruoli || []).includes(ruolo)).map(nomeCompleto).join(', ');
      const lingue = ['it', ...(l?.lingua && l.lingua !== 'it' && TESTI[l.lingua] ? [l.lingua] : [])];
      const blocco = (cod) => {
        const t = TESTI[cod];
        return `<section class="doc__lingua" lang="${cod}" dir="${LINGUE[cod].dir}">
          <h2>${esc(t.titolo)}${cod !== 'it' ? ` · ${esc(LINGUE[cod].nome)}` : ''}</h2>
          <ol>${t.regole.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
          <h3>${esc(t.emergenza)}</h3>
          <ul>
            <li><strong>${esc(t.chiama)}</strong></li>
            <li>${esc(t.soccorso)}: ${v(addetti('primo_soccorso'), 20)}</li>
            <li>${esc(t.incendio)}: ${v(addetti('antincendio'), 20)}</li>
            <li>${esc(t.allarme)}</li>
          </ul>
          <p><em>${esc(t.ricevuta)}</em></p>
        </section>`;
      };
      return `${intestazione(a)}
        <h1>Regole di sicurezza</h1>
        <p>Lavoratore: ${v(l ? nomeCompleto(l) : '', 24)}${l?.mansione ? ` · ${esc(l.mansione)}` : ''}</p>
        ${lingue.map(blocco).join('')}
        ${lingue.length > 1 ? '<p class="doc__nota">Traduzione di cortesia: in caso di dubbio vale il testo italiano.</p>' : ''}
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['Il lavoratore, per ricevuta', l ? nomeCompleto(l) : ''])}`;
    }
  },
  {
    id: 'piano-emergenza-doc',
    titolo: 'Piano di emergenza ed evacuazione',
    descrizione: 'Organizzazione delle emergenze: addetti, presidi, procedure per incendio, infortunio, terremoto, fuga di gas ed evacuazione, numeri utili e registro delle prove.',
    allegati: { planimetrie: ['emergenza', 'generale'] },
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    opzioni: () => [
      { id: 'coordinatore', etichetta: 'Coordinatore dell\'emergenza', tipo: 'testo' },
      { id: 'raccolta', etichetta: 'Punto di raccolta', tipo: 'testo', segnaposto: 'es. parcheggio davanti all\'ingresso' },
      { id: 'presidi', etichetta: 'Estintori, idranti, cassetta di soccorso e dove si trovano', tipo: 'area' },
      { id: 'interruttori', etichetta: 'Dove si tolgono corrente, gas e acqua', tipo: 'area' },
      { id: 'persone', etichetta: 'Massimo di persone presenti (lavoratori e clienti)', tipo: 'numero' }
    ],
    genera: ({ anagrafica: a, oggi, lavoratori, opzioni: o = {}, allegatiDoc }) => `${intestazione(a)}
        <h1>Piano di emergenza ed evacuazione</h1>
        <p class="doc__rif">D.Lgs. 81/2008 artt. 18 c. 1 lett. t e 43-46; DM 2 settembre 2021 (GSA) e DM 3 settembre 2021</p>
        <h2>1 · Dati generali</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Sede</th><td>${esc([a.sede, a.comune].filter(Boolean).join(', '))}</td></tr>
          <tr><th>Persone presenti al massimo</th><td>${esc(o.persone || '')}</td></tr>
          <tr><th>Coordinatore dell'emergenza</th><td>${esc(o.coordinatore || titolare(a))}</td></tr>
          <tr><th>Addetti antincendio ed evacuazione</th><td>${esc(conRuolo(lavoratori, 'antincendio'))}</td></tr>
          <tr><th>Addetti al primo soccorso</th><td>${esc(conRuolo(lavoratori, 'primo_soccorso'))}</td></tr>
          <tr><th>Punto di raccolta</th><td>${esc(o.raccolta || '')}</td></tr>
          <tr><th>Presidi</th><td>${o.presidi ? esc(o.presidi).replace(/\n/g, '<br>') : ''}</td></tr>
          <tr><th>Interruttori e valvole generali</th><td>${o.interruttori ? esc(o.interruttori).replace(/\n/g, '<br>') : ''}</td></tr>
        </tbody></table>
        <h2>2 · Numeri utili</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Numero unico di emergenza (vigili del fuoco, ambulanza, forze dell'ordine)</th><td><strong>112</strong></td></tr>
          <tr><th>Datore di lavoro</th><td>${esc(titolare(a))} ${esc(a.contatto || '')}</td></tr>
          <tr><th>Guasti gas, elettricità, acqua</th><td></td></tr>
        </tbody></table>
        <h2>3 · Chi fa cosa</h2>
        <table class="doc__tabella"><thead><tr><th>Chi</th><th>Compiti</th></tr></thead><tbody>
          <tr><td>Chi scopre l'emergenza</td><td>Avvisa subito gli addetti o il coordinatore; se è in grado e senza rischi, usa l'estintore; non si mette in pericolo.</td></tr>
          <tr><td>Coordinatore</td><td>Valuta la situazione, decide se evacuare, chiama il 112, toglie corrente e gas, accoglie i soccorsi.</td></tr>
          <tr><td>Addetti antincendio</td><td>Intervengono con gli estintori sui principi d'incendio, guidano l'evacuazione, controllano che nessuno resti nei locali.</td></tr>
          <tr><td>Addetti al primo soccorso</td><td>Prestano i primi soccorsi con la cassetta, non spostano l'infortunato se non c'è pericolo, chiamano il 112.</td></tr>
          <tr><td>Tutti i lavoratori</td><td>Interrompono il lavoro, mettono in sicurezza le macchine se possibile, escono con calma dalla via più vicina, aiutano clienti e persone in difficoltà, vanno al punto di raccolta e non si allontanano.</td></tr>
        </tbody></table>
        <h2>4 · Procedure</h2>
        <h3>Incendio</h3>
        <ol><li>Dare l'allarme a voce e chiamare il 112.</li><li>Solo se il fuoco è piccolo e si è addestrati: usare l'estintore tenendosi tra il fuoco e l'uscita.</li><li>Chiudere le porte dietro di sé, togliere corrente e gas.</li><li>Se c'è fumo: camminare abbassati, coprire naso e bocca con un panno.</li><li>Evacuare verso il punto di raccolta e fare l'appello.</li></ol>
        <h3>Infortunio o malore</h3>
        <ol><li>Mettere in sicurezza la zona e chiamare l'addetto al primo soccorso.</li><li>Chiamare il 112 descrivendo cosa è successo e dove.</li><li>Non dare da bere né spostare l'infortunato, salvo pericolo immediato.</li><li>Registrare l'evento nel registro di infortuni e quasi incidenti.</li></ol>
        <h3>Terremoto</h3>
        <ol><li>Durante la scossa: ripararsi sotto un tavolo robusto o vicino a un muro portante, lontano da finestre e scaffali.</li><li>Finita la scossa: uscire con calma, senza usare l'ascensore, e raggiungere il punto di raccolta lontano da edifici e linee elettriche.</li></ol>
        <h3>Fuga di gas</h3>
        <ol><li>Non accendere né spegnere luci o apparecchi elettrici, non usare fiamme.</li><li>Chiudere la valvola generale, aprire le finestre, uscire e chiamare il 112 da fuori.</li></ol>
        <h3>Allagamento o guasto elettrico</h3>
        <ol><li>Togliere la corrente dall'interruttore generale solo se si è all'asciutto.</li><li>Spostarsi in zona sicura e avvisare il coordinatore.</li></ol>
        <h2>5 · Prove di evacuazione</h2>
        <p>La prova di evacuazione si svolge almeno una volta all'anno e si registra con il verbale della prova.</p>
        <table class="doc__tabella"><thead><tr><th>Data</th><th>Esito e osservazioni</th><th>Firma</th></tr></thead><tbody>${Array.from({ length: 3 }, () => '<tr><td style="height:2em"></td><td></td><td></td></tr>').join('')}</tbody></table>
        <h2>6 · Planimetrie</h2>
        <p>${rifPlanimetrie(allegatiDoc) || 'Da allegare: planimetria con vie di esodo, uscite, presidi e punto di raccolta.'} Le planimetrie di emergenza vanno esposte nei locali.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', a.rspp], ['L\'RLS, per presa visione', a.rls])}`
  },
  {
    id: 'informazione-art36',
    titolo: 'Informazione al lavoratore sui rischi (art. 36)',
    descrizione: 'Informazione scritta sui rischi della mansione, le misure, i DPI, le emergenze e le figure della sicurezza, con firma del lavoratore.',
    ambito: 'lavoratore',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, oggi, lavoratore: l, lavoratori, dvr, ctx, prodotti, attrezzature, etichettePericoli }) => {
      const presenti = pericoliPresenti(dvr, ctx).filter((x) => !['interferenze', 'differenze', 'tutele'].includes(x.id));
      const conPericoli = (attrezzature || []).filter((x) => (x.pericoli || []).length || x.istruzioni);
      return `${intestazione(a)}
        <h1>Informazione sui rischi per la salute e la sicurezza</h1>
        <p class="doc__rif">D.Lgs. 81/2008 art. 36</p>
        <p>Lavoratore: ${v(l ? nomeCompleto(l) : '', 24)} · mansione: ${v(l?.mansione, 20)}</p>
        <h2>Figure della sicurezza</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Datore di lavoro</th><td>${esc(titolare(a))}</td></tr>
          <tr><th>RSPP</th><td>${esc(ctx?.risposte?.dl_rspp ? titolare(a) : a.rspp || '')}</td></tr>
          <tr><th>Medico competente</th><td>${esc(a.medico || '')}</td></tr>
          <tr><th>RLS</th><td>${esc(a.rls || '')}</td></tr>
          <tr><th>Preposto</th><td>${esc(conRuolo(lavoratori, 'preposto'))}</td></tr>
          <tr><th>Addetti primo soccorso</th><td>${esc(conRuolo(lavoratori, 'primo_soccorso'))}</td></tr>
          <tr><th>Addetti antincendio</th><td>${esc(conRuolo(lavoratori, 'antincendio'))}</td></tr>
        </tbody></table>
        <h2>Rischi della tua attività e come ti proteggi</h2>
        <table class="doc__tabella"><thead><tr><th>Rischio</th><th>Cosa può succedere</th><th>Misure e comportamenti</th><th>DPI</th></tr></thead><tbody>
          ${presenti.map((x) => `<tr><td>${esc(x.pericolo)}</td><td>${esc(x.danno || '')}</td><td>${esc(x.misure.join('; '))}</td><td>${esc((x.dpi || []).join(', '))}</td></tr>`).join('')}
        </tbody></table>
        ${conPericoli.length ? `<h2>Attrezzature: pericoli e protezioni</h2><table class="doc__tabella"><thead><tr><th>Attrezzatura</th><th>Pericoli</th><th>DPI e istruzioni</th></tr></thead><tbody>${conPericoli
          .map((x) => {
            const pm = pericoliMacchina(x, etichettePericoli);
            return `<tr><td>${esc(x.nome)}</td><td>${esc(pm.pericoli)}</td><td>${esc([pm.dpi, pm.istruzioni].filter(Boolean).join(' · '))}</td></tr>`;
          })
          .join('')}</tbody></table>` : ''}
        ${(prodotti || []).length ? `<h2>Prodotti chimici che usi</h2><p>${(prodotti || []).map((p) => esc(p.nome)).join(', ')}. Le schede di sicurezza sono a tua disposizione: leggi i pittogrammi dell'etichetta e usa i DPI indicati.</p>` : ''}
        <h2>Emergenze</h2>
        <p>In caso di emergenza chiama il <strong>112</strong>, avvisa gli addetti, segui le vie di esodo e raggiungi il punto di raccolta. Le procedure sono nel piano di emergenza esposto.</p>
        <h2>I tuoi obblighi (art. 20)</h2>
        <ul><li>Usare correttamente attrezzature, prodotti e DPI.</li><li>Segnalare subito difetti, pericoli e situazioni a rischio.</li><li>Non rimuovere o modificare dispositivi di sicurezza.</li><li>Partecipare alla formazione e sottoporsi alle visite mediche previste.</li></ul>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['Il lavoratore, per ricevuta e comprensione', l ? nomeCompleto(l) : ''])}`;
    }
  },
  {
    id: 'verbale-addestramento',
    titolo: 'Verbale di addestramento all\'uso delle attrezzature',
    descrizione: 'Registra l\'addestramento pratico del lavoratore sulle attrezzature che usa (artt. 37 e 73), con chi lo ha svolto e la firma.',
    allegati: { attrezzatureNomi: (o) => o.attrezzature || [], categorie: ['libretto', 'pericoli'] },
    ambito: 'lavoratore',
    attivaSe: { fatto: 'haDipendenti' },
    opzioni: (d) => [
      { id: 'attrezzature', etichetta: 'Attrezzature su cui è stato addestrato', tipo: 'spunte', valori: (d.attrezzature || []).map((x) => ({ valore: x.nome, etichetta: x.nome })) },
      { id: 'addestratore', etichetta: 'Chi ha svolto l\'addestramento', tipo: 'testo' },
      { id: 'ore', etichetta: 'Durata (ore)', tipo: 'numero' }
    ],
    genera: ({ anagrafica: a, oggi, lavoratore: l, attrezzature, opzioni: o = {}, etichettePericoli, allegatiDoc }) => {
      const elenco = (o.attrezzature || []).length ? o.attrezzature : (attrezzature || []).map((x) => x.nome);
      const dettagli = (nome) => {
        const x = (attrezzature || []).find((y) => y.nome === nome);
        if (!x) return '';
        const pm = pericoliMacchina(x, etichettePericoli);
        return [pm.pericoli && `Pericoli: ${esc(pm.pericoli)}`, pm.dpi && `DPI: ${esc(pm.dpi)}`, pm.istruzioni && esc(pm.istruzioni), rifAllegati(allegatiDoc, 'attrezzatura', x.id) && `Libretto: ${rifAllegati(allegatiDoc, 'attrezzatura', x.id)}`].filter(Boolean).join('<br>');
      };
      return `${intestazione(a)}
        <h1>Verbale di addestramento</h1>
        <p class="doc__rif">D.Lgs. 81/2008 artt. 37 c. 5, 71 c. 7 e 73</p>
        <p>Il lavoratore ${v(l ? nomeCompleto(l) : '', 24)}, mansione ${v(l?.mansione, 18)}, ha ricevuto in data ${v(data(oggi), 10)} l'addestramento pratico, della durata di ${v(o.ore ? `${o.ore} ore` : '', 8)}, svolto da ${v(o.addestratore, 22)}, persona esperta, sul luogo di lavoro.</p>
        <table class="doc__tabella"><thead><tr><th>Attrezzatura</th><th>Contenuti</th><th>Esito</th></tr></thead><tbody>
          ${(elenco.length ? elenco : ['']).map((n) => `<tr><td>${esc(n)}</td><td><small>Uso corretto secondo il libretto, dispositivi di sicurezza, controlli prima dell'uso, DPI, cosa fare in caso di guasto${dettagli(n) ? `<br>${dettagli(n)}` : ''}</small></td><td>☐ idoneo ☐ da ripetere</td></tr>`).join('')}
        </tbody></table>
        <p>Il lavoratore dichiara di aver compreso le istruzioni e di essere in grado di usare le attrezzature in sicurezza.</p>
        ${luogoData(a, oggi)}
        ${firme(['L\'addestratore', o.addestratore || ''], ['Il lavoratore', l ? nomeCompleto(l) : ''], ['Il datore di lavoro', titolare(a)])}`;
    }
  },
  {
    id: 'verbale-elezione-rls',
    titolo: 'Verbale di elezione o designazione dell\'RLS',
    descrizione: 'Verbale dell\'elezione del rappresentante dei lavoratori per la sicurezza da parte dei lavoratori, oppure della scelta di ricorrere all\'RLS territoriale.',
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    opzioni: () => [
      { id: 'modalita', etichetta: 'Come è stato scelto', tipo: 'scelta', valori: [{ valore: 'eletto', etichetta: 'Eletto dai lavoratori tra di loro' }, { valore: 'territoriale', etichetta: 'Nessun eletto: si ricorre all\'RLS territoriale' }] },
      { id: 'eletto', etichetta: 'Nome dell\'RLS eletto', tipo: 'testo' },
      { id: 'votanti', etichetta: 'Lavoratori votanti', tipo: 'numero' },
      { id: 'voti', etichetta: 'Voti ricevuti', tipo: 'numero' }
    ],
    genera: ({ anagrafica: a, oggi, lavoratori, opzioni: o = {} }) => {
      const territoriale = o.modalita === 'territoriale';
      return `${intestazione(a)}
        <h1>Verbale ${territoriale ? 'di mancata elezione e ricorso all\'RLS territoriale' : 'di elezione del rappresentante dei lavoratori per la sicurezza'}</h1>
        <p class="doc__rif">D.Lgs. 81/2008 artt. 47 e 48</p>
        ${
          territoriale
            ? `<p>Il giorno ${v(data(oggi), 10)} i lavoratori dell'impresa, riuniti per l'elezione del rappresentante dei lavoratori per la sicurezza, hanno deciso di non eleggere un proprio rappresentante. Le funzioni di RLS sono pertanto svolte dal rappresentante territoriale (RLST) dell'organismo paritetico competente, al quale l'impresa versa il contributo previsto.</p>`
            : `<p>Il giorno ${v(data(oggi), 10)}, presso ${v([a.sede, a.comune].filter(Boolean).join(', '), 24)}, i lavoratori dell'impresa si sono riuniti per eleggere al proprio interno il rappresentante dei lavoratori per la sicurezza.</p>
          <p>Votanti: ${v(o.votanti, 4)} · Voti ricevuti dall'eletto: ${v(o.voti, 4)}</p>
          <p>Risulta eletto: ${v(o.eletto || a.rls, 24)}, che accetta l'incarico. L'RLS frequenterà il corso di 32 ore e l'aggiornamento annuale.</p>`
        }
        <p>L'impresa comunica il nominativo dell'RLS all'INAIL in via telematica.</p>
        <h2>Firme dei lavoratori presenti</h2>
        <table class="doc__tabella"><thead><tr><th>Lavoratore</th><th>Firma</th></tr></thead><tbody>
          ${(lavoratori || []).map((l) => `<tr><td>${esc(nomeCompleto(l))}</td><td style="height:2em"></td></tr>`).join('')}
        </tbody></table>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro, per presa d\'atto', titolare(a)], ...(territoriale ? [] : [['L\'RLS eletto, per accettazione', o.eletto || a.rls]]))}`;
    }
  },
  {
    id: 'valutazione-incendio',
    titolo: 'Valutazione del rischio di incendio (DM 3 settembre 2021)',
    descrizione: 'Valutazione secondo il «minicodice»: pericoli, occupanti, verifica del basso rischio, misure di prevenzione, esodo, estintori, rivelazione, gestione della sicurezza e livello di formazione degli addetti.',
    allegati: { planimetrie: ['emergenza', 'generale', 'impianti', 'deposito'] },
    ambito: 'impresa',
    attivaSe: { any: [{ fatto: 'haDipendenti' }, { q: 'sede', eq: true }] },
    opzioni: (d) => [
      { id: 'superficie', etichetta: 'Superficie lorda dei locali (m²)', tipo: 'numero' },
      { id: 'piani', etichetta: 'Piani occupati', tipo: 'testo', segnaposto: 'es. piano terra' },
      { id: 'persone', etichetta: 'Massimo di persone presenti insieme (lavoratori e pubblico)', tipo: 'numero' },
      { id: 'vulnerabili', etichetta: 'Persone con difficoltà di movimento, vista o udito', tipo: 'casella' },
      { id: 'soggetta', etichetta: 'Attività soggetta ai controlli dei Vigili del fuoco (CPI)', tipo: 'scelta', valori: [{ valore: 'no', etichetta: 'No' }, { valore: 'si', etichetta: 'Sì' }], valore: d.ctx?.risposte?.rischio_incendio === 'si' ? 'si' : 'no' },
      { id: 'quote', etichetta: 'Tutti i piani tra −5 m e +24 m', tipo: 'scelta', valori: [{ valore: 'si', etichetta: 'Sì' }, { valore: 'no', etichetta: 'No' }] },
      { id: 'combustibili', etichetta: 'Depositi di materiali combustibili in quantità significative', tipo: 'scelta', valori: [{ valore: 'no', etichetta: 'No' }, { valore: 'si', etichetta: 'Sì' }] },
      { id: 'sostanze', etichetta: 'Sostanze infiammabili o pericolose in quantità significative', tipo: 'scelta', valori: [{ valore: 'no', etichetta: 'No' }, { valore: 'si', etichetta: 'Sì' }] },
      { id: 'lavorazioni', etichetta: 'Lavorazioni pericolose per l\'incendio (fiamme, saldature, verniciature, forni)', tipo: 'scelta', valori: [{ valore: 'no', etichetta: 'No' }, { valore: 'si', etichetta: 'Sì' }] },
      { id: 'materiali', etichetta: 'Materiali combustibili presenti', tipo: 'spunte', valori: ['Carta e cartone', 'Legno', 'Tessuti', 'Plastiche e imballaggi', 'Vernici e solventi', 'Gas in bombole', 'Carburanti e oli', 'Prodotti alimentari e oli di frittura', 'Rifiuti'].map((x) => ({ valore: x, etichetta: x })) },
      { id: 'inneschi', etichetta: 'Possibili sorgenti di innesco', tipo: 'spunte', valori: ['Impianto e apparecchi elettrici', 'Prese multiple e prolunghe', 'Fiamme libere e cannelli', 'Saldature e molature', 'Forni, piastre, friggitrici', 'Caldaie e stufe', 'Fumo di sigaretta', 'Attriti e surriscaldamenti di macchine', 'Batterie in carica'].map((x) => ({ valore: x, etichetta: x })) },
      { id: 'uscite', etichetta: 'Numero di uscite verso l\'esterno', tipo: 'numero' },
      { id: 'esodo', etichetta: 'Percorso più lungo per raggiungere un\'uscita (m)', tipo: 'numero' },
      { id: 'estintori', etichetta: 'Numero di estintori', tipo: 'numero' },
      { id: 'rivelazione', etichetta: 'Rivelatori di fumo o allarme incendio', tipo: 'casella' },
      { id: 'illuminazione', etichetta: 'Illuminazione di emergenza', tipo: 'casella' },
      { id: 'segnaletica', etichetta: 'Segnaletica di esodo e dei presidi', tipo: 'casella' }
    ],
    genera: ({ anagrafica: a, oggi, lavoratori, opzioni: o = {}, allegatiDoc }) => {
      const br = bassoRischioIncendio(o);
      const livello = br.basso ? 1 : o.soggetta === 'si' ? 2 : 2;
      const ore = { 1: 4, 2: 8, 3: 16 }[livello];
      const persone = Number(o.persone) || null;
      const si = (x) => (x ? 'Sì' : '<strong>No</strong>');
      return `${intestazione(a)}
        <h1>Valutazione del rischio di incendio</h1>
        <p class="doc__rif">D.Lgs. 81/2008 art. 46; DM 3 settembre 2021 (criteri di progettazione, Allegato I); DM 2 settembre 2021 (gestione della sicurezza); DM 1 settembre 2021 (controlli)</p>
        <h2>1 · Descrizione dei luoghi</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Sede</th><td>${esc([a.sede, a.comune].filter(Boolean).join(', '))}</td></tr>
          <tr><th>Superficie lorda</th><td>${esc(o.superficie ? `${o.superficie} m²` : '')}</td></tr>
          <tr><th>Piani</th><td>${esc(o.piani || '')}</td></tr>
          <tr><th>Lavoratori</th><td>${(lavoratori || []).length}</td></tr>
          <tr><th>Massimo di persone presenti</th><td>${persone ?? ''}</td></tr>
          <tr><th>Persone vulnerabili</th><td>${o.vulnerabili ? 'Presenti: prevedere assistenza dedicata durante l\'esodo' : 'Non presenti abitualmente'}</td></tr>
          <tr><th>Planimetrie</th><td>${rifPlanimetrie(allegatiDoc) || 'Da allegare'}</td></tr>
        </tbody></table>
        <h2>2 · Pericoli di incendio</h2>
        <table class="doc__tabella"><thead><tr><th>Materiali combustibili</th><th>Sorgenti di innesco</th></tr></thead><tbody>
          <tr><td><ul>${(o.materiali || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li>&nbsp;</li>'}</ul></td><td><ul>${(o.inneschi || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li>&nbsp;</li>'}</ul></td></tr>
        </tbody></table>
        <h2>3 · Classificazione</h2>
        <table class="doc__tabella"><thead><tr><th>Criterio per il basso rischio (DM 3/9/2021)</th><th>Rispettato</th></tr></thead><tbody>
          ${br.criteri.map((c) => `<tr><td>${esc(c.testo)}</td><td>${c.ok ? 'Sì' : '<strong>No</strong>'}</td></tr>`).join('')}
        </tbody></table>
        <p class="doc__esito doc__esito--${br.basso ? 'verde' : 'giallo'}"><strong>${br.basso ? 'Luogo di lavoro a basso rischio di incendio: si applicano i criteri semplificati dell\'Allegato I del DM 3/9/2021.' : 'Il luogo non rientra nel basso rischio: la progettazione antincendio segue il Codice di prevenzione incendi (DM 3/8/2015) con l\'aiuto di un tecnico.'}</strong></p>
        <h2>4 · Misure presenti</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Uscite verso l'esterno</th><td>${esc(o.uscite || '')}${Number(o.uscite) === 1 && persone > 50 ? ' · <strong>con più di 50 persone valutare una seconda uscita</strong>' : ''}</td></tr>
          <tr><th>Percorso di esodo più lungo</th><td>${esc(o.esodo ? `${o.esodo} m` : '')}</td></tr>
          <tr><th>Estintori</th><td>${esc(o.estintori || '')} · controllo ogni 6 mesi da ditta qualificata (DM 1/9/2021)</td></tr>
          <tr><th>Rivelazione e allarme</th><td>${si(o.rivelazione)}</td></tr>
          <tr><th>Illuminazione di emergenza</th><td>${si(o.illuminazione)}</td></tr>
          <tr><th>Segnaletica</th><td>${si(o.segnaletica)}</td></tr>
        </tbody></table>
        <h2>5 · Misure di prevenzione e gestione</h2>
        <ul>
          <li>Ordine e pulizia: ridurre al minimo i materiali combustibili e tenerli lontani dalle sorgenti di innesco.</li>
          <li>Divieto di fumo e di uso di fiamme libere, salvo permesso di lavoro a caldo.</li>
          <li>Impianti elettrici a norma e verificati; niente prese multiple a cascata.</li>
          <li>Vie di esodo e uscite sempre libere, porte apribili facilmente nel verso dell'esodo.</li>
          <li>Controlli periodici di estintori, luci di emergenza e porte, registrati nel registro antincendio.</li>
          <li>Istruzioni di emergenza esposte e, oltre 10 lavoratori o con pubblico numeroso, piano di emergenza scritto e prova di evacuazione annuale.</li>
        </ul>
        <h2>6 · Addetti antincendio</h2>
        <p>Addetti designati: ${v(conRuolo(lavoratori, 'antincendio'), 24)}</p>
        <p>Livello di formazione indicato: <strong>livello ${livello}</strong> (${ore} ore, aggiornamento ogni 5 anni) secondo il DM 2/9/2021. ${br.basso ? '' : 'Verificare con l\'RSPP se l\'attività richiede il livello 3 (16 ore) e l\'idoneità tecnica dei Vigili del fuoco.'}</p>
        <h2>7 · Programma di miglioramento</h2>
        <table class="doc__tabella"><thead><tr><th>Misura</th><th>Entro il</th><th>Incaricato</th></tr></thead><tbody>
          ${[!o.rivelazione && persone > 50 ? 'Valutare un sistema di allarme incendio' : '', !o.illuminazione ? 'Installare l\'illuminazione di emergenza sulle vie di esodo' : '', !o.segnaletica ? 'Esporre la segnaletica di esodo e dei presidi' : '']
            .filter(Boolean)
            .map((x) => `<tr><td>${esc(x)}</td><td></td><td></td></tr>`)
            .join('')}
          <tr><td style="height:2em"></td><td></td><td></td></tr>
        </tbody></table>
        <p class="doc__nota">Valutazione da verificare con l'RSPP. Per le attività soggette al DPR 151/2011 resta l'obbligo di SCIA antincendio e dei relativi adempimenti.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', a.rspp], ['L\'RLS, per consultazione', a.rls])}`;
    }
  },
  {
    id: 'valutazione-rumore',
    titolo: 'Valutazione del rischio rumore',
    descrizione: 'Calcolo dell\'esposizione giornaliera LEX,8h per ogni mansione dai livelli delle attrezzature e dai tempi d\'uso, con confronto con i valori di 80, 85 e 87 dB(A).',
    ambito: 'impresa',
    attivaSe: { q: 'rumore_vibrazioni', eq: true },
    opzioni: (d) => [
      { id: 'mansione', etichetta: 'Mansione valutata', tipo: 'testo', valore: d.lavoratori?.[0]?.mansione || '' },
      {
        id: 'righe',
        etichetta: 'Attività rumorose della giornata tipo',
        tipo: 'tabella',
        aiuto: 'Il livello LAeq in dB(A) si trova nel libretto della macchina, nelle banche dati (es. INAIL) o con una misura. Inserisci anche il tempo senza rumore (es. 70 dB(A)).',
        righe: 6,
        iniziali: (d.attrezzature || []).slice(0, 6).map((x) => ({ attivita: x.nome, livello: '', ore: '' })),
        colonne: [
          { id: 'attivita', etichetta: 'Attività o attrezzatura' },
          { id: 'livello', etichetta: 'LAeq dB(A)', tipo: 'numero' },
          { id: 'ore', etichetta: 'Ore al giorno', tipo: 'numero' },
          { id: 'fonte', etichetta: 'Fonte del dato' }
        ]
      },
      { id: 'picco', etichetta: 'Rumori impulsivi forti (spari, martellate violente, scoppi)', tipo: 'casella' }
    ],
    genera: ({ anagrafica: a, oggi, opzioni: o = {} }) => {
      const righe = (o.righe || []).filter((r) => r.attivita || r.livello || r.ore);
      const lex = lex8h(righe);
      const f = fasciaRumore(lex);
      const ore = righe.reduce((s, r) => s + (Number(String(r.ore).replace(',', '.')) || 0), 0);
      return `${intestazione(a)}
        <h1>Valutazione del rischio rumore</h1>
        <p class="doc__rif">D.Lgs. 81/2008 Titolo VIII, Capo II (artt. 187-198)</p>
        <p>Mansione: ${v(o.mansione, 24)}</p>
        <h2>1 · Attività e livelli</h2>
        <table class="doc__tabella"><thead><tr><th>Attività o attrezzatura</th><th>LAeq dB(A)</th><th>Ore</th><th>Fonte</th></tr></thead><tbody>
          ${righe.map((r) => `<tr><td>${esc(r.attivita)}</td><td>${esc(r.livello)}</td><td>${esc(r.ore)}</td><td>${esc(r.fonte || '')}</td></tr>`).join('') || '<tr><td style="height:2em"></td><td></td><td></td><td></td></tr>'}
        </tbody></table>
        ${ore && Math.abs(ore - 8) > 0.01 ? `<p class="doc__nota">Totale ore inserite: ${ore}. Il calcolo riporta comunque l'esposizione su 8 ore.</p>` : ''}
        <h2>2 · Risultato</h2>
        <p>LEX,8h = 10 · log<sub>10</sub>[ Σ (T<sub>i</sub>/8) · 10<sup>L<sub>i</sub>/10</sup> ]</p>
        <p class="doc__esito doc__esito--${f?.colore || 'giallo'}"><strong>LEX,8h = ${lex ?? '—'} dB(A)</strong>${f ? ` · ${esc(f.testo)}` : ''}</p>
        ${o.picco ? '<p><strong>Rumori impulsivi:</strong> verificare anche il livello di picco (valori di azione 135 e 137 dB(C), limite 140 dB(C)) con una misura.</p>' : ''}
        <h2>3 · Misure</h2>
        <ul>
          <li>Scegliere attrezzature meno rumorose e mantenerle efficienti.</li>
          <li>Ridurre i tempi di esposizione e allontanare chi non lavora dalle sorgenti rumorose.</li>
          ${lex > 80 ? '<li>Fornire cuffie o tappi adatti e addestrare all\'uso; informazione e formazione specifiche.</li>' : ''}
          ${lex > 85 ? '<li>Obbligo d\'uso dei DPI uditivi, segnaletica nelle aree rumorose, sorveglianza sanitaria, programma di riduzione.</li>' : ''}
        </ul>
        <p class="doc__nota">Valutazione da ripetere almeno ogni 4 anni o quando cambiano attrezzature e lavorazioni (art. 181). I livelli da banca dati vanno confermati con una misura se il risultato è vicino ai valori di azione.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', a.rspp])}`;
    }
  },
  {
    id: 'valutazione-vibrazioni',
    titolo: 'Valutazione del rischio vibrazioni',
    descrizione: 'Calcolo dell\'esposizione A(8) per mano-braccio e corpo intero dagli utensili e dai mezzi usati, con confronto con i valori di azione e limite.',
    ambito: 'impresa',
    attivaSe: { q: 'rumore_vibrazioni', eq: true },
    opzioni: (d) => [
      { id: 'mansione', etichetta: 'Mansione valutata', tipo: 'testo', valore: d.lavoratori?.[0]?.mansione || '' },
      {
        id: 'righe',
        etichetta: 'Utensili e mezzi che vibrano',
        tipo: 'tabella',
        aiuto: 'L\'accelerazione in m/s² si trova nel libretto dell\'utensile o nella banca dati vibrazioni (Portale Agenti Fisici). Per le macchine portatili scegli «Mano-braccio», per mezzi e piattaforme «Corpo intero». Indica il tempo di vibrazione effettivo, non tutto il turno.',
        righe: 6,
        iniziali: (d.attrezzature || []).filter((x) => /utensil|macchin|veicol/i.test(x.tipo || '')).slice(0, 6).map((x) => ({ attrezzo: x.nome, sistema: 'HAV', accelerazione: '', ore: '' })),
        colonne: [
          { id: 'attrezzo', etichetta: 'Utensile o mezzo' },
          { id: 'sistema', etichetta: 'Tipo', tipo: 'scelta', valori: [{ valore: 'HAV', etichetta: 'Mano-braccio' }, { valore: 'WBV', etichetta: 'Corpo intero' }] },
          { id: 'accelerazione', etichetta: 'm/s²', tipo: 'numero' },
          { id: 'ore', etichetta: 'Ore al giorno', tipo: 'numero' }
        ]
      }
    ],
    genera: ({ anagrafica: a, oggi, opzioni: o = {} }) => {
      const righe = (o.righe || []).filter((r) => r.attrezzo || r.accelerazione);
      const hav = a8(righe, 'HAV');
      const wbv = a8(righe, 'WBV');
      const fh = fasciaVibrazioni(hav, 'HAV');
      const fw = fasciaVibrazioni(wbv, 'WBV');
      return `${intestazione(a)}
        <h1>Valutazione del rischio vibrazioni</h1>
        <p class="doc__rif">D.Lgs. 81/2008 Titolo VIII, Capo III (artt. 199-205) e Allegato XXXV</p>
        <p>Mansione: ${v(o.mansione, 24)}</p>
        <table class="doc__tabella"><thead><tr><th>Utensile o mezzo</th><th>Tipo</th><th>Accelerazione m/s²</th><th>Ore</th></tr></thead><tbody>
          ${righe.map((r) => `<tr><td>${esc(r.attrezzo)}</td><td>${r.sistema === 'WBV' ? 'Corpo intero' : 'Mano-braccio'}</td><td>${esc(r.accelerazione)}</td><td>${esc(r.ore)}</td></tr>`).join('') || '<tr><td style="height:2em"></td><td></td><td></td><td></td></tr>'}
        </tbody></table>
        <p>A(8) = √[ Σ a<sub>i</sub>² · T<sub>i</sub> / 8 ]</p>
        <table class="doc__tabella"><thead><tr><th></th><th>A(8)</th><th>Azione / limite</th><th>Esito</th></tr></thead><tbody>
          <tr><td>Mano-braccio</td><td><strong>${hav ?? '—'}</strong></td><td>2,5 / 5 m/s²</td><td class="doc__esito--${fh?.colore || ''}">${esc(fh?.testo || 'Non presente')}</td></tr>
          <tr><td>Corpo intero</td><td><strong>${wbv ?? '—'}</strong></td><td>0,5 / 1 m/s²</td><td class="doc__esito--${fw?.colore || ''}">${esc(fw?.testo || 'Non presente')}</td></tr>
        </tbody></table>
        <h2>Misure</h2>
        <ul>
          <li>Preferire utensili e mezzi a basse vibrazioni, mantenuti e con impugnature antivibranti.</li>
          <li>Alternare le attività e fare pause; tenere le mani calde e asciutte.</li>
          ${(hav ?? 0) > 2.5 || (wbv ?? 0) > 0.5 ? '<li>Programma di riduzione dell\'esposizione, informazione e formazione specifiche, sorveglianza sanitaria.</li>' : ''}
        </ul>
        <p class="doc__nota">Valutazione da ripetere almeno ogni 4 anni o quando cambiano utensili e lavorazioni.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', a.rspp])}`;
    }
  },
  {
    id: 'valutazione-mmc',
    titolo: 'Valutazione della movimentazione manuale dei carichi (NIOSH)',
    descrizione: 'Calcolo del peso limite raccomandato e dell\'indice di sollevamento con il metodo NIOSH (ISO 11228-1, Allegato XXXIII) per le operazioni di sollevamento più gravose.',
    ambito: 'impresa',
    attivaSe: { q: 'carichi', eq: true },
    opzioni: () => [
      {
        id: 'compiti',
        etichetta: 'Sollevamenti da valutare',
        tipo: 'tabella',
        aiuto: 'Una riga per ogni sollevamento tipico. Altezza: delle mani da terra all\'inizio. Distanza: tra mani e caviglie. Spostamento: differenza di altezza tra inizio e fine. Frequenza: sollevamenti al minuto (0,2 se pochi). Durata: breve fino a 1 ora, media 1-2 ore, lunga oltre 2 ore.',
        righe: 4,
        colonne: [
          { id: 'compito', etichetta: 'Operazione' },
          { id: 'peso', etichetta: 'Peso kg', tipo: 'numero' },
          { id: 'altezza', etichetta: 'Altezza cm', tipo: 'numero' },
          { id: 'distanza', etichetta: 'Distanza cm', tipo: 'numero' },
          { id: 'dislocazione', etichetta: 'Spostamento cm', tipo: 'numero' },
          { id: 'angolo', etichetta: 'Rotazione °', tipo: 'numero' },
          { id: 'frequenza', etichetta: 'Atti/min', tipo: 'numero' },
          { id: 'durata', etichetta: 'Durata', tipo: 'scelta', valori: [{ valore: 'lunga', etichetta: 'Oltre 2 h' }, { valore: 'media', etichetta: '1-2 h' }, { valore: 'breve', etichetta: 'Fino a 1 h' }] },
          { id: 'presa', etichetta: 'Presa', tipo: 'scelta', valori: [{ valore: 'buona', etichetta: 'Buona' }, { valore: 'discreta', etichetta: 'Discreta' }, { valore: 'scarsa', etichetta: 'Scarsa' }] }
        ]
      },
      { id: 'genere', etichetta: 'Lavoratori interessati', tipo: 'scelta', valori: [{ valore: 'uomo', etichetta: 'Uomini' }, { valore: 'donna', etichetta: 'Donne o gruppo misto' }] },
      { id: 'fascia', etichetta: 'Età', tipo: 'scelta', valori: [{ valore: 'adulto', etichetta: 'Tra 18 e 45 anni' }, { valore: 'giovane_anziano', etichetta: 'Sotto 18 o sopra 45 anni' }] },
      { id: 'unaMano', etichetta: 'Sollevamento con una mano sola', tipo: 'casella' },
      { id: 'dueOperatori', etichetta: 'Sollevamento in due persone', tipo: 'casella' }
    ],
    genera: ({ anagrafica: a, oggi, opzioni: o = {} }) => {
      const compiti = (o.compiti || []).filter((r) => r.compito || r.peso);
      const risultati = compiti.map((r) => ({ r, n: niosh({ ...r, genere: o.genere, fascia: o.fascia, unaMano: o.unaMano, dueOperatori: o.dueOperatori }) }));
      const CP = costantePeso(o.genere, o.fascia);
      const f2 = (x) => (x === undefined || x === null ? '' : String(Math.round(x * 100) / 100).replace('.', ','));
      return `${intestazione(a)}
        <h1>Valutazione della movimentazione manuale dei carichi</h1>
        <p class="doc__rif">D.Lgs. 81/2008 Titolo VI e Allegato XXXIII; norma ISO 11228-1 (metodo NIOSH)</p>
        <p>Costante di peso: <strong>${CP} kg</strong> (${o.genere === 'donna' ? 'donne' : 'uomini'}, ${o.fascia === 'giovane_anziano' ? 'sotto 18 o sopra 45 anni' : '18-45 anni'})${o.unaMano ? ' · una mano (× 0,6)' : ''}${o.dueOperatori ? ' · due operatori (× 0,85)' : ''}</p>
        <table class="doc__tabella"><thead><tr><th>Operazione</th><th>Peso</th><th>Fattori A · B · C · D · E · F</th><th>Peso limite (RWL)</th><th>Indice</th><th>Esito</th></tr></thead><tbody>
          ${
            risultati
              .map(({ r, n }) => {
                const f = fasciaNiosh(n?.indice);
                return `<tr><td>${esc(r.compito)}</td><td>${esc(r.peso)} kg</td><td><small>${n ? [n.fattori.altezza, n.fattori.dislocazione, n.fattori.distanza, n.fattori.angolo, n.fattori.presa, n.fattori.frequenza].map(f2).join(' · ') : 'dati incompleti'}</small></td><td>${n ? `${f2(n.rwl)} kg` : ''}</td><td><strong>${n ? f2(n.indice) ?? '—' : ''}</strong></td><td class="doc__esito--${n ? f.colore : ''}">${n ? esc(f.testo) : ''}</td></tr>`;
              })
              .join('') || '<tr><td style="height:2em" colspan="6"></td></tr>'
          }
        </tbody></table>
        <p><small>A altezza · B spostamento verticale · C distanza orizzontale · D rotazione · E presa · F frequenza. RWL = costante di peso × A × B × C × D × E × F; indice = peso / RWL.</small></p>
        <h2>Misure</h2>
        <ul>
          <li>Usare carrelli, transpallet, sollevatori o altri ausili; ridurre il peso delle confezioni.</li>
          <li>Tenere i carichi tra l'altezza delle nocche e delle spalle, vicino al corpo, senza ruotare il busto.</li>
          <li>Formare e addestrare i lavoratori alle corrette tecniche di sollevamento.</li>
          ${risultati.some(({ n }) => !n || n.indice === null || n.indice > 0.85) ? '<li>Per gli indici oltre 0,85: programmare interventi di riduzione; oltre 1: sorveglianza sanitaria.</li>' : ''}
        </ul>
        <p class="doc__nota">Il metodo vale per sollevamenti a due mani in piedi; per traino, spinta e movimenti ripetitivi servono altri metodi (ISO 11228-2 e 11228-3).</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', a.rspp])}`;
    }
  },
  {
    id: 'valutazione-chimico',
    titolo: 'Valutazione del rischio chimico (stima semplificata)',
    descrizione: 'Per ogni prodotto: pericolosità dalle frasi H e stima dell\'esposizione (quantità, frequenza, modalità d\'uso, ventilazione), con esito irrilevante o da approfondire.',
    allegati: { prodotti: () => true, categorie: ['sds'] },
    ambito: 'impresa',
    attivaSe: { q: 'chimici', eq: true },
    opzioni: (d) => [
      {
        id: 'righe',
        etichetta: 'Uso dei prodotti',
        tipo: 'tabella',
        aiuto: 'Le frasi H sono nella sezione 2 della scheda di sicurezza. Modalità: chiuso (mai a contatto), controllato (dosatori, piccole superfici), aperto (pennello, immersione), dispersivo (spruzzo, polveri).',
        righe: Math.max(4, (d.prodotti || []).length),
        iniziali: (d.prodotti || []).map((p) => ({ prodotto: p.nome, frasiH: p.frasiH || '', quantita: 'media', frequenza: 'settimanale', modalita: 'aperto', ventilazione: 'generale' })),
        colonne: [
          { id: 'prodotto', etichetta: 'Prodotto' },
          { id: 'frasiH', etichetta: 'Frasi H' },
          { id: 'quantita', etichetta: 'Quantità', tipo: 'scelta', valori: [{ valore: 'piccola', etichetta: 'Piccola (g, ml)' }, { valore: 'media', etichetta: 'Media (kg, litri)' }, { valore: 'grande', etichetta: 'Grande (decine di kg)' }] },
          { id: 'frequenza', etichetta: 'Frequenza', tipo: 'scelta', valori: [{ valore: 'occasionale', etichetta: 'Occasionale' }, { valore: 'settimanale', etichetta: 'Settimanale' }, { valore: 'quotidiana', etichetta: 'Quotidiana' }] },
          { id: 'modalita', etichetta: 'Modalità', tipo: 'scelta', valori: [{ valore: 'chiuso', etichetta: 'Sistema chiuso' }, { valore: 'controllato', etichetta: 'Uso controllato' }, { valore: 'aperto', etichetta: 'Uso aperto' }, { valore: 'dispersivo', etichetta: 'Spruzzo o polveri' }] },
          { id: 'ventilazione', etichetta: 'Ventilazione', tipo: 'scelta', valori: [{ valore: 'generale', etichetta: 'Finestre o ricambio' }, { valore: 'aspirazione', etichetta: 'Aspirazione localizzata' }, { valore: 'nessuna', etichetta: 'Nessuna' }] }
        ]
      }
    ],
    genera: ({ anagrafica: a, oggi, opzioni: o = {} }) => {
      const righe = (o.righe || []).filter((r) => r.prodotto);
      const PER = { cmr: 'CMR', alta: 'Alta', media: 'Media', bassa: 'Bassa', nessuna: 'Nessuna' };
      const valutate = righe.map((r) => {
        const p = pericolositaSalute(r.frasiH);
        const e = esposizioneChimica(r);
        return { r, p, e, esito: esitoChimico(p, e) };
      });
      return `${intestazione(a)}
        <h1>Valutazione del rischio chimico</h1>
        <p class="doc__rif">D.Lgs. 81/2008 Titolo IX, Capo I (artt. 221-232); Reg. CE 1272/2008 (CLP)</p>
        <p>Stima qualitativa: combina la pericolosità per la salute indicata dalle frasi H con l'esposizione, stimata da quantità, frequenza, modalità d'uso e ventilazione.</p>
        <table class="doc__tabella"><thead><tr><th>Prodotto</th><th>Frasi H</th><th>Pericolosità</th><th>Esposizione</th><th>Esito</th></tr></thead><tbody>
          ${valutate.map((x) => `<tr><td>${esc(x.r.prodotto)}</td><td>${esc(x.r.frasiH)}</td><td>${PER[x.p]}</td><td>${esc(x.e)}</td><td class="doc__esito--${x.esito.colore}">${esc(x.esito.testo)}</td></tr>`).join('') || '<tr><td style="height:2em" colspan="5"></td></tr>'}
        </tbody></table>
        <h2>Misure generali (art. 224)</h2>
        <ul>
          <li>Ridurre al minimo quantità e numero di lavoratori esposti; preferire prodotti meno pericolosi.</li>
          <li>Conservare i prodotti chiusi, etichettati e separati per incompatibilità; tenere le schede di sicurezza a disposizione.</li>
          <li>Aerare i locali, usare aspirazione localizzata per spruzzi, vapori e polveri.</li>
          <li>Usare i DPI indicati nella sezione 8 delle schede; non mangiare, bere o fumare durante l'uso.</li>
          <li>Informare e formare i lavoratori sulle etichette e sulle schede di sicurezza.</li>
        </ul>
        <p class="doc__nota">Per i prodotti con esito giallo o rosso confermare la valutazione con un modello riconosciuto (per esempio MoVaRisCh) o con misure ambientali. I prodotti cancerogeni, mutageni o tossici per la riproduzione richiedono la valutazione del Capo II.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', a.rspp], ['Il medico competente', a.medico])}`;
    }
  },
  {
    id: 'richiesta-visite',
    titolo: 'Comunicazione al medico competente dei lavoratori da visitare',
    descrizione: 'Elenco dei lavoratori con visita da fare o in scadenza, con mansione, rischi e tipo di visita, da inviare al medico competente.',
    ambito: 'impresa',
    attivaSe: { all: [{ fatto: 'haDipendenti' }, { fatto: 'rischiConSorveglianza' }] },
    opzioni: () => [{ id: 'giorni', etichetta: 'Includi le visite in scadenza entro (giorni)', tipo: 'numero', valore: '60' }],
    genera: ({ anagrafica: a, oggi, situazioni, dvr, ctx, opzioni: o = {} }) => {
      const giorni = Number(o.giorni) || 60;
      const limite = new Date(Date.parse(oggi) + giorni * 86400000).toISOString().slice(0, 10);
      const rischi = pericoliPresenti(dvr, ctx).filter((x) => x.sorveglianza).map((x) => x.pericolo);
      const elenco = (situazioni || [])
        .map((s) => ({ s, vm: s.voci.find((x) => x.requisito.id === 'visita-medica') }))
        .filter(({ vm }) => vm && (!vm.registro || (vm.prossimaScadenza && vm.prossimaScadenza <= limite)));
      return `${intestazione(a)}
        <p>Al medico competente ${v(a.medico, 24)}</p>
        <h1>Richiesta di visite mediche</h1>
        <p class="doc__rif">D.Lgs. 81/2008 artt. 18 c. 1 lett. g e 41</p>
        <p>Le chiediamo di programmare le visite per i seguenti lavoratori.</p>
        <table class="doc__tabella"><thead><tr><th>Lavoratore</th><th>Mansione</th><th>Tipo di visita</th><th>Scadenza</th></tr></thead><tbody>
          ${elenco
            .map(({ s, vm }) => `<tr><td>${esc(nomeCompleto(s.lavoratore))}</td><td>${esc(s.lavoratore.mansione || '')}</td><td>${vm.registro ? 'Periodica' : 'Preventiva (prima visita)'}</td><td>${vm.prossimaScadenza ? esc(data(vm.prossimaScadenza)) : 'subito'}</td></tr>`)
            .join('') || '<tr><td colspan="4">Nessuna visita da programmare nel periodo.</td></tr>'}
        </tbody></table>
        <h2>Rischi per i quali è prevista la sorveglianza</h2>
        <ul>${rischi.map((x) => `<li>${esc(x)}</li>`).join('') || '<li>&nbsp;</li>'}</ul>
        <p>Segnaliamo inoltre: ☐ cambi di mansione ☐ rientri dopo assenze per malattia oltre 60 giorni ☐ richieste di visita dei lavoratori ☐ nuove attrezzature o prodotti.</p>
        <p>Restiamo a disposizione per concordare date e luogo delle visite.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)])}`;
    }
  },
  {
    id: 'permesso-lavoro-caldo',
    titolo: 'Permesso di lavoro a caldo',
    descrizione: 'Autorizzazione per saldature, tagli, molature e uso di cannelli nei locali, con controlli prima, durante e dopo e sorveglianza antincendio.',
    ambito: 'impresa',
    attivaSe: { any: [{ q: 'appalti_in_sede', eq: true }, { q: 'cantiere', eq: true }, { q: 'lavori_presso_clienti', eq: true }] },
    opzioni: () => [
      { id: 'ditta', etichetta: 'Chi esegue il lavoro (ditta e operatore)', tipo: 'testo' },
      { id: 'luogo', etichetta: 'Luogo esatto', tipo: 'testo' },
      { id: 'lavoro', etichetta: 'Tipo di lavoro', tipo: 'spunte', valori: ['Saldatura elettrica', 'Saldatura o taglio a fiamma', 'Brasatura con cannello', 'Molatura o taglio con disco', 'Guaine bituminose a fiamma'].map((x) => ({ valore: x, etichetta: x })) },
      { id: 'data', etichetta: 'Data', tipo: 'data' },
      { id: 'dalle', etichetta: 'Dalle ore', tipo: 'testo' },
      { id: 'alle', etichetta: 'Alle ore', tipo: 'testo' },
      { id: 'sorvegliante', etichetta: 'Addetto alla sorveglianza antincendio', tipo: 'testo' }
    ],
    genera: ({ anagrafica: a, oggi, opzioni: o = {} }) => `${intestazione(a)}
        <h1>Permesso di lavoro a caldo</h1>
        <p class="doc__rif">D.Lgs. 81/2008 artt. 26 e 46; DM 3 settembre 2021 · buona prassi per prevenire gli incendi</p>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Esecutore</th><td>${esc(o.ditta || '')}</td></tr>
          <tr><th>Luogo</th><td>${esc(o.luogo || '')}</td></tr>
          <tr><th>Lavoro</th><td>${(o.lavoro || []).map(esc).join(', ')}</td></tr>
          <tr><th>Validità</th><td>${o.data ? esc(data(o.data)) : v('', 10)} dalle ${v(o.dalle, 5)} alle ${v(o.alle, 5)} (valido solo per questo turno)</td></tr>
          <tr><th>Sorveglianza antincendio</th><td>${esc(o.sorvegliante || '')}</td></tr>
        </tbody></table>
        <h2>Prima di iniziare</h2>
        <ul class="doc__spunte">
          ${[
            'Valutato se il lavoro può essere fatto a freddo o fuori dai locali',
            'Allontanati i materiali combustibili per almeno 10 metri, o protetti con teli ignifughi',
            'Chiuse o protette aperture, fessure e cavedi dove possono cadere scintille',
            'Pavimenti puliti da polveri, oli e residui combustibili',
            'Disattivati i rivelatori di fumo della zona, con avviso al responsabile',
            'Estintore adatto a portata di mano e operatore capace di usarlo',
            'Locale aerato; nessuna atmosfera infiammabile (verificare serbatoi e tubazioni)',
            'Bombole vincolate, valvole antiritorno sui cannelli',
            'Operatori con DPI per saldatura (schermo, guanti, indumenti ignifughi)'
          ]
            .map((x) => `<li>☐ ${esc(x)}</li>`)
            .join('')}
        </ul>
        <h2>Durante il lavoro</h2>
        <ul class="doc__spunte"><li>☐ Sorveglianza continua di scintille e materiali vicini</li><li>☐ Lavoro sospeso se cambiano le condizioni</li></ul>
        <h2>Dopo il lavoro</h2>
        <ul class="doc__spunte">
          <li>☐ Sorveglianza della zona e dei locali vicini per almeno 60 minuti dopo la fine</li>
          <li>☐ Controllo finale alle ore ${v('', 5)}: nessun focolaio o surriscaldamento</li>
          <li>☐ Rivelatori riattivati</li>
        </ul>
        ${firme(['Autorizza (committente o preposto)', titolare(a)], ['L\'esecutore', ''], ['Controllo finale', o.sorvegliante || ''])}`
  },
  {
    id: 'info-rischi-ditte',
    titolo: 'Informazioni sui rischi per le ditte esterne',
    descrizione: 'Da consegnare a ogni ditta o lavoratore autonomo che lavora nella tua sede: rischi presenti, regole ed emergenze.',
    allegati: { planimetrie: ['generale', 'emergenza'] },
    ambito: 'impresa',
    attivaSe: { q: 'appalti_in_sede', eq: true },
    genera: ({ anagrafica: a, oggi, dvr, ctx, lavoratori, ruoli, allegatiDoc }) => {
      const presenti = pericoliPresenti(dvr, ctx);
      const addetti = (ruolo) => (lavoratori || []).filter((l) => (l.ruoli || []).includes(ruolo)).map(nomeCompleto).join(', ');
      return `${intestazione(a)}
        <h1>Informazioni sui rischi presenti nella sede e sulle misure di emergenza</h1>
        <p class="doc__rif">D.Lgs. 81/2008 art. 26 c. 1 lett. b</p>
        <p>Alla ditta ${v('', 30)} incaricata di ${v('', 30)} nella sede di ${v([a.sede, a.comune].filter(Boolean).join(', '), 30)}.</p>
        <h2>Rischi presenti nella sede</h2>
        <ul>${presenti.map((x) => `<li>${esc(x.pericolo)}</li>`).join('') || '<li>&nbsp;</li>'}</ul>
        <h2>Regole da rispettare</h2>
        <ul>
          <li>Prima di iniziare, presentarsi al referente e concordare orari e zone di lavoro.</li>
          <li>Non usare macchine, attrezzature o prodotti dell'impresa senza autorizzazione.</li>
          <li>Delimitare e segnalare la propria area di lavoro; non lasciare materiali lungo i passaggi e le uscite.</li>
          <li>Comunicare in anticipo lavori rumorosi, polverosi, con fiamme libere o con prodotti pericolosi.</li>
          <li>Esporre la tessera di riconoscimento con fotografia.</li>
        </ul>
        <h2>Emergenze</h2>
        ${rifPlanimetrie(allegatiDoc) ? `<p>Planimetrie con vie di esodo e presidi: ${rifPlanimetrie(allegatiDoc)}</p>` : ''}
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Referente dell'impresa</th><td>${esc(titolare(a))} ${a.contatto ? `· ${esc(a.contatto)}` : ''}</td></tr>
          <tr><th>Addetti al primo soccorso</th><td>${esc(addetti('primo_soccorso'))}</td></tr>
          <tr><th>Addetti antincendio</th><td>${esc(addetti('antincendio'))}</td></tr>
          <tr><th>Cassetta di primo soccorso</th><td></td></tr>
          <tr><th>Estintori e uscite di emergenza</th><td></td></tr>
          <tr><th>Punto di raccolta</th><td></td></tr>
          <tr><th>Numero unico di emergenza</th><td>112</td></tr>
        </tbody></table>
        ${luogoData(a, oggi)}
        ${firme(['Il committente', titolare(a)], ['Per ricevuta, la ditta esterna', ''])}`;
    }
  },
  {
    id: 'duvri-bozza',
    titolo: 'DUVRI completo (rischi da interferenze)',
    descrizione: 'Documento unico di valutazione dei rischi da interferenze: dati delle due imprese, verifica dell\'idoneità, rischi della sede e della ditta, valutazione delle interferenze con probabilità e danno, misure, costi della sicurezza, verbale di coordinamento.',
    allegati: { planimetrie: ['generale', 'layout', 'emergenza'] },
    ambito: 'impresa',
    attivaSe: { all: [{ fatto: 'haDipendenti' }, { q: 'appalti_in_sede', eq: true }] },
    opzioni: (d) => [
      { id: 'tipo', etichetta: 'Tipo di lavoro o servizio affidato', tipo: 'scelta', valori: (d.lavorazioni?.tipiAppalto || []).map((t) => ({ valore: t.id, etichetta: t.titolo })) },
      { id: 'appaltatore', etichetta: 'Ditta o lavoratore autonomo incaricato', tipo: 'testo' },
      { id: 'pivaAppaltatore', etichetta: 'P.IVA della ditta', tipo: 'testo' },
      { id: 'referenteAppaltatore', etichetta: 'Referente della ditta e telefono', tipo: 'testo' },
      { id: 'oggetto', etichetta: 'Descrizione del lavoro', tipo: 'area' },
      { id: 'luogo', etichetta: 'Locali o aree interessati', tipo: 'testo' },
      { id: 'dal', etichetta: 'Dal', tipo: 'data' },
      { id: 'al', etichetta: 'Al', tipo: 'data' },
      { id: 'orari', etichetta: 'Orari di lavoro della ditta', tipo: 'testo' },
      { id: 'uominiGiorno', etichetta: 'Durata stimata in uomini-giorno', tipo: 'numero' },
      { id: 'referente', etichetta: 'Tuo referente per il coordinamento', tipo: 'testo', valore: d.anagrafica?.titolare || '' }
    ],
    genera: (d) => {
      const { anagrafica: a, oggi, dvr, ctx, lavoratori, opzioni: o = {} } = d;
      const tipo = (d.lavorazioni?.tipiAppalto || []).find((t) => t.id === o.tipo);
      const presenti = pericoliPresenti(dvr, ctx).filter((x) => !['stress', 'differenze', 'tutele', 'interferenze'].includes(x.id));
      const criteri = dvr?.criteri;
      const ug = Number(o.uominiGiorno) || null;
      const particolari = ['incendio-alto', 'confinati', 'amianto', 'cancerogeni', 'atex'].filter((id) => (id === 'incendio-alto' ? ctx?.risposte?.rischio_incendio === 'si' : presenti.some((x) => x.id === id)));
      const esente = ug !== null && ug <= 5 && !particolari.length;
      const righe = (n, c = 4) => Array.from({ length: n }, () => `<tr>${'<td style="height:2em"></td>'.repeat(c)}</tr>`).join('');
      return `${intestazione(a)}
        <section class="doc__frontespizio">
          <h1>Documento unico di valutazione dei rischi da interferenze</h1>
          <p class="doc__rif">D.Lgs. 81/2008 art. 26 c. 3</p>
          <table class="doc__tabella doc__tabella--campi"><tbody>
            <tr><th>Committente</th><td>${esc(a.ragioneSociale || '')}</td></tr>
            <tr><th>Appaltatore</th><td>${esc(o.appaltatore || '')}</td></tr>
            <tr><th>Oggetto</th><td>${esc(tipo?.titolo || '')}</td></tr>
          </tbody></table>
        </section>

        <h2>1 · Premessa</h2>
        <p>Il committente, in caso di affidamento di lavori, servizi o forniture a imprese o lavoratori autonomi all'interno della propria sede, verifica la loro idoneità tecnico-professionale, fornisce informazioni dettagliate sui rischi dell'ambiente di lavoro e sulle misure di emergenza, promuove la cooperazione e il coordinamento ed elabora il presente documento, che indica le misure per eliminare o ridurre al minimo i rischi da interferenze. Il DUVRI è allegato al contratto e va aggiornato in base all'evoluzione dei lavori.</p>
        ${
          ug !== null
            ? `<p class="${esente ? 'doc__nota' : ''}"><strong>Applicabilità:</strong> durata stimata ${ug} uomini-giorno${particolari.length ? `, con rischi particolari (${esc(particolari.join(', '))})` : ''}. ${
                esente
                  ? 'Il DUVRI non sarebbe obbligatorio (art. 26 c. 3-bis): restano comunque dovuti verifica dell\'idoneità, informazione e coordinamento. Si redige come buona prassi.'
                  : 'Il DUVRI è obbligatorio.'
              }</p>`
            : ''
        }

        <h2>2 · Imprese interessate</h2>
        <table class="doc__tabella"><thead><tr><th></th><th>Committente</th><th>Appaltatore</th></tr></thead><tbody>
          <tr><th>Ragione sociale</th><td>${esc(a.ragioneSociale || '')}</td><td>${esc(o.appaltatore || '')}</td></tr>
          <tr><th>P.IVA</th><td>${esc(a.piva || '')}</td><td>${esc(o.pivaAppaltatore || '')}</td></tr>
          <tr><th>Datore di lavoro</th><td>${esc(titolare(a))}</td><td></td></tr>
          <tr><th>RSPP</th><td>${esc(ctx?.risposte?.dl_rspp ? titolare(a) : a.rspp || '')}</td><td></td></tr>
          <tr><th>Referente per il coordinamento</th><td>${esc(o.referente || '')}</td><td>${esc(o.referenteAppaltatore || '')}</td></tr>
          <tr><th>Addetti alle emergenze</th><td>${esc([conRuolo(lavoratori, 'primo_soccorso'), conRuolo(lavoratori, 'antincendio')].filter(Boolean).join(', '))}</td><td></td></tr>
        </tbody></table>

        ${rifPlanimetrie(d.allegatiDoc) ? `<p><strong>Planimetrie dei luoghi:</strong> ${rifPlanimetrie(d.allegatiDoc)}</p>` : ''}
        <h2>3 · Descrizione dell'appalto</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Tipo</th><td>${esc(tipo?.titolo || '')}</td></tr>
          <tr><th>Descrizione</th><td>${o.oggetto ? esc(o.oggetto).replace(/\n/g, '<br>') : ''}</td></tr>
          <tr><th>Luogo</th><td>${esc([o.luogo, a.sede, a.comune].filter(Boolean).join(', '))}</td></tr>
          <tr><th>Periodo</th><td>${o.dal ? `dal ${esc(data(o.dal))}` : ''} ${o.al ? `al ${esc(data(o.al))}` : ''}</td></tr>
          <tr><th>Orari</th><td>${esc(o.orari || '')}</td></tr>
          <tr><th>Uomini-giorno stimati</th><td>${ug ?? ''}</td></tr>
        </tbody></table>

        <h2>4 · Verifica dell'idoneità tecnico-professionale</h2>
        <table class="doc__tabella"><thead><tr><th>Documento</th><th>Acquisito il</th><th>Note</th></tr></thead><tbody>
          ${['Visura camerale', 'Autocertificazione dei requisiti (art. 47 DPR 445/2000)', 'DURC in corso di validità', 'Elenco dei lavoratori impiegati e attestati di formazione', 'Elenco delle attrezzature e dei prodotti che porterà', ...(o.tipo === 'edili' ? ['Documenti dell\'Allegato XVII e patente a crediti'] : [])]
            .map((x) => `<tr><td>☐ ${esc(x)}</td><td></td><td></td></tr>`)
            .join('')}
        </tbody></table>

        <h2>5 · Rischi presenti nella sede del committente</h2>
        <table class="doc__tabella"><thead><tr><th>Rischio</th><th>Misure in atto da rispettare</th></tr></thead><tbody>
          ${presenti.map((x) => `<tr><td>${esc(x.pericolo)}</td><td>${esc(x.misure.slice(0, 2).join('; '))}</td></tr>`).join('') || righe(2, 2)}
        </tbody></table>

        <h2>6 · Rischi introdotti dall'appaltatore</h2>
        <ul>${(tipo?.rischiIntrodotti || []).map((r) => `<li>${esc(r)}</li>`).join('')}<li>${v('', 30)}</li></ul>

        <h2>7 · Valutazione dei rischi da interferenze e misure</h2>
        ${criteri ? '<p>Stima con R = P × D come nel DVR del committente (scala da 1 a 4).</p>' : ''}
        <table class="doc__tabella"><thead><tr><th>Attività</th><th>Rischio da interferenza</th><th>P</th><th>D</th><th>R</th><th>Misure</th><th>A cura di</th></tr></thead><tbody>
          ${(tipo?.interferenze || [])
            .map((x) => {
              const R = x.probabilita * x.magnitudo;
              return `<tr><td>${esc(x.attivita)}</td><td>${esc(x.rischio)}</td><td>${x.probabilita}</td><td>${x.magnitudo}</td><td><strong>${R}</strong><br><small>${esc(livelloRischio(criteri, R)?.etichetta || '')}</small></td><td>${esc(x.misure)}</td><td>${esc(x.acura)}</td></tr>`;
            })
            .join('')}
          ${righe(2, 7)}
        </tbody></table>

        <h2>8 · Misure generali di coordinamento</h2>
        <ul>
          <li>Prima dell'inizio dei lavori si svolge un sopralluogo congiunto e una riunione di coordinamento (verbale al punto 10).</li>
          <li>Il personale dell'appaltatore espone la tessera di riconoscimento con fotografia, generalità e datore di lavoro.</li>
          <li>L'appaltatore non usa attrezzature, impianti o prodotti del committente senza autorizzazione scritta.</li>
          <li>Le aree di lavoro sono delimitate e segnalate; uscite e percorsi di emergenza restano sempre liberi.</li>
          <li>I lavori rumorosi, polverosi o con fiamme libere sono comunicati in anticipo e concordati negli orari.</li>
          <li>In caso di emergenza il personale dell'appaltatore segue le istruzioni degli addetti del committente e raggiunge il punto di raccolta.</li>
          <li>Ogni variazione dei lavori, del personale o dei tempi viene comunicata e il documento aggiornato.</li>
        </ul>

        <h2>9 · Costi della sicurezza</h2>
        <p>Costi delle misure per eliminare o ridurre i rischi da interferenze, non soggetti a ribasso (art. 26 c. 5).</p>
        <table class="doc__tabella"><thead><tr><th>Voce</th><th>Unità</th><th>Quantità</th><th>Prezzo unitario €</th><th>Totale €</th></tr></thead><tbody>
          ${(tipo?.costi || []).map((c) => `<tr><td>${esc(c.voce)}</td><td>${esc(c.unita)}</td><td></td><td></td><td></td></tr>`).join('')}
          ${righe(1, 5)}
          <tr><th colspan="4">Totale costi della sicurezza</th><td></td></tr>
        </tbody></table>

        <h2>10 · Verbale di sopralluogo e riunione di coordinamento</h2>
        <p>Il giorno ${v('', 10)} presso ${v([a.sede, a.comune].filter(Boolean).join(', '), 24)} si sono riuniti i referenti delle imprese, che hanno visitato le aree di lavoro, esaminato i rischi e concordato le misure di questo documento.</p>
        <p>Osservazioni: ${v('', 50)}</p>

        <h2>11 · Aggiornamenti</h2>
        <table class="doc__tabella"><thead><tr><th>Revisione</th><th>Data</th><th>Motivo</th></tr></thead><tbody>${righe(2, 3)}</tbody></table>

        ${luogoData(a, oggi)}
        ${firme(['Il committente', titolare(a)], ['L\'appaltatore', o.appaltatore || ''], ['L\'RLS del committente, per presa visione', a.rls])}`;
    }
  },
  {
    id: 'autocertificazione-idoneita',
    titolo: 'Autocertificazione di idoneità tecnico-professionale',
    descrizione: 'Da consegnare ai clienti o all\'impresa affidataria quando lavori presso di loro o in cantiere.',
    ambito: 'impresa',
    attivaSe: { any: [{ q: 'lavori_presso_clienti', eq: true }, { q: 'cantiere', eq: true }] },
    genera: ({ anagrafica: a, oggi, ctx, lavoratori, attrezzature }) => {
      const dip = ctx?.fatti?.haDipendenti;
      return `${intestazione(a)}
        <h1>Dichiarazione sostitutiva di idoneità tecnico-professionale</h1>
        <p class="doc__rif">D.Lgs. 81/2008 art. 26 c. 1 lett. a e Allegato XVII · DPR 445/2000 artt. 46 e 47</p>
        <p>Il sottoscritto ${v(titolare(a), 24)}, legale rappresentante dell'impresa ${v(a.ragioneSociale, 28)}, con sede in ${v([a.sede, a.comune].filter(Boolean).join(', '), 28)},
        P.IVA ${v(a.piva, 14)}, consapevole delle sanzioni penali previste per le dichiarazioni false (art. 76 DPR 445/2000),</p>
        <p style="text-align:center"><strong>DICHIARA</strong></p>
        <ul>
          <li>che l'impresa è iscritta alla Camera di commercio per attività coerenti con i lavori affidati (codice ATECO ${v(ctx?.fatti?.ateco?.codice, 8)});</li>
          <li>di essere in regola con i versamenti contributivi e assicurativi (DURC);</li>
          ${
            dip
              ? `<li>di aver redatto il documento di valutazione dei rischi;</li>
          <li>di aver nominato l'RSPP (${v(ctx?.risposte?.dl_rspp ? `${titolare(a)}, datore di lavoro` : a.rspp, 20)})${a.medico ? ` e il medico competente (${esc(a.medico)})` : ', e il medico competente quando previsto'};</li>
          <li>di aver designato gli addetti al primo soccorso e alla prevenzione incendi;</li>
          <li>che i lavoratori (${(lavoratori || []).length}) sono formati, informati e, quando previsto, sottoposti a sorveglianza sanitaria, e dispongono dei DPI necessari;</li>`
              : `<li>di lavorare senza dipendenti e di rispettare gli obblighi dell'art. 21 del D.Lgs. 81/2008 (attrezzature conformi, DPI, tessera di riconoscimento);</li>`
          }
          <li>che le attrezzature usate sono conformi al Titolo III del D.Lgs. 81/2008${(attrezzature || []).length ? `: ${(attrezzature || []).map((x) => esc(x.nome)).join(', ')}` : ''};</li>
          <li>di non essere destinatario di provvedimenti di sospensione o interdittivi (art. 14 D.Lgs. 81/2008).</li>
        </ul>
        <p>Si allegano: visura camerale, DURC${dip ? ', elenco dei lavoratori con attestati di formazione e idoneità sanitaria' : ''}, documento d'identità.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il legale rappresentante', titolare(a)])}`;
    }
  },
  {
    id: 'pos-bozza',
    titolo: 'Piano operativo di sicurezza (POS) completo',
    descrizione: 'POS dettagliato con tutti i contenuti dell\'Allegato XV: dati del cantiere e dell\'impresa, lavoratori e incarichi, organizzazione, attrezzature, prodotti, analisi di ogni fase di lavoro con rischi, misure e DPI, emergenze e documenti da tenere in cantiere.',
    allegati: { planimetrie: ['cantiere'], attrezzature: (o) => (id) => !(o.attrezzatureCantiere || []).length || o.attrezzatureCantiere.includes(id), prodotti: (o) => (id) => !(o.prodottiCantiere || []).length || o.prodottiCantiere.includes(id), categorie: ['libretto', 'ce', 'pericoli', 'verifica', 'sds'] },
    ambito: 'impresa',
    attivaSe: { all: [{ q: 'cantiere', eq: true }, { fatto: 'haDipendenti' }] },
    opzioni: (d) => [
      { id: 'indirizzo', etichetta: 'Indirizzo del cantiere', tipo: 'testo' },
      { id: 'committente', etichetta: 'Committente', tipo: 'testo' },
      { id: 'responsabileLavori', etichetta: 'Responsabile dei lavori', tipo: 'testo' },
      { id: 'csp', etichetta: 'Coordinatore per la progettazione (CSP)', tipo: 'testo' },
      { id: 'cse', etichetta: 'Coordinatore per l\'esecuzione (CSE)', tipo: 'testo' },
      { id: 'affidataria', etichetta: 'Impresa affidataria (se diversa)', tipo: 'testo' },
      { id: 'lavori', etichetta: 'Lavori affidati alla tua impresa', tipo: 'area' },
      { id: 'inizio', etichetta: 'Inizio lavori', tipo: 'data' },
      { id: 'durata', etichetta: 'Durata prevista', tipo: 'testo', segnaposto: 'es. 30 giorni lavorativi' },
      { id: 'orario', etichetta: 'Orario di lavoro in cantiere', tipo: 'testo', segnaposto: 'es. 8-12 / 13-17' },
      { id: 'capocantiere', etichetta: 'Capocantiere o preposto', tipo: 'scelta', valori: (d.lavoratori || []).map((l) => ({ valore: l.id, etichetta: nomeCompleto(l) })) },
      { id: 'lavoratori', etichetta: 'Lavoratori presenti in cantiere', tipo: 'spunte', valori: (d.lavoratori || []).map((l) => ({ valore: l.id, etichetta: `${nomeCompleto(l)}${l.mansione ? ` · ${l.mansione}` : ''}` })) },
      { id: 'fasi', etichetta: 'Lavorazioni che farai in questo cantiere', tipo: 'spunte', valori: (d.lavorazioni?.fasiCantiere || []).map((f) => ({ valore: f.id, etichetta: f.titolo })) },
      { id: 'attrezzatureCantiere', etichetta: 'Attrezzature portate in cantiere (nessuna spunta = tutte)', tipo: 'spunte', valori: (d.macchine || []).map((s) => ({ valore: s.attrezzatura.id, etichetta: s.attrezzatura.nome })) },
      { id: 'prodottiCantiere', etichetta: 'Prodotti usati in cantiere (nessuna spunta = tutti)', tipo: 'spunte', valori: (d.prodotti || []).map((p) => ({ valore: p.id, etichetta: p.nome })) },
      { id: 'subappalti', etichetta: 'Lavorazioni affidate in subappalto o a lavoratori autonomi', tipo: 'area' }
    ],
    genera: (d) => {
      const { anagrafica: a, oggi, ctx, opzioni: o = {}, ruoli } = d;
      const tutti = d.lavoratori || [];
      const scelti = (o.lavoratori || []).length ? tutti.filter((l) => o.lavoratori.includes(l.id)) : tutti;
      const fasi = (d.lavorazioni?.fasiCantiere || []).filter((f) => (o.fasi || []).includes(f.id));
      const capo = tutti.find((l) => l.id === o.capocantiere);
      const etichetta = (r) => (ruoli && ruoli[r]) || r;
      const dpi = [...new Set(fasi.flatMap((f) => f.dpi))];
      const sitPer = (id) => (d.situazioni || []).find((s) => s.lavoratore.id === id);
      const macchine = (o.attrezzatureCantiere || []).length ? (d.macchine || []).filter((s) => o.attrezzatureCantiere.includes(s.attrezzatura.id)) : d.macchine || [];
      const prodotti = (o.prodottiCantiere || []).length ? (d.prodotti || []).filter((p) => o.prodottiCantiere.includes(p.id)) : d.prodotti || [];
      const ponteggio = fasi.some((f) => f.id === 'ponteggi') || macchine.some((s) => s.attrezzatura.tipo === 'ponteggio');
      const vuoto = (n = 2) => Array.from({ length: n }, () => '<tr><td style="height:2em"></td><td></td><td></td></tr>').join('');
      return `${intestazione(a)}
        <section class="doc__frontespizio">
          <h1>Piano operativo di sicurezza</h1>
          <p class="doc__rif">D.Lgs. 81/2008 artt. 89 c. 1 lett. h, 96 c. 1 lett. g e Allegato XV punto 3.2</p>
          <table class="doc__tabella doc__tabella--campi"><tbody>
            <tr><th>Impresa esecutrice</th><td>${esc(a.ragioneSociale || '')}</td></tr>
            <tr><th>Cantiere</th><td>${esc(o.indirizzo || '')}</td></tr>
            <tr><th>Data</th><td>${esc(data(oggi))}</td></tr>
          </tbody></table>
        </section>

        <h2>1 · Dati del cantiere</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Indirizzo</th><td>${esc(o.indirizzo || '')}</td></tr>
          <tr><th>Committente</th><td>${esc(o.committente || '')}</td></tr>
          <tr><th>Responsabile dei lavori</th><td>${esc(o.responsabileLavori || '')}</td></tr>
          <tr><th>Coordinatore per la progettazione</th><td>${esc(o.csp || '')}</td></tr>
          <tr><th>Coordinatore per l'esecuzione</th><td>${esc(o.cse || '')}</td></tr>
          <tr><th>Impresa affidataria</th><td>${esc(o.affidataria || '')}</td></tr>
          <tr><th>Lavori affidati</th><td>${o.lavori ? esc(o.lavori).replace(/\n/g, '<br>') : ''}</td></tr>
          <tr><th>Inizio e durata</th><td>${esc(o.inizio ? data(o.inizio) : '')} ${o.durata ? `· ${esc(o.durata)}` : ''}</td></tr>
        </tbody></table>

        ${rifPlanimetrie(d.allegatiDoc) ? `<p><strong>Layout di cantiere:</strong> ${rifPlanimetrie(d.allegatiDoc)}</p>` : ''}
        <h2>2 · Impresa esecutrice (lett. a)</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Ragione sociale e sede</th><td>${esc(a.ragioneSociale || '')} · ${esc([a.sede, a.comune].filter(Boolean).join(', '))}</td></tr>
          <tr><th>P.IVA</th><td>${esc(a.piva || '')}</td></tr>
          <tr><th>Telefono / email</th><td>${esc(a.contatto || '')}</td></tr>
          <tr><th>Codice ATECO</th><td>${esc(ctx?.fatti?.ateco ? `${ctx.fatti.ateco.codice} – ${ctx.fatti.ateco.descrizione}` : '')}</td></tr>
          <tr><th>Datore di lavoro</th><td>${esc(titolare(a))}</td></tr>
          <tr><th>RSPP</th><td>${esc(ctx?.risposte?.dl_rspp ? `${titolare(a)} (datore di lavoro)` : a.rspp || '')}</td></tr>
          <tr><th>Medico competente</th><td>${esc(a.medico || '')}</td></tr>
          <tr><th>RLS / RLST</th><td>${esc(a.rls || '')}</td></tr>
          <tr><th>Capocantiere / preposto</th><td>${esc(capo ? nomeCompleto(capo) : conRuolo(scelti, 'preposto'))}</td></tr>
          <tr><th>Addetti al primo soccorso in cantiere</th><td>${esc(conRuolo(scelti, 'primo_soccorso'))}</td></tr>
          <tr><th>Addetti antincendio ed emergenze in cantiere</th><td>${esc(conRuolo(scelti, 'antincendio'))}</td></tr>
        </tbody></table>

        <h3>Lavoratori presenti in cantiere e incarichi (lett. a e b)</h3>
        <table class="doc__tabella"><thead><tr><th>Lavoratore</th><th>Mansione</th><th>Incarichi</th><th>Formazione e idoneità</th></tr></thead><tbody>
          ${scelti
            .map((l) => {
              const s = sitPer(l.id);
              const stato = s
                ? s.voci
                    .filter((x) => ['formazione-generale', 'formazione-specifica', 'visita-medica', 'corso-preposto', 'corso-primo-soccorso', 'corso-antincendio', 'addestramento-quota', 'patentino-macchine'].includes(x.requisito.id))
                    .map((x) => `${esc(x.requisito.titolo)}: ${x.colore === 'verde' ? 'in regola' : '<strong>' + esc(x.motivo) + '</strong>'}`)
                    .join('<br>')
                : '';
              return `<tr><td>${esc(nomeCompleto(l))}</td><td>${esc(l.mansione || '')}</td><td>${esc((l.ruoli || []).map(etichetta).join(', '))}</td><td><small>${stato}</small></td></tr>`;
            })
            .join('') || '<tr><td style="height:2em" colspan="4"></td></tr>'}
        </tbody></table>

        <h2>3 · Organizzazione del lavoro (lett. c)</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Orario e turni</th><td>${esc(o.orario || '')}</td></tr>
          <tr><th>Lavorazioni</th><td>${fasi.map((f) => esc(f.titolo)).join('<br>')}</td></tr>
          <tr><th>Subappalti e lavoratori autonomi</th><td>${o.subappalti ? esc(o.subappalti).replace(/\n/g, '<br>') : 'Nessuno'}</td></tr>
          <tr><th>Servizi igienico-assistenziali</th><td>Messi a disposizione dall'impresa affidataria secondo il PSC ☐ · propri ☐</td></tr>
        </tbody></table>

        <h2>4 · Opere provvisionali, macchine e impianti (lett. d)</h2>
        <table class="doc__tabella"><thead><tr><th>Attrezzatura</th><th>Pericoli e DPI</th><th>Verifiche e controlli</th><th>Libretto</th></tr></thead><tbody>
          ${macchine
            .map((s) => {
              const pm = pericoliMacchina(s.attrezzatura, d.etichettePericoli);
              return `<tr><td>${esc(s.attrezzatura.nome)}${s.tipo ? ` <small>(${esc(s.tipo.etichetta)})</small>` : ''}${s.attrezzatura.matricola ? `<br><small>matr. ${esc(s.attrezzatura.matricola)}</small>` : ''}</td><td><small>${esc(pm.pericoli)}${pm.dpi ? `<br>DPI: ${esc(pm.dpi)}` : ''}</small></td><td>${s.colore === 'verde' ? 'In regola' : esc(s.voci.filter((x) => x.colore !== 'verde').map((x) => `${x.controllo.titolo}: ${x.motivo}`).join('; '))}</td><td>${rifAllegati(d.allegatiDoc, 'attrezzatura', s.attrezzatura.id) || '<em>da allegare</em>'}</td></tr>`;
            })
            .join('')}
          ${[...new Set(fasi.flatMap((f) => f.attrezzature))]
            .filter((n) => !macchine.some((s) => normalizza(s.attrezzatura.nome).includes(normalizza(n))))
            .map((n) => `<tr><td>${esc(n)} <small>(prevista dalle lavorazioni)</small></td><td></td><td></td><td></td></tr>`)
            .join('')}
        </tbody></table>
        ${ponteggio ? '<p><strong>Ponteggio:</strong> allegare il PiMUS, il libretto di autorizzazione ministeriale e, se oltre 20 m o fuori schema, il progetto firmato.</p>' : ''}

        <h2>5 · Sostanze e miscele pericolose (lett. e)</h2>
        <table class="doc__tabella"><thead><tr><th>Prodotto</th><th>Pericoli</th><th>Scheda di sicurezza</th></tr></thead><tbody>
          ${prodotti.map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc([(p.pittogrammi || []).join(', '), p.frasiH].filter(Boolean).join(' · '))}</td><td>${p.dataSds ? `del ${esc(data(p.dataSds))}` : ''} ${rifAllegati(d.allegatiDoc, 'prodotto', p.id) || 'da allegare'}</td></tr>`).join('') || vuoto(1)}
        </tbody></table>

        <h2>6 · Rumore (lett. f)</h2>
        <table class="doc__tabella"><thead><tr><th>Mansione</th><th>Livello di esposizione LEX,8h dB(A)</th><th>Fonte (misure o banca dati)</th></tr></thead><tbody>
          ${[...new Set(scelti.map((l) => l.mansione).filter(Boolean))].map((m) => `<tr><td>${esc(m)}</td><td></td><td></td></tr>`).join('') || vuoto(2)}
        </tbody></table>

        <h2>7 · Analisi delle lavorazioni: rischi, misure e DPI (lett. g)</h2>
        ${
          fasi.length
            ? fasi
                .map(
                  (f, i) => `<div class="doc__rischio"><h3>7.${i + 1} · ${esc(f.titolo)}</h3>
          <table class="doc__tabella doc__tabella--campi"><tbody>
            <tr><th>Attrezzature</th><td>${f.attrezzature.map(esc).join(', ')}</td></tr>
            <tr><th>Rischi</th><td><ul>${f.rischi.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></td></tr>
            <tr><th>Misure di prevenzione</th><td><ul>${f.misure.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></td></tr>
            <tr><th>DPI</th><td>${f.dpi.map(esc).join(', ')}</td></tr>
            <tr><th>Misure integrative rispetto al PSC</th><td style="height:2em"></td></tr>
          </tbody></table></div>`
                )
                .join('')
            : '<p>Scegli le lavorazioni del cantiere nei dati del documento.</p>'
        }

        <h2>8 · Procedure complementari richieste dal PSC (lett. h)</h2>
        <p style="min-height:3em">&nbsp;</p>

        <h2>9 · DPI forniti ai lavoratori (lett. i)</h2>
        <table class="doc__tabella"><thead><tr><th>DPI</th>${scelti.map((l) => `<th>${esc(l.cognome || l.nome || '')}</th>`).join('')}</tr></thead><tbody>
          ${(dpi.length ? dpi : ['Casco', 'Scarpe antinfortunistiche', 'Guanti']).map((x) => `<tr><td>${esc(x)}</td>${scelti.map(() => '<td>☐</td>').join('')}</tr>`).join('')}
        </tbody></table>

        <h2>10 · Informazione e formazione dei lavoratori (lett. l)</h2>
        <p>I lavoratori sono stati informati sui contenuti del presente POS e del PSC e sulle procedure di emergenza del cantiere in data ${v('', 10)}. Gli attestati di formazione sono allegati.</p>

        <h2>11 · Gestione delle emergenze in cantiere</h2>
        <ul>
          <li>Numero unico di emergenza: <strong>112</strong>. Indicare ai soccorsi l'indirizzo esatto del cantiere e il punto di accesso.</li>
          <li>Cassetta di pronto soccorso e estintore presenti in cantiere, posizione: ${v('', 24)}.</li>
          <li>In caso di infortunio: prestare soccorso, mettere in sicurezza l'area, avvisare il capocantiere, il datore di lavoro e il CSE.</li>
          <li>Procedure di emergenza comuni definite nel PSC: ☐ lette e condivise con i lavoratori.</li>
        </ul>

        <h2>12 · Documenti da tenere in cantiere</h2>
        <ul class="doc__spunte">
          ${['Copia del POS e del PSC', 'Copia della notifica preliminare (quando prevista)', 'Tessere di riconoscimento dei lavoratori', 'Attestati di formazione e giudizi di idoneità', 'Libretti e verifiche delle attrezzature', 'Schede di sicurezza dei prodotti', 'Verbale di consegna dei DPI', 'DURC e iscrizione alla Camera di commercio', 'Patente a crediti (impresa e lavoratori autonomi)', ...(ponteggio ? ['PiMUS, libretto e disegno del ponteggio'] : [])]
            .map((x) => `<li>☐ ${esc(x)}</li>`)
            .join('')}
        </ul>

        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro dell\'impresa esecutrice', titolare(a)], ['Per presa visione, l\'RLS', a.rls], ['Verifica di congruità dell\'impresa affidataria', ''], ['Verifica di idoneità del CSE', o.cse || ''])}`;
    }
  },
  {
    id: 'stress-preliminare',
    titolo: 'Valutazione preliminare dello stress lavoro-correlato',
    descrizione: 'Scheda per raccogliere gli eventi sentinella degli ultimi 3 anni (infortuni già compilati dal registro) e i fattori di contenuto e contesto del lavoro.',
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, oggi, perAnno }) => {
      const anni = Object.keys(perAnno || {}).sort();
      const riga = (titolo, valori) => `<tr><td>${esc(titolo)}</td>${anni.map((y) => `<td>${valori ? esc(String(valori[y])) : ''}</td>`).join('')}</tr>`;
      const inf = Object.fromEntries(anni.map((y) => [y, perAnno[y].infortunio]));
      const area = (titolo, voci) => `<tr><th colspan="2">${esc(titolo)}</th></tr>${voci.map((x) => `<tr><td>${esc(x)}</td><td style="width:45%"></td></tr>`).join('')}`;
      return `${intestazione(a)}
        <h1>Valutazione preliminare del rischio stress lavoro-correlato</h1>
        <p class="doc__rif">D.Lgs. 81/2008 art. 28 c. 1-bis · indicazioni della Commissione consultiva del 17/11/2010 · BOZZA</p>
        <p>Valutazione condotta da ${v(titolare(a), 20)} con ${v(a.rspp, 18)} e ${v(a.medico, 18)}, sentiti i lavoratori o l'RLS ${v(a.rls, 16)}.</p>
        <h2>A · Eventi sentinella</h2>
        <table class="doc__tabella"><thead><tr><th>Indicatore</th>${anni.map((y) => `<th>${y}</th>`).join('')}</tr></thead><tbody>
          ${riga('Infortuni (dal registro di safetyDoc)', inf)}
          ${['Assenze per malattia (giorni)', 'Assenze dal lavoro (permessi, ritardi)', 'Ferie non godute', 'Trasferimenti interni richiesti', 'Cessazioni e dimissioni (turnover)', 'Procedimenti e sanzioni disciplinari', 'Richieste di visite mediche straordinarie', 'Segnalazioni scritte del medico competente', 'Lamentele formali dei lavoratori'].map((t) => riga(t)).join('')}
        </tbody></table>
        <h2>B · Contenuto e contesto del lavoro</h2>
        <table class="doc__tabella"><thead><tr><th>Fattore</th><th>Osservazioni (criticità rilevate)</th></tr></thead><tbody>
          ${area('Contenuto del lavoro', ['Ambiente di lavoro e attrezzature', 'Pianificazione dei compiti', 'Carico e ritmo di lavoro', 'Orario di lavoro e turni'])}
          ${area('Contesto del lavoro', ['Organizzazione e comunicazione', 'Ruoli e responsabilità chiari', 'Possibilità di crescita professionale', 'Autonomia nelle decisioni', 'Rapporti tra colleghi e con i responsabili', 'Conciliazione tra lavoro e famiglia'])}
        </tbody></table>
        <h2>C · Esito</h2>
        <p>☐ Non emergono elementi di rischio: la valutazione si conclude e sarà ripetuta periodicamente o al cambiare dell'organizzazione.</p>
        <p>☐ Emergono elementi di rischio: si adottano le misure correttive sotto indicate e se ne verifica l'efficacia; se non efficaci si passa alla valutazione approfondita.</p>
        <p style="min-height:4em">Misure: </p>
        <p class="doc__nota">Per l'analisi dettagliata si può usare la lista di controllo della metodologia INAIL.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', a.rspp], ['L\'RLS, per consultazione', a.rls])}`;
    }
  },
  {
    id: 'informativa-lavoratrici-madri',
    titolo: 'Informativa per le lavoratrici: gravidanza e allattamento',
    descrizione: 'Esito della valutazione dei rischi per gravidanza e allattamento, da consegnare a tutte le lavoratrici e all\'RLS. Le indicazioni vanno confermate con il medico competente.',
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, oggi, dvr, ctx, lavoratori }) => {
      const presenti = new Set(pericoliPresenti(dvr, ctx).map((x) => x.id));
      const righe = RISCHI_MATERNITA.filter((r) => !r.pericolo || presenti.has(r.pericolo));
      const mansioni = [...new Set((lavoratori || []).map((l) => (l.mansione || '').trim()).filter(Boolean))];
      return `${intestazione(a)}
        <h1>Informativa alle lavoratrici sui rischi per la gravidanza e l'allattamento</h1>
        <p class="doc__rif">D.Lgs. 151/2001 artt. 7, 11, 12 e 53; Allegati A, B e C</p>
        <p>Gentile lavoratrice, l'impresa ha valutato i rischi delle mansioni ${mansioni.length ? `(${mansioni.map(esc).join(', ')})` : ''} per le lavoratrici in gravidanza e fino a 7 mesi dopo il parto. Ti informiamo dei risultati.</p>
        <table class="doc__tabella"><thead><tr><th>Rischio presente</th><th>Indicazione</th><th>Misura che adotteremo</th></tr></thead><tbody>
          ${righe.map((r) => `<tr><td>${esc(r.rischio)}</td><td>${esc(r.indicazione)}</td><td>${esc(r.misura)}</td></tr>`).join('')}
        </tbody></table>
        <h2>Cosa fare</h2>
        <ul>
          <li>Comunica la gravidanza il prima possibile, con il certificato medico: solo così possiamo proteggerti e spostarti a un lavoro compatibile.</li>
          <li>Lo spostamento non riduce la retribuzione. Se non c'è un lavoro compatibile, l'impresa lo comunica all'Ispettorato del lavoro per l'astensione anticipata.</li>
          <li>Hai diritto ai permessi retribuiti per gli esami prenatali (art. 14 D.Lgs. 151/2001).</li>
        </ul>
        <p class="doc__nota">Indicazioni generate da safetyDoc sulla base dei rischi del DVR: vanno confermate dal medico competente e dall'RSPP per ogni mansione.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['Per ricevuta, la lavoratrice', ''], ['Per presa visione, l\'RLS', a.rls])}`;
    }
  },
  {
    id: 'informativa-minori',
    titolo: 'Informativa per il lavoratore minorenne e la famiglia',
    descrizione: 'Rischi della mansione, lavori vietati e orari, da consegnare al minore e ai genitori prima dell\'inizio.',
    ambito: 'impresa',
    attivaSe: { q: 'minori', eq: true },
    genera: ({ anagrafica: a, oggi, dvr, ctx }) => {
      const presenti = pericoliPresenti(dvr, ctx);
      return `${intestazione(a)}
        <h1>Informativa sui rischi per il lavoratore minorenne e per chi ne ha la responsabilità</h1>
        <p class="doc__rif">L. 977/1967 artt. 6, 7, 8, 18 e Allegato I (come modificata dai D.Lgs. 345/1999 e 262/2000)</p>
        <p>Lavoratore: ${v('', 26)} nato il ${v('', 10)} · mansione: ${v('', 22)} · tutore aziendale o preposto: ${v('', 20)}</p>
        <h2>Rischi della mansione e misure</h2>
        <table class="doc__tabella"><thead><tr><th>Rischio</th><th>Misure e limitazioni per il minore</th></tr></thead><tbody>
          ${presenti.map((x) => `<tr><td>${esc(x.pericolo)}</td><td style="width:55%"></td></tr>`).join('') || '<tr><td style="height:2em"></td><td></td></tr>'}
        </tbody></table>
        <h2>Lavori che il minore non svolgerà</h2>
        <p>Quelli elencati nell'Allegato I della L. 977/1967 (per esempio con agenti chimici, biologici o cancerogeni pericolosi, rumore elevato, macchine e lavorazioni pericolose), salvo le eccezioni previste per la formazione, sotto la sorveglianza di un formatore esperto e nel rispetto della sicurezza.</p>
        <h2>Orari e tutele</h2>
        <ul>
          <li>Non più di 8 ore al giorno e 40 a settimana, con le pause previste; nessun lavoro notturno.</li>
          <li>Visita medica prima dell'inizio e poi periodica secondo il medico competente.</li>
          <li>Formazione e addestramento specifici prima di usare attrezzature.</li>
        </ul>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['Il lavoratore', ''], ['Il genitore o tutore', ''])}`;
    }
  },
  {
    id: 'elenco-prodotti-chimici',
    titolo: 'Elenco dei prodotti chimici e delle schede di sicurezza',
    descrizione: 'Tutti i prodotti inseriti in safetyDoc con pericoli, data della scheda di sicurezza e DPI. Da allegare al DVR e tenere a disposizione dei lavoratori.',
    allegati: { prodotti: () => true, categorie: ['sds'] },
    ambito: 'impresa',
    attivaSe: { q: 'chimici', eq: true },
    genera: ({ anagrafica: a, oggi, prodotti, allegatiDoc }) => `${intestazione(a)}
        <h1>Elenco dei prodotti chimici e delle schede di sicurezza</h1>
        <p class="doc__rif">D.Lgs. 81/2008 artt. 223 e 227; Reg. CE 1907/2006 art. 31</p>
        <table class="doc__tabella"><thead><tr><th>Prodotto</th><th>Fornitore</th><th>Uso</th><th>Pericoli</th><th>Scheda del</th><th>DPI</th></tr></thead><tbody>
          ${
            (prodotti || [])
              .map(
                (p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.fornitore || '')}</td><td>${esc(p.uso || '')}</td><td>${esc([(p.pittogrammi || []).join(', '), p.frasiH].filter(Boolean).join(' · '))}</td><td>${esc(data(p.dataSds))} ${rifAllegati(allegatiDoc, 'prodotto', p.id)}</td><td>${esc(p.dpi || '')}</td></tr>`
              )
              .join('') || '<tr><td colspan="6" style="height:2em"></td></tr>'
          }
        </tbody></table>
        <p class="doc__nota">Le schede di sicurezza complete sono conservate in ${v('', 24)} e consultabili dai lavoratori.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)])}`
  },
  {
    id: 'registro-eventi',
    titolo: 'Registro di infortuni e quasi incidenti',
    descrizione: 'Elenco degli eventi registrati in safetyDoc con cause, comunicazioni all\'INAIL e misure adottate.',
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, oggi, eventi, lavoratori }) => {
      const nome = (id) => {
        const l = (lavoratori || []).find((x) => x.id === id);
        return l ? nomeCompleto(l) : '';
      };
      const TIPI = { infortunio: 'Infortunio', medicazione: 'Medicazione', quasi_incidente: 'Quasi incidente' };
      return `${intestazione(a)}
        <h1>Registro di infortuni e quasi incidenti</h1>
        <p class="doc__rif">D.Lgs. 81/2008 artt. 18 c. 1 lett. r e 29 c. 3 · registro interno di prevenzione</p>
        <table class="doc__tabella"><thead><tr><th>Data</th><th>Tipo</th><th>Lavoratore</th><th>Cosa è successo e perché</th><th>Prognosi / INAIL</th><th>Misura adottata</th></tr></thead><tbody>
          ${
            (eventi || [])
              .map(
                (e) => `<tr><td>${esc(data(e.data))}</td><td>${esc(TIPI[e.tipo] || '')}</td><td>${esc(nome(e.lavoratoreId))}</td><td>${esc([e.luogo, e.descrizione, e.causa ? `Causa: ${e.causa}` : ''].filter(Boolean).join(' · '))}</td><td>${
                  e.tipo === 'infortunio' ? esc([e.giorniPrognosi !== null && e.giorniPrognosi !== undefined && e.giorniPrognosi !== '' ? `${e.giorniPrognosi} gg` : '', e.dataDenuncia ? `comunicato il ${data(e.dataDenuncia)}` : ''].filter(Boolean).join(' · ')) : '—'
                }</td><td>${esc(e.misure || '')}${e.misureFatte ? ' ✓' : ''}</td></tr>`
              )
              .join('') || '<tr><td colspan="6" style="height:2em"></td></tr>'
          }
        </tbody></table>
        <p class="doc__nota">Non vengono registrate diagnosi o informazioni sanitarie: solo i giorni di prognosi necessari per le comunicazioni all'INAIL.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)])}`;
    }
  },
  {
    id: 'registro-temperature',
    titolo: 'Registro delle temperature (frigoriferi e congelatori)',
    descrizione: 'Scheda mensile da stampare e appendere vicino ai frigoriferi, come previsto dal piano HACCP.',
    ambito: 'impresa',
    attivaSe: { q: 'alimenti', eq: true },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
        <h1>Registro delle temperature</h1>
        <p>Mese ${v('', 12)} · Anno ${v(oggi.slice(0, 4), 6)}</p>
        <table class="doc__tabella"><thead><tr><th>Giorno</th><th>Frigo 1 (°C)</th><th>Frigo 2 (°C)</th><th>Congelatore (°C)</th><th>Anomalie e azioni</th><th>Firma</th></tr></thead><tbody>
          ${Array.from({ length: 31 }, (_, i) => `<tr><td>${i + 1}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
        </tbody></table>
        <p class="doc__nota">Limiti indicativi: frigoriferi 0/+4 °C, congelatori −18 °C o meno. Usa i limiti scritti nel tuo piano di autocontrollo.</p>`
  },
  {
    id: 'cartello-allergeni',
    titolo: 'Cartello degli allergeni',
    descrizione: 'I 14 allergeni da indicare ai clienti, con la tabella da compilare per ogni piatto o prodotto.',
    ambito: 'impresa',
    attivaSe: { q: 'alimenti', eq: true },
    genera: ({ anagrafica: a }) => `${intestazione(a)}
        <h1>Informazioni sugli allergeni</h1>
        <p class="doc__rif">Reg. UE 1169/2011, Allegato II · D.Lgs. 231/2017</p>
        <p><strong>I nostri prodotti possono contenere uno o più di questi allergeni. Chiedi al personale: ti diremo quali sono presenti in ogni piatto o prodotto.</strong></p>
        <ol class="doc__allergeni">${ALLERGENI.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        <h2>Tabella per il personale</h2>
        <table class="doc__tabella"><thead><tr><th>Piatto o prodotto</th>${ALLERGENI.map((_, i) => `<th>${i + 1}</th>`).join('')}</tr></thead><tbody>
          ${Array.from({ length: 12 }, () => `<tr><td style="height:1.8em"></td>${ALLERGENI.map(() => '<td></td>').join('')}</tr>`).join('')}
        </tbody></table>`
  }
];

/** I modelli utili a questa impresa. Per quelli "lavoratore" indica anche per chi servono. */
export function modelliDisponibili(ctx) {
  return MODELLI.filter((m) => valuta(m.attivaSe, ctx));
}

/** Il modello serve per questo lavoratore? (ruolo richiesto, se c'è) */
export function modelloPerLavoratore(modello, lavoratore) {
  const ruoli = modello.ruoli || (modello.ruolo ? [modello.ruolo] : null);
  if (!ruoli) return true;
  return (lavoratore.ruoli || []).some((r) => ruoli.includes(r));
}

export function generaDocumento(id, dati) {
  const m = MODELLI.find((x) => x.id === id);
  if (!m) throw new Error(`Modello sconosciuto: ${id}`);
  const d = { anagrafica: {}, ...dati, anagrafica: dati.anagrafica || {} };
  return { modello: m, html: m.genera(d) + appendiceAllegati(dati.allegatiDoc) };
}
