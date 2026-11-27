// Autocontrollo alimentare (HACCP): fasi, limiti e controlli automatici. Modulo puro, testabile con Node.
// I limiti sono quelli di legge dove esistono (Reg. CE 853/2004, D.Lgs. 110/1992) e altrimenti quelli
// tipici dei manuali di corretta prassi: valgono sempre quelli scritti nel piano dell'impresa.

const num = (x) => {
  const t = String(x ?? '').trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Categorie di merci al ricevimento con la temperatura massima (°C). */
export const CATEGORIE_MERCI = [
  { id: 'refrigerati', etichetta: 'Refrigerati (latticini, salumi, gastronomia)', max: 4, rif: 'temperatura indicata in etichetta' },
  { id: 'carni', etichetta: 'Carni fresche di ungulati', max: 7, rif: 'Reg. CE 853/2004 All. III sez. I' },
  { id: 'pollame', etichetta: 'Carni di pollame e coniglio', max: 4, rif: 'Reg. CE 853/2004 All. III sez. II' },
  { id: 'frattaglie', etichetta: 'Frattaglie', max: 3, rif: 'Reg. CE 853/2004 All. III sez. I' },
  { id: 'macinate', etichetta: 'Carni macinate', max: 2, rif: 'Reg. CE 853/2004 All. III sez. V' },
  { id: 'preparazioni_carne', etichetta: 'Preparazioni di carne', max: 4, rif: 'Reg. CE 853/2004 All. III sez. V' },
  { id: 'pesce', etichetta: 'Prodotti della pesca freschi', max: 2, rif: 'Reg. CE 853/2004: temperatura del ghiaccio fondente' },
  { id: 'surgelati', etichetta: 'Surgelati', max: -18, tolleranza: -15, rif: 'D.Lgs. 110/1992: brevi rialzi fino a 3 °C solo nel trasporto' },
  { id: 'congelati', etichetta: 'Congelati', max: -18, tolleranza: -15, rif: 'piano di autocontrollo' },
  { id: 'ambiente', etichetta: 'A temperatura ambiente', max: null, rif: 'integrità, scadenza, etichetta' }
];

/** Esito del controllo della temperatura di una merce in arrivo o in conservazione. */
export function esitoTemperatura(categoria, temperatura) {
  const c = CATEGORIE_MERCI.find((x) => x.id === categoria);
  const t = num(temperatura);
  if (!c) return null;
  if (c.max === null) return { colore: 'verde', testo: 'Controllare integrità delle confezioni, etichetta e scadenza' };
  if (t === null) return null;
  if (t <= c.max) return { colore: 'verde', testo: `Conforme (≤ ${c.max} °C)` };
  if (c.tolleranza !== undefined && t <= c.tolleranza) return { colore: 'giallo', testo: `Tra ${c.max} e ${c.tolleranza} °C: accettabile solo come breve rialzo durante il trasporto, riportare subito a ${c.max} °C` };
  return { colore: 'rosso', testo: `Non conforme (oltre ${c.tolleranza ?? c.max} °C): respingere o isolare il prodotto e registrare la non conformità` };
}

/** Limiti delle fasi di processo controllate con il termometro a sonda. */
export const LIMITI_PROCESSO = {
  cottura: { min: 75, testo: 'almeno +75 °C al cuore del prodotto' },
  mantenimento: { min: 60, testo: 'almeno +60 °C fino al servizio' },
  rigenerazione: { min: 75, testo: 'almeno +75 °C al cuore, una sola volta' },
  abbattimento: { fine: 3, minuti: 90, testo: 'da +70 °C a +3 °C al cuore entro 90 minuti' },
  surgelazione: { fine: -18, minuti: 270, testo: 'da +70 °C a −18 °C al cuore entro 270 minuti' },
  olio: { max: 25, testo: 'composti polari non oltre il 25%' }
};

/** Esito di una registrazione di processo (cottura, mantenimento, abbattimento, olio di frittura). */
export function esitoProcesso(tipo, r = {}) {
  const l = LIMITI_PROCESSO[tipo];
  if (!l) return null;
  if (tipo === 'abbattimento' || tipo === 'surgelazione') {
    const t = num(r.temperatura);
    const m = num(r.minuti);
    if (t === null || m === null) return null;
    if (t <= l.fine && m <= l.minuti) return { colore: 'verde', testo: 'Conforme' };
    return { colore: 'rosso', testo: `Non conforme (${l.testo}): valutare il prodotto, controllare l'abbattitore e il carico` };
  }
  const v = num(r.temperatura ?? r.valore);
  if (v === null) return null;
  if (tipo === 'olio') return v <= l.max ? { colore: 'verde', testo: 'Conforme' } : { colore: 'rosso', testo: 'Olio da sostituire (oltre il 25% di composti polari)' };
  return v >= l.min ? { colore: 'verde', testo: 'Conforme' } : { colore: 'rosso', testo: `Non conforme (${l.testo}): prolungare il trattamento e ripetere la misura` };
}

/**
 * Fasi del processo con pericoli, punti di controllo e limiti (piano di autocontrollo semplificato).
 * ccp: punto critico di controllo con limite misurabile; le altre fasi si gestiscono con le buone prassi.
 */
export const FASI_HACCP = [
  {
    id: 'ricevimento',
    fase: 'Ricevimento delle merci',
    pericolo: 'Merci alterate, a temperatura sbagliata, scadute o con imballi danneggiati; allergeni non dichiarati',
    controllo: 'Fornitori qualificati; controllo di temperatura, etichetta, scadenza e integrità a ogni consegna',
    limite: 'Temperature della tabella del registro ricevimento; nessuna confezione danneggiata o scaduta',
    correttiva: 'Respingere o isolare la merce, avvisare il fornitore, registrare la non conformità',
    registrazione: 'Registro del ricevimento merci',
    ccp: true
  },
  {
    id: 'frigo',
    fase: 'Conservazione in frigorifero',
    pericolo: 'Moltiplicazione di batteri (Listeria, Salmonella) per temperatura troppo alta; contaminazione tra crudo e cotto',
    controllo: 'Lettura giornaliera del termometro; prodotti coperti, etichettati e separati (cotti sopra, crudi sotto)',
    limite: 'Da 0 a +4 °C (carni fino a +7 °C, pesce fresco fino a +2 °C)',
    correttiva: 'Spostare i prodotti, valutarne l\'idoneità, chiamare il frigorista',
    registrazione: 'Registro delle temperature',
    ccp: true
  },
  {
    id: 'congelatore',
    fase: 'Conservazione in congelatore',
    pericolo: 'Scongelamento parziale e ricongelamento',
    controllo: 'Lettura giornaliera del termometro; prodotti chiusi ed etichettati con data di congelamento',
    limite: '−18 °C o meno',
    correttiva: 'Valutare i prodotti (non ricongelare quelli scongelati), riparare l\'apparecchio',
    registrazione: 'Registro delle temperature',
    ccp: true
  },
  {
    id: 'dispensa',
    fase: 'Conservazione a temperatura ambiente',
    pericolo: 'Infestanti, umidità, prodotti scaduti',
    controllo: 'Locale pulito e asciutto, merce sollevata da terra, rotazione «primo che scade, primo che esce»',
    limite: 'Nessun prodotto scaduto o con tracce di infestanti',
    correttiva: 'Eliminare i prodotti, intervento di disinfestazione',
    registrazione: 'Registro pulizie e infestanti',
    ccp: false
  },
  {
    id: 'scongelamento',
    fase: 'Scongelamento',
    pericolo: 'Moltiplicazione di batteri sulla superficie',
    controllo: 'Scongelare in frigorifero o con il programma del forno; mai a temperatura ambiente',
    limite: 'Da 0 a +4 °C; nessun ricongelamento',
    correttiva: 'Eliminare il prodotto scongelato male',
    registrazione: '—',
    ccp: false
  },
  {
    id: 'preparazione',
    fase: 'Preparazione e manipolazione',
    pericolo: 'Contaminazione da mani, superfici e utensili; contaminazione crociata con allergeni',
    controllo: 'Lavaggio delle mani, taglieri e utensili separati, superfici sanificate, tempi brevi fuori dal frigorifero',
    limite: 'Procedure di igiene rispettate',
    correttiva: 'Ripetere la sanificazione, eliminare il prodotto contaminato, richiamare il personale',
    registrazione: 'Registro pulizie',
    ccp: false
  },
  {
    id: 'cottura',
    fase: 'Cottura',
    pericolo: 'Sopravvivenza di batteri patogeni per cottura insufficiente',
    controllo: 'Misura con termometro a sonda al cuore del prodotto',
    limite: LIMITI_PROCESSO.cottura.testo,
    correttiva: 'Prolungare la cottura e ripetere la misura',
    registrazione: 'Registro di cottura e abbattimento',
    ccp: true
  },
  {
    id: 'abbattimento',
    fase: 'Raffreddamento rapido (abbattimento)',
    pericolo: 'Germinazione di spore (Clostridium perfringens, Bacillus cereus) durante un raffreddamento lento',
    controllo: 'Abbattitore; misura della temperatura al cuore e del tempo',
    limite: `${LIMITI_PROCESSO.abbattimento.testo}; per congelare ${LIMITI_PROCESSO.surgelazione.testo}`,
    correttiva: 'Valutare il prodotto, ridurre le porzioni, controllare l\'abbattitore',
    registrazione: 'Registro di cottura e abbattimento',
    ccp: true
  },
  {
    id: 'mantenimento',
    fase: 'Mantenimento a caldo',
    pericolo: 'Moltiplicazione di batteri sotto i +60 °C',
    controllo: 'Bagnomaria o vetrina calda con termometro',
    limite: LIMITI_PROCESSO.mantenimento.testo,
    correttiva: 'Riscaldare a +75 °C o eliminare se è rimasto sotto i +60 °C per più di 2 ore',
    registrazione: 'Registro di cottura e abbattimento',
    ccp: true
  },
  {
    id: 'rigenerazione',
    fase: 'Rigenerazione',
    pericolo: 'Riscaldamento insufficiente di prodotti già cotti',
    controllo: 'Termometro a sonda',
    limite: LIMITI_PROCESSO.rigenerazione.testo,
    correttiva: 'Prolungare il riscaldamento; non rigenerare due volte',
    registrazione: 'Registro di cottura e abbattimento',
    ccp: true
  },
  {
    id: 'frittura',
    fase: 'Frittura',
    pericolo: 'Composti tossici nell\'olio degradato',
    controllo: 'Temperatura dell\'olio sotto il punto di fumo, test dei composti polari, sostituzione programmata',
    limite: LIMITI_PROCESSO.olio.testo,
    correttiva: 'Sostituire l\'olio; smaltire l\'olio esausto con ditta autorizzata',
    registrazione: 'Registro di cottura e abbattimento (oli)',
    ccp: true
  },
  {
    id: 'vendita',
    fase: 'Esposizione, vendita e somministrazione',
    pericolo: 'Temperature non rispettate nei banchi; informazioni sugli allergeni mancanti',
    controllo: 'Termometro dei banchi; cartello o registro degli allergeni; prodotti protetti',
    limite: 'Stesse temperature della conservazione',
    correttiva: 'Ritirare dalla vendita i prodotti non conformi',
    registrazione: 'Registro delle temperature',
    ccp: false
  },
  {
    id: 'trasporto',
    fase: 'Trasporto e consegna',
    pericolo: 'Interruzione della catena del freddo',
    controllo: 'Mezzi o contenitori idonei e puliti, termometro',
    limite: 'Stesse temperature della conservazione',
    correttiva: 'Non consegnare i prodotti non conformi',
    registrazione: 'Registro delle temperature',
    ccp: false
  }
];

/** Prerequisiti (buone prassi igieniche) che il piano deve sempre descrivere. */
export const PREREQUISITI = [
  ['Pulizia e sanificazione', 'Piano con aree, frequenze, prodotti e metodi; registro delle pulizie', 'Reg. CE 852/2004 All. II cap. I e V'],
  ['Lotta agli infestanti', 'Trappole e monitoraggio, ditta specializzata o controlli interni', 'Reg. CE 852/2004 All. II cap. IX p. 4'],
  ['Acqua', 'Acqua potabile dall\'acquedotto o controllata (pozzo); manutenzione di filtri e addolcitori', 'Reg. CE 852/2004 All. II cap. VII; D.Lgs. 18/2023'],
  ['Igiene e formazione del personale', 'Formazione degli addetti, indumenti puliti, gestione delle malattie trasmissibili', 'Reg. CE 852/2004 All. II cap. VIII e XII'],
  ['Fornitori e rintracciabilità', 'Elenco dei fornitori, documenti di acquisto conservati, ritiro e richiamo dei prodotti', 'Reg. CE 178/2002 artt. 18 e 19'],
  ['Materiali a contatto con gli alimenti', 'Contenitori, pellicole e attrezzi idonei, con dichiarazione di conformità del fornitore', 'Reg. CE 1935/2004; Reg. CE 2023/2006'],
  ['Allergeni', 'Elenco degli allergeni per prodotto, separazione, informazione ai clienti', 'Reg. UE 1169/2011; Reg. UE 2021/382'],
  ['Manutenzione', 'Attrezzature e locali in buono stato; taratura dei termometri', 'Reg. CE 852/2004 All. II cap. II e V'],
  ['Rifiuti', 'Contenitori chiusi, allontanamento frequente, oli esausti a ditta autorizzata', 'Reg. CE 852/2004 All. II cap. VI'],
  ['Cultura della sicurezza alimentare', 'Impegno del titolare, ruoli chiari, segnalazione dei problemi da parte del personale', 'Reg. UE 2021/382 (All. II cap. XI-bis)']
];

const PER_ATTIVITA = {
  ristorazione: ['ricevimento', 'frigo', 'congelatore', 'dispensa', 'scongelamento', 'preparazione', 'cottura', 'abbattimento', 'mantenimento', 'rigenerazione', 'frittura', 'vendita'],
  alimentare_produzione: ['ricevimento', 'frigo', 'congelatore', 'dispensa', 'preparazione', 'cottura', 'abbattimento', 'vendita', 'trasporto'],
  trasporto: ['ricevimento', 'frigo', 'congelatore', 'trasporto'],
  commercio_ufficio: ['ricevimento', 'frigo', 'congelatore', 'dispensa', 'vendita']
};

/** Fasi proposte in base all'attività. */
export function fasiPerAttivita(attivita) {
  return PER_ATTIVITA[attivita] || ['ricevimento', 'frigo', 'congelatore', 'dispensa', 'preparazione', 'vendita'];
}
