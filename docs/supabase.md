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

## Fase B (da fare)

Login, abilitazione degli utenti da parte dell'amministratore, ultimo accesso, ticket di assistenza: tabelle
`safetydoc.utenti`, `safetydoc.imprese`, `safetydoc.accessi`, `safetydoc.ticket`. Prima di aprire le registrazioni
vanno aggiunti gli indirizzi di safetyDoc nelle impostazioni di autenticazione e adattati i testi delle email,
che sono in comune con SafetyManagerPro.
