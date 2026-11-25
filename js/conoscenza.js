// Motore della conoscenza: indice locale di rischi, adempimenti, documenti, attrezzature,
// lavorazioni, corsi, norme e sigle; ricerca con sinonimi; collegamenti; verifiche di coerenza.
// Funziona senza connessione e senza server: tutto è calcolato sul dispositivo. Modulo puro.

import { valuta, frasiCmr, lavoratoriAttivi, archivioAttuale, statoCorrente } from './engine.js';

// ---------- testo ----------

/** Minuscole, senza accenti e senza punteggiatura, spazi singoli. */
export function normalizza(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const PAROLE_VUOTE = new Set(
  'a ad al all allo alla ai agli alle anche c che d dall dell nell sull l chi ci come con cosa cui da dal dallo dalla dai dagli dalle de del dello della dei degli delle devo deve di do e ed fa fare faccio gli ha hai ho i il in io la le lo ma mi mia mie miei mio ne nel nello nella nei negli nelle no non o per piu poi quale quali quando quanto se si sia sono su sul sullo sulla sui sugli sulle ti tra fra tu tua tuo un una uno va vanno voglio serve servono'.split(' ')
);

const SUFFISSI = ['amento', 'imento', 'azioni', 'azione', 'zioni', 'zione', 'mente', 'atori', 'atore', 'ature', 'atura', 'abili', 'abile', 'ibili', 'ibile', 'iche', 'ichi', 'ici', 'ico', 'ica', 'ali', 'ale', 'ori', 'ore', 'io', 'ia', 'ie', 'i', 'e', 'a', 'o'];

/** Radice approssimativa di una parola italiana (abbastanza per trovare plurali e derivati). */
export function radice(parola) {
  const p = normalizza(parola);
  if (p.length <= 4 || /\d/.test(p)) return p;
  for (const s of SUFFISSI) if (p.endsWith(s) && p.length - s.length >= 4) return p.slice(0, -s.length);
  return p;
}

const parole = (s) => normalizza(s).split(' ').filter(Boolean);
const paroleUtili = (s) => parole(s).filter((p) => !PAROLE_VUOTE.has(p) && (p.length > 1 || /\d/.test(p)));
const contiene = (testo, frase) => ` ${testo} `.includes(` ${frase} `);
const unici = (arr) => [...new Set(arr.filter(Boolean))];

// ---------- norme ----------

/** Norme della banca citate in un testo (es. il riferimento di una scheda). */
export function normeCitate(testo, norme) {
  const t = normalizza(testo);
  if (!t) return [];
  return (norme || []).filter((n) => [n.sigla, ...(n.alias || [])].some((a) => contiene(t, normalizza(a)))).map((n) => n.id);
}

/** Rischi del DVR collegati a un testo libero (es. i rischi di una fase di cantiere). */
export function rischiDaTesto(testo, parolePericoli) {
  const t = normalizza(testo);
  return unici((parolePericoli || []).filter((x) => x.parole.some((p) => t.includes(normalizza(p)))).flatMap((x) => x.pericoli));
}

// ---------- indice ----------

const HREF = {
  rischio: (id) => `#/sapere/rischio/${id}`,
  adempimento: (id) => `#/scheda/${id}`,
  documento: (id) => `#/sapere/documento/${id}`,
  attrezzatura: (id) => `#/sapere/attrezzatura/${id}`,
  fase: (id) => `#/sapere/fase/${id}`,
  appalto: (id) => `#/sapere/appalto/${id}`,
  requisito: (id) => `#/sapere/requisito/${id}`,
  certificato: (id) => `#/archivio-voce/nuovo/certificato`,
  planimetria: (id) => `#/archivio-voce/nuovo/planimetria`,
  norma: (id) => `#/sapere/norma/${id}`,
  sigla: (id) => `#/sapere/sigla/${id}`
};

export const TIPI_VOCE = {
  rischio: 'Rischi',
  adempimento: 'Cosa fare',
  documento: 'Documenti',
  attrezzatura: 'Attrezzature e macchine',
  fase: 'Lavorazioni di cantiere',
  appalto: 'Lavori affidati a ditte esterne',
  requisito: 'Corsi, visite e abilitazioni',
  certificato: 'Certificati da conservare',
  planimetria: 'Planimetrie',
  norma: 'Norme',
  sigla: 'Sigle e parole'
};

export const idSigla = (sigla) => normalizza(sigla).replace(/ /g, '-');

/**
 * Costruisce l'indice da tutte le banche dati dell'app.
 * fonti: { conoscenza, dvr, catalogo, modelli, defAttr, lavorazioni, defLav, defArchivio }
 */
export function costruisciIndice(fonti) {
  const { conoscenza: k = {}, dvr, catalogo, modelli, defAttr, lavorazioni, defLav, defArchivio } = fonti || {};
  const norme = k.norme || [];
  const mappaPericoli = k.pericoliAttrezzature || {};
  const voci = [];
  const aggiungi = (tipo, id, titolo, testo, extra = {}) =>
    voci.push({ tipo, id, chiave: `${tipo}:${id}`, titolo, sottotitolo: extra.sottotitolo || '', testo: testo || '', href: HREF[tipo](id), norme: extra.norme || [], rischi: extra.rischi || [], adempimenti: extra.adempimenti || [], dati: extra.dati || null });

  for (const r of dvr?.pericoli || [])
    aggiungi('rischio', r.id, r.pericolo, [r.famiglia, r.danno, ...(r.misure || []), ...(r.dpi || []), r.formazione, ...(r.miglioramenti || [])].join(' '), {
      sottotitolo: r.famiglia,
      norme: normeCitate(r.norma, norme),
      rischi: [r.id],
      adempimenti: r.schedaId ? [r.schedaId] : [],
      dati: r
    });

  for (const s of catalogo?.schede || [])
    aggiungi('adempimento', s.id, s.titolo, [s.cosaE, s.perche, ...(s.come || []), s.chi, s.quando].join(' '), {
      sottotitolo: catalogo.categorie?.find?.((c) => c.id === s.categoria)?.titolo || s.categoria,
      norme: normeCitate(s.riferimento, norme),
      rischi: (dvr?.pericoli || []).filter((r) => r.schedaId === s.id).map((r) => r.id),
      adempimenti: [s.id],
      dati: s
    });

  for (const m of modelli || []) {
    const doc = k.documenti?.[m.id] || {};
    aggiungi('documento', m.id, m.titolo, [m.descrizione, ...(doc.consigli || [])].join(' '), {
      sottotitolo: m.ambito === 'lavoratore' ? 'Documento per ogni lavoratore' : 'Documento dell\'impresa',
      norme: doc.norme || [],
      rischi: doc.rischi || [],
      adempimenti: doc.adempimenti || [],
      dati: { id: m.id, titolo: m.titolo, descrizione: m.descrizione, ambito: m.ambito, ...doc }
    });
  }

  const etichettaPericolo = Object.fromEntries((defAttr?.pericoli || []).map((p) => [p.id, p.etichetta]));
  for (const t of defAttr?.tipi || [])
    aggiungi('attrezzatura', t.id, t.etichetta, [...(t.controlli || []).flatMap((c) => [c.titolo, c.aiuto]), ...(t.pericoli || []).map((p) => etichettaPericolo[p]), ...(t.dpi || []), t.patentino ? 'abilitazione patentino operatore' : ''].join(' '), {
      sottotitolo: t.patentino ? 'Serve l\'abilitazione dell\'operatore' : 'Attrezzatura',
      norme: unici(['dlgs-81-2008', ...(t.controlli || []).some((c) => /Allegato VII/i.test(`${c.titolo} ${c.aiuto}`)) ? ['dm-11-4-2011'] : []]),
      rischi: unici([...(t.pericoli || []).map((p) => mappaPericoli[p]), t.patentino ? 'attrezzature-abilitazione' : '', t.id === 'ponteggio' || t.id === 'trabattello' || t.id === 'ple' || t.id === 'scala' ? 'quota' : '']),
      adempimenti: unici([t.patentino ? 'attrezzature-abilitazione' : '', ['ponteggio', 'trabattello', 'scala'].includes(t.id) ? 'lavori-quota' : '']),
      dati: t
    });

  for (const f of lavorazioni?.fasiCantiere || [])
    aggiungi('fase', f.id, f.titolo, [...(f.rischi || []), ...(f.misure || []), ...(f.attrezzature || []), ...(f.dpi || [])].join(' '), {
      sottotitolo: 'Fase di lavoro nel POS',
      norme: ['dlgs-81-2008'],
      rischi: rischiDaTesto((f.rischi || []).join(' '), k.parolePericoli),
      adempimenti: ['pos'],
      dati: f
    });

  for (const t of lavorazioni?.tipiAppalto || [])
    aggiungi('appalto', t.id, t.titolo, [...(t.rischiIntrodotti || []), ...(t.interferenze || []).flatMap((x) => [x.attivita, x.rischio, x.misure])].join(' '), {
      sottotitolo: 'Interferenze nel DUVRI',
      norme: ['dlgs-81-2008'],
      rischi: unici(['interferenze', ...rischiDaTesto((t.rischiIntrodotti || []).join(' '), k.parolePericoli)]),
      adempimenti: ['duvri'],
      dati: t
    });

  const ruoli = Object.fromEntries((defLav?.ruoli || []).map((r) => [r.id, r.etichetta]));
  for (const r of defLav?.requisiti || [])
    aggiungi('requisito', r.id, r.titolo, [r.aiuto, r.ruolo ? ruoli[r.ruolo] : 'tutti i lavoratori'].join(' '), {
      sottotitolo: r.ruolo ? `Per: ${ruoli[r.ruolo] || r.ruolo}` : 'Per tutti i lavoratori',
      norme: normeCitate(catalogo?.schede?.find((s) => s.id === r.schedaId)?.riferimento, norme),
      adempimenti: r.schedaId ? [r.schedaId] : [],
      dati: { ...r, etichettaRuolo: r.ruolo ? ruoli[r.ruolo] : '' }
    });

  for (const c of defArchivio?.certificati || [])
    aggiungi('certificato', c.id, c.etichetta, [c.gruppo, c.aiuto].join(' '), { sottotitolo: `Archivio · ${c.gruppo}`, norme: normeCitate(c.aiuto, norme), dati: c });
  for (const c of defArchivio?.planimetrie || []) aggiungi('planimetria', c.id, c.etichetta, c.gruppo, { sottotitolo: 'Archivio · Planimetrie', dati: c });

  for (const n of norme) aggiungi('norma', n.id, `${n.sigla} – ${n.titolo}`, [n.ambito, ...(n.alias || [])].join(' '), { sottotitolo: n.ambito, norme: [n.id], dati: n });

  for (const g of k.glossario || []) aggiungi('sigla', idSigla(g.sigla), g.sigla, g.testo, { sottotitolo: 'Significato', dati: g });

  for (const v of voci) {
    v._titolo = unici(paroleUtili(v.titolo));
    v._testo = unici(paroleUtili(`${v.sottotitolo} ${v.testo}`));
  }
  return { voci, mappa: new Map(voci.map((v) => [v.chiave, v])), sinonimi: k.sinonimi || [], norme, conoscenza: k };
}

export const voce = (indice, tipo, id) => indice?.mappa?.get(`${tipo}:${id}`) || null;

// ---------- ricerca ----------

/** Peso di un termine su una lista di parole: parola intera, poi radice, poi inizio parola (mentre si scrive). */
function corrispondenza(termine, lista) {
  if (!termine) return 0;
  const rad = radice(termine);
  let meglio = 0;
  for (const p of lista) {
    if (p === termine) return 1;
    if ((rad.length >= 5 && p.startsWith(rad)) || (rad.length >= 3 && radice(p) === rad)) meglio = Math.max(meglio, 0.8);
    else if (termine.length >= 3 && p.startsWith(termine)) meglio = Math.max(meglio, 0.6);
  }
  return meglio;
}

/** Interpreta la domanda: parole utili e gruppi di sinonimi riconosciuti. */
export function interpreta(domanda, sinonimi) {
  const t = normalizza(domanda);
  const termini = unici(paroleUtili(t));
  const espansioni = [];
  for (const s of sinonimi || []) {
    const trovata = [...s.parole, s.cerca].find((p) => contiene(t, normalizza(p)));
    if (trovata) espansioni.push({ da: normalizza(trovata), termini: paroleUtili(s.cerca) });
  }
  return { testo: t, termini, espansioni };
}

/**
 * Cerca nell'indice. Ogni parola pesa di più se è rara (le parole che compaiono quasi ovunque,
 * come «sicurezza», contano poco). Ogni parola della domanda deve trovare qualcosa, direttamente
 * o con un sinonimo; se nessuna voce le soddisfa tutte, si mostrano quelle che ne soddisfano di più.
 */
export function cerca(indice, domanda, { limite = 40 } = {}) {
  const q = interpreta(domanda, indice?.sinonimi);
  if (!q.termini.length) return { domanda: q, risultati: [] };
  const N = indice.voci.length;
  const cache = new Map();
  // per ogni termine: corrispondenza nel titolo e nel testo di ogni voce, e rarità (idf)
  const analizza = (termine) => {
    if (cache.has(termine)) return cache.get(termine);
    const t = indice.voci.map((v) => [corrispondenza(termine, v._titolo), corrispondenza(termine, v._testo)]);
    const df = t.filter(([a, b]) => a || b).length;
    const r = { t, idf: df ? Math.log(1 + N / df) : 0, comune: df > N * 0.2 };
    cache.set(termine, r);
    return r;
  };
  const gruppi = q.termini.map((termine) => {
    const diretto = analizza(termine);
    const esp = q.espansioni.filter((e) => ` ${e.da} `.includes(` ${termine} `)).flatMap((e) => e.termini).filter((x) => x !== termine).map(analizza).filter((x) => !x.comune);
    return { diretto, esp };
  });
  const valutate = [];
  indice.voci.forEach((v, i) => {
    let punti = 0;
    let trovati = 0;
    for (const { diretto, esp } of gruppi) {
      const [ti, te] = diretto.t[i];
      let p = (3 * ti || te) * diretto.idf;
      let s = 0;
      for (const x of esp) s += (2 * x.t[i][0] || 0.8 * x.t[i][1]) * x.idf;
      p = Math.max(p, s / Math.sqrt(esp.length || 1));
      if (p > 0 && (!diretto.comune || esp.length === 0 || ti)) trovati++;
      punti += p;
    }
    if (!trovati) return;
    if (v.tipo === 'sigla' || v.tipo === 'norma') punti *= 0.7; // le spiegazioni brevi non devono superare le schede
    if (v.tipo === 'sigla' && normalizza(v.titolo).split(' ').some((x) => q.termini.includes(x))) punti += 8;
    if (v.tipo === 'norma' && contiene(normalizza(`${v.dati.sigla} ${(v.dati.alias || []).join(' ')}`), q.testo)) punti += 12;
    valutate.push({ voce: v, punti, trovati });
  });
  const tutti = valutate.filter((x) => x.trovati === q.termini.length);
  const scelte = tutti.length ? tutti : valutate.filter((x) => x.trovati === Math.max(0, ...valutate.map((y) => y.trovati)));
  scelte.sort((a, b) => b.punti - a.punti || a.voce.titolo.localeCompare(b.voce.titolo, 'it'));
  // si tengono i risultati che valgono almeno un quinto del migliore
  const soglia = (scelte[0]?.punti || 0) / 5;
  return { domanda: q, parziale: !tutti.length && scelte.length > 0, risultati: scelte.filter((x) => x.punti >= soglia).slice(0, limite).map((x) => ({ ...x.voce, punti: Math.round(x.punti * 10) / 10 })) };
}

/** Raggruppa i risultati per tipo, nell'ordine di TIPI_VOCE. */
export function raggruppa(risultati) {
  const gruppi = new Map(Object.keys(TIPI_VOCE).map((t) => [t, []]));
  for (const r of risultati) gruppi.get(r.tipo)?.push(r);
  return [...gruppi].filter(([, l]) => l.length).map(([tipo, voci]) => ({ tipo, titolo: TIPI_VOCE[tipo], voci }));
}

// ---------- collegamenti ----------

/** Voci collegate a una voce: rischi, adempimenti, documenti, attrezzature, fasi, corsi, norme. */
export function collegati(indice, v) {
  if (!indice || !v) return [];
  const rischi = new Set(v.rischi);
  const adempimenti = new Set(v.adempimenti);
  const norme = new Set(v.norme);
  const out = [];
  for (const x of indice.voci) {
    if (x === v || x.tipo === 'sigla' || x.tipo === 'planimetria') continue;
    let peso = 0;
    if (x.tipo === 'norma') peso = norme.has(x.id) ? 1 : 0;
    else {
      if (x.rischi.some((r) => rischi.has(r))) peso += 2;
      if (x.adempimenti.some((a) => adempimenti.has(a))) peso += 2;
      if (v.tipo === 'norma' && x.norme.includes(v.id)) peso += 2;
    }
    if (peso) out.push({ ...x, peso });
  }
  // Una norma generale come il D.Lgs. 81/2008 è collegata a quasi tutto: si mostrano prima le specifiche.
  return out.sort((a, b) => b.peso - a.peso || (TIPI_ORD[a.tipo] ?? 9) - (TIPI_ORD[b.tipo] ?? 9) || a.titolo.localeCompare(b.titolo, 'it'));
}
const TIPI_ORD = Object.fromEntries(Object.keys(TIPI_VOCE).map((t, i) => [t, i]));

/** Sigle del glossario che compaiono in un testo (per spiegarle accanto al documento). */
export function sigleNelTesto(testo, glossario) {
  const t = ` ${String(testo || '')} `;
  return (glossario || []).filter((g) => {
    const s = g.sigla.split(' / ')[0];
    return /^[A-Z0-9(),.\- ]+$/.test(s) ? new RegExp(`[^A-Za-z]${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^A-Za-z]`).test(t) : false;
  });
}

// ---------- verifiche di coerenza ----------

const LIVELLI = { alto: 0, medio: 1, basso: 2 };

/**
 * Controlla che i dati inseriti siano coerenti tra loro e con le norme.
 * dati: { ctx, anagrafica, prodotti, attrezzature, lavoratori, controlli, archivio, eventi,
 *         adempimenti, defAttr, opzioniDocumenti, contaAllegati(tipo, id, categoria?), oggi }
 * Restituisce [{ id, livello, titolo, spiegazione, norma, azione: {testo, href}, documenti: [] }].
 */
export function verifiche(dati) {
  const { ctx, anagrafica: a = {}, defAttr, oggi, opzioniDocumenti: od = {} } = dati || {};
  if (!ctx) return [];
  const r = ctx.risposte || {};
  const f = ctx.fatti || {};
  const conta = dati.contaAllegati || (() => 0);
  const out = [];
  const aggiungi = (x) => out.push(x);

  const prodotti = (dati.prodotti || []).filter((p) => !p.deleted && !p.dismesso);
  const attrezzature = (dati.attrezzature || []).filter((x) => !x.deleted && !x.dismessa && !x.dismesso);
  const lavoratori = lavoratoriAttivi(dati.lavoratori, oggi);
  const conRuolo = (ruolo) => lavoratori.filter((l) => (l.ruoli || []).includes(ruolo));
  const tipo = (id) => (defAttr?.tipi || []).find((t) => t.id === id);
  const nomi = (lista, max = 3) => {
    const n = lista.map((x) => `«${x.nome || x.titolo || 'senza nome'}»`);
    return n.length > max ? `${n.slice(0, max).join(', ')} e altre ${n.length - max}` : n.join(', ');
  };

  // --- prodotti chimici ---
  const cmr = prodotti.filter((p) => frasiCmr(p.frasiH).length);
  if (cmr.length && r.polveri_cancerogene !== true)
    aggiungi({
      id: 'cmr-non-valutati',
      livello: 'alto',
      titolo: 'Prodotti cancerogeni o mutageni non considerati nel DVR',
      spiegazione: `${nomi(cmr)} ha frasi H340, H350 o H360, ma nel questionario non risultano agenti cancerogeni: il DVR non contiene il rischio cancerogeno e mutageno. Con questi prodotti si applica il Capo II del Titolo IX: sostituzione se possibile, sistemi chiusi, registro degli esposti, sorveglianza sanitaria.`,
      norma: 'D.Lgs. 81/2008 artt. 235-243',
      azione: { testo: 'Valuta la sostituzione e aggiorna la risposta', href: '#/domanda/polveri_cancerogene' },
      documenti: ['dvr-bozza', 'valutazione-chimico', 'elenco-prodotti-chimici', 'pos-bozza']
    });
  if (prodotti.length && r.chimici !== true)
    aggiungi({
      id: 'prodotti-senza-rischio-chimico',
      livello: 'medio',
      titolo: 'Hai registrato prodotti chimici ma il rischio chimico non è attivo',
      spiegazione: `Ci sono ${prodotti.length} prodotti nell'elenco, ma alla domanda sui prodotti chimici hai risposto di no. Il DVR non contiene la valutazione del rischio chimico.`,
      norma: 'D.Lgs. 81/2008 art. 223',
      azione: { testo: 'Correggi la risposta', href: '#/domanda/chimici' },
      documenti: ['dvr-bozza', 'valutazione-chimico', 'elenco-prodotti-chimici']
    });
  if (r.chimici === true && !prodotti.length)
    aggiungi({
      id: 'chimico-senza-prodotti',
      livello: 'medio',
      titolo: 'Usi prodotti chimici ma l\'elenco è vuoto',
      spiegazione: 'La valutazione del rischio chimico e l\'elenco delle schede di sicurezza si basano sui prodotti registrati. Aggiungi almeno quelli che usi di più, con la scheda di sicurezza.',
      norma: 'D.Lgs. 81/2008 art. 223; Reg. CE 1907/2006 art. 31',
      azione: { testo: 'Aggiungi i prodotti', href: '#/prodotti' },
      documenti: ['dvr-bozza', 'valutazione-chimico', 'elenco-prodotti-chimici', 'pos-bozza']
    });
  const senzaSds = prodotti.filter((p) => !p.dataSds && !conta('prodotto', p.id));
  if (senzaSds.length)
    aggiungi({
      id: 'sds-mancanti',
      livello: 'medio',
      titolo: `${senzaSds.length === 1 ? 'Un prodotto' : `${senzaSds.length} prodotti`} senza scheda di sicurezza`,
      spiegazione: `Manca la scheda di sicurezza di ${nomi(senzaSds)}. Il fornitore deve darla gratuitamente; senza scheda non si possono indicare pericoli e DPI.`,
      norma: 'Reg. CE 1907/2006 art. 31',
      azione: { testo: 'Carica le schede', href: '#/prodotti' },
      documenti: ['valutazione-chimico', 'elenco-prodotti-chimici', 'dvr-bozza']
    });

  // --- attrezzature ---
  const conPatentino = attrezzature.filter((x) => tipo(x.tipo)?.patentino);
  if (conPatentino.length && r.attrezzature_abilitazione !== true)
    aggiungi({
      id: 'abilitazione-risposta',
      livello: 'alto',
      titolo: 'Attrezzature che richiedono il patentino non considerate nel DVR',
      spiegazione: `Hai registrato ${nomi(conPatentino)}, ma nel questionario risulta che non usi piattaforme, gru o carrelli elevatori: il DVR e il POS non contengono il rischio e la formazione richiesta.`,
      norma: 'D.Lgs. 81/2008 art. 73 c. 5; Accordo Stato-Regioni 59/2025',
      azione: { testo: 'Correggi la risposta', href: '#/domanda/attrezzature_abilitazione' },
      documenti: ['dvr-bozza', 'pos-bozza']
    });
  if ((conPatentino.length || r.attrezzature_abilitazione === true) && f.haDipendenti && !conRuolo('macchine').length)
    aggiungi({
      id: 'abilitazione-operatori',
      livello: 'alto',
      titolo: 'Nessun lavoratore abilitato alle attrezzature con patentino',
      spiegazione: 'Piattaforme elevabili, gru, carrelli elevatori, sollevatori telescopici e macchine movimento terra possono essere usati solo da lavoratori con l\'abilitazione specifica. Indica nella scheda del lavoratore il ruolo «macchine» e registra l\'attestato.',
      norma: 'D.Lgs. 81/2008 art. 73 c. 5',
      azione: { testo: 'Assegna il ruolo ai lavoratori', href: '#/lavoratori' },
      documenti: ['dvr-bozza', 'pos-bozza', 'verbale-addestramento', 'registro-formazione']
    });
  const inQuota = attrezzature.filter((x) => ['ponteggio', 'trabattello', 'ple', 'ponte_sospeso'].includes(x.tipo));
  if (inQuota.length && r.quota !== true)
    aggiungi({
      id: 'quota-risposta',
      livello: 'alto',
      titolo: 'Attrezzature per lavori in quota ma rischio di caduta dall\'alto non attivo',
      spiegazione: `Hai registrato ${nomi(inQuota)}, ma nel questionario risulta che non lavori sopra i 2 metri: il DVR non contiene il rischio di caduta dall'alto.`,
      norma: 'D.Lgs. 81/2008 artt. 107 e 111',
      azione: { testo: 'Correggi la risposta', href: '#/domanda/quota' },
      documenti: ['dvr-bozza', 'pos-bozza']
    });
  if ((r.quota === true || inQuota.length) && f.haDipendenti && !conRuolo('quota').length)
    aggiungi({
      id: 'quota-addestrati',
      livello: 'alto',
      titolo: 'Nessun lavoratore addestrato ai lavori in quota',
      spiegazione: 'Chi lavora in quota con imbracature e sistemi anticaduta (DPI di terza categoria) deve avere formazione e addestramento specifici. Indica nella scheda del lavoratore il ruolo «quota» e registra il corso.',
      norma: 'D.Lgs. 81/2008 artt. 77 c. 5 e 116',
      azione: { testo: 'Assegna il ruolo ai lavoratori', href: '#/lavoratori' },
      documenti: ['dvr-bozza', 'pos-bozza', 'verbale-addestramento', 'consegna-dpi']
    });
  const ponteggi = attrezzature.filter((x) => x.tipo === 'ponteggio' && !(dati.controlli || []).some((c) => !c.deleted && c.attrezzaturaId === x.id && c.controlloId === 'controllo') && !conta('attrezzatura', x.id, 'verifica'));
  if (ponteggi.length)
    aggiungi({
      id: 'pimus',
      livello: 'alto',
      titolo: 'Ponteggio senza PiMUS o controllo registrato',
      spiegazione: `Per ${nomi(ponteggi)} non risulta il controllo degli elementi né il PiMUS. Il ponteggio va montato da persone formate, secondo il PiMUS e il libretto con l'autorizzazione ministeriale.`,
      norma: 'D.Lgs. 81/2008 artt. 134 e 136, Allegato XXII',
      azione: { testo: 'Registra il controllo', href: `#/attrezzatura/${ponteggi[0].id}` },
      documenti: ['pos-bozza', 'dvr-bozza']
    });
  const senzaLibretto = attrezzature.filter((x) => !conta('attrezzatura', x.id, 'libretto') && !['utensile', 'scala', 'altro'].includes(x.tipo));
  if (senzaLibretto.length)
    aggiungi({
      id: 'libretti-mancanti',
      livello: 'medio',
      titolo: `${senzaLibretto.length === 1 ? 'Una macchina' : `${senzaLibretto.length} macchine`} senza libretto d'uso caricato`,
      spiegazione: `Manca il libretto di ${nomi(senzaLibretto)}. Il libretto contiene i pericoli, le istruzioni e la manutenzione: va tenuto a disposizione e serve per l'addestramento. Se lo carichi, finisce in allegato al DVR e al POS.`,
      norma: 'D.Lgs. 81/2008 artt. 70 e 71 c. 4',
      azione: { testo: 'Carica i libretti', href: `#/attrezzatura/${senzaLibretto[0].id}` },
      documenti: ['dvr-bozza', 'pos-bozza', 'verbale-addestramento', 'duvri-bozza']
    });
  const nonConfermati = attrezzature.filter((x) => !Array.isArray(x.pericoli));
  if (nonConfermati.length)
    aggiungi({
      id: 'pericoli-non-confermati',
      livello: 'basso',
      titolo: 'Pericoli delle macchine da confermare',
      spiegazione: `Per ${nomi(nonConfermati)} usiamo i pericoli tipici del tipo di attrezzatura. Controllali con il capitolo sulla sicurezza del libretto: finiscono nel DVR, nel POS e nei verbali di addestramento.`,
      norma: 'D.Lgs. 81/2008 art. 71',
      azione: { testo: 'Conferma i pericoli', href: `#/attrezzatura/${nonConfermati[0].id}` },
      documenti: ['dvr-bozza', 'pos-bozza', 'verbale-addestramento']
    });

  // --- lavoratori e figure ---
  const senzaMansione = lavoratori.filter((l) => !String(l.mansione || '').trim());
  if (senzaMansione.length)
    aggiungi({
      id: 'mansioni-mancanti',
      livello: 'medio',
      titolo: `${senzaMansione.length === 1 ? 'Un lavoratore' : `${senzaMansione.length} lavoratori`} senza mansione`,
      spiegazione: 'La mansione serve per collegare il lavoratore ai rischi nel DVR, alla formazione specifica, alle visite mediche e ai DPI.',
      norma: 'D.Lgs. 81/2008 art. 28 c. 2 lett. f',
      azione: { testo: 'Indica la mansione', href: `#/lavoratore-modifica/${senzaMansione[0].id}` },
      documenti: ['dvr-bozza', 'registro-formazione', 'consegna-dpi', 'informazione-art36', 'richiesta-visite', 'pos-bozza', 'valutazione-rumore', 'valutazione-vibrazioni', 'valutazione-mmc', 'valutazione-chimico']
    });
  if (f.haDipendenti && lavoratori.length && !conRuolo('primo_soccorso').length)
    aggiungi({
      id: 'addetti-primo-soccorso',
      livello: 'alto',
      titolo: 'Nessun addetto al primo soccorso designato',
      spiegazione: 'Il datore di lavoro designa gli addetti al primo soccorso, che devono fare il corso del DM 388/2003. Il datore di lavoro può svolgere direttamente il compito, anche lui con il corso.',
      norma: 'D.Lgs. 81/2008 artt. 18 c. 1 lett. b e 45; DM 388/2003',
      azione: { testo: 'Designa gli addetti', href: '#/lavoratori' },
      documenti: ['dvr-bozza', 'piano-emergenza-doc', 'designazione-addetti', 'pos-bozza', 'informazione-art36']
    });
  if (f.haDipendenti && lavoratori.length && !conRuolo('antincendio').length)
    aggiungi({
      id: 'addetti-antincendio',
      livello: 'alto',
      titolo: 'Nessun addetto antincendio designato',
      spiegazione: 'Servono addetti alla lotta antincendio e all\'evacuazione, formati secondo il livello di rischio (DM 2/9/2021). Il datore di lavoro può svolgere direttamente il compito.',
      norma: 'D.Lgs. 81/2008 artt. 18 c. 1 lett. b, 43 e 46; DM 2/09/2021',
      azione: { testo: 'Designa gli addetti', href: '#/lavoratori' },
      documenti: ['dvr-bozza', 'piano-emergenza-doc', 'designazione-addetti', 'valutazione-incendio', 'verbale-evacuazione', 'pos-bozza', 'informazione-art36']
    });
  if (f.haDipendenti && r.dl_rspp === false && !String(a.rspp || '').trim())
    aggiungi({
      id: 'rspp-mancante',
      livello: 'alto',
      titolo: 'RSPP non indicato',
      spiegazione: 'Hai risposto che non fai tu da RSPP, ma nei dati dell\'impresa non c\'è il nome del responsabile. La designazione dell\'RSPP non è delegabile.',
      norma: 'D.Lgs. 81/2008 artt. 17 c. 1 lett. b e 31',
      azione: { testo: 'Inserisci l\'RSPP', href: '#/dati' },
      documenti: ['dvr-bozza', 'nomina-rspp-esterno', 'informazione-art36', 'verbale-riunione']
    });
  if (f.haDipendenti && f.rischiConSorveglianza && !String(a.medico || '').trim())
    aggiungi({
      id: 'medico-mancante',
      livello: 'alto',
      titolo: 'Medico competente non indicato',
      spiegazione: 'Dalle risposte risultano rischi che richiedono la sorveglianza sanitaria, ma nei dati dell\'impresa manca il medico competente.',
      norma: 'D.Lgs. 81/2008 artt. 18 c. 1 lett. a e 41',
      azione: { testo: 'Inserisci il medico', href: '#/dati' },
      documenti: ['dvr-bozza', 'nomina-medico', 'richiesta-visite', 'informazione-art36']
    });
  if (f.haDipendenti && !String(a.rls || '').trim() && !conRuolo('rls').length)
    aggiungi({
      id: 'rls-mancante',
      livello: 'basso',
      titolo: 'RLS non indicato',
      spiegazione: 'Se i lavoratori non hanno eletto un RLS, l\'impresa fa riferimento all\'RLS territoriale (RLST). Indicalo nei dati: va consultato sul DVR.',
      norma: 'D.Lgs. 81/2008 artt. 47 e 48',
      azione: { testo: 'Inserisci l\'RLS o l\'RLST', href: '#/dati' },
      documenti: ['dvr-bozza', 'verbale-elezione-rls', 'verbale-riunione', 'dichiarazione-dl-rspp']
    });

  // --- archivio ---
  const attuali = archivioAttuale(dati.archivio);
  if (r.sede === true && f.haDipendenti && !attuali.some((x) => x.genere === 'planimetria' && x.tipo === 'emergenza'))
    aggiungi({
      id: 'planimetria-emergenza',
      livello: 'medio',
      titolo: 'Manca la planimetria di emergenza',
      spiegazione: 'La planimetria con vie di esodo, uscite, estintori, pulsanti e punto di raccolta va allegata al piano di emergenza ed esposta nei locali.',
      norma: 'DM 2/09/2021 Allegato II',
      azione: { testo: 'Carica la planimetria', href: '#/archivio-voce/nuovo/planimetria' },
      documenti: ['piano-emergenza-doc', 'valutazione-incendio', 'dvr-bozza', 'verbale-evacuazione', 'duvri-bozza', 'info-rischi-ditte']
    });
  const scaduti = attuali.filter((x) => x.scadenza && oggi && x.scadenza < oggi);
  if (scaduti.length)
    aggiungi({
      id: 'certificati-scaduti',
      livello: 'alto',
      titolo: `${scaduti.length === 1 ? 'Un documento scaduto' : `${scaduti.length} documenti scaduti`} in archivio`,
      spiegazione: `${nomi(scaduti)}: carica la versione rinnovata (quella vecchia resta nello storico).`,
      norma: '',
      azione: { testo: 'Apri l\'archivio', href: '#/archivio' },
      documenti: ['stato-sicurezza', 'dvr-bozza', 'duvri-bozza', 'autocertificazione-idoneita', 'pos-bozza']
    });

  // --- infortuni e DVR ---
  const dvr = statoCorrente('dvr', dati.adempimenti);
  const dopo = (dati.eventi || []).filter((e) => !e.deleted && e.tipo === 'infortunio' && dvr?.fatto && dvr.dataFatto && e.data > dvr.dataFatto);
  if (dopo.length)
    aggiungi({
      id: 'dvr-dopo-infortunio',
      livello: dopo.some((e) => Number(e.giorniPrognosi) > 3) ? 'alto' : 'medio',
      titolo: 'Infortunio dopo l\'ultima revisione del DVR',
      spiegazione: `Dopo il DVR del ${dvr.dataFatto.split('-').reverse().join('/')} ${dopo.length === 1 ? 'c\'è stato un infortunio' : `ci sono stati ${dopo.length} infortuni`}. Dopo un infortunio significativo il DVR va rielaborato entro 30 giorni, con le misure per evitare che si ripeta.`,
      norma: 'D.Lgs. 81/2008 art. 29 c. 3',
      azione: { testo: 'Apri il DVR', href: '#/documento/dvr-bozza' },
      documenti: ['dvr-bozza', 'registro-eventi', 'verbale-riunione']
    });

  // --- POS ---
  if (r.cantiere === true) {
    const fasi = od['pos-bozza']?.fasi;
    if (!Array.isArray(fasi) || !fasi.length)
      aggiungi({
        id: 'pos-senza-fasi',
        livello: 'medio',
        titolo: 'Nel POS non hai scelto le lavorazioni',
        spiegazione: 'Il POS deve descrivere le attività che svolgerai in quel cantiere, con rischi, misure, attrezzature e DPI di ciascuna (Allegato XV punto 3.2).',
        norma: 'D.Lgs. 81/2008 art. 89 c. 1 lett. h, Allegato XV',
        azione: { testo: 'Scegli le lavorazioni', href: '#/documento/pos-bozza' },
        documenti: ['pos-bozza']
      });
    else if (fasi.includes('demolizioni') && r.amianto !== true)
      aggiungi({
        id: 'demolizioni-amianto',
        livello: 'medio',
        titolo: 'Demolizioni senza verifica dell\'amianto',
        spiegazione: 'Prima di demolizioni o rimozioni il committente deve far verificare la presenza di amianto (art. 248). Se è presente, servono il piano di lavoro all\'ASL e una ditta iscritta all\'Albo.',
        norma: 'D.Lgs. 81/2008 artt. 248 e 256',
        azione: { testo: 'Rispondi alla domanda sull\'amianto', href: '#/domanda/amianto' },
        documenti: ['pos-bozza', 'dvr-bozza']
      });
  }

  // --- valutazioni specifiche richiamate dal DVR ---
  const compilata = (doc, campo) => {
    const righe = od[doc]?.[campo];
    return Array.isArray(righe) && righe.some((x) => Object.values(x || {}).filter((v) => String(v ?? '').trim()).length >= 2);
  };
  const specifiche = [
    { se: r.rumore_vibrazioni === true, doc: 'valutazione-rumore', campo: 'righe', titolo: 'Valutazione del rumore da compilare', rischio: 'il rumore', norma: 'D.Lgs. 81/2008 art. 190' },
    { se: r.rumore_vibrazioni === true, doc: 'valutazione-vibrazioni', campo: 'righe', titolo: 'Valutazione delle vibrazioni da compilare', rischio: 'le vibrazioni', norma: 'D.Lgs. 81/2008 art. 202' },
    { se: r.carichi === true, doc: 'valutazione-mmc', campo: 'compiti', titolo: 'Valutazione della movimentazione dei carichi da compilare', rischio: 'la movimentazione manuale dei carichi', norma: 'D.Lgs. 81/2008 art. 168 e Allegato XXXIII' },
    { se: r.chimici === true, doc: 'valutazione-chimico', campo: 'righe', titolo: 'Valutazione del rischio chimico da compilare', rischio: 'il rischio chimico', norma: 'D.Lgs. 81/2008 art. 223' }
  ];
  for (const s of specifiche)
    if (s.se && f.haDipendenti && !compilata(s.doc, s.campo))
      aggiungi({
        id: `valutazione-${s.doc}`,
        livello: 'medio',
        titolo: s.titolo,
        spiegazione: `Dalle tue risposte è presente ${s.rischio}: il DVR lo richiama, ma la valutazione specifica non è ancora compilata.`,
        norma: s.norma,
        azione: { testo: 'Compila la valutazione', href: `#/documento/${s.doc}` },
        documenti: ['dvr-bozza', s.doc]
      });
  if (r.sede === true && f.haDipendenti && !od['valutazione-incendio'])
    aggiungi({
      id: 'valutazione-incendio',
      livello: 'medio',
      titolo: 'Valutazione del rischio incendio da compilare',
      spiegazione: 'Ogni luogo di lavoro deve avere la valutazione del rischio incendio: per le attività a basso rischio basta il metodo semplificato del DM 3/9/2021. Il risultato decide il livello del corso degli addetti.',
      norma: 'D.Lgs. 81/2008 art. 46; DM 3/09/2021',
      azione: { testo: 'Compila la valutazione', href: '#/documento/valutazione-incendio' },
      documenti: ['dvr-bozza', 'valutazione-incendio', 'piano-emergenza-doc', 'designazione-addetti']
    });

  return out.sort((x, y) => LIVELLI[x.livello] - LIVELLI[y.livello]);
}

/** Verifiche che riguardano un documento. */
export const verifichePer = (lista, modelloId) => (lista || []).filter((x) => x.documenti.includes(modelloId));

/**
 * Aiuto per un documento: consigli di compilazione, adempimenti, rischi e norme collegati,
 * verifiche che lo riguardano e sigle usate nella descrizione.
 */
export function perDocumento(indice, modelloId, listaVerifiche = []) {
  const v = voce(indice, 'documento', modelloId);
  if (!v) return null;
  const pesca = (tipo, ids) => ids.map((id) => voce(indice, tipo, id)).filter(Boolean);
  return {
    voce: v,
    consigli: v.dati.consigli || [],
    adempimenti: pesca('adempimento', v.adempimenti),
    rischi: pesca('rischio', v.rischi),
    norme: pesca('norma', v.norme),
    verifiche: verifichePer(listaVerifiche, modelloId),
    sigle: sigleNelTesto(`${v.titolo} ${v.dati.descrizione} ${(v.dati.consigli || []).join(' ')}`, indice.conoscenza.glossario)
  };
}

/** Rischi del DVR presenti per l'impresa, con le misure di miglioramento suggerite. */
export function rischiPresenti(dvr, ctx) {
  return (dvr?.pericoli || []).filter((x) => ctx && valuta(x.presenteSe, ctx));
}
