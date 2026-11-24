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
    titolo: 'Bozza del Documento di valutazione dei rischi (DVR)',
    descrizione: 'Bozza secondo lo schema delle procedure standardizzate, già compilata con le tue risposte, i lavoratori e le misure suggerite. Da completare con il tuo RSPP.',
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, oggi, dvr, ctx, lavoratori, attivita, attrezzature }) => {
      const pericoli = (dvr?.pericoli || []).map((x) => ({ ...x, presente: ctx ? valuta(x.presenteSe, ctx) : false }));
      const presenti = pericoli.filter((x) => x.presente);
      const mansioni = [...new Set((lavoratori || []).map((l) => (l.mansione || '').trim()).filter(Boolean))];
      const famiglie = [...new Set(pericoli.map((x) => x.famiglia))];
      const n = ctx?.fatti?.lavoratori || '';
      return `${intestazione(a)}
        <h1>Documento di valutazione dei rischi</h1>
        <p class="doc__rif">${esc(dvr?.riferimento || '')}</p>
        <p class="doc__nota">BOZZA generata da safetyDoc il ${esc(data(oggi))}: va verificata, completata e firmata. Deve avere data certa.</p>

        <h2>Modulo 1.1 · Descrizione generale dell'azienda</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Ragione sociale</th><td>${esc(a.ragioneSociale || '')}</td></tr>
          <tr><th>Attività</th><td>${esc(attivita || '')}</td></tr>
          <tr><th>Codice ATECO</th><td>${esc(ctx?.fatti?.ateco ? `${ctx.fatti.ateco.codice} – ${ctx.fatti.ateco.descrizione}` : '')}</td></tr>
          <tr><th>Classe di rischio (formazione)</th><td>${esc(ctx?.fatti?.classeRischio && ctx.fatti.classeRischio !== 'da_verificare' ? ctx.fatti.classeRischio : '')}</td></tr>
          <tr><th>Sede</th><td>${esc([a.sede, a.comune].filter(Boolean).join(', '))}</td></tr>
          <tr><th>Datore di lavoro</th><td>${esc(a.titolare || '')}</td></tr>
          <tr><th>RSPP</th><td>${esc(ctx?.risposte?.dl_rspp ? `${a.titolare || ''} (datore di lavoro)` : a.rspp || '')}</td></tr>
          <tr><th>Medico competente</th><td>${esc(a.medico || '')}</td></tr>
          <tr><th>RLS / RLST</th><td>${esc(a.rls || '')}</td></tr>
          <tr><th>Numero di lavoratori</th><td>${esc(String(n))}</td></tr>
        </tbody></table>

        <h2>Modulo 1.2 · Lavorazioni e mansioni</h2>
        <table class="doc__tabella"><thead><tr><th>Fasi di lavoro e luoghi</th><th>Attrezzature, materiali e prodotti</th><th>Mansioni</th></tr></thead>
          <tbody><tr><td style="height:7em"></td><td>${(attrezzature || []).map((x) => esc(x.nome + (x.tipo ? ` (${x.tipo})` : ''))).join('<br>')}</td><td>${mansioni.length ? mansioni.map(esc).join('<br>') : ''}</td></tr></tbody></table>

        <h2>Modulo 2 · Individuazione dei pericoli</h2>
        <table class="doc__tabella"><thead><tr><th>Famiglia</th><th>Pericolo</th><th>Presente</th></tr></thead><tbody>
          ${famiglie
            .map((f) =>
              pericoli
                .filter((x) => x.famiglia === f)
                .map((x, i) => `<tr>${i === 0 ? `<td rowspan="${pericoli.filter((y) => y.famiglia === f).length}">${esc(f)}</td>` : ''}<td>${esc(x.pericolo)}</td><td>${x.presente ? 'SÌ' : 'NO'}</td></tr>`)
                .join('')
            )
            .join('')}
        </tbody></table>
        <p class="doc__nota">Le risposte SÌ/NO derivano dal questionario di safetyDoc: vanno confermate con un sopralluogo.</p>

        <h2>Modulo 3 · Valutazione dei rischi, misure attuate e programma di miglioramento</h2>
        <table class="doc__tabella"><thead><tr><th>Pericolo</th><th>Misure di prevenzione e protezione (da confermare)</th><th>Misure di miglioramento</th><th>Incaricato</th><th>Entro il</th></tr></thead><tbody>
          ${presenti
            .map((x) => `<tr><td>${esc(x.pericolo)}</td><td><ul>${x.misure.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></td><td></td><td></td><td></td></tr>`)
            .join('')}
        </tbody></table>

        <p>Il presente documento è stato elaborato dal datore di lavoro in collaborazione con il RSPP e il medico competente, previa consultazione del RLS.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', ctx?.risposte?.dl_rspp ? titolare(a) : a.rspp], ['Il medico competente', a.medico], ['L\'RLS, per consultazione', a.rls])}`;
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
    titolo: 'Bozza di DUVRI (rischi da interferenze)',
    descrizione: 'Documento di valutazione dei rischi da interferenze con la ditta esterna, con i costi della sicurezza. Da completare per ogni appalto.',
    ambito: 'impresa',
    attivaSe: { all: [{ fatto: 'haDipendenti' }, { q: 'appalti_in_sede', eq: true }] },
    genera: ({ anagrafica: a, oggi, dvr, ctx }) => {
      const presenti = pericoliPresenti(dvr, ctx);
      const righe = (n) => Array.from({ length: n }, () => '<tr><td style="height:2.2em"></td><td></td><td></td><td></td></tr>').join('');
      return `${intestazione(a)}
        <h1>Documento unico di valutazione dei rischi da interferenze (DUVRI)</h1>
        <p class="doc__rif">D.Lgs. 81/2008 art. 26 c. 3 · BOZZA da completare per ogni appalto</p>
        <h2>1 · Dati dell'appalto</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Committente</th><td>${esc(a.ragioneSociale || '')} · datore di lavoro ${esc(titolare(a))}</td></tr>
          <tr><th>Luogo dei lavori</th><td>${esc([a.sede, a.comune].filter(Boolean).join(', '))}</td></tr>
          <tr><th>Ditta appaltatrice / lavoratore autonomo</th><td></td></tr>
          <tr><th>Oggetto dell'appalto</th><td></td></tr>
          <tr><th>Durata prevista (date e uomini-giorno)</th><td></td></tr>
          <tr><th>Referenti per il coordinamento</th><td></td></tr>
        </tbody></table>
        <h2>2 · Verifica dell'idoneità tecnico-professionale</h2>
        <p>☐ Visura camerale &nbsp; ☐ Autocertificazione dei requisiti &nbsp; ☐ DURC regolare &nbsp; ☐ Per lavori edili: documenti dell'Allegato XVII</p>
        <h2>3 · Rischi della sede del committente</h2>
        <ul>${presenti.map((x) => `<li>${esc(x.pericolo)}</li>`).join('') || '<li>&nbsp;</li>'}</ul>
        <h2>4 · Rischi da interferenze e misure</h2>
        <table class="doc__tabella"><thead><tr><th>Attività o fase</th><th>Interferenza (chi e cosa)</th><th>Misure per eliminarla o ridurla</th><th>A cura di</th></tr></thead><tbody>
          <tr><td>Accesso e transito di persone e mezzi</td><td>Presenza contemporanea di lavoratori, clienti e personale esterno</td><td>Orari concordati, percorsi separati, area delimitata e segnalata</td><td>Entrambi</td></tr>
          <tr><td>Uso di attrezzature e prodotti</td><td>Rumore, polveri, prodotti chimici, cavi a terra</td><td>Avviso preventivo, aerazione, nessun materiale lungo le vie di uscita</td><td>Appaltatore</td></tr>
          <tr><td>Emergenze</td><td>Personale esterno che non conosce il locale</td><td>Informazione su uscite, estintori, punto di raccolta e addetti</td><td>Committente</td></tr>
          ${righe(3)}
        </tbody></table>
        <h2>5 · Costi della sicurezza per le interferenze</h2>
        <table class="doc__tabella"><thead><tr><th>Voce (delimitazioni, segnaletica, riunioni, DPI specifici…)</th><th>Importo (€)</th></tr></thead><tbody>
          <tr><td style="height:2.2em"></td><td></td></tr><tr><td style="height:2.2em"></td><td></td></tr><tr><th>Totale (non soggetto a ribasso)</th><td></td></tr>
        </tbody></table>
        <h2>6 · Riunione di coordinamento</h2>
        <p>Data ${v('', 12)} · Presenti ${v('', 40)}</p>
        <p class="doc__nota">Il DUVRI non è richiesto per servizi intellettuali, mere forniture di materiali o attrezzature e lavori o servizi fino a 5 uomini-giorno, salvo rischi particolari (art. 26 c. 3-bis). Va allegato al contratto.</p>
        ${luogoData(a, oggi)}
        ${firme(['Il committente', titolare(a)], ['L\'appaltatore', ''])}`;
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
    titolo: 'Bozza di Piano operativo di sicurezza (POS)',
    descrizione: 'Schema con i contenuti minimi dell\'Allegato XV, già compilato con impresa, lavoratori, attrezzature e prodotti. Da completare per ogni cantiere.',
    ambito: 'impresa',
    attivaSe: { all: [{ q: 'cantiere', eq: true }, { fatto: 'haDipendenti' }] },
    genera: ({ anagrafica: a, oggi, ctx, lavoratori, attrezzature, prodotti, ruoli }) => {
      const etichetta = (r) => (ruoli && ruoli[r]) || r;
      const conRuolo = (r) => (lavoratori || []).filter((l) => (l.ruoli || []).includes(r)).map(nomeCompleto).join(', ');
      return `${intestazione(a)}
        <h1>Piano operativo di sicurezza</h1>
        <p class="doc__rif">D.Lgs. 81/2008 art. 89 c. 1 lett. h e Allegato XV punto 3.2.1 · BOZZA da completare per ogni cantiere</p>
        <h2>Cantiere</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Indirizzo del cantiere</th><td></td></tr><tr><th>Committente</th><td></td></tr>
          <tr><th>Impresa affidataria</th><td></td></tr><tr><th>Coordinatore per l'esecuzione</th><td></td></tr>
          <tr><th>Lavori affidati all'impresa</th><td></td></tr><tr><th>Inizio e durata prevista</th><td></td></tr>
        </tbody></table>
        <h2>a) Dati dell'impresa esecutrice</h2>
        <table class="doc__tabella doc__tabella--campi"><tbody>
          <tr><th>Impresa</th><td>${esc(a.ragioneSociale || '')} · ${esc([a.sede, a.comune].filter(Boolean).join(', '))} · P.IVA ${esc(a.piva || '')}</td></tr>
          <tr><th>Datore di lavoro</th><td>${esc(titolare(a))}</td></tr>
          <tr><th>RSPP</th><td>${esc(ctx?.risposte?.dl_rspp ? `${titolare(a)} (datore di lavoro)` : a.rspp || '')}</td></tr>
          <tr><th>Medico competente</th><td>${esc(a.medico || '')}</td></tr>
          <tr><th>RLS / RLST</th><td>${esc(a.rls || '')}</td></tr>
          <tr><th>Preposto / capocantiere</th><td>${esc(conRuolo('preposto'))}</td></tr>
          <tr><th>Addetti al primo soccorso</th><td>${esc(conRuolo('primo_soccorso'))}</td></tr>
          <tr><th>Addetti antincendio ed emergenze</th><td>${esc(conRuolo('antincendio'))}</td></tr>
        </tbody></table>
        <h2>b) Lavoratori presenti in cantiere e incarichi</h2>
        <table class="doc__tabella"><thead><tr><th>Lavoratore</th><th>Mansione</th><th>Incarichi per la sicurezza</th><th>In cantiere</th></tr></thead><tbody>
          ${(lavoratori || [])
            .map((l) => `<tr><td>${esc(nomeCompleto(l))}</td><td>${esc(l.mansione || '')}</td><td>${esc((l.ruoli || []).map(etichetta).join(', '))}</td><td>☐</td></tr>`)
            .join('')}
        </tbody></table>
        <h2>c) Attività di cantiere, organizzazione e turni</h2>
        <p style="min-height:5em">&nbsp;</p>
        <h2>d) Opere provvisionali, macchine e impianti</h2>
        <ul>${(attrezzature || []).map((x) => `<li>${esc(x.nome)}${x.tipo ? ` (${esc(x.tipo)})` : ''} ☐</li>`).join('') || '<li>&nbsp;</li>'}</ul>
        <h2>e) Sostanze e miscele pericolose (con schede di sicurezza)</h2>
        <ul>${(prodotti || []).map((p) => `<li>${esc(p.nome)}${p.pittogrammi?.length ? ` · ${esc(p.pittogrammi.join(', '))}` : ''} ☐</li>`).join('') || '<li>&nbsp;</li>'}</ul>
        <h2>f) Esito della valutazione del rumore</h2>
        <p>Livello di esposizione per mansione: ${v('', 40)}</p>
        <h2>g) Misure di prevenzione integrative rispetto al PSC</h2>
        <p style="min-height:4em">&nbsp;</p>
        <h2>h) Procedure richieste dal PSC</h2>
        <p style="min-height:3em">&nbsp;</p>
        <h2>i) DPI forniti ai lavoratori</h2>
        <p>☐ Elmetto &nbsp; ☐ Scarpe antinfortunistiche &nbsp; ☐ Guanti &nbsp; ☐ Occhiali &nbsp; ☐ Otoprotettori &nbsp; ☐ Mascherine &nbsp; ☐ Imbracatura anticaduta &nbsp; ☐ Indumenti alta visibilità</p>
        <h2>l) Informazione e formazione dei lavoratori</h2>
        <p>Gli attestati di formazione generale, specifica e per gli incarichi sono allegati. Registro: vedi «Registro della formazione».</p>
        ${luogoData(a, oggi)}
        ${firme(['Il datore di lavoro', titolare(a)], ['Per presa visione, l\'RLS', a.rls])}`;
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
