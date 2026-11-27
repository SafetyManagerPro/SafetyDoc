// Riconoscimento di sistema operativo, tipo di dispositivo e formato dello schermo, per adattare
// impaginazione, comandi e istruzioni. Modulo puro (i dati del browser si passano come argomenti), testabile con Node.

/**
 * Sistema operativo. iPadOS si presenta come un Mac: lo riconosce il touch screen (maxTouchPoints > 1).
 * Restituisce 'ios' | 'ipados' | 'android' | 'windows' | 'macos' | 'chromeos' | 'linux' | 'altro'.
 */
export function sistemaOperativo({ ua = '', platform = '', maxTouchPoints = 0 } = {}) {
  if (/android/i.test(ua)) return 'android';
  if (/ipad/i.test(ua)) return 'ipados';
  if (/iphone|ipod/i.test(ua)) return 'ios';
  if (/macintosh|mac os x/i.test(ua) || /^mac/i.test(platform)) return maxTouchPoints > 1 ? 'ipados' : 'macos';
  if (/windows/i.test(ua) || /^win/i.test(platform)) return 'windows';
  if (/cros/i.test(ua)) return 'chromeos';
  if (/linux/i.test(ua)) return 'linux';
  return 'altro';
}

/** Browser: 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'opera' | 'altro'. */
export function browser(ua = '') {
  if (/samsungbrowser/i.test(ua)) return 'samsung';
  if (/edg(e|a|ios)?\//i.test(ua)) return 'edge';
  if (/opr\/|opera/i.test(ua)) return 'opera';
  if (/firefox|fxios/i.test(ua)) return 'firefox';
  if (/chrome|crios|chromium/i.test(ua)) return 'chrome';
  if (/safari/i.test(ua)) return 'safari';
  return 'altro';
}

/** Soglie in pixel CSS, uguali a quelle del foglio di stile. */
export const SOGLIE = { tablet: 600, notebook: 1000, desktop: 1400, bassoOrizzontale: 520 };

/**
 * Tipo di apparecchio: 'smartphone' | 'tablet' | 'pc'.
 * Conta il sistema e il lato corto dello schermo (un telefono in orizzontale resta un telefono).
 */
export function tipoDispositivo({ os, latoCorto = 0, touch = false }) {
  if (os === 'ios') return 'smartphone';
  if (os === 'ipados') return 'tablet';
  if (os === 'android') return latoCorto >= SOGLIE.tablet ? 'tablet' : 'smartphone';
  if (touch && latoCorto && latoCorto < SOGLIE.tablet) return 'smartphone';
  return 'pc';
}

/**
 * Formato dell'impaginazione per la finestra attuale:
 * 'telefono' | 'telefono-orizzontale' | 'tablet' | 'notebook' | 'desktop'.
 */
export function formato({ larghezza = 0, altezza = 0 }) {
  if (larghezza > altezza && altezza <= SOGLIE.bassoOrizzontale && larghezza < 1100) return 'telefono-orizzontale';
  if (larghezza < SOGLIE.tablet) return 'telefono';
  if (larghezza < SOGLIE.notebook) return 'tablet';
  if (larghezza < SOGLIE.desktop) return 'notebook';
  return 'desktop';
}

/** Tutte le informazioni insieme, da mettere come attributi su <html>. */
export function descriviDispositivo({ ua = '', platform = '', maxTouchPoints = 0, larghezza = 0, altezza = 0, schermoL = 0, schermoA = 0, puntatoreGrossolano = false, installata = false } = {}) {
  const os = sistemaOperativo({ ua, platform, maxTouchPoints });
  const touch = puntatoreGrossolano || maxTouchPoints > 0;
  const latoCorto = Math.min(schermoL || larghezza, schermoA || altezza);
  return {
    os,
    browser: browser(ua),
    dispositivo: tipoDispositivo({ os, latoCorto, touch }),
    formato: formato({ larghezza, altezza }),
    input: puntatoreGrossolano ? 'touch' : 'mouse',
    installata: Boolean(installata)
  };
}

/** Il sistema usa il tasto ⌘ (Mac, iPad con tastiera) invece di Ctrl? */
export const usaCmd = (os) => os === 'macos' || os === 'ipados' || os === 'ios';

/** Etichetta di una scorciatoia da tastiera per il sistema: «⌘K» o «Ctrl+K». */
export const scorciatoia = (os, tasto) => (usaCmd(os) ? `⌘${tasto}` : `Ctrl+${tasto}`);

/** La tastiera sullo schermo è aperta? (l'area visibile si riduce molto rispetto alla finestra) */
export const tastieraAperta = ({ altezzaFinestra = 0, altezzaVisibile = 0, touch = false }) => touch && altezzaFinestra - altezzaVisibile > 150;

/**
 * Istruzioni per installare safetyDoc come app, secondo sistema e browser.
 * Restituisce { titolo, passi[] } oppure { titolo, nota } quando il browser non lo permette.
 */
export function istruzioniInstallazione(os, br) {
  if (os === 'ios' || os === 'ipados') {
    const dove = os === 'ios' ? 'iPhone' : 'iPad';
    if (br === 'safari' || br === 'chrome' || br === 'edge')
      return {
        titolo: `Su ${dove}, con ${br === 'safari' ? 'Safari' : br === 'chrome' ? 'Chrome' : 'Edge'}`,
        passi: [
          `Tocca il pulsante <strong>Condividi</strong> (il quadrato con la freccia in su${br === 'safari' ? ', in basso o in alto a destra' : ', nella barra dell\'indirizzo'}).`,
          'Scorri e tocca <strong>Aggiungi alla schermata Home</strong>.',
          'Lascia attiva l\'opzione <strong>Apri come app web</strong>, se c\'è, e tocca <strong>Aggiungi</strong>.'
        ]
      };
    return { titolo: `Su ${dove}`, nota: 'Apri safetyDoc con Safari: da questo browser non si può aggiungere alla schermata Home.' };
  }
  if (os === 'android') {
    if (br === 'samsung')
      return { titolo: 'Su Android, con Samsung Internet', passi: ['Tocca il menu <strong>≡</strong> in basso a destra.', 'Tocca <strong>Aggiungi pagina a</strong> e poi <strong>Schermata Home</strong>.', 'Conferma con <strong>Aggiungi</strong>.'] };
    if (br === 'firefox') return { titolo: 'Su Android, con Firefox', passi: ['Tocca il menu <strong>⋮</strong>.', 'Tocca <strong>Installa</strong> o <strong>Aggiungi a schermata principale</strong>.'] };
    return { titolo: 'Su Android', passi: ['Tocca il menu <strong>⋮</strong> in alto a destra.', 'Tocca <strong>Installa app</strong> (o <strong>Aggiungi a schermata Home</strong>).', 'Conferma con <strong>Installa</strong>: l\'icona compare tra le app.'] };
  }
  if (os === 'macos' && br === 'safari')
    return { titolo: 'Su Mac, con Safari', passi: ['Nel menu <strong>File</strong> scegli <strong>Aggiungi al Dock</strong>.', 'Conferma con <strong>Aggiungi</strong>: safetyDoc si apre dal Dock e dal Launchpad.'] };
  if (br === 'firefox')
    return { titolo: 'Con Firefox sul computer', nota: 'Firefox per computer non installa le app web: apri safetyDoc con Chrome o Edge per installarlo, oppure aggiungilo ai preferiti.' };
  if (br === 'chrome' || br === 'edge' || br === 'opera') {
    const nome = { chrome: 'Chrome', edge: 'Edge', opera: 'Opera' }[br];
    const sistema = { windows: 'Windows', macos: 'Mac', linux: 'Linux', chromeos: 'Chromebook' }[os] || 'computer';
    return {
      titolo: `Su ${sistema}, con ${nome}`,
      passi: [
        'Clicca l\'icona di installazione (un monitor con la freccia) a destra nella barra dell\'indirizzo.',
        br === 'edge' ? 'Oppure apri il menu <strong>…</strong> › <strong>App</strong> › <strong>Installa questo sito come app</strong>.' : 'Oppure apri il menu <strong>⋮</strong> › <strong>Trasmetti, salva e condividi</strong> › <strong>Installa pagina come app</strong>.',
        os === 'windows' ? 'safetyDoc compare nel menu Start e si può aggiungere alla barra delle applicazioni.' : 'safetyDoc compare tra le applicazioni del computer.'
      ]
    };
  }
  return { titolo: 'Sul tuo dispositivo', passi: ['Apri il menu del browser e scegli <strong>Installa app</strong> o <strong>Aggiungi a schermata Home</strong>.'] };
}

/** Nome leggibile del dispositivo, per la pagina dei dati: «iPhone», «tablet Android», «computer Windows»… */
export function nomeDispositivo({ os, dispositivo }) {
  if (os === 'ios') return 'iPhone';
  if (os === 'ipados') return 'iPad';
  if (os === 'android') return dispositivo === 'tablet' ? 'tablet Android' : 'smartphone Android';
  const sistema = { windows: 'Windows', macos: 'Mac', linux: 'Linux', chromeos: 'Chromebook' }[os];
  if (dispositivo === 'smartphone') return 'smartphone';
  if (dispositivo === 'tablet') return 'tablet';
  return sistema ? (os === 'macos' ? 'Mac' : os === 'chromeos' ? 'Chromebook' : `computer ${sistema}`) : 'computer';
}
