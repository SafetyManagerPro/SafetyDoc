// Motore delle regole di safetyDoc.
// Modulo puro: nessun accesso al DOM o allo storage, così si può testare con Node.

export const GIORNI_PREAVVISO = 60;

const RISCHI_CON_SORVEGLIANZA = [
  'rumore_vibrazioni',
  'carichi',
  'chimici',
  'videoterminali',
  'notte_guida',
  'quota',
  'confinati',
  'amianto',
  'polveri_cancerogene',
  'biologici'
];

/**
 * Interpreta un codice ATECO (es. "43.21.01", "432101", "43.21") con la tabella data/ateco.json.
 * Restituisce divisione, sezione, classe di rischio per la formazione e il settore suggerito.
 */
export function cercaAteco(codice, ateco) {
  const cifre = String(codice ?? '').replace(/[^0-9]/g, '');
  if (cifre.length < 2 || !ateco?.divisioni) return null;
  const divisione = cifre.slice(0, 2);
  const info = ateco.divisioni[divisione];
  if (!info) return { valido: false, cifre };
  const gruppi = [cifre.slice(0, 2), cifre.slice(2, 4), cifre.slice(4, 6)].filter(Boolean);
  const normalizzato = gruppi.join('.');
  // settore suggerito: il prefisso più lungo presente in tabella (es. 43.2 prima di 43)
  let settore = null;
  for (const lung of [6, 5, 4, 3, 2]) {
    if (cifre.length < lung) continue;
    const pref = cifre.slice(0, 2) + (lung > 2 ? '.' + cifre.slice(2, lung) : '');
    if (ateco.settori?.[pref]) {
      settore = ateco.settori[pref];
      break;
    }
  }
  return {
    valido: true,
    codice: normalizzato,
    divisione,
    descrizione: info.descrizione,
    sezione: info.sezione,
    descrizioneSezione: ateco.sezioni?.[info.sezione] || '',
    classe: info.classe,
    ore: ateco.oreFormazioneSpecifica?.[info.classe] ?? null,
    settore
  };
}

/** Fatti derivati dalle risposte, usabili nelle regole con {"fatto": "..."} */
export function derivaFatti(risposte, questionario, ateco) {
  const r = risposte || {};
  const haDipendenti = r.composizione === 'dipendenti';
  const lavoratori = haDipendenti ? Math.max(1, Number(r.numero_lavoratori) || 1) : 0;

  const domandaAttivita = questionario?.domande?.find((d) => d.id === 'attivita');
  const atecoInfo = r.ateco ? cercaAteco(r.ateco, ateco) : null;
  const atecoValido = atecoInfo?.valido ? atecoInfo : null;
  const valoreAttivita = r.attivita || atecoValido?.settore;
  const opzione = domandaAttivita?.opzioni?.find((o) => o.valore === valoreAttivita);

  // La classe di rischio per la formazione segue il codice ATECO; se manca, il settore scelto.
  const classeRischio = atecoValido?.classe ?? opzione?.classeRischio ?? 'da_verificare';
  const ore = { basso: 4, medio: 8, alto: 12, ...(ateco?.oreFormazioneSpecifica || {}) };

  return {
    haDipendenti,
    lavoratori,
    classeRischio,
    fonteClasse: atecoValido ? 'ateco' : opzione ? 'attivita' : null,
    oreFormazioneSpecifica: ore[classeRischio] ?? null,
    ateco: atecoValido,
    attivitaRegolamentata: Boolean(opzione?.regolamentata),
    // Allegato VII: costruzioni, siderurgia, porti ed estrazione hanno verifiche più frequenti
    settoreSollevamentoGravoso:
      ['B', 'F'].includes(atecoValido?.sezione) ||
      atecoValido?.divisione === '24' ||
      /^52\.22/.test(atecoValido?.codice || '') ||
      (!atecoValido && ['edilizia', 'impianti'].includes(valoreAttivita)),
    rischiConSorveglianza: RISCHI_CON_SORVEGLIANZA.some((k) => r[k] === true)
  };
}

function leggi(nome, ctx) {
  if (nome in ctx.fatti) return ctx.fatti[nome];
  return ctx.risposte[nome];
}

/**
 * Valuta una regola. Forme ammesse:
 * {"sempre": true} | {"fatto": "x"} | {"q": "id", "eq"|"ne"|"gt"|"gte"|"lt"|"lte"|"in": valore}
 * {"all": [...]} | {"any": [...]} | {"not": regola}
 */
export function valuta(regola, ctx) {
  if (!regola) return false;
  if (regola.sempre) return true;
  if (regola.all) return regola.all.every((r) => valuta(r, ctx));
  if (regola.any) return regola.any.some((r) => valuta(r, ctx));
  if (regola.not) return !valuta(regola.not, ctx);
  if (regola.fatto) return Boolean(leggi(regola.fatto, ctx));
  if (regola.q) {
    const v = leggi(regola.q, ctx);
    if ('eq' in regola) return v === regola.eq;
    if ('ne' in regola) return v !== regola.ne;
    if ('in' in regola) return Array.isArray(regola.in) && regola.in.includes(v);
    const n = Number(v);
    if (v === undefined || v === null || v === '' || Number.isNaN(n)) return false;
    if ('gt' in regola) return n > regola.gt;
    if ('gte' in regola) return n >= regola.gte;
    if ('lt' in regola) return n < regola.lt;
    if ('lte' in regola) return n <= regola.lte;
  }
  return false;
}

export function creaContesto(risposte, questionario, ateco) {
  const r = risposte || {};
  return { risposte: r, fatti: derivaFatti(r, questionario, ateco) };
}

/** Domande da mostrare, tenendo conto di "mostraSe". */
export function domandeVisibili(questionario, risposte) {
  const ctx = creaContesto(risposte, questionario);
  return questionario.domande.filter((d) => !d.mostraSe || valuta(d.mostraSe, ctx));
}

/**
 * Le schermate del questionario: le domande sì/no dello stesso "gruppo" vanno su una sola schermata,
 * così l'utente le spunta tutte insieme invece di rispondere una alla volta.
 */
export function schermate(questionario, risposte) {
  const out = [];
  for (const d of domandeVisibili(questionario, risposte)) {
    const ultima = out[out.length - 1];
    if (d.gruppo && ultima?.gruppo === d.gruppo) ultima.domande.push(d);
    else if (d.gruppo) out.push({ gruppo: d.gruppo, ...(questionario.gruppi?.[d.gruppo] || {}), domande: [d] });
    else out.push({ domande: [d] });
  }
  return out;
}

export function aggiungiMesi(dataIso, mesi) {
  const [a, m, g] = dataIso.slice(0, 10).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + mesi, 1));
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(g, ultimo));
  return d.toISOString().slice(0, 10);
}

function giorniTra(daIso, aIso) {
  return Math.round((Date.parse(aIso.slice(0, 10)) - Date.parse(daIso.slice(0, 10))) / 86400000);
}

export function periodicitaPer(scheda, ctx) {
  for (const regola of scheda.periodicitaRegole || []) {
    if (valuta(regola.se, ctx)) return regola.mesi;
  }
  return scheda.periodicitaMesi ?? null;
}

/** Tra più record della stessa scheda (es. da postazioni diverse) vale il più recente non cancellato. */
export function statoCorrente(schedaId, adempimenti) {
  return (adempimenti || [])
    .filter((a) => a.schedaId === schedaId && !a.deleted)
    .sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''))[0] || null;
}

const ORDINE = { rosso: 0, giallo: 1, verde: 2, info: 3 };

/**
 * Calcola il semaforo di una scheda.
 * colore: rosso (da fare o scaduto), giallo (in scadenza o scadenza da inserire), verde (in regola), info (solo quando capita).
 */
export function semaforo(scheda, stato, ctx, oggi) {
  if (scheda.tipoScadenza === 'evento') {
    return { colore: 'info', motivo: 'Da fare quando capita', prossimaScadenza: null };
  }
  if (!stato || !stato.fatto) {
    return { colore: 'rosso', motivo: 'Da fare', prossimaScadenza: null };
  }
  if (scheda.tipoScadenza === 'una_tantum') {
    return { colore: 'verde', motivo: 'Fatto', prossimaScadenza: null };
  }

  let prossima = stato.scadenzaManuale || null;
  if (!prossima && scheda.tipoScadenza === 'periodica' && stato.dataFatto) {
    const mesi = periodicitaPer(scheda, ctx);
    if (mesi) prossima = aggiungiMesi(stato.dataFatto, mesi);
  }
  if (!prossima) {
    return { colore: 'giallo', motivo: 'Inserisci la prossima scadenza', prossimaScadenza: null };
  }

  const giorni = giorniTra(oggi, prossima);
  if (giorni < 0) return { colore: 'rosso', motivo: 'Scaduto', prossimaScadenza: prossima, giorni };
  if (giorni <= GIORNI_PREAVVISO) return { colore: 'giallo', motivo: 'In scadenza', prossimaScadenza: prossima, giorni };
  return { colore: 'verde', motivo: 'In regola', prossimaScadenza: prossima, giorni };
}

/** Il piano dell'impresa: le schede attive con il loro semaforo, ordinate per urgenza. */
export function generaPiano({ catalogo, questionario, risposte, adempimenti, oggi, ateco }) {
  const ctx = creaContesto(risposte, questionario, ateco);
  const giorno = (oggi || new Date().toISOString()).slice(0, 10);

  return catalogo.schede
    .filter((s) => valuta(s.attivaSe, ctx))
    .map((scheda) => {
      const stato = statoCorrente(scheda.id, adempimenti);
      return { scheda, stato, ...semaforo(scheda, stato, ctx, giorno) };
    })
    .sort((a, b) => {
      const d = ORDINE[a.colore] - ORDINE[b.colore];
      if (d) return d;
      // tra le voci rosse vengono prima quelle che proteggono di più i lavoratori
      if (a.colore === 'rosso') {
        const p = (a.scheda.priorita ?? 2) - (b.scheda.priorita ?? 2);
        if (p) return p;
      }
      const sa = a.prossimaScadenza || '9999';
      const sb = b.prossimaScadenza || '9999';
      return sa.localeCompare(sb);
    });
}

/** Le cose più urgenti da mostrare in apertura (al massimo tre). */
export function cosaFareAdesso(piano, quante = 3) {
  return piano.filter((v) => v.colore === 'rosso' || v.colore === 'giallo').slice(0, quante);
}

export function conteggi(piano) {
  const c = { rosso: 0, giallo: 0, verde: 0, info: 0 };
  for (const v of piano) c[v.colore]++;
  return c;
}

// ---------- lavoratori ----------

export const ESITI_VISITA = {
  idoneo: 'Idoneo',
  idoneo_prescrizioni: 'Idoneo con prescrizioni o limitazioni',
  non_idoneo_temporaneo: 'Non idoneo temporaneamente',
  non_idoneo: 'Non idoneo'
};

export const nomeCompleto = (l) => [l?.nome, l?.cognome].filter(Boolean).join(' ') || 'Lavoratore senza nome';

export function lavoratoriAttivi(lavoratori, oggi) {
  const giorno = (oggi || new Date().toISOString()).slice(0, 10);
  return (lavoratori || [])
    .filter((l) => !l.deleted && !(l.dataCessazione && l.dataCessazione <= giorno))
    .sort((a, b) => nomeCompleto(a).localeCompare(nomeCompleto(b), 'it'));
}

/** Ruoli che l'impresa può assegnare, tenendo conto delle sue risposte. */
export function ruoliDisponibili(defLavoratori, ctx) {
  return defLavoratori.ruoli.filter((r) => !r.attivaSe || valuta(r.attivaSe, ctx));
}

/** I requisiti che valgono per un lavoratore: quelli per tutti più quelli dei suoi ruoli. */
export function requisitiLavoratore(lavoratore, defLavoratori, ctx) {
  const ruoli = new Set(lavoratore.ruoli || []);
  return defLavoratori.requisiti.filter((r) => valuta(r.attivaSe, ctx) && (!r.ruolo || ruoli.has(r.ruolo)));
}

/** Ultima registrazione valida di un requisito per un lavoratore. */
export function ultimoRegistro(lavoratoreId, requisitoId, registri) {
  return (registri || [])
    .filter((r) => r.lavoratoreId === lavoratoreId && r.requisitoId === requisitoId && !r.deleted)
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0] || null;
}

export function storicoRegistri(lavoratoreId, requisitoId, registri) {
  return (registri || [])
    .filter((r) => r.lavoratoreId === lavoratoreId && r.requisitoId === requisitoId && !r.deleted)
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

/** Situazione di un lavoratore: ogni requisito con il suo semaforo, dal più urgente. */
export function situazioneLavoratore({ lavoratore, defLavoratori, registri, ctx, oggi }) {
  const giorno = (oggi || new Date().toISOString()).slice(0, 10);
  const voci = requisitiLavoratore(lavoratore, defLavoratori, ctx).map((requisito) => {
    const reg = ultimoRegistro(lavoratore.id, requisito.id, registri);
    const stato = reg ? { fatto: true, dataFatto: reg.data, scadenzaManuale: reg.scadenzaManuale || null } : null;
    const s = semaforo(requisito, stato, ctx, giorno);
    if (requisito.conEsito && reg?.esito === 'non_idoneo_temporaneo' && s.colore === 'verde') {
      s.colore = 'giallo';
      s.motivo = 'Non idoneo temporaneamente';
    }
    return { requisito, registro: reg, ...s };
  });
  voci.sort((a, b) => ORDINE[a.colore] - ORDINE[b.colore] || (a.prossimaScadenza || '9999').localeCompare(b.prossimaScadenza || '9999'));
  const c = conteggi(voci);
  const colore = c.rosso ? 'rosso' : c.giallo ? 'giallo' : 'verde';
  return { lavoratore, voci, conteggi: c, colore };
}

/** Le scadenze più urgenti di tutti i lavoratori, per la schermata iniziale. */
export function urgenzeLavoratori({ lavoratori, defLavoratori, registri, ctx, oggi }) {
  const out = [];
  for (const l of lavoratoriAttivi(lavoratori, oggi)) {
    const sit = situazioneLavoratore({ lavoratore: l, defLavoratori, registri, ctx, oggi });
    for (const v of sit.voci) if (v.colore === 'rosso' || v.colore === 'giallo') out.push({ lavoratore: l, ...v });
  }
  return out.sort(
    (a, b) =>
      ORDINE[a.colore] - ORDINE[b.colore] ||
      (a.prossimaScadenza || '0000').localeCompare(b.prossimaScadenza || '0000') ||
      nomeCompleto(a.lavoratore).localeCompare(nomeCompleto(b.lavoratore), 'it')
  );
}

// ---------- attrezzature ----------

export function tipoAttrezzatura(defAttr, tipoId) {
  return defAttr?.tipi?.find((t) => t.id === tipoId) || defAttr?.tipi?.find((t) => t.id === 'altro');
}

export function attrezzatureAttive(attrezzature) {
  return (attrezzature || [])
    .filter((a) => !a.deleted && !a.dismessa)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'));
}

/** Contesto per una singola attrezzatura: aggiunge l'età della macchina ai fatti dell'impresa. */
function contestoAttrezzatura(attrezzatura, ctx, oggi) {
  const anno = Number(attrezzatura.annoFabbricazione);
  const annoOggi = Number((oggi || new Date().toISOString()).slice(0, 4));
  return { risposte: ctx.risposte, fatti: { ...ctx.fatti, oltre10anni: Boolean(anno) && annoOggi - anno > 10 } };
}

export function ultimoControllo(attrezzaturaId, controlloId, controlli) {
  return storicoControlli(attrezzaturaId, controlloId, controlli)[0] || null;
}

export function storicoControlli(attrezzaturaId, controlloId, controlli) {
  return (controlli || [])
    .filter((c) => c.attrezzaturaId === attrezzaturaId && c.controlloId === controlloId && !c.deleted)
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/** Situazione di un'attrezzatura: ogni controllo con il suo semaforo e la periodicità calcolata. */
export function situazioneAttrezzatura({ attrezzatura, defAttr, controlli, ctx, oggi }) {
  const giorno = (oggi || new Date().toISOString()).slice(0, 10);
  const tipo = tipoAttrezzatura(defAttr, attrezzatura.tipo);
  const c2 = contestoAttrezzatura(attrezzatura, ctx, giorno);
  const voci = (tipo?.controlli || []).map((def) => {
    const mesi = periodicitaPer(def, c2);
    const controllo = { ...def, periodicitaMesi: mesi ?? def.periodicitaMesi };
    const reg = ultimoControllo(attrezzatura.id, def.id, controlli);
    const stato = reg ? { fatto: true, dataFatto: reg.data, scadenzaManuale: reg.scadenzaManuale || null } : null;
    return { controllo, registro: reg, ...semaforo(controllo, stato, c2, giorno) };
  });
  voci.sort((a, b) => ORDINE[a.colore] - ORDINE[b.colore] || (a.prossimaScadenza || '9999').localeCompare(b.prossimaScadenza || '9999'));
  const c = conteggi(voci);
  return { attrezzatura, tipo, voci, conteggi: c, colore: c.rosso ? 'rosso' : c.giallo ? 'giallo' : 'verde' };
}

export function urgenzeAttrezzature({ attrezzature, defAttr, controlli, ctx, oggi }) {
  const out = [];
  for (const a of attrezzatureAttive(attrezzature)) {
    const sit = situazioneAttrezzatura({ attrezzatura: a, defAttr, controlli, ctx, oggi });
    for (const v of sit.voci) if (v.colore === 'rosso' || v.colore === 'giallo') out.push({ attrezzatura: a, ...v });
  }
  return out.sort((a, b) => ORDINE[a.colore] - ORDINE[b.colore] || (a.prossimaScadenza || '0000').localeCompare(b.prossimaScadenza || '0000'));
}

// ---------- controllo iniziale ----------

/**
 * Le voci da chiedere nel controllo iniziale: quelle ancora "da fare" che l'impresa potrebbe aver già fatto
 * (non quelle che si fanno solo quando capita). Le più importanti per prime.
 */
export function vociControlloIniziale(piano) {
  return (piano || [])
    .filter((v) => v.colore === 'rosso' && !v.stato?.fatto && v.scheda.tipoScadenza !== 'evento')
    .sort((a, b) => (a.scheda.priorita ?? 2) - (b.scheda.priorita ?? 2));
}

/** "2025-06" (campo mese) → "2025-06-01"; date complete restano uguali; altro → null. */
export function dataDaMese(valore) {
  const v = String(valore || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`;
  return null;
}

// ---------- prodotti chimici ----------

/** Pittogrammi di pericolo del regolamento CLP. */
export const PITTOGRAMMI = [
  { id: 'GHS01', etichetta: 'Esplosivo' },
  { id: 'GHS02', etichetta: 'Infiammabile' },
  { id: 'GHS03', etichetta: 'Comburente' },
  { id: 'GHS04', etichetta: 'Gas sotto pressione' },
  { id: 'GHS05', etichetta: 'Corrosivo' },
  { id: 'GHS06', etichetta: 'Tossicità acuta (teschio)' },
  { id: 'GHS07', etichetta: 'Irritante o nocivo (punto esclamativo)' },
  { id: 'GHS08', etichetta: 'Grave pericolo per la salute (sagoma umana)' },
  { id: 'GHS09', etichetta: "Pericoloso per l'ambiente" }
];

/** Frasi H che indicano cancerogeni, mutageni o tossici per la riproduzione (categorie 1A e 1B). */
export function frasiCmr(frasiH) {
  return [...new Set((String(frasiH || '').toUpperCase().match(/H3[456]0[A-Z]{0,2}/g) || []))];
}

export const prodottiAttivi = (prodotti) => (prodotti || []).filter((p) => !p.deleted && !p.dismesso);

/** Semaforo di un prodotto: scheda di sicurezza presente? sostanze molto pericolose? */
export function situazioneProdotto(prodotto, numeroAllegati = 0) {
  const cmr = frasiCmr(prodotto.frasiH);
  if (!prodotto.dataSds && !numeroAllegati) return { prodotto, colore: 'rosso', motivo: 'Manca la scheda di sicurezza', cmr };
  if (cmr.length) return { prodotto, colore: 'giallo', motivo: `Contiene ${cmr.join(', ')}: valuta la sostituzione con l'RSPP`, cmr };
  return { prodotto, colore: 'verde', motivo: 'Scheda di sicurezza presente', cmr };
}

// ---------- infortuni e quasi incidenti ----------

export const TIPI_EVENTO = {
  infortunio: 'Infortunio',
  medicazione: 'Piccola medicazione (nessun giorno di assenza)',
  quasi_incidente: 'Quasi incidente (nessuno si è fatto male)'
};

const piuGiorni = (iso, giorni) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
};

/**
 * Cosa resta da fare per un evento. Denuncia INAIL per prognosi oltre 3 giorni, comunicazione statistica per
 * almeno 1 giorno, in entrambi i casi entro 2 giorni dal certificato; poi una misura per evitare che si ripeta.
 */
export function situazioneEvento(evento, oggi) {
  const azioni = [];
  if (evento.tipo === 'infortunio') {
    const g = evento.giorniPrognosi;
    const base = evento.dataCertificato || evento.data;
    if (g === null || g === undefined || g === '') {
      azioni.push({ colore: 'giallo', motivo: 'Scrivi i giorni di prognosi del certificato medico' });
    } else if (!evento.dataDenuncia && Number(g) >= 1) {
      const entro = piuGiorni(base, 2);
      azioni.push({
        colore: Number(g) > 3 || entro < oggi ? 'rosso' : 'giallo',
        motivo: Number(g) > 3 ? 'Denuncia di infortunio all’INAIL da fare' : 'Comunicazione all’INAIL a fini statistici da fare',
        scadenza: entro
      });
    }
  }
  if (!evento.misureFatte) {
    azioni.push({ colore: 'giallo', motivo: evento.misure ? 'Misura decisa, da completare' : 'Decidi una misura per evitare che si ripeta' });
  }
  const colore = azioni.some((a) => a.colore === 'rosso') ? 'rosso' : azioni.length ? 'giallo' : 'verde';
  const principale = azioni.find((a) => a.colore === colore) || null;
  return { evento, colore, azioni, motivo: principale?.motivo || 'Chiuso', scadenza: principale?.scadenza || null };
}

export const eventiAttivi = (eventi) => (eventi || []).filter((e) => !e.deleted).sort((a, b) => (b.data || '').localeCompare(a.data || ''));

export function urgenzeEventi(eventi, oggi) {
  const ordine = { rosso: 0, giallo: 1 };
  return eventiAttivi(eventi)
    .map((e) => situazioneEvento(e, oggi))
    .filter((s) => s.colore !== 'verde')
    .sort((a, b) => ordine[a.colore] - ordine[b.colore]);
}

/** Conteggio degli eventi per anno, utile per la valutazione dello stress (eventi sentinella). */
export function eventiPerAnno(eventi, anni) {
  const r = {};
  for (const a of anni) r[a] = { infortunio: 0, medicazione: 0, quasi_incidente: 0 };
  for (const e of eventiAttivi(eventi)) {
    const a = Number((e.data || '').slice(0, 4));
    if (r[a] && r[a][e.tipo] !== undefined) r[a][e.tipo]++;
  }
  return r;
}
