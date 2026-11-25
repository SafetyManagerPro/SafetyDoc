// Formato di scambio e unione dei dati tra postazioni.
// Modulo puro: testabile con Node.

export const FORMATO = 'safetydoc-export';
export const FORMATO_CIFRATO = 'safetydoc-export-cifrato';
export const SCHEMA_VERSION = 5;
export const COLLEZIONI = ['profilo', 'adempimenti', 'lavoratori', 'registri', 'attrezzature', 'controlli', 'prodotti', 'eventi', 'archivio', 'allegati'];

/** Confronto deterministico: vince la modifica più recente; a parità, l'id di postazione maggiore. */
export function vince(a, b) {
  const ta = a.updatedAt || '';
  const tb = b.updatedAt || '';
  if (ta !== tb) return ta > tb ? a : b;
  return (a.deviceId || '') >= (b.deviceId || '') ? a : b;
}

function contenutoUguale(a, b) {
  const pulisci = ({ updatedAt, deviceId, ...resto }) => resto;
  return JSON.stringify(ordina(pulisci(a))) === JSON.stringify(ordina(pulisci(b)));
}

function ordina(v) {
  if (Array.isArray(v)) return v.map(ordina);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((o, k) => ((o[k] = ordina(v[k])), o), {});
  }
  return v;
}

/**
 * Unisce i record locali con quelli importati.
 * Restituisce i record da salvare e un riepilogo leggibile.
 */
export function unisciCollezione(locali, importati) {
  const perId = new Map((locali || []).map((r) => [r.id, r]));
  const daSalvare = [];
  const riepilogo = { aggiunti: 0, aggiornati: 0, invariati: 0, conflitti: [] };

  for (const remoto of importati || []) {
    if (!remoto || typeof remoto.id !== 'string') continue;
    const locale = perId.get(remoto.id);
    if (!locale) {
      daSalvare.push(remoto);
      riepilogo.aggiunti++;
      continue;
    }
    if (contenutoUguale(locale, remoto)) {
      riepilogo.invariati++;
      continue;
    }
    const vincitore = vince(locale, remoto);
    if (vincitore === remoto) {
      daSalvare.push(remoto);
      riepilogo.aggiornati++;
      riepilogo.conflitti.push({ id: remoto.id, tenuto: 'importato', scartato: locale });
    } else {
      riepilogo.invariati++;
      riepilogo.conflitti.push({ id: remoto.id, tenuto: 'locale', scartato: remoto });
    }
  }
  return { daSalvare, riepilogo };
}

export function creaExport({ collezioni, deviceId, versioneApp, ora, documenti = [] }) {
  return {
    formato: FORMATO,
    schemaVersion: SCHEMA_VERSION,
    versioneApp,
    esportatoIl: ora || new Date().toISOString(),
    deviceId,
    collezioni: Object.fromEntries(COLLEZIONI.map((c) => [c, collezioni[c] || []])),
    // dati compilati nei documenti (DVR personalizzato, POS, DUVRI, valutazioni…) e registro dei promemoria
    documenti
  };
}

/**
 * Unisce i dati dei documenti: per ogni chiave vince la modifica più recente; senza data vale come più vecchia.
 * I registri dei promemoria si fondono invece di sostituirsi.
 */
export function unisciDocumenti(locali, importati) {
  const mappa = new Map((locali || []).map((m) => [m.id, m]));
  const daSalvare = [];
  for (const r of importati || []) {
    if (!r?.id || typeof r.id !== 'string') continue;
    const l = mappa.get(r.id);
    if (r.id === 'promemoria:inviati') {
      const tutti = [...(l?.valore || []), ...(r.valore || [])];
      const unici = [...new Map(tutti.map((x) => [`${x.data}|${x.canale}`, x])).values()].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 50);
      if (JSON.stringify(unici) !== JSON.stringify(l?.valore || [])) daSalvare.push({ id: r.id, valore: unici, updatedAt: r.updatedAt || l?.updatedAt || null });
      continue;
    }
    if (!l || String(r.updatedAt || '') > String(l.updatedAt || '')) daSalvare.push({ id: r.id, valore: r.valore, updatedAt: r.updatedAt || null });
  }
  return daSalvare;
}

/** Controlla che un file importato sia un export valido e leggibile da questa versione. */
export function validaExport(dati) {
  if (!dati || typeof dati !== 'object') throw new Error('Il file non è un backup di safetyDoc.');
  if (dati.formato === FORMATO_CIFRATO) throw new Error('CIFRATO');
  if (dati.formato !== FORMATO) throw new Error('Il file non è un backup di safetyDoc.');
  if (typeof dati.schemaVersion !== 'number' || dati.schemaVersion > SCHEMA_VERSION) {
    throw new Error("Il backup è stato creato con una versione più recente dell'app. Aggiorna safetyDoc e riprova.");
  }
  for (const c of COLLEZIONI) {
    if (dati.collezioni?.[c] && !Array.isArray(dati.collezioni[c])) {
      throw new Error('Il backup è danneggiato.');
    }
  }
  if (dati.documenti !== undefined && !Array.isArray(dati.documenti)) throw new Error('Il backup è danneggiato.');
  return migra(dati);
}

/** Punto unico per convertire i backup delle versioni precedenti dello schema. */
export function migra(dati) {
  // v1 → v2: lavoratori e registri; v2 → v3: attrezzature, controlli e allegati; v3 → v4: prodotti ed eventi; v4 → v5: archivio di documenti e planimetrie.
  const collezioni = { ...dati.collezioni };
  for (const c of COLLEZIONI) if (!collezioni[c]) collezioni[c] = [];
  // i backup precedenti alla 0.18.1 non contengono i dati dei documenti
  const documenti = (dati.documenti || []).filter((m) => m && typeof m.id === 'string' && /^(opzioni:|promemoria:inviati$)/.test(m.id));
  return { ...dati, schemaVersion: SCHEMA_VERSION, collezioni, documenti };
}
