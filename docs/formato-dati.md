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
  `annoFabbricazione`, `marcaturaCE`, `dismessa`.
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
- `allegati`: foto e PDF collegati a un'altra voce: `collegatoTipo` (`adempimento`, `registro`, `controllo`,
  `attrezzatura`, `prodotto`, `evento`, `documento`). I documenti firmati sul telefono sono salvati come HTML (`text/html`) con le firme incluse e collegati alla registrazione del lavoratore o al documento, `collegatoId`, `nome`, `tipo` (MIME), `dimensione`, `file` (Blob). Nel file di backup il
  contenuto diventa `datiBase64`; si può scegliere di non includerlo.

## File di backup

```json
{
  "formato": "safetydoc-export",
  "schemaVersion": 4,
  "versioneApp": "0.1.0",
  "esportatoIl": "2026-11-23T18:00:00.000Z",
  "deviceId": "…",
  "collezioni": { "profilo": [], "adempimenti": [], "lavoratori": [], "registri": [], "attrezzature": [], "controlli": [], "prodotti": [], "eventi": [], "allegati": [] }
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
