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
  vociControlloIniziale,
  dataDaMese
} from './engine.js';
import { linkAiuto } from './aiuto.js';
import * as cloud from './cloud.js';
import { CONFIG } from './config.js';
import { accessoOfflineValido, contestoTicket, STATI_TICKET } from './accesso.js';
import { preparaFile, dimensioneLeggibile, allegatoPerExport, allegatoDaImport } from './allegati.js';
import { unisciCollezione, creaExport, validaExport, FORMATO_CIFRATO, COLLEZIONI } from './merge.js';
import { cifra, decifra } from './cifratura.js';
import { modelliDisponibili, modelloPerLavoratore, generaDocumento, MODELLI } from './modelli.js';
import { generaIcs, eventiScadenze } from './calendario.js';
import * as store from './store.js';

export const VERSIONE_APP = '0.9.0';
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
  dvr: ['dvr-bozza'],
  'stress-lavoro-correlato': ['dvr-bozza'],
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

const stato = { utente: null, messaggioAccesso: '', questionario: null, catalogo: null, defLav: null, dvr: null, ateco: null, defAttr: null, profilo: null, adempimenti: [], lavoratori: [], registri: [], attrezzature: [], controlli: [], allegati: [] };
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
  stato.attrezzature = await store.tutti('attrezzature');
  stato.controlli = await store.tutti('controlli');
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

function campoAllegato() {
  return `<label>Allega foto o PDF <small>(attestato, verbale, documento firmato: puoi anche scattare una foto)</small>
    <input class="campo" type="file" name="allegato" accept="image/*,application/pdf" multiple></label>`;
}

async function salvaAllegatiDa(form, tipo, id) {
  const files = [...(form.querySelector('input[name="allegato"]')?.files || [])];
  let n = 0;
  for (const f of files) {
    try {
      const p = await preparaFile(f);
      await store.salva('allegati', { collegatoTipo: tipo, collegatoId: id, nome: p.nome, tipo: p.tipo, dimensione: p.dimensione, file: p.file });
      n++;
    } catch (e) {
      avviso(e.message);
    }
  }
  return n;
}

function elencoAllegati(tipo, id) {
  const lista = allegatiDi(tipo, id);
  if (!lista.length) return '';
  return `<ul class="allegati">${lista
    .map(
      (a) => `<li><button type="button" class="allegato" data-apri="${esc(a.id)}"><span class="allegato__tipo">${a.tipo?.startsWith('image/') ? 'Foto' : 'PDF'}</span> ${esc(a.nome)} <small>${esc(dimensioneLeggibile(a.dimensione))}</small></button>
        <button type="button" class="btn btn--testo btn--piccolo" data-togli="${esc(a.id)}">Elimina</button></li>`
    )
    .join('')}</ul>`;
}

function attivaAllegati(ridisegna) {
  for (const b of app.querySelectorAll('[data-apri]')) {
    b.addEventListener('click', () => {
      const a = stato.allegati.find((x) => x.id === b.dataset.apri);
      if (!a?.file) return avviso('Questo file non è presente su questo dispositivo.');
      const url = URL.createObjectURL(a.file);
      const link = Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener' });
      if (!a.tipo?.startsWith('image/') && a.tipo !== 'application/pdf') link.download = a.nome;
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

// ---------- chiedi aiuto ----------

const consulente = () => stato.profilo?.consulente || {};

/** Riquadro "Chiedi aiuto": link pronti a chi aiuta l'impresa, oppure invito a inserirne il recapito. */
function bloccoAiuto(argomento, schedaId = '') {
  const c = consulente();
  const link = linkAiuto({ contatto: c, impresa: anagrafica().ragioneSociale || risposte().nome_impresa, titolare: anagrafica().titolare, argomento });
  const ticket = `<a class="btn btn--primario" href="#/ticket/nuovo/${esc(schedaId)}">Scrivi una domanda all'${esc(CONFIG.nomeAssistenza)}</a>
    <p class="nota">Ti rispondono qui nell'app. Trovi le tue domande in <a href="#/assistenza">Assistenza</a>.</p>`;
  const diretto = Object.keys(link).length
    ? `<p>Oppure contatta direttamente ${c.nome ? esc(c.nome) : 'chi ti aiuta'}:</p>
    <div class="aiuto-box__azioni">
      ${link.telefono ? `<a class="btn btn--secondario" href="${esc(link.telefono)}">Chiama</a>` : ''}
      ${link.whatsapp ? `<a class="btn btn--secondario" href="${esc(link.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      ${link.email ? `<a class="btn btn--secondario" href="${esc(link.email)}">Email</a>` : ''}
    </div>`
    : `<p class="nota">Puoi anche <a href="#/dati/consulente">aggiungere il recapito del tuo consulente</a> per chiamarlo con un tocco.</p>`;
  return `<div class="aiuto-box"><h2>Hai un dubbio?</h2>${ticket}${diretto}</div>`;
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

const SEZIONE = { scheda: 'piano', 'controllo-iniziale': 'piano', assistenza: '', ticket: '', lavoratore: 'lavoratori', 'lavoratore-modifica': 'lavoratori', registro: 'lavoratori', documento: 'documenti', attrezzatura: 'attrezzature', 'attrezzatura-modifica': 'attrezzature', controllo: 'attrezzature' };

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
      <div id="banner-ticket"></div>
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
      ${haDipendenti() ? bloccoLavoratoriOggi() : ''}
      ${bloccoMacchineOggi()}
      ${bloccoAiuto('la sicurezza della mia impresa')}
      ${richiestaInstallazione && !installata() ? `<p class="nota"><a href="#/dati/installa">Installa safetyDoc sul telefono</a> per aprirlo con un tocco.</p>` : ''}
    </section>`;
  bannerTicket();
}

/** Avviso di risposte arrivate (o, per gli operatori, di domande in attesa). Non blocca la schermata. */
async function bannerTicket() {
  if (!stato.utente || stato.utente.offline) return;
  try {
    const elenco = stato.utente.operatore ? await cloud.ticketTutti('aperto') : (await cloud.ticketMiei()).filter((t) => t.stato === 'risposto');
    const box = document.getElementById('banner-ticket');
    if (!box || !elenco.length) return;
    box.innerHTML = stato.utente.operatore
      ? `<a class="banner banner--info" href="#/assistenza"><strong>${elenco.length} ${elenco.length === 1 ? 'domanda' : 'domande'} in attesa di risposta</strong><span>Tocca per aprire l'assistenza.</span></a>`
      : `<a class="banner banner--info" href="${elenco.length === 1 ? `#/ticket/${esc(elenco[0].id)}` : '#/assistenza'}"><strong>Hai ${elenco.length === 1 ? 'una risposta' : `${elenco.length} risposte`} dall'${esc(CONFIG.nomeAssistenza)}</strong><span>Tocca per leggere.</span></a>`;
  } catch {
    /* senza connessione non mostriamo nulla */
  }
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
      ${vociControlloIniziale(p).length ? `<a class="btn btn--secondario" href="#/controllo-iniziale/0">Controllo veloce: segna ciò che hai già fatto</a>` : ''}
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
  const eventi = eventiScadenze({ piano: piano(), situazioni: haDipendenti() ? attivi().map(situazione) : [], nomeCompleto, macchine: macchine().map(situazioneMacchina) });
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
    const primaVolta = ultima && !stato.adempimenti.some((x) => !x.deleted);
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
      ${scheda.daVerificare?.length ? `<p class="verifica">In verifica: ${esc(scheda.daVerificare.join(' '))}</p>` : ''}
      ${id === 'formazione-lavoratori' || id === 'formazione-datore' ? notaClasseRischio() : ''}
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
        ${elencoAllegati('adempimento', st?.id)}
        ${campoAllegato()}
        <button class="btn btn--primario btn--grande" type="submit">Fatto</button>
        ${st?.fatto ? `<button class="btn btn--testo" type="button" id="annulla">Segna di nuovo come da fare</button>` : ''}
      </form>`
      }
      ${bloccoAiuto(scheda.titolo, id)}
    </section>`;

  const form = app.querySelector('#registra');
  if (!form) return;
  attivaAllegati(() => schermataScheda(id));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    const salvato = await store.salvaAdempimento({
      ...(st || {}),
      schedaId: id,
      fatto: true,
      dataFatto: f.get('dataFatto'),
      scadenzaManuale: f.get('scadenzaManuale') || null,
      note: f.get('note') || ''
    });
    await salvaAllegatiDa(form, 'adempimento', salvato.id);
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
        <label>Quando, più o meno? <small>(mese e anno: va bene anche una data approssimativa)</small>
          <input class="campo" type="month" name="mese" max="${mese}" value="${esc(st?.dataFatto?.slice(0, 7) || '')}" placeholder="AAAA-MM" required>
        </label>
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
    form.querySelector('input').focus();
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
    const dataFatto = dataDaMese(f.get('mese'));
    if (!dataFatto) return avviso('Scrivi mese e anno, per esempio 2024-03.');
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
      ${req.id === 'formazione-specifica' ? notaClasseRischio() : ''}
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
        ${campoAllegato()}
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
      <h2>Libretto e documenti</h2>
      ${elencoAllegati('attrezzatura', a.id) || '<p>Nessun documento allegato.</p>'}
      <form id="documenti-macchina">${campoAllegato()}<button class="btn btn--secondario" type="submit">Allega</button></form>
      <a class="btn btn--secondario" href="#/attrezzatura-modifica/${esc(a.id)}">Modifica i dati</a>
    </section>`;
  attivaAllegati(() => schermataAttrezzatura(id));
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
          <input class="campo" type="date" name="scadenzaManuale"></label>`
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

/** Numero di allegati per voce, con chiave "tipo:id". */
function contaAllegati() {
  const n = {};
  for (const a of stato.allegati) if (!a.deleted) n[`${a.collegatoTipo}:${a.collegatoId}`] = (n[`${a.collegatoTipo}:${a.collegatoId}`] || 0) + 1;
  return n;
}

async function schermataDocumento(id, lavId) {
  const m = MODELLI.find((x) => x.id === id);
  if (!m) return (location.hash = '#/documenti');
  const l = lavId ? stato.lavoratori.find((x) => x.id === lavId && !x.deleted) : null;
  if (m.ambito === 'lavoratore' && !l) return (location.hash = '#/documenti');
  const req = stato.defLav.requisiti.find((r) => r.modello === id);
  const registro = l && req ? storicoRegistri(l.id, req.id, stato.registri)[0] : null;
  const situazioni = id === 'registro-formazione' ? attivi().map(situazione) : null;
  const opzioneAttivita = stato.questionario.domande.find((d) => d.id === 'attivita')?.opzioni?.find((o) => o.valore === risposte().attivita);
  const { html } = generaDocumento(id, {
    anagrafica: anagrafica(),
    lavoratore: l,
    oggi: oggiIso(),
    registro,
    situazioni,
    dvr: stato.dvr,
    ctx: ctx(),
    lavoratori: attivi(),
    attrezzature: macchine().map((a) => ({ nome: a.nome, tipo: tipoAttrezzatura(stato.defAttr, a.tipo)?.etichetta })),
    attivita: opzioneAttivita?.etichetta || '',
    ...(id === 'stato-sicurezza'
      ? {
          piano: piano(),
          situazioni: haDipendenti() ? attivi().map(situazione) : [],
          macchine: macchine().map(situazioneMacchina),
          allegati: contaAllegati()
        }
      : {})
  });

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

      <h2>Il tuo account</h2>
      ${
        stato.utente
          ? `<p>Hai fatto l'accesso come <strong>${esc(stato.utente.email || '')}</strong>${stato.utente.operatore ? ' (operatore dell\'assistenza)' : ''}.</p>
        <a class="btn btn--secondario" href="#/assistenza">${stato.utente.operatore ? 'Apri l\'assistenza' : 'Le tue domande all\'assistenza'}</a>
        <button class="btn btn--testo" id="esci">Esci dall'account</button>
        <p class="nota">Uscendo, i dati restano su questo dispositivo e tornano visibili al prossimo accesso.</p>`
          : ''
      }

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
  attivaInstallazione();
  app.querySelector('#esci')?.addEventListener('click', async () => {
    if (!confirm('Vuoi uscire dal tuo account? Per rientrare serviranno email e password.')) return;
    await cloud.esci();
    stato.utente = null;
    location.hash = '#/';
    instrada();
  });
  const ancora = { consulente: 'consulente', installa: 'installa-app' }[sezione];
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
  let contenuto = creaExport({ collezioni, deviceId: await store.idPostazione(), versioneApp: VERSIONE_APP });
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
    await ricarica();
    esito.innerHTML = `<p class="esito esito--ok">Copia caricata. ${esc(righe.join(' '))}${
      conflitti ? ` ${conflitti} voci erano state modificate su entrambi i dispositivi: abbiamo tenuto la versione più recente.` : ''
    }</p>`;
  } catch (e) {
    esito.innerHTML = `<p class="esito esito--errore">${esc(e.message === 'CIFRATO' ? 'Il file è protetto da password.' : e.message || 'Non è stato possibile leggere il file.')}</p>`;
  }
}

// ---------- accesso ----------

async function verificaAccesso() {
  const s = cloud.sessione();
  if (!s) return null;
  try {
    const r = await cloud.rpc('sd_controlla_dispositivo', { p_device_id_hash: await cloud.impronta(await store.idPostazione()), p_app_version: VERSIONE_APP });
    if (!r?.allowed) {
      stato.messaggioAccesso = r?.message || 'Accesso non autorizzato.';
      if (r?.status === 'device_not_registered') return registraDispositivo(s);
      cloud.salvaAccesso(null);
      return null;
    }
    const a = { userId: s.user.id, email: s.user.email, operatore: Boolean(r.operatore), ultimoOk: new Date().toISOString() };
    cloud.salvaAccesso(a);
    return a;
  } catch (e) {
    if (e.stato === 0) {
      const a = cloud.accesso();
      return a?.userId === s.user.id && accessoOfflineValido(a, new Date(), CONFIG.giorniSenzaConnessione) ? { ...a, offline: true } : null;
    }
    stato.messaggioAccesso = e.message;
    return null;
  }
}

async function registraDispositivo(s) {
  const r = await cloud.rpc('sd_registra_dispositivo', {
    p_device_id_hash: await cloud.impronta(await store.idPostazione()),
    p_device_label: cloud.nomeDispositivo(),
    p_app_version: VERSIONE_APP
  });
  if (!r?.allowed) {
    stato.messaggioAccesso = r?.message || 'Questo dispositivo non è autorizzato.';
    return null;
  }
  const a = { userId: s.user.id, email: s.user.email, operatore: Boolean(r.operatore), ultimoOk: new Date().toISOString() };
  cloud.salvaAccesso(a);
  return a;
}

function schermataAccesso() {
  document.querySelector('.nav').hidden = true;
  const offline = !navigator.onLine;
  app.innerHTML = `
    <section class="pagina benvenuto">
      <p class="sopratitolo">safetyDoc</p>
      <h1>Accedi</h1>
      <p class="lead">La sicurezza della tua impresa, passo per passo. Entra con l'email e la password che ti ha dato l'${esc(CONFIG.nomeAssistenza)}.</p>
      ${stato.messaggioAccesso ? `<p class="esito esito--errore">${esc(stato.messaggioAccesso)}</p>` : ''}
      ${offline ? `<p class="esito esito--errore">Sei senza connessione: per il primo accesso serve internet.</p>` : ''}
      <form id="accesso">
        <label>Email<input class="campo" type="email" name="email" autocomplete="username" required></label>
        <label>Password<input class="campo" type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn btn--primario btn--grande" type="submit">Entra</button>
      </form>
      <p class="nota">Non hai un account o hai dimenticato la password? Chiedi all'${esc(CONFIG.nomeAssistenza)}.</p>
      <p class="nota">I dati della tua impresa restano su questo dispositivo: l'account serve per proteggere l'accesso e per scrivere all'assistenza. Versione ${VERSIONE_APP}.</p>
    </section>`;
  const form = app.querySelector('#accesso');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const bottone = form.querySelector('button');
    bottone.disabled = true;
    bottone.textContent = 'Accesso in corso…';
    const f = new FormData(form);
    try {
      const s = await cloud.accedi(String(f.get('email')), String(f.get('password')));
      const a = await registraDispositivo(s);
      if (!a) {
        await cloud.esci();
        return schermataAccesso();
      }
      const proprietario = await store.leggiMeta('proprietario');
      if (proprietario && proprietario !== a.userId && (stato.adempimenti.length || stato.lavoratori.length)) {
        if (!confirm('Su questo dispositivo ci sono già i dati di un altro account. Vuoi continuare e vederli con questo account?')) {
          await cloud.esci();
          return schermataAccesso();
        }
      }
      await store.scriviMeta('proprietario', a.userId);
      stato.utente = a;
      stato.messaggioAccesso = '';
      instrada();
    } catch (e) {
      stato.messaggioAccesso = e.message;
      schermataAccesso();
    }
  });
}

// ---------- assistenza (ticket) ----------

function dataOra(iso) {
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function serveConnessione() {
  app.innerHTML = `<section class="pagina"><h1>Assistenza</h1>
    <p class="esito esito--errore">Per l'assistenza serve la connessione a internet.</p>
    <a class="btn btn--secondario" href="#/">Torna a Oggi</a></section>`;
}

async function schermataAssistenza(filtro) {
  const op = stato.utente?.operatore;
  app.innerHTML = `<section class="pagina"><h1>Assistenza</h1><p>Caricamento…</p></section>`;
  let elenco;
  try {
    elenco = op ? await cloud.ticketTutti(filtro === 'tutti' ? '' : filtro || 'aperto') : await cloud.ticketMiei();
  } catch (e) {
    return e.stato === 0 ? serveConnessione() : avviso(e.message);
  }
  const card = (t) => `<a class="voce voce--${t.stato === 'risposto' ? (op ? 'verde' : 'giallo') : t.stato === 'aperto' ? (op ? 'rosso' : 'info') : 'verde'}" href="#/ticket/${esc(t.id)}">
      <span class="voce__segno" aria-hidden="true">${t.stato === 'chiuso' ? '✓' : t.stato === 'risposto' ? '✉' : '?'}</span>
      <span class="voce__testo">
        <span class="voce__titolo">${esc(t.argomento)}</span>
        <span class="voce__stato">${op ? `${esc(t.impresa || t.user_email || '')} · ` : ''}${esc(STATI_TICKET[t.stato])} · ${esc(dataOra(t.updated_at))}</span>
      </span>
      <span class="voce__freccia" aria-hidden="true">›</span>
    </a>`;
  const filtri = [
    ['aperto', 'Da rispondere'],
    ['risposto', 'Risposti'],
    ['chiuso', 'Chiusi'],
    ['tutti', 'Tutti']
  ];
  app.innerHTML = `
    <section class="pagina">
      <h1>${op ? 'Assistenza alle imprese' : 'Le tue domande'}</h1>
      ${
        op
          ? `<div class="filtri">${filtri
              .map(([v, et]) => `<a class="filtro" aria-current="${(filtro || 'aperto') === v}" href="#/assistenza/${v}">${et}</a>`)
              .join('')}</div>`
          : `<p class="lead">Fai una domanda su cosa applicare o come farlo: ti risponde l'${esc(CONFIG.nomeAssistenza)}, qui nell'app.</p>
             <a class="btn btn--primario" href="#/ticket/nuovo/">Fai una nuova domanda</a>`
      }
      ${elenco.length ? `<div class="lista">${elenco.map(card).join('')}</div>` : `<p>${op ? 'Nessuna domanda in questo elenco.' : 'Non hai ancora fatto domande.'}</p>`}
    </section>`;
}

async function schermataNuovoTicket(schedaId) {
  const scheda = schedaId ? stato.catalogo.schede.find((x) => x.id === schedaId) : null;
  const voce = scheda ? piano().find((v) => v.scheda.id === scheda.id) : null;
  const a = anagrafica();
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="${scheda ? `#/scheda/${esc(scheda.id)}` : '#/assistenza'}">‹ Indietro</a>
      <h1>Fai una domanda</h1>
      <p class="lead">Scrivi il tuo dubbio con parole semplici. Ti risponde l'${esc(CONFIG.nomeAssistenza)}.</p>
      <form id="ticket">
        <label>Argomento<input class="campo" name="argomento" maxlength="200" required value="${esc(scheda?.titolo || '')}" placeholder="Per esempio: corso antincendio"></label>
        <label>La tua domanda<textarea class="campo" name="testo" rows="6" maxlength="4000" required placeholder="Per esempio: ho assunto un apprendista, quali corsi deve fare e entro quando?"></textarea></label>
        <label>Telefono per richiamarti <small>(facoltativo)</small><input class="campo" name="contatto" type="tel" autocomplete="tel" value="${esc(a.contatto || '')}"></label>
        <p class="riquadro">Non scrivere nomi dei lavoratori né informazioni sulla loro salute. Insieme alla domanda inviamo il nome dell'impresa, il codice ATECO, il numero di lavoratori e la voce del piano, così chi risponde conosce la tua situazione.</p>
        <button class="btn btn--primario btn--grande" type="submit">Invia la domanda</button>
      </form>
    </section>`;
  const form = app.querySelector('#ticket');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    const bottone = form.querySelector('button');
    bottone.disabled = true;
    try {
      const t = await cloud.apriTicket({
        argomento: String(f.get('argomento')).trim(),
        testo: String(f.get('testo')).trim(),
        contatto: String(f.get('contatto') || '').trim(),
        schedaId: scheda?.id,
        impresa: a.ragioneSociale || risposte().nome_impresa || '',
        contesto: contestoTicket({ fatti: ctx().fatti, risposte: risposte(), scheda, voce, versioneApp: VERSIONE_APP })
      });
      avviso('Domanda inviata. Ti avviseremo qui quando arriva la risposta.');
      location.hash = `#/ticket/${t.id}`;
    } catch (e) {
      bottone.disabled = false;
      avviso(e.stato === 0 ? 'Serve la connessione a internet per inviare la domanda.' : e.message);
    }
  });
}

async function schermataTicket(id, schedaId) {
  if (id === 'nuovo') return schermataNuovoTicket(schedaId);
  const op = stato.utente?.operatore;
  let t;
  try {
    t = await cloud.ticket(id);
  } catch (e) {
    return e.stato === 0 ? serveConnessione() : avviso(e.message);
  }
  if (!t) return (location.hash = '#/assistenza');
  const contesto = Object.entries(t.contesto || {}).filter(([k]) => k !== 'versioneApp');
  const ETICHETTE_CONTESTO = { ateco: 'ATECO', classeRischio: 'Rischio', lavoratori: 'Lavoratori', composizione: 'Composizione', attivita: 'Attività', scheda: 'Voce del piano', statoVoce: 'Stato della voce' };
  app.innerHTML = `
    <section class="pagina">
      <a class="indietro" href="#/assistenza">‹ Assistenza</a>
      <p class="pill pill--${t.stato === 'chiuso' ? 'verde' : t.stato === 'risposto' ? 'giallo' : 'info'}">${esc(STATI_TICKET[t.stato])}</p>
      <h1>${esc(t.argomento)}</h1>
      ${
        op
          ? `<dl class="dettagli">
          <div><dt>Impresa</dt><dd>${esc(t.impresa || '—')}</dd></div>
          <div><dt>Account</dt><dd>${esc(t.user_email || '—')}</dd></div>
          ${t.contatto ? `<div><dt>Telefono</dt><dd><a href="tel:${esc(t.contatto.replace(/[^\d+]/g, ''))}">${esc(t.contatto)}</a></dd></div>` : ''}
          ${contesto.map(([k, v]) => `<div><dt>${esc(ETICHETTE_CONTESTO[k] || k)}</dt><dd>${esc(String(v))}</dd></div>`).join('')}
        </dl>
        ${t.scheda_id ? `<a class="btn btn--testo" href="#/scheda/${esc(t.scheda_id)}">Apri la scheda della voce</a>` : ''}`
          : ''
      }
      <div class="messaggi">
        ${t.messaggi
          .map(
            (m) => `<div class="messaggio ${m.da_operatore ? 'messaggio--operatore' : ''}">
          <p class="messaggio__chi">${m.da_operatore ? esc(CONFIG.nomeAssistenza) : op ? esc(t.impresa || 'Impresa') : 'Tu'} · ${esc(dataOra(m.created_at))}</p>
          <p class="messaggio__testo">${esc(m.testo)}</p></div>`
          )
          .join('')}
      </div>
      <form id="risposta">
        <label>${op ? 'Rispondi' : t.stato === 'chiuso' ? 'Scrivi per riaprire la domanda' : 'Aggiungi un messaggio'}
          <textarea class="campo" name="testo" rows="4" maxlength="4000" required></textarea></label>
        <button class="btn btn--primario" type="submit">Invia</button>
      </form>
      ${t.stato !== 'chiuso' ? `<button class="btn btn--testo" id="chiudi">${op ? 'Chiudi la domanda' : 'Ho risolto: chiudi la domanda'}</button>` : ''}
    </section>`;
  app.querySelector('#risposta').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const testo = String(new FormData(ev.target).get('testo')).trim();
    if (!testo) return;
    try {
      await cloud.scriviMessaggio(t.id, testo);
      avviso('Messaggio inviato.');
      schermataTicket(t.id);
    } catch (e) {
      avviso(e.stato === 0 ? 'Serve la connessione a internet.' : e.message);
    }
  });
  app.querySelector('#chiudi')?.addEventListener('click', async () => {
    try {
      await cloud.impostaStato(t.id, 'chiuso');
      avviso('Domanda chiusa.');
      schermataTicket(t.id);
    } catch (e) {
      avviso(e.message);
    }
  });
}

// ---------- avvio ----------

async function instrada() {
  const [, rotta, param, extra] = (location.hash || '#/').split('/').map((x) => (x ? decodeURIComponent(x) : x));
  window.scrollTo(0, 0);
  if (!stato.utente) return schermataAccesso();
  aggiornaNav(rotta || '');
  if (rotta === 'assistenza') return schermataAssistenza(param);
  if (rotta === 'ticket') return schermataTicket(param, extra);
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
  if (rotta === 'documenti') return schermataDocumenti();
  if (rotta === 'documento') return schermataDocumento(param, extra);
  return schermataOggi();
}

async function avvia() {
  try {
    const [q, c, l, d, a, t] = await Promise.all(
      ['data/questionario.json', 'data/catalogo.json', 'data/lavoratori.json', 'data/dvr.json', 'data/ateco.json', 'data/attrezzature.json'].map((u) => fetch(u).then((r) => r.json()))
    );
    stato.defAttr = t;
    stato.dvr = d;
    stato.ateco = a;
    stato.questionario = q;
    stato.catalogo = c;
    stato.defLav = l;
    await ricarica();
    stato.utente = await verificaAccesso();
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
