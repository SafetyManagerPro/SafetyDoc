// Aiuti contestuali: «?» accanto a campi, pulsanti e sezioni, con un post-it che spiega cos'è, perché serve
// e cosa fare dopo; sigle del glossario cliccabili. Le funzioni di questo modulo sono pure e testabili con Node.

/** Nome della schermata dall'indirizzo: '#/documento/dvr-bozza' → 'documento:dvr-bozza', '#/' → 'oggi'. */
export function rottaDa(hash) {
  const [, rotta = '', param = ''] = String(hash || '').split('/');
  if (!rotta) return 'oggi';
  if (rotta === 'documento' && param) return `documento:${decodeURIComponent(param)}`;
  return rotta;
}

/** La voce vale per questa schermata? (accetta 'documento:*' per tutti i documenti) */
export function valePer(voce, rotta) {
  const r = [].concat(voce.rotta);
  return r.some((x) => x === rotta || (x.endsWith(':*') && rotta.startsWith(x.slice(0, -1))));
}

export const vociPer = (voci, rotta) => (voci || []).filter((v) => valePer(v, rotta));

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

/** L'elemento corrisponde al testo richiesto dalla voce (inizio del testo, senza maiuscole e spazi doppi)? */
export const testoCorrisponde = (voce, testoElemento) => !voce.testo || norm(testoElemento).startsWith(norm(voce.testo));

/** Controlli sul file degli aiuti (usati dai test). */
export function erroriGuida(voci) {
  const e = [];
  const ids = new Set();
  for (const v of voci || []) {
    if (!/^[a-z0-9-]{3,34}$/.test(v.id || '')) e.push(`id non valido: ${v.id}`);
    if (ids.has(v.id)) e.push(`id doppio: ${v.id}`);
    ids.add(v.id);
    for (const k of ['rotta', 'sel', 'titolo', 'cosa', 'perche', 'dopo']) if (!v[k]) e.push(`${v.id}: manca ${k}`);
    for (const k of ['cosa', 'perche', 'dopo']) if (String(v[k] || '').length > 260) e.push(`${v.id}: «${k}» troppo lungo`);
    if (v.pos && !['dentro', 'dopo', 'primo'].includes(v.pos)) e.push(`${v.id}: pos non valida`);
    if (v.link && !/^#\//.test(v.link.href || '')) e.push(`${v.id}: link non interno`);
  }
  return e;
}

/** Sigle del glossario da rendere cliccabili: solo sigle vere (maiuscole), escluse quelle ambigue. */
export function sigleCliccabili(glossario, escluse = ['DL']) {
  return (glossario || []).filter((g) => /^[A-Z][A-Z0-9]{1,7}$/.test(g.sigla) && !escluse.includes(g.sigla));
}

/** Espressione regolare per trovare le sigle come parole intere. */
export function regexSigle(sigle) {
  if (!sigle.length) return null;
  const alternative = sigle
    .map((g) => g.sigla)
    .sort((a, b) => b.length - a.length)
    .join('|');
  return new RegExp(`(^|[^A-Za-zÀ-ÿ0-9])(${alternative})(?=$|[^A-Za-zÀ-ÿ0-9])`);
}

/** Nome dell'evento di utilizzo per un aiuto aperto (rispetta il formato ammesso dal database). */
export const eventoGuida = (tipo, id) => `${tipo}:${String(id).toLowerCase().replace(/[^a-z0-9-]/g, '')}`.slice(0, 40);
