// Regole di sicurezza essenziali tradotte per i lavoratori stranieri. Modulo puro.
// Testi brevi e pratici: le informative con valore legale restano in italiano.
// Traduzioni da far rileggere da un madrelingua prima dell'uso.

export const LINGUE = {
  it: { nome: 'Italiano', dir: 'ltr' },
  en: { nome: 'English', dir: 'ltr' },
  ro: { nome: 'Română', dir: 'ltr' },
  sq: { nome: 'Shqip', dir: 'ltr' },
  uk: { nome: 'Українська', dir: 'ltr' },
  ar: { nome: 'العربية', dir: 'rtl' }
};

export const TESTI = {
  it: {
    titolo: 'Regole di sicurezza sul lavoro',
    regole: [
      'Usa sempre i dispositivi di protezione (DPI) che ti sono stati consegnati e tienili in buono stato.',
      'Usa solo le macchine e le attrezzature per cui sei stato formato e autorizzato.',
      'Non togliere e non modificare le protezioni delle macchine.',
      'Segui le istruzioni del datore di lavoro e del preposto.',
      'Segnala subito guasti, pericoli e le volte in cui hai rischiato di farti male.',
      "Non lavorare sotto l'effetto di alcol o droghe.",
      'Tieni in ordine il posto di lavoro e libere le vie di uscita.',
      'Se ti fai male, anche poco, avvisa subito.'
    ],
    emergenza: 'In caso di emergenza',
    chiama: 'Chiama il numero unico di emergenza 112.',
    soccorso: 'Addetti al primo soccorso',
    incendio: 'Addetti antincendio',
    allarme: "Se senti l'allarme, esci con calma dalla via di uscita più vicina e vai al punto di raccolta. Non tornare indietro a prendere le tue cose.",
    ricevuta: 'Ho ricevuto e compreso queste regole.'
  },
  en: {
    titolo: 'Workplace safety rules',
    regole: [
      'Always use the personal protective equipment (PPE) you have been given and keep it in good condition.',
      'Only use the machines and equipment you have been trained and authorised to use.',
      'Do not remove or change the safety guards on machines.',
      'Follow the instructions of your employer and your supervisor.',
      'Report breakdowns, hazards and near misses immediately.',
      'Do not work under the influence of alcohol or drugs.',
      'Keep your workplace tidy and the exits clear.',
      'If you get hurt, even slightly, tell someone immediately.'
    ],
    emergenza: 'In an emergency',
    chiama: 'Call the emergency number 112.',
    soccorso: 'First aid officers',
    incendio: 'Fire officers',
    allarme: 'If you hear the alarm, calmly leave by the nearest exit and go to the assembly point. Do not go back for your belongings.',
    ricevuta: 'I have received and understood these rules.'
  },
  ro: {
    titolo: 'Reguli de securitate la locul de muncă',
    regole: [
      'Folosește întotdeauna echipamentul individual de protecție (EIP) primit și păstrează-l în stare bună.',
      'Folosește doar mașinile și echipamentele pentru care ai fost instruit și autorizat.',
      'Nu îndepărta și nu modifica dispozitivele de protecție ale mașinilor.',
      'Respectă instrucțiunile angajatorului și ale șefului de echipă.',
      'Anunță imediat defecțiunile, pericolele și situațiile în care era să te accidentezi.',
      'Nu lucra sub influența alcoolului sau a drogurilor.',
      'Păstrează ordinea la locul de muncă și căile de ieșire libere.',
      'Dacă te rănești, chiar și ușor, anunță imediat.'
    ],
    emergenza: 'În caz de urgență',
    chiama: 'Sună la numărul unic de urgență 112.',
    soccorso: 'Responsabili de prim ajutor',
    incendio: 'Responsabili de stingerea incendiilor',
    allarme: 'Dacă auzi alarma, ieși calm pe cea mai apropiată cale de ieșire și mergi la punctul de adunare. Nu te întoarce după lucrurile tale.',
    ricevuta: 'Am primit și am înțeles aceste reguli.'
  },
  sq: {
    titolo: 'Rregullat e sigurisë në punë',
    regole: [
      'Përdor gjithmonë pajisjet mbrojtëse personale që të janë dhënë dhe mbaji në gjendje të mirë.',
      'Përdor vetëm makineritë dhe pajisjet për të cilat je trajnuar dhe autorizuar.',
      'Mos i hiq dhe mos i ndrysho mbrojtjet e makinerive.',
      'Ndiq udhëzimet e punëdhënësit dhe të përgjegjësit.',
      'Njofto menjëherë defektet, rreziqet dhe rastet kur gati u lëndove.',
      'Mos puno nën ndikimin e alkoolit ose të drogës.',
      'Mbaje vendin e punës të rregullt dhe daljet të lira.',
      'Nëse lëndohesh, edhe pak, njofto menjëherë.'
    ],
    emergenza: 'Në rast emergjence',
    chiama: 'Telefono numrin e emergjencës 112.',
    soccorso: 'Përgjegjësit e ndihmës së parë',
    incendio: 'Përgjegjësit kundër zjarrit',
    allarme: 'Nëse dëgjon alarmin, dil me qetësi nga dalja më e afërt dhe shko te pika e grumbullimit. Mos u kthe për sendet e tua.',
    ricevuta: 'I kam marrë dhe i kam kuptuar këto rregulla.'
  },
  uk: {
    titolo: 'Правила безпеки на роботі',
    regole: [
      'Завжди використовуй видані тобі засоби індивідуального захисту і тримай їх у справному стані.',
      'Користуйся лише тими машинами та обладнанням, для роботи з якими тебе навчили й допустили.',
      'Не знімай і не змінюй захисні пристрої машин.',
      'Виконуй вказівки роботодавця та керівника робіт.',
      'Негайно повідомляй про несправності, небезпеки та випадки, коли ти міг травмуватися.',
      'Не працюй у стані алкогольного чи наркотичного сп’яніння.',
      'Підтримуй порядок на робочому місці та тримай виходи вільними.',
      'Якщо ти травмувався, навіть легко, негайно повідом.'
    ],
    emergenza: 'У разі надзвичайної ситуації',
    chiama: 'Телефонуй на єдиний номер екстреної допомоги 112.',
    soccorso: 'Відповідальні за першу допомогу',
    incendio: 'Відповідальні за пожежну безпеку',
    allarme: 'Якщо почуєш сигнал тривоги, спокійно вийди через найближчий вихід і йди до місця збору. Не повертайся за своїми речами.',
    ricevuta: 'Я отримав(-ла) і зрозумів(-ла) ці правила.'
  },
  ar: {
    titolo: 'قواعد السلامة في العمل',
    regole: [
      'استخدم دائمًا معدات الحماية الشخصية التي سُلّمت إليك وحافظ عليها في حالة جيدة.',
      'لا تستخدم إلا الآلات والمعدات التي تدرّبت عليها وأُذن لك باستخدامها.',
      'لا تُزِل أدوات الحماية في الآلات ولا تُعدّلها.',
      'اتبع تعليمات صاحب العمل والمشرف.',
      'أبلغ فورًا عن الأعطال والمخاطر والمواقف التي كدت تُصاب فيها.',
      'لا تعمل تحت تأثير الكحول أو المخدرات.',
      'حافظ على نظافة مكان العمل وترتيبه وأبقِ مخارج الطوارئ خالية.',
      'إذا تعرّضت لإصابة، ولو بسيطة، أبلغ فورًا.'
    ],
    emergenza: 'في حالة الطوارئ',
    chiama: 'اتصل برقم الطوارئ الموحّد 112.',
    soccorso: 'المكلّفون بالإسعافات الأولية',
    incendio: 'المكلّفون بمكافحة الحرائق',
    allarme: 'إذا سمعت جرس الإنذار، اخرج بهدوء من أقرب مخرج واتجه إلى نقطة التجمع. لا تعد لأخذ أغراضك.',
    ricevuta: 'لقد استلمت هذه القواعد وفهمتها.'
  }
};
