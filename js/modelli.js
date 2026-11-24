// Modelli di documenti compilati con i dati dell'impresa e dei lavoratori.
// Modulo puro: ogni modello restituisce HTML pronto da stampare. Testabile con Node.
// I testi sono bozze da verificare con il consulente prima dell'uso.

import { valuta, nomeCompleto, ESITI_VISITA } from './engine.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Un valore, oppure una riga da compilare a mano. */
const v = (x, larghezza = 18) => (x ? `<strong>${esc(x)}</strong>` : `<span class="vuoto">${'&nbsp;'.repeat(larghezza)}</span>`);

function data(iso) {
  if (!iso) return '';
  const [a, m, g] = iso.slice(0, 10).split('-');
  return `${g}/${m}/${a}`;
}

function intestazione(a) {
  return `<header class="doc__intestazione">
    <p>${v(a.ragioneSociale, 30)}</p>
    <p>Sede: ${v(a.sede, 30)} · P.IVA/C.F.: ${v(a.piva, 16)}</p>
  </header>`;
}

function firme(...chi) {
  return `<div class="doc__firme">${chi
    .map(([ruolo, nome]) => `<div><p>${esc(ruolo)}</p><p class="doc__nome">${nome ? esc(nome) : '&nbsp;'}</p><p class="doc__linea">Firma</p></div>`)
    .join('')}</div>`;
}

function luogoData(a, oggi) {
  return `<p class="doc__luogo">${v(a.comune, 14)}, ${v(data(oggi), 10)}</p>`;
}

const titolare = (a) => a.titolare || '';

// ---------- definizioni ----------

export const MODELLI = [
  {
    id: 'registro-formazione',
    titolo: 'Registro di formazione, visite e scadenze',
    descrizione: 'Riepilogo per ogni lavoratore di corsi, visite mediche e DPI, con le date. Da tenere pronto per i controlli.',
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, oggi, situazioni }) => {
      const righe = (situazioni || [])
        .map(
          (s) => `<tr><th colspan="4">${esc(nomeCompleto(s.lavoratore))}${s.lavoratore.mansione ? ` · ${esc(s.lavoratore.mansione)}` : ''}</th></tr>
          ${s.voci
            .map(
              (x) => `<tr><td>${esc(x.requisito.titolo)}</td><td>${x.registro ? esc(data(x.registro.data)) : '—'}</td><td>${
                x.prossimaScadenza ? esc(data(x.prossimaScadenza)) : '—'
              }</td><td>${esc(x.motivo)}${x.registro?.esito ? ` (${esc(ESITI_VISITA[x.registro.esito] || '')})` : ''}</td></tr>`
            )
            .join('')}`
        )
        .join('');
      return `${intestazione(a)}
        <h1>Registro di formazione, visite e scadenze</h1>
        <p>Situazione al ${esc(data(oggi))}.</p>
        <table class="doc__tabella"><thead><tr><th>Adempimento</th><th>Fatto il</th><th>Scade il</th><th>Stato</th></tr></thead>
        <tbody>${righe || '<tr><td colspan="4">Nessun lavoratore inserito.</td></tr>'}</tbody></table>
        <p class="doc__nota">Per le visite mediche è riportato solo il giudizio di idoneità. La cartella sanitaria è custodita dal medico competente.</p>
        ${firme(['Il datore di lavoro', titolare(a)])}`;
    }
  },
  {
    id: 'dichiarazione-dl-rspp',
    titolo: 'Datore di lavoro che svolge i compiti di RSPP',
    descrizione: 'Dichiarazione con cui il titolare svolge direttamente i compiti del servizio di prevenzione e protezione, con presa visione dell\'RLS.',
    ambito: 'impresa',
    attivaSe: { all: [{ fatto: 'haDipendenti' }, { q: 'dl_rspp', eq: true }] },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Svolgimento diretto dei compiti del servizio di prevenzione e protezione</h1>
      <p class="doc__rif">Art. 34 e Allegato II del D.Lgs. 81/2008</p>
      <p>Il/La sottoscritto/a ${v(titolare(a), 24)}, in qualità di datore di lavoro dell'impresa ${v(a.ragioneSociale, 24)},</p>
      <p class="doc__centro">DICHIARA</p>
      <ul>
        <li>di svolgere direttamente i compiti propri del servizio di prevenzione e protezione dai rischi, rientrando l'impresa nei casi previsti dall'Allegato II del D.Lgs. 81/2008;</li>
        <li>di aver frequentato il corso di formazione previsto per il datore di lavoro che svolge i compiti di RSPP (attestato del ${v('', 10)}, rilasciato da ${v('', 20)});</li>
        <li>di impegnarsi a frequentare gli aggiornamenti periodici previsti.</li>
      </ul>
      <p>La presente è comunicata in via preventiva al Rappresentante dei lavoratori per la sicurezza.</p>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Per presa visione, l\'RLS / RLST', a.rls])}`
  },
  {
    id: 'nomina-rspp-esterno',
    titolo: 'Nomina del Responsabile del servizio di prevenzione e protezione (RSPP)',
    descrizione: 'Lettera di incarico all\'RSPP esterno o interno, con accettazione.',
    ambito: 'impresa',
    attivaSe: { all: [{ fatto: 'haDipendenti' }, { not: { q: 'dl_rspp', eq: true } }] },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Designazione del Responsabile del servizio di prevenzione e protezione</h1>
      <p class="doc__rif">Artt. 17, 31, 32 e 33 del D.Lgs. 81/2008</p>
      <p>Il/La sottoscritto/a ${v(titolare(a), 24)}, datore di lavoro dell'impresa ${v(a.ragioneSociale, 24)},</p>
      <p class="doc__centro">DESIGNA</p>
      <p>${v(a.rspp, 24)} quale Responsabile del servizio di prevenzione e protezione dai rischi (RSPP), avendo verificato il possesso delle capacità e dei requisiti professionali previsti dall'art. 32 del D.Lgs. 81/2008.</p>
      <p>L'RSPP svolge i compiti dell'art. 33: individuazione e valutazione dei rischi, elaborazione delle misure di prevenzione e protezione e delle procedure di sicurezza, proposta dei programmi di informazione e formazione, partecipazione alla riunione periodica.</p>
      <p>Il datore di lavoro si impegna a fornire all'RSPP le informazioni necessarie sull'organizzazione del lavoro, sui processi produttivi e sui lavoratori.</p>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Per accettazione, l\'RSPP', a.rspp])}`
  },
  {
    id: 'nomina-medico',
    titolo: 'Nomina del medico competente',
    descrizione: 'Incarico al medico competente per la sorveglianza sanitaria, con accettazione.',
    ambito: 'impresa',
    attivaSe: { all: [{ fatto: 'haDipendenti' }, { fatto: 'rischiConSorveglianza' }] },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Nomina del medico competente</h1>
      <p class="doc__rif">Artt. 18 c. 1 lett. a), 25, 38, 39 e 41 del D.Lgs. 81/2008</p>
      <p>Il/La sottoscritto/a ${v(titolare(a), 24)}, datore di lavoro dell'impresa ${v(a.ragioneSociale, 24)}, essendo emersi dalla valutazione dei rischi rischi per i quali è prevista la sorveglianza sanitaria,</p>
      <p class="doc__centro">NOMINA</p>
      <p>il/la dott./dott.ssa ${v(a.medico, 24)}, in possesso dei titoli e requisiti dell'art. 38, quale medico competente per l'effettuazione della sorveglianza sanitaria.</p>
      <p>Il medico competente collabora alla valutazione dei rischi, programma ed effettua la sorveglianza sanitaria secondo un protocollo sanitario, istituisce e custodisce sotto la propria responsabilità la cartella sanitaria e di rischio di ogni lavoratore e comunica per iscritto al datore di lavoro e al lavoratore il giudizio di idoneità alla mansione.</p>
      <p>Al datore di lavoro sono comunicati solo i giudizi di idoneità. I dati sanitari restano riservati al medico competente.</p>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Per accettazione, il medico competente', a.medico])}`
  },
  {
    id: 'nomina-preposto',
    titolo: 'Individuazione del preposto',
    descrizione: 'Nomina scritta del preposto con i suoi compiti e l\'impegno a frequentare il corso.',
    ambito: 'lavoratore',
    ruolo: 'preposto',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, lavoratore: l, oggi }) => `${intestazione(a)}
      <h1>Individuazione del preposto</h1>
      <p class="doc__rif">Artt. 2 c. 1 lett. e), 18 c. 1 lett. b-bis), 19 e 37 del D.Lgs. 81/2008</p>
      <p>Il/La sottoscritto/a ${v(titolare(a), 24)}, datore di lavoro dell'impresa ${v(a.ragioneSociale, 24)},</p>
      <p class="doc__centro">INDIVIDUA</p>
      <p>il/la sig./sig.ra ${v(nomeCompleto(l), 24)}, mansione ${v(l?.mansione, 16)}, quale <strong>preposto</strong> per le attività ${v('', 30)}.</p>
      <p>Il preposto, nei limiti dei poteri ricevuti, ha il compito di:</p>
      <ul>
        <li>sorvegliare che i lavoratori rispettino le norme di sicurezza e usino i dispositivi di protezione; in caso di comportamenti non conformi, intervenire per modificarli e, se necessario, interrompere l'attività e informare il datore di lavoro;</li>
        <li>verificare che soltanto i lavoratori adeguatamente istruiti accedano alle zone a rischio grave;</li>
        <li>segnalare subito al datore di lavoro le carenze di mezzi, attrezzature e dispositivi di protezione e ogni situazione di pericolo, e interrompere temporaneamente l'attività in caso di pericolo;</li>
        <li>frequentare il corso di formazione per preposti e i relativi aggiornamenti.</li>
      </ul>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Per accettazione, il preposto', nomeCompleto(l)])}`
  },
  {
    id: 'designazione-addetti',
    titolo: 'Designazione degli addetti al primo soccorso e all\'antincendio',
    descrizione: 'Designazione scritta del lavoratore come addetto alle emergenze.',
    ambito: 'lavoratore',
    ruoli: ['primo_soccorso', 'antincendio'],
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, lavoratore: l, oggi }) => {
      const r = new Set(l?.ruoli || []);
      const box = (x) => (x ? '☒' : '☐');
      return `${intestazione(a)}
      <h1>Designazione dei lavoratori incaricati della gestione delle emergenze</h1>
      <p class="doc__rif">Artt. 18 c. 1 lett. b), 43 e 45 del D.Lgs. 81/2008; DM 388/2003; DM 2 settembre 2021</p>
      <p>Il/La sottoscritto/a ${v(titolare(a), 24)}, datore di lavoro dell'impresa ${v(a.ragioneSociale, 24)},</p>
      <p class="doc__centro">DESIGNA</p>
      <p>il/la sig./sig.ra ${v(nomeCompleto(l), 24)}, mansione ${v(l?.mansione, 16)}, quale:</p>
      <p>${box(r.has('primo_soccorso'))} addetto al primo soccorso<br>${box(r.has('antincendio'))} addetto alla prevenzione incendi, lotta antincendio e gestione delle emergenze</p>
      <p>Il lavoratore riceverà la formazione prevista e i relativi aggiornamenti. Ai sensi dell'art. 43 c. 3 del D.Lgs. 81/2008 il lavoratore non può rifiutare la designazione se non per giustificato motivo.</p>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Il lavoratore, per ricevuta', nomeCompleto(l)])}`;
    }
  },
  {
    id: 'consegna-dpi',
    titolo: 'Verbale di consegna dei DPI',
    descrizione: 'Elenco dei dispositivi di protezione consegnati, con firma del lavoratore.',
    ambito: 'lavoratore',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, lavoratore: l, oggi, registro }) => {
      const elenco = (registro?.dettagli || '')
        .split(/[,;\n]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const righe = (elenco.length ? elenco : ['', '', '', '', ''])
        .map((x) => `<tr><td>${x ? esc(x) : '&nbsp;'}</td><td></td><td>${registro?.data ? esc(data(registro.data)) : ''}</td></tr>`)
        .join('');
      return `${intestazione(a)}
      <h1>Verbale di consegna dei dispositivi di protezione individuale</h1>
      <p class="doc__rif">Artt. 18 c. 1 lett. d), 77 e 78 del D.Lgs. 81/2008</p>
      <p>Lavoratore: ${v(nomeCompleto(l), 24)} · Mansione: ${v(l?.mansione, 16)}</p>
      <table class="doc__tabella"><thead><tr><th>Dispositivo (tipo e modello)</th><th>Quantità</th><th>Data di consegna</th></tr></thead><tbody>${righe}</tbody></table>
      <p>Il lavoratore dichiara di aver ricevuto i dispositivi sopra elencati, di essere stato informato e formato sul loro uso corretto (e, per i DPI di III categoria, addestrato) e si impegna a:</p>
      <ul>
        <li>usarli in modo conforme all'informazione, formazione e addestramento ricevuti;</li>
        <li>averne cura e non apportarvi modifiche;</li>
        <li>segnalare subito al datore di lavoro o al preposto qualsiasi difetto o inconveniente;</li>
        <li>riconsegnarli secondo le procedure aziendali al termine dell'utilizzo.</li>
      </ul>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Il lavoratore', nomeCompleto(l)])}`;
    }
  },
  {
    id: 'informativa-lavoratori',
    titolo: 'Informativa privacy per i lavoratori',
    descrizione: 'Informativa sul trattamento dei dati personali del dipendente (art. 13 GDPR), con ricevuta.',
    ambito: 'lavoratore',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, lavoratore: l, oggi }) => `${intestazione(a)}
      <h1>Informativa sul trattamento dei dati personali dei lavoratori</h1>
      <p class="doc__rif">Art. 13 del Regolamento UE 2016/679 (GDPR)</p>
      <p>Gentile ${v(nomeCompleto(l), 24)},</p>
      <p><strong>Titolare del trattamento</strong> è l'impresa ${v(a.ragioneSociale, 24)}, con sede in ${v(a.sede, 24)}, contattabile a ${v(a.contatto, 20)}.</p>
      <p><strong>Finalità e basi giuridiche.</strong> I suoi dati sono trattati per gestire il rapporto di lavoro (art. 6.1.b GDPR); per adempiere agli obblighi di legge in materia retributiva, fiscale, previdenziale, assicurativa e di salute e sicurezza sul lavoro (art. 6.1.c); per gli obblighi in materia di diritto del lavoro e sicurezza che riguardano categorie particolari di dati, come i giudizi di idoneità alla mansione (art. 9.2.b e 9.2.h).</p>
      <p><strong>Dati trattati.</strong> Dati anagrafici e di contatto, dati del rapporto di lavoro, presenze, retribuzione, formazione ricevuta, dispositivi di protezione consegnati, giudizi di idoneità comunicati dal medico competente. Il datore di lavoro non riceve diagnosi né la cartella sanitaria, custodita dal medico competente.</p>
      <p><strong>Destinatari.</strong> Consulente del lavoro, commercialista, RSPP, medico competente, enti previdenziali e assicurativi, enti pubblici quando previsto dalla legge, fornitori di servizi informatici nominati responsabili del trattamento.</p>
      <p><strong>Conservazione.</strong> Per la durata del rapporto e, dopo la cessazione, per il tempo previsto dalle norme civilistiche, fiscali, previdenziali e di sicurezza sul lavoro.</p>
      <p><strong>Obbligatorietà.</strong> Il conferimento dei dati è necessario per instaurare e gestire il rapporto di lavoro.</p>
      <p><strong>Diritti.</strong> Lei può chiedere accesso, rettifica, cancellazione, limitazione, portabilità dei dati e opporsi al trattamento nei casi previsti (artt. 15-22 GDPR), scrivendo al titolare. Ha diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>
      ${luogoData(a, oggi)}
      ${firme(['Il titolare del trattamento', titolare(a)], ['Il lavoratore, per ricevuta', nomeCompleto(l)])}`
  },
  {
    id: 'autorizzazione-trattamento',
    titolo: 'Autorizzazione al trattamento dei dati',
    descrizione: 'Autorizzazione scritta per il lavoratore che usa dati personali di colleghi o clienti, con le istruzioni.',
    ambito: 'lavoratore',
    ruolo: 'tratta_dati',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, lavoratore: l, oggi }) => `${intestazione(a)}
      <h1>Autorizzazione al trattamento dei dati personali</h1>
      <p class="doc__rif">Art. 29 del Regolamento UE 2016/679; art. 2-quaterdecies del D.Lgs. 196/2003</p>
      <p>L'impresa ${v(a.ragioneSociale, 24)}, titolare del trattamento, autorizza il/la sig./sig.ra ${v(nomeCompleto(l), 24)} a trattare i dati personali necessari per le seguenti attività: ${v('', 40)}.</p>
      <p>Istruzioni da rispettare:</p>
      <ul>
        <li>trattare solo i dati necessari alle attività assegnate e per le sole finalità indicate;</li>
        <li>non comunicare i dati a persone non autorizzate e non diffonderli;</li>
        <li>custodire i documenti cartacei in armadi chiusi e non lasciarli incustoditi;</li>
        <li>proteggere computer e telefono con password personali e bloccarli quando ci si allontana;</li>
        <li>segnalare subito al titolare perdite di dati, furti di dispositivi, email inviate per errore o accessi sospetti;</li>
        <li>mantenere la riservatezza anche dopo la fine del rapporto di lavoro.</li>
      </ul>
      ${luogoData(a, oggi)}
      ${firme(['Il titolare del trattamento', titolare(a)], ['La persona autorizzata, per accettazione', nomeCompleto(l)])}`
  },
  {
    id: 'verbale-evacuazione',
    titolo: 'Verbale della prova di evacuazione',
    descrizione: 'Da compilare dopo l\'esercitazione annuale prevista dal piano di emergenza.',
    ambito: 'impresa',
    attivaSe: { fatto: 'haDipendenti' },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Verbale della prova di evacuazione</h1>
      <p class="doc__rif">DM 2 settembre 2021</p>
      <table class="doc__tabella doc__tabella--campi"><tbody>
        <tr><th>Data e ora della prova</th><td></td></tr>
        <tr><th>Scenario simulato (es. incendio nel magazzino)</th><td></td></tr>
        <tr><th>Persone presenti / evacuate</th><td></td></tr>
        <tr><th>Tempo per raggiungere il punto di raccolta</th><td></td></tr>
        <tr><th>Addetti alle emergenze intervenuti</th><td></td></tr>
        <tr><th>Problemi riscontrati (uscite bloccate, allarme non udito, ecc.)</th><td></td></tr>
        <tr><th>Azioni da fare e chi le fa</th><td></td></tr>
      </tbody></table>
      ${luogoData(a, oggi)}
      ${firme(['Il datore di lavoro', titolare(a)], ['Un addetto alle emergenze', ''])}`
  },
  {
    id: 'registro-antincendio',
    titolo: 'Registro dei controlli antincendio',
    descrizione: 'Registro di controlli e manutenzioni di estintori, porte, luci di emergenza e uscite.',
    ambito: 'impresa',
    attivaSe: { q: 'sede', eq: true },
    genera: ({ anagrafica: a }) => `${intestazione(a)}
      <h1>Registro dei controlli e delle manutenzioni antincendio</h1>
      <p class="doc__rif">DM 1 settembre 2021</p>
      <table class="doc__tabella"><thead><tr><th>Data</th><th>Cosa è stato controllato</th><th>Esito e interventi</th><th>Ditta o persona</th><th>Firma</th></tr></thead>
      <tbody>${'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>'.repeat(14)}</tbody></table>`
  },
  {
    id: 'verbale-riunione',
    titolo: 'Verbale della riunione periodica',
    descrizione: 'Verbale della riunione annuale obbligatoria sopra i 15 lavoratori.',
    ambito: 'impresa',
    attivaSe: { q: 'numero_lavoratori', gt: 15 },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Verbale della riunione periodica di prevenzione e protezione</h1>
      <p class="doc__rif">Art. 35 del D.Lgs. 81/2008</p>
      <p>In data ${v(data(oggi), 10)} si è svolta la riunione periodica con la partecipazione di: datore di lavoro ${v(titolare(a), 18)}, RSPP ${v(a.rspp, 18)}, medico competente ${v(a.medico, 18)}, RLS ${v(a.rls, 18)}.</p>
      <p>Sono stati esaminati:</p>
      <ol>
        <li>il documento di valutazione dei rischi: ${v('', 40)}</li>
        <li>l'andamento degli infortuni, delle malattie professionali e della sorveglianza sanitaria: ${v('', 40)}</li>
        <li>i criteri di scelta, le caratteristiche tecniche e l'efficacia dei dispositivi di protezione individuale: ${v('', 40)}</li>
        <li>i programmi di informazione e formazione dei dirigenti, dei preposti e dei lavoratori: ${v('', 40)}</li>
      </ol>
      <p>Decisioni e azioni da fare: ${v('', 60)}</p>
      ${firme(['Il datore di lavoro', titolare(a)], ['L\'RSPP', a.rspp], ['Il medico competente', a.medico], ['L\'RLS', a.rls])}`
  },
  {
    id: 'informativa-clienti',
    titolo: 'Informativa privacy per i clienti',
    descrizione: 'Informativa breve da consegnare o esporre per i clienti (art. 13 GDPR).',
    ambito: 'impresa',
    attivaSe: { sempre: true },
    genera: ({ anagrafica: a }) => `${intestazione(a)}
      <h1>Informativa sul trattamento dei dati personali dei clienti</h1>
      <p class="doc__rif">Art. 13 del Regolamento UE 2016/679 (GDPR)</p>
      <p><strong>Titolare del trattamento</strong> è l'impresa ${v(a.ragioneSociale, 24)}, con sede in ${v(a.sede, 24)}, contattabile a ${v(a.contatto, 20)}.</p>
      <p><strong>Perché usiamo i suoi dati.</strong> Per preparare preventivi, eseguire i lavori o i servizi richiesti e gestire i pagamenti (art. 6.1.b GDPR) e per gli obblighi fiscali e contabili (art. 6.1.c).</p>
      <p><strong>A chi li comunichiamo.</strong> Al commercialista, a banche e corrieri quando necessario, ai fornitori di servizi informatici nominati responsabili del trattamento, alle autorità quando lo prevede la legge.</p>
      <p><strong>Per quanto tempo.</strong> Per il tempo necessario al servizio e, per i documenti fiscali, per il periodo previsto dalla legge.</p>
      <p><strong>I suoi diritti.</strong> Può chiedere accesso, rettifica, cancellazione, limitazione e portabilità dei dati e opporsi al trattamento (artt. 15-22 GDPR) scrivendo al titolare, e proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>`
  },
  {
    id: 'nomina-responsabile-esterno',
    titolo: 'Nomina di un responsabile esterno del trattamento',
    descrizione: 'Accordo con chi tratta dati per conto tuo: consulente del lavoro, commercialista, assistenza informatica (art. 28 GDPR).',
    ambito: 'impresa',
    attivaSe: { sempre: true },
    genera: ({ anagrafica: a, oggi }) => `${intestazione(a)}
      <h1>Nomina a responsabile del trattamento dei dati personali</h1>
      <p class="doc__rif">Art. 28 del Regolamento UE 2016/679 (GDPR)</p>
      <p>L'impresa ${v(a.ragioneSociale, 24)}, titolare del trattamento, nomina ${v('', 30)} responsabile del trattamento per il servizio di ${v('', 30)}.</p>
      <p><strong>Dati e persone interessate:</strong> ${v('', 40)}</p>
      <p><strong>Durata:</strong> per tutta la durata del servizio.</p>
      <p>Il responsabile si impegna a:</p>
      <ol type="a">
        <li>trattare i dati solo su istruzione documentata del titolare e per le finalità del servizio;</li>
        <li>garantire che le persone autorizzate al trattamento si siano impegnate alla riservatezza;</li>
        <li>adottare misure di sicurezza adeguate ai sensi dell'art. 32 GDPR;</li>
        <li>non ricorrere ad altri responsabili senza autorizzazione scritta del titolare;</li>
        <li>assistere il titolare nel rispondere alle richieste degli interessati e negli obblighi degli artt. 32-36;</li>
        <li>informare il titolare senza ritardo di ogni violazione dei dati personali;</li>
        <li>al termine del servizio, cancellare o restituire i dati, salvo obblighi di legge di conservazione;</li>
        <li>mettere a disposizione le informazioni necessarie a dimostrare il rispetto di questi obblighi e consentire verifiche.</li>
      </ol>
      ${luogoData(a, oggi)}
      ${firme(['Il titolare del trattamento', titolare(a)], ['Il responsabile, per accettazione', ''])}`
  }
];

/** I modelli utili a questa impresa. Per quelli "lavoratore" indica anche per chi servono. */
export function modelliDisponibili(ctx) {
  return MODELLI.filter((m) => valuta(m.attivaSe, ctx));
}

/** Il modello serve per questo lavoratore? (ruolo richiesto, se c'è) */
export function modelloPerLavoratore(modello, lavoratore) {
  const ruoli = modello.ruoli || (modello.ruolo ? [modello.ruolo] : null);
  if (!ruoli) return true;
  return (lavoratore.ruoli || []).some((r) => ruoli.includes(r));
}

export function generaDocumento(id, dati) {
  const m = MODELLI.find((x) => x.id === id);
  if (!m) throw new Error(`Modello sconosciuto: ${id}`);
  return { modello: m, html: m.genera({ anagrafica: {}, ...dati, anagrafica: dati.anagrafica || {} }) };
}
