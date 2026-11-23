import { domandeVisibili, generaPiano, cosaFareAdesso, conteggi, creaContesto, periodicitaPer } from './engine.js';
import { unisciCollezione, creaExport, validaExport, FORMATO_CIFRATO, COLLEZIONI } from './merge.js';
import { cifra, decifra } from './cifratura.js';
import * as store from './store.js';

export const VERSIONE_APP = '0.3.0';
const GIORNI_PROMEMORIA_BACKUP = 7;

const stato = { questionario: null, catalogo: null, profilo: null, adempimenti: [] };
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
}

const risposte = () => stato.profilo?.risposte || {};
const questionarioCompletato = () => Boolean(risposte().__completato);

function piano() {
  return generaPiano({
    catalogo: stato.catalogo,
    questionario: stato.questionario,
    risposte: risposte(),
    adempimenti: stato.adempimenti,
    oggi: oggiIso()
  });
}

function aggiornaNav(rotta) {
  for (const a of document.querySelectorAll('.nav a')) {
    a.setAttribute('aria-current', a.dataset.rotta === rotta ? 'page' : 'false');
  }
  document.querySelector('.nav').hidden = !questionarioCompletato();
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
      <p class="lead">Rispondi a circa 20 domande semplici. Ti diremo cosa devi fare, come farlo e entro quando.</p>
      <ul class="punti">
        <li>Ci vogliono circa 5 minuti.</li>
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
    </section>`;
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
  const visibili = domandeVisibili(stato.questionario, risposte());
  const i = Math.max(0, Math.min(Number(indice) || 0, visibili.length - 1));
  const d = visibili[i];
  const r = risposte();
  const valore = r[d.id];

  let campo = '';
  if (d.tipo === 'sino') {
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
  } else if (d.tipo === 'numero') {
    campo = `<input class="campo" id="campo" type="number" inputmode="numeric" min="${d.minimo ?? 0}" value="${esc(valore ?? '')}" aria-label="${esc(d.testo)}">`;
  } else {
    campo = `<input class="campo" id="campo" type="text" autocomplete="organization" value="${esc(valore ?? '')}" aria-label="${esc(d.testo)}">`;
  }

  const percento = Math.round((i / visibili.length) * 100);
  const conCampo = d.tipo === 'numero' || d.tipo === 'testo';

  app.innerHTML = `
    <section class="pagina domanda">
      <div class="progresso" role="progressbar" aria-valuemin="0" aria-valuemax="${visibili.length}" aria-valuenow="${i + 1}" aria-label="Domanda ${i + 1} di ${visibili.length}">
        <div style="width:${percento}%"></div>
      </div>
      <p class="sopratitolo">Domanda ${i + 1} di ${visibili.length}</p>
      <h1>${esc(d.testo)}</h1>
      ${d.aiuto ? `<p class="aiuto">${esc(d.aiuto)}</p>` : ''}
      ${campo}
      <div class="azioni">
        ${i > 0 ? `<a class="btn btn--secondario" href="#/domanda/${i - 1}">Indietro</a>` : '<span></span>'}
        ${conCampo ? `<button class="btn btn--primario" id="avanti">Avanti</button>` : ''}
      </div>
    </section>`;

  const vai = async (v) => {
    const nuove = { ...risposte(), [d.id]: v };
    const ancoraVisibili = domandeVisibili(stato.questionario, nuove);
    const posizione = ancoraVisibili.findIndex((x) => x.id === d.id);
    const ultima = posizione === ancoraVisibili.length - 1;
    if (ultima) nuove.__completato = true;
    await store.salvaRisposte(nuove);
    await ricarica();
    location.hash = ultima ? '#/' : `#/domanda/${posizione + 1}`;
  };

  for (const b of app.querySelectorAll('.scelta')) {
    b.addEventListener('click', () => vai(JSON.parse(b.dataset.valore)));
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
      vai(v);
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

      <h2>Questionario</h2>
      <a class="btn btn--secondario" href="#/domanda/0">Cambia le risposte</a>

      <p class="nota">safetyDoc ${VERSIONE_APP} · catalogo ${esc(stato.catalogo.versione)} del ${dataLeggibile(stato.catalogo.aggiornato)}. ${esc(stato.catalogo.avvertenza)}</p>
    </section>`;

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
      if (c === 'adempimenti') {
        const n = (x, uno, tanti) => `${x} ${x === 1 ? uno : tanti}`;
        righe.push(`${n(riepilogo.aggiunti, 'voce nuova', 'voci nuove')}, ${n(riepilogo.aggiornati, 'aggiornata', 'aggiornate')}.`);
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
  const [, rotta, param] = (location.hash || '#/').split('/');
  aggiornaNav(rotta || '');
  window.scrollTo(0, 0);
  if (rotta === 'domanda') return schermataDomanda(param);
  if (rotta === 'piano') return schermataPiano();
  if (rotta === 'scheda') return schermataScheda(decodeURIComponent(param || ''));
  if (rotta === 'dati') return schermataDati();
  return schermataOggi();
}

async function avvia() {
  try {
    const [q, c] = await Promise.all([fetch('data/questionario.json'), fetch('data/catalogo.json')].map((p) => p.then((r) => r.json())));
    stato.questionario = q;
    stato.catalogo = c;
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
