# Formato dei dati di safetyDoc

## Regole di attivazione

Ogni scheda del catalogo ha un campo `attivaSe`; ogni domanda può avere `mostraSe`. Le forme ammesse sono:

| Forma | Significato |
| --- | --- |
| `{"sempre": true}` | sempre vera |
| `{"q": "cantiere", "eq": true}` | risposta uguale a un valore (anche `ne`, `in`) |
| `{"q": "numero_lavoratori", "gt": 15}` | confronto numerico (`gt`, `gte`, `lt`, `lte`) |
| `{"fatto": "haDipendenti"}` | fatto calcolato dalle risposte |
| `{"all": [...]}`, `{"any": [...]}`, `{"not": {...}}` | combinazioni |

Fatti calcolati in `js/engine.js`: `haDipendenti`, `lavoratori`, `classeRischio`, `attivitaRegolamentata`,
`rischiConSorveglianza`. I test controllano che ogni regola citi solo domande e fatti esistenti.

`periodicitaRegole` permette di cambiare la periodicità in base alle risposte, per esempio la verifica della
messa a terra ogni 24 mesi invece di 60 se l'impresa lavora in cantiere.

## Semaforo

| Colore | Quando |
| --- | --- |
| rosso | non ancora fatto, oppure scaduto |
| giallo | scade entro 60 giorni, oppure manca la data di scadenza |
| verde | fatto e in regola |
| info | voce da applicare solo quando capita (`tipoScadenza: "evento"`) |

## Record salvati

Tutti i record hanno questi campi, che rendono possibile l'unione tra postazioni e il passaggio futuro a un database:

| Campo | Contenuto |
| --- | --- |
| `id` | UUID casuale (mai numeri progressivi) |
| `updatedAt` | data e ora ISO dell'ultima modifica |
| `deviceId` | UUID della postazione che ha fatto la modifica |
| `deleted` | `true` invece di cancellare davvero il record |

Collezioni:

- `profilo`: un solo record con id fisso `profilo-impresa`, con le `risposte` al questionario e l'`anagrafica` (ragione sociale, titolare, sede, comune, P.IVA, contatto, RSPP, medico, RLS,
  usata per compilare i documenti) e il `consulente` (nome, telefono, whatsapp, email di chi aiuta l'impresa).
- `adempimenti`: `schedaId`, `fatto`, `dataFatto`, `scadenzaManuale`, `note`. Se più postazioni creano un record per
  la stessa scheda, vale il più recente non cancellato.
- `lavoratori`: `nome`, `cognome`, `mansione`, `dataAssunzione`, `dataCessazione`, `ruoli` (id definiti in
  `data/lavoratori.json`). I cessati restano salvati ma non sono mostrati.
- `registri`: una registrazione per corso, visita o consegna: `lavoratoreId`, `requisitoId`, `data`, `scadenzaManuale`,
  `esito` (solo per la visita: `idoneo`, `idoneo_prescrizioni`, `non_idoneo_temporaneo`, `non_idoneo`), `dettagli`,
  `note`. Per ogni lavoratore e requisito vale la registrazione con la data più recente. Nessun dato clinico.
- `attrezzature`: `tipo` (id definiti in `data/attrezzature.json`), `nome`, `marcaModello`, `matricola`,
  `annoFabbricazione`, `marcaturaCE`, `dismessa`, `pericoli` (id definiti in `data/attrezzature.json`), `dpi`,
  `istruzioni` (istruzioni di sicurezza dal libretto). Se mancano si usano quelli tipici del tipo.
- `controlli`: una registrazione per manutenzione, controllo o verifica: `attrezzaturaId`, `controlloId`, `data`,
  `scadenzaManuale`, `esito` (`positivo`, `con_interventi`, `negativo`), `note`. La periodicità delle verifiche
  dipende da tipo, settore (edilizia, estrazione, siderurgia, porti) ed età della macchina (oltre 10 anni).
- `prodotti`: prodotti chimici: `nome`, `fornitore`, `uso`, `pittogrammi` (codici CLP `GHS01`…`GHS09`), `frasiH`,
  `dpi`, `dataSds`, `dismesso`. Rosso se manca la scheda di sicurezza (né data né allegato); giallo se le frasi H
  indicano cancerogeni, mutageni o tossici per la riproduzione (H340, H350, H360).
- `eventi`: infortuni, medicazioni e quasi incidenti: `tipo` (`infortunio`, `medicazione`, `quasi_incidente`), `data`,
  `luogo`, `lavoratoreId`, `descrizione`, `causa`, `giorniPrognosi`, `dataCertificato`, `dataDenuncia`, `misure`,
  `misureFatte`. Nessuna diagnosi: solo i giorni di prognosi che servono per le scadenze INAIL (oltre 3 giorni
  denuncia, da 1 a 3 comunicazione statistica, entro 2 giorni dal certificato).
- `archivio`: documenti e planimetrie che cambiano nel tempo: `genere` (`certificato` o `planimetria`), `tipo` (id
  definiti in `data/archivio.json`), `titolo`, `area`, `ente`, `numero`, `dataRilascio`, `scadenza`, `lavoratoreId`,
  `attrezzaturaId`, `note`, `sostituisce` e `sostituitoDa` (catena delle versioni: in uso è quella senza
  `sostituitoDa`).
- `adempimenti`: con `storico` (registrazioni precedenti: `dataFatto`, `scadenzaManuale`, `note`, `sostituitoIl`);
  i file allegati hanno `riferitoA` con la data della registrazione a cui appartengono.
- `registri`: anche `ente` e `numeroAttestato` per corsi e attestati.
- `allegati`: foto e PDF collegati a un'altra voce: `collegatoTipo` (`adempimento`, `registro`, `controllo`,
  `attrezzatura`, `prodotto`, `evento`, `documento`), `collegatoId`, `nome`, `tipo` (MIME), `dimensione`, `file` (Blob),
  `categoria` (per le attrezzature `libretto`, `ce`, `pericoli`, `verifica`, `foto`, `altro`; per i prodotti `sds`,
  `etichetta`; per i documenti `planimetria`, `verbale`…), `pagine` (pagine del PDF da stampare, es. «1-4, 12») e
  `inStampa` (se finisce negli allegati dei documenti). I documenti firmati sul telefono sono salvati come HTML
  (`text/html`) con firme e allegati inclusi. Nel file di backup il contenuto diventa `datiBase64`; si può scegliere
  di non includerlo.

## File di backup

```json
{
  "formato": "safetydoc-export",
  "schemaVersion": 5,
  "versioneApp": "0.1.0",
  "esportatoIl": "2026-11-23T18:00:00.000Z",
  "deviceId": "…",
  "collezioni": { "profilo": [], "adempimenti": [], "lavoratori": [], "registri": [], "attrezzature": [], "controlli": [], "prodotti": [], "eventi": [], "archivio": [], "allegati": [] }
}
```

Con password il file diventa `{"formato": "safetydoc-export-cifrato", "salt", "iv", "iterazioni", "dati"}`, cifrato
con AES-GCM a 256 bit e chiave derivata con PBKDF2-SHA256 (310.000 iterazioni).

**Unione all'import:** per ogni `id` vince il record con `updatedAt` più recente; a parità vince il `deviceId`
maggiore, così due postazioni arrivano allo stesso risultato. Le cancellazioni sono record anch'esse, quindi un
file vecchio non fa riapparire dati eliminati. Se `schemaVersion` è più alta di quella supportata, l'import viene
rifiutato; i file più vecchi passano da `migra()` in `js/merge.js` (le collezioni che mancano nei file
delle versioni precedenti vengono create vuote).

## Passaggio a un database

Le collezioni diventano tabelle con le stesse colonne. Basta sostituire `js/store.js` con un'implementazione su
Supabase (eventualmente con sincronizzazione offline); le imprese migrano importando il loro ultimo backup.

## Dati dei documenti

- `data/dvr.json`: per ogni pericolo `danno`, `probabilita` e `magnitudo` tipiche (scala 1-4, da confermare), `dpi`,
  `sorveglianza`, `formazione`, `norma`; in `criteri` le scale e i livelli di rischio R = P × D.
- `data/lavorazioni.json`: `fasiCantiere` (attrezzature, rischi, misure, DPI) per il POS e `tipiAppalto`
  (rischi introdotti, interferenze con P e D, voci di costo) per il DUVRI.
- I campi compilati nei documenti (cantiere, ditta, lavorazioni) si salvano in `meta` con chiave
  `opzioni:<documento>` (più `:<lavoratore>` per i documenti personali).

## Banca della conoscenza (`data/conoscenza.json`)

- `norme`: `{ id, sigla, titolo, alias[], ambito }`. Gli `alias` servono a riconoscere la norma nei testi
  (`riferimento` delle schede, `norma` dei rischi): il confronto ignora punteggiatura e maiuscole e richiede parole intere.
- `glossario`: `{ sigla, testo }` per le sigle e le parole tecniche.
- `sinonimi`: `{ parole[], cerca }` – se la domanda contiene una delle `parole`, la ricerca usa anche i termini di `cerca`.
- `parolePericoli`: collega i rischi scritti a parole (fasi di cantiere, appalti) agli id dei rischi del DVR.
- `pericoliAttrezzature`: collega i pericoli delle attrezzature agli id dei rischi del DVR.
- `documenti`: per ogni modello `{ adempimenti[], rischi[], norme[], consigli[] }`, usati nel pannello «Aiuto e verifiche».

In `data/dvr.json` ogni rischio ha `miglioramenti[]`: misure suggerite nella tabella «Valutazione personalizzata» del DVR,
salvata nelle opzioni del documento (`opzioni:dvr-bozza` → `valutazioni: [{ rischio, p, d, misura, incaricato, entro }]`).
I controlli di coerenza sono calcolati al momento e non vengono salvati.

## Scadenze calcolate

- `data/archivio.json` → `certificati[].durate[]`: `{ id, etichetta, mesi | giorni, norma, obbligo }` (`obbligo`: `legge`,
  `contratto`, `prassi`, `norma tecnica`). Nella voce d'archivio si salvano `durata` (id scelto) e `scadenzaCalcolata`
  (true se la scadenza è quella calcolata e non scritta a mano).
- `data/conoscenza.json` → `documenti[id].revisione`: `{ scheda }` (la data del documento registra l'adempimento della
  scheda), `{ mesi, norma, obbligo, nota }` (revisione propria) oppure `{ evento, norma }` (si aggiorna quando cambia qualcosa).
- La data di un documento con revisione propria è un record di `adempimenti` con `schedaId: "doc:<id del modello>"`:
  entra nel backup e conserva lo `storico` delle date precedenti.
- `profilo.responsabile`: `{ nome, ruolo, email, telefono, giorni, frequenza }` – chi riceve i promemoria, quante scadenze
  includere (entro 30/60/90 giorni) e ogni quanti giorni ricordare l'invio.
- `meta`: le voci `opzioni:*` (dati compilati nei documenti) e `promemoria:inviati` (registro degli invii) entrano nel
  backup nell'elenco `documenti` (dalla 0.18.1) e si uniscono con la data `updatedAt`; restano solo sul dispositivo
  `postazione`, `scadenzario:prossime`
  (scadenze senza nomi per il service worker), `scadenzario:notificate` (chiavi `id|soglia|data` già notificate).

## Dati di utilizzo (solo sul dispositivo)

`meta`: `uso:consenso` (`{ scelta: "si" | "no", data }`), `uso:id` (codice casuale per i dati di utilizzo),
`uso:coda` (eventi non ancora inviati, al massimo 300), `uso:ultimoInvio`. Non entrano nel backup. Vedi `docs/supabase.md`.

## Account (solo sul dispositivo, non nel backup)

`meta`: `account` (`{ dispositivo, chiave, impresa, stato, motivo, verificatoIl, controllatoIl }`) e
`admin:sessione` (`{ accessToken, refreshToken, scade, email, verificatoIl }`). Un backup caricato su un altro
dispositivo richiede una nuova attivazione. Dalla 0.20 `uso:consenso` ha `versione: 2` (dati di utilizzo collegati
all'account): il consenso dato prima viene richiesto di nuovo.

## Aiuti sullo schermo (`data/guida.json`)

Ogni voce: `{ id, rotta, sel, testo?, pos?, titolo, cosa, perche, dopo, link? }`. `rotta` è la prima parte
dell'indirizzo (`oggi`, `dati`, `lavoratore-modifica`…, oppure `documento:<id>` / `documento:*`); `sel` è un selettore
CSS e `testo` l'inizio del testo dell'elemento da cercare; `pos` = `dentro` (predefinito), `dopo` o `primo`.
I «?» si inseriscono da soli dopo ogni schermata; il test e2e controlla che ognuno trovi il suo posto.
`meta.guida:nascosta` (solo sul dispositivo) nasconde gli aiuti. Gli aiuti aperti si contano come eventi di utilizzo
`schermata` con nome `guida:<id>` o `sigla:<sigla>`.
