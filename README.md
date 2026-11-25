# safetyDoc

**Cosa fare, come e quando per la sicurezza della tua impresa.**

safetyDoc è pensato per le piccole imprese di qualsiasi settore che non hanno personale dedicato alla sicurezza e
usano poco il computer. L'utente risponde a poche domande semplici e ottiene il suo piano: ogni voce spiega
cos'è, perché è obbligatoria, come si fa, chi la fa e quando scade, con un semaforo rosso, giallo e verde.

> Versione di prova 0.18.1. I contenuti del catalogo sono una bozza da validare prima dell'uso reale.

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
8. **Allegati** – foto e PDF di attestati, verbali e libretti, collegati a ogni voce; le foto vengono rimpicciolite.
   Libretti d'uso e manutenzione, dichiarazioni CE e schede di sicurezza, con le pagine scelte, vengono stampati in
   fondo a DVR, POS e altri documenti con il rimando «All. A1»; le pagine dei PDF sono preparate con pdf.js
   (`js/vendor/pdfjs`, licenza Apache 2.0)
   (`js/allegati.js`).
9. **Documenti** – DVR, POS e DUVRI completi con campi da compilare nell'app (`data/lavorazioni.json`: fasi di cantiere e tipi di appalto), piano di emergenza, valutazione incendio (DM 3/9/2021), valutazioni di rumore, vibrazioni, movimentazione carichi (NIOSH) e rischio chimico con calcolo automatico (`js/calcoli.js`), incarico RSPP, richiesta visite al medico, permesso di lavoro a caldo, informazione art. 36, addestramento, elezione RLS, nomine, designazioni, informative (privacy, gravidanza, minori), stress, allergeni, verbali e registri compilati con i dati e stampabili in PDF (`js/modelli.js`).
10. **Aiuto a fare** – firma sul telefono o sul tablet dei documenti (la copia firmata resta allegata e registra la
   voce del lavoratore) ed esempi tipici di attrezzature, prodotti e mansioni per settore (`data/settori.json`); regole di sicurezza ed
   emergenza in 5 lingue straniere accanto all'italiano (`js/lingue.js`).
11. **Archivio e planimetrie** – certificati, dichiarazioni di conformità, autorizzazioni, contratti, attestati in più
   e documenti delle macchine con scadenza e versioni (la vecchia resta nello storico); planimetrie e layout con
   revisioni, inseriti da soli in DVR, piano di emergenza, valutazione incendio, POS e DUVRI (`data/archivio.json`).
   Gli adempimenti rinnovati conservano lo storico delle date e dei file.
12. **Controllo veloce** – subito dopo il questionario chiede, voce per voce, «Hai già fatto…?» con una data
   indicativa: chi è già in regola non parte con tutto rosso.
13. **Chiedi aiuto** – il recapito del consulente o dell'associazione; da ogni voce si chiama o si scrive (telefono,
   WhatsApp, email) con un messaggio già pronto che non contiene dati dei lavoratori (`js/aiuto.js`).
14. **Stato della sicurezza** – riepilogo stampabile di adempimenti, lavoratori e macchine con date e allegati.
15. **Dati** – salvati solo nel dispositivo; si esportano e importano come file JSON, anche protetto da password
   (`js/store.js`, `js/merge.js`, `js/cifratura.js`).
16. **Cerca e controlli di coerenza** – motore della conoscenza tutto locale, anche senza connessione (`js/conoscenza.js`,
   `data/conoscenza.json`): ricerca con le parole di tutti i giorni (muletto, frullino, eternit…) tra rischi, adempimenti,
   documenti, attrezzature, lavorazioni, corsi, norme e sigle, e nei dati inseriti; schede di approfondimento con i collegamenti;
   controlli che confrontano risposte, lavoratori, macchine, prodotti, archivio e documenti (es. prodotti H350 senza rischio
   cancerogeno, muletto senza operatori abilitati, infortunio dopo il DVR); pannello «Aiuto e verifiche» in ogni documento;
   nel DVR P e D modificabili dopo il sopralluogo e misure di miglioramento con incaricato e scadenza.
17. **Scadenzario e promemoria al responsabile** – tutte le scadenze in un solo elenco (`js/scadenzario.js`):
   adempimenti, lavoratori, macchine, certificati in archivio, revisioni dei documenti e denunce INAIL, ognuna con la norma
   di riferimento e l'indicazione se è obbligo di legge, contratto o buona prassi. La scadenza dei certificati si calcola
   dalla data di rilascio (DPR 462/2001, DPR 151/2011, DM 1/9/2021, DPR 74/2013, DPR 59/2013, DURC 120 giorni, aggiornamenti
   dei corsi…); ogni documento ha la sua data e la prossima revisione (la firma sul telefono la registra da sola).
   Il responsabile (RSPP, consulente o titolare) riceve il promemoria via email, WhatsApp o condivisione e il calendario
   .ics con gli avvisi; ogni invio resta registrato e l'app ricorda quando rimandarlo. Notifiche sul dispositivo a 30 e
   7 giorni e alla scadenza, anche ad app chiusa dove il browser lo permette (Chrome su Android con l'app installata).

Per aggiornare la normativa si modifica solo `data/catalogo.json`: l'app non va riscritta. Quando si aggiungono
schede si alza `versione` e si aggiunge una voce in `novita`: l'impresa vede le schede nuove che la riguardano.
Le domande nuove del questionario vengono chieste da sole a chi aveva già risposto.

## Struttura

```
index.html            pagina unica dell'app
manifest.webmanifest  installazione come app (PWA): icone anche maskable, scorciatoie, schermate di anteprima
sw.js                 funzionamento senza connessione: tutti i file in cache, rete prima con attesa massima di 4 s
icons/, screenshots/  icone (anche per iPhone) e schermate mostrate al momento dell'installazione
css/style.css         grafica: telefono prima di tutto, testo grande, tema scuro
js/app.js             schermate e navigazione
js/engine.js          regole, piano, semaforo (modulo puro, testato)
js/scadenzario.js     scadenze calcolate, promemoria e notifiche (modulo puro, testato)
js/conoscenza.js      indice, ricerca con sinonimi, collegamenti e controlli di coerenza (modulo puro, testato)
js/merge.js           formato di scambio e unione tra postazioni (modulo puro, testato)
js/store.js           salvataggio nel browser (IndexedDB): l'unico file da sostituire per passare a Supabase
js/cifratura.js       cifratura dei backup (AES-GCM, PBKDF2)
js/modelli.js         modelli di documenti stampabili, compresa la bozza di DVR (modulo puro, testato)
js/allegati.js        foto e PDF allegati: riduzione e conversione per il backup
js/date.js            date in formato gg/mm/aaaa e data di oggi in ora locale (modulo puro, testato)
js/calcoli.js         rumore, vibrazioni, NIOSH, rischio chimico, basso rischio incendio (modulo puro, testato)
js/aiuto.js           link per chiedere aiuto al consulente (modulo puro, testato)
js/calendario.js      scadenze esportate nel calendario del telefono (.ics) (modulo puro, testato)
data/                 questionario, catalogo, requisiti dei lavoratori, pericoli del DVR tabella ATECO 2025 e tipi di attrezzature
docs/                 documentazione tecnica
test/                 test con il test runner di Node
```

Nessuna dipendenza e nessun passo di build: i file si pubblicano così come sono.

## App installabile (PWA)

safetyDoc è una Progressive Web App: si apre da https://safetydoc.vercel.app e si installa sul telefono o sul
computer (Android e PC: pulsante «Installa»; iPhone: Condividi → Aggiungi alla schermata Home). Dopo la prima
apertura funziona anche **senza connessione**, compresa la stampa dei libretti PDF. Quando esce una versione nuova
l'app mostra «È pronta una nuova versione» con il pulsante Aggiorna.

Regola per gli sviluppi: ogni file nuovo usato dall'app va aggiunto all'elenco `FILE` di `sw.js` e la versione
della cache va alzata insieme a `VERSIONE_APP`. Il test `test/pwa.test.js` blocca le dimenticanze.

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
