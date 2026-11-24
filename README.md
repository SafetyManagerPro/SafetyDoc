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
7. **Allegati** – foto e PDF di attestati, verbali e libretti, collegati a ogni voce; le foto vengono rimpicciolite
   (`js/allegati.js`).
8. **Documenti** – nomine, designazioni, verbale DPI, informative privacy, verbali e registri compilati con i dati e stampabili in PDF (`js/modelli.js`).
9. **Controllo veloce** – subito dopo il questionario chiede, voce per voce, «Hai già fatto…?» con una data
   indicativa: chi è già in regola non parte con tutto rosso.
10. **Chiedi aiuto** – il recapito del consulente o dell'associazione; da ogni voce si chiama o si scrive (telefono,
   WhatsApp, email) con un messaggio già pronto che non contiene dati dei lavoratori (`js/aiuto.js`).
11. **Stato della sicurezza** – riepilogo stampabile di adempimenti, lavoratori e macchine con date e allegati.
12. **Accesso e assistenza** – si entra con l'account (lo stesso dell'app DVR, sullo stesso progetto Supabase) e si
   fanno domande all'assistenza CNA con i ticket; gli amministratori del DVR rispondono (`js/cloud.js`, `js/accesso.js`,
   `supabase/migrations/`).
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
js/cloud.js           accesso e ticket sul servizio online (chiamate dirette a Supabase)
js/accesso.js         regole di accesso e contesto dei ticket (modulo puro, testato)
js/config.js          indirizzo e chiave pubblica di Supabase
supabase/migrations/  modifiche al database, in ordine
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

## Servizio online (Supabase)

Progetto condiviso con l'app DVR; le tabelle di safetyDoc hanno il prefisso `sd_`. Le modifiche al database sono
registrate in `supabase/migrations/` e vanno applicate **prima** di pubblicare la versione che le usa.

- `sd_user_profiles`, `sd_user_devices`: account e dispositivi autorizzati (2 per account di partenza). Un account
  bloccato nell'app DVR è bloccato anche qui.
- `sd_tickets`, `sd_ticket_messaggi`: domande delle imprese e risposte. Ogni impresa vede solo le sue; gli operatori
  sono gli amministratori dell'app DVR (`dvr_admin_users`).
- Gli account si creano dal pannello di Supabase (Authentication → Add user / Invite): l'app non ha la registrazione libera.
- Senza connessione l'app resta utilizzabile per 30 giorni dall'ultimo accesso verificato.

## Privacy

I dati dell'impresa (adempimenti, lavoratori, macchine, allegati) restano sul dispositivo: nessun server li riceve.
Online vanno solo email dell'account, dispositivi autorizzati e i ticket (nome dell'impresa, telefono facoltativo,
domanda e contesto: ATECO, numero di lavoratori, voce del piano). L'app chiede di non scrivere nei ticket nomi dei
lavoratori o dati sanitari. safetyDoc non tratta dati
clinici: per le visite mediche registra solo date e scadenze. La cartella sanitaria resta al medico competente.
