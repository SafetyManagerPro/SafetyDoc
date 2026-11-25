import {
  schermate,
  cercaAteco,
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
  ESITI_VISITA,
  attrezzatureAttive,
  situazioneAttrezzatura,
  urgenzeAttrezzature,
  tipoAttrezzatura,
  storicoControlli,
  PITTOGRAMMI,
  prodottiAttivi,
  situazioneProdotto,
  TIPI_EVENTO,
  eventiAttivi,
  situazioneEvento,
  urgenzeEventi,
  eventiPerAnno,
  archivioAttuale,
  versioniPrecedenti,
  situazioneArchivio,
  urgenzeArchivio,
  rinnovaAdempimento,
  domandeSenzaRisposta,
  schermataSenzaRisposta,
  novitaDaMostrare,
  vociControlloIniziale,
  dataDaMese,
  valuta,
  statoCorrente
} from './engine.js';
import { linkAiuto } from './aiuto.js';
import { accoda, pacchetto, invia, cancellaDati, piattaforma } from './utilizzo.js';
import { rpc, accedi, rinnova } from './supabase.js';
import { rottaDa, vociPer, testoCorrisponde, sigleCliccabili, regexSigle, eventoGuida } from './guida.js';
import { TIPI_RICHIESTA, STATI_RICHIESTA, datiRichiesta, erroriRichiesta, erroreRichiesta, avvisoRisposta } from './richieste.js';
import { GRAZIA_MS, RIVERIFICA_MS, ROTTE_LIBERE, decidiAccesso, daRiverificare, applicaVerifica, erroreAttivazione, datiAttivazione, erroriAttivazione, linkInvito, numeroWhatsApp, messaggioInvito, urlWhatsApp, csvImprese, sessioneValida } from './account.js';
import { raccogliScadenze, raggruppaScadenze, conteggiScadenze, testoPromemoria, daNotificare, testoNotifica, perServiceWorker, revisioneDocumento, statoScadenza, chiaveDocumento, scadenzaArchivio, durataArchivio, giorniTra, AREE } from './scadenzario.js';
import { costruisciIndice, cerca, raggruppa, collegati, voce, perDocumento, verifiche, normalizza as normalizzaTesto, TIPI_VOCE, idSigla } from './conoscenza.js';
import { oggiLocale, formattaData, interpretaData, mascheraData, erroreData, MESI } from './date.js';
import { immaginiPerStampa } from './allegati.js';
import { LINGUE } from './lingue.js';
import { preparaFile, dimensioneLeggibile, allegatoPerExport, allegatoDaImport } from './allegati.js';
import { unisciCollezione, unisciDocumenti, creaExport, validaExport, FORMATO_CIFRATO, COLLEZIONI } from './merge.js';
import { cifra, decifra } from './cifratura.js';
import { modelliDisponibili, modelloPerLavoratore, generaDocumento, MODELLI, livelloRischio } from './modelli.js';
import { generaIcs } from './calendario.js';
import * as store from './store.js';

export const VERSIONE_APP = '0.22.0';
const GIORNI_PROMEMORIA_BACKUP = 7;

// Documenti utili da mostrare in fondo a ogni scheda.
const SCHEDA_MODELLI = {
  rspp: ['dichiarazione-dl-rspp', 'nomina-rspp-esterno'],
  'formazione-dl-rspp': ['dichiarazione-dl-rspp'],
  'medico-competente': ['nomina-medico', 'richiesta-visite'],
  preposto: ['nomina-preposto'],
  'primo-soccorso': ['designazione-addetti'],
  dpi: ['consegna-dpi'],
  'formazione-lavoratori': ['registro-formazione', 'informazione-art36', 'verbale-addestramento'],
  rls: ['verbale-elezione-rls'],
  antincendio: ['designazione-addetti', 'piano-emergenza-doc', 'valutazione-incendio'],
  dvr: ['dvr-bozza'],
  'stress-lavoro-correlato': ['stress-preliminare', 'dvr-bozza'],
  'privacy-lavoratori': ['informativa-lavoratori', 'autorizzazione-trattamento'],
  privacy: ['informativa-clienti', 'nomina-responsabile-esterno'],
  'piano-emergenza': ['piano-emergenza-doc', 'verbale-evacuazione'],
  'riunione-periodica': ['verbale-riunione'],
  'presidi-antincendio': ['registro-antincendio', 'valutazione-incendio'],
  'verifica-cpi': ['valutazione-incendio'],
  'prevenzione-incendi-cpi': ['valutazione-incendio'],
  'rumore-vibrazioni': ['valutazione-rumore', 'valutazione-vibrazioni'],
  'movimentazione-carichi': ['valutazione-mmc'],
  cancerogeni: ['valutazione-chimico'],
  duvri: ['info-rischi-ditte', 'duvri-bozza', 'permesso-lavoro-caldo'],
  'appalti-presso-clienti': ['autocertificazione-idoneita'],
  pos: ['pos-bozza', 'autocertificazione-idoneita'],
  'lavoratrici-madri': ['informativa-lavoratrici-madri'],
  'lavoratori-minori': ['informativa-minori'],
  'schede-sicurezza': ['elenco-prodotti-chimici'],
  'rischio-chimico': ['valutazione-chimico', 'elenco-prodotti-chimici'],
  'registro-eventi': ['registro-eventi'],
  infortuni: ['registro-eventi'],
  'haccp-autocontrollo': ['registro-temperature'],
  allergeni: ['cartello-allergeni']
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

const stato = { guida: null, legale: null, conoscenza: null, settori: null, lavorazioni: null, defArchivio: null, archivio: [], questionario: null, catalogo: null, defLav: null, dvr: null, ateco: null, defAttr: null, profilo: null, adempimenti: [], lavoratori: [], registri: [], attrezzature: [], controlli: [], prodotti: [], eventi: [], allegati: [] };
const app = document.getElementById('app');

// ---------- utilità ----------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const oggiIso = () => oggiLocale();

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
  stato.attrezzature = await store.tutti('attrezzature');
  stato.controlli = await store.tutti('controlli');
  stato.prodotti = await store.tutti('prodotti');
  stato.eventi = await store.tutti('eventi');
  stato.archivio = await store.tutti('archivio');
  stato.allegati = await store.tutti('allegati');
}

const risposte = () => stato.profilo?.risposte || {};
const questionarioCompletato = () => Boolean(risposte().__completato);
const ctx = () => creaContesto(risposte(), stato.questionario, stato.ateco);
const haDipendenti = () => ctx().fatti.haDipendenti;

function anagrafica() {
  const a = { ...(stato.profilo?.anagrafica || {}) };
  if (!a.ragioneSociale && risposte().nome_impresa) a.ragioneSociale = risposte().nome_impresa;
  return a;
}

const attivi = () => lavoratoriAttivi(stato.lavoratori, oggiIso());

const macchine = () => attrezzatureAttive(stato.attrezzature);

function situazioneMacchina(a) {
  return situazioneAttrezzatura({ attrezzatura: a, defAttr: stato.defAttr, controlli: stato.controlli, ctx: ctx(), oggi: oggiIso() });
}

// ---------- allegati ----------

const allegatiDi = (tipo, id) => (id ? stato.allegati.filter((a) => !a.deleted && a.collegatoTipo === tipo && a.collegatoId === id) : []);

function campoAllegato(tipo) {
  const categorie = stato.defAttr?.categorieAllegati?.[tipo];
  return `<label>Allega foto o PDF <small>(attestato, verbale, libretto, documento firmato: puoi anche scattare una foto)</small>
    <input class="campo" type="file" name="allegato" accept="image/*,application/pdf" multiple></label>
    ${
      categorie
        ? `<div class="allegato-dati"><label>Che documento è?<select class="campo" name="categoria">${categorie.map((c) => `<option value="${esc(c.id)}">${esc(c.etichetta)}</option>`).join('')}</select></label>
        <label>Pagine da stampare nei documenti <small>(solo PDF, es. «1-4, 12»; vuoto = tutte fino a 30)</small><input class="campo" name="pagine" inputmode="numeric" placeholder="tutte"></label></div>`
        : ''
    }`;
}

async function salvaAllegatiDa(form, tipo, id, riferitoA = null) {
  const files = [...(form.querySelector('input[name="allegato"]')?.files || [])];
  let n = 0;
  for (const f of files) {
    try {
      const p = await preparaFile(f);
      const categoria = form.querySelector('[name="categoria"]')?.value || null;
      const pagine = form.querySelector('[name="pagine"]')?.value.trim() || '';
      await store.salva('allegati', { collegatoTipo: tipo, collegatoId: id, nome: p.nome, tipo: p.tipo, dimensione: p.dimensione, file: p.file, categoria, pagine, inStampa: true, ...(riferitoA ? { riferitoA } : {}) });
      n++;
    } catch (e) {
      avviso(e.message);
    }
  }
  return n;
}

/**
 * Per gli adempimenti rinnovati "periodo" è la data della registrazione: con attuale=true si vedono anche i file
 * senza data (caricati prima dello storico), con attuale=false solo quelli di quella data.
 */
function elencoAllegati(tipo, id, periodo, attuale = true) {
  const lista = allegatiDi(tipo, id).filter((a) => periodo === undefined || a.riferitoA === periodo || (attuale && !a.riferitoA));
  if (!lista.length) return '';
  return `<ul class="allegati">${lista
    .map(
      (a) => `<li><button type="button" class="allegato" data-apri="${esc(a.id)}"><span class="allegato__tipo">${a.tipo?.startsWith('image/') ? 'Foto' : a.tipo === 'text/html' ? 'Firmato' : 'PDF'}</span> ${esc(a.nome)} <small>${esc(dimensioneLeggibile(a.dimensione))}</small></button>
        <button type="button" class="btn btn--testo btn--piccolo" data-togli="${esc(a.id)}">Elimina</button></li>`
    )
    .join('')}</ul>`;
}

const etichettaCategoria = (tipo, id) => stato.defAttr?.categorieAllegati?.[tipo]?.find((c) => c.id === id)?.etichetta || '';

/** Elenco degli allegati con categoria, pagine da stampare e inclusione nei documenti, modificabili. */
function elencoAllegatiDettaglio(tipo, id) {
  const lista = allegatiDi(tipo, id);
  const categorie = stato.defAttr?.categorieAllegati?.[tipo] || [];
  if (!lista.length) return '';
  return `<ul class="allegati allegati--dettaglio">${lista
    .map(
      (a) => `<li data-allegato-id="${esc(a.id)}">
        <button type="button" class="allegato" data-apri="${esc(a.id)}"><span class="allegato__tipo">${a.tipo?.startsWith('image/') ? 'Foto' : 'PDF'}</span> ${esc(a.nome)} <small>${esc(dimensioneLeggibile(a.dimensione))}</small></button>
        <div class="allegato-dati">
          <select class="campo" data-modifica="categoria" aria-label="Che documento è">${categorie.map((c) => `<option value="${esc(c.id)}" ${a.categoria === c.id ? 'selected' : ''}>${esc(c.etichetta)}</option>`).join('')}</select>
          ${a.tipo === 'application/pdf' ? `<input class="campo" data-modifica="pagine" value="${esc(a.pagine || '')}" placeholder="pagine: tutte" aria-label="Pagine da stampare">` : ''}
          <label class="spunta-semplice"><input type="checkbox" data-modifica="inStampa" ${a.inStampa !== false ? 'checked' : ''}> Stampa nei documenti</label>
        </div>
        <button type="button" class="btn btn--testo btn--piccolo" data-togli="${esc(a.id)}">Elimina</button></li>`
    )
    .join('')}</ul>`;
}

function attivaModificheAllegati() {
  for (const el of app.querySelectorAll('[data-modifica]')) {
    el.addEventListener('change', async () => {
      const id = el.closest('[data-allegato-id]').dataset.allegatoId;
      const a = stato.allegati.find((x) => x.id === id);
      if (!a) return;
      const campo = el.dataset.modifica;
      await store.salva('allegati', { ...a, [campo]: el.type === 'checkbox' ? el.checked : el.value.trim() });
      await ricarica();
      avviso('Allegato aggiornato.');
    });
  }
}

function attivaAllegati(ridisegna) {
  attivaModificheAllegati();
  for (const b of app.querySelectorAll('[data-apri]')) {
    b.addEventListener('click', () => {
      const a = stato.allegati.find((x) => x.id === b.dataset.apri);
      if (!a?.file) return avviso('Questo file non è presente su questo dispositivo.');
      const url = URL.createObjectURL(a.file);
      const link = Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener' });
      if (!a.tipo?.startsWith('image/') && a.tipo !== 'application/pdf' && a.tipo !== 'text/html') link.download = a.nome;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }
  for (const b of app.querySelectorAll('[data-togli]')) {
    b.addEventListener('click', async () => {
      if (!confirm('Eliminare questo allegato?')) return;
      const a = stato.allegati.find((x) => x.id === b.dataset.togli);
      await store.elimina('allegati', { ...a, file: null });
      await ricarica();
      ridisegna();
    });
  }
}

function situazione(l) {
  return situazioneLavoratore({ lavoratore: l, defLavoratori: stato.defLav, registri: stato.registri, ctx: ctx(), oggi: oggiIso() });
}

// ---------- campi data ----------

const ICONA_CALENDARIO = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/**
 * Trasforma ogni <input type="date"> in un campo uguale su tutti i telefoni: la data si scrive come gg/mm/aaaa
 * (le barre si aggiungono da sole) oppure si sceglie con il pulsante del calendario.
 * Il campo originale resta nascosto e continua a portare il valore AAAA-MM-GG nel modulo.
 */
function miglioraCampoData(nativo) {
  if (nativo.dataset.migliorato) return;
  nativo.dataset.migliorato = '1';
  const obbligatoria = nativo.required;
  nativo.required = false;
  nativo.dataset.minBase = nativo.min || '';
  const box = document.createElement('span');
  box.className = 'data-campo';
  const testo = document.createElement('input');
  Object.assign(testo, { type: 'text', className: 'campo data-campo__testo', placeholder: 'gg/mm/aaaa', autocomplete: 'off', inputMode: 'numeric', required: obbligatoria, value: formattaData(nativo.value) });
  testo.setAttribute('maxlength', '10');
  const bottone = document.createElement('button');
  Object.assign(bottone, { type: 'button', className: 'data-campo__cal', innerHTML: ICONA_CALENDARIO });
  bottone.setAttribute('aria-label', 'Scegli la data dal calendario');
  const messaggio = document.createElement('span');
  messaggio.className = 'data-campo__errore';
  messaggio.setAttribute('aria-live', 'polite');
  nativo.before(box);
  box.append(testo, bottone, nativo, messaggio);
  nativo.classList.add('data-campo__nativo');
  nativo.tabIndex = -1;
  nativo.setAttribute('aria-hidden', 'true');

  const limiti = () => {
    const altro = nativo.dataset.dopo ? nativo.form?.elements[nativo.dataset.dopo] : null;
    const min = [nativo.dataset.minBase, altro?.value].filter(Boolean).sort().pop() || '';
    return { min, max: nativo.max || '', obbligatoria };
  };
  const aggiorna = (avvisa) => {
    const iso = interpretaData(testo.value);
    const err = erroreData(iso, { ...limiti(), testo: testo.value });
    testo.setCustomValidity(err);
    // Mentre si scrive l'errore compare solo se era già mostrato; all'uscita dal campo sempre.
    if (avvisa || !err || messaggio.textContent) messaggio.textContent = err;
    const nuovo = iso && !err ? iso : '';
    if (nativo.value !== nuovo) {
      nativo.value = nuovo;
      nativo.dispatchEvent(new Event('input', { bubbles: true }));
      nativo.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  testo.addEventListener('input', () => {
    const m = mascheraData(testo.value);
    if (m !== testo.value) testo.value = m;
    aggiorna(false);
  });
  testo.addEventListener('blur', () => {
    const iso = interpretaData(testo.value);
    if (iso) testo.value = formattaData(iso);
    aggiorna(true);
  });
  nativo.addEventListener('change', (e) => {
    if (!e.isTrusted) return;
    testo.value = formattaData(nativo.value);
    aggiorna(true);
  });
  bottone.addEventListener('click', () => {
    nativo.min = limiti().min;
    try {
      nativo.showPicker();
    } catch {
      nativo.focus();
      nativo.click();
    }
  });
  // Se cambia la data a cui è legata (es. data del corso), ricontrolla questa.
  if (nativo.dataset.dopo) nativo.form?.elements[nativo.dataset.dopo]?.addEventListener('change', () => testo.value && aggiorna(true));
}

/** Imposta il valore di un campo data, anche quando è già stato trasformato. */
function impostaData(nativo, iso) {
  if (!nativo) return;
  nativo.value = iso || '';
  const testo = nativo.closest('.data-campo')?.querySelector('.data-campo__testo');
  if (testo) testo.value = formattaData(iso || '');
}

function miglioraDate(radice = document) {
  radice.querySelectorAll('input[type="date"]:not([data-migliorato])').forEach(miglioraCampoData);
}

new MutationObserver(() => miglioraDate(app)).observe(app, { childList: true, subtree: true });

// ---------- chiedi aiuto ----------

const consulente = () => stato.profilo?.consulente || {};

/** Riquadro "Chiedi aiuto": link pronti a chi aiuta l'impresa, oppure invito a inserirne il recapito. */
function bloccoAiuto(argomento) {
  const c = consulente();
  const link = linkAiuto({ contatto: c, impresa: anagrafica().ragioneSociale || risposte().nome_impresa, titolare: anagrafica().titolare, argomento });
  if (!Object.keys(link).length) {
    return `<div class="aiuto-box"><h2>Hai un dubbio?</h2>
      <p>Inserisci il recapito del tuo consulente o della tua associazione di categoria: da qui potrai chiamarlo o scrivergli con un tocco.</p>
      <a class="btn btn--secondario" href="#/dati/consulente">Aggiungi chi ti aiuta</a></div>`;
  }
  return `<div class="aiuto-box"><h2>Hai un dubbio? Chiedi ${c.nome ? `a ${esc(c.nome)}` : 'aiuto'}</h2>
    <div class="aiuto-box__azioni">
      ${link.telefono ? `<a class="btn btn--secondario" href="${esc(link.telefono)}">Chiama</a>` : ''}
      ${link.whatsapp ? `<a class="btn btn--secondario" href="${esc(link.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      ${link.email ? `<a class="btn btn--secondario" href="${esc(link.email)}">Email</a>` : ''}
    </div>
    <p class="nota">Il messaggio è già scritto e indica solo l'argomento, senza dati dei lavoratori.</p></div>`;
}

// ---------- installazione come app ----------

let richiestaInstallazione = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  richiestaInstallazione = e;
});
addEventListener('appinstalled', () => {
  richiestaInstallazione = null;
  avviso('App installata.');
});
const installata = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const suIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function bloccoInstallazione() {
  if (installata()) return `<p class="riquadro">safetyDoc è installato su questo dispositivo.</p>`;
  if (richiestaInstallazione) {
    return `<p>Mettila tra le app del telefono o del computer: si apre con un tocco, anche senza internet.</p>
      <button class="btn btn--primario" id="installa">Installa l'app</button>`;
  }
  if (suIphone()) {
    return `<p>Su iPhone e iPad, con Safari:</p>
      <ol class="passi"><li>Tocca il pulsante <strong>Condividi</strong> (il quadrato con la freccia in su).</li>
      <li>Scorri e tocca <strong>Aggiungi alla schermata Home</strong>.</li><li>Tocca <strong>Aggiungi</strong>.</li></ol>`;
  }
  return `<p>Apri il menu del browser (i tre puntini) e scegli <strong>Installa app</strong> o <strong>Aggiungi a schermata Home</strong>.</p>`;
}

function attivaInstallazione() {
  app.querySelector('#installa')?.addEventListener('click', async () => {
    const r = richiestaInstallazione;
    if (!r) return;
    r.prompt();
    await r.userChoice.catch(() => null);
    richiestaInstallazione = null;
    schermataDati();
  });
}

function piano() {
  return generaPiano({
    catalogo: stato.catalogo,
    questionario: stato.questionario,
    risposte: risposte(),
    adempimenti: stato.adempimenti,
    oggi: oggiIso(),
    ateco: stato.ateco
  });
}

const SEZIONE = { richieste: 'dati', scadenzario: 'piano', cerca: 'oggi', sapere: 'oggi', verifiche: 'oggi', archivio: 'documenti', planimetrie: 'documenti', 'archivio-voce': 'documenti', partenza: 'attrezzature', scheda: 'piano', 'controllo-iniziale': 'piano', prodotti: 'piano', prodotto: 'piano', eventi: 'piano', evento: 'piano', lavoratore: 'lavoratori', 'lavoratore-modifica': 'lavoratori', registro: 'lavoratori', documento: 'documenti', attrezzatura: 'attrezzature', 'attrezzatura-modifica': 'attrezzature', controllo: 'attrezzature' };

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
  const controlli = await calcolaVerifiche();

  app.innerHTML = `
    <section class="pagina">
      ${await bannerBackup()}
      ${await bloccoConsensoOggi()}
      ${bloccoRisposteOggi()}
      ${await bannerNovita(p)}
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
              c.rosso >= 3 && vociControlloIniziale(p).length >= 3 && c.verde <= c.rosso
                ? `<div class="riquadro riquadro--invito"><p><strong>Molte di queste cose probabilmente le hai già fatte.</strong> Rispondi a qualche domanda veloce («Hai già…?») e il semaforo diventerà verde per quello che è già in regola.</p>
                   <a class="btn btn--primario" href="#/controllo-iniziale/0">Controllo veloce</a></div>`
                : ''
            }
             <div class="lista">${urgenti.map(cardVoce).join('')}</div>
             <p class="nota">Ti mostriamo al massimo tre cose alla volta, partendo dalle più importanti. Le altre sono nel piano completo.</p>`
          : `<p class="lead">Non ci sono scadenze nei prossimi 60 giorni. Torna a controllare ogni tanto.</p>`
      }
      <a class="btn btn--secondario" href="#/piano">Vedi il piano completo</a>
      ${await bloccoScadenzarioOggi()}
      ${bloccoVerificheOggi(controlli)}
      ${barraRicerca('', { id: 'cerca-oggi' })}
      ${haDipendenti() ? bloccoLavoratoriOggi() : ''}
      ${bloccoEventiOggi()}
      ${bloccoArchivioOggi()}
      ${bloccoProdottiOggi()}
      ${bloccoMacchineOggi()}
      ${bloccoAiuto('la sicurezza della mia impresa')}
      ${richiestaInstallazione && !installata() ? `<p class="nota"><a href="#/dati/installa">Installa safetyDoc sul telefono</a> per aprirlo con un tocco.</p>` : ''}
    </section>`;
  attivaNovita();
  attivaConsenso(schermataOggi);
}

function bloccoVerificheOggi(lista) {
  if (!lista.length) return '';
  const alte = lista.filter((x) => x.livello === 'alto').length;
  return `<a class="banner banner--verifiche ${alte ? 'banner--rosso' : ''}" href="#/verifiche">
      <strong>${lista.length === 1 ? 'Un controllo di coerenza' : `${lista.length} controlli di coerenza`} da guardare${alte ? ` (${alte} ${alte === 1 ? 'importante' : 'importanti'})` : ''}</strong>
      <span>${esc(lista[0].titolo)}${lista.length > 1 ? ' e altro' : ''}</span>
    </a>`;
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
      ${barraRicerca('', { id: 'cerca-piano' })}
      ${gruppi
        .map(
          (g) => `
        <h2 class="gruppo gruppo--${g.col}">${ETICHETTE[g.col].titolo} <span>${g.voci.length}</span></h2>
        <div class="lista">${g.voci.map(cardVoce).join('')}</div>`
        )
        .join('')}
      ${vociControlloIniziale(p).length ? `<a class="btn btn--secondario" href="#/controllo-iniziale/0">Controllo veloce: segna ciò che hai già fatto</a>` : ''}
      <a class="btn btn--primario" href="#/scadenzario">Scadenzario e promemoria al responsabile</a>
      <a class="btn btn--secondario" href="#/documento/stato-sicurezza">Stampa lo stato della sicurezza</a>
      <h2>Promemoria sul telefono</h2>
      <p>Aggiungi tutte le scadenze al calendario del telefono: ti avviserà 30 e 7 giorni prima.</p>
      <button class="btn btn--primario" id="calendario">Aggiungi le scadenze al calendario</button>
      <p class="nota">Il file contiene anche i nomi dei lavoratori con le loro scadenze: salvalo solo nel tuo calendario. Quando aggiorni le date, ripeti l'operazione.</p>
      <a class="btn btn--secondario" href="#/domanda/0">Cambia le risposte</a>
    </section>`;
  app.querySelector('#calendario').addEventListener('click', esportaCalendario);
}

async function esportaCalendario() {
  const eventi = scadenzeAttuali()
    .filter((x) => x.data)
    .map((x) => ({ uid: x.id.replace(/[^a-zA-Z0-9-]/g, '-'), data: x.data, titolo: x.area === 'lavoratori' ? x.titolo : `Sicurezza: ${x.titolo}`, descrizione: [x.cosa, x.norma ? `Riferimento: ${x.norma}` : '', 'Apri safetyDoc per i passi da fare.'].filter(Boolean).join('\n') }));
  if (!eventi.length) return avviso('Non ci sono ancora scadenze: prima segna come fatte le voci del piano.');
  const ics = generaIcs(eventi);
  const nome = `scadenze-sicurezza-${oggiIso()}.ics`;
  const blob = new Blob([ics], { type: 'text/calendar' });
  const file = new File([blob], nome, { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Scadenze sicurezza' });
    } catch (e) {
      if (e.name === 'AbortError') return;
      scarica(blob, nome);
    }
  } else {
    scarica(blob, nome);
  }
  avviso(`${eventi.length} ${eventi.length === 1 ? 'scadenza pronta' : 'scadenze pronte'} per il calendario.`);
}

const NOMI_CLASSE = { basso: 'basso', medio: 'medio', alto: 'alto' };

function descriviAteco(info, testo) {
  const cifre = String(testo || '').replace(/[^0-9]/g, '');
  if (!cifre) return '';
  if (!info) return '<p class="nota">Continua a scrivere il codice…</p>';
  if (!info.valido) {
    if (cifre.startsWith('45')) {
      return `<p class="esito esito--errore">Il codice ${esc(testo)} è della vecchia classificazione ATECO 2007. Dal 2025 vale ATECO 2025: controlla la visura aggiornata (per i meccanici di solito inizia con 95.3).</p>`;
    }
    return '<p class="esito esito--errore">Questo codice non esiste nella classificazione ATECO 2025. Controlla la visura.</p>';
  }
  return `<div class="ateco">
      <p class="ateco__codice">${esc(info.codice)} · ${esc(info.descrizione)}</p>
      <p class="ateco__sezione">Sezione ${esc(info.sezione)} – ${esc(info.descrizioneSezione)}</p>
      <p class="ateco__rischio ateco__rischio--${esc(info.classe)}">Rischio <strong>${esc(NOMI_CLASSE[info.classe])}</strong> · formazione specifica dei lavoratori: <strong>${esc(String(info.ore))} ore</strong></p>
    </div>`;
}

async function schermataDomanda(indice) {
  const elenco = schermate(stato.questionario, risposte());
  // si può arrivare anche con l'id della domanda (es. dalle verifiche: #/domanda/chimici)
  const perId = /^\d*$/.test(String(indice ?? '')) ? -1 : elenco.findIndex((s) => s.domande.some((d) => d.id === indice));
  const i = perId >= 0 ? perId : Math.max(0, Math.min(Number(indice) || 0, elenco.length - 1));
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
  } else if (d.tipo === 'ateco') {
    conAvanti = true;
    campo = `<input class="campo campo--grande" id="campo" type="text" inputmode="decimal" autocomplete="off" placeholder="es. 43.21.01" value="${esc(valore ?? '')}" aria-label="${esc(d.testo)}" aria-describedby="esito-ateco">
      <div id="esito-ateco" class="esito-ateco" aria-live="polite"></div>
      <button type="button" class="btn btn--testo" id="non-so">Non lo so, lo aggiungo dopo</button>`;
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
    const suggerito = d.id === 'attivita' ? cercaAteco(r.ateco, stato.ateco)?.settore : null;
    campo = `<div class="scelte">
      ${d.opzioni
        .map(
          (o) =>
            `<button type="button" class="scelta ${valore === o.valore ? 'scelta--attiva' : ''} ${suggerito === o.valore && valore !== o.valore ? 'scelta--suggerita' : ''}" data-valore='${esc(JSON.stringify(o.valore))}' aria-pressed="${valore === o.valore}">${esc(o.etichetta)}${
              suggerito === o.valore ? '<small>Suggerito dal tuo codice ATECO</small>' : ''
            }</button>`
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
    if (soloNuoveDomande) {
      const prossima = schermataSenzaRisposta(stato.questionario, nuove, posizione + 1);
      if (prossima < 0) soloNuoveDomande = false;
      location.hash = prossima >= 0 ? `#/domanda/${prossima}` : '#/';
      return;
    }
    const primaVolta = ultima && !stato.adempimenti.some((x) => !x.deleted);
    if (primaVolta) await store.scriviMeta('catalogoVisto', stato.catalogo.versione);
    location.hash = primaVolta ? '#/controllo-iniziale/0' : ultima ? '#/' : `#/domanda/${posizione + 1}`;
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
  if (input && d.tipo === 'ateco') {
    const esito = app.querySelector('#esito-ateco');
    const mostra = () => {
      const info = cercaAteco(input.value, stato.ateco);
      esito.innerHTML = descriviAteco(info, input.value);
      return info;
    };
    mostra();
    input.addEventListener('input', mostra);
    input.focus();
    const conferma = () => {
      const testo = input.value.trim();
      if (!testo) return vai({ ateco: null });
      const info = mostra();
      if (!info?.valido) return avviso('Controlla il codice ATECO, oppure premi «Non lo so».');
      vai({ ateco: info.codice });
    };
    app.querySelector('#avanti').addEventListener('click', conferma);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && conferma());
    app.querySelector('#non-so').addEventListener('click', () => vai({ ateco: null }));
    return;
  }
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
  const ctx = creaContesto(risposte(), stato.questionario, stato.ateco);
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
      ${[].concat(scheda.daVerificare || []).length ? `<p class="verifica">In verifica: ${esc([].concat(scheda.daVerificare).join(' '))}</p>` : ''}
      ${id === 'formazione-lavoratori' || id === 'formazione-datore' ? notaClasseRischio() : ''}
      ${collegamentiScheda(id)}

      ${
        scheda.tipoScadenza === 'evento'
          ? ''
          : `
      <form class="registra" id="registra">
        <h2>${st?.fatto ? 'Rinnovo o correzione' : 'Segna come fatto'}</h2>
        ${
          st?.fatto
            ? `<fieldset class="scelte-radio"><legend>Cosa vuoi fare?</legend>
          <label class="spunta"><input type="radio" name="modo" value="rinnovo" checked><span>L'ho fatto di nuovo (rinnovo): la registrazione del ${esc(dataLeggibile(st.dataFatto))} passa nello storico</span></label>
          <label class="spunta"><input type="radio" name="modo" value="correggi"><span>Correggo i dati già inseriti</span></label>
        </fieldset>`
            : ''
        }
        <label>Data in cui l'hai fatto
          <input class="campo" type="date" name="dataFatto" required max="${oggiIso()}" value="${esc(st?.dataFatto || oggiIso())}">
        </label>
        ${
          chiedeScadenza
            ? `<label>Prossima scadenza ${mesi ? `<small>(se la lasci vuota la calcoliamo: ogni ${mesi} mesi)</small>` : '<small>(scrivila se la conosci, per esempio dall\'attestato o dal medico)</small>'}
          <input class="campo" type="date" name="scadenzaManuale" data-dopo="dataFatto" value="${esc(st?.scadenzaManuale || '')}">
        </label>`
            : ''
        }
        <label>Note <small>(facoltative: chi l'ha fatto, dove trovi il documento)</small>
          <textarea class="campo" name="note" rows="3">${esc(st?.note || '')}</textarea>
        </label>
        <div id="allegati-attuali">${elencoAllegati('adempimento', st?.id, st?.dataFatto || null)}</div>
        ${campoAllegato()}
        <button class="btn btn--primario btn--grande" type="submit">Fatto</button>
        ${st?.fatto ? `<button class="btn btn--testo" type="button" id="annulla">Segna di nuovo come da fare</button>` : ''}
      </form>
      ${
        st?.storico?.length
          ? `<h2>Storico</h2><ul class="storico">${st.storico
              .map(
                (x) => `<li><strong>${esc(dataLeggibile(x.dataFatto))}</strong>${x.scadenzaManuale ? ` · scadenza ${esc(dataLeggibile(x.scadenzaManuale))}` : ''}${x.note ? `<br><small>${esc(x.note)}</small>` : ''}
              ${elencoAllegati('adempimento', st.id, x.dataFatto, false)}</li>`
              )
              .join('')}</ul>`
          : ''
      }`
      }
      ${bloccoAiuto(scheda.titolo)}
    </section>`;

  const form = app.querySelector('#registra');
  if (!form) return;
  attivaAllegati(() => schermataScheda(id));
  if (st?.fatto) {
    const allegatiAttuali = app.querySelector('#allegati-attuali');
    const applicaModo = () => {
      const rinnovo = form.querySelector('input[name="modo"]:checked')?.value !== 'correggi';
      impostaData(form.elements.dataFatto, rinnovo ? oggiIso() : st.dataFatto);
      impostaData(form.elements.scadenzaManuale, rinnovo ? '' : st.scadenzaManuale);
      form.elements.note.value = rinnovo ? '' : st.note || '';
      if (allegatiAttuali) allegatiAttuali.hidden = rinnovo;
      form.querySelector('button[type="submit"]').textContent = rinnovo ? 'Registra il rinnovo' : 'Salva la correzione';
    };
    form.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener('change', applicaModo));
    applicaModo();
  }
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    const rinnovo = f.get('modo') !== 'correggi';
    const dati = { schedaId: id, fatto: true, dataFatto: f.get('dataFatto'), scadenzaManuale: f.get('scadenzaManuale') || null, note: f.get('note') || '' };
    if (rinnovo && st?.fatto && st.dataFatto !== dati.dataFatto) {
      // I file della registrazione precedente restano legati a quella data nello storico.
      for (const a of stato.allegati.filter((x) => !x.deleted && x.collegatoTipo === 'adempimento' && x.collegatoId === st.id && !x.riferitoA)) {
        await store.salva('allegati', { ...a, riferitoA: st.dataFatto });
      }
    }
    if (!rinnovo && st?.dataFatto && st.dataFatto !== dati.dataFatto) {
      for (const a of stato.allegati.filter((x) => !x.deleted && x.collegatoTipo === 'adempimento' && x.collegatoId === st.id && x.riferitoA === st.dataFatto)) {
        await store.salva('allegati', { ...a, riferitoA: dati.dataFatto });
      }
    }
    const salvato = await store.salvaAdempimento(rinnovo ? rinnovaAdempimento(st, dati, oggiIso()) : { ...(st || {}), ...dati });
    await salvaAllegatiDa(form, 'adempimento', salvato.id, dati.dataFatto);
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

// ---------- novità e domande nuove ----------

// Chi usava l'app prima che esistessero le novità ha visto il catalogo 0.5.0.
const VERSIONE_CATALOGO_INIZIALE = '0.5.0';
let soloNuoveDomande = false;

async function bannerNovita(p) {
  const parti = [];
  const mancanti = domandeSenzaRisposta(stato.questionario, risposte());
  if (mancanti.length) {
    parti.push(`<a class="banner banner--info" href="#/nuove-domande"><strong>${mancanti.length === 1 ? 'C\'è una domanda nuova' : `Ci sono ${mancanti.length} domande nuove`}</strong><span>Rispondi: servono per completare il tuo piano.</span></a>`);
  }
  const vista = (await store.leggiMeta('catalogoVisto')) || VERSIONE_CATALOGO_INIZIALE;
  const novita = novitaDaMostrare(stato.catalogo, vista, p.map((v) => v.scheda.id));
  if (novita.length) {
    const titoli = novita.flatMap((n) => n.schede).map((id) => p.find((v) => v.scheda.id === id)).filter(Boolean);
    parti.push(`<div class="riquadro riquadro--invito" id="novita"><p><strong>Novità nel tuo piano</strong> · ${esc(novita.map((n) => n.testo).join(' '))}</p>
      <ul class="novita">${titoli.map((v) => `<li><a href="#/scheda/${esc(v.scheda.id)}">${esc(v.scheda.titolo)}</a></li>`).join('')}</ul>
      <button class="btn btn--secondario" type="button" id="novita-viste">Ho visto, nascondi</button></div>`);
  }
  return parti.join('');
}

function attivaNovita() {
  app.querySelector('#novita-viste')?.addEventListener('click', async () => {
    await store.scriviMeta('catalogoVisto', stato.catalogo.versione);
    app.querySelector('#novita')?.remove();
  });
}

function vaiNuoveDomande() {
  const i = schermataSenzaRisposta(stato.questionario, risposte());
  soloNuoveDomande = i >= 0;
  location.replace(i >= 0 ? `#/domanda/${i}` : '#/');
}

// ---------- archivio di documenti, certificati e planimetrie ----------

const tipiArchivio = (genere) => (genere === 'planimetria' ? stato.defArchivio?.planimetrie : stato.defArchivio?.certificati) || [];
const tipoArchivio = (r) => tipiArchivio(r.genere).find((t) => t.id === r.tipo);
const allegatiArchivio = (id) => stato.allegati.filter((a) => !a.deleted && a.collegatoTipo === 'archivio' && a.collegatoId === id);
const sitArchivio = (r) => situazioneArchivio(r, oggiIso(), allegatiArchivio(r.id).length);

function cardArchivio(r) {
  const s = sitArchivio(r);
  const e = ETICHETTE[s.colore] || ETICHETTE.info;
  const extra = [
    tipoArchivio(r)?.etichetta,
    r.area,
    r.genere === 'planimetria' ? (r.dataRilascio ? `rev. ${dataLeggibile(r.dataRilascio)}` : '') : r.dataRilascio ? `del ${dataLeggibile(r.dataRilascio)}` : '',
    r.lavoratoreId ? nomeCompleto(stato.lavoratori.find((l) => l.id === r.lavoratoreId) || {}) : '',
    r.attrezzaturaId ? stato.attrezzature.find((m) => m.id === r.attrezzaturaId)?.nome : ''
  ].filter(Boolean);
  return `<a class="voce voce--${s.colore}" href="#/archivio-voce/${esc(r.id)}">
    <span class="voce__segno" aria-hidden="true">${e.icona}</span>
    <span class="voce__testo"><span class="voce__titolo">${esc(r.titolo)}</span>
    <span class="voce__stato">${esc(s.motivo)}${s.scadenza ? ` · ${s.colore === 'rosso' ? 'scaduto il' : 'scade il'} ${esc(dataLeggibile(s.scadenza))}` : ''}${extra.length ? `<br><small>${esc(extra.join(' · '))}</small>` : ''}</span></span>
    <span class="voce__freccia" aria-hidden="true">›</span></a>`;
}

async function schermataArchivio(genere) {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const pl = genere === 'planimetria';
  const voci = archivioAttuale(stato.archivio, pl ? 'planimetria' : 'certificato');
  const gruppi = [...new Set(tipiArchivio(pl ? 'planimetria' : 'certificato').map((t) => t.gruppo))];
  const perTipo = (t) => voci.filter((r) => r.tipo === t.id);
  const superate = stato.archivio.filter((r) => !r.deleted && r.sostituitoDa && r.genere === (pl ? 'planimetria' : 'certificato')).length;
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="#/documenti">‹ Documenti</a>
      <h1>${pl ? 'Planimetrie e layout' : 'Archivio documenti e certificati'}</h1>
      <p class="lead">${
        pl
          ? 'Planimetrie dei locali, layout di reparti e macchine, vie di esodo, schemi degli impianti. Vengono inserite da sole in DVR, piano di emergenza, valutazione incendio e DUVRI. Quando cambiano, carica la nuova revisione: la precedente resta archiviata.'
          : 'Certificati, dichiarazioni di conformità, verbali, autorizzazioni, contratti, attestati in più dei lavoratori e documenti delle macchine. Indica la scadenza: te la ricordiamo. Quando rinnovi un documento carica la versione nuova: la vecchia resta nello storico.'
      }</p>
      <a class="btn btn--primario btn--grande" href="#/archivio-voce/nuovo/${pl ? 'planimetria' : 'certificato'}">${pl ? 'Aggiungi una planimetria o un layout' : 'Aggiungi un documento'}</a>
      ${
        voci.length
          ? pl
            ? `<div class="lista">${voci.map(cardArchivio).join('')}</div>`
            : gruppi
                .map((g) => {
                  const lista = tipiArchivio('certificato').filter((t) => t.gruppo === g).flatMap(perTipo);
                  return lista.length ? `<h2>${esc(g)}</h2><div class="lista">${lista.map(cardArchivio).join('')}</div>` : '';
                })
                .join('')
          : `<p>${pl ? 'Nessuna planimetria caricata.' : 'Nessun documento in archivio.'}</p>`
      }
      ${superate ? `<p class="nota">${superate} ${superate === 1 ? 'versione precedente è conservata' : 'versioni precedenti sono conservate'} nello storico dei documenti.</p>` : ''}
      <p class="nota">${pl ? '<a href="#/archivio">Vai all\'archivio dei documenti e certificati</a>' : '<a href="#/planimetrie">Vai alle planimetrie e ai layout</a>'}</p>
    </section>`;
}

async function schermataVoceArchivio(id, genereNuovo, collegamento) {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const nuovo = id === 'nuovo';
  const rinnovo = id === 'rinnovo';
  let r;
  if (rinnovo) {
    const vecchio = stato.archivio.find((x) => x.id === genereNuovo && !x.deleted);
    if (!vecchio) return (location.hash = '#/archivio');
    r = { genere: vecchio.genere, tipo: vecchio.tipo, durata: vecchio.durata, titolo: vecchio.titolo, area: vecchio.area, ente: vecchio.ente, lavoratoreId: vecchio.lavoratoreId, attrezzaturaId: vecchio.attrezzaturaId, sostituisce: vecchio.id };
  } else if (nuovo) {
    r = { genere: genereNuovo === 'planimetria' ? 'planimetria' : 'certificato' };
    if (collegamento?.startsWith('lav:')) Object.assign(r, { lavoratoreId: collegamento.slice(4), tipo: 'attestato-lavoratore' });
    if (collegamento?.startsWith('attr:')) Object.assign(r, { attrezzaturaId: collegamento.slice(5), tipo: 'documento-macchina' });
  } else {
    r = stato.archivio.find((x) => x.id === id && !x.deleted);
    if (!r) return (location.hash = '#/archivio');
  }
  const pl = r.genere === 'planimetria';
  const tipi = tipiArchivio(r.genere);
  const sit = nuovo || rinnovo ? null : sitArchivio(r);
  const precedenti = nuovo || rinnovo ? [] : versioniPrecedenti(r, stato.archivio);
  const successiva = r.sostituitoDa ? stato.archivio.find((x) => x.id === r.sostituitoDa) : null;
  const lav = attivi();
  const mac = macchine();
  const indietro = r.lavoratoreId && collegamento ? `#/lavoratore/${r.lavoratoreId}` : r.attrezzaturaId && collegamento ? `#/attrezzatura/${r.attrezzaturaId}` : pl ? '#/planimetrie' : '#/archivio';
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="${esc(indietro)}">‹ ${pl ? 'Planimetrie' : 'Archivio'}</a>
      ${sit ? `<p class="pill pill--${sit.colore}"><span aria-hidden="true">${(ETICHETTE[sit.colore] || ETICHETTE.info).icona}</span> ${esc(sit.motivo)}${sit.scadenza ? ` · ${esc(dataLeggibile(sit.scadenza))}` : ''}</p>` : ''}
      <h1>${rinnovo ? 'Nuova versione' : nuovo ? (pl ? 'Nuova planimetria' : 'Nuovo documento') : esc(r.titolo)}</h1>
      ${rinnovo ? `<p class="lead">Carica il documento rinnovato o la nuova revisione. La versione precedente resterà nello storico.</p>` : ''}
      ${successiva ? `<p class="riquadro">Questa è una versione superata. <a href="#/archivio-voce/${esc(successiva.id)}">Apri la versione in uso</a>.</p>` : ''}
      <form id="voce-archivio">
        <label>Tipo<select class="campo" name="tipo" required>${tipi.map((t) => `<option value="${esc(t.id)}" ${r.tipo === t.id ? 'selected' : ''}>${esc(t.etichetta)}</option>`).join('')}</select></label>
        <p class="nota" id="aiuto-tipo"></p>
        <label>Titolo <small>(come lo riconosci, es. «${pl ? 'Piano terra – laboratorio' : 'Conformità impianto elettrico capannone'}»)</small><input class="campo" name="titolo" required value="${esc(r.titolo || '')}"></label>
        ${pl ? `<label>Area, piano o reparto<input class="campo" name="area" value="${esc(r.area || '')}"></label>` : ''}
        <label>${pl ? 'Redatta da (tecnico)' : 'Rilasciato da (ente, ditta, tecnico)'}<input class="campo" name="ente" value="${esc(r.ente || '')}"></label>
        ${pl ? '' : `<label>Numero o protocollo<input class="campo" name="numero" value="${esc(r.numero || '')}"></label>`}
        <label>${pl ? 'Data della revisione' : 'Data di rilascio'}<input class="campo" type="date" name="dataRilascio" max="${oggiIso()}" value="${esc(r.dataRilascio || '')}"></label>
        ${pl ? '' : `<div id="durata-norma"></div>
        <label>Scadenza <small>(calcolata dalla norma quando possibile; puoi correggerla)</small><input class="campo" type="date" name="scadenza" data-dopo="dataRilascio" value="${esc(rinnovo ? '' : r.scadenza || '')}"></label>
        <p class="nota" id="nota-scadenza"></p>`}
        <div id="collega-lav" ${r.lavoratoreId || r.tipo === 'attestato-lavoratore' || r.tipo === 'patente' ? '' : 'hidden'}>
          <label>Lavoratore<select class="campo" name="lavoratoreId"><option value="">—</option>${lav.map((l) => `<option value="${esc(l.id)}" ${r.lavoratoreId === l.id ? 'selected' : ''}>${esc(nomeCompleto(l))}</option>`).join('')}</select></label>
        </div>
        <div id="collega-attr" ${r.attrezzaturaId || r.tipo === 'documento-macchina' ? '' : 'hidden'}>
          <label>Macchina o attrezzatura<select class="campo" name="attrezzaturaId"><option value="">—</option>${mac.map((m) => `<option value="${esc(m.id)}" ${r.attrezzaturaId === m.id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></label>
        </div>
        <label>Note<textarea class="campo" name="note" rows="2">${esc(rinnovo ? '' : r.note || '')}</textarea></label>
        ${campoAllegato('archivio')}
        <button class="btn btn--primario btn--grande" type="submit">${rinnovo ? 'Salva la nuova versione' : 'Salva'}</button>
      </form>
      ${
        nuovo || rinnovo
          ? ''
          : `<h2>${pl ? 'File della planimetria' : 'File del documento'}</h2>
      ${elencoAllegatiDettaglio('archivio', r.id) || '<p>Nessun file caricato: fotografa il documento o allega il PDF.</p>'}
      ${r.sostituitoDa ? '' : `<a class="btn btn--secondario" href="#/archivio-voce/rinnovo/${esc(r.id)}">${pl ? 'Carica una nuova revisione' : 'Carica la versione rinnovata'}</a>`}
      ${
        precedenti.length
          ? `<h2>Versioni precedenti</h2><div class="lista">${precedenti.map(cardArchivio).join('')}</div>`
          : ''
      }
      <button class="btn btn--testo" type="button" id="elimina">Elimina</button>`
      }
    </section>`;
  const form = app.querySelector('#voce-archivio');
  const aiutoTipo = () => {
    const t = tipi.find((x) => x.id === form.tipo.value);
    app.querySelector('#aiuto-tipo').textContent = t?.aiuto || '';
    app.querySelector('#collega-lav').hidden = !(t?.collega === 'lavoratore' || form.lavoratoreId.value);
    app.querySelector('#collega-attr').hidden = !(t?.collega === 'attrezzatura' || form.attrezzaturaId.value);
  };
  form.tipo.addEventListener('change', aiutoTipo);
  aiutoTipo();
  if (!pl) {
    // Scadenza calcolata dalla norma (tipo + validità + data di rilascio), finché l'utente non la scrive a mano.
    let automatica = !r.scadenza || rinnovo || r.scadenzaCalcolata === true;
    const box = app.querySelector('#durata-norma');
    const nota = app.querySelector('#nota-scadenza');
    const calcola = () => {
      const t = tipi.find((x) => x.id === form.tipo.value);
      const ris = scadenzaArchivio(t, form.dataRilascio.value, form.durata?.value);
      if (ris && automatica) impostaData(form.scadenza, ris.scadenza);
      nota.textContent = ris ? (automatica ? `Calcolata: ${ris.durata.etichetta} (${ris.durata.norma}).` : `Secondo la norma sarebbe il ${dataLeggibile(ris.scadenza)}: ${ris.durata.etichetta} (${ris.durata.norma}).`) : t?.durate?.length ? 'Inserisci la data di rilascio: la scadenza la calcoliamo noi.' : '';
    };
    const durate = () => {
      const t = tipi.find((x) => x.id === form.tipo.value);
      const scelta = form.durata?.value || r.durata;
      box.innerHTML = t?.durate?.length > 1
        ? `<label>Validità secondo la norma<select class="campo" name="durata">${t.durate.map((d) => `<option value="${esc(d.id)}" ${scelta === d.id ? 'selected' : ''}>${esc(d.etichetta)}</option>`).join('')}</select></label>`
        : t?.durate?.length ? `<input type="hidden" name="durata" value="${esc(t.durate[0].id)}">` : '';
      form.durata?.addEventListener('change', calcola);
      calcola();
    };
    form.tipo.addEventListener('change', durate);
    form.dataRilascio.addEventListener('change', calcola);
    // il campo data visibile viene creato subito dopo: si ascolta sul modulo
    form.addEventListener('input', (e) => {
      if (!e.target.classList?.contains('data-campo__testo') || !e.target.closest('.data-campo')?.querySelector('input[name="scadenza"]')) return;
      automatica = false;
      calcola();
    });
    durate();
  }
  if (!nuovo && !rinnovo) attivaAllegati(() => schermataVoceArchivio(id));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    const testo = (k) => String(f.get(k) || '').trim();
    const salvato = await store.salva('archivio', {
      ...(nuovo || rinnovo ? {} : r),
      genere: r.genere,
      tipo: testo('tipo'),
      titolo: testo('titolo'),
      area: testo('area'),
      ente: testo('ente'),
      numero: testo('numero'),
      dataRilascio: f.get('dataRilascio') || null,
      scadenza: f.get('scadenza') || null,
      ...(pl ? {} : { durata: f.get('durata') || null, scadenzaCalcolata: Boolean(f.get('scadenza')) && f.get('scadenza') === scadenzaArchivio(tipi.find((x) => x.id === f.get('tipo')), f.get('dataRilascio'), f.get('durata'))?.scadenza }),
      lavoratoreId: f.get('lavoratoreId') || null,
      attrezzaturaId: f.get('attrezzaturaId') || null,
      note: testo('note'),
      sostituisce: r.sostituisce || null,
      sostituitoDa: nuovo || rinnovo ? null : r.sostituitoDa || null
    });
    const n = await salvaAllegatiDa(form, 'archivio', salvato.id);
    if (rinnovo) {
      const vecchio = stato.archivio.find((x) => x.id === r.sostituisce);
      if (vecchio) await store.salva('archivio', { ...vecchio, sostituitoDa: salvato.id });
    }
    await ricarica();
    avviso(rinnovo ? 'Nuova versione salvata: la precedente è nello storico.' : n || !nuovo ? 'Salvato.' : 'Salvato. Ricorda di allegare il file del documento.');
    location.hash = `#/archivio-voce/${salvato.id}`;
  });
  app.querySelector('#elimina')?.addEventListener('click', async () => {
    if (!confirm(`Eliminare «${r.titolo}»? Se è stato rinnovato, usa invece «Carica la versione rinnovata».`)) return;
    if (r.sostituisce) {
      const prec = stato.archivio.find((x) => x.id === r.sostituisce);
      if (prec) await store.salva('archivio', { ...prec, sostituitoDa: null });
    }
    await store.elimina('archivio', r);
    await ricarica();
    location.hash = pl ? '#/planimetrie' : '#/archivio';
  });
}

function bloccoArchivioOggi() {
  const urg = urgenzeArchivio(stato.archivio, oggiIso(), (id) => allegatiArchivio(id).length).filter((s) => s.colore === 'rosso' || s.scadenza);
  if (!urg.length) return '';
  return `<h2>Documenti e certificati</h2><div class="lista">${urg.slice(0, 3).map((s) => cardArchivio(s.voce)).join('')}</div>
    ${urg.length > 3 ? `<a class="btn btn--secondario" href="#/archivio">Vedi tutti (${urg.length})</a>` : ''}`;
}

/** Documenti in archivio collegati a un lavoratore o a una macchina. */
function bloccoArchivioCollegati(campo, id, nuovoHref, titolo) {
  const voci = archivioAttuale(stato.archivio).filter((r) => r[campo] === id);
  return `<h2>${esc(titolo)}</h2>
    ${voci.length ? `<div class="lista">${voci.map(cardArchivio).join('')}</div>` : '<p class="nota">Nessun documento in archivio.</p>'}
    <a class="btn btn--secondario" href="${esc(nuovoHref)}">Aggiungi un documento</a>`;
}

// ---------- partenza rapida per settore ----------

const normalizza = (t) => String(t || '').trim().toLowerCase();

/** Esempi tipici per il lavoro dell'impresa (attività scelta o settore suggerito dal codice ATECO). */
function pacchettoSettore() {
  const chiave = risposte().attivita || ctx().fatti.ateco?.settore || 'altro';
  return stato.settori?.settori?.[chiave] || stato.settori?.settori?.altro || { attrezzature: [], prodotti: [], mansioni: [] };
}

async function schermataPartenza() {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const pacc = pacchettoSettore();
  const giaAttr = new Set(stato.attrezzature.filter((a) => !a.deleted).map((a) => normalizza(a.nome)));
  const giaProd = new Set(stato.prodotti.filter((p) => !p.deleted).map((p) => normalizza(p.nome)));
  const attr = pacc.attrezzature.filter((a) => !giaAttr.has(normalizza(a.nome)));
  const prod = risposte().chimici ? pacc.prodotti.filter((p) => !giaProd.has(normalizza(p.nome))) : [];
  const voce = (gruppo, i, titolo, sotto) => `<label class="spunta"><input type="checkbox" name="${gruppo}" value="${i}"><span class="spunta__testo">${esc(titolo)}${sotto ? `<small>${esc(sotto)}</small>` : ''}</span></label>`;
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="#/">‹ Oggi</a>
      <h1>Parti più in fretta</h1>
      <p class="lead">Queste sono le attrezzature${prod.length ? ' e i prodotti' : ''} più comuni nel tuo lavoro. Spunta solo quelli che usi davvero: li aggiungiamo in un colpo e poi completi i dati con calma.</p>
      <form id="partenza">
        ${attr.length ? `<fieldset class="spunte"><legend>Macchine e attrezzature</legend>${attr.map((a, i) => voce('attr', i, a.nome, tipoAttrezzatura(stato.defAttr, a.tipo)?.etichetta)).join('')}</fieldset>` : ''}
        ${prod.length ? `<fieldset class="spunte"><legend>Prodotti chimici</legend>${prod.map((p, i) => voce('prod', i, p.nome, p.uso)).join('')}</fieldset>` : ''}
        ${attr.length || prod.length ? '<button class="btn btn--primario btn--grande" type="submit">Aggiungi quelli spuntati</button>' : '<p>Hai già inserito tutti gli esempi del tuo settore.</p>'}
      </form>
      ${pacc.mansioni.length ? `<p class="nota">Quando inserisci un lavoratore ti suggeriremo le mansioni tipiche: ${esc(pacc.mansioni.join(', '))}.</p>` : ''}
    </section>`;
  app.querySelector('#partenza').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const sceltiA = f.getAll('attr').map((i) => attr[Number(i)]);
    const sceltiP = f.getAll('prod').map((i) => prod[Number(i)]);
    if (!sceltiA.length && !sceltiP.length) return avviso('Spunta almeno una voce.');
    for (const a of sceltiA) await store.salva('attrezzature', { tipo: a.tipo, nome: a.nome, marcaturaCE: true });
    for (const p of sceltiP) await store.salva('prodotti', { nome: p.nome, uso: p.uso, pittogrammi: [] });
    await ricarica();
    avviso(`Aggiunte ${sceltiA.length + sceltiP.length} voci. Ora completa marca, matricola e schede di sicurezza.`);
    location.hash = sceltiA.length ? '#/attrezzature' : '#/prodotti';
  });
}

// ---------- firma sul telefono ----------

/** Riquadro per firmare con il dito o con la penna. Restituisce l'immagine PNG (data URL) o null. */
function chiediFirma(chi) {
  return new Promise((risolvi) => {
    const d = document.createElement('dialog');
    d.className = 'firma';
    d.innerHTML = `<form method="dialog">
        <h2>Firma${chi ? ` di ${esc(chi)}` : ''}</h2>
        <p class="nota">Firma nel riquadro con il dito o con la penna.</p>
        <canvas class="firma__tela" width="600" height="260" aria-label="Riquadro per la firma"></canvas>
        <div class="firma__azioni">
          <button class="btn btn--testo" type="button" data-azione="cancella">Cancella</button>
          <button class="btn btn--secondario" value="annulla">Annulla</button>
          <button class="btn btn--primario" value="ok" disabled>Conferma</button>
        </div></form>`;
    document.body.append(d);
    const tela = d.querySelector('canvas');
    const g = tela.getContext('2d');
    const ok = d.querySelector('[value="ok"]');
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#111';
    let disegna = false;
    let tratti = 0;
    const punto = (e) => {
      const r = tela.getBoundingClientRect();
      return [((e.clientX - r.left) * tela.width) / r.width, ((e.clientY - r.top) * tela.height) / r.height];
    };
    tela.addEventListener('pointerdown', (e) => {
      disegna = true;
      tela.setPointerCapture(e.pointerId);
      g.beginPath();
      g.moveTo(...punto(e));
      e.preventDefault();
    });
    tela.addEventListener('pointermove', (e) => {
      if (!disegna) return;
      g.lineTo(...punto(e));
      g.stroke();
      tratti++;
      ok.disabled = tratti < 5;
    });
    const fine = () => (disegna = false);
    tela.addEventListener('pointerup', fine);
    tela.addEventListener('pointercancel', fine);
    d.querySelector('[data-azione="cancella"]').addEventListener('click', () => {
      g.clearRect(0, 0, tela.width, tela.height);
      tratti = 0;
      ok.disabled = true;
    });
    d.addEventListener('close', () => {
      const risultato = d.returnValue === 'ok' ? tela.toDataURL('image/png') : null;
      d.remove();
      risolvi(risultato);
    });
    d.showModal();
  });
}

/** Aggiunge i pulsanti di firma al documento e il salvataggio della copia firmata. */
function attivaFirme({ modello, lavoratore, requisito, registro }) {
  const barra = app.querySelector('#barra-firma');
  let firmate = new Set();
  const collega = () => {
    const caselle = [...app.querySelectorAll('.doc .doc__firme > div')];
    firmate = new Set();
    barra.hidden = true;
    caselle.forEach((casella, i) => {
      const chi = casella.querySelector('.doc__nome')?.textContent.trim();
      const ruolo = casella.querySelector('p')?.textContent.trim();
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn--secondario btn--piccolo solo-schermo';
      b.textContent = 'Firma qui';
      b.addEventListener('click', async () => {
        const png = await chiediFirma(chi && chi !== ' ' ? chi : ruolo);
        if (!png) return;
        casella.querySelector('.doc__firma')?.remove();
        const img = Object.assign(document.createElement('img'), { src: png, alt: `Firma: ${ruolo || ''}`, className: 'doc__firma' });
        casella.querySelector('.doc__linea').before(img);
        firmate.add(i);
        b.textContent = 'Firma di nuovo';
        barra.hidden = false;
        barra.querySelector('span').textContent = `${firmate.size} di ${caselle.length} firme`;
      });
      casella.append(b);
    });
  };
  collega();
  barra.querySelector('button').addEventListener('click', async () => {
    await stato.attesaAllegati;
    const copia = app.querySelector('.doc').cloneNode(true);
    copia.querySelectorAll('.solo-schermo').forEach((x) => x.remove());
    const css = await fetch('css/style.css').then((r) => r.text()).catch(() => '');
    const quando = new Date().toLocaleString('it-IT');
    const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(modello.titolo)}</title><style>${css}</style></head>
      <body><main class="pagina pagina--doc"><article class="doc">${copia.innerHTML}<p class="doc__nota">Firmato su safetyDoc il ${esc(quando)}.</p></article></main></body></html>`;
    const file = new Blob([html], { type: 'text/html' });
    const nome = `${modello.titolo}${lavoratore ? ` - ${nomeCompleto(lavoratore)}` : ''} (firmato ${oggiIso()}).html`;
    let tipo = 'documento';
    let id = lavoratore ? `${modello.id}:${lavoratore.id}` : modello.id;
    if (lavoratore && requisito) {
      // La firma vale come registrazione del requisito (consegna DPI, informativa, autorizzazione).
      const oggiReg = registro?.data === oggiIso() ? registro : null;
      const r = oggiReg || (await store.salva('registri', { lavoratoreId: lavoratore.id, requisitoId: requisito.id, data: oggiIso(), dettagli: registro?.dettagli || '', note: 'Firmato su safetyDoc' }));
      tipo = 'registro';
      id = r.id;
    }
    await store.salva('allegati', { collegatoTipo: tipo, collegatoId: id, nome, tipo: 'text/html', dimensione: file.size, file });
    await ricarica();
    // La firma di un documento dell'impresa con revisione periodica ne fissa la data (la precedente va nello storico).
    const datato = !lavoratore && (await registraDataDocumento(modello.id, oggiIso()));
    registraUso('firma', modello.id);
    avviso(requisito && lavoratore ? `Documento firmato salvato: «${requisito.titolo}» è registrato a oggi.` : datato ? 'Documento firmato salvato con la data di oggi: la prossima revisione è nello scadenzario.' : 'Documento firmato salvato.');
    instrada();
  });
  return { ricollega: collega };
}

// ---------- prodotti chimici ----------

const numeroAllegati = (tipo, id) => stato.allegati.filter((a) => !a.deleted && a.collegatoTipo === tipo && a.collegatoId === id).length;
const situazioniProdotti = () => prodottiAttivi(stato.prodotti).map((p) => situazioneProdotto(p, numeroAllegati('prodotto', p.id)));

function bloccoProdottiOggi() {
  if (!risposte().chimici) return '';
  const sit = situazioniProdotti();
  const daFare = sit.filter((x) => x.colore !== 'verde');
  if (sit.length && !daFare.length) return '';
  return `<h2>Prodotti chimici</h2>
    <p>${sit.length ? `${daFare.length} ${daFare.length === 1 ? 'prodotto richiede' : 'prodotti richiedono'} attenzione.` : 'Fai l\'elenco dei prodotti che usi e allega le schede di sicurezza.'}</p>
    <a class="btn btn--secondario" href="#/prodotti">${sit.length ? 'Vedi i prodotti' : 'Inizia l\'elenco dei prodotti'}</a>`;
}

function cardProdotto(x) {
  const e = ETICHETTE[x.colore];
  return `<a class="voce voce--${x.colore}" href="#/prodotto/${esc(x.prodotto.id)}">
    <span class="voce__segno" aria-hidden="true">${e.icona}</span>
    <span class="voce__testo"><span class="voce__titolo">${esc(x.prodotto.nome)}</span>
    <span class="voce__stato">${esc(x.motivo)}${x.prodotto.uso ? ` · ${esc(x.prodotto.uso)}` : ''}</span></span>
    <span class="voce__freccia" aria-hidden="true">›</span></a>`;
}

async function schermataProdotti() {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const ordine = { rosso: 0, giallo: 1, verde: 2 };
  const sit = situazioniProdotti().sort((a, b) => ordine[a.colore] - ordine[b.colore] || a.prodotto.nome.localeCompare(b.prodotto.nome, 'it'));
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="#/scheda/schede-sicurezza">‹ Cosa devi fare</a>
      <h1>Prodotti chimici</h1>
      <p class="lead">Vernici, solventi, colle, detergenti, oli, gas, prodotti per capelli o per la pulizia: per ognuno serve la scheda di sicurezza del fornitore.</p>
      ${sit.length ? `<div class="lista">${sit.map(cardProdotto).join('')}</div>` : '<p>Non hai ancora inserito nessun prodotto.</p>'}
      <a class="btn btn--primario btn--grande" href="#/prodotto/nuovo">Aggiungi un prodotto</a>
      <a class="btn btn--secondario" href="#/partenza">Scegli tra quelli tipici del tuo lavoro</a>
      ${sit.length ? `<a class="btn btn--secondario" href="#/documento/elenco-prodotti-chimici">Stampa l'elenco</a>` : ''}
    </section>`;
}

async function schermataProdotto(id) {
  const nuovo = id === 'nuovo';
  const p = nuovo ? { pittogrammi: [] } : stato.prodotti.find((x) => x.id === id && !x.deleted);
  if (!p) return (location.hash = '#/prodotti');
  const sit = nuovo ? null : situazioneProdotto(p, numeroAllegati('prodotto', p.id));
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="#/prodotti">‹ Prodotti chimici</a>
      ${sit ? `<p class="pill pill--${sit.colore}"><span aria-hidden="true">${ETICHETTE[sit.colore].icona}</span> ${esc(sit.motivo)}</p>` : ''}
      <h1>${nuovo ? 'Nuovo prodotto' : esc(p.nome)}</h1>
      ${sit?.cmr.length ? `<p class="esito esito--errore">Questo prodotto può causare tumori, danni genetici o alla fertilità (${esc(sit.cmr.join(', '))}). Chiedi al tuo RSPP se puoi sostituirlo; se no, servono misure specifiche e il registro degli esposti. <a href="#/scheda/cancerogeni">Scopri di più</a></p>` : ''}
      <form id="prodotto">
        <label>Nome commerciale<input class="campo" name="nome" required value="${esc(p.nome || '')}"></label>
        <label>Fornitore<input class="campo" name="fornitore" value="${esc(p.fornitore || '')}"></label>
        <label>A cosa serve <small>(es. «sgrassatore per officina», «tinta per capelli»)</small><input class="campo" name="uso" value="${esc(p.uso || '')}"></label>
        <fieldset class="spunte"><legend>Pittogrammi sull'etichetta <small>(i rombi rossi)</small></legend>
          ${PITTOGRAMMI.map((g) => `<label class="spunta"><input type="checkbox" name="pittogrammi" value="${g.id}" ${(p.pittogrammi || []).includes(g.id) ? 'checked' : ''}><span>${esc(g.etichetta)}</span></label>`).join('')}
        </fieldset>
        <label>Frasi H <small>(sezione 2 della scheda, es. «H225 H319 H350»)</small><input class="campo" name="frasiH" value="${esc(p.frasiH || '')}"></label>
        <label>DPI indicati <small>(sezione 8: guanti, maschera, occhiali)</small><input class="campo" name="dpi" value="${esc(p.dpi || '')}"></label>
        <label>Data della scheda di sicurezza <small>(in alto o in fondo alla scheda)</small><input class="campo" type="date" name="dataSds" max="${oggiIso()}" value="${esc(p.dataSds || '')}"></label>
        ${campoAllegato('prodotto')}
        ${nuovo ? '' : `<label class="spunta-semplice"><input type="checkbox" name="dismesso" ${p.dismesso ? 'checked' : ''}> Non lo uso più</label>`}
        <button class="btn btn--primario btn--grande" type="submit">Salva</button>
        ${nuovo ? '' : '<button class="btn btn--testo" type="button" id="elimina">Elimina</button>'}
      </form>
      ${nuovo ? '' : `<h2>Scheda di sicurezza e foto</h2>${elencoAllegatiDettaglio('prodotto', p.id) || '<p>Nessun documento allegato: fotografa la scheda o allega il PDF.</p>'}`}
    </section>`;
  if (!nuovo) attivaAllegati(() => schermataProdotto(id));
  app.querySelector('#prodotto').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const salvato = await store.salva('prodotti', {
      ...p,
      nome: String(f.get('nome') || '').trim(),
      fornitore: String(f.get('fornitore') || '').trim(),
      uso: String(f.get('uso') || '').trim(),
      pittogrammi: f.getAll('pittogrammi'),
      frasiH: String(f.get('frasiH') || '').trim().toUpperCase(),
      dpi: String(f.get('dpi') || '').trim(),
      dataSds: f.get('dataSds') || null,
      dismesso: f.get('dismesso') === 'on'
    });
    await salvaAllegatiDa(ev.target, 'prodotto', salvato.id);
    await ricarica();
    avviso('Prodotto salvato.');
    if (nuovo || salvato.dismesso) location.hash = '#/prodotti';
    else schermataProdotto(salvato.id);
  });
  app.querySelector('#elimina')?.addEventListener('click', async () => {
    if (!confirm(`Eliminare ${p.nome}? Se non lo usi più, è meglio segnarlo come non più usato.`)) return;
    await store.elimina('prodotti', p);
    await ricarica();
    location.hash = '#/prodotti';
  });
}

// ---------- infortuni e quasi incidenti ----------

function bloccoEventiOggi() {
  if (!haDipendenti()) return '';
  const urg = urgenzeEventi(stato.eventi, oggiIso());
  if (!urg.length) return '';
  return `<h2>Infortuni e quasi incidenti</h2><div class="lista">${urg.slice(0, 3).map(cardEvento).join('')}</div>`;
}

function cardEvento(x) {
  const e = ETICHETTE[x.colore];
  const ev = x.evento;
  const tipo = { infortunio: 'Infortunio', medicazione: 'Medicazione', quasi_incidente: 'Quasi incidente' }[ev.tipo];
  return `<a class="voce voce--${x.colore}" href="#/evento/${esc(ev.id)}">
    <span class="voce__segno" aria-hidden="true">${e.icona}</span>
    <span class="voce__testo"><span class="voce__titolo">${esc(tipo)} del ${esc(dataLeggibile(ev.data))}${ev.luogo ? ` · ${esc(ev.luogo)}` : ''}</span>
    <span class="voce__stato">${esc(x.motivo)}${x.scadenza ? ` · entro il ${esc(dataLeggibile(x.scadenza))}` : ''}</span></span>
    <span class="voce__freccia" aria-hidden="true">›</span></a>`;
}

async function schermataEventi() {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const sit = eventiAttivi(stato.eventi).map((e) => situazioneEvento(e, oggiIso()));
  const conta = (t) => sit.filter((x) => x.evento.tipo === t).length;
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="#/scheda/registro-eventi">‹ Cosa devi fare</a>
      <h1>Infortuni e quasi incidenti</h1>
      <p class="lead">Annota anche le volte in cui «poteva andare male»: sono gli avvertimenti che evitano l'infortunio vero.</p>
      ${sit.length ? `<p>${conta('infortunio')} infortuni · ${conta('medicazione')} medicazioni · ${conta('quasi_incidente')} quasi incidenti</p><div class="lista">${sit.map(cardEvento).join('')}</div>` : '<p>Nessun evento registrato.</p>'}
      <a class="btn btn--primario btn--grande" href="#/evento/nuovo">Registra un evento</a>
      ${sit.length ? `<a class="btn btn--secondario" href="#/documento/registro-eventi">Stampa il registro</a>` : ''}
    </section>`;
}

async function schermataEvento(id) {
  const nuovo = id === 'nuovo';
  const ev = nuovo ? { tipo: 'quasi_incidente', data: oggiIso() } : stato.eventi.find((x) => x.id === id && !x.deleted);
  if (!ev) return (location.hash = '#/eventi');
  const sit = nuovo ? null : situazioneEvento(ev, oggiIso());
  const lav = attivi();
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="#/eventi">‹ Registro</a>
      ${sit ? `<p class="pill pill--${sit.colore}"><span aria-hidden="true">${ETICHETTE[sit.colore].icona}</span> ${esc(sit.motivo)}${sit.scadenza ? ` · entro il ${esc(dataLeggibile(sit.scadenza))}` : ''}</p>` : ''}
      <h1>${nuovo ? 'Registra un evento' : 'Evento del ' + esc(dataLeggibile(ev.data))}</h1>
      <form id="evento">
        <fieldset class="scelte-radio"><legend>Che cosa è successo?</legend>
          ${Object.entries(TIPI_EVENTO).map(([k, et]) => `<label class="spunta"><input type="radio" name="tipo" value="${k}" ${ev.tipo === k ? 'checked' : ''}><span>${esc(et)}</span></label>`).join('')}
        </fieldset>
        <label>Data<input class="campo" type="date" name="data" required max="${oggiIso()}" value="${esc(ev.data || '')}"></label>
        <label>Dove <small>(reparto, cantiere, mezzo)</small><input class="campo" name="luogo" value="${esc(ev.luogo || '')}"></label>
        ${
          lav.length
            ? `<label>Lavoratore coinvolto <small>(facoltativo)</small><select class="campo" name="lavoratoreId"><option value="">Nessuno o non indicato</option>${lav
                .map((l) => `<option value="${esc(l.id)}" ${ev.lavoratoreId === l.id ? 'selected' : ''}>${esc(nomeCompleto(l))}</option>`)
                .join('')}</select></label>`
            : ''
        }
        <label>Cosa è successo <small>(la dinamica, non la lesione)</small><textarea class="campo" name="descrizione" rows="3">${esc(ev.descrizione || '')}</textarea></label>
        <label>Perché è successo <small>(attrezzatura, procedura, fretta, formazione, ordine)</small><textarea class="campo" name="causa" rows="2">${esc(ev.causa || '')}</textarea></label>
        <div id="campi-infortunio">
          <label>Giorni di prognosi sul certificato medico <small>(escluso il giorno dell'infortunio)</small><input class="campo" type="number" inputmode="numeric" min="0" max="999" name="giorniPrognosi" value="${esc(ev.giorniPrognosi ?? '')}"></label>
          <label>Data in cui hai ricevuto il certificato<input class="campo" type="date" name="dataCertificato" data-dopo="data" max="${oggiIso()}" value="${esc(ev.dataCertificato || '')}"></label>
          <label>Data della denuncia o comunicazione all'INAIL<input class="campo" type="date" name="dataDenuncia" data-dopo="data" max="${oggiIso()}" value="${esc(ev.dataDenuncia || '')}"></label>
          <p class="riquadro">Prognosi oltre 3 giorni: denuncia telematica all'INAIL entro 2 giorni dal certificato. Da 1 a 3 giorni: comunicazione a fini statistici. Morte o pericolo di morte: entro 24 ore. Non scrivere qui diagnosi o lesioni.</p>
        </div>
        <label>Cosa fai perché non si ripeta<textarea class="campo" name="misure" rows="2">${esc(ev.misure || '')}</textarea></label>
        <label class="spunta-semplice"><input type="checkbox" name="misureFatte" ${ev.misureFatte ? 'checked' : ''}> La misura è stata fatta</label>
        ${campoAllegato()}
        <button class="btn btn--primario btn--grande" type="submit">Salva</button>
        ${nuovo ? '' : '<button class="btn btn--testo" type="button" id="elimina">Elimina</button>'}
      </form>
      ${nuovo ? '' : `<h2>Documenti e foto</h2>${elencoAllegati('evento', ev.id) || '<p>Nessun documento allegato.</p>'}`}
      ${nuovo ? '' : '<p class="nota">Dopo un infortunio significativo il DVR va rivisto: <a href="#/scheda/dvr">apri la voce DVR</a>.</p>'}
    </section>`;
  if (!nuovo) attivaAllegati(() => schermataEvento(id));
  const form = app.querySelector('#evento');
  const aggiorna = () => (app.querySelector('#campi-infortunio').hidden = form.querySelector('input[name="tipo"]:checked')?.value !== 'infortunio');
  form.querySelectorAll('input[name="tipo"]').forEach((r) => r.addEventListener('change', aggiorna));
  aggiorna();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const tipo = f.get('tipo');
    const infortunio = tipo === 'infortunio';
    const salvato = await store.salva('eventi', {
      ...ev,
      tipo,
      data: f.get('data'),
      luogo: String(f.get('luogo') || '').trim(),
      lavoratoreId: f.get('lavoratoreId') || null,
      descrizione: String(f.get('descrizione') || '').trim(),
      causa: String(f.get('causa') || '').trim(),
      giorniPrognosi: infortunio && f.get('giorniPrognosi') !== '' ? Number(f.get('giorniPrognosi')) : null,
      dataCertificato: infortunio ? f.get('dataCertificato') || null : null,
      dataDenuncia: infortunio ? f.get('dataDenuncia') || null : null,
      misure: String(f.get('misure') || '').trim(),
      misureFatte: f.get('misureFatte') === 'on'
    });
    await salvaAllegatiDa(form, 'evento', salvato.id);
    await ricarica();
    avviso('Evento salvato.');
    location.hash = '#/eventi';
  });
  app.querySelector('#elimina')?.addEventListener('click', async () => {
    if (!confirm('Eliminare questo evento dal registro?')) return;
    await store.elimina('eventi', ev);
    await ricarica();
    location.hash = '#/eventi';
  });
}

// ---------- controllo iniziale ----------

// Il giro tiene fermo l'elenco delle voci mentre l'utente risponde (le voci segnate escono dal piano).
let giro = null;

async function schermataControlloIniziale(indiceTesto) {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const i = Math.max(0, Number(indiceTesto) || 0);
  if (!giro || i === 0) giro = { ids: vociControlloIniziale(piano()).map((v) => v.scheda.id), esiti: giro && i > 0 ? giro.esiti : {} };
  if (i === 0) giro.esiti = {};
  const totale = giro.ids.length;
  if (i >= totale) return fineControlloIniziale();

  const id = giro.ids[i];
  const scheda = stato.catalogo.schede.find((x) => x.id === id);
  const st = stato.adempimenti.find((x) => x.schedaId === id && !x.deleted);
  const conScadenza = scheda.tipoScadenza === 'manuale' || (scheda.tipoScadenza === 'periodica' && !periodicitaPer(scheda, ctx()));
  const mese = oggiIso().slice(0, 7);
  const percento = Math.round((i / totale) * 100);
  const vai = (n) => (location.hash = `#/controllo-iniziale/${n}`);

  app.innerHTML = `
    <section class="pagina domanda">
      <div class="progresso" role="progressbar" aria-valuemin="0" aria-valuemax="${totale}" aria-valuenow="${i + 1}" aria-label="Domanda ${i + 1} di ${totale}">
        <div style="width:${percento}%"></div>
      </div>
      <p class="sopratitolo">Controllo veloce · ${i + 1} di ${totale}</p>
      <h1>Hai già fatto questo? ${esc(scheda.titolo)}</h1>
      <p class="aiuto">${esc(scheda.cosaE)}</p>
      <div class="scelte" id="risposte">
        <button class="scelta" id="si"><span class="scelta__titolo">Sì, è già fatto</span></button>
        <button class="scelta" id="no"><span class="scelta__titolo">No, non ancora</span></button>
        <button class="scelta" id="nonso"><span class="scelta__titolo">Non lo so</span><span class="scelta__aiuto">La segniamo da controllare con chi ti aiuta</span></button>
      </div>
      <form id="quando" hidden>
        <fieldset class="data-mese"><legend>Quando, più o meno? <small>(va bene anche approssimativo)</small></legend>
          <label>Mese<select class="campo" name="meseN"><option value="">Non ricordo</option>${MESI.map((nm, k) => `<option value="${k + 1}" ${Number(st?.dataFatto?.slice(5, 7)) === k + 1 ? 'selected' : ''}>${nm}</option>`).join('')}</select></label>
          <label>Anno<select class="campo" name="anno" required><option value="">Scegli…</option>${Array.from({ length: 41 }, (_, k) => Number(mese.slice(0, 4)) - k)
            .map((y) => `<option value="${y}" ${Number(st?.dataFatto?.slice(0, 4)) === y ? 'selected' : ''}>${y}</option>`)
            .join('')}</select></label>
        </fieldset>
        ${
          conScadenza
            ? `<label>Quando scade? <small>(se è scritto sull'attestato o sul documento; altrimenti lascia vuoto)</small>
          <input class="campo" type="date" name="scadenza" value="${esc(st?.scadenzaManuale || '')}"></label>`
            : ''
        }
        <button class="btn btn--primario btn--grande" type="submit">Salva e vai avanti</button>
        <p class="nota">Potrai correggere la data esatta e allegare l'attestato aprendo la voce dal piano.</p>
      </form>
      <div class="azioni">
        ${i > 0 ? `<a class="btn btn--secondario" href="#/controllo-iniziale/${i - 1}">Indietro</a>` : '<a class="btn btn--secondario" href="#/">Esci</a>'}
        <a class="btn btn--testo" href="#/controllo-iniziale/${totale}">Salta il resto</a>
      </div>
    </section>`;

  const form = app.querySelector('#quando');
  app.querySelector('#si').addEventListener('click', () => {
    app.querySelector('#risposte').hidden = true;
    form.hidden = false;
    form.querySelector('select').focus();
  });
  app.querySelector('#no').addEventListener('click', () => {
    giro.esiti[id] = 'no';
    vai(i + 1);
  });
  app.querySelector('#nonso').addEventListener('click', () => {
    giro.esiti[id] = 'nonso';
    vai(i + 1);
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    const anno = f.get('anno');
    if (!anno) return avviso('Scegli almeno l\'anno.');
    const dataFatto = dataDaMese(`${anno}-${String(f.get('meseN') || 1).padStart(2, '0')}`);
    if (dataFatto > oggiIso()) return avviso('La data non può essere nel futuro.');
    await store.salvaAdempimento({
      ...(st || {}),
      schedaId: id,
      fatto: true,
      dataFatto,
      scadenzaManuale: f.get('scadenza') || st?.scadenzaManuale || null,
      note: st?.note || 'Data indicativa inserita nel controllo veloce.'
    });
    giro.esiti[id] = 'si';
    await ricarica();
    vai(i + 1);
  });
}

function fineControlloIniziale() {
  const esiti = giro?.esiti || {};
  const quanti = (e) => Object.values(esiti).filter((x) => x === e).length;
  const nonSo = piano().filter((v) => esiti[v.scheda.id] === 'nonso');
  giro = null;
  app.innerHTML = `
    <section class="pagina">
      <p class="sopratitolo">Controllo veloce</p>
      <h1>Fatto, grazie!</h1>
      <div class="contatori" role="list">
        <span role="listitem" class="contatore contatore--verde"><strong>${quanti('si')}</strong><span>già fatte</span></span>
        <span role="listitem" class="contatore contatore--rosso"><strong>${quanti('no')}</strong><span>da fare</span></span>
        <span role="listitem" class="contatore contatore--giallo"><strong>${nonSo.length}</strong><span>da chiarire</span></span>
      </div>
      ${
        nonSo.length
          ? `<h2>Da chiarire</h2><p>Per queste voci non sai se sono state fatte. Cerca i documenti in ufficio, oppure chiedi al tuo consulente.</p>
             <div class="lista">${nonSo.map(cardVoce).join('')}</div>
             ${bloccoAiuto(`capire se ho già fatto: ${nonSo.map((v) => v.scheda.titolo).join(', ')}`)}`
          : ''
      }
      <a class="btn btn--primario btn--grande" href="#/">Vai a cosa fare adesso</a>
    </section>`;
}

// ---------- classe di rischio ----------

function notaClasseRischio() {
  const f = ctx().fatti;
  if (f.ateco) {
    return `<div class="riquadro"><p><strong>La tua attività:</strong> ATECO ${esc(f.ateco.codice)} – ${esc(f.ateco.descrizione)}.</p>
      <p>Rischio <strong>${esc(f.classeRischio)}</strong>: la formazione specifica dei lavoratori è di <strong>${esc(String(f.oreFormazioneSpecifica))} ore</strong>, oltre alle 4 ore di formazione generale.</p>
      <p class="nota">${esc(stato.ateco.avvertenza)}</p></div>`;
  }
  if (f.fonteClasse === 'attivita' && f.oreFormazioneSpecifica) {
    return `<div class="riquadro"><p>Per il settore che hai scelto il rischio è di solito <strong>${esc(f.classeRischio)}</strong> (formazione specifica di ${esc(String(f.oreFormazioneSpecifica))} ore).</p>
      <p><a href="#/domanda/1">Inserisci il codice ATECO</a> per avere l'indicazione esatta.</p></div>`;
  }
  return `<div class="riquadro"><p>Le ore di formazione specifica dipendono dal codice ATECO. <a href="#/domanda/1">Inseriscilo qui</a>.</p></div>`;
}

// ---------- collegamenti dalle schede ----------

const STRUMENTI_SCHEDA = {
  'schede-sicurezza': ['#/prodotti', 'Apri l\'elenco dei prodotti chimici'],
  'rischio-chimico': ['#/prodotti', 'Apri l\'elenco dei prodotti chimici'],
  cancerogeni: ['#/prodotti', 'Apri l\'elenco dei prodotti chimici'],
  'registro-eventi': ['#/eventi', 'Apri il registro di infortuni e quasi incidenti'],
  infortuni: ['#/evento/nuovo', 'Registra un infortunio o un quasi incidente']
};

function collegamentiScheda(id) {
  const parti = [];
  if (STRUMENTI_SCHEDA[id]) parti.push(`<a class="btn btn--primario" href="${STRUMENTI_SCHEDA[id][0]}">${STRUMENTI_SCHEDA[id][1]}</a>`);
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
      ${bloccoArchivioCollegati('lavoratoreId', l.id, `#/archivio-voce/nuovo/certificato/lav:${l.id}`, 'Altri attestati, abilitazioni e patenti')}
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
          <input class="campo" name="mansione" list="mansioni-tipiche" value="${esc(l.mansione || '')}"></label>
        <datalist id="mansioni-tipiche">${pacchettoSettore().mansioni.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
        <label>Data di assunzione<input class="campo" type="date" name="dataAssunzione" value="${esc(l.dataAssunzione || '')}"></label>
        <label>Lingua per le regole di sicurezza <small>(se non capisce bene l'italiano)</small>
          <select class="campo" name="lingua">${Object.entries(LINGUE)
            .map(([k, x]) => `<option value="${k}" ${(l.lingua || 'it') === k ? 'selected' : ''}>${esc(x.nome)}</option>`)
            .join('')}</select></label>
        <h2>Ruoli e lavori particolari</h2>
        <p class="aiuto">Tocca quelli che riguardano questa persona: aggiungono i corsi che le servono.</p>
        <div class="spunte">${ruoli
          .map(
            (r) => `<button type="button" class="spunta ${ha.has(r.id) ? 'spunta--attiva' : ''}" data-id="${esc(r.id)}" aria-pressed="${ha.has(r.id)}">
              <span class="spunta__box" aria-hidden="true"></span><span class="spunta__testo">${esc(r.etichetta)}</span></button>`
          )
          .join('')}</div>
        ${nuovo ? '' : `<label>Data di fine rapporto <small>(solo se non lavora più con te)</small><input class="campo" type="date" name="dataCessazione" data-dopo="dataAssunzione" value="${esc(l.dataCessazione || '')}"></label>`}
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
      lingua: f.get('lingua') || 'it',
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
      ${req.id === 'formazione-specifica' ? notaClasseRischio() : ''}
      ${scheda ? `<p><a href="#/scheda/${esc(scheda.id)}">Come si fa: ${esc(scheda.titolo)} ›</a></p>` : ''}
      <form class="registra" id="registra">
        <h2>Registra</h2>
        <label>Data<input class="campo" type="date" name="data" required max="${oggiIso()}" value="${oggiIso()}"></label>
        ${
          chiedeScadenza
            ? `<label>Prossima scadenza ${req.periodicitaMesi ? `<small>(se la lasci vuota la calcoliamo: ogni ${req.periodicitaMesi} mesi)</small>` : '<small>(scrivila dall\'attestato o da quanto indicato dal medico)</small>'}
          <input class="campo" type="date" name="scadenzaManuale" data-dopo="data"></label>`
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
        ${
          req.id === 'visita-medica'
            ? ''
            : `<label>Ente formatore o docente<input class="campo" name="ente" autocomplete="organization"></label>
        <label>Numero dell'attestato<input class="campo" name="numeroAttestato"></label>`
        }
        <label>Note <small>(dove trovi il documento originale)</small><textarea class="campo" name="note" rows="2"></textarea></label>
        ${campoAllegato()}
        <button class="btn btn--primario btn--grande" type="submit">Salva</button>
      </form>
      ${
        storico.length
          ? `<h2>Storico</h2><ul class="storico">${storico
              .map(
                (r) => `<li><strong>${dataLeggibile(r.data)}</strong>${r.scadenzaManuale ? ` · scadenza ${dataLeggibile(r.scadenzaManuale)}` : ''}${
                  r.esito ? ` · ${esc(ESITI_VISITA[r.esito])}` : ''
                }${r.ente || r.numeroAttestato ? `<br>${esc([r.ente, r.numeroAttestato ? `attestato n. ${r.numeroAttestato}` : ''].filter(Boolean).join(' · '))}` : ''}${r.dettagli ? `<br>${esc(r.dettagli)}` : ''}${r.note ? `<br><small>${esc(r.note)}</small>` : ''}
                ${req.modello ? `<br><a href="#/documento/${esc(req.modello)}/${esc(l.id)}">Stampa il documento</a>` : ''}
                ${elencoAllegati('registro', r.id)}
                <button class="btn btn--testo btn--piccolo" data-elimina="${esc(r.id)}" type="button">Elimina la registrazione</button></li>`
              )
              .join('')}</ul>`
          : ''
      }
    </section>`;

  app.querySelector('#registra').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const salvato = await store.salva('registri', {
      lavoratoreId: l.id,
      requisitoId: req.id,
      data: f.get('data'),
      scadenzaManuale: f.get('scadenzaManuale') || null,
      esito: f.get('esito') || null,
      dettagli: String(f.get('dettagli') || '').trim(),
      ente: String(f.get('ente') || '').trim(),
      numeroAttestato: String(f.get('numeroAttestato') || '').trim(),
      note: String(f.get('note') || '').trim()
    });
    await salvaAllegatiDa(ev.target, 'registro', salvato.id);
    await ricarica();
    avviso('Salvato.');
    schermataRegistro(lavId, reqId);
  });
  attivaAllegati(() => schermataRegistro(lavId, reqId));
  for (const b of app.querySelectorAll('[data-elimina]')) {
    b.addEventListener('click', async () => {
      if (!confirm('Eliminare questa registrazione?')) return;
      await store.elimina('registri', storico.find((r) => r.id === b.dataset.elimina));
      await ricarica();
      schermataRegistro(lavId, reqId);
    });
  }
}

// ---------- macchine e attrezzature ----------

function bloccoMacchineOggi() {
  const lista = macchine();
  if (!lista.length) {
    return `<h2>Macchine e attrezzature</h2>
      <p>Inserisci scale, utensili, macchine e mezzi: ti ricorderemo manutenzioni e verifiche obbligatorie.</p>
      <a class="btn btn--primario" href="#/partenza">Scegli quelle tipiche del tuo lavoro</a>
      <a class="btn btn--secondario" href="#/attrezzatura-modifica/nuova">Aggiungi una macchina o attrezzatura</a>`;
  }
  const urg = urgenzeAttrezzature({ attrezzature: stato.attrezzature, defAttr: stato.defAttr, controlli: stato.controlli, ctx: ctx(), oggi: oggiIso() });
  return `<h2>Macchine e attrezzature</h2>
    <p>${urg.length ? `${urg.length} ${urg.length === 1 ? 'controllo da fare o in scadenza' : 'controlli da fare o in scadenza'}.` : `Tutte le ${lista.length} attrezzature sono in regola.`}</p>
    ${urg.length ? `<div class="lista">${urg.slice(0, 3).map(cardUrgenzaMacchina).join('')}</div>` : ''}
    <a class="btn btn--secondario" href="#/attrezzature">Vedi tutte le attrezzature</a>`;
}

function cardUrgenzaMacchina(u) {
  const e = ETICHETTE[u.colore];
  const scad = u.prossimaScadenza ? ` · ${dataLeggibile(u.prossimaScadenza)}` : '';
  return `<a class="voce voce--${u.colore}" href="#/controllo/${esc(u.attrezzatura.id)}/${esc(u.controllo.id)}">
      <span class="voce__segno" aria-hidden="true">${e.icona}</span>
      <span class="voce__testo"><span class="voce__titolo">${esc(u.attrezzatura.nome)}: ${esc(u.controllo.titolo)}</span>
      <span class="voce__stato">${esc(u.motivo)}${esc(scad)}</span></span>
      <span class="voce__freccia" aria-hidden="true">›</span></a>`;
}

async function schermataAttrezzature() {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const ordine = { rosso: 0, giallo: 1, verde: 2 };
  const sit = macchine().map(situazioneMacchina).sort((a, b) => ordine[a.colore] - ordine[b.colore] || (a.attrezzatura.nome || '').localeCompare(b.attrezzatura.nome || '', 'it'));
  app.innerHTML = `
    <section class="pagina">
      <h1>Macchine e attrezzature</h1>
      <p class="lead">Per ognuna: manutenzione, controlli e verifiche obbligatorie. Il semaforo ti dice cosa fare.</p>
      ${
        sit.length
          ? `<div class="lista">${sit
              .map((s) => {
                const e = ETICHETTE[s.colore];
                const testo = s.colore === 'verde' ? 'In regola' : [s.conteggi.rosso ? `${s.conteggi.rosso} da fare` : '', s.conteggi.giallo ? `${s.conteggi.giallo} in scadenza` : ''].filter(Boolean).join(' · ');
                return `<a class="voce voce--${s.colore}" href="#/attrezzatura/${esc(s.attrezzatura.id)}">
                  <span class="voce__segno" aria-hidden="true">${e.icona}</span>
                  <span class="voce__testo"><span class="voce__titolo">${esc(s.attrezzatura.nome)}</span>
                  <span class="voce__stato">${esc(s.tipo?.etichetta || '')} · ${esc(testo)}</span></span>
                  <span class="voce__freccia" aria-hidden="true">›</span></a>`;
              })
              .join('')}</div>`
          : '<p>Non hai ancora inserito nessuna attrezzatura.</p>'
      }
      <a class="btn btn--primario btn--grande" href="#/attrezzatura-modifica/nuova">Aggiungi una macchina o attrezzatura</a>
      <a class="btn btn--secondario" href="#/partenza">Scegli tra quelle tipiche del tuo lavoro</a>
      <p class="nota">Usa solo attrezzature con marcatura CE e libretto d'uso, e tienile in buono stato (artt. 70 e 71 del D.Lgs. 81/2008).</p>
    </section>`;
}

async function schermataAttrezzatura(id) {
  const a = stato.attrezzature.find((x) => x.id === id && !x.deleted);
  if (!a) return (location.hash = '#/attrezzature');
  const s = situazioneMacchina(a);
  const dettagli = [a.marcaModello, a.matricola ? `matricola ${a.matricola}` : '', a.annoFabbricazione ? `anno ${a.annoFabbricazione}` : ''].filter(Boolean).join(' · ');
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="#/attrezzature">‹ Attrezzature</a>
      <h1>${esc(a.nome)}</h1>
      <p class="lead">${esc(s.tipo?.etichetta || '')}${dettagli ? `<br><small>${esc(dettagli)}</small>` : ''}</p>
      ${a.marcaturaCE === false ? '<p class="esito esito--errore">Senza marcatura CE l\'attrezzatura va messa a norma (Allegato V del D.Lgs. 81/2008) o non va usata.</p>' : ''}
      ${s.tipo?.patentino ? '<p class="riquadro">Per usarla serve il patentino dell\'operatore: segnalalo nella scheda del lavoratore (ruolo «Usa piattaforme, gru, muletti…»).</p>' : ''}
      <h2>Controlli</h2>
      <div class="lista">${s.voci
        .map((v) => {
          const e = ETICHETTE[v.colore];
          const det = [v.registro ? `fatto il ${dataLeggibile(v.registro.data)}` : '', v.prossimaScadenza ? `scade il ${dataLeggibile(v.prossimaScadenza)}` : '', v.controllo.periodicitaMesi && v.controllo.tipoScadenza === 'periodica' ? `ogni ${v.controllo.periodicitaMesi} mesi` : '']
            .filter(Boolean)
            .join(' · ');
          return `<a class="voce voce--${v.colore}" href="#/controllo/${esc(a.id)}/${esc(v.controllo.id)}">
            <span class="voce__segno" aria-hidden="true">${e.icona}</span>
            <span class="voce__testo"><span class="voce__titolo">${esc(v.controllo.titolo)}</span><span class="voce__stato">${esc(v.motivo)}${det ? ` · ${esc(det)}` : ''}</span></span>
            <span class="voce__freccia" aria-hidden="true">›</span></a>`;
        })
        .join('')}</div>
      <h2>Pericoli e protezioni</h2>
      <form id="pericoli-macchina">
        <p class="nota">Li trovi nel libretto d'uso e manutenzione, nel capitolo sulla sicurezza. Finiscono nel DVR, nel POS e nei verbali di addestramento.${!a.pericoli ? ' Abbiamo spuntato quelli tipici di questo tipo di attrezzatura: correggili.' : ''}</p>
        <fieldset class="spunte spunte--compatte"><legend>Pericoli</legend>
          ${stato.defAttr.pericoli.map((x) => `<label class="spunta"><input type="checkbox" name="pericoli" value="${esc(x.id)}" ${(a.pericoli || s.tipo?.pericoli || []).includes(x.id) ? 'checked' : ''}><span>${esc(x.etichetta)}</span></label>`).join('')}
        </fieldset>
        <fieldset class="spunte spunte--compatte"><legend>DPI da usare</legend>
          ${stato.defAttr.dpi.map((x) => `<label class="spunta"><input type="checkbox" name="dpi" value="${esc(x)}" ${(a.dpi || s.tipo?.dpi || []).includes(x) ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}
        </fieldset>
        <label>Istruzioni di sicurezza principali <small>(dal libretto: controlli prima dell'uso, divieti, cosa fare in caso di guasto)</small>
          <textarea class="campo" name="istruzioni" rows="3">${esc(a.istruzioni || '')}</textarea></label>
        <button class="btn btn--secondario" type="submit">Salva pericoli e protezioni</button>
      </form>
      <h2>Libretto e documenti</h2>
      ${elencoAllegatiDettaglio('attrezzatura', a.id) || '<p>Nessun documento allegato. Carica il libretto d\'uso e manutenzione (PDF o foto delle pagine) e la dichiarazione CE.</p>'}
      <form id="documenti-macchina">${campoAllegato('attrezzatura')}<button class="btn btn--secondario" type="submit">Allega</button></form>
      ${bloccoArchivioCollegati('attrezzaturaId', a.id, `#/archivio-voce/nuovo/certificato/attr:${a.id}`, 'Collaudi, omologazioni e altri documenti con scadenza')}
      <a class="btn btn--secondario" href="#/attrezzatura-modifica/${esc(a.id)}">Modifica i dati</a>
    </section>`;
  attivaAllegati(() => schermataAttrezzatura(id));
  app.querySelector('#pericoli-macchina').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    await store.salva('attrezzature', { ...a, pericoli: f.getAll('pericoli'), dpi: f.getAll('dpi'), istruzioni: String(f.get('istruzioni') || '').trim() });
    await ricarica();
    avviso('Pericoli e protezioni salvati.');
  });
  app.querySelector('#documenti-macchina').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const n = await salvaAllegatiDa(ev.target, 'attrezzatura', a.id);
    await ricarica();
    if (n) avviso('Documento allegato.');
    schermataAttrezzatura(id);
  });
}

async function schermataModificaAttrezzatura(id) {
  const nuova = id === 'nuova';
  const a = nuova ? { marcaturaCE: true } : stato.attrezzature.find((x) => x.id === id && !x.deleted);
  if (!a) return (location.hash = '#/attrezzature');
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="${nuova ? '#/attrezzature' : `#/attrezzatura/${esc(a.id)}`}">‹ Indietro</a>
      <h1>${nuova ? 'Nuova attrezzatura' : `Modifica ${esc(a.nome)}`}</h1>
      <form id="attrezzatura">
        <label>Che cos'è?
          <select class="campo" name="tipo" required>
            <option value="">Scegli…</option>
            ${stato.defAttr.tipi.map((t) => `<option value="${esc(t.id)}" ${a.tipo === t.id ? 'selected' : ''}>${esc(t.etichetta)}</option>`).join('')}
          </select></label>
        <label>Nome per riconoscerla <small>(es. «Scala alluminio 3 m», «Flessibile Bosch»)</small>
          <input class="campo" name="nome" required value="${esc(a.nome || '')}"></label>
        <label>Marca e modello<input class="campo" name="marcaModello" value="${esc(a.marcaModello || '')}"></label>
        <label>Matricola o numero di serie<input class="campo" name="matricola" value="${esc(a.matricola || '')}"></label>
        <label>Anno di fabbricazione <small>(serve per alcune verifiche)</small>
          <input class="campo" name="annoFabbricazione" type="number" inputmode="numeric" min="1950" max="${oggiIso().slice(0, 4)}" value="${esc(a.annoFabbricazione || '')}"></label>
        <label>Ha la marcatura CE?
          <select class="campo" name="marcaturaCE">
            <option value="si" ${a.marcaturaCE !== false ? 'selected' : ''}>Sì</option>
            <option value="no" ${a.marcaturaCE === false ? 'selected' : ''}>No o non so</option>
          </select></label>
        ${nuova ? '' : `<label class="spunta-semplice"><input type="checkbox" name="dismessa" ${a.dismessa ? 'checked' : ''}> Non la uso più (dismessa o venduta)</label>`}
        <button class="btn btn--primario btn--grande" type="submit">Salva</button>
        ${nuova ? '' : '<button class="btn btn--testo" type="button" id="elimina">Elimina</button>'}
      </form>
    </section>`;
  app.querySelector('#attrezzatura').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const salvata = await store.salva('attrezzature', {
      ...a,
      tipo: f.get('tipo'),
      nome: String(f.get('nome') || '').trim(),
      marcaModello: String(f.get('marcaModello') || '').trim(),
      matricola: String(f.get('matricola') || '').trim(),
      annoFabbricazione: f.get('annoFabbricazione') ? Number(f.get('annoFabbricazione')) : null,
      marcaturaCE: f.get('marcaturaCE') !== 'no',
      dismessa: f.get('dismessa') === 'on'
    });
    await ricarica();
    avviso('Attrezzatura salvata.');
    location.hash = salvata.dismessa ? '#/attrezzature' : `#/attrezzatura/${salvata.id}`;
  });
  app.querySelector('#elimina')?.addEventListener('click', async () => {
    if (!confirm(`Eliminare ${a.nome}? Se non la usi più, è meglio segnarla come dismessa.`)) return;
    await store.elimina('attrezzature', a);
    await ricarica();
    location.hash = '#/attrezzature';
  });
}

async function schermataControllo(attrId, controlloId) {
  const a = stato.attrezzature.find((x) => x.id === attrId && !x.deleted);
  if (!a) return (location.hash = '#/attrezzature');
  const s = situazioneMacchina(a);
  const voce = s.voci.find((v) => v.controllo.id === controlloId);
  if (!voce) return (location.hash = `#/attrezzatura/${attrId}`);
  const c = voce.controllo;
  const storico = storicoControlli(a.id, c.id, stato.controlli);
  const e = ETICHETTE[voce.colore];
  const chiedeScadenza = c.tipoScadenza === 'manuale' || c.tipoScadenza === 'periodica';
  app.innerHTML = `
    <section class="pagina scheda">
      <a class="indietro" href="#/attrezzatura/${esc(a.id)}">‹ ${esc(a.nome)}</a>
      <p class="pill pill--${voce.colore}"><span aria-hidden="true">${e.icona}</span> ${esc(voce.motivo)}${voce.prossimaScadenza ? ` · ${dataLeggibile(voce.prossimaScadenza)}` : ''}</p>
      <h1>${esc(c.titolo)}</h1>
      ${c.aiuto ? `<p class="lead">${esc(c.aiuto)}</p>` : ''}
      ${c.id === 'verifica-periodica' ? `<p><a href="#/scheda/attrezzature-abilitazione">Come funzionano le verifiche ›</a></p>` : ''}
      <form class="registra" id="registra">
        <h2>Registra</h2>
        <label>Data<input class="campo" type="date" name="data" required max="${oggiIso()}" value="${oggiIso()}"></label>
        ${
          chiedeScadenza
            ? `<label>Prossima scadenza ${c.tipoScadenza === 'periodica' && c.periodicitaMesi ? `<small>(se la lasci vuota la calcoliamo: ogni ${c.periodicitaMesi} mesi)</small>` : '<small>(dal libretto, dal verbale o dalla ditta)</small>'}
          <input class="campo" type="date" name="scadenzaManuale" data-dopo="data"></label>`
            : ''
        }
        <label>Esito<select class="campo" name="esito"><option value="positivo">Tutto a posto</option><option value="con_interventi">Fatti interventi o riparazioni</option><option value="negativo">Non idonea: non usarla finché non è riparata</option></select></label>
        <label>Note <small>(chi l'ha fatto, numero del verbale)</small><textarea class="campo" name="note" rows="2"></textarea></label>
        ${campoAllegato()}
        <button class="btn btn--primario btn--grande" type="submit">Salva</button>
      </form>
      ${
        storico.length
          ? `<h2>Storico</h2><ul class="storico">${storico
              .map(
                (r) => `<li><strong>${dataLeggibile(r.data)}</strong>${r.scadenzaManuale ? ` · scadenza ${dataLeggibile(r.scadenzaManuale)}` : ''}${
                  r.esito === 'negativo' ? ' · <strong class="testo-rosso">non idonea</strong>' : r.esito === 'con_interventi' ? ' · con interventi' : ''
                }${r.note ? `<br><small>${esc(r.note)}</small>` : ''}
                ${elencoAllegati('controllo', r.id)}
                <button class="btn btn--testo btn--piccolo" data-elimina="${esc(r.id)}" type="button">Elimina la registrazione</button></li>`
              )
              .join('')}</ul>`
          : ''
      }
    </section>`;
  attivaAllegati(() => schermataControllo(attrId, controlloId));
  app.querySelector('#registra').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const salvato = await store.salva('controlli', {
      attrezzaturaId: a.id,
      controlloId: c.id,
      data: f.get('data'),
      scadenzaManuale: f.get('scadenzaManuale') || null,
      esito: f.get('esito') || null,
      note: String(f.get('note') || '').trim()
    });
    await salvaAllegatiDa(ev.target, 'controllo', salvato.id);
    await ricarica();
    avviso(f.get('esito') === 'negativo' ? 'Salvato. Non usare questa attrezzatura finché non è riparata.' : 'Salvato.');
    schermataControllo(attrId, controlloId);
  });
  for (const b of app.querySelectorAll('[data-elimina]')) {
    b.addEventListener('click', async () => {
      if (!confirm('Eliminare questa registrazione?')) return;
      await store.elimina('controlli', storico.find((r) => r.id === b.dataset.elimina));
      await ricarica();
      schermataControllo(attrId, controlloId);
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
      ${barraRicerca('', { id: 'cerca-documenti' })}
      ${mancano ? `<a class="banner" href="#/dati"><strong>Completa i dati dell'impresa</strong><span>Così i documenti escono già con nome, sede e titolare.</span></a>` : ''}
      <div class="scorciatoie">
        <a class="btn btn--secondario" href="#/archivio">Archivio documenti e certificati <small>(${archivioAttuale(stato.archivio, 'certificato').length})</small></a>
        <a class="btn btn--secondario" href="#/planimetrie">Planimetrie e layout <small>(${archivioAttuale(stato.archivio, 'planimetria').length})</small></a>
        <a class="btn btn--secondario" href="#/verifiche">Controlli di coerenza</a>
      </div>
      <h2>Da compilare per l'impresa</h2>
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

/** Numero di allegati per voce, con chiave "tipo:id". */
function contaAllegati() {
  const n = {};
  for (const a of stato.allegati) if (!a.deleted) n[`${a.collegatoTipo}:${a.collegatoId}`] = (n[`${a.collegatoTipo}:${a.collegatoId}`] || 0) + 1;
  return n;
}

/** Tutti i dati che servono ai modelli di documento. */
function datiDocumento(l, registro, opzioni) {
  const opzioneAttivita = stato.questionario.domande.find((d) => d.id === 'attivita')?.opzioni?.find((o) => o.valore === risposte().attivita);
  const y = Number(oggiIso().slice(0, 4));
  return {
    anagrafica: anagrafica(),
    lavoratore: l,
    oggi: oggiIso(),
    registro,
    dvr: stato.dvr,
    ctx: ctx(),
    lavoratori: attivi(),
    attrezzature: macchine().map((a) => ({ id: a.id, nome: a.nome, tipo: tipoAttrezzatura(stato.defAttr, a.tipo)?.etichetta, pericoli: a.pericoli || tipoAttrezzatura(stato.defAttr, a.tipo)?.pericoli || [], dpi: a.dpi || tipoAttrezzatura(stato.defAttr, a.tipo)?.dpi || [], istruzioni: a.istruzioni || '' })),
    etichettePericoli: Object.fromEntries((stato.defAttr.pericoli || []).map((x) => [x.id, x.etichetta])),
    attivita: opzioneAttivita?.etichetta || '',
    prodotti: prodottiAttivi(stato.prodotti),
    eventi: eventiAttivi(stato.eventi),
    ruoli: Object.fromEntries(stato.defLav.ruoli.map((r) => [r.id, r.etichetta])),
    perAnno: eventiPerAnno(stato.eventi, [y - 2, y - 1, y]),
    piano: piano(),
    situazioni: haDipendenti() ? attivi().map(situazione) : [],
    macchine: macchine().map((a) => {
      const sm = situazioneMacchina(a);
      const t = tipoAttrezzatura(stato.defAttr, a.tipo);
      return { ...sm, attrezzatura: { ...a, pericoli: a.pericoli || t?.pericoli || [], dpi: a.dpi || t?.dpi || [] } };
    }),
    allegati: contaAllegati(),
    lavorazioni: stato.lavorazioni,
    archivio: archivioAttuale(stato.archivio),
    scadenze: scadenzeAttuali(),
    responsabile: responsabile(),
    opzioni
  };
}

/** Allegati da stampare in fondo al documento, numerati A1, A2… */
function allegatiDelDocumento(m, chiaveDoc, opzioni) {
  const spec = m.allegati || {};
  const categorie = spec.categorie || null;
  const stampabili = (a) => !a.deleted && a.inStampa !== false && a.file !== null && (a.tipo?.startsWith('image/') || a.tipo === 'application/pdf');
  const scelta = (fn) => (fn ? fn(opzioni || {}) : null);
  const out = [];
  const aggiungi = (a, origine, titolo) => out.push({ id: a.id, origine, collegatoId: a.collegatoId, titolo, categoria: etichettaCategoria(a.collegatoTipo, a.categoria) || 'Documento', nome: a.nome });
  if (spec.planimetrie) {
    for (const pl of archivioAttuale(stato.archivio, 'planimetria').filter((r) => spec.planimetrie.includes(r.tipo))) {
      for (const a of stato.allegati.filter((x) => x.collegatoTipo === 'archivio' && x.collegatoId === pl.id && stampabili(x))) {
        out.push({ id: a.id, origine: 'archivio', collegatoId: pl.id, titolo: pl.titolo + (pl.area ? ` – ${pl.area}` : ''), categoria: tipoArchivio(pl)?.etichetta || 'Planimetria', nome: a.nome });
      }
    }
  }
  const filtroA = scelta(spec.attrezzature);
  const nomiA = spec.attrezzatureNomi ? new Set(spec.attrezzatureNomi(opzioni || {})) : null;
  if (filtroA || nomiA) {
    for (const mac of macchine()) {
      const ok = nomiA ? (nomiA.size ? nomiA.has(mac.nome) : true) : filtroA === true || (typeof filtroA === 'function' && filtroA(mac.id));
      if (!ok) continue;
      for (const a of stato.allegati.filter((x) => x.collegatoTipo === 'attrezzatura' && x.collegatoId === mac.id && stampabili(x) && (!categorie || categorie.includes(x.categoria || 'altro'))))
        aggiungi(a, 'attrezzatura', mac.nome);
    }
  }
  const filtroP = scelta(spec.prodotti);
  if (filtroP) {
    for (const pr of prodottiAttivi(stato.prodotti)) {
      if (!(filtroP === true || (typeof filtroP === 'function' && filtroP(pr.id)))) continue;
      for (const a of stato.allegati.filter((x) => x.collegatoTipo === 'prodotto' && x.collegatoId === pr.id && stampabili(x) && (x.categoria || 'sds') === 'sds')) aggiungi(a, 'prodotto', pr.nome);
    }
  }
  for (const a of stato.allegati.filter((x) => x.collegatoTipo === 'documento' && x.collegatoId === chiaveDoc && stampabili(x))) aggiungi(a, 'documento', 'Questo documento');
  return out.map((x, i) => ({ ...x, n: `A${i + 1}` }));
}

const cacheStampa = new Map();

/** Inserisce nelle sezioni «Allegato» le immagini e le pagine dei PDF. */
function riempiAllegati() {
  const lavori = [...app.querySelectorAll('.doc [data-allegato]')].map(async (fig) => {
    const a = stato.allegati.find((x) => x.id === fig.dataset.allegato);
    const box = fig.querySelector('.doc__allegato-pagine');
    const chiave = `${a?.id}:${a?.updatedAt}:${a?.pagine || ''}`;
    try {
      if (!cacheStampa.has(chiave)) cacheStampa.set(chiave, immaginiPerStampa(a));
      const r = await cacheStampa.get(chiave);
      if (!fig.isConnected) return;
      box.innerHTML =
        r.immagini.map((src, i) => `<img class="doc__pagina" src="${src}" alt="${esc(a.nome)} pagina ${r.scelte[i]}">`).join('') +
        (r.totale > r.scelte.length ? `<p class="doc__nota">Stampate le pagine ${r.scelte.join(', ')} di ${r.totale}. Per scegliere altre pagine modifica l'allegato nella sua scheda.</p>` : '');
    } catch (e) {
      cacheStampa.delete(chiave);
      box.innerHTML = `<p class="doc__nota">Non è stato possibile preparare questo file per la stampa: aprilo e stampalo a parte.</p>`;
    }
  });
  return Promise.all(lavori);
}

/** Campi compilabili di un documento (cantiere, ditta, lavorazioni…). */
function campiOpzioni(defs, valori) {
  return defs
    .map((c) => {
      const val = valori[c.id] ?? c.valore ?? '';
      const nome = `name="${esc(c.id)}"`;
      const ph = c.segnaposto ? `placeholder="${esc(c.segnaposto)}"` : '';
      if (c.tipo === 'area') return `<label>${esc(c.etichetta)}<textarea class="campo" ${nome} rows="3" ${ph}>${esc(val)}</textarea></label>`;
      if (c.tipo === 'scelta')
        return `<label>${esc(c.etichetta)}<select class="campo" ${nome}><option value="">Scegli…</option>${(c.valori || [])
          .map((x) => `<option value="${esc(x.valore)}" ${val === x.valore ? 'selected' : ''}>${esc(x.etichetta)}</option>`)
          .join('')}</select></label>`;
      if (c.tipo === 'tabella') {
        const righe = Array.isArray(val) && val.length ? val : c.iniziali || [];
        const n = Math.max(c.righe || 5, righe.length);
        return `<fieldset class="tabella-campi"><legend>${esc(c.etichetta)}</legend>${c.aiuto ? `<p class="nota">${esc(c.aiuto)}</p>` : ''}<div class="tabella-campi__scorri"><table>
          <thead><tr>${c.colonne.map((k) => `<th>${esc(k.etichetta)}</th>`).join('')}</tr></thead><tbody>
          ${Array.from({ length: n }, (_, i) => `<tr>${c.colonne
            .map((k) => {
              const v = righe[i]?.[k.id] ?? '';
              const nm = `name="${esc(c.id)}.${i}.${esc(k.id)}" aria-label="${esc(k.etichetta)} riga ${i + 1}"`;
              if (k.tipo === 'scelta') return `<td><select class="campo" ${nm}>${k.valori.map((x) => `<option value="${esc(x.valore)}" ${v === x.valore ? 'selected' : ''}>${esc(x.etichetta)}</option>`).join('')}</select></td>`;
              const lista = k.suggerimenti?.length ? `list="sugg-${esc(c.id)}-${esc(k.id)}"` : '';
              return `<td><input class="campo" ${nm} value="${esc(v)}" ${lista} ${k.segnaposto ? `placeholder="${esc(k.segnaposto)}"` : ''} ${k.tipo === 'numero' ? 'inputmode="decimal"' : ''}></td>`;
            })
            .join('')}</tr>`).join('')}
          </tbody></table></div>${c.colonne
            .filter((k) => k.suggerimenti?.length)
            .map((k) => `<datalist id="sugg-${esc(c.id)}-${esc(k.id)}">${k.suggerimenti.map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist>`)
            .join('')}</fieldset>`;
      }
      if (c.tipo === 'spunte') {
        const scelti = Array.isArray(val) ? val : [];
        return `<fieldset class="spunte"><legend>${esc(c.etichetta)}</legend>${
          (c.valori || []).map((x) => `<label class="spunta"><input type="checkbox" ${nome} value="${esc(x.valore)}" ${scelti.includes(x.valore) ? 'checked' : ''}><span>${esc(x.etichetta)}</span></label>`).join('') ||
          '<p class="nota">Nessuna voce disponibile.</p>'
        }</fieldset>`;
      }
      if (c.tipo === 'casella') return `<label class="spunta-semplice"><input type="checkbox" ${nome} ${val === true ? 'checked' : ''}> ${esc(c.etichetta)}</label>`;
      const tipo = { data: 'date', numero: 'number' }[c.tipo] || 'text';
      return `<label>${esc(c.etichetta)}<input class="campo" type="${tipo}" ${nome} value="${esc(val)}" ${ph} ${tipo === 'number' ? 'min="0" inputmode="numeric"' : ''}></label>`;
    })
    .join('');
}

function leggiOpzioni(form, defs) {
  const f = new FormData(form);
  const o = {};
  for (const c of defs) {
    if (c.tipo === 'spunte') o[c.id] = f.getAll(c.id);
    else if (c.tipo === 'tabella') {
      const n = form.querySelectorAll(`[name^="${c.id}."][name$=".${c.colonne[0].id}"]`).length;
      o[c.id] = Array.from({ length: n }, (_, i) => Object.fromEntries(c.colonne.map((k) => [k.id, String(f.get(`${c.id}.${i}.${k.id}`) ?? '').trim()])));
    } else if (c.tipo === 'casella') o[c.id] = f.get(c.id) === 'on';
    else o[c.id] = String(f.get(c.id) ?? '').trim();
  }
  return o;
}

async function schermataDocumento(id, lavId) {
  const m = MODELLI.find((x) => x.id === id);
  if (!m) return (location.hash = '#/documenti');
  const l = lavId ? stato.lavoratori.find((x) => x.id === lavId && !x.deleted) : null;
  if (m.ambito === 'lavoratore' && !l) return (location.hash = '#/documenti');
  const req = stato.defLav.requisiti.find((r) => r.modello === id);
  const registro = l && req ? storicoRegistri(l.id, req.id, stato.registri)[0] : null;
  const chiaveDoc = l ? `${id}:${l.id}` : id;
  const chiaveOpzioni = `opzioni:${chiaveDoc}`;
  const salvate = await store.leggiMeta(chiaveOpzioni);
  let opzioni = { ...(salvate || {}) };
  const defs = m.opzioni ? m.opzioni(datiDocumento(l, registro, opzioni)) : [];
  for (const c of defs) {
    if (opzioni[c.id] !== undefined) continue;
    if (c.tipo === 'tabella' && c.iniziali?.length) opzioni[c.id] = c.iniziali;
    else if (c.valore !== undefined && c.valore !== '') opzioni[c.id] = c.valore;
  }
  const genera = () => generaDocumento(id, { ...datiDocumento(l, registro, opzioni), allegatiDoc: allegatiDelDocumento(m, chiaveDoc, opzioni) }).html;
  let pronti = Promise.resolve();
  const ridisegna = () => {
    app.querySelector('.doc').innerHTML = genera();
    pronti = stato.attesaAllegati = riempiAllegati();
  };

  const firmatiReg = req && l ? storicoRegistri(l.id, req.id, stato.registri).map((r) => elencoAllegati('registro', r.id)).join('') : '';
  const firmati = elencoAllegati('documento', chiaveDoc) + firmatiReg;
  const controlli = await calcolaVerifiche();
  app.innerHTML = `
    <section class="pagina pagina--doc">
      <div class="solo-schermo">
        <a class="indietro" href="${l ? `#/lavoratore/${esc(l.id)}` : '#/documenti'}">‹ Indietro</a>
        ${pannelloAiutoDocumento(id, controlli)}
        ${bloccoRevisioneDocumento(m)}
        ${
          defs.length
            ? `<details class="opzioni-doc" ${salvate ? '' : 'open'}><summary>Dati di questo documento</summary>
            <p class="nota">Il documento si aggiorna mentre scrivi. I dati restano salvati su questo dispositivo.</p>
            <form id="opzioni-doc">${campiOpzioni(defs, opzioni)}</form></details>`
            : ''
        }
        <p class="aiuto">Le righe vuote si completano a mano. Per cambiare i dati dell'impresa vai su <a href="#/dati">I miei dati</a>.</p>
        <button class="btn btn--primario btn--grande" id="stampa">Stampa o salva in PDF</button>
        <p class="nota">Puoi anche far firmare qui sul telefono o sul tablet: tocca «Firma qui» sotto ogni firma. Compila prima i dati del documento.</p>
        ${firmati ? `<h2>Copie già firmate</h2>${firmati}` : ''}
        <details class="opzioni-doc"><summary>Allegati di questo documento</summary>
          <p class="nota">Planimetrie, libretti di attrezzature delle ditte esterne, misure, documenti della ditta: finiscono in fondo al documento. I libretti delle tue macchine e le schede di sicurezza si caricano nelle loro schede e vengono inseriti da soli.</p>
          ${elencoAllegatiDettaglio('documento', chiaveDoc)}
          <form id="allegati-doc">${campoAllegato('documento')}<button class="btn btn--secondario" type="submit">Allega al documento</button></form>
        </details>
      </div>
      <div class="barra-firma solo-schermo" id="barra-firma" hidden><span></span><button class="btn btn--primario" type="button">Salva il documento firmato</button></div>
      <article class="doc">${genera()}</article>
      <p class="nota solo-schermo">Modello da verificare e adattare con il tuo consulente prima dell'uso.</p>
    </section>`;
  pronti = stato.attesaAllegati = riempiAllegati();
  app.querySelector('#stampa').addEventListener('click', async (ev) => {
    ev.target.disabled = true;
    ev.target.textContent = 'Preparo gli allegati…';
    await pronti;
    ev.target.disabled = false;
    ev.target.textContent = 'Stampa o salva in PDF';
    window.print();
  });
  attivaAllegati(() => schermataDocumento(id, lavId));
  attivaRevisioneDocumento(m, () => schermataDocumento(id, lavId));
  app.querySelector('#allegati-doc').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const n = await salvaAllegatiDa(ev.target, 'documento', chiaveDoc);
    await ricarica();
    if (n) avviso('Allegato aggiunto al documento.');
    schermataDocumento(id, lavId);
  });
  const firme = attivaFirme({ modello: m, lavoratore: l, requisito: req && l ? req : null, registro });
  const form = app.querySelector('#opzioni-doc');
  if (form) {
    let attesa;
    const aggiorna = () => {
      opzioni = leggiOpzioni(form, defs);
      ridisegna();
      firme.ricollega();
      clearTimeout(attesa);
      attesa = setTimeout(() => store.scriviMeta(chiaveOpzioni, opzioni), 400);
    };
    form.addEventListener('input', aggiorna);
    form.addEventListener('change', aggiorna);
  }
}

const CAMPI_CONSULENTE = [
  ['nome', 'Nome (consulente, studio o associazione)', 'text', 'organization'],
  ['telefono', 'Telefono', 'tel', 'tel'],
  ['whatsapp', 'WhatsApp (se diverso dal telefono)', 'tel', 'off'],
  ['email', 'Email', 'email', 'email']
];

async function schermataDati(sezione) {
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
      ${(() => {
        const vivi = stato.allegati.filter((a) => !a.deleted && a.file);
        if (!vivi.length) return '';
        const peso = vivi.reduce((t, a) => t + (a.dimensione || 0), 0);
        return `<label class="spunta-semplice"><input type="checkbox" id="conAllegati" checked> Includi foto e documenti allegati (${vivi.length}, circa ${esc(dimensioneLeggibile(Math.round(peso * 1.37)))})</label>`;
      })()}
      <button class="btn btn--primario btn--grande" id="esporta">Salva copia</button>

      <h2>Carica una copia</h2>
      <p>Puoi caricare una copia fatta su un altro dispositivo: i dati vengono uniti, tenendo sempre la modifica più recente.</p>
      <label class="btn btn--secondario btn--file">Scegli il file
        <input type="file" id="importa" accept=".json,application/json" hidden>
      </label>
      <div id="esito"></div>

      <h2>Dati dell'impresa</h2>
      <p>Servono per compilare i documenti. Puoi lasciare vuoto quello che non sai.</p>
      ${(() => {
        const f = ctx().fatti;
        return f.ateco
          ? `<p class="riquadro">Codice ATECO <strong>${esc(f.ateco.codice)}</strong> – ${esc(f.ateco.descrizione)} · rischio ${esc(f.classeRischio)}. <a href="#/domanda/1">Cambia</a></p>`
          : `<p class="riquadro">Codice ATECO non inserito. <a href="#/domanda/1">Aggiungilo</a></p>`;
      })()}
      <form id="anagrafica">
        ${CAMPI_ANAGRAFICA.map(
          ([k, et, ac]) => `<label>${esc(et)}<input class="campo" name="${k}" autocomplete="${ac}" value="${esc(anagrafica()[k] || '')}"></label>`
        ).join('')}
        <button class="btn btn--primario" type="submit">Salva i dati dell'impresa</button>
      </form>

      <h2 id="consulente">Chi ti aiuta</h2>
      <p>Il tuo consulente, l'RSPP esterno o la tua associazione di categoria. Da ogni voce potrai chiamarlo o scrivergli con un tocco.</p>
      <form id="form-consulente">
        ${CAMPI_CONSULENTE.map(
          ([k, et, tipo, ac]) => `<label>${esc(et)}<input class="campo" name="${k}" type="${tipo}" autocomplete="${ac}" value="${esc(consulente()[k] || '')}"></label>`
        ).join('')}
        <button class="btn btn--primario" type="submit">Salva il contatto</button>
      </form>

      <h2 id="richieste">Richieste e assistenza</h2>
      <p>Chiedi aiuto o informazioni, segnala un problema, proponi modifiche o miglioramenti.</p>
      <a class="btn btn--primario" href="#/richieste">Richieste e assistenza${account?.risposte ? ` (${account.risposte} nuove risposte)` : ''}</a>

      ${await bloccoUsoDati()}

      <h2 id="responsabile">Responsabile delle scadenze</h2>
      <p>Chi riceve i promemoria dello scadenzario: l'RSPP, il consulente o tu stesso.</p>
      <form id="form-responsabile">
        ${CAMPI_RESPONSABILE.map(([k, et, tipo, ac]) => `<label>${esc(et)}<input class="campo" name="${k}" type="${tipo}" autocomplete="${ac}" value="${esc(stato.profilo?.responsabile?.[k] || (k === 'nome' ? responsabile().nome : ''))}"></label>`).join('')}
        <label>Scadenze da includere nel promemoria<select class="campo" name="giorni">${[30, 60, 90].map((g) => `<option value="${g}" ${responsabile().giorni === g ? 'selected' : ''}>Entro ${g} giorni</option>`).join('')}</select></label>
        <label>Ricordami di inviare il promemoria<select class="campo" name="frequenza">${[[7, 'Ogni settimana'], [15, 'Ogni 15 giorni'], [30, 'Ogni mese']].map(([g, e]) => `<option value="${g}" ${responsabile().frequenza === g ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <button class="btn btn--primario" type="submit">Salva il responsabile</button>
      </form>

      <h2 id="aiuti">Aiuti sullo schermo</h2>
      <label class="spunta-semplice"><input type="checkbox" id="mostra-guida" ${guidaNascosta ? '' : 'checked'}> Mostra i «?» di aiuto e le sigle da toccare per la spiegazione</label>

      <h2 id="installa-app">Installa l'app</h2>
      ${bloccoInstallazione()}

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
  app.querySelector('#form-consulente').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const c = {};
    for (const [k] of CAMPI_CONSULENTE) c[k] = String(f.get(k) || '').trim();
    await store.salvaConsulente(c);
    await ricarica();
    avviso('Contatto salvato.');
  });
  app.querySelector('#form-responsabile').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const r = {};
    for (const [k] of CAMPI_RESPONSABILE) r[k] = String(f.get(k) || '').trim();
    r.giorni = Number(f.get('giorni')) || 60;
    r.frequenza = Number(f.get('frequenza')) || 30;
    await store.salvaResponsabile(r);
    await ricarica();
    avviso('Responsabile salvato.');
  });
  attivaInstallazione();
  attivaUsoDati(() => schermataDati(sezione));
  app.querySelector('#mostra-guida')?.addEventListener('change', async (e) => {
    await impostaGuidaNascosta(!e.target.checked);
    avviso(e.target.checked ? 'Aiuti visibili.' : 'Aiuti nascosti: puoi riattivarli qui.');
  });
  const ancora = { consulente: 'consulente', installa: 'installa-app', responsabile: 'responsabile', utilizzo: 'dati-utilizzo' }[sezione];
  if (ancora) app.querySelector(`#${ancora}`)?.scrollIntoView();
  app.querySelector('#esporta').addEventListener('click', esporta);
  app.querySelector('#importa').addEventListener('change', (e) => importa(e.target.files[0]));
}

// ---------- backup ----------

async function esporta() {
  const collezioni = {};
  for (const c of COLLEZIONI) collezioni[c] = await store.tutti(c);
  const conAllegati = document.getElementById('conAllegati')?.checked !== false;
  collezioni.allegati = conAllegati ? await Promise.all(collezioni.allegati.map(allegatoPerExport)) : [];
  let contenuto = creaExport({ collezioni, deviceId: await store.idPostazione(), versioneApp: VERSIONE_APP, documenti: await store.metaPerBackup() });
  const pwd = document.getElementById('pwdExport').value;
  if (pwd) contenuto = await cifra(contenuto, pwd);

  const nome = `safetydoc-${(risposte().nome_impresa || 'impresa').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${oggiIso()}${pwd ? '-protetto' : ''}.json`;
  const blob = new Blob([JSON.stringify(contenuto)], { type: 'application/json' });
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
  registraUso('backup', 'esporta');
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
      const importati = c === 'allegati' ? (dati.collezioni[c] || []).map(allegatoDaImport) : dati.collezioni[c] || [];
      const { daSalvare, riepilogo } = unisciCollezione(await store.tutti(c), importati);
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
    const docs = unisciDocumenti(await store.metaPerBackup(), dati.documenti);
    await store.scriviMolti('meta', docs);
    if (docs.length) righe.push(`Dati dei documenti: ${docs.length} ${docs.length === 1 ? 'aggiornato' : 'aggiornati'}.`);
    await ricarica();
    esito.innerHTML = `<p class="esito esito--ok">Copia caricata. ${esc(righe.join(' '))}${
      conflitti ? ` ${conflitti} voci erano state modificate su entrambi i dispositivi: abbiamo tenuto la versione più recente.` : ''
    }</p>`;
  } catch (e) {
    esito.innerHTML = `<p class="esito esito--errore">${esc(e.message === 'CIFRATO' ? 'Il file è protetto da password.' : e.message || 'Non è stato possibile leggere il file.')}</p>`;
  }
}

// ---------- avvio ----------

// ---------- account dell'impresa: attivazione, verifica giornaliera, blocco ----------

let account = null; // { dispositivo, chiave, impresa, stato, motivo, verificatoIl, controllatoIl }
let sessioneAdmin = null; // { accessToken, refreshToken, scade, email, verificatoIl }

async function caricaAccount() {
  account = (await store.leggiMeta('account')) || null;
  sessioneAdmin = (await store.leggiMeta('admin:sessione')) || null;
}

async function salvaAccount(a) {
  account = a;
  await store.scriviMeta('account', a);
}

const datiDispositivo = () => ({
  versione: VERSIONE_APP,
  piattaforma: piattaforma(navigator.userAgent),
  installata: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
});

/** Verifica l'account con il server (se c'è connessione) e restituisce la decisione di accesso. */
async function controllaAccesso({ forza = false } = {}) {
  const adminValido = Boolean(sessioneAdmin?.verificatoIl && Date.now() - sessioneAdmin.verificatoIl < GRAZIA_MS);
  if (account?.chiave && navigator.onLine && (forza || daRiverificare(account))) {
    let esito = null;
    try {
      esito = await rpc('safetydoc_verifica', { dispositivo: account.dispositivo, chiave: account.chiave, info: datiDispositivo() }, { timeoutMs: 6000 });
    } catch {
      esito = null; // server non raggiungibile: vale il periodo di 24 ore
    }
    const nuovo = applicaVerifica(account, esito);
    if (nuovo) await salvaAccount(nuovo);
    else {
      account = null;
      await store.scriviMeta('account', null);
    }
  }
  if (sessioneAdmin?.refreshToken && navigator.onLine && (forza || !sessioneAdmin.verificatoIl || Date.now() - sessioneAdmin.verificatoIl > RIVERIFICA_MS)) await rinnovaAdmin().catch(() => {});
  return decidiAccesso({ account, adminValido: Boolean(sessioneAdmin?.verificatoIl && Date.now() - sessioneAdmin.verificatoIl < GRAZIA_MS) || adminValido });
}

function schermataAccessoNegato(decisione) {
  document.querySelector('.nav').hidden = true;
  const testi = {
    attivazione: `<h1>Attiva safetyDoc</h1>
      <p class="lead">Per usare safetyDoc serve il <strong>link di attivazione</strong> che ti è stato mandato su WhatsApp.</p>
      <p>Apri il link da questo telefono o computer: ti chiederà di confermare i dati dell'impresa. Se non l'hai ricevuto o l'hai perso, chiedine uno nuovo a chi ti ha proposto safetyDoc.</p>
      <form id="incolla-link"><label>Hai il link? Incollalo qui<input class="campo" name="link" type="url" inputmode="url" placeholder="https://safetydoc.vercel.app/#/invito/…" required></label><button class="btn btn--primario" type="submit">Apri il link</button></form>`,
    bloccato: `<h1>Accesso sospeso</h1>
      <p class="lead">L'accesso a safetyDoc${account?.impresa?.ragione_sociale ? ` per <strong>${esc(account.impresa.ragione_sociale)}</strong>` : ''} è stato sospeso${account?.stato === 'bloccato' ? ' su questo dispositivo' : ''}.</p>
      ${account?.motivo ? `<p><strong>Motivo:</strong> ${esc(account.motivo)}</p>` : ''}
      <p>I dati inseriti restano su questo dispositivo. Per riattivare l'accesso contatta chi ti ha fornito safetyDoc.</p>
      <button class="btn btn--secondario" type="button" id="riprova">Riprova</button>`,
    'serve-rete': `<h1>Collegati a internet</h1>
      <p class="lead">safetyDoc controlla una volta al giorno che l'account dell'impresa sia attivo. L'ultimo controllo è di più di 24 ore fa.</p>
      <p>Collegati a internet (Wi-Fi o dati) e tocca <strong>Riprova</strong>. I tuoi dati sono al sicuro su questo dispositivo.</p>
      <button class="btn btn--primario" type="button" id="riprova">Riprova</button>`
  };
  app.innerHTML = `<section class="pagina accesso">${testi[decisione]}<p class="nota"><a href="#/termini">Termini d'uso e informativa</a> · <a href="#/admin">Amministratore</a></p></section>`;
  app.querySelector('#riprova')?.addEventListener('click', async () => {
    const d = await controllaAccesso({ forza: true });
    if (d === 'ok') instrada();
    else {
      avviso(d === 'serve-rete' ? 'Ancora nessuna connessione.' : 'L\'accesso è ancora sospeso.');
      schermataAccessoNegato(d);
    }
  });
  app.querySelector('#incolla-link')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const m = String(new FormData(ev.target).get('link')).match(/#\/invito\/([a-f0-9]{16,})/i);
    if (m) location.hash = `#/invito/${m[1]}`;
    else avviso('Il link non sembra un link di attivazione di safetyDoc.');
  });
}

async function schermataInvito(token) {
  document.querySelector('.nav').hidden = true;
  app.innerHTML = '<section class="pagina"><h1>Attivazione</h1><p>Controllo il link…</p></section>';
  let info = null;
  try {
    info = await rpc('safetydoc_invito_info', { token });
  } catch {
    app.innerHTML = '<section class="pagina"><h1>Attivazione</h1><p class="lead">Serve la connessione a internet per attivare safetyDoc.</p><button class="btn btn--primario" type="button" onclick="location.reload()">Riprova</button></section>';
    return;
  }
  if (!info?.valido) {
    app.innerHTML = `<section class="pagina"><h1>Link non valido</h1><p class="lead">Questo link di attivazione non funziona più${info ? ' perché ne è stato creato uno nuovo o l\'impresa è sospesa' : ''}.</p><p>Chiedi a chi ti ha proposto safetyDoc di mandarti un nuovo link.</p></section>`;
    return;
  }
  const a = anagrafica();
  const v = (k, alt = '') => esc(info[k] || alt || '');
  const gia = account?.chiave && account?.impresa?.ragione_sociale;
  app.innerHTML = `
    <section class="pagina">
      <h1>Attiva safetyDoc</h1>
      <p class="lead">Attivazione per <strong>${v('ragione_sociale')}</strong>. Controlla e completa i dati dell'impresa.</p>
      ${gia ? `<p class="riquadro">Questo dispositivo è già attivo per <strong>${esc(account.impresa.ragione_sociale)}</strong>: continuando lo colleghi all'impresa del link.</p>` : ''}
      <form id="attivazione" novalidate>
        <label>Ragione sociale<input class="campo" name="ragione_sociale" required value="${v('ragione_sociale', a.ragioneSociale)}" autocomplete="organization"></label>
        <label>Partita IVA<input class="campo" name="partita_iva" inputmode="numeric" maxlength="11" value="${v('partita_iva', a.piva)}"></label>
        <label>Codice fiscale <small>(se diverso dalla partita IVA)</small><input class="campo" name="codice_fiscale" maxlength="16" value="${v('codice_fiscale', a.codiceFiscale)}"></label>
        <label>Codice ATECO<input class="campo" name="ateco" inputmode="decimal" placeholder="es. 43.21.01" value="${v('ateco', risposte().ateco)}"></label>
        <label>Comune<input class="campo" name="comune" value="${v('comune', a.comune)}" autocomplete="address-level2"></label>
        <label>Provincia <small>(2 lettere)</small><input class="campo" name="provincia" maxlength="2" placeholder="AV" value="${v('provincia')}"></label>
        <label>Email<input class="campo" name="email" type="email" value="${v('email', a.email)}" autocomplete="email"></label>
        <label>Cellulare<input class="campo" name="telefono" type="tel" value="${v('telefono')}" autocomplete="tel"></label>
        <label>Nome del referente<input class="campo" name="referente" value="${v('referente', a.titolare)}" autocomplete="name"></label>
        <label class="spunta-semplice"><input type="checkbox" name="termini" value="1"> Ho letto e accetto i <a href="#/termini" target="_blank" rel="noopener">termini d'uso e l'informativa sul trattamento dei dati</a></label>
        <p class="esito esito--errore" id="errori-attivazione" hidden></p>
        <button class="btn btn--primario" type="submit">Attiva questo dispositivo</button>
      </form>
    </section>`;
  const form = app.querySelector('#attivazione');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const d = datiAttivazione(f);
    const errori = erroriAttivazione(d);
    const box = app.querySelector('#errori-attivazione');
    if (errori.length) {
      box.hidden = false;
      box.textContent = errori.join(' ');
      return;
    }
    const bottone = form.querySelector('button[type=submit]');
    bottone.disabled = true;
    try {
      const dispositivo = account?.dispositivo || (crypto.randomUUID ? crypto.randomUUID() : store.nuovoId());
      const r = await rpc('safetydoc_attiva', { token, dispositivo, dati: { ...d, ...datiDispositivo() } });
      await salvaAccount({ dispositivo, chiave: r.chiave, impresa: r.impresa, stato: 'attivo', motivo: '', verificatoIl: Date.now(), controllatoIl: Date.now() });
      // i dati di utilizzo (se acconsentiti) vengono collegati a questo dispositivo
      await store.scriviMeta('uso:id', dispositivo);
      avviso('safetyDoc è attivo su questo dispositivo.');
      location.hash = '#/';
    } catch (e) {
      box.hidden = false;
      box.textContent = erroreAttivazione(e.message);
      bottone.disabled = false;
    }
  });
}

function schermataTermini() {
  const t = stato.legale || {};
  const titolare = t.titolare ? `${esc(t.titolare)}${t.contatto ? ` (${esc(t.contatto)})` : ''}` : 'il gestore di safetyDoc';
  app.innerHTML = `
    <section class="pagina testo-legale">
      <a class="indietro" href="javascript:history.back()">‹ Indietro</a>
      <h1>Termini d'uso e informativa</h1>
      <h2>Cos'è safetyDoc</h2>
      <p>safetyDoc aiuta l'impresa a organizzare adempimenti, documenti e scadenze di sicurezza, ambiente e privacy. Le indicazioni sono una guida: vanno verificate con il proprio consulente e non sostituiscono le valutazioni dei professionisti (RSPP, medico competente, tecnici).</p>
      <h2>Dove sono i tuoi dati</h2>
      <p>I dati che inserisci (lavoratori, documenti, macchine, scadenze, allegati) restano <strong>sul tuo dispositivo</strong> e nei backup che fai tu. Non vengono inviati a nessun server.</p>
      <h2>Account dell'impresa</h2>
      <p>Per usare safetyDoc l'impresa attiva i propri dispositivi con un link personale. Per gestire l'account trattiamo: ragione sociale, partita IVA o codice fiscale, codice ATECO, comune e provincia, email, cellulare e nome del referente, data di attivazione, accettazione di questi termini, e per ogni dispositivo un codice casuale, la versione dell'app, il tipo di dispositivo, se l'app è installata, data e ora degli accessi. <strong>Non registriamo indirizzi IP.</strong></p>
      <p>Servono per fornire il servizio, verificare che l'account sia attivo (una volta al giorno) e impedire usi non conformi: chi usa l'app in modo non conforme può essere sospeso. Base giuridica: esecuzione del servizio richiesto e legittimo interesse alla sicurezza del servizio. Gli accessi sono conservati per 12 mesi, i dati dell'account finché l'account esiste.</p>
      <h2>Dati di utilizzo (facoltativi)</h2>
      <p>Solo se lo accetti, safetyDoc invia quali schermate, documenti e funzioni usi (mai cosa scrivi), collegati al tuo account, per capire cosa migliorare. Puoi revocare il consenso e cancellarli in Dati. Sono conservati per 12 mesi.</p>
      <h2>Chi tratta i dati</h2>
      <p>Titolare del trattamento: ${titolare}. I dati dell'account sono conservati su server nell'Unione europea (Supabase, Irlanda). Puoi chiedere accesso, rettifica, cancellazione o limitazione dei tuoi dati e opporti al trattamento scrivendo al titolare, e hai diritto di reclamo al Garante per la protezione dei dati personali.</p>
    </section>`;
}

// ---------- sezione Amministratore ----------

async function salvaSessioneAdmin(s) {
  sessioneAdmin = s;
  await store.scriviMeta('admin:sessione', s);
}

async function rinnovaAdmin() {
  if (!sessioneAdmin?.refreshToken) return;
  if (!sessioneValida(sessioneAdmin)) {
    const s = await rinnova(sessioneAdmin.refreshToken);
    await salvaSessioneAdmin({ ...s, verificatoIl: sessioneAdmin.verificatoIl });
  }
  await rpc('safetydoc_admin_elenco', {}, { accessToken: sessioneAdmin.accessToken, timeoutMs: 8000 }).then(() => salvaSessioneAdmin({ ...sessioneAdmin, verificatoIl: Date.now() }));
}

async function chiamaAdmin(funzione, corpo = {}) {
  if (!sessioneValida(sessioneAdmin)) {
    const s = await rinnova(sessioneAdmin.refreshToken);
    await salvaSessioneAdmin({ ...s, verificatoIl: sessioneAdmin.verificatoIl });
  }
  return rpc(funzione, corpo, { accessToken: sessioneAdmin.accessToken });
}

const dataOra = (iso) => (iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const ETICHETTA_STATO_IMPRESA = { invitata: ['info', 'Invitata'], attiva: ['verde', 'Attiva'], sospesa: ['rosso', 'Sospesa'] };

function schermataLoginAdmin(messaggio = '') {
  app.innerHTML = `
    <section class="pagina">
      <h1>Amministratore</h1>
      <p class="lead">Accedi con l'account amministratore per vedere le imprese, i dispositivi e l'utilizzo, e per gestire gli accessi.</p>
      ${messaggio ? `<p class="esito esito--errore">${esc(messaggio)}</p>` : ''}
      <form id="login-admin">
        <label>Email<input class="campo" name="email" type="email" autocomplete="username" required></label>
        <label>Password<input class="campo" name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn btn--primario" type="submit">Accedi</button>
      </form>
      <p class="nota">È l'account del progetto Supabase. La password non viene salvata: resta solo una sessione su questo dispositivo, che puoi chiudere con «Esci».</p>
    </section>`;
  app.querySelector('#login-admin').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const b = ev.target.querySelector('button');
    b.disabled = true;
    try {
      const s = await accedi(String(f.get('email')).trim(), String(f.get('password')));
      await rpc('safetydoc_admin_elenco', {}, { accessToken: s.accessToken });
      await salvaSessioneAdmin({ ...s, verificatoIl: Date.now() });
      schermataAdmin();
    } catch (e) {
      schermataLoginAdmin(e.stato === 400 ? 'Email o password non corrette.' : e.codice === '42501' || /autorizzato/.test(e.message) ? 'Questo account non è amministratore di safetyDoc.' : 'Accesso non riuscito: controlla la connessione.');
    }
  });
}

let datiAdmin = null;

async function schermataAdmin(filtro = '', { usaCache = false } = {}) {
  if (!sessioneAdmin?.refreshToken) return schermataLoginAdmin();
  if (!(usaCache && datiAdmin)) app.innerHTML = '<section class="pagina"><h1>Amministratore</h1><p>Carico i dati…</p></section>';
  if (!(usaCache && datiAdmin)) try {
    datiAdmin = await chiamaAdmin('safetydoc_admin_elenco');
    richiesteAdmin = await chiamaAdmin('safetydoc_admin_richieste').catch(() => []);
    await salvaSessioneAdmin({ ...sessioneAdmin, verificatoIl: Date.now() });
  } catch (e) {
    if (e.stato === 401 || e.stato === 400 || e.codice === '42501') {
      await salvaSessioneAdmin(null);
      return schermataLoginAdmin('Sessione scaduta: accedi di nuovo.');
    }
    app.innerHTML = '<section class="pagina"><h1>Amministratore</h1><p class="lead">Serve la connessione a internet per la sezione Amministratore.</p><button class="btn btn--primario" type="button" id="riprova">Riprova</button></section>';
    app.querySelector('#riprova').addEventListener('click', () => schermataAdmin(filtro));
    return;
  }
  const r = datiAdmin.riepilogo;
  const q = normalizzaTesto(filtro);
  const imprese = datiAdmin.imprese.filter((m) => !q || normalizzaTesto([m.ragione_sociale, m.partita_iva, m.comune, m.provincia, m.ateco, m.email, m.referente].join(' ')).includes(q));
  app.innerHTML = `
    <section class="pagina admin">
      <h1>Amministratore</h1>
      <p class="nota">Collegato come ${esc(sessioneAdmin.email || '')} · <button class="link" type="button" id="esci-admin">Esci</button></p>
      ${stato.legale?.titolare ? '' : '<p class="riquadro">Completa il <strong>titolare del trattamento</strong> in <code>data/legale.json</code>: compare in termini d\'uso e informativa.</p>'}
      <div class="contatori" role="list">
        <span role="listitem" class="contatore contatore--verde"><strong>${r.attive}</strong><span>imprese attive</span></span>
        <span role="listitem" class="contatore contatore--giallo"><strong>${r.invitate}</strong><span>invitate</span></span>
        <span role="listitem" class="contatore contatore--rosso"><strong>${r.sospese}</strong><span>sospese</span></span>
      </div>
      <p>Dispositivi: ${r.dispositivi} · attivi negli ultimi 7 giorni: <strong>${r.attivi_7}</strong> · negli ultimi 30: <strong>${r.attivi_30}</strong>${r.anonimi ? ` · dispositivi anonimi (prima della registrazione): ${r.anonimi}` : ''}</p>

      ${bloccoRichiesteAdmin()}

      <details class="opzioni-doc" id="nuova-impresa-box">
        <summary>+ Nuova impresa e link di attivazione</summary>
        <form id="nuova-impresa">
          <label>Ragione sociale<input class="campo" name="ragione_sociale" required></label>
          <label>Cellulare per WhatsApp<input class="campo" name="telefono" type="tel"></label>
          <label>Nome del referente<input class="campo" name="referente"></label>
          <label>Email<input class="campo" name="email" type="email"></label>
          <label>Note interne<input class="campo" name="note"></label>
          <label>Dispositivi ammessi<input class="campo" name="max_dispositivi" type="number" min="1" max="50" value="5"></label>
          <button class="btn btn--primario" type="submit">Crea e prepara il link</button>
        </form>
      </details>

      <div class="azioni">
        <button class="btn btn--secondario" type="button" id="csv-imprese">Esporta imprese (CSV)</button>
        <button class="btn btn--secondario" type="button" id="aggiorna-admin">Aggiorna</button>
      </div>
      <label>Cerca impresa<input class="campo" id="filtro-imprese" type="search" value="${esc(filtro)}" placeholder="nome, partita IVA, comune, ATECO…"></label>
      <h2>Imprese <span class="conta">${imprese.length}</span></h2>
      ${imprese.map(cardImpresaAdmin).join('') || '<p>Nessuna impresa.</p>'}

      <h2>Funzioni più usate (30 giorni, chi ha dato il consenso)</h2>
      ${(datiAdmin.funzioni || []).length ? `<table class="tabella-admin"><thead><tr><th>Funzione</th><th>Volte</th><th>Dispositivi</th></tr></thead><tbody>${datiAdmin.funzioni.map((f) => `<tr><td>${esc(f.tipo)}${f.nome ? ` · ${esc(f.nome)}` : ''}</td><td>${f.volte}</td><td>${f.dispositivi}</td></tr>`).join('')}</tbody></table>` : '<p class="nota">Ancora nessun dato.</p>'}
      <h2>Aiuti più aperti (30 giorni)</h2>
      ${(() => {
        const titoli = Object.fromEntries((stato.guida?.voci || []).map((v) => [`guida:${v.id}`, v.titolo]));
        const aiuti = (datiAdmin.funzioni || []).filter((f) => /^(guida|sigla):/.test(f.nome || ''));
        return aiuti.length
          ? `<p class="nota">Dicono quali parti dell'app sono meno chiare.</p><table class="tabella-admin"><thead><tr><th>Aiuto</th><th>Volte</th><th>Dispositivi</th></tr></thead><tbody>${aiuti.map((f) => `<tr><td>${esc(titoli[f.nome] || f.nome.replace('sigla:', 'Sigla '))}</td><td>${f.volte}</td><td>${f.dispositivi}</td></tr>`).join('')}</tbody></table>`
          : '<p class="nota">Ancora nessun aiuto aperto (contano solo i dispositivi con il consenso ai dati di utilizzo).</p>';
      })()}
      <h2>Versioni in uso</h2>
      ${(datiAdmin.versioni || []).length ? `<table class="tabella-admin"><thead><tr><th>Versione</th><th>Dispositivo</th><th>Quanti</th><th>Ultimo uso</th></tr></thead><tbody>${datiAdmin.versioni.map((v) => `<tr><td>${esc(v.versione || '?')}</td><td>${esc(v.piattaforma || '?')}</td><td>${v.dispositivi}</td><td>${esc(dataOra(v.ultimo_uso))}</td></tr>`).join('')}</tbody></table>` : '<p class="nota">Ancora nessun dato.</p>'}
      <p class="nota">Non vengono registrati indirizzi IP. I dati di utilizzo arrivano solo da chi ha dato il consenso.</p>
    </section>`;
  attivaAdmin(filtro);
}

function cardImpresaAdmin(m) {
  const [col, et] = ETICHETTA_STATO_IMPRESA[m.stato] || ['info', m.stato];
  return `<details class="impresa-admin" data-impresa="${esc(m.id)}">
      <summary>
        <span class="impresa-admin__nome">${esc(m.ragione_sociale)}</span>
        <span class="pill pill--${col}">${et}</span>
        <span class="impresa-admin__dati">${[m.ateco ? `ATECO ${esc(m.ateco)}` : '', [m.comune, m.provincia].filter(Boolean).map(esc).join(' '), `${(m.dispositivi || []).length} dispositivi`, `ultimo accesso ${esc(dataOra(m.ultimo_accesso))}`].filter(Boolean).join(' · ')}</span>
      </summary>
      <dl class="sigle">
        <dt>Partita IVA</dt><dd>${esc(m.partita_iva || '—')}${m.codice_fiscale ? ` · CF ${esc(m.codice_fiscale)}` : ''}</dd>
        <dt>Referente</dt><dd>${esc(m.referente || '—')}</dd>
        <dt>Contatti</dt><dd>${esc([m.telefono, m.email].filter(Boolean).join(' · ') || '—')}</dd>
        <dt>Creata</dt><dd>${esc(dataOra(m.creata_il))}${m.termini_accettati_il ? ` · termini accettati il ${esc(dataOra(m.termini_accettati_il))}` : ' · non ancora attivata'}</dd>
        <dt>Accessi</dt><dd>${m.accessi_30} negli ultimi 30 giorni</dd>
        ${m.stato === 'sospesa' ? `<dt>Sospesa</dt><dd>${esc(dataOra(m.sospesa_il))}${m.motivo_sospensione ? ` · ${esc(m.motivo_sospensione)}` : ''}</dd>` : ''}
        ${m.note ? `<dt>Note</dt><dd>${esc(m.note)}</dd>` : ''}
      </dl>
      <div class="azioni">
        ${m.invito ? `<button class="btn btn--primario" type="button" data-whatsapp="${esc(m.id)}">Invia il link su WhatsApp</button><button class="btn btn--secondario" type="button" data-copia="${esc(m.id)}">Copia il link</button>` : ''}
        <button class="btn btn--secondario" type="button" data-nuovo-link="${esc(m.id)}">${m.invito ? 'Crea un nuovo link' : 'Crea il link'}</button>
        ${m.stato === 'sospesa' ? `<button class="btn btn--secondario" type="button" data-riattiva="${esc(m.id)}">Riattiva l'impresa</button>` : `<button class="btn btn--secondario" type="button" data-sospendi="${esc(m.id)}">Sospendi l'impresa</button>`}
      </div>
      <h3>Dispositivi</h3>
      ${(m.dispositivi || []).length ? `<table class="tabella-admin"><thead><tr><th>Dispositivo</th><th>Attivato</th><th>Ultimo accesso</th><th>Uso 30 gg</th><th></th></tr></thead><tbody>${m.dispositivi
        .map((d) => `<tr><td>${esc(d.piattaforma || '?')} · ${esc(d.versione || '?')}${d.installata ? ' · app' : ''}<br><small>${esc(d.id.slice(0, 8))}</small>${d.stato === 'bloccato' ? `<br><span class="pill pill--rosso">Bloccato</span>${d.motivo_blocco ? ` <small>${esc(d.motivo_blocco)}</small>` : ''}` : ''}</td><td>${esc(dataOra(d.attivato_il))}</td><td>${esc(dataOra(d.ultimo_accesso))}</td><td>${d.eventi_30}</td><td>${d.stato === 'bloccato' ? `<button class="link" type="button" data-sblocca="${esc(d.id)}">Sblocca</button>` : `<button class="link" type="button" data-blocca="${esc(d.id)}">Blocca</button>`}</td></tr>`)
        .join('')}</tbody></table>` : '<p class="nota">Nessun dispositivo attivato.</p>'}
      ${(m.funzioni || []).length ? `<h3>Cosa usa (30 giorni)</h3><p>${m.funzioni.map((f) => `${esc(f.tipo)}${f.nome ? ` · ${esc(f.nome)}` : ''} (${f.volte})`).join(', ')}</p>` : ''}
      <form class="note-impresa" data-note="${esc(m.id)}"><label>Note interne<input class="campo" name="note" value="${esc(m.note || '')}"></label><button class="btn btn--secondario" type="submit">Salva le note</button></form>
      <p class="nota"><button class="link link--pericolo" type="button" data-elimina="${esc(m.id)}">Elimina l'impresa e i suoi dati dal server</button></p>
    </details>`;
}

function attivaAdmin(filtro) {
  const impresa = (id) => datiAdmin.imprese.find((m) => m.id === id);
  const ricarica_ = (msg) => {
    if (msg) avviso(msg);
    schermataAdmin(app.querySelector('#filtro-imprese')?.value || filtro);
  };
  const esegui = async (fn, corpo, msg) => {
    try {
      const r = await chiamaAdmin(fn, corpo);
      ricarica_(msg);
      return r;
    } catch (e) {
      avviso(`Operazione non riuscita: ${e.message}`);
      return null;
    }
  };
  const inviaWhatsApp = (m, token) => {
    const link = linkInvito(token, location.href);
    window.open(urlWhatsApp(m.telefono, messaggioInvito(m, link)), '_blank', 'noopener');
  };
  app.querySelector('#esci-admin').addEventListener('click', async () => {
    await salvaSessioneAdmin(null);
    avviso('Sei uscito dalla sezione Amministratore.');
    location.hash = '#/';
  });
  app.querySelector('#aggiorna-admin').addEventListener('click', () => ricarica_());
  let attesa;
  app.querySelector('#filtro-imprese').addEventListener('input', (e) => {
    clearTimeout(attesa);
    attesa = setTimeout(() => {
      const pos = e.target.selectionStart;
      schermataAdminFiltra(e.target.value, pos);
    }, 300);
  });
  app.querySelector('#csv-imprese').addEventListener('click', () => scarica(new Blob([csvImprese(datiAdmin.imprese)], { type: 'text/csv' }), `safetydoc-imprese-${oggiIso()}.csv`));
  app.querySelector('#nuova-impresa').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    if (String(d.ragione_sociale).trim().length < 2) return avviso('Scrivi la ragione sociale.');
    try {
      const r = await chiamaAdmin('safetydoc_admin_salva_impresa', { dati: d });
      if (d.telefono) inviaWhatsApp({ ...d }, r.invito);
      else {
        await navigator.clipboard?.writeText(linkInvito(r.invito, location.href)).catch(() => {});
        avviso('Impresa creata: link copiato, incollalo nel messaggio.');
      }
      ricarica_(d.telefono ? 'Impresa creata: invia il messaggio su WhatsApp.' : '');
    } catch (e) {
      avviso(`Impresa non creata: ${e.message}`);
    }
  });
  for (const b of app.querySelectorAll('[data-whatsapp]')) b.addEventListener('click', () => inviaWhatsApp(impresa(b.dataset.whatsapp), impresa(b.dataset.whatsapp).invito));
  for (const b of app.querySelectorAll('[data-copia]'))
    b.addEventListener('click', async () => {
      await navigator.clipboard?.writeText(linkInvito(impresa(b.dataset.copia).invito, location.href)).catch(() => {});
      avviso('Link copiato.');
    });
  for (const b of app.querySelectorAll('[data-nuovo-link]'))
    b.addEventListener('click', async () => {
      const m = impresa(b.dataset.nuovoLink);
      if (m.invito && !confirm('Il link precedente smetterà di funzionare (i dispositivi già attivi restano attivi). Continuare?')) return;
      try {
        const token = await chiamaAdmin('safetydoc_admin_nuovo_invito', { impresa: m.id });
        if (m.telefono) inviaWhatsApp(m, token);
        ricarica_('Nuovo link creato.');
      } catch (e) {
        avviso(`Link non creato: ${e.message}`);
      }
    });
  for (const b of app.querySelectorAll('[data-sospendi]'))
    b.addEventListener('click', () => {
      const motivo = prompt('Motivo della sospensione (lo vedrà l\'impresa):', 'Uso non conforme ai termini d\'uso');
      if (motivo === null) return;
      esegui('safetydoc_admin_stato_impresa', { impresa: b.dataset.sospendi, sospendi: true, motivo }, 'Impresa sospesa: i suoi dispositivi si bloccano alla prossima verifica.');
    });
  for (const b of app.querySelectorAll('[data-riattiva]')) b.addEventListener('click', () => esegui('safetydoc_admin_stato_impresa', { impresa: b.dataset.riattiva, sospendi: false, motivo: null }, 'Impresa riattivata.'));
  for (const b of app.querySelectorAll('[data-blocca]'))
    b.addEventListener('click', () => {
      const motivo = prompt('Motivo del blocco di questo dispositivo:', 'Dispositivo non autorizzato');
      if (motivo === null) return;
      esegui('safetydoc_admin_stato_dispositivo', { dispositivo: b.dataset.blocca, blocca: true, motivo }, 'Dispositivo bloccato.');
    });
  for (const b of app.querySelectorAll('[data-sblocca]')) b.addEventListener('click', () => esegui('safetydoc_admin_stato_dispositivo', { dispositivo: b.dataset.sblocca, blocca: false, motivo: null }, 'Dispositivo sbloccato.'));
  for (const b of app.querySelectorAll('[data-elimina]'))
    b.addEventListener('click', () => {
      const m = impresa(b.dataset.elimina);
      if (!confirm(`Eliminare «${m.ragione_sociale}» con dispositivi, accessi e dati di utilizzo dal server? Non si può annullare. I dati sui dispositivi dell'impresa non vengono toccati, ma l'app chiederà una nuova attivazione.`)) return;
      esegui('safetydoc_admin_elimina_impresa', { impresa: m.id }, 'Impresa eliminata dal server.');
    });
  for (const f of app.querySelectorAll('[data-note]'))
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      esegui('safetydoc_admin_salva_impresa', { dati: { id: f.dataset.note, note: new FormData(f).get('note') } }, 'Note salvate.');
    });
}

/** Filtra l'elenco senza ricaricare dal server, lasciando il cursore nella casella di ricerca. */
async function schermataAdminFiltra(filtro, pos) {
  await schermataAdmin(filtro, { usaCache: true });
  const c = app.querySelector('#filtro-imprese');
  c?.focus();
  if (c && pos !== undefined) c.setSelectionRange(pos, pos);
}

// ---------- aiuti contestuali: «?» e post-it, sigle cliccabili ----------

let guidaNascosta = false;
let regexSigleCache = null;
let mappaSigle = null;
let postitAperto = null;

function inizializzaGuida() {
  const sigle = sigleCliccabili(stato.conoscenza?.glossario);
  regexSigleCache = regexSigle(sigle);
  mappaSigle = new Map(sigle.map((g) => [g.sigla, g]));
  document.body.classList.toggle('senza-guida', guidaNascosta);
  let attesa;
  new MutationObserver(() => {
    clearTimeout(attesa);
    attesa = setTimeout(applicaGuida, 60);
  }).observe(app, { childList: true, subtree: true });
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest?.('[data-guida], abbr.sigla');
    if (b) {
      ev.preventDefault();
      ev.stopPropagation();
      if (postitAperto?.origine === b) return chiudiPostit();
      return b.dataset.guida ? apriPostitGuida(b) : apriPostitSigla(b);
    }
    if (postitAperto && !ev.target.closest?.('.postit')) chiudiPostit();
  }, true);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && postitAperto) chiudiPostit(true);
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('abbr.sigla')) {
      ev.preventDefault();
      apriPostitSigla(ev.target);
    }
  });
  addEventListener('hashchange', () => chiudiPostit());
}

/** Aggiunge i «?» della schermata corrente e rende cliccabili le sigle (una volta per schermata). */
function applicaGuida() {
  if (guidaNascosta) return;
  const rotta = rottaDa(location.hash);
  for (const v of vociPer(stato.guida?.voci, rotta)) {
    if (app.querySelector(`[data-guida="${v.id}"]`)) continue;
    const el = [...app.querySelectorAll(v.sel)].find((e) => !e.closest('.doc, .postit') && testoCorrisponde(v, e.textContent));
    if (!el) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'guida-btn';
    b.dataset.guida = v.id;
    b.setAttribute('aria-label', `Aiuto: ${v.titolo}`);
    b.setAttribute('aria-expanded', 'false');
    b.textContent = '?';
    if (v.pos === 'dopo') el.insertAdjacentElement('afterend', b);
    else if (el.tagName === 'LABEL' || v.pos === 'primo') {
      // subito dopo il testo dell'etichetta, prima del campo
      const testo = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (testo) testo.after(b);
      else el.prepend(b);
    } else el.append(b);
  }
  sigleNellaPagina();
}

function sigleNellaPagina() {
  if (!regexSigleCache) return;
  const principale = app.querySelector('.pagina');
  if (!principale || principale.dataset.sigle === location.hash) return;
  principale.dataset.sigle = location.hash;
  const viste = new Set([...principale.querySelectorAll('abbr.sigla')].map((a) => a.textContent));
  const walker = document.createTreeWalker(principale, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('.doc, a, button, label, summary, input, textarea, select, option, abbr, .postit, h1, code, .messaggio, .nota') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
  });
  const nodi = [];
  while (walker.nextNode()) nodi.push(walker.currentNode);
  for (const n of nodi) {
    const m = n.textContent.match(regexSigleCache);
    if (!m || viste.has(m[2])) continue;
    viste.add(m[2]);
    const inizio = m.index + m[1].length;
    const resto = n.splitText(inizio);
    resto.splitText(m[2].length);
    const abbr = document.createElement('abbr');
    abbr.className = 'sigla';
    abbr.tabIndex = 0;
    abbr.title = 'Tocca per la spiegazione';
    abbr.textContent = m[2];
    resto.replaceWith(abbr);
  }
}

function chiudiPostit(rimettiFocus = false) {
  if (!postitAperto) return;
  postitAperto.el.remove();
  postitAperto.origine.setAttribute?.('aria-expanded', 'false');
  if (rimettiFocus) postitAperto.origine.focus?.();
  postitAperto = null;
}

function mostraPostit(origine, html) {
  chiudiPostit();
  const el = document.createElement('div');
  el.className = 'postit';
  el.setAttribute('role', 'dialog');
  el.tabIndex = -1;
  el.innerHTML = `<button class="postit__chiudi" type="button" aria-label="Chiudi">×</button>${html}`;
  document.body.append(el);
  const r = origine.getBoundingClientRect();
  const larghezza = Math.min(320, innerWidth - 24);
  el.style.width = `${larghezza}px`;
  el.style.left = `${Math.max(12, Math.min(r.left + r.width / 2 - larghezza / 2, innerWidth - larghezza - 12)) + scrollX}px`;
  const sotto = r.bottom + 8 + el.offsetHeight < innerHeight || r.top < el.offsetHeight + 8;
  el.style.top = `${(sotto ? r.bottom + 8 : r.top - el.offsetHeight - 8) + scrollY}px`;
  origine.setAttribute?.('aria-expanded', 'true');
  postitAperto = { el, origine };
  el.querySelector('.postit__chiudi').addEventListener('click', () => chiudiPostit(true));
  el.querySelector('[data-chiedi]')?.addEventListener('click', (ev) => {
    ev.preventDefault();
    try {
      sessionStorage.setItem('richiesta:bozza', JSON.stringify({ oggetto: ev.currentTarget.dataset.chiedi, schermata: rottaDa(location.hash) }));
    } catch {
      /* senza sessionStorage si apre solo la pagina */
    }
    chiudiPostit();
    location.hash = '#/richieste';
  });
  el.querySelector('[data-leggi]')?.addEventListener('click', () => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(el.innerText.replace(/[×🔊]/g, ''));
    u.lang = 'it-IT';
    speechSynthesis.speak(u);
  });
  for (const a of el.querySelectorAll('a[href^="#/"]')) a.addEventListener('click', () => chiudiPostit());
  el.focus({ preventScroll: true });
}

const chiediANoi = (titolo) => (account?.chiave ? `<a href="#/richieste" data-chiedi="${esc(`Dubbio: ${titolo}`.slice(0, 140))}">Non è chiaro? Chiedi a noi</a>` : '');
const leggi = () => ('speechSynthesis' in window ? '<button class="link" type="button" data-leggi>🔊 Leggi ad alta voce</button>' : '');

function apriPostitGuida(b) {
  const v = stato.guida?.voci?.find((x) => x.id === b.dataset.guida);
  if (!v) return;
  registraUso('schermata', eventoGuida('guida', v.id));
  mostraPostit(
    b,
    `<p class="postit__titolo">${esc(v.titolo)}</p>
     <p><strong>Cos'è:</strong> ${esc(v.cosa)}</p>
     <p><strong>Perché:</strong> ${esc(v.perche)}</p>
     <p><strong>Cosa fare:</strong> ${esc(v.dopo)}</p>
     <p class="postit__link">${v.link ? `<a href="${esc(v.link.href)}">${esc(v.link.testo)} ›</a>` : ''}${chiediANoi(v.titolo)}${leggi()}</p>`
  );
}

function apriPostitSigla(a) {
  const g = mappaSigle?.get(a.textContent);
  if (!g) return;
  registraUso('schermata', eventoGuida('sigla', idSigla(g.sigla)));
  mostraPostit(a, `<p class="postit__titolo">${esc(g.sigla)}</p><p>${esc(g.testo)}</p><p class="postit__link"><a href="#/sapere/sigla/${esc(idSigla(g.sigla))}">Approfondisci ›</a>${leggi()}</p>`);
}

async function impostaGuidaNascosta(nascosta) {
  guidaNascosta = nascosta;
  await store.scriviMeta('guida:nascosta', nascosta);
  document.body.classList.toggle('senza-guida', nascosta);
  if (!nascosta) applicaGuida();
}

// ---------- richieste e assistenza (ticket) ----------

let ultimaRotta = '';

const cardStatoRichiesta = (stato) => {
  const [col, et] = STATI_RICHIESTA[stato] || ['info', stato];
  return `<span class="pill pill--${col}">${esc(et)}</span>`;
};

function senzaAccountRichieste() {
  app.innerHTML = `<section class="pagina"><h1>Richieste e assistenza</h1><p class="lead">Le richieste si inviano da un dispositivo attivato con il link dell'impresa.</p>${
    sessioneAdmin?.refreshToken ? '<a class="btn btn--primario" href="#/admin">Vai alle richieste delle imprese</a>' : ''
  }</section>`;
}

async function caricaRichieste() {
  return rpc('safetydoc_richieste_elenco', { dispositivo: account.dispositivo, chiave: account.chiave });
}

async function schermataRichieste() {
  if (!account?.chiave) return senzaAccountRichieste();
  app.innerHTML = '<section class="pagina"><h1>Richieste e assistenza</h1><p>Carico le richieste…</p></section>';
  let elenco = [];
  let errore = '';
  try {
    elenco = navigator.onLine ? await caricaRichieste() : [];
    if (!navigator.onLine) errore = 'Serve la connessione a internet per vedere e inviare le richieste.';
  } catch (e) {
    errore = erroreRichiesta(e);
  }
  let bozza = null;
  try {
    bozza = JSON.parse(sessionStorage.getItem('richiesta:bozza') || 'null');
    sessionStorage.removeItem('richiesta:bozza');
  } catch {
    bozza = null;
  }
  const schermata = bozza?.schermata || (ultimaRotta && !/^(richieste|invito|admin|dati|oggi)/.test(ultimaRotta) ? ultimaRotta : '');
  app.innerHTML = `
    <section class="pagina">
      <h1>Richieste e assistenza</h1>
      <p class="lead">Scrivi per chiedere aiuto o informazioni, segnalare un problema o proporre una modifica o un miglioramento. Ti rispondiamo qui.</p>
      ${errore ? `<p class="esito esito--errore">${esc(errore)}</p>` : ''}
      <details class="opzioni-doc" ${elenco.length && !bozza ? '' : 'open'} id="nuova-richiesta-box">
        <summary>+ Nuova richiesta</summary>
        <form id="nuova-richiesta">
          <label>Di cosa si tratta?<select class="campo" name="tipo" required>${Object.entries(TIPI_RICHIESTA).map(([k, v]) => `<option value="${k}" ${bozza && k === 'aiuto' ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
          <label>Oggetto<input class="campo" name="oggetto" maxlength="140" required placeholder="es. Come compilo il POS per un cantiere stradale?" value="${esc(bozza?.oggetto || '')}"></label>
          <label>Descrivi la richiesta<textarea class="campo" name="testo" rows="6" maxlength="4000" required></textarea></label>
          ${schermata ? `<label class="spunta-semplice"><input type="checkbox" name="schermata" value="${esc(schermata)}" checked> Riguarda la pagina che stavi guardando (${esc(schermata)})</label>` : ''}
          <p class="nota">Non scrivere dati personali dei lavoratori (salute, idoneità, infortuni): servono solo le informazioni sulla tua domanda.</p>
          <p class="esito esito--errore" id="errori-richiesta" hidden></p>
          <button class="btn btn--primario" type="submit">Invia la richiesta</button>
        </form>
      </details>
      <h2>Le tue richieste <span class="conta">${elenco.length}</span></h2>
      ${
        elenco.length
          ? `<div class="lista">${elenco
              .map(
                (r) => `<a class="voce voce--doc" href="#/richieste/${esc(r.id)}">
                  <span class="voce__segno" aria-hidden="true">${r.letta === false ? '●' : '✉'}</span>
                  <span class="voce__testo"><span class="voce__titolo">n. ${r.numero} · ${esc(r.oggetto)}</span>
                  <span class="voce__stato">${cardStatoRichiesta(r.stato)} ${esc(TIPI_RICHIESTA[r.tipo] || r.tipo)} · ${esc(dataOra(r.aggiornata_il))}${r.letta === false ? ' · <strong>nuova risposta</strong>' : ''}</span></span>
                  <span class="voce__freccia" aria-hidden="true">›</span>
                </a>`
              )
              .join('')}</div>`
          : '<p class="nota">Nessuna richiesta inviata.</p>'
      }
    </section>`;
  const form = app.querySelector('#nuova-richiesta');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = datiRichiesta(Object.fromEntries(new FormData(form)));
    const box = app.querySelector('#errori-richiesta');
    const errori = erroriRichiesta(d);
    if (errori.length) {
      box.hidden = false;
      box.textContent = errori.join(' ');
      return;
    }
    const b = form.querySelector('button[type=submit]');
    b.disabled = true;
    try {
      const r = await rpc('safetydoc_richiesta_nuova', { dispositivo: account.dispositivo, chiave: account.chiave, dati: { ...d, versione: VERSIONE_APP } });
      registraUso('schermata', 'richiesta-inviata');
      avviso(`Richiesta n. ${r.numero} inviata: riceverai la risposta qui.`);
      location.hash = `#/richieste/${r.id}`;
    } catch (e) {
      box.hidden = false;
      box.textContent = erroreRichiesta(e);
      b.disabled = false;
    }
  });
}

function conversazione(messaggi, chiSono) {
  return `<div class="conversazione">${(messaggi || [])
    .map(
      (m) => `<div class="messaggio messaggio--${m.autore === chiSono ? 'mio' : 'altro'}">
        <p class="messaggio__chi">${m.autore === 'admin' ? 'Assistenza safetyDoc' : 'Impresa'} · ${esc(dataOra(m.ts))}</p>
        <p class="messaggio__testo">${esc(m.testo).replace(/\n/g, '<br>')}</p>
      </div>`
    )
    .join('')}</div>`;
}

async function schermataRichiesta(id) {
  if (!account?.chiave) return senzaAccountRichieste();
  let r = null;
  try {
    r = (await caricaRichieste()).find((x) => x.id === id);
  } catch (e) {
    app.innerHTML = `<section class="pagina"><a class="indietro" href="#/richieste">‹ Richieste</a><p class="esito esito--errore">${esc(erroreRichiesta(e))}</p></section>`;
    return;
  }
  if (!r) return (location.hash = '#/richieste');
  if (r.letta === false) {
    rpc('safetydoc_richiesta_letta', { dispositivo: account.dispositivo, chiave: account.chiave, richiesta: id }).catch(() => {});
    if (account.risposte) await salvaAccount({ ...account, risposte: Math.max(0, account.risposte - 1) });
  }
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="#/richieste">‹ Richieste</a>
      <p class="sopratitolo">Richiesta n. ${r.numero} · ${esc(TIPI_RICHIESTA[r.tipo] || r.tipo)}</p>
      <h1>${esc(r.oggetto)}</h1>
      <p>${cardStatoRichiesta(r.stato)} · aperta il ${esc(dataOra(r.creata_il))}</p>
      ${conversazione(r.messaggi, 'impresa')}
      <form id="scrivi-richiesta">
        <label>${r.stato === 'chiusa' ? 'Scrivi per riaprire la richiesta' : 'Aggiungi un messaggio'}<textarea class="campo" name="testo" rows="4" maxlength="4000" required></textarea></label>
        <button class="btn btn--primario" type="submit">Invia</button>
      </form>
      ${r.stato !== 'chiusa' ? '<button class="btn btn--secondario" type="button" id="chiudi-richiesta">Ho risolto: chiudi la richiesta</button>' : ''}
    </section>`;
  const invia_ = async (corpo, msg) => {
    try {
      await rpc('safetydoc_richiesta_scrivi', { dispositivo: account.dispositivo, chiave: account.chiave, richiesta: id, ...corpo });
      avviso(msg);
      schermataRichiesta(id);
    } catch (e) {
      avviso(erroreRichiesta(e));
    }
  };
  app.querySelector('#scrivi-richiesta').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const testo = String(new FormData(ev.target).get('testo')).trim();
    if (testo) invia_({ testo, chiudi: false }, 'Messaggio inviato.');
  });
  app.querySelector('#chiudi-richiesta')?.addEventListener('click', () => invia_({ testo: null, chiudi: true }, 'Richiesta chiusa. Grazie!'));
}

function bloccoRisposteOggi() {
  if (!account?.risposte) return '';
  return `<a class="banner banner--scadenze" href="#/richieste"><strong>${account.risposte === 1 ? 'Hai una nuova risposta' : `Hai ${account.risposte} nuove risposte`} alle tue richieste</strong><span>Tocca qui per leggerle</span></a>`;
}

// ---------- richieste nella sezione Amministratore ----------

let richiesteAdmin = [];

function bloccoRichiesteAdmin() {
  const nuove = richiesteAdmin.filter((r) => r.letta === false);
  const aperte = richiesteAdmin.filter((r) => r.stato !== 'chiusa');
  return `<h2>Richieste delle imprese <span class="conta">${aperte.length} aperte${nuove.length ? ` · ${nuove.length} da leggere` : ''}</span></h2>
    ${
      aperte.length
        ? `<div class="lista">${aperte
            .slice(0, 30)
            .map(
              (r) => `<a class="voce voce--doc" href="#/admin/richiesta/${esc(r.id)}">
                <span class="voce__segno" aria-hidden="true">${r.letta === false ? '●' : '✉'}</span>
                <span class="voce__testo"><span class="voce__titolo">n. ${r.numero} · ${esc(r.oggetto)}</span>
                <span class="voce__stato">${cardStatoRichiesta(r.stato)} ${esc(r.impresa.ragione_sociale)} · ${esc(TIPI_RICHIESTA[r.tipo] || r.tipo)} · ${esc(dataOra(r.aggiornata_il))}</span></span>
                <span class="voce__freccia" aria-hidden="true">›</span>
              </a>`
            )
            .join('')}</div>`
        : '<p class="nota">Nessuna richiesta aperta.</p>'
    }
    ${richiesteAdmin.length > aperte.length ? `<details><summary>Richieste chiuse (${richiesteAdmin.length - aperte.length})</summary><div class="lista">${richiesteAdmin
      .filter((r) => r.stato === 'chiusa')
      .map((r) => `<a class="voce voce--doc" href="#/admin/richiesta/${esc(r.id)}"><span class="voce__testo"><span class="voce__titolo">n. ${r.numero} · ${esc(r.oggetto)}</span><span class="voce__stato">${esc(r.impresa.ragione_sociale)} · ${esc(dataOra(r.aggiornata_il))}</span></span></a>`)
      .join('')}</div></details>` : ''}`;
}

async function schermataAdminRichiesta(id) {
  if (!sessioneAdmin?.refreshToken) return schermataLoginAdmin();
  try {
    richiesteAdmin = await chiamaAdmin('safetydoc_admin_richieste');
  } catch (e) {
    app.innerHTML = `<section class="pagina"><a class="indietro" href="#/admin">‹ Amministratore</a><p class="esito esito--errore">${esc(erroreRichiesta(e))}</p></section>`;
    return;
  }
  const r = richiesteAdmin.find((x) => x.id === id);
  if (!r) return (location.hash = '#/admin');
  if (r.letta === false) chiamaAdmin('safetydoc_admin_richiesta', { richiesta: id, testo: null, stato: null }).catch(() => {});
  app.innerHTML = `
    <section class="pagina admin">
      <a class="indietro" href="#/admin">‹ Amministratore</a>
      <p class="sopratitolo">Richiesta n. ${r.numero} · ${esc(TIPI_RICHIESTA[r.tipo] || r.tipo)}</p>
      <h1>${esc(r.oggetto)}</h1>
      <p>${cardStatoRichiesta(r.stato)} · <strong>${esc(r.impresa.ragione_sociale)}</strong>${r.impresa.referente ? ` · ${esc(r.impresa.referente)}` : ''}${r.impresa.telefono ? ` · ${esc(r.impresa.telefono)}` : ''}${r.impresa.email ? ` · ${esc(r.impresa.email)}` : ''}</p>
      <p class="nota">Aperta il ${esc(dataOra(r.creata_il))}${r.schermata ? ` · dalla pagina «${esc(r.schermata)}»` : ''}${r.versione ? ` · versione ${esc(r.versione)}` : ''}</p>
      ${conversazione(r.messaggi, 'admin')}
      <form id="risposta-admin">
        <label>Risposta<textarea class="campo" name="testo" rows="6" maxlength="4000"></textarea></label>
        <label>Stato dopo l'invio<select class="campo" name="stato">${Object.entries(STATI_RICHIESTA).map(([k, [, et]]) => `<option value="${k}" ${k === 'risposta' ? 'selected' : ''}>${esc(et)}</option>`).join('')}</select></label>
        <button class="btn btn--primario" type="submit">Invia la risposta</button>
      </form>
      <div class="azioni">
        ${r.stato !== 'in_lavorazione' ? '<button class="btn btn--secondario" type="button" data-stato-richiesta="in_lavorazione">Segna «in lavorazione»</button>' : ''}
        ${r.stato !== 'chiusa' ? '<button class="btn btn--secondario" type="button" data-stato-richiesta="chiusa">Chiudi la richiesta</button>' : '<button class="btn btn--secondario" type="button" data-stato-richiesta="aperta">Riapri</button>'}
        ${r.impresa.telefono ? `<a class="btn btn--secondario" target="_blank" rel="noopener" href="${esc(urlWhatsApp(r.impresa.telefono, avvisoRisposta(r)))}">Avvisa su WhatsApp</a>` : ''}
      </div>
    </section>`;
  app.querySelector('#risposta-admin').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const testo = String(f.get('testo')).trim();
    if (!testo) return avviso('Scrivi la risposta.');
    try {
      await chiamaAdmin('safetydoc_admin_richiesta', { richiesta: id, testo, stato: f.get('stato') });
      avviso('Risposta inviata: l\'impresa la vedrà alla prossima apertura dell\'app.');
      schermataAdminRichiesta(id);
    } catch (e) {
      avviso(`Risposta non inviata: ${e.message}`);
    }
  });
  for (const b of app.querySelectorAll('[data-stato-richiesta]'))
    b.addEventListener('click', async () => {
      try {
        await chiamaAdmin('safetydoc_admin_richiesta', { richiesta: id, testo: null, stato: b.dataset.statoRichiesta });
        schermataAdminRichiesta(id);
      } catch (e) {
        avviso(`Operazione non riuscita: ${e.message}`);
      }
    });
}

// ---------- dati di utilizzo anonimi (con consenso) ----------

let codaUso = null;

async function consensoUso() {
  const c = await store.leggiMeta('uso:consenso');
  // dalla 0.20 i dati di utilizzo sono collegati all'account: il consenso dato prima (anonimo) va richiesto di nuovo
  return c?.versione === 2 ? c.scelta : null; // 'si' | 'no' | null (non ancora chiesto)
}

async function idUso() {
  let id = await store.leggiMeta('uso:id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : store.nuovoId();
    await store.scriviMeta('uso:id', id);
  }
  return id;
}

/** Annota un evento di utilizzo (solo con il consenso; mai nomi o contenuti). */
async function registraUso(tipo, nome = '') {
  try {
    if ((await consensoUso()) !== 'si') return;
    if (!codaUso) codaUso = (await store.leggiMeta('uso:coda')) || [];
    codaUso = accoda(codaUso, tipo, nome);
    await store.scriviMeta('uso:coda', codaUso);
  } catch {
    /* i dati di utilizzo non devono mai disturbare l'app */
  }
}

let invioInCorso = false;
async function inviaUso() {
  if (invioInCorso || !navigator.onLine) return;
  invioInCorso = true;
  try {
    if ((await consensoUso()) !== 'si') return;
    codaUso = (await store.leggiMeta('uso:coda')) || [];
    const ultimo = await store.leggiMeta('uso:ultimoInvio');
    if (!codaUso.length && ultimo && ultimo.slice(0, 10) === oggiIso()) return;
    const p = pacchetto({
      id: await idUso(),
      versione: VERSIONE_APP,
      ua: navigator.userAgent,
      installata: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
      ateco: risposte().ateco,
      numeroLavoratori: haDipendenti() ? risposte().numero_lavoratori : 0,
      coda: codaUso
    });
    await invia(p);
    const inviati = p.eventi.length;
    codaUso = ((await store.leggiMeta('uso:coda')) || []).slice(inviati);
    await store.scriviMeta('uso:coda', codaUso);
    await store.scriviMeta('uso:ultimoInvio', new Date().toISOString());
  } catch {
    /* riproveremo alla prossima apertura */
  } finally {
    invioInCorso = false;
  }
}

async function impostaConsensoUso(scelta) {
  await store.scriviMeta('uso:consenso', { scelta, versione: 2, data: new Date().toISOString() });
  if (scelta === 'si') {
    await registraUso('apertura', 'consenso');
    inviaUso();
  } else {
    codaUso = [];
    await store.scriviMeta('uso:coda', []);
  }
}

const INFORMATIVA_USO = `Se accetti, safetyDoc invia ogni giorno, quando c'è connessione, quali schermate, documenti e funzioni usi
  (per esempio «DVR aperto», «promemoria inviato»), insieme alla versione dell'app, al tipo di dispositivo, alla divisione ATECO e alla fascia di
  lavoratori. Questi dati sono collegati all'account della tua impresa. Non inviamo mai cosa scrivi: nomi dei lavoratori, contenuti dei documenti
  e allegati restano sul dispositivo. Servono a capire cosa funziona e cosa migliorare. Sono conservati su server nell'Unione europea
  (Supabase, Irlanda) per 12 mesi e non registriamo gli indirizzi IP. Puoi cambiare idea quando vuoi in Dati, e cancellare i dati già inviati.`;

async function bloccoConsensoOggi() {
  if ((await consensoUso()) !== null) return '';
  return `<section class="riquadro consenso-uso" aria-labelledby="titolo-consenso">
      <h2 id="titolo-consenso">Ci aiuti a migliorare safetyDoc?</h2>
      <p>Possiamo sapere quali schermate, documenti e funzioni usi, per migliorare l'app. Mai cosa scrivi: lavoratori, documenti e allegati restano sul tuo dispositivo.</p>
      <details><summary>Cosa inviamo esattamente</summary><p class="nota">${INFORMATIVA_USO}</p></details>
      <div class="azioni">
        <button class="btn btn--primario" type="button" data-consenso="si">Sì, va bene</button>
        <button class="btn btn--secondario" type="button" data-consenso="no">No, grazie</button>
      </div>
    </section>`;
}

function attivaConsenso(ridisegna) {
  for (const b of app.querySelectorAll('[data-consenso]'))
    b.addEventListener('click', async () => {
      await impostaConsensoUso(b.dataset.consenso);
      avviso(b.dataset.consenso === 'si' ? 'Grazie! Puoi cambiare idea quando vuoi in Dati.' : 'Va bene: non inviamo nulla. Puoi cambiare idea in Dati.');
      ridisegna();
    });
}

async function bloccoUsoDati() {
  const c = await consensoUso();
  const ultimo = await store.leggiMeta('uso:ultimoInvio');
  return `<h2 id="dati-utilizzo">Dati di utilizzo</h2>
      <p>${c === 'si' ? `<strong>Attivo.</strong>${ultimo ? ` Ultimo invio: ${esc(new Date(ultimo).toLocaleString('it-IT'))}.` : ' Nessun invio ancora.'}` : c === 'no' ? '<strong>Non attivo:</strong> non inviamo nulla.' : 'Non hai ancora scelto: per ora non inviamo nulla.'}</p>
      <details><summary>Cosa inviamo e perché</summary><p class="nota">${INFORMATIVA_USO}</p></details>
      <div class="azioni">
        ${c === 'si' ? '<button class="btn btn--secondario" type="button" data-consenso="no">Non inviare più</button><button class="btn btn--secondario" type="button" id="cancella-uso">Cancella i dati già inviati</button>' : '<button class="btn btn--secondario" type="button" data-consenso="si">Invia i dati di utilizzo</button>'}
      </div>`;
}

function attivaUsoDati(ridisegna) {
  attivaConsenso(ridisegna);
  app.querySelector('#cancella-uso')?.addEventListener('click', async () => {
    if (!confirm('Cancellare tutti i dati di utilizzo inviati da questo dispositivo? Non si possono recuperare.')) return;
    try {
      await cancellaDati(await idUso());
      await store.scriviMeta('uso:id', null);
      await impostaConsensoUso('no');
      avviso('Dati cancellati. Non inviamo più nulla da questo dispositivo.');
    } catch {
      avviso('Non è stato possibile cancellare ora: riprova quando c\'è connessione.');
    }
    ridisegna();
  });
}

/** Nome da annotare per una rotta: mai identificativi di persone, macchine o documenti dell'archivio. */
function nomeRotta(rotta, param) {
  if (rotta === 'sapere') return `sapere:${param || ''}`;
  return rotta || 'oggi';
}

// ---------- scadenzario e promemoria al responsabile ----------

const CAMPI_RESPONSABILE = [
  ['nome', 'Nome e cognome', 'text', 'name'],
  ['ruolo', 'Ruolo (es. RSPP esterno, consulente, titolare)', 'text', 'organization-title'],
  ['email', 'Email', 'email', 'email'],
  ['telefono', 'Cellulare (anche WhatsApp)', 'tel', 'tel']
];

/** Chi riceve i promemoria: se non è indicato, l'RSPP o il titolare. */
function responsabile() {
  const r = { ...(stato.profilo?.responsabile || {}) };
  const a = anagrafica();
  if (!r.nome) r.nome = a.rspp || a.titolare || '';
  if (!r.ruolo) r.ruolo = a.rspp ? 'RSPP' : risposte().dl_rspp ? 'Datore di lavoro e RSPP' : '';
  r.giorni = Number(r.giorni) || 60;
  r.frequenza = Number(r.frequenza) || 30;
  return r;
}

/** Documenti con una revisione periodica propria e la data in cui sono stati adottati. */
function documentiConData() {
  return MODELLI.filter((m) => stato.conoscenza?.documenti?.[m.id]?.revisione?.mesi)
    .map((m) => ({ modello: m, regola: stato.conoscenza.documenti[m.id].revisione, data: statoCorrente(chiaveDocumento(m.id), stato.adempimenti)?.dataFatto || null }))
    .filter((x) => x.data);
}

function scadenzeAttuali() {
  if (!questionarioCompletato()) return [];
  return raccogliScadenze({
    piano: piano(),
    situazioni: haDipendenti() ? attivi().map(situazione) : [],
    macchine: macchine().map(situazioneMacchina),
    archivio: stato.archivio,
    defArchivio: stato.defArchivio,
    documenti: documentiConData(),
    eventi: stato.eventi,
    catalogo: stato.catalogo,
    nomeCompleto,
    oggi: oggiIso()
  });
}

const COLORE_STATO = { scaduta: 'rosso', dafare: 'rosso', entro30: 'giallo', entro90: 'info', oltre: 'verde' };
const ETICHETTA_OBBLIGO = { legge: 'Obbligo di legge', contratto: 'Da contratto', prassi: 'Buona prassi', 'norma tecnica': 'Norma tecnica' };

function cardScadenza(x) {
  const col = COLORE_STATO[x.stato];
  const quando = x.data ? (x.stato === 'scaduta' ? `Scaduta il ${dataLeggibile(x.data)}` : `Entro il ${dataLeggibile(x.data)}`) : 'Senza data';
  return `<a class="voce voce--${col}" href="${esc(x.href)}">
      <span class="voce__segno" aria-hidden="true">${(ETICHETTE[col] || ETICHETTE.info).icona}</span>
      <span class="voce__testo">
        <span class="voce__titolo">${esc(x.titolo)}</span>
        <span class="voce__stato"><strong>${esc(quando)}</strong>${x.senzaData ? ` · ${esc(x.senzaData)}` : ''}${x.norma ? ` · ${esc(x.norma)}` : ''}${x.obbligo && x.obbligo !== 'legge' ? ` · <em>${esc(ETICHETTA_OBBLIGO[x.obbligo] || x.obbligo)}</em>` : ''}</span>
      </span>
      <span class="voce__freccia" aria-hidden="true">›</span>
    </a>`;
}

async function registroPromemoria() {
  return (await store.leggiMeta('promemoria:inviati')) || [];
}

async function annotaPromemoria(canale, numero) {
  const elenco = await registroPromemoria();
  elenco.unshift({ data: new Date().toISOString(), canale, numero, a: responsabile().nome || '' });
  registraUso('promemoria', canale === 'WhatsApp' ? 'whatsapp' : canale);
  await store.scriviMeta('promemoria:inviati', elenco.slice(0, 50));
}

/** Da quanti giorni non si manda il promemoria al responsabile (null se mai). */
async function giorniDallUltimoPromemoria() {
  const ultimo = (await registroPromemoria())[0];
  return ultimo ? giorniTra(ultimo.data.slice(0, 10), oggiIso()) : null;
}

async function bloccoScadenzarioOggi() {
  const lista = scadenzeAttuali();
  const c = conteggiScadenze(lista);
  const r = responsabile();
  const g = await giorniDallUltimoPromemoria();
  const urgenti = c.scaduta + c.entro30;
  const daMandare = urgenti + c.dafare > 0 && (g === null || g >= r.frequenza);
  return `<a class="banner banner--scadenze ${c.scaduta ? 'banner--rosso' : ''}" href="#/scadenzario">
      <strong>Scadenzario: ${c.scaduta} ${c.scaduta === 1 ? 'scaduta' : 'scadute'} · ${c.entro30} entro 30 giorni · ${c.entro90} entro 90</strong>
      <span>${daMandare ? `Invia il promemoria a ${esc(r.nome || 'il responsabile')}${g === null ? '' : `: l'ultimo è di ${g} giorni fa`}` : 'Tutte le date calcolate secondo le norme, in un solo elenco'}</span>
    </a>`;
}

async function schermataScadenzario(filtro = '') {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const tutte = scadenzeAttuali();
  const lista = filtro ? tutte.filter((x) => x.area === filtro) : tutte;
  const c = conteggiScadenze(tutte);
  const r = responsabile();
  const inviati = await registroPromemoria();
  const notifiche = 'Notification' in window ? Notification.permission : 'non-supportate';
  app.innerHTML = `
    <section class="pagina">
      <h1>Scadenzario</h1>
      <p class="lead">Tutte le scadenze dell'impresa in un solo elenco: adempimenti, lavoratori, macchine, certificati, documenti da rivedere e infortuni. Le date sono calcolate dalla norma di riferimento indicata accanto a ciascuna.</p>
      <div class="contatori" role="list">
        <span role="listitem" class="contatore contatore--rosso"><strong>${c.scaduta}</strong><span>scadute</span></span>
        <span role="listitem" class="contatore contatore--giallo"><strong>${c.entro30}</strong><span>entro 30 giorni</span></span>
        <span role="listitem" class="contatore contatore--verde"><strong>${c.entro90}</strong><span>entro 90 giorni</span></span>
      </div>

      <section class="riquadro promemoria" aria-labelledby="titolo-promemoria">
        <h2 id="titolo-promemoria">Promemoria al responsabile</h2>
        ${
          r.nome || r.email || r.telefono
            ? `<p><strong>${esc(r.nome || 'Responsabile')}</strong>${r.ruolo ? ` · ${esc(r.ruolo)}` : ''}${r.email ? `<br>${esc(r.email)}` : ''}${r.telefono ? `<br>${esc(r.telefono)}` : ''} · <a href="#/dati/responsabile">Cambia</a></p>`
            : `<p>Indica chi deve ricevere i promemoria (RSPP, consulente o tu stesso). <a href="#/dati/responsabile">Inserisci il responsabile</a></p>`
        }
        <p class="nota">${inviati.length ? `Ultimo promemoria: ${esc(new Date(inviati[0].data).toLocaleDateString('it-IT'))} via ${esc(inviati[0].canale)}${inviati[0].a ? ` a ${esc(inviati[0].a)}` : ''} (${inviati[0].numero} scadenze).` : 'Nessun promemoria inviato finora.'} Te lo ricordiamo ogni ${r.frequenza} giorni.</p>
        <label class="spunta-semplice"><input type="checkbox" id="con-nomi"> Includi i nomi dei lavoratori <small>(solo se il destinatario è l'RSPP, il medico o il consulente)</small></label>
        <div class="azioni">
          ${r.email ? '<button class="btn btn--primario" type="button" data-invia="email">Invia per email</button>' : ''}
          ${r.telefono ? '<button class="btn btn--primario" type="button" data-invia="whatsapp">Invia su WhatsApp</button>' : ''}
          <button class="btn btn--secondario" type="button" data-invia="condividi">${'share' in navigator ? 'Condividi' : 'Copia il testo'}</button>
          <button class="btn btn--secondario" type="button" id="calendario-resp">Calendario con avvisi (.ics)</button>
          <a class="btn btn--secondario" href="#/documento/scadenzario">Stampa lo scadenzario</a>
        </div>
        <p class="nota">Il calendario aggiunge ogni scadenza con un avviso 30 e 7 giorni prima: mandalo al responsabile, così riceve gli avvisi sul suo telefono.</p>
        <h3>Notifiche su questo dispositivo</h3>
        <p id="stato-notifiche">${
          notifiche === 'granted'
            ? 'Attive: ti avvisiamo 30 giorni prima, 7 giorni prima e il giorno della scadenza.'
            : notifiche === 'denied'
              ? 'Bloccate nelle impostazioni del browser: per riceverle, consentile per safetyDoc.'
              : notifiche === 'non-supportate'
                ? 'Questo browser non supporta le notifiche: usa il calendario.'
                : 'Non ancora attive.'
        }</p>
        ${notifiche === 'default' ? '<button class="btn btn--secondario" type="button" id="attiva-notifiche">Attiva le notifiche</button>' : ''}
      </section>

      <label>Mostra<select class="campo" id="filtro-area"><option value="">Tutte le scadenze (${tutte.length})</option>${Object.entries(AREE)
        .map(([k, v]) => [k, v, tutte.filter((x) => x.area === k).length])
        .filter(([, , n]) => n)
        .map(([k, v, n]) => `<option value="${k}" ${filtro === k ? 'selected' : ''}>${esc(v)} (${n})</option>`)
        .join('')}</select></label>
      ${
        lista.length
          ? raggruppaScadenze(lista)
              .map((g) =>
                g.stato === 'dafare' && !filtro
                  ? `<details class="gruppo-apribile"><summary><h2 class="gruppo gruppo--rosso">${esc(g.titolo)} <span>${g.voci.length}</span></h2></summary><p class="nota">Adempimenti, corsi e controlli mai registrati o senza data: quando li registri, la scadenza si calcola da sola.</p><div class="lista">${g.voci.map(cardScadenza).join('')}</div></details>`
                  : `<h2 class="gruppo gruppo--${COLORE_STATO[g.stato]}">${esc(g.titolo)} <span>${g.voci.length}</span></h2><div class="lista">${g.voci.map(cardScadenza).join('')}</div>`
              )
              .join('')
          : '<p>Nessuna scadenza in questo elenco.</p>'
      }
      <p class="nota">Le date seguono le norme indicate; «buona prassi» e «da contratto» non sono obblighi di legge ma scadenze utili. Verificale con il tuo consulente.</p>
    </section>`;
  app.querySelector('#filtro-area').addEventListener('change', (e) => (location.hash = e.target.value ? `#/scadenzario/${e.target.value}` : '#/scadenzario'));
  app.querySelector('#calendario-resp').addEventListener('click', async () => {
    await esportaCalendario();
    await annotaPromemoria('calendario', tutte.filter((x) => x.data).length);
  });
  app.querySelector('#attiva-notifiche')?.addEventListener('click', async () => {
    const esito = await attivaNotifiche();
    avviso(esito ? 'Notifiche attive.' : 'Notifiche non attivate.');
    schermataScadenzario(filtro);
  });
  for (const b of app.querySelectorAll('[data-invia]'))
    b.addEventListener('click', async () => {
      const canale = b.dataset.invia;
      const p = testoPromemoria(tutte, { impresa: anagrafica().ragioneSociale || risposte().nome_impresa || '', oggi: oggiIso(), giorni: r.giorni, conNomi: app.querySelector('#con-nomi').checked, responsabile: r.nome });
      if (canale === 'email') location.href = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(p.oggetto)}&body=${encodeURIComponent(p.testo)}`;
      else if (canale === 'whatsapp') window.open(`https://wa.me/${numeroWhatsApp(r.telefono)}?text=${encodeURIComponent(`${p.oggetto}\n\n${p.testo}`)}`, '_blank', 'noopener');
      else if ('share' in navigator) {
        try {
          await navigator.share({ title: p.oggetto, text: p.testo });
        } catch (e) {
          if (e.name === 'AbortError') return;
        }
      } else {
        await navigator.clipboard?.writeText(`${p.oggetto}\n\n${p.testo}`).catch(() => {});
        avviso('Testo copiato: incollalo nel messaggio al responsabile.');
      }
      await annotaPromemoria({ email: 'email', whatsapp: 'WhatsApp', condividi: 'condivisione' }[canale], p.numero);
      setTimeout(() => schermataScadenzario(filtro), 500);
    });
}

// ---------- notifiche ----------

async function attivaNotifiche() {
  if (!('Notification' in window)) return false;
  const p = await Notification.requestPermission();
  if (p !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.ready;
    // Chrome su Android con l'app installata: controllo una volta al giorno anche ad app chiusa.
    if (reg?.periodicSync) await reg.periodicSync.register('scadenze', { minInterval: 24 * 60 * 60 * 1000 });
  } catch {
    /* non disponibile: le notifiche arrivano quando apri l'app */
  }
  await controllaNotifiche();
  return true;
}

/** Aggiorna l'elenco per il service worker e mostra le notifiche nuove. */
async function controllaNotifiche() {
  if (!questionarioCompletato()) return;
  const lista = scadenzeAttuali();
  await store.scriviMeta('scadenzario:prossime', perServiceWorker(lista));
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const notificate = new Set((await store.leggiMeta('scadenzario:notificate')) || []);
  const nuove = daNotificare(lista, oggiIso(), notificate);
  if (!nuove.length) return;
  const t = testoNotifica(nuove);
  try {
    const reg = await navigator.serviceWorker?.ready;
    const opzioni = { body: t.corpo, tag: 'safetydoc-scadenze', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: '#/scadenzario' } };
    if (reg?.showNotification) await reg.showNotification(t.titolo, opzioni);
    else new Notification(t.titolo, opzioni);
  } catch {
    return;
  }
  await store.scriviMeta('scadenzario:notificate', [...notificate, ...nuove.map((n) => n.chiave)].slice(-500));
}

// ---------- data e revisione di ogni documento ----------

function regolaRevisione(modelloId) {
  return stato.conoscenza?.documenti?.[modelloId]?.revisione || null;
}

/** Riquadro con la data del documento e la prossima revisione calcolata dalla norma. */
function bloccoRevisioneDocumento(m) {
  const regola = regolaRevisione(m.id);
  if (!regola || m.ambito !== 'impresa') return '';
  if (regola.evento)
    return `<details class="opzioni-doc revisione-doc"><summary>Quando va aggiornato</summary><p>${esc(regola.evento)}</p><p class="nota">${esc(regola.norma || '')}</p></details>`;
  const chiave = regola.scheda || chiaveDocumento(m.id);
  const st = statoCorrente(chiave, stato.adempimenti);
  const scheda = regola.scheda ? stato.catalogo.schede.find((s) => s.id === regola.scheda) : null;
  const voce = regola.scheda ? piano().find((v) => v.scheda.id === regola.scheda) : null;
  const rev = regola.scheda ? { scadenza: voce?.prossimaScadenza || null, norma: scheda?.riferimento || '', obbligo: /consigliat|buona prassi|non fissa/i.test(scheda?.notaScadenza || '') ? 'prassi' : 'legge', nota: scheda?.notaScadenza || scheda?.quando || '' } : revisioneDocumento(regola, st?.dataFatto);
  const stato_ = rev.scadenza ? statoScadenza(rev.scadenza, oggiIso()) : 'dafare';
  return `<details class="opzioni-doc revisione-doc" ${!st?.dataFatto || stato_ === 'scaduta' ? 'open' : ''}>
      <summary>Data e prossima revisione${rev.scadenza ? ` <span class="pill pill--${COLORE_STATO[stato_]}">${esc(dataLeggibile(rev.scadenza))}</span>` : ''}</summary>
      <p>${st?.dataFatto ? `Documento del <strong>${esc(dataLeggibile(st.dataFatto))}</strong>.` : 'Non hai ancora indicato la data di questo documento.'}
      ${rev.scadenza ? ` Prossima revisione entro il <strong>${esc(dataLeggibile(rev.scadenza))}</strong>.` : ''}</p>
      ${rev.nota ? `<p class="nota">${esc(rev.nota)}</p>` : ''}
      <p class="nota">${esc(rev.norma || '')}${rev.obbligo && rev.obbligo !== 'legge' ? ` · ${esc(ETICHETTA_OBBLIGO[rev.obbligo] || rev.obbligo)}` : ''}</p>
      <form id="data-documento">
        <label>Firmato o adottato il<input class="campo" type="date" name="data" max="${oggiIso()}" value="${esc(st?.dataFatto || '')}" required></label>
        <button class="btn btn--secondario" type="submit">Salva la data</button>
      </form>
      ${st?.storico?.length ? `<p class="nota">Versioni precedenti: ${st.storico.map((x) => esc(dataLeggibile(x.dataFatto))).join(', ')}</p>` : ''}
      <p class="nota">La scadenza entra nello <a href="#/scadenzario">scadenzario</a> e nei promemoria al responsabile.</p>
    </details>`;
}

/** Registra la data di un documento: la versione precedente resta nello storico. */
async function registraDataDocumento(modelloId, data) {
  const regola = regolaRevisione(modelloId);
  if (!regola || regola.evento || !data) return false;
  const chiave = regola.scheda || chiaveDocumento(modelloId);
  const st = statoCorrente(chiave, stato.adempimenti);
  if (st?.fatto && st.dataFatto === data) return false;
  await store.salvaAdempimento(rinnovaAdempimento(st, { schedaId: chiave, fatto: true, dataFatto: data, scadenzaManuale: null, note: st?.note || '' }, oggiIso()));
  await ricarica();
  controllaNotifiche();
  return true;
}

function attivaRevisioneDocumento(m, ridisegna) {
  const form = app.querySelector('#data-documento');
  if (!form) return;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const data = new FormData(form).get('data');
    if (await registraDataDocumento(m.id, data)) avviso('Data salvata: la prossima revisione è nello scadenzario.');
    ridisegna();
  });
}

// ---------- conoscenza: ricerca, schede di approfondimento, verifiche ----------

let indiceCache = null;
function indiceConoscenza() {
  if (!indiceCache)
    indiceCache = costruisciIndice({ conoscenza: stato.conoscenza, dvr: stato.dvr, catalogo: stato.catalogo, modelli: MODELLI, defAttr: stato.defAttr, lavorazioni: stato.lavorazioni, defLav: stato.defLav, defArchivio: stato.defArchivio });
  return indiceCache;
}

// Gli allegati senza categoria (caricati prima delle categorie) valgono per qualsiasi categoria.
const allegatiPerCategoria = (tipo, id, categoria) => allegatiDi(tipo, id).filter((a) => !categoria || !a.categoria || a.categoria === categoria).length;

const DOCUMENTI_VERIFICATI = ['pos-bozza', 'valutazione-rumore', 'valutazione-vibrazioni', 'valutazione-mmc', 'valutazione-chimico', 'valutazione-incendio'];

async function calcolaVerifiche() {
  if (!questionarioCompletato()) return [];
  const opzioniDocumenti = {};
  for (const d of DOCUMENTI_VERIFICATI) {
    const o = await store.leggiMeta(`opzioni:${d}`);
    if (o) opzioniDocumenti[d] = o;
  }
  return verifiche({
    ctx: ctx(),
    anagrafica: anagrafica(),
    prodotti: stato.prodotti,
    attrezzature: stato.attrezzature,
    lavoratori: haDipendenti() ? stato.lavoratori : [],
    controlli: stato.controlli,
    archivio: stato.archivio,
    eventi: stato.eventi,
    adempimenti: stato.adempimenti,
    defAttr: stato.defAttr,
    opzioniDocumenti,
    contaAllegati: allegatiPerCategoria,
    oggi: oggiIso()
  });
}

const COLORE_LIVELLO = { alto: 'rosso', medio: 'giallo', basso: 'info' };
const ETICHETTA_LIVELLO = { alto: 'Importante', medio: 'Da sistemare', basso: 'Da controllare' };

function cardVerifica(x, { conDocumenti = true } = {}) {
  const docs = conDocumenti ? x.documenti.map((id) => MODELLI.find((m) => m.id === id)).filter(Boolean) : [];
  return `<article class="controllo controllo--${COLORE_LIVELLO[x.livello]}">
      <p class="controllo__livello"><span class="pill pill--${COLORE_LIVELLO[x.livello]}">${ETICHETTA_LIVELLO[x.livello]}</span></p>
      <h3>${esc(x.titolo)}</h3>
      <p>${esc(x.spiegazione)}</p>
      ${x.norma ? `<p class="nota">Riferimento: ${esc(x.norma)}</p>` : ''}
      <a class="btn btn--primario" href="${esc(x.azione.href)}">${esc(x.azione.testo)}</a>
      ${docs.length ? `<p class="nota">Riguarda: ${docs.map((m) => `<a href="#/documento/${esc(m.id)}">${esc(m.titolo)}</a>`).join(' · ')}</p>` : ''}
    </article>`;
}

function barraRicerca(valore = '', { grande = false, id = 'cerca' } = {}) {
  return `<form class="ricerca${grande ? ' ricerca--grande' : ''}" role="search" data-ricerca>
      <label class="ricerca__etichetta" for="${id}">${grande ? 'Cosa cerchi?' : 'Cerca rischi, norme, documenti, macchine, corsi'}</label>
      <div class="ricerca__riga">
        <input class="campo ricerca__campo" type="search" id="${id}" name="q" value="${esc(valore)}" placeholder="es. muletto, ponteggio, estintori, H350" autocomplete="off" enterkeyhint="search">
        <button class="btn btn--primario" type="submit">Cerca</button>
      </div>
    </form>`;
}

/** Ricerca nei dati inseriti dall'utente: lavoratori, attrezzature, prodotti, archivio. */
function cercaNeiMieiDati(testo) {
  const termini = normalizzaTesto(testo).split(' ').filter((t) => t.length > 1);
  if (!termini.length) return [];
  const ok = (...campi) => {
    const t = normalizzaTesto(campi.filter(Boolean).join(' '));
    return termini.every((x) => t.includes(x));
  };
  const out = [];
  for (const l of attivi()) if (ok(l.nome, l.cognome, l.mansione)) out.push({ titolo: nomeCompleto(l), sottotitolo: `Lavoratore · ${l.mansione || 'mansione non indicata'}`, href: `#/lavoratore/${l.id}` });
  for (const a of attrezzatureAttive(stato.attrezzature)) if (ok(a.nome, a.marcaModello, a.matricola, tipoAttrezzatura(stato.defAttr, a.tipo)?.etichetta)) out.push({ titolo: a.nome, sottotitolo: `Attrezzatura · ${tipoAttrezzatura(stato.defAttr, a.tipo)?.etichetta || ''}`, href: `#/attrezzatura/${a.id}` });
  for (const p of prodottiAttivi(stato.prodotti)) if (ok(p.nome, p.fornitore, p.uso, p.frasiH)) out.push({ titolo: p.nome, sottotitolo: `Prodotto chimico${p.frasiH ? ` · ${p.frasiH}` : ''}`, href: `#/prodotto/${p.id}` });
  for (const r of archivioAttuale(stato.archivio)) if (ok(r.titolo, r.note, r.ente)) out.push({ titolo: r.titolo, sottotitolo: r.genere === 'planimetria' ? 'Planimetria' : 'Documento in archivio', href: `#/archivio-voce/${r.id}` });
  return out.slice(0, 20);
}

function cardSapere(v, extra = '') {
  const segno = { rischio: '⚠', adempimento: '✓', documento: '▤', attrezzatura: '⚙', fase: '⌂', appalto: '⇄', requisito: '★', certificato: '▣', planimetria: '▦', norma: '§', sigla: 'Aa' }[v.tipo] || '›';
  const descrizione = v.tipo === 'sigla' ? v.testo : v.sottotitolo;
  return `<a class="voce voce--doc" href="${esc(v.href)}">
      <span class="voce__segno" aria-hidden="true">${segno}</span>
      <span class="voce__testo"><span class="voce__titolo">${esc(v.titolo)}</span><span class="voce__stato">${esc(descrizione)}${extra}</span></span>
      <span class="voce__freccia" aria-hidden="true">›</span>
    </a>`;
}

/** Cosa sappiamo di una voce rispetto all'impresa: rischio presente, documento disponibile, stato dell'adempimento. */
function segnoPerImpresa(v) {
  if (!questionarioCompletato()) return '';
  if (v.tipo === 'rischio') return valuta(v.dati.presenteSe, ctx()) ? ' · <strong>presente nella tua impresa</strong>' : '';
  if (v.tipo === 'documento') return modelliDisponibili(ctx()).some((m) => m.id === v.id) ? ' · <strong>disponibile per te</strong>' : '';
  if (v.tipo === 'adempimento') {
    const x = piano().find((p) => p.scheda.id === v.id);
    return x ? ` · <strong>${esc(ETICHETTE[x.colore]?.titolo || '')}</strong>` : '';
  }
  return '';
}

function risultatiRicerca(testo) {
  if (!normalizzaTesto(testo)) return '';
  const r = cerca(indiceConoscenza(), testo);
  const miei = cercaNeiMieiDati(testo);
  if (!r.risultati.length && !miei.length)
    return `<p class="lead">Nessun risultato per «${esc(testo)}».</p><p>Prova con un'altra parola, ad esempio il nome della macchina, del prodotto o del lavoro che fai.</p>`;
  return `${r.parziale ? `<p class="nota">Nessun risultato contiene tutte le parole: ecco i più vicini.</p>` : ''}
    ${miei.length ? `<h2>Nei tuoi dati <span class="conta">${miei.length}</span></h2><div class="lista">${miei.map((x) => cardSapere({ ...x, tipo: '' })).join('')}</div>` : ''}
    ${raggruppa(r.risultati)
      .map((g) => `<h2>${esc(g.titolo)} <span class="conta">${g.voci.length}</span></h2><div class="lista">${g.voci.map((v) => cardSapere(v, segnoPerImpresa(v))).join('')}</div>`)
      .join('')}`;
}

const ESEMPI_RICERCA = ['muletto', 'ponteggio', 'estintori', 'vernici', 'gravidanza', 'corso preposto', 'H350', 'DUVRI', 'telecamere', 'rifiuti'];

async function schermataCerca(testo = '') {
  app.innerHTML = `
    <section class="pagina">
      <h1>Cerca</h1>
      <p class="lead">Rischi, cose da fare, documenti, macchine, lavorazioni, corsi, norme e sigle. Funziona anche senza connessione.</p>
      ${barraRicerca(testo, { grande: true, id: 'cerca-pagina' })}
      <p class="esempi">Prova: ${ESEMPI_RICERCA.map((e) => `<a class="pill pill--info" href="#/cerca/${encodeURIComponent(e)}">${esc(e)}</a>`).join(' ')}</p>
      <div id="risultati" aria-live="polite">${risultatiRicerca(testo)}</div>
      <p class="nota">Le informazioni sono una guida per orientarti: vanno verificate con il tuo consulente e con il testo ufficiale delle norme.</p>
    </section>`;
  const campo = app.querySelector('#cerca-pagina');
  if (!testo) campo.focus();
  let attesa;
  campo.addEventListener('input', () => {
    clearTimeout(attesa);
    attesa = setTimeout(() => {
      const q = campo.value.trim();
      app.querySelector('#risultati').innerHTML = risultatiRicerca(q);
      history.replaceState(null, '', q ? `#/cerca/${encodeURIComponent(q)}` : '#/cerca');
    }, 200);
  });
}

const elenco = (voci) => (voci?.length ? `<ul>${voci.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');

function corpoSapere(v) {
  const d = v.dati;
  const presente = questionarioCompletato() && v.tipo === 'rischio' && valuta(d.presenteSe, ctx());
  if (v.tipo === 'rischio') {
    const R = (d.probabilita || 0) * (d.magnitudo || 0);
    const liv = livelloRischio(stato.dvr?.criteri, R);
    return `${questionarioCompletato() ? `<p><span class="pill pill--${presente ? 'giallo' : 'verde'}">${presente ? 'Presente nella tua impresa' : 'Non risulta dalle tue risposte'}</span></p>` : ''}
      <h2>Possibili danni</h2><p>${esc(d.danno || '')}</p>
      <h2>Valutazione tipica</h2><p>Probabilità ${d.probabilita} × danno ${d.magnitudo} = <strong>${R}</strong> (${esc(liv?.etichetta || '')}). Va confermata con il sopralluogo: nel DVR puoi cambiarla.</p>
      <h2>Misure di prevenzione</h2>${elenco(d.misure)}
      ${d.miglioramenti?.length ? `<h2>Misure di miglioramento possibili</h2>${elenco(d.miglioramenti)}` : ''}
      ${d.dpi?.length ? `<h2>DPI</h2>${elenco(d.dpi)}` : ''}
      <h2>Formazione</h2><p>${esc(d.formazione || '')}</p>
      <h2>Sorveglianza sanitaria</h2><p>${d.sorveglianza ? 'Sì, secondo il protocollo del medico competente.' : 'Non prevista per questo rischio.'}</p>
      <p class="nota">Riferimenti: ${esc(d.norma || '')}</p>
      ${presente ? `<a class="btn btn--primario" href="#/documento/dvr-bozza">Apri il DVR</a>` : ''}`;
  }
  if (v.tipo === 'documento') {
    const disponibile = questionarioCompletato() && modelliDisponibili(ctx()).some((m) => m.id === d.id);
    return `<p class="lead">${esc(d.descrizione)}</p>
      <h2>Consigli per compilarlo</h2>${elenco(d.consigli)}
      ${disponibile ? `<a class="btn btn--primario" href="${d.ambito === 'lavoratore' ? '#/documenti' : `#/documento/${esc(d.id)}`}">Apri il documento</a>` : '<p class="nota">Dalle tue risposte questo documento non ti serve.</p>'}`;
  }
  if (v.tipo === 'attrezzatura') {
    const et = Object.fromEntries((stato.defAttr?.pericoli || []).map((x) => [x.id, x.etichetta]));
    const mie = attrezzatureAttive(stato.attrezzature).filter((a) => a.tipo === d.id);
    return `${d.patentino ? '<p class="riquadro"><strong>Serve l\'abilitazione dell\'operatore</strong> (art. 73 c. 5 e Accordo Stato-Regioni): solo chi ha il patentino può usarla.</p>' : ''}
      <h2>Pericoli tipici</h2>${elenco((d.pericoli || []).map((p) => et[p] || p))}
      ${d.dpi?.length ? `<h2>DPI</h2>${elenco(d.dpi)}` : ''}
      <h2>Controlli e verifiche</h2>${(d.controlli || []).map((c) => `<h3>${esc(c.titolo)}</h3><p>${esc(c.aiuto || '')}</p>`).join('')}
      ${mie.length ? `<h2>Le tue attrezzature di questo tipo</h2><div class="lista">${mie.map((a) => cardSapere({ titolo: a.nome, sottotitolo: [a.marcaModello, a.matricola].filter(Boolean).join(' · '), href: `#/attrezzatura/${a.id}`, tipo: 'attrezzatura' })).join('')}</div>` : ''}
      <a class="btn btn--secondario" href="#/attrezzature">Le tue attrezzature</a>`;
  }
  if (v.tipo === 'fase')
    return `<h2>Rischi</h2>${elenco(d.rischi)}<h2>Misure</h2>${elenco(d.misure)}<h2>Attrezzature</h2>${elenco(d.attrezzature)}<h2>DPI</h2>${elenco(d.dpi)}
      <a class="btn btn--primario" href="#/documento/pos-bozza">Apri il POS</a>`;
  if (v.tipo === 'appalto')
    return `<h2>Rischi portati dalla ditta esterna</h2>${elenco(d.rischiIntrodotti)}
      <h2>Interferenze tipiche</h2>${(d.interferenze || []).map((x) => `<h3>${esc(x.attivita)}</h3><p>${esc(x.rischio)}</p><p><strong>Misure:</strong> ${esc(x.misure)}</p>`).join('')}
      <a class="btn btn--primario" href="#/documento/duvri-bozza">Apri il DUVRI</a>`;
  if (v.tipo === 'requisito')
    return `<p class="lead">${esc(d.aiuto || '')}</p><p>${d.ruolo ? `Riguarda chi ha il ruolo: <strong>${esc(d.etichettaRuolo)}</strong>.` : 'Riguarda tutti i lavoratori.'}${d.periodicitaMesi ? ` Si rinnova ogni ${d.periodicitaMesi % 12 ? `${d.periodicitaMesi} mesi` : `${d.periodicitaMesi / 12} ${d.periodicitaMesi === 12 ? 'anno' : 'anni'}`}.` : ''}</p>
      ${haDipendenti() ? '<a class="btn btn--secondario" href="#/lavoratori">I tuoi lavoratori</a>' : ''}`;
  if (v.tipo === 'norma')
    return `<p class="lead">${esc(d.titolo)}</p><p><span class="pill pill--info">${esc(d.ambito)}</span></p>
      <p class="nota">Il testo ufficiale e aggiornato è su normattiva.it (leggi italiane) ed eur-lex.europa.eu (regolamenti europei).</p>`;
  if (v.tipo === 'sigla') return `<p class="lead">${esc(d.testo)}</p>`;
  return `<p>${esc(v.testo)}</p>`;
}

function schermataSapere(tipo, id) {
  const ind = indiceConoscenza();
  const v = voce(ind, tipo, id);
  if (!v) return (location.hash = '#/cerca');
  const coll = collegati(ind, v);
  const altre = v.tipo === 'sigla' ? cerca(ind, v.titolo).risultati.filter((x) => x.chiave !== v.chiave).slice(0, 12) : [];
  const gruppi = raggruppa(coll).map((g) => ({ ...g, voci: g.voci.slice(0, 8) }));
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="javascript:history.back()">‹ Indietro</a>
      <p class="sopratitolo">${esc(TIPI_VOCE[v.tipo] || '')}${v.sottotitolo && v.tipo !== 'norma' ? ` · ${esc(v.sottotitolo)}` : ''}</p>
      <h1>${esc(v.tipo === 'norma' ? v.dati.sigla : v.titolo)}</h1>
      ${corpoSapere(v)}
      ${gruppi.length || altre.length ? '<h2 class="collegati">Collegati</h2>' : ''}
      ${gruppi.map((g) => `<h3>${esc(g.titolo)}</h3><div class="lista">${g.voci.map((x) => cardSapere(x, segnoPerImpresa(x))).join('')}</div>`).join('')}
      ${altre.length ? `<div class="lista">${altre.map((x) => cardSapere(x, segnoPerImpresa(x))).join('')}</div>` : ''}
      ${barraRicerca('', { id: 'cerca-sapere' })}
      <p class="nota">Informazioni di orientamento: verificale con il tuo consulente e con il testo ufficiale delle norme.</p>
    </section>`;
}

async function schermataVerifiche() {
  if (!questionarioCompletato()) return schermataBenvenuto();
  const lista = await calcolaVerifiche();
  app.innerHTML = `
    <section class="pagina">
      <h1>Controlli di coerenza</h1>
      <p class="lead">safetyDoc confronta tra loro le risposte, i lavoratori, le macchine, i prodotti, l'archivio e i documenti, e ti segnala quello che non torna.</p>
      ${
        lista.length
          ? `<p>${lista.length === 1 ? 'C\'è una cosa' : `Ci sono ${lista.length} cose`} da guardare, dalla più importante.</p>${lista.map((x) => cardVerifica(x)).join('')}`
          : '<p class="riquadro riquadro--ok"><strong>Nessuna incoerenza trovata.</strong> I dati inseriti sono coerenti tra loro. Ricontrolla quando aggiungi lavoratori, macchine o prodotti.</p>'
      }
      <p class="nota">I controlli si basano sui dati che hai inserito: non sostituiscono il sopralluogo dell'RSPP.</p>
    </section>`;
}

/** Pannello «Aiuto e verifiche» dentro ogni documento. */
function pannelloAiutoDocumento(modelloId, lista) {
  const a = perDocumento(indiceConoscenza(), modelloId, lista);
  if (!a) return '';
  const n = a.verifiche.length;
  const link = (vv) => vv.map((x) => `<a href="${esc(x.tipo === 'adempimento' ? x.href : x.href)}">${esc(x.tipo === 'norma' ? x.dati.sigla : x.titolo)}</a>`).join(' · ');
  return `<details class="opzioni-doc aiuto-doc" ${n && a.verifiche.some((x) => x.livello === 'alto') ? 'open' : ''}>
      <summary>Aiuto e verifiche${n ? ` <span class="pill pill--${a.verifiche.some((x) => x.livello === 'alto') ? 'rosso' : 'giallo'}">${n}</span>` : ''}</summary>
      ${
        n
          ? `<h3>Da sistemare prima di firmare</h3>${a.verifiche.slice(0, 5).map((x) => cardVerifica(x, { conDocumenti: false })).join('')}${n > 5 ? `<a class="btn btn--secondario" href="#/verifiche">Vedi tutti i ${n} controlli</a>` : ''}`
          : '<p class="esito esito--ok">Nessuna incoerenza trovata nei dati usati da questo documento.</p>'
      }
      <h3>Consigli</h3>${elenco(a.consigli)}
      ${a.adempimenti.length ? `<p><strong>Cosa fare collegato:</strong> ${link(a.adempimenti)}</p>` : ''}
      ${a.rischi.length ? `<p><strong>Rischi:</strong> ${link(a.rischi)}</p>` : ''}
      ${a.norme.length ? `<p><strong>Norme:</strong> ${link(a.norme)}</p>` : ''}
      ${a.sigle.length ? `<dl class="sigle">${a.sigle.map((g) => `<dt>${esc(g.sigla)}</dt><dd>${esc(g.testo)}</dd>`).join('')}</dl>` : ''}
      <p class="nota"><a href="#/sapere/documento/${esc(modelloId)}">Scheda completa del documento</a> · <a href="#/cerca">Cerca altro</a></p>
    </details>`;
}

async function instrada() {
  const [, rotta, param, extra, quarto] = (location.hash || '#/').split('/').map((x) => (x ? decodeURIComponent(x) : x));
  aggiornaNav(rotta || '');
  window.scrollTo(0, 0);
  if (rotta === 'invito') return schermataInvito(param || '');
  if (rotta === 'termini') return schermataTermini();
  if (rotta === 'admin') return param === 'richiesta' && extra ? schermataAdminRichiesta(extra) : schermataAdmin();
  const accesso = await controllaAccesso();
  if (accesso !== 'ok') return schermataAccessoNegato(accesso);
  if (rotta === 'richieste') return param ? schermataRichiesta(param) : schermataRichieste();
  ultimaRotta = [rotta || 'oggi', rotta === 'documento' || rotta === 'scheda' || rotta === 'sapere' ? param : ''].filter(Boolean).join(':');
  if (rotta === 'documento' && param) registraUso('documento', param);
  else if (rotta === 'cerca') registraUso('ricerca');
  else registraUso('schermata', nomeRotta(rotta, param));
  if (rotta === 'domanda') return schermataDomanda(param);
  if (rotta === 'piano') return schermataPiano();
  if (rotta === 'scheda') return schermataScheda(param || '');
  if (rotta === 'dati') return schermataDati(param);
  if (rotta === 'controllo-iniziale') return schermataControlloIniziale(param);
  if (rotta === 'lavoratori') return schermataLavoratori();
  if (rotta === 'lavoratore') return schermataLavoratore(param);
  if (rotta === 'lavoratore-modifica') return schermataModificaLavoratore(param);
  if (rotta === 'registro') return schermataRegistro(param, extra);
  if (rotta === 'attrezzature') return schermataAttrezzature();
  if (rotta === 'attrezzatura') return schermataAttrezzatura(param);
  if (rotta === 'attrezzatura-modifica') return schermataModificaAttrezzatura(param);
  if (rotta === 'controllo') return schermataControllo(param, extra);
  if (rotta === 'nuove-domande') return vaiNuoveDomande();
  if (rotta === 'archivio') return schermataArchivio(param);
  if (rotta === 'planimetrie') return schermataArchivio('planimetria');
  if (rotta === 'archivio-voce') return schermataVoceArchivio(param, extra, quarto);
  if (rotta === 'partenza') return schermataPartenza();
  if (rotta === 'prodotti') return schermataProdotti();
  if (rotta === 'prodotto') return schermataProdotto(param);
  if (rotta === 'eventi') return schermataEventi();
  if (rotta === 'evento') return schermataEvento(param);
  if (rotta === 'documenti') return schermataDocumenti();
  if (rotta === 'documento') return schermataDocumento(param, extra);
  if (rotta === 'cerca') return schermataCerca(param || '');
  if (rotta === 'sapere') return schermataSapere(param, extra);
  if (rotta === 'verifiche') return schermataVerifiche();
  if (rotta === 'scadenzario') return schermataScadenzario(param || '');
  return schermataOggi();
}

async function avvia() {
  try {
    const [q, c, l, d, a, t, se, lv, ar, kn, lg, gd] = await Promise.all(
      ['data/questionario.json', 'data/catalogo.json', 'data/lavoratori.json', 'data/dvr.json', 'data/ateco.json', 'data/attrezzature.json', 'data/settori.json', 'data/lavorazioni.json', 'data/archivio.json', 'data/conoscenza.json', 'data/legale.json', 'data/guida.json'].map((u) =>
        fetch(u).then((r) => r.json())
      )
    );
    stato.settori = se;
    stato.conoscenza = kn;
    stato.legale = lg;
    stato.guida = gd;
    stato.lavorazioni = lv;
    stato.defArchivio = ar;
    stato.defAttr = t;
    stato.dvr = d;
    stato.ateco = a;
    stato.questionario = q;
    stato.catalogo = c;
    stato.defLav = l;
    await ricarica();
    await caricaAccount();
    guidaNascosta = Boolean(await store.leggiMeta('guida:nascosta'));
    inizializzaGuida();
    store.chiediMemoriaPersistente();
    addEventListener('hashchange', instrada);
    app.addEventListener('submit', (ev) => {
      const f = ev.target.closest?.('[data-ricerca]');
      if (!f) return;
      ev.preventDefault();
      const q = String(new FormData(f).get('q') || '').trim();
      const dest = q ? `#/cerca/${encodeURIComponent(q)}` : '#/cerca';
      if (location.hash === dest) schermataCerca(q);
      else location.hash = dest;
    });
    await instrada();
    controllaNotifiche().catch(() => {});
    registraUso('apertura').then(inviaUso);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        controllaNotifiche().catch(() => {});
        // verifica dell'account al ritorno nell'app (al massimo ogni 10 minuti)
        if (!['invito', 'termini', 'admin'].includes((location.hash.split('/')[1] || ''))) controllaAccesso().then((d) => d !== 'ok' && schermataAccessoNegato(d));
      }
      else inviaUso();
    });
  } catch (e) {
    console.error(e);
    app.innerHTML = `<section class="pagina"><h1>Qualcosa non ha funzionato</h1><p>Ricarica la pagina. Se il problema continua, il browser potrebbe non essere supportato.</p></section>`;
  }
  registraServiceWorker();
}

/** Installa il service worker (uso senza connessione) e avvisa quando c'è una nuova versione. */
async function registraServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    let controllata = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (controllata) mostraAggiornamento();
      controllata = true;
    });
    // Quando l'app torna in primo piano controlla se è uscita una nuova versione.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
    });
  } catch {
    /* senza service worker l'app funziona lo stesso, ma solo con la connessione */
  }
}

function mostraAggiornamento() {
  if (document.getElementById('aggiornamento')) return;
  const box = document.createElement('div');
  box.id = 'aggiornamento';
  box.className = 'aggiornamento';
  box.setAttribute('role', 'status');
  box.innerHTML = `<span>È pronta una nuova versione di safetyDoc.</span><button class="btn btn--primario" type="button">Aggiorna</button>`;
  box.querySelector('button').addEventListener('click', () => location.reload());
  document.body.append(box);
}

avvia();
