// Allegati: foto e PDF di attestati, verbali e documenti firmati.
// Le foto vengono rimpicciolite prima di salvarle, così il telefono non si riempie.

export const MAX_LATO_FOTO = 1600;
export const QUALITA_FOTO = 0.8;
export const MAX_BYTE_FILE = 25 * 1024 * 1024; // i libretti in PDF possono essere grandi
export const TIPI_AMMESSI = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

/** Dimensioni finali di una foto, mantenendo le proporzioni. Funzione pura. */
export function dimensioniRidotte(larghezza, altezza, max = MAX_LATO_FOTO) {
  const lato = Math.max(larghezza, altezza);
  if (lato <= max) return { larghezza, altezza };
  const k = max / lato;
  return { larghezza: Math.round(larghezza * k), altezza: Math.round(altezza * k) };
}

export function dimensioneLeggibile(byte) {
  if (!byte && byte !== 0) return '';
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Rimpicciolisce una foto (JPEG). Se non si riesce, restituisce il file com'è. */
export async function preparaFile(file) {
  if (!file) return null;
  const tipo = file.type || '';
  if (!TIPI_AMMESSI.test(tipo)) throw new Error('Si possono allegare solo foto o file PDF.');
  if (tipo.startsWith('image/') && typeof createImageBitmap === 'function') {
    try {
      const img = await createImageBitmap(file);
      const { larghezza, altezza } = dimensioniRidotte(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = larghezza;
      canvas.height = altezza;
      canvas.getContext('2d').drawImage(img, 0, 0, larghezza, altezza);
      const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', QUALITA_FOTO));
      if (blob && blob.size < file.size) {
        const nome = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
        return { nome, tipo: 'image/jpeg', file: blob, dimensione: blob.size };
      }
    } catch {
      /* formato non leggibile dal browser: si salva l'originale */
    }
  }
  if (file.size > MAX_BYTE_FILE) throw new Error(`Il file è troppo grande (${dimensioneLeggibile(file.size)}). Massimo ${dimensioneLeggibile(MAX_BYTE_FILE)}.`);
  return { nome: file.name || 'documento', tipo, file, dimensione: file.size };
}

// ---------- conversione per il backup ----------

export async function blobInBase64(blob) {
  const byte = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64InBlob(b64, tipo) {
  const s = atob(b64);
  const byte = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) byte[i] = s.charCodeAt(i);
  return new Blob([byte], { type: tipo || 'application/octet-stream' });
}

/** Allegato pronto per il file di backup: il contenuto diventa testo base64. */
export async function allegatoPerExport(a) {
  const { file, ...resto } = a;
  if (!file || a.deleted) return resto;
  return { ...resto, datiBase64: await blobInBase64(file) };
}

/** Allegato letto da un backup: il testo base64 torna file. */
export function allegatoDaImport(a) {
  const { datiBase64, ...resto } = a;
  return datiBase64 ? { ...resto, file: base64InBlob(datiBase64, a.tipo) } : resto;
}

// ---------- allegati dentro i documenti stampati ----------

/** Massimo di pagine di un PDF da stampare se l'utente non indica quali. */
export const MAX_PAGINE_PDF = 30;

/**
 * Pagine scelte: "1-3, 7" → [1, 2, 3, 7]. Vuoto → le prime "max" pagine. Funzione pura.
 * Le pagine oltre il totale vengono scartate.
 */
export function paginePdf(testo, totale, max = MAX_PAGINE_PDF) {
  const t = String(testo || '').trim();
  if (!t) return Array.from({ length: Math.min(totale, max) }, (_, i) => i + 1);
  const scelte = new Set();
  for (const parte of t.split(/[,;\s]+/).filter(Boolean)) {
    const m = parte.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const da = Number(m[1]);
    const a = m[2] ? Number(m[2]) : da;
    for (let p = Math.min(da, a); p <= Math.max(da, a) && p <= totale; p++) if (p >= 1) scelte.add(p);
  }
  return [...scelte].sort((x, y) => x - y).slice(0, max * 3);
}

let pdfjs = null;
async function caricaPdfjs() {
  if (!pdfjs) {
    pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  }
  return pdfjs;
}

function blobInDataUrl(blob) {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => ko(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Immagini (data URL) pronte da stampare per un allegato: la foto stessa, oppure le pagine del PDF.
 * Restituisce { immagini, totale, scelte }.
 */
export async function immaginiPerStampa(allegato, { larghezza = 1240 } = {}) {
  if (!allegato?.file) return { immagini: [], totale: 0, scelte: [] };
  if (allegato.tipo?.startsWith('image/')) return { immagini: [await blobInDataUrl(allegato.file)], totale: 1, scelte: [1] };
  if (allegato.tipo !== 'application/pdf') return { immagini: [], totale: 0, scelte: [] };
  const lib = await caricaPdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await allegato.file.arrayBuffer()) }).promise;
  const totale = doc.numPages;
  const scelte = paginePdf(allegato.pagine, totale);
  const immagini = [];
  for (const n of scelte) {
    const pagina = await doc.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: larghezza / base.width });
    const tela = document.createElement('canvas');
    tela.width = Math.round(viewport.width);
    tela.height = Math.round(viewport.height);
    const g = tela.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, tela.width, tela.height);
    await pagina.render({ canvasContext: g, viewport }).promise;
    immagini.push(tela.toDataURL('image/jpeg', 0.82));
    pagina.cleanup();
  }
  await doc.destroy();
  return { immagini, totale, scelte };
}
