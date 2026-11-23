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
  'confinati'
];

/** Fatti derivati dalle risposte, usabili nelle regole con {"fatto": "..."} */
export function derivaFatti(risposte, questionario) {
  const r = risposte || {};
  const haDipendenti = r.composizione === 'dipendenti';
  const lavoratori = haDipendenti ? Math.max(1, Number(r.numero_lavoratori) || 1) : 0;

  const domandaAttivita = questionario?.domande?.find((d) => d.id === 'attivita');
  const opzione = domandaAttivita?.opzioni?.find((o) => o.valore === r.attivita);

  return {
    haDipendenti,
    lavoratori,
    classeRischio: opzione?.classeRischio ?? 'da_verificare',
    attivitaRegolamentata: Boolean(opzione?.regolamentata),
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

export function creaContesto(risposte, questionario) {
  const r = risposte || {};
  return { risposte: r, fatti: derivaFatti(r, questionario) };
}

/** Domande da mostrare, tenendo conto di "mostraSe". */
export function domandeVisibili(questionario, risposte) {
  const ctx = creaContesto(risposte, questionario);
  return questionario.domande.filter((d) => !d.mostraSe || valuta(d.mostraSe, ctx));
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
export function generaPiano({ catalogo, questionario, risposte, adempimenti, oggi }) {
  const ctx = creaContesto(risposte, questionario);
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
