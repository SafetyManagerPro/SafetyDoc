# safetyDoc

**Cosa fare, come e quando per la sicurezza della tua impresa.**

safetyDoc è pensato per le piccole imprese di qualsiasi settore che non hanno personale dedicato alla sicurezza e
usano poco il computer. L'utente risponde a poche domande semplici e ottiene il suo piano: ogni voce spiega
cos'è, perché è obbligatoria, come si fa, chi la fa e quando scade, con un semaforo rosso, giallo e verde.

> Versione di prova 0.24.0. I contenuti del catalogo sono una bozza da validare prima dell'uso reale.

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
9. **Documenti** – DVR, POS e DUVRI completi con campi da compilare nell'app (`data/lavorazioni.json`: fasi di cantiere e tipi di appalto), piano di emergenza, valutazione incendio (DM 3/9/2021), valutazioni con calcolo automatico (`js/calcoli.js`): rumore (LEX,8h, picco, ore massime, DPI con metodo SNR UNI 9432), vibrazioni (A(8) con incertezza K e fattore di correzione, assi del corpo intero, ore massime), movimentazione carichi (NIOSH e indice composito), rischio chimico (stima semplificata e algoritmo MoVaRisCh), rischio biologico (R = P × gruppo e obblighi del Titolo X), microclima (PMV/PPD UNI EN ISO 7730, WBGT UNI EN ISO 7243), illuminazione (UNI EN 12464-1), stress lavoro-correlato (lista di controllo INAIL 2017); i dati di rumore e vibrazioni dei libretti si inseriscono nella scheda di ogni attrezzatura e compilano da soli le valutazioni; autocontrollo alimentare (`js/haccp.js`): piano HACCP semplificato per fasi, registri di temperature, ricevimento merci, cotture e abbattimento, pulizie, infestanti e non conformità con esito automatico, incarico RSPP, richiesta visite al medico, permesso di lavoro a caldo, informazione art. 36, addestramento, elezione RLS, nomine, designazioni, informative (privacy, gravidanza, minori), stress, allergeni, verbali e registri compilati con i dati e stampabili in PDF (`js/modelli.js`).
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
18. **Dati di utilizzo anonimi (con consenso)** – se l'utente accetta, safetyDoc invia ogni giorno dati anonimi
   (codice casuale del dispositivo, versione, tipo di dispositivo, divisione ATECO, fascia di lavoratori, schermate e
   documenti usati) allo schema separato `safetydoc` del progetto Supabase SafetyManagerPro. Mai nomi o dati dell'impresa.
   Si può revocare e cancellare tutto da Dati. Dettagli, cruscotto e script in `docs/supabase.md` e `supabase/migrations/`.
19. **Account delle imprese e sezione Amministratore** – registrazione obbligatoria con link di attivazione mandato
   su WhatsApp, verifica dell'account a ogni apertura (24 ore di tolleranza senza rete), blocco di imprese o dispositivi
   per uso non conforme, sezione #/admin per l'amministratore (imprese, dispositivi, accessi, utilizzo, CSV). Nessun IP
   registrato. Con l'amministratore collegato l'app si apre su Admin e una barra in alto «Home | Admin» fa passare
   in ogni momento all'app come la vedono le imprese e ritorno; l'ultima scelta resta anche dopo la riapertura.
   Dettagli in `docs/supabase.md`.
20. **Richieste e assistenza** – le imprese inviano richieste di aiuto, informazioni, segnalazioni di errori, modifiche e
   migliorie (Dati → Richieste e assistenza); l'amministratore risponde da #/admin e può avvisare su WhatsApp;
   l'impresa vede le risposte in Oggi. Dettagli in `docs/supabase.md`.
21. **Aiuti sullo schermo** – «?» accanto a campi, pulsanti e sezioni (61 punti, testi in `data/guida.json`): un tocco apre
   un post-it con cos'è, perché serve e cosa fare dopo, il link alla pagina giusta, «Chiedi a noi» (apre una richiesta
   già compilata) e la lettura ad alta voce. Le sigle (DVR, RSPP, DUVRI…) si toccano per la spiegazione. Si possono
   nascondere in Dati. L'amministratore vede quali aiuti vengono aperti di più (solo con il consenso ai dati di utilizzo).

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
js/supabase.js        collegamento a Supabase (rpc, accesso amministratore)
js/guida.js           aiuti contestuali «?» e sigle cliccabili (modulo puro, testato)
js/richieste.js       richieste delle imprese: tipi, stati, controlli (modulo puro, testato)
js/account.js         attivazione, verifica giornaliera, blocco, link e CSV (modulo puro, testato)
js/utilizzo.js        dati di utilizzo anonimi con consenso (Supabase)
js/scadenzario.js     scadenze calcolate, promemoria e notifiche (modulo puro, testato)
js/conoscenza.js      indice, ricerca con sinonimi, collegamenti e controlli di coerenza (modulo puro, testato)
js/merge.js           formato di scambio e unione tra postazioni (modulo puro, testato)
js/store.js           salvataggio nel browser (IndexedDB): l'unico file da sostituire per passare a Supabase
js/cifratura.js       cifratura dei backup (AES-GCM, PBKDF2)
js/modelli.js         modelli di documenti stampabili, compresa la bozza di DVR (modulo puro, testato)
js/allegati.js        foto e PDF allegati: riduzione e conversione per il backup
js/date.js            date in formato gg/mm/aaaa e data di oggi in ora locale (modulo puro, testato)
js/calcoli.js         rumore, vibrazioni, NIOSH, MoVaRisCh, biologico, microclima, illuminazione, stress, incendio (modulo puro, testato)
js/haccp.js           fasi HACCP, limiti di temperatura e controlli di processo (modulo puro, testato)
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
