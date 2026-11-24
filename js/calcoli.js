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

export function fasciaRumore(lex) {
  if (lex === null) return null;
  if (lex > SOGLIE_RUMORE.limite) return { colore: 'rosso', testo: 'Oltre il valore limite di 87 dB(A): ridurre subito l\'esposizione (il limite si verifica tenendo conto dei DPI uditivi)' };
  if (lex > SOGLIE_RUMORE.superiore) return { colore: 'rosso', testo: 'Oltre 85 dB(A): DPI uditivi obbligatori, programma di riduzione, segnaletica, visita medica obbligatoria' };
  if (lex > SOGLIE_RUMORE.inferiore) return { colore: 'giallo', testo: 'Tra 80 e 85 dB(A): mettere a disposizione i DPI uditivi, informazione e formazione, visita medica su richiesta' };
  return { colore: 'verde', testo: 'Fino a 80 dB(A): nessun obbligo specifico oltre alle misure generali' };
}

// ---------- vibrazioni (Titolo VIII Capo III) ----------

export const SOGLIE_VIBRAZIONI = { HAV: { azione: 2.5, limite: 5 }, WBV: { azione: 0.5, limite: 1 } };

/** Esposizione giornaliera A(8) in m/s² per mano-braccio (HAV) o corpo intero (WBV). */
export function a8(righe, sistema) {
  const valide = (righe || [])
    .filter((r) => (r.sistema || 'HAV') === sistema)
    .map((r) => ({ a: num(r.accelerazione), T: num(r.ore) }))
    .filter((r) => r.a !== null && r.T !== null && r.T > 0);
  if (!valide.length) return null;
  return arrotonda(Math.sqrt(valide.reduce((s, r) => s + (r.a * r.a * r.T) / 8, 0)), 2);
}

export function fasciaVibrazioni(valore, sistema) {
  if (valore === null) return null;
  const s = SOGLIE_VIBRAZIONI[sistema];
  if (valore > s.limite) return { colore: 'rosso', testo: `Oltre il valore limite di ${s.limite} m/s²: ridurre subito l'esposizione` };
  if (valore > s.azione) return { colore: 'giallo', testo: `Oltre il valore d'azione di ${s.azione} m/s²: programma di riduzione, formazione, sorveglianza sanitaria` };
  return { colore: 'verde', testo: `Sotto il valore d'azione di ${s.azione} m/s²` };
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
