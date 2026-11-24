// Richiesta di aiuto al consulente o all'associazione: link per telefono, WhatsApp ed email.
// Modulo puro: testabile con Node. Il messaggio non contiene dati dei lavoratori.

/** Numero di telefono pulito; aggiunge +39 ai numeri italiani scritti senza prefisso. */
export function numeroInternazionale(numero) {
  let n = String(numero || '').replace(/[^\d+]/g, '');
  if (!n) return '';
  if (n.startsWith('00')) n = '+' + n.slice(2);
  if (!n.startsWith('+')) n = '+39' + n;
  return n;
}

export function testoRichiesta({ impresa, titolare, argomento }) {
  const presentazione = titolare
    ? `sono ${titolare}${impresa ? ` dell'impresa ${impresa}` : ''}.`
    : impresa
      ? `scrivo per l'impresa ${impresa}.`
      : 'scrivo per la sicurezza sul lavoro.';
  return `Buongiorno, ${presentazione} Ho bisogno di aiuto per: ${argomento || 'la sicurezza sul lavoro'}. Potete ricontattarmi? Grazie.`;
}

/** I link da mostrare, solo per i recapiti presenti. */
export function linkAiuto({ contatto, impresa, titolare, argomento }) {
  const c = contatto || {};
  const testo = testoRichiesta({ impresa, titolare, argomento });
  const tel = numeroInternazionale(c.telefono);
  const wa = numeroInternazionale(c.whatsapp || c.telefono);
  const link = {};
  if (tel) link.telefono = `tel:${tel}`;
  if (wa) link.whatsapp = `https://wa.me/${wa.replace('+', '')}?text=${encodeURIComponent(testo)}`;
  if (c.email) {
    link.email = `mailto:${encodeURIComponent(c.email.trim())}?subject=${encodeURIComponent(`Richiesta di aiuto: ${argomento || 'sicurezza sul lavoro'}`)}&body=${encodeURIComponent(testo)}`;
  }
  return link;
}
