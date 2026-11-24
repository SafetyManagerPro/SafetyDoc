import {
  schermate,
  generaPiano,
  cosaFareAdesso,
  conteggi,
  creaContesto,
  periodicitaPer,
  lavoratoriAttivi,
  situazioneLavoratore,
  urgenzeLavoratori,
  ruoliDisponibili,
  nomeCompleto,
  storicoRegistri,
  ESITI_VISITA
} from './engine.js';
import { unisciCollezione, creaExport, validaExport, FORMATO_CIFRATO, COLLEZIONI } from './merge.js';
import { cifra, decifra } from './cifratura.js';
import { modelliDisponibili, modelloPerLavoratore, generaDocumento, MODELLI } from './modelli.js';
import * as store from './store.js';

export const VERSIONE_APP = '0.4.0';
const GIORNI_PROMEMORIA_BACKUP = 7;

// Documenti utili da mostrare in fondo a ogni scheda.
const SCHEDA_MODELLI = {
  rspp: ['dichiarazione-dl-rspp', 'nomina-rspp-esterno'],
  'formazione-dl-rspp': ['dichiarazione-dl-rspp'],
  'medico-competente': ['nomina-medico'],
  preposto: ['nomina-preposto'],
  'primo-soccorso': ['designazione-addetti'],
  antincendio: ['designazione-addetti'],
  dpi: ['consegna-dpi'],
  'formazione-lavoratori': ['registro-formazione'],
  'privacy-lavoratori': ['informativa-lavoratori', 'autorizzazione-trattamento'],
  privacy: ['informativa-clienti', 'nomina-responsabile-esterno'],
  'piano-emergenza': ['verbale-evacuazione'],
  'presidi-antincendio': ['registro-antincendio'],
  'riunione-periodica': ['verbale-riunione']
};

// Schede che si gestiscono lavoratore per lavoratore.
const SCHEDE_PER_LAVORATORE = new Set(['formazione-lavoratori', 'medico-competente', 'dpi', 'preposto', 'primo-soccorso', 'antincendio', 'privacy-lavoratori', 'attrezzature-abilitazione']);

const CAMPI_ANAGRAFICA = [
  ['ragioneSociale', 'Nome dell\'impresa (ragione sociale)', 'organization'],
  ['titolare', 'Titolare o legale rappresentante (datore di lavoro)', 'name'],
  ['sede', 'Indirizzo della sede', 'street-address'],
  ['comune', 'Comune', 'address-level2'],
  ['piva', 'Partita IVA o codice fiscale', 'off'],
  ['contatto', 'Email o telefono per la privacy', 'email'],
  ['rspp', 'RSPP (se non sei tu)', 'off'],
  ['medico', 'Medico competente', 'off'],
  ['rls', 'RLS o RLST', 'off']
];

const stato = { questionario: null, catalogo: null, defLav: null, profilo: null, adempimenti: [], lavoratori: [], registri: [] };
const app = document.getElementById('app');

// ---------- utilità ----------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const oggiIso = () => new Date().toISOString().slice(0, 10);

function dataLeggibile(iso) {
  if (!iso) return '';
  const [a, m, g] = iso.slice(0, 10).split('-');
  return `${g}/${m}/${a}`;
}

const ETICHETTE = {
  rosso: { titolo: 'Da fare subito', breve: 'Da fare', icona: '!' },
  giallo: { titolo: 'In scadenza', breve: 'In scadenza', icona: '◷' },
  verde: { titolo: 'In regola', breve: 'In regola', icona: '✓' },
  info: { titolo: 'Da sapere: quando capita', breve: 'Quando capita', icona: 'i' }
};

function avviso(testo) {
  const el = document.getElementById('avviso');
  el.textContent = testo;
  el.hidden = false;
  clearTimeout(avviso.t);
  avviso.t = setTimeout(() => (el.hidden = true), 4000);
}

async function ricarica() {
  stato.profilo = await store.leggiProfilo();
  stato.adempimenti = await store.tutti('adempimenti');
  stato.lavoratori = await store.tutti('lavoratori');
  stato.registri = await store.tutti('registri');
}

const risposte = () => stato.profilo?.risposte || {};
const questionarioCompletato = () => Boolean(risposte().__completato);
const ctx = () => creaContesto(risposte(), stato.questionario);
const haDipendenti = () => ctx().fatti.haDipendenti;

function anagrafica() {
  const a = { ...(stato.profilo?.anagrafica || {}) };
  if (!a.ragioneSociale && risposte().nome_impresa) a.ragioneSociale = risposte().nome_impresa;
  return a;
}

const attivi = () => lavoratoriAttivi(stato.lavoratori, oggiIso());

function situazione(l) {
  return situazioneLavoratore({ lavoratore: l, defLavoratori: stato.defLav, registri: stato.registri, ctx: ctx(), oggi: oggiIso() });
}

function piano() {
  return generaPiano({
    catalogo: stato.catalogo,
    questionario: stato.questionario,
    risposte: risposte(),
    adempimenti: stato.adempimenti,
    oggi: oggiIso()
  });
}

const SEZIONE = { scheda: 'piano', lavoratore: 'lavoratori', 'lavoratore-modifica': 'lavoratori', registro: 'lavoratori', documento: 'documenti' };

function aggiornaNav(rotta) {
  const sezione = SEZIONE[rotta] ?? rotta;
  for (const a of document.querySelectorAll('.nav a')) {
    a.setAttribute('aria-current', a.dataset.rotta === sezione ? 'page' : 'false');
  }
  document.querySelector('.nav').hidden = !questionarioCompletato();
  const linkLav = document.querySelector('.nav a[data-rotta="lavoratori"]');
  if (linkLav) linkLav.hidden = !haDipendenti();
}

// ---------- schermate ----------

async function bannerBackup() {
  if (!stato.adempimenti.length) return '';
  const ultimo = await store.leggiMeta('ultimoExport');
  const giorni = ultimo ? Math.floor((Date.now() - Date.parse(ultimo)) / 86400000) : null;
  if (giorni !== null && giorni < GIORNI_PROMEMORIA_BACKUP) return '';
  const testo = giorni === null ? 'Non hai ancora salvato una copia dei tuoi dati.' : `L'ultima copia dei dati è di ${giorni} giorni fa.`;
  return `<a class="banner" href="#/dati"><strong>${testo}</strong><span>I dati sono solo su questo dispositivo. Tocca qui per salvarne una copia.</span></a>`;
}

function cardVoce(v) {
  const e = ETICHETTE[v.colore];
  const scad = v.prossimaScadenza ? ` · scade il ${dataLeggibile(v.prossimaScadenza)}` : '';
  return `
    <a class="voce voce--${v.colore}" href="#/scheda/${esc(v.scheda.id)}">
      <span class="voce__segno" aria-hidden="true">${e.icona}</span>
      <span class="voce__testo">
        <span class="voce__titolo">${esc(v.scheda.titolo)}</span>
        <span class="voce__stato">${esc(v.motivo)}${esc(scad)}</span>
      </span>
      <span class="voce__freccia" aria-hidden="true">›</span>
    </a>`;
}

async function schermataBenvenuto() {
  app.innerHTML = `
    <section class="pagina benvenuto">
      <p class="sopratitolo">safetyDoc</p>
      <h1>La sicurezza della tua impresa, passo per passo.</h1>
      <p class="lead">Rispondi a qualche domanda semplice sulla tua impresa. Ti diremo cosa devi fare, come farlo ed entro quando.</p>
      <ul class="punti">
        <li>Ci vogliono pochi minuti.</li>
        <li>I dati restano su questo dispositivo.</li>
        <li>Puoi cambiare le risposte quando vuoi.</li>
      </ul>
      <a class="btn btn--primario btn--grande" href="#/domanda/0">Inizia</a>
      <p class="nota">Versione di prova ${VERSIONE_APP}. I contenuti sono in fase di verifica: in caso di dubbio chiedi a un esperto.</p>
    </section>`;
}

async function schermataOggi() {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const p = piano();
  const c = conteggi(p);
  const urgenti = cosaFareAdesso(p);
  const nome = risposte().nome_impresa;

  app.innerHTML = `
    <section class="pagina">
      ${await bannerBackup()}
      <p class="sopratitolo">${esc(nome || 'La tua impresa')}</p>
      <h1>${urgenti.length ? 'Cosa fare adesso' : 'Sei in regola'}</h1>
      <div class="contatori" role="list">
        <a role="listitem" class="contatore contatore--rosso" href="#/piano"><strong>${c.rosso}</strong><span>da fare</span></a>
        <a role="listitem" class="contatore contatore--giallo" href="#/piano"><strong>${c.giallo}</strong><span>in scadenza</span></a>
        <a role="listitem" class="contatore contatore--verde" href="#/piano"><strong>${c.verde}</strong><span>in regola</span></a>
      </div>
      ${
        urgenti.length
          ? `${
              c.verde === 0 && c.giallo === 0
                ? `<p class="lead">Molte di queste cose probabilmente le hai già fatte. Aprile una alla volta e premi <strong>Fatto</strong>: il semaforo diventerà verde.</p>`
                : ''
            }
             <div class="lista">${urgenti.map(cardVoce).join('')}</div>
             <p class="nota">Ti mostriamo al massimo tre cose alla volta, partendo dalle più importanti. Le altre sono nel piano completo.</p>`
          : `<p class="lead">Non ci sono scadenze nei prossimi 60 giorni. Torna a controllare ogni tanto.</p>`
      }
      <a class="btn btn--secondario" href="#/piano">Vedi il piano completo</a>
      ${haDipendenti() ? bloccoLavoratoriOggi() : ''}
    </section>`;
}

function bloccoLavoratoriOggi() {
  const lav = attivi();
  if (!lav.length) {
    return `<h2>I tuoi lavoratori</h2>
      <p>Inserisci i tuoi lavoratori: ti ricorderemo corsi, visite mediche e DPI di ognuno.</p>
      <a class="btn btn--primario" href="#/lavoratore-modifica/nuovo">Aggiungi un lavoratore</a>`;
  }
  const urg = urgenzeLavoratori({ lavoratori: stato.lavoratori, defLavoratori: stato.defLav, registri: stato.registri, ctx: ctx(), oggi: oggiIso() });
  const persone = new Set(urg.map((u) => u.lavoratore.id)).size;
  return `<h2>I tuoi lavoratori</h2>
    <p>${urg.length ? `${persone} ${persone === 1 ? 'lavoratore ha' : 'lavoratori hanno'} cose da fare o in scadenza.` : `Tutti i ${lav.length} lavoratori sono in regola.`}</p>
    ${urg.length ? `<div class="lista">${urg.slice(0, 3).map(cardUrgenzaLavoratore).join('')}</div>` : ''}
    <a class="btn btn--secondario" href="#/lavoratori">Vedi tutti i lavoratori</a>`;
}

function cardUrgenzaLavoratore(u) {
  const e = ETICHETTE[u.colore];
  const scad = u.prossimaScadenza ? ` · ${dataLeggibile(u.prossimaScadenza)}` : '';
  return `<a class="voce voce--${u.colore}" href="#/registro/${esc(u.lavoratore.id)}/${esc(u.requisito.id)}">
      <span class="voce__segno" aria-hidden="true">${e.icona}</span>
      <span class="voce__testo">
        <span class="voce__titolo">${esc(nomeCompleto(u.lavoratore))}: ${esc(u.requisito.titolo)}</span>
        <span class="voce__stato">${esc(u.motivo)}${esc(scad)}</span>
      </span>
      <span class="voce__freccia" aria-hidden="true">›</span>
    </a>`;
}

async function schermataPiano() {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const p = piano();
  const gruppi = ['rosso', 'giallo', 'verde', 'info']
    .map((col) => ({ col, voci: p.filter((v) => v.colore === col) }))
    .filter((g) => g.voci.length);

  app.innerHTML = `
    <section class="pagina">
      <h1>Il tuo piano sicurezza</h1>
      <p class="lead">${p.length} cose che riguardano la tua impresa, in ordine di urgenza.</p>
      ${gruppi
        .map(
          (g) => `
        <h2 class="gruppo gruppo--${g.col}">${ETICHETTE[g.col].titolo} <span>${g.voci.length}</span></h2>
        <div class="lista">${g.voci.map(cardVoce).join('')}</div>`
        )
        .join('')}
      <a class="btn btn--secondario" href="#/domanda/0">Cambia le risposte</a>
    </section>`;
}

async function schermataDomanda(indice) {
  const elenco = schermate(stato.questionario, risposte());
  const i = Math.max(0, Math.min(Number(indice) || 0, elenco.length - 1));
  const sch = elenco[i];
  const r = risposte();
  const percento = Math.round((i / elenco.length) * 100);
  const gruppo = Boolean(sch.gruppo);
  const d = sch.domande[0];
  const valore = r[d.id];

  let titolo = esc(d.testo);
  let aiuto = d.aiuto;
  let campo = '';
  let conAvanti = false;

  if (gruppo) {
    titolo = esc(sch.titolo || 'Segna quello che vale per te');
    aiuto = sch.aiuto;
    conAvanti = true;
    campo = `<div class="spunte" role="group" aria-label="${titolo}">
      ${sch.domande
        .map(
          (x) => `<button type="button" class="spunta ${r[x.id] === true ? 'spunta--attiva' : ''}" data-id="${esc(x.id)}" aria-pressed="${r[x.id] === true}">
            <span class="spunta__box" aria-hidden="true"></span>
            <span class="spunta__testo">${esc(x.breve || x.testo)}${x.aiuto ? `<small>${esc(x.aiuto)}</small>` : ''}</span>
          </button>`
        )
        .join('')}
    </div>`;
  } else if (d.tipo === 'sino') {
    campo = `<div class="scelte scelte--due">
      ${[
        [true, 'Sì'],
        [false, 'No']
      ]
        .map(
          ([v, et]) =>
            `<button type="button" class="scelta ${valore === v ? 'scelta--attiva' : ''}" data-valore='${JSON.stringify(v)}' aria-pressed="${valore === v}">${et}</button>`
        )
        .join('')}
    </div>`;
  } else if (d.tipo === 'scelta') {
    campo = `<div class="scelte">
      ${d.opzioni
        .map(
          (o) =>
            `<button type="button" class="scelta ${valore === o.valore ? 'scelta--attiva' : ''}" data-valore='${esc(JSON.stringify(o.valore))}' aria-pressed="${valore === o.valore}">${esc(o.etichetta)}</button>`
        )
        .join('')}
    </div>`;
  } else {
    conAvanti = true;
    campo =
      d.tipo === 'numero'
        ? `<input class="campo" id="campo" type="number" inputmode="numeric" min="${d.minimo ?? 0}" value="${esc(valore ?? '')}" aria-label="${esc(d.testo)}">`
        : `<input class="campo" id="campo" type="text" autocomplete="organization" value="${esc(valore ?? '')}" aria-label="${esc(d.testo)}">`;
  }

  app.innerHTML = `
    <section class="pagina domanda">
      <div class="progresso" role="progressbar" aria-valuemin="0" aria-valuemax="${elenco.length}" aria-valuenow="${i + 1}" aria-label="Passo ${i + 1} di ${elenco.length}">
        <div style="width:${percento}%"></div>
      </div>
      <p class="sopratitolo">Passo ${i + 1} di ${elenco.length}</p>
      <h1>${titolo}</h1>
      ${aiuto ? `<p class="aiuto">${esc(aiuto)}</p>` : ''}
      ${campo}
      <div class="azioni">
        ${i > 0 ? `<a class="btn btn--secondario" href="#/domanda/${i - 1}">Indietro</a>` : '<span></span>'}
        ${conAvanti ? `<button class="btn btn--primario" id="avanti">Avanti</button>` : ''}
      </div>
    </section>`;

  const vai = async (aggiornamenti) => {
    const nuove = { ...risposte(), ...aggiornamenti };
    const dopo = schermate(stato.questionario, nuove);
    const posizione = dopo.findIndex((s) => s.domande.some((x) => x.id === d.id));
    const ultima = posizione === dopo.length - 1;
    if (ultima) nuove.__completato = true;
    await store.salvaRisposte(nuove);
    await ricarica();
    location.hash = ultima ? '#/' : `#/domanda/${posizione + 1}`;
  };

  if (gruppo) {
    for (const b of app.querySelectorAll('.spunta')) {
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('spunta--attiva', on);
      });
    }
    app.querySelector('#avanti').addEventListener('click', () => {
      const agg = {};
      for (const b of app.querySelectorAll('.spunta')) agg[b.dataset.id] = b.getAttribute('aria-pressed') === 'true';
      vai(agg);
    });
    return;
  }

  for (const b of app.querySelectorAll('.scelta')) {
    b.addEventListener('click', () => vai({ [d.id]: JSON.parse(b.dataset.valore) }));
  }
  const input = app.querySelector('#campo');
  if (input) {
    input.focus();
    const conferma = () => {
      let v = input.value.trim();
      if (d.tipo === 'numero') {
        v = Number(v);
        if (!v || v < (d.minimo ?? 0)) return avviso('Inserisci un numero valido.');
      }
      vai({ [d.id]: v });
    };
    app.querySelector('#avanti').addEventListener('click', conferma);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && conferma());
  }
}

async function schermataScheda(id) {
  const scheda = stato.catalogo.schede.find((s) => s.id === id);
  if (!scheda) return (location.hash = '#/piano');
  const voce = piano().find((v) => v.scheda.id === id);
  const st = voce?.stato;
  const ctx = creaContesto(risposte(), stato.questionario);
  const mesi = periodicitaPer(scheda, ctx);
  const chiedeScadenza = scheda.tipoScadenza === 'manuale' || scheda.tipoScadenza === 'periodica';
  const e = voce ? ETICHETTE[voce.colore] : null;

  app.innerHTML = `
    <section class="pagina scheda">
      <a class="indietro" href="#/piano">‹ Piano</a>
      ${voce ? `<p class="pill pill--${voce.colore}"><span aria-hidden="true">${e.icona}</span> ${esc(voce.motivo)}${voce.prossimaScadenza ? ` · ${dataLeggibile(voce.prossimaScadenza)}` : ''}</p>` : ''}
      <h1>${esc(scheda.titolo)}</h1>
      <p class="lead">${esc(scheda.cosaE)}</p>

      <h2>Perché devi farlo</h2>
      <p>${esc(scheda.perche)}</p>

      <h2>Come si fa</h2>
      <ol class="passi">${scheda.come.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>

      <dl class="dettagli">
        <div><dt>Chi lo fa</dt><dd>${esc(scheda.chi)}</dd></div>
        <div><dt>Quando</dt><dd>${esc(scheda.quando)}</dd></div>
        ${scheda.notaScadenza ? `<div><dt>Nota</dt><dd>${esc(scheda.notaScadenza)}</dd></div>` : ''}
      </dl>
      <p class="riferimento">Riferimento: ${esc(scheda.riferimento)}</p>
      ${scheda.daVerificare?.length ? `<p class="verifica">In verifica: ${esc(scheda.daVerificare.join(' '))}</p>` : ''}
      ${collegamentiScheda(id)}

      ${
        scheda.tipoScadenza === 'evento'
          ? ''
          : `
      <form class="registra" id="registra">
        <h2>${st?.fatto ? 'Aggiorna' : 'Segna come fatto'}</h2>
        <label>Data in cui l'hai fatto
          <input class="campo" type="date" name="dataFatto" required max="${oggiIso()}" value="${esc(st?.dataFatto || oggiIso())}">
        </label>
        ${
          chiedeScadenza
            ? `<label>Prossima scadenza ${mesi ? `<small>(se la lasci vuota la calcoliamo: ogni ${mesi} mesi)</small>` : '<small>(scrivila se la conosci, per esempio dall\'attestato o dal medico)</small>'}
          <input class="campo" type="date" name="scadenzaManuale" value="${esc(st?.scadenzaManuale || '')}">
        </label>`
            : ''
        }
        <label>Note <small>(facoltative: chi l'ha fatto, dove trovi il documento)</small>
          <textarea class="campo" name="note" rows="3">${esc(st?.note || '')}</textarea>
        </label>
        <button class="btn btn--primario btn--grande" type="submit">Fatto</button>
        ${st?.fatto ? `<button class="btn btn--testo" type="button" id="annulla">Segna di nuovo come da fare</button>` : ''}
      </form>`
      }
    </section>`;

  const form = app.querySelector('#registra');
  if (!form) return;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    await store.salvaAdempimento({
      ...(st || {}),
      schedaId: id,
      fatto: true,
      dataFatto: f.get('dataFatto'),
      scadenzaManuale: f.get('scadenzaManuale') || null,
      note: f.get('note') || ''
    });
    await ricarica();
    avviso('Salvato.');
    schermataScheda(id);
  });
  app.querySelector('#annulla')?.addEventListener('click', async () => {
    await store.salvaAdempimento({ ...st, fatto: false });
    await ricarica();
    avviso('Segnato come da fare.');
    schermataScheda(id);
  });
}

// ---------- collegamenti dalle schede ----------

function collegamentiScheda(id) {
  const parti = [];
  if (SCHEDE_PER_LAVORATORE.has(id) && haDipendenti()) {
    parti.push(`<a class="btn btn--secondario" href="#/lavoratori">Segui questa voce per ogni lavoratore</a>`);
  }
  const disponibili = new Set(modelliDisponibili(ctx()).map((m) => m.id));
  const modelli = (SCHEDA_MODELLI[id] || []).map((m) => MODELLI.find((x) => x.id === m)).filter((m) => m && disponibili.has(m.id));
  if (modelli.length) {
    parti.push(`<h2>Documenti pronti</h2><div class="lista">${modelli
      .map((m) => cardDocumento(m, m.ambito === 'lavoratore' ? '#/documenti' : `#/documento/${m.id}`))
      .join('')}</div>`);
  }
  return parti.join('');
}

function cardDocumento(m, href) {
  return `<a class="voce voce--doc" href="${href}">
      <span class="voce__segno" aria-hidden="true">▤</span>
      <span class="voce__testo"><span class="voce__titolo">${esc(m.titolo)}</span><span class="voce__stato">${esc(m.descrizione)}</span></span>
      <span class="voce__freccia" aria-hidden="true">›</span>
    </a>`;
}

// ---------- lavoratori ----------

async function schermataLavoratori() {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const lav = attivi();
  const sit = lav.map(situazione);
  const ordine = { rosso: 0, giallo: 1, verde: 2 };
  sit.sort((a, b) => ordine[a.colore] - ordine[b.colore] || nomeCompleto(a.lavoratore).localeCompare(nomeCompleto(b.lavoratore), 'it'));
  const cessati = (stato.lavoratori || []).filter((l) => !l.deleted && l.dataCessazione && l.dataCessazione <= oggiIso());

  app.innerHTML = `
    <section class="pagina">
      <h1>I tuoi lavoratori</h1>
      <p class="lead">Per ogni lavoratore segui corsi, visite mediche, DPI e privacy. Il semaforo ti dice chi ha qualcosa da fare.</p>
      ${
        sit.length
          ? `<div class="lista">${sit
              .map((s) => {
                const e = ETICHETTE[s.colore];
                const testo = s.colore === 'verde' ? 'Tutto in regola' : [s.conteggi.rosso ? `${s.conteggi.rosso} da fare` : '', s.conteggi.giallo ? `${s.conteggi.giallo} in scadenza` : ''].filter(Boolean).join(' · ');
                return `<a class="voce voce--${s.colore}" href="#/lavoratore/${esc(s.lavoratore.id)}">
                  <span class="voce__segno" aria-hidden="true">${e.icona}</span>
                  <span class="voce__testo"><span class="voce__titolo">${esc(nomeCompleto(s.lavoratore))}</span>
                  <span class="voce__stato">${esc(s.lavoratore.mansione || 'Mansione non indicata')} · ${esc(testo)}</span></span>
                  <span class="voce__freccia" aria-hidden="true">›</span></a>`;
              })
              .join('')}</div>`
          : `<p>Non hai ancora inserito nessun lavoratore.</p>`
      }
      <a class="btn btn--primario btn--grande" href="#/lavoratore-modifica/nuovo">Aggiungi un lavoratore</a>
      ${sit.length ? `<a class="btn btn--secondario" href="#/documento/registro-formazione">Stampa il registro di formazione e scadenze</a>` : ''}
      ${cessati.length ? `<p class="nota">${cessati.length} ${cessati.length === 1 ? 'lavoratore cessato non è mostrato' : 'lavoratori cessati non sono mostrati'}, ma i suoi dati restano salvati.</p>` : ''}
    </section>`;
}

async function schermataLavoratore(id) {
  const l = stato.lavoratori.find((x) => x.id === id && !x.deleted);
  if (!l) return (location.hash = '#/lavoratori');
  const s = situazione(l);
  const ruoli = new Map(stato.defLav.ruoli.map((r) => [r.id, r.etichetta]));
  const docs = modelliDisponibili(ctx()).filter((m) => m.ambito === 'lavoratore' && modelloPerLavoratore(m, l));

  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="#/lavoratori">‹ Lavoratori</a>
      <h1>${esc(nomeCompleto(l))}</h1>
      <p class="lead">${esc(l.mansione || 'Mansione non indicata')}${l.dataAssunzione ? ` · assunto il ${dataLeggibile(l.dataAssunzione)}` : ''}</p>
      ${(l.ruoli || []).length ? `<p>${(l.ruoli || []).map((r) => `<span class="pill pill--info">${esc(ruoli.get(r) || r)}</span>`).join(' ')}</p>` : ''}
      <h2>Cosa serve</h2>
      <div class="lista">${s.voci
        .map((v) => {
          const e = ETICHETTE[v.colore];
          const det = [
            v.registro ? `fatto il ${dataLeggibile(v.registro.data)}` : '',
            v.prossimaScadenza ? `scade il ${dataLeggibile(v.prossimaScadenza)}` : '',
            v.registro?.esito ? ESITI_VISITA[v.registro.esito] : ''
          ].filter(Boolean).join(' · ');
          return `<a class="voce voce--${v.colore}" href="#/registro/${esc(l.id)}/${esc(v.requisito.id)}">
            <span class="voce__segno" aria-hidden="true">${e.icona}</span>
            <span class="voce__testo"><span class="voce__titolo">${esc(v.requisito.titolo)}</span>
            <span class="voce__stato">${esc(v.motivo)}${det ? ` · ${esc(det)}` : ''}</span></span>
            <span class="voce__freccia" aria-hidden="true">›</span></a>`;
        })
        .join('')}</div>
      ${docs.length ? `<h2>Documenti per ${esc(l.nome || 'questo lavoratore')}</h2><div class="lista">${docs.map((m) => cardDocumento(m, `#/documento/${m.id}/${l.id}`)).join('')}</div>` : ''}
      <a class="btn btn--secondario" href="#/lavoratore-modifica/${esc(l.id)}">Modifica i dati o i ruoli</a>
    </section>`;
}

async function schermataModificaLavoratore(id) {
  const nuovo = id === 'nuovo';
  const l = nuovo ? { ruoli: [] } : stato.lavoratori.find((x) => x.id === id && !x.deleted);
  if (!l) return (location.hash = '#/lavoratori');
  const ruoli = ruoliDisponibili(stato.defLav, ctx());
  const ha = new Set(l.ruoli || []);

  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="${nuovo ? '#/lavoratori' : `#/lavoratore/${esc(l.id)}`}">‹ Indietro</a>
      <h1>${nuovo ? 'Nuovo lavoratore' : `Modifica ${esc(nomeCompleto(l))}`}</h1>
      <form id="lavoratore">
        <label>Nome<input class="campo" name="nome" required autocomplete="off" value="${esc(l.nome || '')}"></label>
        <label>Cognome<input class="campo" name="cognome" autocomplete="off" value="${esc(l.cognome || '')}"></label>
        <label>Mansione <small>(cosa fa: es. muratore, magazziniera, apprendista elettricista)</small>
          <input class="campo" name="mansione" value="${esc(l.mansione || '')}"></label>
        <label>Data di assunzione<input class="campo" type="date" name="dataAssunzione" value="${esc(l.dataAssunzione || '')}"></label>
        <h2>Ruoli e lavori particolari</h2>
        <p class="aiuto">Tocca quelli che riguardano questa persona: aggiungono i corsi che le servono.</p>
        <div class="spunte">${ruoli
          .map(
            (r) => `<button type="button" class="spunta ${ha.has(r.id) ? 'spunta--attiva' : ''}" data-id="${esc(r.id)}" aria-pressed="${ha.has(r.id)}">
              <span class="spunta__box" aria-hidden="true"></span><span class="spunta__testo">${esc(r.etichetta)}</span></button>`
          )
          .join('')}</div>
        ${nuovo ? '' : `<label>Data di fine rapporto <small>(solo se non lavora più con te)</small><input class="campo" type="date" name="dataCessazione" value="${esc(l.dataCessazione || '')}"></label>`}
        <p class="nota">Non scrivere qui malattie, diagnosi o altri dati sulla salute.</p>
        <button class="btn btn--primario btn--grande" type="submit">Salva</button>
        ${nuovo ? '' : `<button class="btn btn--testo" type="button" id="elimina">Elimina questo lavoratore</button>`}
      </form>
    </section>`;

  for (const b of app.querySelectorAll('.spunta')) {
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('spunta--attiva', on);
    });
  }
  app.querySelector('#lavoratore').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const scelti = [...app.querySelectorAll('.spunta[aria-pressed="true"]')].map((b) => b.dataset.id);
    // i ruoli non mostrati (lavorazione tolta dal questionario) restano salvati
    const nascosti = (l.ruoli || []).filter((r) => !ruoli.some((x) => x.id === r));
    const salvato = await store.salva('lavoratori', {
      ...l,
      nome: String(f.get('nome') || '').trim(),
      cognome: String(f.get('cognome') || '').trim(),
      mansione: String(f.get('mansione') || '').trim(),
      dataAssunzione: f.get('dataAssunzione') || null,
      dataCessazione: f.get('dataCessazione') || null,
      ruoli: [...scelti, ...nascosti]
    });
    await ricarica();
    avviso('Lavoratore salvato.');
    location.hash = `#/lavoratore/${salvato.id}`;
  });
  app.querySelector('#elimina')?.addEventListener('click', async () => {
    if (!confirm(`Eliminare ${nomeCompleto(l)}? Se ha solo smesso di lavorare con te, è meglio indicare la data di fine rapporto.`)) return;
    await store.elimina('lavoratori', l);
    await ricarica();
    avviso('Lavoratore eliminato.');
    location.hash = '#/lavoratori';
  });
}

async function schermataRegistro(lavId, reqId) {
  const l = stato.lavoratori.find((x) => x.id === lavId && !x.deleted);
  const req = stato.defLav.requisiti.find((r) => r.id === reqId);
  if (!l || !req) return (location.hash = '#/lavoratori');
  const voce = situazione(l).voci.find((v) => v.requisito.id === reqId);
  const storico = storicoRegistri(l.id, req.id, stato.registri);
  const chiedeScadenza = req.tipoScadenza === 'manuale' || req.tipoScadenza === 'periodica';
  const e = voce ? ETICHETTE[voce.colore] : null;
  const scheda = stato.catalogo.schede.find((s) => s.id === req.schedaId);

  app.innerHTML = `
    <section class="pagina scheda">
      <a class="indietro" href="#/lavoratore/${esc(l.id)}">‹ ${esc(nomeCompleto(l))}</a>
      ${voce ? `<p class="pill pill--${voce.colore}"><span aria-hidden="true">${e.icona}</span> ${esc(voce.motivo)}${voce.prossimaScadenza ? ` · ${dataLeggibile(voce.prossimaScadenza)}` : ''}</p>` : ''}
      <h1>${esc(req.titolo)}</h1>
      ${req.aiuto ? `<p class="lead">${esc(req.aiuto)}</p>` : ''}
      ${scheda ? `<p><a href="#/scheda/${esc(scheda.id)}">Come si fa: ${esc(scheda.titolo)} ›</a></p>` : ''}
      <form class="registra" id="registra">
        <h2>Registra</h2>
        <label>Data<input class="campo" type="date" name="data" required max="${oggiIso()}" value="${oggiIso()}"></label>
        ${
          chiedeScadenza
            ? `<label>Prossima scadenza ${req.periodicitaMesi ? `<small>(se la lasci vuota la calcoliamo: ogni ${req.periodicitaMesi} mesi)</small>` : '<small>(scrivila dall\'attestato o da quanto indicato dal medico)</small>'}
          <input class="campo" type="date" name="scadenzaManuale"></label>`
            : ''
        }
        ${
          req.conEsito
            ? `<label>Giudizio del medico<select class="campo" name="esito"><option value="">—</option>${Object.entries(ESITI_VISITA)
                .map(([k, t]) => `<option value="${k}">${esc(t)}</option>`)
                .join('')}</select></label>
               <p class="nota">Scrivi solo il giudizio. Le prescrizioni da rispettare puoi annotarle nelle note, senza diagnosi.</p>`
            : ''
        }
        ${req.conDettagli ? `<label>${esc(req.conDettagli)}<textarea class="campo" name="dettagli" rows="3"></textarea></label>` : ''}
        <label>Note <small>(ente del corso, numero attestato, dove trovi il documento)</small><textarea class="campo" name="note" rows="2"></textarea></label>
        <button class="btn btn--primario btn--grande" type="submit">Salva</button>
      </form>
      ${
        storico.length
          ? `<h2>Storico</h2><ul class="storico">${storico
              .map(
                (r) => `<li><strong>${dataLeggibile(r.data)}</strong>${r.scadenzaManuale ? ` · scadenza ${dataLeggibile(r.scadenzaManuale)}` : ''}${
                  r.esito ? ` · ${esc(ESITI_VISITA[r.esito])}` : ''
                }${r.dettagli ? `<br>${esc(r.dettagli)}` : ''}${r.note ? `<br><small>${esc(r.note)}</small>` : ''}
                ${req.modello ? `<br><a href="#/documento/${esc(req.modello)}/${esc(l.id)}">Stampa il documento</a>` : ''}
                <button class="btn btn--testo btn--piccolo" data-elimina="${esc(r.id)}" type="button">Elimina</button></li>`
              )
              .join('')}</ul>`
          : ''
      }
    </section>`;

  app.querySelector('#registra').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    await store.salva('registri', {
      lavoratoreId: l.id,
      requisitoId: req.id,
      data: f.get('data'),
      scadenzaManuale: f.get('scadenzaManuale') || null,
      esito: f.get('esito') || null,
      dettagli: String(f.get('dettagli') || '').trim(),
      note: String(f.get('note') || '').trim()
    });
    await ricarica();
    avviso('Salvato.');
    schermataRegistro(lavId, reqId);
  });
  for (const b of app.querySelectorAll('[data-elimina]')) {
    b.addEventListener('click', async () => {
      if (!confirm('Eliminare questa registrazione?')) return;
      await store.elimina('registri', storico.find((r) => r.id === b.dataset.elimina));
      await ricarica();
      schermataRegistro(lavId, reqId);
    });
  }
}

// ---------- documenti ----------

async function schermataDocumenti() {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const disp = modelliDisponibili(ctx());
  const impresa = disp.filter((m) => m.ambito === 'impresa');
  const perLav = disp.filter((m) => m.ambito === 'lavoratore');
  const lav = attivi();
  const a = anagrafica();
  const mancano = !a.titolare || !a.sede;

  app.innerHTML = `
    <section class="pagina">
      <h1>Documenti pronti</h1>
      <p class="lead">Modelli già compilati con i tuoi dati. Aprili, controllali, stampali o salvali in PDF e falli firmare.</p>
      ${mancano ? `<a class="banner" href="#/dati"><strong>Completa i dati dell'impresa</strong><span>Così i documenti escono già con nome, sede e titolare.</span></a>` : ''}
      <h2>Per l'impresa</h2>
      <div class="lista">${impresa.map((m) => cardDocumento(m, `#/documento/${m.id}`)).join('')}</div>
      ${
        perLav.length
          ? `<h2>Per ogni lavoratore</h2>
        ${
          lav.length
            ? lav
                .map((l) => {
                  const docs = perLav.filter((m) => modelloPerLavoratore(m, l));
                  return `<h3>${esc(nomeCompleto(l))}</h3><div class="lista">${docs.map((m) => cardDocumento(m, `#/documento/${m.id}/${l.id}`)).join('')}</div>`;
                })
                .join('')
            : `<p>Inserisci i lavoratori per avere nomine, verbali DPI e informative già intestate.</p><a class="btn btn--secondario" href="#/lavoratore-modifica/nuovo">Aggiungi un lavoratore</a>`
        }`
          : ''
      }
      <p class="nota">I modelli sono una base di partenza: controllali con il tuo consulente prima di usarli.</p>
    </section>`;
}

async function schermataDocumento(id, lavId) {
  const m = MODELLI.find((x) => x.id === id);
  if (!m) return (location.hash = '#/documenti');
  const l = lavId ? stato.lavoratori.find((x) => x.id === lavId && !x.deleted) : null;
  if (m.ambito === 'lavoratore' && !l) return (location.hash = '#/documenti');
  const req = stato.defLav.requisiti.find((r) => r.modello === id);
  const registro = l && req ? storicoRegistri(l.id, req.id, stato.registri)[0] : null;
  const situazioni = id === 'registro-formazione' ? attivi().map(situazione) : null;
  const { html } = generaDocumento(id, { anagrafica: anagrafica(), lavoratore: l, oggi: oggiIso(), registro, situazioni });

  app.innerHTML = `
    <section class="pagina pagina--doc">
      <div class="solo-schermo">
        <a class="indietro" href="${l ? `#/lavoratore/${esc(l.id)}` : '#/documenti'}">‹ Indietro</a>
        <p class="aiuto">Le righe vuote si completano a mano. Per cambiare i dati dell'impresa vai su <a href="#/dati">I miei dati</a>.</p>
        <button class="btn btn--primario btn--grande" id="stampa">Stampa o salva in PDF</button>
      </div>
      <article class="doc">${html}</article>
      <p class="nota solo-schermo">Modello da verificare e adattare con il tuo consulente prima dell'uso.</p>
    </section>`;
  app.querySelector('#stampa').addEventListener('click', () => window.print());
}

async function schermataDati() {
  const ultimo = await store.leggiMeta('ultimoExport');
  app.innerHTML = `
    <section class="pagina">
      <h1>I tuoi dati</h1>
      <p class="lead">I dati sono salvati solo su questo dispositivo. Salva spesso una copia: se cancelli i dati del browser o cambi telefono, la copia è l'unico modo per recuperarli.</p>
      <p class="nota">${ultimo ? `Ultima copia: ${dataLeggibile(ultimo)}` : 'Non hai ancora salvato nessuna copia.'}</p>

      <h2>Salva una copia</h2>
      <label>Password per proteggere il file <small>(consigliata: il file contiene dati dei lavoratori)</small>
        <input class="campo" type="password" id="pwdExport" autocomplete="new-password">
      </label>
      <button class="btn btn--primario btn--grande" id="esporta">Salva copia</button>

      <h2>Carica una copia</h2>
      <p>Puoi caricare una copia fatta su un altro dispositivo: i dati vengono uniti, tenendo sempre la modifica più recente.</p>
      <label class="btn btn--secondario btn--file">Scegli il file
        <input type="file" id="importa" accept=".json,application/json" hidden>
      </label>
      <div id="esito"></div>

      <h2>Dati dell'impresa</h2>
      <p>Servono per compilare i documenti. Puoi lasciare vuoto quello che non sai.</p>
      <form id="anagrafica">
        ${CAMPI_ANAGRAFICA.map(
          ([k, et, ac]) => `<label>${esc(et)}<input class="campo" name="${k}" autocomplete="${ac}" value="${esc(anagrafica()[k] || '')}"></label>`
        ).join('')}
        <button class="btn btn--primario" type="submit">Salva i dati dell'impresa</button>
      </form>

      <h2>Questionario</h2>
      <a class="btn btn--secondario" href="#/domanda/0">Cambia le risposte</a>

      <p class="nota">safetyDoc ${VERSIONE_APP} · catalogo ${esc(stato.catalogo.versione)} del ${dataLeggibile(stato.catalogo.aggiornato)}. ${esc(stato.catalogo.avvertenza)}</p>
    </section>`;

  app.querySelector('#anagrafica').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const a = {};
    for (const [k] of CAMPI_ANAGRAFICA) a[k] = String(f.get(k) || '').trim();
    await store.salvaAnagrafica(a);
    await ricarica();
    avviso('Dati dell\'impresa salvati.');
  });
  app.querySelector('#esporta').addEventListener('click', esporta);
  app.querySelector('#importa').addEventListener('change', (e) => importa(e.target.files[0]));
}

// ---------- backup ----------

async function esporta() {
  const collezioni = {};
  for (const c of COLLEZIONI) collezioni[c] = await store.tutti(c);
  let contenuto = creaExport({ collezioni, deviceId: await store.idPostazione(), versioneApp: VERSIONE_APP });
  const pwd = document.getElementById('pwdExport').value;
  if (pwd) contenuto = await cifra(contenuto, pwd);

  const nome = `safetydoc-${(risposte().nome_impresa || 'impresa').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${oggiIso()}${pwd ? '-protetto' : ''}.json`;
  const blob = new Blob([JSON.stringify(contenuto, null, 2)], { type: 'application/json' });
  const file = new File([blob], nome, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Copia dati safetyDoc' });
    } catch (e) {
      if (e.name === 'AbortError') return;
      scarica(blob, nome);
    }
  } else {
    scarica(blob, nome);
  }
  await store.scriviMeta('ultimoExport', new Date().toISOString());
  avviso('Copia salvata.');
  schermataDati();
}

function scarica(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importa(file) {
  const esito = document.getElementById('esito');
  if (!file) return;
  try {
    let dati = JSON.parse(await file.text());
    if (dati.formato === FORMATO_CIFRATO) {
      const pwd = prompt('Questo file è protetto. Scrivi la password:');
      if (!pwd) return;
      dati = await decifra(dati, pwd);
    }
    dati = validaExport(dati);

    const righe = [];
    let conflitti = 0;
    for (const c of COLLEZIONI) {
      const { daSalvare, riepilogo } = unisciCollezione(await store.tutti(c), dati.collezioni[c] || []);
      await store.scriviMolti(c, daSalvare);
      conflitti += riepilogo.conflitti.length;
      const n = (x, uno, tanti) => `${x} ${x === 1 ? uno : tanti}`;
      if (c === 'adempimenti') {
        righe.push(`${n(riepilogo.aggiunti, 'voce nuova', 'voci nuove')}, ${n(riepilogo.aggiornati, 'aggiornata', 'aggiornate')}.`);
      }
      if (c === 'lavoratori' && riepilogo.aggiunti + riepilogo.aggiornati) {
        righe.push(`Lavoratori: ${n(riepilogo.aggiunti, 'nuovo', 'nuovi')}, ${n(riepilogo.aggiornati, 'aggiornato', 'aggiornati')}.`);
      }
    }
    await ricarica();
    esito.innerHTML = `<p class="esito esito--ok">Copia caricata. ${esc(righe.join(' '))}${
      conflitti ? ` ${conflitti} voci erano state modificate su entrambi i dispositivi: abbiamo tenuto la versione più recente.` : ''
    }</p>`;
  } catch (e) {
    esito.innerHTML = `<p class="esito esito--errore">${esc(e.message === 'CIFRATO' ? 'Il file è protetto da password.' : e.message || 'Non è stato possibile leggere il file.')}</p>`;
  }
}

// ---------- avvio ----------

async function instrada() {
  const [, rotta, param, extra] = (location.hash || '#/').split('/').map((x) => (x ? decodeURIComponent(x) : x));
  aggiornaNav(rotta || '');
  window.scrollTo(0, 0);
  if (rotta === 'domanda') return schermataDomanda(param);
  if (rotta === 'piano') return schermataPiano();
  if (rotta === 'scheda') return schermataScheda(param || '');
  if (rotta === 'dati') return schermataDati();
  if (rotta === 'lavoratori') return schermataLavoratori();
  if (rotta === 'lavoratore') return schermataLavoratore(param);
  if (rotta === 'lavoratore-modifica') return schermataModificaLavoratore(param);
  if (rotta === 'registro') return schermataRegistro(param, extra);
  if (rotta === 'documenti') return schermataDocumenti();
  if (rotta === 'documento') return schermataDocumento(param, extra);
  return schermataOggi();
}

async function avvia() {
  try {
    const [q, c, l] = await Promise.all(
      ['data/questionario.json', 'data/catalogo.json', 'data/lavoratori.json'].map((u) => fetch(u).then((r) => r.json()))
    );
    stato.questionario = q;
    stato.catalogo = c;
    stato.defLav = l;
    await ricarica();
    store.chiediMemoriaPersistente();
    addEventListener('hashchange', instrada);
    await instrada();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<section class="pagina"><h1>Qualcosa non ha funzionato</h1><p>Ricarica la pagina. Se il problema continua, il browser potrebbe non essere supportato.</p></section>`;
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

avvia();
