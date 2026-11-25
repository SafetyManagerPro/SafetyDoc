# safetyDoc e Supabase

safetyDoc usa il progetto Supabase **SafetyManagerPro** (ref `gblcedkfnasqlnrxupzx`, regione eu-west-1, Irlanda),
condiviso con l'app SafetyManagerPro. Tutto ciò che riguarda safetyDoc sta nello **schema separato `safetydoc`**:
le tabelle di SafetyManagerPro (schema `public`) non vengono toccate.

## Fase A – dati di utilizzo anonimi (dalla 0.19.0)

- Si inviano solo se l'utente accetta (riquadro in Oggi, modificabile in Dati → Dati di utilizzo anonimi).
- Si inviano: un codice casuale del dispositivo (`uso:id`, diverso dall'identificativo dei backup), versione,
  tipo di dispositivo, app installata sì/no, divisione ATECO (2 cifre), fascia di lavoratori, eventi
  (`apertura`, `schermata`, `documento`, `promemoria`, `backup`, `ricerca`, `firma`) con il solo nome della schermata
  o del modello di documento. Mai nomi, dati dell'impresa o dei lavoratori, testi o allegati.
- Lo schema `safetydoc` **non è esposto** dalle API. L'app chiama solo due funzioni:
  - `public.safetydoc_registra(dati jsonb)`: scrive (con controlli di formato e limiti: 100 eventi per invio,
    1000 al giorno per dispositivo, date entro 30 giorni) e cancella gli eventi più vecchi di 12 mesi;
  - `public.safetydoc_cancella(id uuid)`: cancella tutti i dati di un dispositivo (diritto alla cancellazione).
- La chiave nell'app è quella pubblica (ruolo `anon`): da sola non permette di leggere nulla.

## Cruscotto per l'amministratore

Dashboard Supabase → **Table Editor** → schema **safetydoc** (oppure SQL Editor):

| Vista | Cosa mostra |
|---|---|
| `cruscotto_riepilogo` | installazioni totali, attive a 7 e 30 giorni, nuove a 30 giorni, app installate, documenti aperti in 30 giorni |
| `cruscotto_versioni` | dispositivi per versione e tipo |
| `cruscotto_settori` | dispositivi per divisione ATECO e fascia di lavoratori |
| `cruscotto_funzioni` | schermate, documenti e funzioni più usati negli ultimi 30 giorni |
| `cruscotto_giorni` | dispositivi attivi ed eventi per giorno (ultimi 90 giorni) |

Esempio: `select * from safetydoc.cruscotto_riepilogo;`

Il modo più comodo: **SQL Editor → PRIVATE → «safetyDoc · cruscotto» → Run**. È la query di `supabase/cruscotto.sql`
(sola lettura), già salvata nel progetto: mostra in un'unica tabella riepilogo, ultimi 14 giorni, funzioni più usate,
versioni e settori.

## Script del database

Ogni modifica al database è in `supabase/migrations/` ed è stata applicata dalla dashboard (SQL Editor) del progetto.

| File | Applicato il | Contenuto |
|---|---|---|
| `20261125160000_safetydoc_utilizzo.sql` | 25/11/2026 | schema `safetydoc`, tabelle `installazioni` ed `eventi_uso`, funzioni `safetydoc_registra` e `safetydoc_cancella`, viste `cruscotto_*` |
| `20261125200000_safetydoc_richieste.sql` | da applicare | richieste e messaggi, funzioni per impresa e amministratore, `safetydoc_verifica` con le risposte da leggere |
| `20261125180000_safetydoc_account.sql` | 25/11/2026 | fase B: `amministratori`, `imprese`, `inviti`, `dispositivi`, `accessi`, funzioni di attivazione, verifica e amministrazione. Provato con un'impresa di prova poi eliminata |

## Fase B – account delle imprese e amministrazione (dalla 0.20.0)

- **Registrazione obbligatoria**: senza un dispositivo attivato l'app mostra solo la schermata «Attiva safetyDoc».
- **Attivazione con link**: l'amministratore crea l'impresa in **#/admin** e manda il link `#/invito/<token>` su
  WhatsApp. L'impresa conferma i dati (ragione sociale, P.IVA, CF, ATECO, comune, provincia, email, cellulare,
  referente) e accetta termini e informativa (**#/termini**). Il dispositivo riceve una chiave segreta; nel database ne
  resta solo l'impronta (sha256). «Crea un nuovo link» rende inutilizzabile il precedente; i dispositivi già attivi restano.
- **Verifica**: a ogni apertura (al massimo ogni 10 minuti) l'app chiama `safetydoc_verifica`. Se impresa o dispositivo
  sono sospesi compare «Accesso sospeso» con il motivo. Senza connessione l'app resta usabile per **24 ore**
  dall'ultima verifica riuscita, poi chiede di collegarsi. I dati dell'impresa restano sempre sul dispositivo.
- **Indirizzi IP: non vengono registrati.** MAC: nessun browser lo rende disponibile.
- **Amministratore**: accesso con email e password dell'account Supabase (tabella `safetydoc.amministratori`,
  oggi albertocentrella.av@gmail.com). La password non viene salvata, solo la sessione sul dispositivo («Esci» la chiude).
  Nella sezione: imprese con dati, stato, dispositivi, ultimo accesso, accessi a 30 giorni, funzioni usate (se c'è il
  consenso); nuova impresa e link WhatsApp, nuovo link, sospendi/riattiva impresa, blocca/sblocca dispositivo,
  note interne, elimina impresa dal server, esportazione CSV. L'amministratore collegato può usare l'app anche senza attivazione.

| Tabella | Contenuto |
|---|---|
| `amministratori` | utenti Supabase autorizzati alla sezione Amministratore |
| `imprese` | dati dell'impresa, stato (invitata/attiva/sospesa), motivo, termini accettati, dispositivi ammessi |
| `inviti` | link di attivazione (uno valido per impresa) |
| `dispositivi` | dispositivo attivato, impronta della chiave, versione, tipo, ultimo accesso, stato |
| `accessi` | data e ora delle verifiche (al massimo una all'ora per dispositivo), conservati 12 mesi |

Funzioni per l'app (chiave pubblica): `safetydoc_invito_info`, `safetydoc_attiva`, `safetydoc_verifica`.
Funzioni per l'amministratore (solo utenti autenticati in `amministratori`): `safetydoc_admin_elenco`,
`safetydoc_admin_salva_impresa`, `safetydoc_admin_nuovo_invito`, `safetydoc_admin_stato_impresa`,
`safetydoc_admin_stato_dispositivo`, `safetydoc_admin_elimina_impresa`.

## Richieste e assistenza (dalla 0.21.0)

- L'impresa scrive da **Dati → Richieste e assistenza** (`#/richieste`): tipo (aiuto, informazione, errore, modifica,
  miglioria), oggetto, testo, pagina da cui scrive. Vede solo le richieste della propria impresa, risponde, chiude o riapre.
  Limiti: 20 richieste e 100 messaggi al giorno per impresa, testo fino a 4000 caratteri, niente allegati.
- L'amministratore le trova in cima a **#/admin** (aperte, da leggere, chiuse) e risponde da `#/admin/richiesta/<id>`,
  scegliendo lo stato; con «Avvisa su WhatsApp» manda all'impresa un messaggio già pronto.
- La verifica giornaliera restituisce `risposte_da_leggere`: in Oggi compare l'avviso delle nuove risposte.

| Tabella | Contenuto |
|---|---|
| `richieste` | numero, impresa, dispositivo, tipo, oggetto, pagina, versione, stato, letta da impresa/amministratore |
| `messaggi` | conversazione di ogni richiesta (autore impresa o admin, testo, data) |

Funzioni per l'app: `safetydoc_richieste_elenco`, `safetydoc_richiesta_nuova`, `safetydoc_richiesta_scrivi`,
`safetydoc_richiesta_letta` (tutte con la chiave del dispositivo). Per l'amministratore: `safetydoc_admin_richieste`,
`safetydoc_admin_richiesta`.

Da completare: titolare del trattamento in `data/legale.json` (compare in termini e informativa).
