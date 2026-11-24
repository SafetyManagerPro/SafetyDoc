// Date in formato italiano (gg/mm/aaaa) e data di oggi secondo l'ora locale. Modulo puro: testabile con Node.

const due = (n) => String(n).padStart(2, '0');

/** Data di oggi come "AAAA-MM-GG" secondo l'orologio del dispositivo (non l'ora di Greenwich). */
export function oggiLocale(adesso = new Date()) {
  return `${adesso.getFullYear()}-${due(adesso.getMonth() + 1)}-${due(adesso.getDate())}`;
}

/** "2026-03-15" → "15/03/2026". */
export function formattaData(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [a, m, g] = iso.slice(0, 10).split('-');
  return `${g}/${m}/${a}`;
}

function valida(a, m, g) {
  if (m < 1 || m > 12 || g < 1) return null;
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  if (g > ultimo) return null;
  return `${String(a).padStart(4, '0')}-${due(m)}-${due(g)}`;
}

/**
 * Legge una data scritta a mano: "15/3/2019", "15-03-19", "15.03.2019", "15032019", "150319".
 * Anno a due cifre: fino a 10 anni avanti rispetto a oggi è 20xx, altrimenti 19xx.
 * Restituisce "AAAA-MM-GG" oppure null.
 */
export function interpretaData(testo, oggi = oggiLocale()) {
  const t = String(testo || '').trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return valida(...t.split('-').map(Number));
  let g, m, a;
  const parti = t.split(/[\s/.\-]+/).filter(Boolean);
  if (parti.length === 3 && parti.every((x) => /^\d+$/.test(x))) [g, m, a] = parti;
  else if (/^\d{8}$/.test(t)) [g, m, a] = [t.slice(0, 2), t.slice(2, 4), t.slice(4)];
  else if (/^\d{6}$/.test(t)) [g, m, a] = [t.slice(0, 2), t.slice(2, 4), t.slice(4)];
  else return null;
  let anno = Number(a);
  if (a.length === 2) {
    const corrente = Number(oggi.slice(0, 4));
    anno = 2000 + anno <= corrente + 10 ? 2000 + anno : 1900 + anno;
  } else if (a.length !== 4) return null;
  return valida(anno, Number(m), Number(g));
}

/**
 * Mentre si scrive aggiunge le barre: "1503" → "15/03", "15/032019" → "15/03/2019".
 * Se l'utente mette le barre in altre posizioni (es. "5/3/2019") il testo resta com'è.
 */
export function mascheraData(testo) {
  const t = String(testo || '');
  if (/[^\d/]/.test(t)) return t;
  const barreNostre = [...t].every((ch, i) => ch !== '/' || i === 2 || i === 5);
  if (!barreNostre) return t;
  const c = t.replace(/\D/g, '').slice(0, 8);
  if (c.length <= 2) return c;
  if (c.length <= 4) return `${c.slice(0, 2)}/${c.slice(2)}`;
  return `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4)}`;
}

/** Messaggio d'errore per una data fuori dai limiti, oppure stringa vuota. */
export function erroreData(iso, { min, max, obbligatoria, testo } = {}) {
  if (!iso) {
    if (testo && String(testo).trim()) return 'Data non valida: scrivila come giorno/mese/anno, per esempio 15/03/2024.';
    return obbligatoria ? 'Inserisci la data.' : '';
  }
  if (max && iso > max) return `La data non può essere dopo il ${formattaData(max)}.`;
  if (min && iso < min) return `La data non può essere prima del ${formattaData(min)}.`;
  return '';
}

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
