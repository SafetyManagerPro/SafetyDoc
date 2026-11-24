// Modelli di documenti compilati con i dati dell'impresa e dei lavoratori.
// Modulo puro: ogni modello restituisce HTML pronto da stampare. Testabile con Node.
// I testi sono bozze da verificare con il consulente prima dell'uso.

import { valuta, nomeCompleto, ESITI_VISITA } from './engine.js';
import { LINGUE, TESTI } from './lingue.js';

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

export const MODELLI = [
  {
    id: 'stato-sicurezza',
    titolo: 'Stato della sicurezza dell\'impresa',
    descrizione: 'Riepilogo stampabile di tutti gli adempimenti, dei lavoratori e delle macchine, con date e documenti allegati. Utile per il consulente o in caso di controllo.',
    ambito: 'impresa',
    attivaSe: { sempre: true },
    genera: ({ anagrafica: a, oggi, piano, situazioni, macchine, allegati }) => {
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
        ${quandoCapita.length ? `<h2>Da applicare quando capita</h2><ul>${quandoCapita.map((x) => `<li>${esc(x.scheda.titolo)}</li>`).join('')}</ul>` : ''}
        <p class="doc__nota">Riepilogo prodotto con safetyDoc sulla base dei dati inseriti dall'impresa. Non sostituisce i documenti originali, che vanno conservati. Per le visite mediche è riportato solo il giudizio di idoneità.</p>
        ${firme(['Il datore di lavoro', titolare(a)])}`;
    }
  },
  {
    id: 'dvr-bozza',
    titolo: 'Documento di valutazione dei rischi (DVR) completo',
    descrizione: 'DVR dettagliato secondo le procedure standardizzate: organigramma, mansioni, criteri, valutazione di ogni rischio con probabilità e danno, attrezzature, prodotti, DPI, formazione, sorveglianza sanitaria, emergenze e programma di miglioramento. Da completare e firmare con RSPP e medico competente.',
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    opzioni: () => [
      { id: 'revisione', etichetta: 'Revisione n.', tipo: 'testo', segnaposto: '0' },
      { id: 'orario', etichetta: 'Orario di lavoro', tipo: 'testo', segnaposto: 'es. lun-ven 8-12 e 14-18' },
      { id: 'ciclo', etichetta: 'Descrizione del ciclo lavorativo', tipo: 'area', segnaposto: 'Cosa fa l\'impresa, in quali fasi, in quali locali' },
      { id: 'presidi', etichetta: 'Presidi di emergenza', tipo: 'area', segnaposto: 'es. 2 estintori a polvere all\'ingresso e in laboratorio, cassetta di pronto soccorso in ufficio, punto di raccolta nel cortile' }
    ],
    genera: (d) => {
      const { anagrafica: a, oggi, dvr, ctx, lavoratori, attivita, opzioni: o = {} } = d;
      const pericoli = (dvr?.pericoli || []).map((x) => ({ ...x, presente: ctx ? valuta(x.presenteSe, ctx) : false }));
      const presenti = pericoli.filter((x) => x.presente);
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
        <h3>Organigramma della sicurezza</h3>
        ${organigramma(a, lavoratori, dlRspp)}

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
              <tr><th>Valutazione</th><td>P = ${v(String(x.probabilita || ''), 2)} · D = ${v(String(x.magnitudo || ''), 2)} · <strong>R = ${R || ''} (${esc(liv?.etichetta || '')})</strong><br><small>Valori tipici da confermare durante il sopralluogo.</small></td></tr>
              <tr><th>Misure di prevenzione e protezione</th><td><ul>${x.misure.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></td></tr>
              <tr><th>DPI</th><td>${(x.dpi || []).map(esc).join(', ') || 'Non necessari'}</td></tr>
              <tr><th>Informazione e formazione</th><td>${esc(x.formazione || '')}</td></tr>
              <tr><th>Sorveglianza sanitaria</th><td>${x.sorveglianza ? 'Sì, secondo il protocollo del medico competente' : 'Non prevista per questo rischio'}</td></tr>
              ${st ? `<tr><th>Valutazione specifica o adempimento</th><td>${esc(st)}</td></tr>` : ''}
              <tr><th>Riferimenti normativi</th><td>${esc(x.norma || '')}</td></tr>
              <tr><th>Misure di miglioramento, incaricato, entro il</th><td style="height:2.2em">${liv && liv.da >= 6 ? `<strong>${esc(liv.azione)}.</strong> ` : ''}</td></tr>
            </tbody></table></div>`;
          })
          .join('')}

        <h2>7 · Attrezzature di lavoro</h2>
        ${
          (d.macchine || []).length
            ? `<table class="doc__tabella"><thead><tr><th>Attrezzatura</th><th>Tipo</th><th>Matricola</th><th>CE</th><th>Controlli</th></tr></thead><tbody>
          ${d.macchine
            .map((s) => `<tr><td>${esc(s.attrezzatura.nome)}</td><td>${esc(s.tipo?.etichetta || '')}</td><td>${esc(s.attrezzatura.matricola || '')}</td><td>${s.attrezzatura.marcaturaCE === false ? 'NO' : 'Sì'}</td><td>${s.voci
              .map((x) => `${esc(x.controllo.titolo)}: ${x.registro ? `fatto il ${esc(data(x.registro.data))}` : 'da fare'}${x.prossimaScadenza ? `, scade il ${esc(data(x.prossimaScadenza))}` : ''}`)
              .join('<br>')}</td></tr>`)
            .join('')}</tbody></table>`
            : '<p>Nessuna attrezzatura registrata in safetyDoc.</p>'
        }

        <h2>8 · Prodotti chimici</h2>
        ${
          (d.prodotti || []).length
            ? `<table class="doc__tabella"><thead><tr><th>Prodotto</th><th>Uso</th><th>Pericoli</th><th>Scheda di sicurezza</th><th>DPI</th></tr></thead><tbody>${d.prodotti
                .map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.uso || '')}</td><td>${esc([(p.pittogrammi || []).join(', '), p.frasiH].filter(Boolean).join(' · '))}</td><td>${p.dataSds ? esc(data(p.dataSds)) : 'da acquisire'}</td><td>${esc(p.dpi || '')}</td></tr>`)
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
              (x) => `<tr><td>${esc(x.requisito.titolo)}</td><td>${x.registro ? esc(data(x.registro.data)) : '—'}</td><td>${
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
    titolo: 'Nomina del Responsabile del servizio di prevenzione e protezione (RSPP)',
    descrizione: 'Lettera di incarico all\'RSPP esterno o interno, con accettazione.',
    ambito: 'impresa',
    attivaSe: { all: [{ fatto: 'haDipendenti' }, { not: { q: 'dl_rspp', eq: true } }] },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Designazione del Responsabile del servizio di prevenzione e protezione</h1>
      <p class="doc__rif">Artt. 17, 31, 32 e 33 del D.Lgs. 81/2008</p>
      <p>Il/La sottoscritto/a ${v(titolare(a), 24)}, datore di lavoro dell'impresa ${v(a.ragioneSociale, 24)},</p>
      <p class="doc__centro">DESIGNA</p>
      <p>${v(a.rspp, 24)} quale Responsabile del servizio di prevenzione e protezione dai rischi (RSPP), avendo verificato il possesso delle capacità e dei requisiti professionali previsti dall'art. 32 del D.Lgs. 81/2008.</p>
      <p>L'RSPP svolge i compiti dell'art. 33: individuazione e valutazione dei rischi, elaborazione delle misure di prevenzione e protezione e delle procedure di sicurezza, proposta dei programmi di informazione e formazione, partecipazione alla riunione periodica.</p>
      <p>Il datore di lavoro si impegna a fornire all'RSPP le informazioni necessarie sull'organizzazione del lavoro, sui processi produttivi e sui lavoratori.</p>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Per accettazione, l\'RSPP', a.rspp])}`
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
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    opzioni: () => [
      { id: 'coordinatore', etichetta: 'Coordinatore dell\'emergenza', tipo: 'testo' },
      { id: 'raccolta', etichetta: 'Punto di raccolta', tipo: 'testo', segnaposto: 'es. parcheggio davanti all\'ingresso' },
      { id: 'presidi', etichetta: 'Estintori, idranti, cassetta di soccorso e dove si trovano', tipo: 'area' },
      { id: 'interruttori', etichetta: 'Dove si tolgono corrente, gas e acqua', tipo: 'area' },
      { id: 'persone', etichetta: 'Massimo di persone presenti (lavoratori e clienti)', tipo: 'numero' }
    ],
    genera: ({ anagrafica: a, oggi, lavoratori, opzioni: o = {} }) => `${intestazione(a)}
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
        <p class="doc__nota">Allegare la planimetria con vie di esodo, uscite, presidi e punto di raccolta, ed esporla nei locali.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', a.rspp], ['L\'RLS, per presa visione', a.rls])}`
  },
  {
    id: 'informazione-art36',
    titolo: 'Informazione al lavoratore sui rischi (art. 36)',
    descrizione: 'Informazione scritta sui rischi della mansione, le misure, i DPI, le emergenze e le figure della sicurezza, con firma del lavoratore.',
    ambito: 'lavoratore',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, oggi, lavoratore: l, lavoratori, dvr, ctx, prodotti }) => {
      const presenti = pericoliPresenti(dvr, ctx).filter((x) => !['interferenze', 'differenze', 'tutele'].includes(x.id));
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
    ambito: 'lavoratore',
    attivaSe: { fatto: 'haDipendenti' },
    opzioni: (d) => [
      { id: 'attrezzature', etichetta: 'Attrezzature su cui è stato addestrato', tipo: 'spunte', valori: (d.attrezzature || []).map((x) => ({ valore: x.nome, etichetta: x.nome })) },
      { id: 'addestratore', etichetta: 'Chi ha svolto l\'addestramento', tipo: 'testo' },
      { id: 'ore', etichetta: 'Durata (ore)', tipo: 'numero' }
    ],
    genera: ({ anagrafica: a, oggi, lavoratore: l, attrezzature, opzioni: o = {} }) => {
      const elenco = (o.attrezzature || []).length ? o.attrezzature : (attrezzature || []).map((x) => x.nome);
      return `${intestazione(a)}
        <h1>Verbale di addestramento</h1>
        <p class="doc__rif">D.Lgs. 81/2008 artt. 37 c. 5, 71 c. 7 e 73</p>
        <p>Il lavoratore ${v(l ? nomeCompleto(l) : '', 24)}, mansione ${v(l?.mansione, 18)}, ha ricevuto in data ${v(data(oggi), 10)} l'addestramento pratico, della durata di ${v(o.ore ? `${o.ore} ore` : '', 8)}, svolto da ${v(o.addestratore, 22)}, persona esperta, sul luogo di lavoro.</p>
        <table class="doc__tabella"><thead><tr><th>Attrezzatura</th><th>Contenuti</th><th>Esito</th></tr></thead><tbody>
          ${(elenco.length ? elenco : ['']).map((n) => `<tr><td>${esc(n)}</td><td><small>Uso corretto secondo il manuale, dispositivi di sicurezza, controlli prima dell'uso, DPI, cosa fare in caso di guasto</small></td><td>☐ idoneo ☐ da ripetere</td></tr>`).join('')}
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
    id: 'info-rischi-ditte',
    titolo: 'Informazioni sui rischi per le ditte esterne',
    descrizione: 'Da consegnare a ogni ditta o lavoratore autonomo che lavora nella tua sede: rischi presenti, regole ed emergenze.',
    ambito: 'impresa',
    attivaSe: { q: 'appalti_in_sede', eq: true },
    genera: ({ anagrafica: a, oggi, dvr, ctx, lavoratori, ruoli }) => {
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
      const ponteggio = fasi.some((f) => f.id === 'ponteggi') || (d.macchine || []).some((s) => s.attrezzatura.tipo === 'ponteggio');
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
        <table class="doc__tabella"><thead><tr><th>Attrezzatura</th><th>Matricola</th><th>Verifiche e controlli</th></tr></thead><tbody>
          ${(d.macchine || [])
            .map((s) => `<tr><td>${esc(s.attrezzatura.nome)}${s.tipo ? ` <small>(${esc(s.tipo.etichetta)})</small>` : ''}</td><td>${esc(s.attrezzatura.matricola || '')}</td><td>${s.colore === 'verde' ? 'In regola' : esc(s.voci.filter((x) => x.colore !== 'verde').map((x) => `${x.controllo.titolo}: ${x.motivo}`).join('; '))}</td></tr>`)
            .join('')}
          ${[...new Set(fasi.flatMap((f) => f.attrezzature))]
            .filter((n) => !(d.macchine || []).some((s) => normalizza(s.attrezzatura.nome).includes(normalizza(n))))
            .map((n) => `<tr><td>${esc(n)} <small>(prevista dalle lavorazioni)</small></td><td></td><td></td></tr>`)
            .join('')}
        </tbody></table>
        ${ponteggio ? '<p><strong>Ponteggio:</strong> allegare il PiMUS, il libretto di autorizzazione ministeriale e, se oltre 20 m o fuori schema, il progetto firmato.</p>' : ''}

        <h2>5 · Sostanze e miscele pericolose (lett. e)</h2>
        <table class="doc__tabella"><thead><tr><th>Prodotto</th><th>Pericoli</th><th>Scheda di sicurezza</th></tr></thead><tbody>
          ${(d.prodotti || []).map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc([(p.pittogrammi || []).join(', '), p.frasiH].filter(Boolean).join(' · '))}</td><td>${p.dataSds ? `del ${esc(data(p.dataSds))}, allegata` : 'da allegare'}</td></tr>`).join('') || vuoto(1)}
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
    ambito: 'impresa',
    attivaSe: { q: 'chimici', eq: true },
    genera: ({ anagrafica: a, oggi, prodotti }) => `${intestazione(a)}
        <h1>Elenco dei prodotti chimici e delle schede di sicurezza</h1>
        <p class="doc__rif">D.Lgs. 81/2008 artt. 223 e 227; Reg. CE 1907/2006 art. 31</p>
        <table class="doc__tabella"><thead><tr><th>Prodotto</th><th>Fornitore</th><th>Uso</th><th>Pericoli</th><th>Scheda del</th><th>DPI</th></tr></thead><tbody>
          ${
            (prodotti || [])
              .map(
                (p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.fornitore || '')}</td><td>${esc(p.uso || '')}</td><td>${esc([(p.pittogrammi || []).join(', '), p.frasiH].filter(Boolean).join(' · '))}</td><td>${esc(data(p.dataSds))}</td><td>${esc(p.dpi || '')}</td></tr>`
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
  return { modello: m, html: m.genera({ anagrafica: {}, ...dati, anagrafica: dati.anagrafica || {} }) };
}
