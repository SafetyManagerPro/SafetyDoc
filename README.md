# safetyDoc

**Cosa fare, come e quando per la sicurezza della tua impresa.**

safetyDoc è pensato per le piccole imprese di qualsiasi settore che non hanno personale dedicato alla sicurezza e
usano poco il computer. L'utente risponde a poche domande semplici e ottiene il suo piano: ogni voce spiega
cos'è, perché è obbligatoria, come si fa, chi la fa e quando scade, con un semaforo rosso, giallo e verde.

> Versione di prova 0.9.0. I contenuti del catalogo sono una bozza da validare prima dell'uso reale.

## Come funziona

1. **Questionario** – poche schermate semplici: le domande sì/no simili si spuntano tutte insieme (`data/questionario.json`).
2. **Codice ATECO** – riconosciuto mentre si scrive (ATECO 2025): mostra divisione, settore suggerito e classe di
   rischio con le ore di formazione specifica (`data/ateco.json`).
3. **Catalogo** – le schede degli adempimenti, ognuna con la sua regola di attivazione (`data/catalogo.json`).
4. **Motore** – combina risposte e catalogo e calcola il piano e il semaforo (`js/engine.js`).
5. **Lavoratori** – per ogni persona: formazione, visite mediche (solo il giudizio), DPI, privacy e corsi legati ai ruoli (`data/lavoratori.json`).
6. **Macchine e attrezzature** – manutenzioni e verifiche periodiche (Allegato VII) con periodicità calcolata per tipo,
   settore ed età (`data/attrezzature.json`).
7. **Prodotti chimici e registro eventi** – elenco dei prodotti con schede di sicurezza e frasi H; registro di
   infortuni e quasi incidenti con le scadenze INAIL.
8. **Allegati** – foto e PDF di attestati, verbali e libretti, collegati a ogni voce; le foto vengono rimpicciolite
   (`js/allegati.js`).
9. **Documenti** – nomine, designazioni, DUVRI, POS, informative (privacy, gravidanza, minori), stress, allergeni, verbali e registri compilati con i dati e stampabili in PDF (`js/modelli.js`).
10. **Controllo veloce** – subito dopo il questionario chiede, voce per voce, «Hai già fatto…?» con una data
   indicativa: chi è già in regola non parte con tutto rosso.
11. **Chiedi aiuto** – il recapito del consulente o dell'associazione; da ogni voce si chiama o si scrive (telefono,
   WhatsApp, email) con un messaggio già pronto che non contiene dati dei lavoratori (`js/aiuto.js`).
12. **Stato della sicurezza** – riepilogo stampabile di adempimenti, lavoratori e macchine con date e allegati.
13. **Dati** – salvati solo nel dispositivo; si esportano e importano come file JSON, anche protetto da password
   (`js/store.js`, `js/merge.js`, `js/cifratura.js`).

Per aggiornare la normativa si modifica solo `data/catalogo.json`: l'app non va riscritta.

## Struttura

```
index.html            pagina unica dell'app
manifest.webmanifest  installazione come app (PWA)
sw.js                 funzionamento senza connessione
css/style.css         grafica: telefono prima di tutto, testo grande, tema scuro
js/app.js             schermate e navigazione
js/engine.js          regole, piano, semaforo (modulo puro, testato)
js/merge.js           formato di scambio e unione tra postazioni (modulo puro, testato)
js/store.js           salvataggio nel browser (IndexedDB): l'unico file da sostituire per passare a Supabase
js/cifratura.js       cifratura dei backup (AES-GCM, PBKDF2)
js/modelli.js         modelli di documenti stampabili, compresa la bozza di DVR (modulo puro, testato)
js/allegati.js        foto e PDF allegati: riduzione e conversione per il backup
js/aiuto.js           link per chiedere aiuto al consulente (modulo puro, testato)
js/calendario.js      scadenze esportate nel calendario del telefono (.ics) (modulo puro, testato)
data/                 questionario, catalogo, requisiti dei lavoratori, pericoli del DVR tabella ATECO 2025 e tipi di attrezzature
docs/                 documentazione tecnica
test/                 test con il test runner di Node
```

Nessuna dipendenza e nessun passo di build: i file si pubblicano così come sono.

## Provarlo

```bash
python3 -m http.server 8000     # oppure: npm start
# aprire http://localhost:8000 (il service worker richiede localhost o https)
npm test                        # Node 20 o superiore
```

## Regole per scrivere le schede

- Linguaggio semplice: niente sigle senza spiegazione, frasi brevi, passi numerati.
- Ogni scheda ha `cosaE`, `perche`, `come`, `chi`, `quando`, `riferimento`, `tipoScadenza` e `attivaSe`.
- `tipoScadenza`: `una_tantum`, `periodica` (con `periodicitaMesi`), `manuale` (la scadenza la scrive l'utente) o
  `evento` (da fare quando capita).
- `priorita`: 1 per ciò che protegge direttamente i lavoratori, 3 per gli adempimenti amministrativi.
- Ciò che va ancora controllato sulla norma vigente va in `daVerificare`.

Il formato delle regole e dei dati è descritto in [docs/formato-dati.md](docs/formato-dati.md).

## Privacy

In questa versione i dati restano sul dispositivo dell'impresa: nessun server li riceve. safetyDoc non tratta dati
clinici: per le visite mediche registra solo date e scadenze. La cartella sanitaria resta al medico competente.
