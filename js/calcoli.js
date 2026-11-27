// Calcoli per le valutazioni specifiche dei rischi. Modulo puro: testabile con Node.
// Sono valutazioni semplificate: i risultati vanno confermati dall'RSPP.

const num = (x) => {
  const t = String(x ?? '').trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const arrotonda = (x, cifre = 1) => (x === null ? null : Math.round(x * 10 ** cifre) / 10 ** cifre);

// ---------- rumore (Titolo VIII Capo II) ----------

export const SOGLIE_RUMORE = { inferiore: 80, superiore: 85, limite: 87 };

/** Esposizione giornaliera LEX,8h da attività con livello LAeq (dB(A)) e durata (ore). */
export function lex8h(righe) {
  const valide = (righe || []).map((r) => ({ L: num(r.livello), T: num(r.ore) })).filter((r) => r.L !== null && r.T !== null && r.T > 0);
  if (!valide.length) return null;
  const somma = valide.reduce((s, r) => s + (r.T / 8) * 10 ** (r.L / 10), 0);
  return arrotonda(10 * Math.log10(somma));
}

/** Ore al giorno a un livello L dopo le quali si raggiunge la soglia (null se non si raggiunge in 8 ore). */
export function oreMassimeRumore(L, soglia = SOGLIE_RUMORE.superiore) {
  const l = num(L);
  if (l === null) return null;
  const T = 8 * 10 ** ((soglia - l) / 10);
  return T >= 8 ? null : arrotonda(T, 1);
}

/** Quota percentuale di ogni attività sull'energia sonora della giornata (per capire dove intervenire). */
export function contributiRumore(righe) {
  const e = (righe || []).map((r) => {
    const L = num(r.livello);
    const T = num(r.ore);
    return L !== null && T !== null && T > 0 ? T * 10 ** (L / 10) : null;
  });
  const tot = e.reduce((a, b) => a + (b ?? 0), 0);
  return e.map((x) => (tot > 0 && x !== null ? Math.round((x / tot) * 100) : null));
}

/** Livello di picco più alto inserito, in dB(C). */
export function piccoMassimo(righe) {
  const p = (righe || []).map((r) => num(r.picco)).filter((x) => x !== null);
  return p.length ? Math.max(...p) : null;
}

export const SOGLIE_PICCO = { inferiore: 135, superiore: 137, limite: 140 };

export function fasciaPicco(p) {
  if (p === null || p === undefined) return null;
  if (p > SOGLIE_PICCO.limite) return { colore: 'rosso', testo: 'Picco oltre il valore limite di 140 dB(C) (si verifica con i DPI)' };
  if (p > SOGLIE_PICCO.superiore) return { colore: 'rosso', testo: 'Picco oltre 137 dB(C): stessi obblighi del valore superiore d\'azione' };
  if (p > SOGLIE_PICCO.inferiore) return { colore: 'giallo', testo: 'Picco oltre 135 dB(C): stessi obblighi del valore inferiore d\'azione' };
  return { colore: 'verde', testo: 'Picco fino a 135 dB(C)' };
}

/**
 * Fattori di correzione β dell'SNR per l'uso reale dei DPI uditivi (UNI 9432:2011).
 * Si possono aumentare solo con formazione intensiva e controllo dell'uso corretto.
 */
export const BETA_DPI = {
  cuffie: { beta: 0.75, etichetta: 'Cuffie' },
  inserti_espandibili: { beta: 0.5, etichetta: 'Inserti espandibili (spugnette)' },
  inserti_preformati: { beta: 0.3, etichetta: 'Inserti preformati' }
};

/** Livello effettivo all'orecchio con il DPI, metodo SNR: L'A = LCeq − β·SNR (LAeq se manca LCeq: stima). */
export function livelloConDpi(r, dpi) {
  const b = BETA_DPI[dpi?.tipo]?.beta;
  const snr = num(dpi?.snr);
  const L = num(r?.lceq) ?? num(r?.livello);
  if (!b || snr === null || L === null) return null;
  return arrotonda(L - b * snr);
}

/** Adeguatezza del DPI uditivo secondo il livello effettivo all'orecchio (UNI EN 458). */
export function adeguatezzaDpi(L) {
  if (L === null || L === undefined) return null;
  if (L > 80) return { colore: 'rosso', testo: 'Insufficiente: scegliere un DPI più protettivo' };
  if (L > 75) return { colore: 'giallo', testo: 'Accettabile' };
  if (L >= 70) return { colore: 'verde', testo: 'Buona' };
  if (L >= 65) return { colore: 'giallo', testo: 'Accettabile' };
  return { colore: 'giallo', testo: 'Troppo protettivo: rischio di non sentire allarmi e segnali' };
}

/** LEX,8h con i DPI indossati nelle attività oltre 80 dB(A): serve per il confronto con il valore limite di 87. */
export function lex8hConDpi(righe, dpi) {
  if (!BETA_DPI[dpi?.tipo] || num(dpi?.snr) === null) return null;
  const eff = (righe || []).map((r) => {
    const L = num(r.livello);
    if (L === null || L <= SOGLIE_RUMORE.inferiore) return r;
    return { ...r, livello: livelloConDpi(r, dpi) };
  });
  return lex8h(eff);
}

export function fasciaRumore(lex) {
  if (lex === null) return null;
  if (lex > SOGLIE_RUMORE.limite) return { colore: 'rosso', testo: 'Oltre il valore limite di 87 dB(A): ridurre subito l\'esposizione (il limite si verifica tenendo conto dei DPI uditivi)' };
  if (lex > SOGLIE_RUMORE.superiore) return { colore: 'rosso', testo: 'Oltre 85 dB(A): DPI uditivi obbligatori, programma di riduzione, segnaletica, visita medica obbligatoria' };
  if (lex > SOGLIE_RUMORE.inferiore) return { colore: 'giallo', testo: 'Tra 80 e 85 dB(A): mettere a disposizione i DPI uditivi, informazione e formazione, visita medica su richiesta' };
  return { colore: 'verde', testo: 'Fino a 80 dB(A): nessun obbligo specifico oltre alle misure generali' };
}

// ---------- vibrazioni (Titolo VIII Capo III) ----------

export const SOGLIE_VIBRAZIONI = { HAV: { azione: 2.5, limite: 5 }, WBV: { azione: 0.5, limite: 1 } };

/**
 * Accelerazione da usare nel calcolo: (valore + incertezza K) × fattore di correzione.
 * Per i valori del libretto il fattore tiene conto della differenza tra prova di laboratorio e uso reale.
 */
export function accelerazioneEfficace(r) {
  const a = num(r?.accelerazione);
  if (a === null) return null;
  const K = num(r.incertezza) ?? 0;
  const f = num(r.fattore) ?? 1;
  return arrotonda((a + K) * (f > 0 ? f : 1), 2);
}

/** Corpo intero dai tre assi del libretto: il più alto tra 1,4·awx, 1,4·awy e awz. */
export function wbvDaAssi(x, y, z) {
  const v = [num(x), num(y), num(z)];
  if (v.every((n) => n === null)) return null;
  return arrotonda(Math.max(1.4 * (v[0] ?? 0), 1.4 * (v[1] ?? 0), v[2] ?? 0), 2);
}

/** Ore al giorno di uso dopo le quali si supera il valore d'azione o limite (null se non si supera in 8 ore). */
export function oreMassimeVibrazioni(a, sistema, soglia = 'azione') {
  const s = SOGLIE_VIBRAZIONI[sistema]?.[soglia];
  if (!s || !a) return null;
  const T = 8 * (s / a) ** 2;
  return T >= 8 ? null : arrotonda(T, 1);
}

/** Esposizione giornaliera A(8) in m/s² per mano-braccio (HAV) o corpo intero (WBV). */
export function a8(righe, sistema) {
  const valide = (righe || [])
    .filter((r) => (r.sistema || 'HAV') === sistema)
    .map((r) => ({ a: accelerazioneEfficace(r), T: num(r.ore) }))
    .filter((r) => r.a !== null && r.T !== null && r.T > 0);
  if (!valide.length) return null;
  return arrotonda(Math.sqrt(valide.reduce((s, r) => s + (r.a * r.a * r.T) / 8, 0)), 2);
}

export function fasciaVibrazioni(valore, sistema) {
  if (valore === null) return null;
  const s = SOGLIE_VIBRAZIONI[sistema];
  const c = (x) => String(x).replace('.', ',');
  if (valore > s.limite) return { colore: 'rosso', testo: `Oltre il valore limite di ${c(s.limite)} m/s²: ridurre subito l'esposizione` };
  if (valore > s.azione) return { colore: 'giallo', testo: `Oltre il valore d'azione di ${c(s.azione)} m/s²: programma di riduzione, formazione, sorveglianza sanitaria` };
  return { colore: 'verde', testo: `Sotto il valore d'azione di ${c(s.azione)} m/s²` };
}

// ---------- movimentazione manuale dei carichi: metodo NIOSH (ISO 11228-1) ----------

/** Costante di peso in kg secondo l'Allegato XXXIII e la norma ISO 11228-1. */
export function costantePeso(genere, fascia) {
  const adulto = fascia !== 'giovane_anziano';
  if (genere === 'donna') return adulto ? 20 : 15;
  return adulto ? 25 : 20;
}

const FREQUENZE = [0.2, 1, 4, 6, 9, 12, 15];
const FATTORE_FREQUENZA = {
  breve: [1.0, 0.94, 0.84, 0.75, 0.52, 0.37, 0.0],
  media: [0.95, 0.88, 0.72, 0.5, 0.3, 0.21, 0.0],
  lunga: [0.85, 0.75, 0.45, 0.27, 0.15, 0.0, 0.0]
};

export function fattoreFrequenza(freq, durata) {
  const f = num(freq) ?? 0.2;
  const tab = FATTORE_FREQUENZA[durata] || FATTORE_FREQUENZA.lunga;
  if (f > 15) return 0;
  let i = FREQUENZE.findIndex((x) => f <= x);
  if (i < 0) i = FREQUENZE.length - 1;
  return tab[i];
}

/**
 * Peso limite raccomandato (RWL) e indice di sollevamento (IS).
 * altezza: altezza delle mani da terra all'inizio (cm); distanza: distanza orizzontale mani-caviglie (cm);
 * dislocazione: spostamento verticale (cm); angolo: asimmetria (gradi).
 */
export function niosh(p) {
  const peso = num(p.peso);
  const V = num(p.altezza);
  const H = num(p.distanza);
  const D = num(p.dislocazione);
  const A = num(p.angolo) ?? 0;
  if ([peso, V, H, D].some((x) => x === null)) return null;
  const CP = costantePeso(p.genere, p.fascia);
  const fattori = {
    altezza: V > 175 ? 0 : Math.max(0, 1 - 0.003 * Math.abs(V - 75)),
    distanza: H > 63 ? 0 : H <= 25 ? 1 : 25 / H,
    dislocazione: D > 175 ? 0 : D <= 25 ? 1 : 0.82 + 4.5 / D,
    angolo: A > 135 ? 0 : 1 - 0.0032 * A,
    frequenza: fattoreFrequenza(p.frequenza, p.durata),
    presa: { buona: 1, discreta: 0.95, scarsa: 0.9 }[p.presa] ?? 1,
    unaMano: p.unaMano ? 0.6 : 1,
    dueOperatori: p.dueOperatori ? 0.85 : 1
  };
  const rwl = Object.values(fattori).reduce((x, f) => x * f, CP);
  const is = rwl > 0 ? peso / rwl : Infinity;
  return { CP, fattori, rwl: arrotonda(rwl, 2), indice: Number.isFinite(is) ? arrotonda(is, 2) : null };
}

export function fasciaNiosh(indice) {
  if (indice === null || indice === undefined) return { colore: 'rosso', testo: 'Sollevamento da evitare: almeno un fattore è fuori dai limiti del metodo' };
  if (indice > 1) return { colore: 'rosso', testo: 'Indice oltre 1: rischio presente, intervenire per ridurlo (ausili, peso minore, posizione migliore); sorveglianza sanitaria e formazione' };
  if (indice > 0.85) return { colore: 'giallo', testo: 'Indice tra 0,85 e 1: livello di attenzione, migliorare le condizioni e formare i lavoratori' };
  return { colore: 'verde', testo: 'Indice fino a 0,85: rischio accettabile' };
}

const ORDINE_DURATA = { breve: 1, media: 2, lunga: 3 };

/**
 * Indice di sollevamento composito (NIOSH, Waters 1993; ISO 11228-1 allegato) per più sollevamenti
 * nello stesso turno: CLI = IS₁ + Σ FILIₖ · (1/FM(F₁+…+Fₖ) − 1/FM(F₁+…+Fₖ₋₁)).
 * La durata è la più lunga tra quelle indicate. Restituisce null con meno di due sollevamenti validi.
 */
export function nioshComposito(compiti, comuni = {}) {
  const durata = (compiti || []).reduce((d, c) => ((ORDINE_DURATA[c.durata] || 3) > (ORDINE_DURATA[d] || 0) ? c.durata || 'lunga' : d), 'breve');
  const valide = (compiti || [])
    .map((c) => ({ c, n: niosh({ ...c, ...comuni, durata }) }))
    .filter((x) => x.n)
    .map(({ c, n }) => {
      const peso = num(c.peso);
      const F = num(c.frequenza) ?? 0.2;
      const fm = n.fattori.frequenza;
      const firwl = fm > 0 ? n.rwl / fm : Object.entries(n.fattori).reduce((x, [k, f]) => (k === 'frequenza' ? x : x * f), n.CP);
      return { compito: c.compito, peso, F, stli: n.rwl > 0 ? peso / n.rwl : Infinity, fili: firwl > 0 ? peso / firwl : Infinity };
    });
  if (valide.length < 2) return null;
  valide.sort((a, b) => b.stli - a.stli);
  let cli = valide[0].stli;
  let Fcum = valide[0].F;
  for (const t of valide.slice(1)) {
    const prima = fattoreFrequenza(Fcum, durata);
    Fcum += t.F;
    const dopo = fattoreFrequenza(Fcum, durata);
    if (!dopo || !prima) return { ordine: valide.map((x) => x.compito), indice: null, durata, frequenzaTotale: arrotonda(Fcum, 2) };
    cli += t.fili * (1 / dopo - 1 / prima);
  }
  return { ordine: valide.map((x) => x.compito), indice: Number.isFinite(cli) ? arrotonda(cli, 2) : null, durata, frequenzaTotale: arrotonda(Fcum, 2) };
}

// ---------- rischio chimico: stima qualitativa ----------

/** Pericolosità per la salute dalle frasi H: alta, media, bassa. */
export function pericolositaSalute(frasiH) {
  const h = String(frasiH || '').toUpperCase();
  if (/H3[456]0/.test(h)) return 'cmr';
  if (/H3(00|01|10|11|30|31|70|72)|H314|H318|H334/.test(h)) return 'alta';
  if (/H3(02|12|32|35|36|17|71|73)|H304/.test(h)) return 'media';
  if (/H3\d\d/.test(h)) return 'bassa';
  return 'nessuna';
}

/**
 * Stima qualitativa dell'esposizione combinando quantità, frequenza, modalità d'uso e ventilazione.
 * Restituisce "bassa", "media" o "alta".
 */
export function esposizioneChimica({ quantita, frequenza, modalita, ventilazione }) {
  const q = { piccola: 1, media: 2, grande: 3 }[quantita] || 2;
  const f = { occasionale: 1, settimanale: 2, quotidiana: 3 }[frequenza] || 2;
  const m = { chiuso: 0, controllato: 1, aperto: 2, dispersivo: 3 }[modalita] ?? 2;
  const vent = { aspirazione: -1, generale: 0, nessuna: 1 }[ventilazione] ?? 0;
  const punti = q + f + m + vent;
  if (m === 0 || punti <= 4) return 'bassa';
  return punti <= 6 ? 'media' : 'alta';
}

export function esitoChimico(pericolosita, esposizione) {
  if (pericolosita === 'cmr') return { colore: 'rosso', testo: 'Cancerogeno, mutageno o tossico per la riproduzione: si applica il Capo II del Titolo IX, valutare la sostituzione' };
  if (pericolosita === 'nessuna') return { colore: 'verde', testo: 'Nessuna frase H per la salute: verificare comunque i pericoli fisici (infiammabilità)' };
  const tabella = {
    bassa: { bassa: 'verde', media: 'verde', alta: 'giallo' },
    media: { bassa: 'verde', media: 'giallo', alta: 'rosso' },
    alta: { bassa: 'giallo', media: 'rosso', alta: 'rosso' }
  };
  const colore = tabella[pericolosita][esposizione];
  return {
    colore,
    testo:
      colore === 'verde'
        ? 'Rischio presumibilmente irrilevante per la salute: bastano le misure generali (art. 224)'
        : colore === 'giallo'
          ? 'Rischio da approfondire: confermare con un modello di calcolo (es. MoVaRisCh) o misure'
          : 'Rischio non irrilevante: misure specifiche (art. 225), sorveglianza sanitaria, valutazione approfondita'
  };
}

// ---------- incendio: luogo di lavoro a basso rischio (DM 3/9/2021) ----------

/** Criteri del DM 3 settembre 2021 per i luoghi di lavoro a basso rischio di incendio. */
export function bassoRischioIncendio(o) {
  const criteri = [
    ['Attività non soggetta ai controlli dei Vigili del fuoco (DPR 151/2011) e senza regola tecnica verticale', o.soggetta !== 'si'],
    ['Affollamento complessivo non superiore a 100 persone', num(o.persone) !== null && num(o.persone) <= 100],
    ['Superficie lorda complessiva non superiore a 1000 m²', num(o.superficie) !== null && num(o.superficie) <= 1000],
    ['Piani tra −5 m e +24 m di quota', o.quote !== 'no'],
    ['Nessun deposito o lavorazione di materiali combustibili in quantità significative', o.combustibili !== 'si'],
    ['Nessuna sostanza o miscela pericolosa in quantità significative', o.sostanze !== 'si'],
    ['Nessuna lavorazione pericolosa ai fini dell\'incendio', o.lavorazioni !== 'si']
  ].map(([testo, ok]) => ({ testo, ok }));
  return { criteri, basso: criteri.every((c) => c.ok) };
}

// ---------- rischio chimico: algoritmo MoVaRisCh (Regioni Emilia-Romagna, Toscana, Lombardia, rev. 2016) ----------

/** Punteggi P delle frasi H ed EUH. Le categorie si indicano dopo il codice (es. «H314 1B», «H330 cat. 2»). */
export const PUNTI_H = {
  H332: 4.5, H312: 3, H302: 2, H331: 6, H311: 4.5, H301: 2.25,
  'H330/1': 8.5, 'H330/2': 7.5, 'H310/1': 6.5, 'H310/2': 5.5, 'H300/1': 3, 'H300/2': 2.5,
  EUH029: 3, EUH031: 3, EUH032: 3.5, EUH066: 2.5, EUH070: 6, EUH071: 6.5,
  'H314/1A': 6.25, 'H314/1B': 5.75, 'H314/1C': 5.5, H315: 2.5, H318: 4.5, H319: 3,
  'H334/1A': 9, 'H334/1B': 8, 'H317/1A': 6, 'H317/1B': 4.5, H335: 3.25, H336: 3.5,
  H370: 9.5, H371: 8, H372: 8, H373: 7, H304: 5,
  H341: 8, H351: 8, H361: 8, H361d: 7.5, H361f: 7.5, H361fd: 8, H362: 6,
  EUH201: 6, EUH201A: 6, EUH202: 4.5, EUH203: 4.5, EUH204: 7, EUH205: 4.5, EUH206: 3, EUH207: 8, EUH208: 5
};

/** Senza categoria si usa quella più severa, a favore della sicurezza. */
const CATEGORIA_PREDEFINITA = { H330: '1', H310: '1', H300: '1', H314: '1A', H334: '1A', H317: '1A' };

/**
 * Indice di pericolo P dalle frasi H della scheda di sicurezza (sezione 2): il punteggio più alto.
 * cmr: presenza di H340, H350 o H360 (cancerogeni, mutageni, tossici per la riproduzione di cat. 1):
 * per questi si applica il Capo II del Titolo IX e il modello non va usato.
 */
export function indicePericolo(frasiH) {
  const testo = String(frasiH || '');
  const re = /\b(EUH\d{3}A?|H\d{3}(?:i|[DdFf]{1,2})?)\b(?:\s*\(?\s*(?:cat(?:egoria)?\.?\s*)?(1A|1B|1C|1|2)\b)?/gi;
  const codici = [];
  let cmr = false;
  let P = null;
  for (const m of testo.matchAll(re)) {
    const raw = m[1].toUpperCase().startsWith('EUH') ? m[1].toUpperCase() : `H${m[1].slice(1, 4)}${m[1].slice(4)}`;
    const base = raw.slice(0, 4);
    if (/^H3(40|50|60)/.test(raw)) cmr = true;
    let chiave = raw;
    if (CATEGORIA_PREDEFINITA[base]) chiave = `${base}/${(m[2] || CATEGORIA_PREDEFINITA[base]).toUpperCase()}`;
    let punti = PUNTI_H[chiave] ?? PUNTI_H[chiave.replace(/\/1$/, '/1A')] ?? PUNTI_H[base];
    if (punti === undefined && /^H361/.test(raw)) punti = 8;
    if (punti === undefined) continue;
    codici.push({ codice: chiave.replace('/', ' cat. '), punti });
    if (P === null || punti > P) P = punti;
  }
  return { P: P ?? 1, codici, cmr, classificato: P !== null };
}

const MATRICE_D = {
  solido: [1, 1, 1, 2, 2],
  liquido_bassa: [1, 2, 3, 3, 4],
  liquido_alta: [1, 3, 3, 4, 4],
  gas: [2, 3, 4, 4, 4]
};
const QUANTITA_MV = ['meno_0_1', 'da_0_1_a_1', 'da_1_a_10', 'da_10_a_100', 'oltre_100'];
const USI_MV = ['chiuso', 'matrice', 'controllato', 'dispersivo'];
const MATRICE_U = { 1: [1, 1, 1, 2], 2: [1, 2, 2, 3], 3: [1, 2, 3, 3], 4: [2, 3, 3, 3] };
const CONTROLLI_MV = ['contenimento', 'aspirazione', 'segregazione', 'ventilazione', 'manipolazione'];
const MATRICE_C = { 1: [1, 1, 1, 2, 2], 2: [1, 2, 2, 3, 3], 3: [1, 2, 3, 3, 3] };
const TEMPI_MV = ['meno_15m', 'da_15m_a_2h', 'da_2h_a_4h', 'da_4h_a_6h', 'oltre_6h'];
const MATRICE_I = { 1: [1, 1, 3, 3, 7], 2: [1, 3, 7, 7, 10], 3: [3, 7, 10, 10, 10] };
const DISTANZE_MV = { meno_1: 1, da_1_a_3: 0.75, da_3_a_5: 0.5, da_5_a_10: 0.25, oltre_10: 0.1 };
const CONTATTI_MV = ['nessuno', 'accidentale', 'discontinuo', 'esteso'];
const MATRICE_CUTE = { chiuso: [1, 1, 3, 7], matrice: [1, 3, 3, 7], controllato: [1, 3, 7, 10], dispersivo: [1, 7, 7, 10] };

/** Valori ammessi per le scelte del modello (per i moduli). */
export const SCELTE_MOVARISCH = {
  stato: [
    ['solido', 'Solido o nebbia'],
    ['liquido_bassa', 'Liquido poco volatile'],
    ['liquido_alta', 'Liquido volatile o polvere fine'],
    ['gas', 'Gas']
  ],
  quantita: [
    ['meno_0_1', 'Meno di 0,1 kg'],
    ['da_0_1_a_1', '0,1 – 1 kg'],
    ['da_1_a_10', '1 – 10 kg'],
    ['da_10_a_100', '10 – 100 kg'],
    ['oltre_100', 'Oltre 100 kg']
  ],
  uso: [
    ['chiuso', 'Sistema chiuso'],
    ['matrice', 'Inglobato in una matrice'],
    ['controllato', 'Uso controllato, non dispersivo'],
    ['dispersivo', 'Uso dispersivo (spruzzo, polveri)']
  ],
  controllo: [
    ['contenimento', 'Contenimento completo'],
    ['aspirazione', 'Aspirazione localizzata'],
    ['segregazione', 'Segregazione o separazione'],
    ['ventilazione', 'Solo ventilazione generale'],
    ['manipolazione', 'Manipolazione diretta']
  ],
  tempo: [
    ['meno_15m', 'Meno di 15 minuti'],
    ['da_15m_a_2h', '15 minuti – 2 ore'],
    ['da_2h_a_4h', '2 – 4 ore'],
    ['da_4h_a_6h', '4 – 6 ore'],
    ['oltre_6h', 'Oltre 6 ore']
  ],
  distanza: [
    ['meno_1', 'Meno di 1 m'],
    ['da_1_a_3', '1 – 3 m'],
    ['da_3_a_5', '3 – 5 m'],
    ['da_5_a_10', '5 – 10 m'],
    ['oltre_10', '10 m o più']
  ],
  contatto: [
    ['nessuno', 'Nessun contatto'],
    ['accidentale', 'Accidentale (al massimo 1 al giorno)'],
    ['discontinuo', 'Discontinuo (2-10 al giorno)'],
    ['esteso', 'Esteso (oltre 10 al giorno)']
  ]
};

/**
 * Rischio per inalazione e per contatto cutaneo con l'algoritmo MoVaRisCh.
 * R_inal = P × I × d; R_cute = P × E_cute; R_cum = √(R_inal² + R_cute²).
 */
export function movarisch(r) {
  const ip = indicePericolo(r.frasiH);
  const qi = QUANTITA_MV.indexOf(r.quantita);
  const ui = USI_MV.indexOf(r.uso);
  const ci = CONTROLLI_MV.indexOf(r.controllo);
  const ti = TEMPI_MV.indexOf(r.tempo);
  const d = DISTANZE_MV[r.distanza] ?? 1;
  const out = { ...ip, D: null, U: null, C: null, I: null, d, Einal: null, Ecute: null, Rinal: null, Rcute: null, Rcum: null };
  if (MATRICE_D[r.stato] && qi >= 0 && ui >= 0 && ci >= 0 && ti >= 0) {
    out.D = MATRICE_D[r.stato][qi];
    out.U = MATRICE_U[out.D][ui];
    out.C = MATRICE_C[out.U][ci];
    out.I = MATRICE_I[out.C][ti];
    out.Einal = arrotonda(out.I * d, 2);
    out.Rinal = arrotonda(ip.P * out.Einal, 2);
  }
  const ki = CONTATTI_MV.indexOf(r.contatto);
  if (ui >= 0 && ki > 0) {
    out.Ecute = MATRICE_CUTE[r.uso][ki];
    out.Rcute = arrotonda(ip.P * out.Ecute, 2);
  }
  if (out.Rinal !== null && out.Rcute !== null) out.Rcum = arrotonda(Math.sqrt(out.Rinal ** 2 + out.Rcute ** 2), 2);
  const valori = [out.Rinal, out.Rcute, out.Rcum].filter((x) => x !== null);
  out.R = valori.length ? Math.max(...valori) : null;
  return out;
}

export function fasciaMovarisch(R, cmr = false) {
  if (cmr) return { colore: 'rosso', testo: 'Cancerogeno, mutageno o tossico per la riproduzione (cat. 1): il modello non si applica, valutare secondo il Capo II del Titolo IX' };
  if (R === null || R === undefined) return null;
  if (R < 15) return { colore: 'verde', testo: 'Rischio irrilevante per la salute (sentito il medico competente)' };
  if (R < 21) return { colore: 'giallo', testo: 'Zona di incertezza: rivedere punteggi e misure con il medico competente prima di classificarlo irrilevante' };
  if (R < 40) return { colore: 'rosso', testo: 'Rischio superiore all\'irrilevante: misure degli artt. 225, 226, 229 e 230 (sorveglianza sanitaria)' };
  if (R <= 80) return { colore: 'rosso', testo: 'Rischio elevato: misure specifiche, misurazioni ambientali e sorveglianza sanitaria' };
  return { colore: 'rosso', testo: 'Rischio grave: rivedere subito le misure di prevenzione e protezione e intensificare i controlli' };
}

// ---------- rischio biologico (Titolo X) ----------

export const GRUPPI_BIOLOGICI = {
  1: 'Gruppo 1: poche probabilità di causare malattie',
  2: 'Gruppo 2: può causare malattie, poco probabile che si propaghi, di norma ci sono profilassi o cure',
  3: 'Gruppo 3: può causare malattie gravi, può propagarsi, di norma ci sono profilassi o cure',
  4: 'Gruppo 4: malattie gravi, alto rischio di propagazione, di norma senza profilassi o cure'
};

/** Agenti frequenti nelle piccole imprese, con il gruppo dell'Allegato XLVI e le attività tipiche. */
export const AGENTI_BIOLOGICI = [
  { agente: 'Virus dell\'epatite B (HBV)', gruppo: 3, via: 'sangue', attivita: ['acconciatura_estetica', 'pulizie'] },
  { agente: 'Virus dell\'epatite C (HCV)', gruppo: 3, via: 'sangue', attivita: ['acconciatura_estetica', 'pulizie'] },
  { agente: 'Virus dell\'immunodeficienza umana (HIV)', gruppo: 3, via: 'sangue', attivita: ['acconciatura_estetica'] },
  { agente: 'Clostridium tetani (tetano)', gruppo: 2, via: 'ferite', attivita: ['edilizia', 'agricoltura', 'impianti', 'metalmeccanica', 'legno', 'autoriparazione'] },
  { agente: 'Leptospira interrogans (leptospirosi)', gruppo: 2, via: 'contatto', attivita: ['agricoltura', 'pulizie', 'impianti'] },
  { agente: 'Legionella pneumophila (legionellosi)', gruppo: 2, via: 'inalazione', attivita: ['impianti', 'pulizie'] },
  { agente: 'Virus dell\'epatite A (HAV)', gruppo: 2, via: 'ingestione', attivita: ['pulizie', 'impianti'] },
  { agente: 'Salmonella (sierotipi non tifoidei)', gruppo: 2, via: 'ingestione', attivita: ['alimentare_produzione', 'ristorazione'] },
  { agente: 'Listeria monocytogenes', gruppo: 2, via: 'ingestione', attivita: ['alimentare_produzione', 'ristorazione'] },
  { agente: 'Staphylococcus aureus', gruppo: 2, via: 'contatto', attivita: ['acconciatura_estetica', 'alimentare_produzione', 'ristorazione'] },
  { agente: 'Pseudomonas aeruginosa', gruppo: 2, via: 'contatto', attivita: ['acconciatura_estetica'] },
  { agente: 'Trichophyton (dermatofiti, micosi)', gruppo: 2, via: 'contatto', attivita: ['acconciatura_estetica'] },
  { agente: 'Candida albicans', gruppo: 2, via: 'contatto', attivita: ['acconciatura_estetica'] },
  { agente: 'Aspergillus fumigatus (muffe)', gruppo: 2, via: 'inalazione', attivita: ['agricoltura', 'pulizie', 'edilizia'] },
  { agente: 'Borrelia burgdorferi (malattia di Lyme, zecche)', gruppo: 2, via: 'puntura', attivita: ['agricoltura'] },
  { agente: 'Toxoplasma gondii', gruppo: 2, via: 'contatto', attivita: ['agricoltura'] },
  { agente: 'Coxiella burnetii (febbre Q)', gruppo: 3, via: 'inalazione', attivita: ['agricoltura'] },
  { agente: 'Brucella (brucellosi)', gruppo: 3, via: 'contatto', attivita: ['agricoltura'] },
  { agente: 'Mycobacterium tuberculosis', gruppo: 3, via: 'inalazione', attivita: [] },
  { agente: 'Virus influenzali stagionali', gruppo: 2, via: 'inalazione', attivita: [] },
  { agente: 'SARS-CoV-2', gruppo: 3, via: 'inalazione', attivita: [] }
];

/** Rischio per agente: D dal gruppo, P inserita dall'RSPP (1-4), R = P × D. */
export function rischioBiologico(r) {
  const g = Math.round(num(r?.gruppo) ?? 0);
  const P = Math.round(num(r?.probabilita) ?? 0);
  if (g < 1 || g > 4 || P < 1 || P > 4) return null;
  return { D: g, P, R: P * g };
}

/** Obblighi del Titolo X che derivano dagli agenti indicati e dal tipo di esposizione. */
export function obblighiBiologici(righe, deliberato = false) {
  const gruppi = (righe || []).map((r) => Math.round(num(r.gruppo) ?? 0)).filter((g) => g >= 1 && g <= 4);
  const max = gruppi.length ? Math.max(...gruppi) : 0;
  const vaccino = (righe || []).some((r) => r.vaccino === 'si');
  const o = [];
  if (!max) return o;
  o.push('Misure tecniche, organizzative e procedurali e misure igieniche (artt. 272 e 273): lavabi, detergenti, indumenti separati, divieto di mangiare e fumare.');
  if (max >= 2) {
    o.push('DPI adatti (guanti, mascherine o facciali filtranti, occhiali) e loro custodia, pulizia e sostituzione (art. 273).');
    o.push('Informazione e formazione prima dell\'inizio e almeno ogni 5 anni, con istruzioni scritte e cartelli (art. 278).');
    o.push('Sorveglianza sanitaria del medico competente se la valutazione evidenzia un rischio per la salute (art. 279).');
  }
  if (vaccino) o.push('Offrire le vaccinazioni disponibili, su indicazione del medico competente (art. 279 c. 2).');
  if (max >= 3) {
    o.push('Registro degli esposti ad agenti dei gruppi 3 e 4, con copia all\'INAIL e all\'ASL (art. 280).');
    o.push('Procedure per incidenti e infortuni con possibile esposizione (art. 277) e segnale di rischio biologico (Allegato XLV).');
  }
  if (deliberato && max >= 2 && max <= 3) o.push('Uso deliberato: comunicazione all\'organo di vigilanza almeno 30 giorni prima dell\'inizio (art. 269) e misure di contenimento dell\'Allegato XLVII.');
  if (deliberato && max === 4) o.push('Uso deliberato di agenti del gruppo 4: serve l\'autorizzazione del Ministero della salute (art. 270).');
  return o;
}

// ---------- microclima ----------

/**
 * PMV e PPD di Fanger (UNI EN ISO 7730, Allegato D) per ambienti moderati.
 * ta, tr in °C; vel = velocità relativa dell'aria in m/s; ur = umidità relativa %; met; clo.
 */
export function pmvPpd({ ta, tr, vel, ur, met, clo, wme = 0 }) {
  const TA = num(ta);
  const TR = num(tr) ?? TA;
  const V = num(vel) ?? 0.1;
  const RH = num(ur) ?? 50;
  const MET = num(met);
  const CLO = num(clo);
  if (TA === null || MET === null || CLO === null) return null;
  const pa = RH * 10 * Math.exp(16.6536 - 4030.183 / (TA + 235));
  const icl = 0.155 * CLO;
  const m = MET * 58.15;
  const mw = m - wme * 58.15;
  const fcl = icl <= 0.078 ? 1 + 1.29 * icl : 1.05 + 0.645 * icl;
  const hcf = 12.1 * Math.sqrt(V);
  const taa = TA + 273;
  const tra = TR + 273;
  const tcla = taa + (35.5 - TA) / (3.5 * icl + 0.1);
  const p1 = icl * fcl;
  const p2 = p1 * 3.96;
  const p3 = p1 * 100;
  const p4 = p1 * taa;
  const p5 = 308.7 - 0.028 * mw + p2 * (tra / 100) ** 4;
  let xn = tcla / 100;
  let xf = tcla / 50;
  let hc = hcf;
  for (let n = 0; Math.abs(xn - xf) > 0.00015; n++) {
    if (n > 150) return null;
    xf = (xf + xn) / 2;
    const hcn = 2.38 * Math.abs(100 * xf - taa) ** 0.25;
    hc = hcf > hcn ? hcf : hcn;
    xn = (p5 + p4 * hc - p2 * xf ** 4) / (100 + p3 * hc);
  }
  const tcl = 100 * xn - 273;
  const hl1 = 3.05 * 0.001 * (5733 - 6.99 * mw - pa);
  const hl2 = mw > 58.15 ? 0.42 * (mw - 58.15) : 0;
  const hl3 = 1.7 * 0.00001 * m * (5867 - pa);
  const hl4 = 0.0014 * m * (34 - TA);
  const hl5 = 3.96 * fcl * (xn ** 4 - (tra / 100) ** 4);
  const hl6 = fcl * hc * (tcl - TA);
  const ts = 0.303 * Math.exp(-0.036 * m) + 0.028;
  const pmv = ts * (mw - hl1 - hl2 - hl3 - hl4 - hl5 - hl6);
  const ppd = 100 - 95 * Math.exp(-0.03353 * pmv ** 4 - 0.2179 * pmv ** 2);
  return { pmv: arrotonda(pmv, 2), ppd: arrotonda(ppd, 0) };
}

/** Categoria di comfort ISO 7730 dal PMV. */
export function fasciaPmv(pmv) {
  if (pmv === null || pmv === undefined) return null;
  const a = Math.abs(pmv);
  const verso = pmv > 0 ? 'caldo' : 'freddo';
  if (a <= 0.2) return { colore: 'verde', testo: 'Categoria A: comfort ottimo' };
  if (a <= 0.5) return { colore: 'verde', testo: 'Categoria B: comfort accettabile (riferimento usuale per i luoghi di lavoro)' };
  if (a <= 0.7) return { colore: 'giallo', testo: `Categoria C: comfort scarso, tendenza al ${verso}` };
  return { colore: 'rosso', testo: `Fuori dalle categorie di comfort: ambiente troppo ${verso}, intervenire` };
}

/** Metabolismo per attività tipiche (met), dalla UNI EN ISO 7730. */
export const METABOLISMO = [
  ['1.0', 'Seduto, a riposo (1,0 met)'],
  ['1.2', 'Seduto, lavoro d\'ufficio (1,2 met)'],
  ['1.6', 'In piedi, attività leggera: negozio, laboratorio (1,6 met)'],
  ['2.0', 'In piedi, attività media: lavoro alle macchine, cucina (2,0 met)'],
  ['3.0', 'Attività pesante (3,0 met)']
];

export const ABBIGLIAMENTO = [
  ['0.5', 'Estivo leggero (0,5 clo)'],
  ['0.7', 'Indumenti da lavoro leggeri (0,7 clo)'],
  ['1.0', 'Invernale da interno (1,0 clo)'],
  ['1.3', 'Invernale pesante (1,3 clo)']
];

/** WBGT (UNI EN ISO 7243:2017): senza sole 0,7·tnw + 0,3·tg; con sole 0,7·tnw + 0,2·tg + 0,1·ta. CAV per gli indumenti. */
export function wbgt({ tnw, tg, ta, sole, cav }) {
  const n = num(tnw);
  const g = num(tg);
  const a = num(ta);
  if (n === null || g === null) return null;
  const base = sole && a !== null ? 0.7 * n + 0.2 * g + 0.1 * a : 0.7 * n + 0.3 * g;
  return arrotonda(base + (num(cav) ?? 0));
}

/** Classi di metabolismo dell'UNI EN ISO 7243 (watt). */
export const CLASSI_METABOLICHE = [
  ['0', 'Classe 0: a riposo (115 W)', 115],
  ['1', 'Classe 1: leggero, seduto o in piedi con lavoro manuale (180 W)', 180],
  ['2', 'Classe 2: moderato, lavoro con braccia e gambe, camminare (300 W)', 300],
  ['3', 'Classe 3: intenso, sollevare, spingere, scavare (415 W)', 415],
  ['4', 'Classe 4: molto intenso, al massimo ritmo (520 W)', 520]
];

/** Valore di riferimento WBGT in °C per acclimatati (56,7 − 11,5·log₁₀M) e non acclimatati (59,9 − 14,1·log₁₀M). */
export function wbgtRiferimento(classe, acclimatato = false) {
  const M = CLASSI_METABOLICHE.find((c) => c[0] === String(classe))?.[2];
  if (!M) return null;
  return arrotonda(acclimatato ? 56.7 - 11.5 * Math.log10(M) : 59.9 - 14.1 * Math.log10(M));
}

export function fasciaWbgt(valore, riferimento) {
  if (valore === null || riferimento === null) return null;
  if (valore > riferimento) return { colore: 'rosso', testo: 'Oltre il valore di riferimento: stress termico, ridurre l\'esposizione (pause, orari, acqua, ombra) e approfondire con UNI EN ISO 7933' };
  if (valore > riferimento - 2) return { colore: 'giallo', testo: 'Vicino al valore di riferimento: programmare pause e idratazione, sorvegliare i lavoratori' };
  return { colore: 'verde', testo: 'Sotto il valore di riferimento' };
}

// ---------- illuminazione ----------

/** Illuminamento medio mantenuto indicativo (lux) per compiti tipici, dalla UNI EN 12464-1. */
export const ILLUMINAMENTI = [
  ['corridoi', 'Corridoi e zone di passaggio', 100],
  ['scale', 'Scale', 150],
  ['servizi', 'Servizi igienici, spogliatoi', 200],
  ['magazzino', 'Magazzini e depositi', 100],
  ['spedizione', 'Imballaggio e spedizione', 300],
  ['archivio', 'Archivi', 200],
  ['mensa', 'Mense e locali di ristoro', 200],
  ['ricevimento', 'Reception', 300],
  ['vendita', 'Area di vendita', 300],
  ['casse', 'Casse', 500],
  ['ufficio', 'Ufficio: scrittura, lettura, computer', 500],
  ['riunioni', 'Sale riunioni', 500],
  ['disegno', 'Disegno tecnico', 750],
  ['cucina', 'Cucine', 500],
  ['officina_grossa', 'Officina: lavori grossolani e medi', 300],
  ['officina_fine', 'Officina: lavori fini, montaggi di precisione', 750],
  ['acconciatura', 'Acconciatura ed estetica', 500]
];

export function esitoIlluminazione(compito, misurato) {
  const req = ILLUMINAMENTI.find((c) => c[0] === compito)?.[2];
  const m = num(misurato);
  if (!req || m === null) return null;
  if (m >= req) return { colore: 'verde', richiesto: req, testo: 'Adeguato' };
  if (m >= req * 0.8) return { colore: 'giallo', richiesto: req, testo: 'Poco sotto il valore indicato: migliorare' };
  return { colore: 'rosso', richiesto: req, testo: 'Insufficiente: integrare l\'illuminazione' };
}

// ---------- stress lavoro-correlato: lista di controllo INAIL (metodologia 2017) ----------

/** Indicatori aziendali (eventi sentinella) 1-8: «perLavoratore» se si rapportano al numero di lavoratori. */
export const EVENTI_SENTINELLA = [
  { id: 'infortuni', etichetta: 'Infortuni', perLavoratore: true },
  { id: 'malattia', etichetta: 'Giorni di assenza per malattia', perLavoratore: true },
  { id: 'assenze', etichetta: 'Ore di assenza sulle ore da contratto (%)', perLavoratore: false },
  { id: 'ferie', etichetta: 'Ferie non godute sulle ferie maturate (%)', perLavoratore: false },
  { id: 'trasferimenti', etichetta: 'Trasferimenti interni richiesti', perLavoratore: true },
  { id: 'rotazione', etichetta: 'Lavoratori usciti più entrati (rotazione)', perLavoratore: true },
  { id: 'disciplinari', etichetta: 'Procedimenti e sanzioni disciplinari', perLavoratore: true },
  { id: 'visite', etichetta: 'Richieste di visite mediche straordinarie', perLavoratore: true }
];

/** Dimensioni delle aree Contenuto e Contesto: numero di indicatori e soglie (non rilevante fino a, medio fino a). */
export const DIMENSIONI_STRESS = {
  contenuto: [
    { id: 'ambiente', etichetta: 'Ambiente di lavoro e attrezzature', n: 13, soglie: [22, 45] },
    { id: 'pianificazione', etichetta: 'Pianificazione dei compiti', n: 6, soglie: [49, 82] },
    { id: 'carico', etichetta: 'Carico di lavoro e ritmo', n: 9, soglie: [32, 55] },
    { id: 'orario', etichetta: 'Orario di lavoro', n: 8, soglie: [37, 74] }
  ],
  contesto: [
    { id: 'funzione', etichetta: 'Funzione e cultura organizzativa', n: 11, soglie: [44, 72] },
    { id: 'ruolo', etichetta: 'Ruolo nell\'organizzazione', n: 4, soglie: [49, 74] },
    { id: 'carriera', etichetta: 'Evoluzione della carriera', n: 3, soglie: [66, 99] },
    { id: 'autonomia', etichetta: 'Autonomia decisionale e controllo', n: 5, soglie: [59, 79] },
    { id: 'rapporti', etichetta: 'Rapporti interpersonali', n: 3, soglie: [66, 99] }
  ]
};

/**
 * Andamento di un indicatore: ultimo anno a confronto con la media dei tre anni.
 * valori: [anno-2, anno-1, anno]; lavoratori: idem (per rapportare). Se l'ultimo valore è 0 l'andamento è «diminuito».
 */
export function andamentoIndicatore(valori, lavoratori, perLavoratore = true) {
  const v = (valori || []).map(num);
  if (v.some((x) => x === null)) return null;
  const rap = v.map((x, i) => {
    if (!perLavoratore) return x;
    const l = num(lavoratori?.[i]);
    return l ? x / l : x;
  });
  const ultimo = rap[rap.length - 1];
  if (ultimo === 0) return 'diminuito';
  const media = rap.reduce((a, b) => a + b, 0) / rap.length;
  if (Math.abs(ultimo - media) < 1e-9) return 'inalterato';
  return ultimo > media ? 'aumentato' : 'diminuito';
}

const PUNTI_ANDAMENTO = { diminuito: 0, inalterato: 1, aumentato: 4 };

const livelloDa = (x, [a, b]) => (x <= a ? 'non rilevante' : x <= b ? 'medio' : 'alto');

/**
 * Punteggio della lista di controllo.
 * eventi: { infortuni: [3 valori], … }; lavoratori: [3]; lamentele, istanze: boolean;
 * criticita: { ambiente: numero di indicatori critici, … }; interfaccia: numero di indicatori critici della conciliazione.
 */
export function stressInail({ eventi = {}, lavoratori = [], lamentele = false, istanze = false, criticita = {}, interfaccia = null }) {
  const righeA = EVENTI_SENTINELLA.map((e) => {
    const andamento = andamentoIndicatore(eventi[e.id], lavoratori, e.perLavoratore);
    return { ...e, andamento, punti: andamento ? PUNTI_ANDAMENTO[andamento] : null };
  });
  const completaA = righeA.every((r) => r.punti !== null);
  const sommaA = righeA.reduce((s, r) => s + (r.punti ?? 0), 0) + (lamentele ? 4 : 0) + (istanze ? 4 : 0);
  const areaA = completaA ? (sommaA <= 10 ? 0 : sommaA <= 20 ? 6 : 16) : null;
  const dimensione = (d) => {
    const k = num(criticita[d.id]);
    if (k === null) return { ...d, punteggio: null, livello: null };
    const p = Math.round((Math.min(Math.max(k, 0), d.n) / d.n) * 100);
    return { ...d, punteggio: p, livello: livelloDa(p, d.soglie) };
  };
  const contenuto = DIMENSIONI_STRESS.contenuto.map(dimensione);
  const contesto = DIMENSIONI_STRESS.contesto.map(dimensione);
  const media = (l) => (l.every((x) => x.punteggio !== null) ? Math.round(l.reduce((s, x) => s + x.punteggio, 0) / l.length) : null);
  const areaB = media(contenuto);
  const mediaC = media(contesto);
  const valoreInterfaccia = num(interfaccia) === 0 ? -4 : 0;
  const areaC = mediaC === null ? null : Math.max(0, mediaC + valoreInterfaccia);
  const totale = areaA === null || areaB === null || areaC === null ? null : areaA + areaB + areaC;
  return {
    righeA,
    sommaA,
    areaA,
    contenuto,
    contesto,
    areaB,
    livelloB: areaB === null ? null : livelloDa(areaB, [23, 43]),
    areaC,
    livelloC: areaC === null ? null : livelloDa(areaC, [37, 53]),
    valoreInterfaccia,
    totale,
    livello: totale === null ? null : livelloDa(totale, [58, 90])
  };
}

export function fasciaStress(livello) {
  if (!livello) return null;
  if (livello === 'non rilevante') return { colore: 'verde', testo: 'Rischio non rilevante: ripetere la valutazione periodicamente o se cambia l\'organizzazione' };
  if (livello === 'medio') return { colore: 'giallo', testo: 'Rischio medio: adottare azioni correttive mirate sugli indicatori critici e verificarne l\'efficacia entro un anno; se non efficaci, valutazione approfondita' };
  return { colore: 'rosso', testo: 'Rischio alto: azioni correttive immediate e valutazione approfondita con il coinvolgimento dei lavoratori' };
}

// ---------- dati del libretto d'uso e manutenzione ----------

/**
 * Righe iniziali della valutazione del rumore dai dati di emissione dei libretti:
 * livello = LpA + K (incertezza dichiarata), picco = LCpeak.
 */
export function righeRumoreDaLibretti(attrezzature, max = 8) {
  const conDati = (attrezzature || []).filter((a) => num(a.emissioni?.lpa) !== null);
  const senza = (attrezzature || []).filter((a) => num(a.emissioni?.lpa) === null);
  return [...conDati, ...senza].slice(0, max).map((a) => {
    const e = a.emissioni || {};
    const lpa = num(e.lpa);
    return {
      attivita: a.nome,
      livello: lpa === null ? '' : String(arrotonda(lpa + (num(e.krumore) ?? 0))).replace('.', ','),
      ore: '',
      picco: num(e.lcpeak) === null ? '' : String(num(e.lcpeak)).replace('.', ','),
      lceq: '',
      fonte: lpa === null ? '' : `Libretto: LpA ${String(lpa).replace('.', ',')}${num(e.krumore) ? ` + K ${String(num(e.krumore)).replace('.', ',')}` : ''} dB(A)`
    };
  });
}

/** Accelerazione dichiarata nel libretto per il calcolo: a_hv per mano-braccio, il valore più alto dei tre assi per corpo intero. */
export function vibrazioneDaLibretto(e) {
  e = e || {};
  if (e.vib === 'WBV') return wbvDaAssi(e.awx, e.awy, e.awz) ?? num(e.ahv);
  if (e.vib === 'HAV') return num(e.ahv);
  return null;
}

/** Righe iniziali della valutazione delle vibrazioni dai libretti (solo le attrezzature con dati o che vibrano). */
export function righeVibrazioniDaLibretti(attrezzature, filtro = () => false, max = 8) {
  const conDati = (attrezzature || []).filter((a) => vibrazioneDaLibretto(a.emissioni) !== null);
  const altre = (attrezzature || []).filter((a) => vibrazioneDaLibretto(a.emissioni) === null && filtro(a));
  return [...conDati, ...altre].slice(0, max).map((a) => {
    const e = a.emissioni || {};
    const v = vibrazioneDaLibretto(e);
    return {
      attrezzo: a.nome,
      sistema: e.vib === 'WBV' ? 'WBV' : 'HAV',
      accelerazione: v === null ? '' : String(v).replace('.', ','),
      incertezza: num(e.kvib) === null ? '' : String(num(e.kvib)).replace('.', ','),
      fattore: '',
      ore: '',
      fonte: v === null ? '' : 'Libretto'
    };
  });
}

const virgola = (x) => String(x).replace('.', ',');
const ore = (t) => (t < 1 ? `${Math.round(t * 60)} minuti` : `${virgola(t)} ore`);

/** Frasi di riepilogo per la scheda dell'attrezzatura: dopo quanto tempo d'uso si superano i valori. */
export function riepilogoEmissioni(e) {
  e = e || {};
  const out = [];
  const lpa = num(e.lpa);
  if (lpa !== null) {
    const L = arrotonda(lpa + (num(e.krumore) ?? 0));
    const t80 = oreMassimeRumore(L, SOGLIE_RUMORE.inferiore);
    const t85 = oreMassimeRumore(L, SOGLIE_RUMORE.superiore);
    if (t80 === null) out.push(`Rumore ${virgola(L)} dB(A): anche usandola 8 ore al giorno si resta entro 80 dB(A).`);
    else out.push(`Rumore ${virgola(L)} dB(A): si arriva a 80 dB(A) dopo ${ore(t80)} di uso al giorno${t85 === null ? '' : ` e a 85 dB(A) dopo ${ore(t85)}`}.`);
  }
  const picco = num(e.lcpeak);
  if (picco !== null && picco > SOGLIE_PICCO.inferiore) out.push(`Picco ${virgola(picco)} dB(C): oltre i 135 dB(C), servono DPI uditivi.`);
  const a = vibrazioneDaLibretto(e);
  if (a !== null && (e.vib === 'HAV' || e.vib === 'WBV')) {
    const ae = accelerazioneEfficace({ accelerazione: a, incertezza: e.kvib });
    const ta = oreMassimeVibrazioni(ae, e.vib, 'azione');
    const tl = oreMassimeVibrazioni(ae, e.vib, 'limite');
    const nome = e.vib === 'WBV' ? 'corpo intero' : 'mano-braccio';
    if (ta === null) out.push(`Vibrazioni ${nome} ${virgola(ae)} m/s²: anche 8 ore al giorno si resta sotto il valore d'azione.`);
    else out.push(`Vibrazioni ${nome} ${virgola(ae)} m/s²: valore d'azione dopo ${ore(ta)} di uso effettivo al giorno${tl === null ? '' : `, valore limite dopo ${ore(tl)}`}.`);
  }
  return out;
}
