export const locales = ["sk", "en"];

export const dictionaries = {
  sk: {
    locale: "sk",
    nav: {
      features: "Funkcie",
      how: "Ako to funguje",
      demo: "Demo",
      audience: "Pre koho",
      cta: "Vyskúšať",
    },
    hero: {
      badge: "Inteligentné vyhľadávanie pre normy a podporu",
      title: "Odpovede z vašich noriem. Okamžite a overené.",
      subtitle:
        "Contineo je inteligentný helpdesk, ktorý odpovedá na otázky z vašich dokumentov, smerníc a noriem — s presnou citáciou zdroja. A keď nevie, plynule vytvorí ticket.",
      ctaPrimary: "Vyskúšať vyhľadávanie",
      ctaSecondary: "Ako to funguje",
      note: "Vložiteľné do webu aj aplikácií jedným riadkom.",
    },
    logos: "Postavené na MongoDB Atlas · Next.js · Node.js",
    features: {
      eyebrow: "Funkcie",
      title: "Viac než vyhľadávanie. Rozumie obsahu.",
      items: [
        {
          icon: "search",
          title: "Inteligentné vyhľadávanie",
          text: "Sémantické hľadanie naprieč normami a FAQ. Používateľ píše prirodzene, Contineo nájde podstatu.",
        },
        {
          icon: "quote",
          title: "Odpovede s citáciou",
          text: "Každá odpoveď uvádza zdroj, paragraf a verziu dokumentu. Žiadne dohady — len overený obsah.",
        },
        {
          icon: "ticket",
          title: "Plynulá eskalácia",
          text: "Keď Contineo nepozná odpoveď, ponúkne odoslanie otázky ako ticket správcovi.",
        },
        {
          icon: "brain",
          title: "Učí sa z odpovedí",
          text: "Schválené odpovede správcov sa stávajú novou znalosťou. Systém je každým dňom presnejší.",
        },
        {
          icon: "layers",
          title: "Verzie noriem",
          text: "Import novej verzie nestratí starú. Contineo cituje vždy platné znenie.",
        },
        {
          icon: "code",
          title: "Vložiteľné kdekoľvek",
          text: "Widget pridáte do stránky či aplikácie jedným kódom. Vyzerá ako vyhľadávanie, myslí ako asistent.",
        },
      ],
    },
    how: {
      eyebrow: "Ako to funguje",
      title: "Od otázky k overenej odpovedi",
      steps: [
        {
          n: "01",
          title: "Naplníte znalosti",
          text: "Importujete PDF, FAQ alebo sledujete web. Obsah sa rozdelí a označí podľa sekcie a platnosti.",
        },
        {
          n: "02",
          title: "Používateľ sa pýta",
          text: "Položí otázku prirodzeným jazykom priamo vo vašom webe alebo aplikácii.",
        },
        {
          n: "03",
          title: "Contineo odpovie s citáciou",
          text: "Nájde relevantné pasáže a vygeneruje odpoveď len z overených zdrojov — s odkazom na normu a verziu.",
        },
        {
          n: "04",
          title: "Učí sa a eskaluje",
          text: "Pri neúspechu vznikne ticket; odpoveď správcu sa vráti späť ako nová znalosť.",
        },
      ],
    },
    demo: {
      eyebrow: "Živé demo",
      title: "Skúste, ako to vyzerá pre používateľa",
      subtitle:
        "Toto je ukážka inteligentného vyhľadávania s vzorovými dátami. Skúste „prestup termín“, „ISSF heslo“ alebo „dva zápasy za deň“.",
      placeholder: "Opýtaj sa na pravidlá, prestupy, ISSF…",
      brand: "inteligentné vyhľadávanie",
      poweredBy: "Poháňa Contineo · odpovede z overených noriem",
      question: "Otázka",
      helpful: "Pomohla odpoveď?",
      yes: "Áno",
      no: "Nie",
      thanks: "Ďakujeme za spätnú väzbu.",
      sorry: "Mrzí nás to — skúsime to upresniť.",
      related: "Súvisiace otázky",
      noAnswerTitle: "Na túto otázku zatiaľ nemám overenú odpoveď.",
      noAnswerText: "Skúste ju preformulovať alebo otázku pošlite správcovi.",
      escalateTitle: "Nenašli ste odpoveď? Odošlite otázku správcovi ako ticket.",
      sendTicket: "Odoslať ako ticket",
      ticketDone: "Ticket vytvorený. Odpíšeme na e-mail.",
      appliesAll: "platí pre všetkých (SFZ)",
    },
    audience: {
      eyebrow: "Pre koho",
      title: "Pre organizácie, ktoré žijú v normách",
      items: [
        { title: "Zväzy a federácie", text: "Súťažné a prestupové poriadky, rozpisy súťaží pre desiatky oblastí na jednom mieste." },
        { title: "Kluby a členovia", text: "Rýchle odpovede na bežné otázky bez čakania na e-mail správcu." },
        { title: "IT a podpora", text: "Návody k aplikáciám ako ISSF — menej opakovaných ticketov, viac vyriešeného samoobslužne." },
      ],
    },
    cta: {
      title: "Pripravení na inteligentnú podporu?",
      subtitle: "Ukážeme vám Contineo na vašich vlastných dokumentoch.",
      button: "Kontaktujte nás",
      email: "ahoj@contineo.app",
    },
    footer: {
      tagline: "Inteligentný helpdesk, ktorý odpovedá z overených noriem.",
      product: "Produkt",
      company: "Spoločnosť",
      links: {
        features: "Funkcie",
        how: "Ako to funguje",
        demo: "Demo",
        contact: "Kontakt",
        privacy: "Ochrana údajov",
      },
      rights: "Všetky práva vyhradené.",
    },
  },

  en: {
    locale: "en",
    nav: {
      features: "Features",
      how: "How it works",
      demo: "Demo",
      audience: "Who it's for",
      cta: "Try it",
    },
    hero: {
      badge: "Intelligent search for rules and support",
      title: "Answers from your own rules. Instant and verified.",
      subtitle:
        "Contineo is an intelligent helpdesk that answers questions from your documents, guidelines and regulations — with an exact source citation. And when it doesn't know, it seamlessly creates a ticket.",
      ctaPrimary: "Try the search",
      ctaSecondary: "How it works",
      note: "Embeddable into any website or app in one line.",
    },
    logos: "Built on MongoDB Atlas · Next.js · Node.js",
    features: {
      eyebrow: "Features",
      title: "More than search. It understands content.",
      items: [
        {
          icon: "search",
          title: "Intelligent search",
          text: "Semantic search across regulations and FAQs. Users write naturally, Contineo finds the substance.",
        },
        {
          icon: "quote",
          title: "Answers with citations",
          text: "Every answer states the source, article and document version. No guessing — only verified content.",
        },
        {
          icon: "ticket",
          title: "Seamless escalation",
          text: "When Contineo doesn't know the answer, it offers to send the question to an admin as a ticket.",
        },
        {
          icon: "brain",
          title: "Learns from answers",
          text: "Approved admin answers become new knowledge. The system gets more accurate every day.",
        },
        {
          icon: "layers",
          title: "Document versioning",
          text: "Importing a new version never loses the old one. Contineo always cites the valid wording.",
        },
        {
          icon: "code",
          title: "Embeddable anywhere",
          text: "Add the widget to a page or app with one snippet. Looks like search, thinks like an assistant.",
        },
      ],
    },
    how: {
      eyebrow: "How it works",
      title: "From a question to a verified answer",
      steps: [
        {
          n: "01",
          title: "You fill the knowledge",
          text: "Import PDFs, FAQs or watch a website. Content is chunked and tagged by section and validity.",
        },
        {
          n: "02",
          title: "A user asks",
          text: "They ask a question in natural language, right inside your website or app.",
        },
        {
          n: "03",
          title: "Contineo answers with a citation",
          text: "It retrieves the relevant passages and generates an answer only from verified sources — linking the rule and version.",
        },
        {
          n: "04",
          title: "It learns and escalates",
          text: "On failure a ticket is created; the admin's answer flows back as new knowledge.",
        },
      ],
    },
    demo: {
      eyebrow: "Live demo",
      title: "See how it looks for a user",
      subtitle:
        "This is a demo of intelligent search with sample data. Try “transfer deadline”, “ISSF password” or “two matches in a day”.",
      placeholder: "Ask about rules, transfers, ISSF…",
      brand: "intelligent search",
      poweredBy: "Powered by Contineo · answers from verified rules",
      question: "Question",
      helpful: "Was this helpful?",
      yes: "Yes",
      no: "No",
      thanks: "Thanks for the feedback.",
      sorry: "Sorry about that — we'll try to refine it.",
      related: "Related questions",
      noAnswerTitle: "I don't have a verified answer for this yet.",
      noAnswerText: "Try rephrasing it or send the question to an admin.",
      escalateTitle: "Didn't find an answer? Send the question to an admin as a ticket.",
      sendTicket: "Send as ticket",
      ticketDone: "Ticket created. We'll reply by e-mail.",
      appliesAll: "applies to everyone (SFZ)",
    },
    audience: {
      eyebrow: "Who it's for",
      title: "For organisations that live in regulations",
      items: [
        { title: "Associations & federations", text: "Competition and transfer rules, fixtures for dozens of regions in one place." },
        { title: "Clubs & members", text: "Fast answers to common questions without waiting for an admin's e-mail." },
        { title: "IT & support", text: "Guides for apps like ISSF — fewer repeated tickets, more solved self-service." },
      ],
    },
    cta: {
      title: "Ready for intelligent support?",
      subtitle: "We'll show you Contineo on your own documents.",
      button: "Get in touch",
      email: "hello@contineo.app",
    },
    footer: {
      tagline: "An intelligent helpdesk that answers from verified rules.",
      product: "Product",
      company: "Company",
      links: {
        features: "Features",
        how: "How it works",
        demo: "Demo",
        contact: "Contact",
        privacy: "Privacy",
      },
      rights: "All rights reserved.",
    },
  },
};

export function getDictionary(lang) {
  return dictionaries[lang] || dictionaries.sk;
}

export const sampleKB = {
  sk: [
    {
      k: ["dva", "dvoch", "zápas", "stretnut", "deň", "den"],
      q: "Môže hráč nastúpiť v dvoch stretnutiach za jeden deň?",
      a: "Hráč nesmie nastúpiť v dvoch súťažných stretnutiach v jeden deň. Výnimkou sú stretnutia mládeže za podmienok určených riadiacim orgánom súťaže.",
      src: "Súťažný poriadok",
      art: "§ 12 ods. 3",
      ver: "verzia 2026",
      rel: ["Aké sú podmienky pre mládež?", "Čo ak hráč nastúpi neoprávnene?"],
    },
    {
      k: ["prestup", "termín", "termin", "registrač", "obdobie"],
      q: "Dokedy je možné podať prestup hráča?",
      a: "Prestup hráča je možné podať v registračnom období určenom pre danú súťaž. Po termíne sa žiadosť posudzuje ako mimoriadny prestup so súhlasom oboch klubov.",
      src: "Prestupový poriadok",
      art: "čl. 5",
      ver: "verzia 2026",
      rel: ["Čo je mimoriadny prestup?", "Aké poplatky sa platia pri prestupe?"],
    },
    {
      k: ["issf", "heslo", "prihlás", "prihlas", "konto", "reset"],
      q: "Ako si obnovím heslo do ISSF?",
      a: "Heslo si obnovíte cez tlačidlo „Zabudnuté heslo“ na prihlasovacej obrazovke ISSF. Odkaz na obnovenie príde na e-mail evidovaný vo vašom konte.",
      src: "IT podpora — ISSF",
      art: null,
      ver: "FAQ",
      rel: ["Nedostal som e-mail na obnovenie", "Ako zmením kontaktný e-mail?"],
    },
  ],
  en: [
    {
      k: ["two", "match", "matches", "day", "twice"],
      q: "Can a player play in two matches in a single day?",
      a: "A player may not play in two competitive matches on the same day. Youth matches are an exception, under conditions set by the competition's governing body.",
      src: "Competition rules",
      art: "Art. 12 (3)",
      ver: "version 2026",
      rel: ["What are the conditions for youth?", "What if a player plays ineligibly?"],
    },
    {
      k: ["transfer", "deadline", "registration", "window"],
      q: "What is the deadline to file a player transfer?",
      a: "A transfer can be filed within the registration window for the given competition. After the deadline, the request is treated as an extraordinary transfer with both clubs' consent.",
      src: "Transfer rules",
      art: "Art. 5",
      ver: "version 2026",
      rel: ["What is an extraordinary transfer?", "What fees apply to a transfer?"],
    },
    {
      k: ["issf", "password", "login", "account", "reset"],
      q: "How do I reset my ISSF password?",
      a: "Reset your password via the “Forgotten password” button on the ISSF login screen. The reset link is sent to the e-mail registered on your account.",
      src: "IT support — ISSF",
      art: null,
      ver: "FAQ",
      rel: ["I didn't receive the reset e-mail", "How do I change my contact e-mail?"],
    },
  ],
};
