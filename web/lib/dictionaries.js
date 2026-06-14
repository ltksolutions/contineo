export const locales = ["sk", "en"];

export const dictionaries = {
  sk: {
    locale: "sk",
    metaDescription:
      "Inteligentné vyhľadávanie nad obsahom vašej firmy. Opýtajte sa — odpoveď príde z vášho vlastného obsahu, s citáciou.",
    nav: {
      features: "Funkcie",
      how: "Ako to funguje",
      demo: "Demo",
      audience: "Pre koho",
      roadmap: "Pripravujeme",
      cta: "Vyskúšať",
    },
    hero: {
      badge: "Inteligentné vyhľadávanie a helpdesk nad vaším obsahom",
      title: "Opýtajte sa. Nehľadajte.",
      claim: "Odpovede z vášho sveta, nie z internetu.",
      subtitle:
        "Contineo nájde odpoveď vo vašom vlastnom obsahu — weby, projekty, normy aj interné predpisy. Žiadne listovanie v zložkách, žiadne dohady z internetu. Len overená odpoveď odtiaľ, kde naozaj žije.",
      ctaPrimary: "Vyskúšať vyhľadávanie",
      ctaSecondary: "Ako to funguje",
      note: "Vložiteľné do webu aj aplikácií jedným riadkom.",
    },
    manifesto: {
      eyebrow: "Prečo Contineo",
      text: "Roky sme sa učili hľadať — vypisovať kľúčové slová, otvárať desať záložiek, prehľadávať zložky. Contineo to obracia: jednoducho sa opýtate a dostanete odpoveď. A nie hocijakú — odpoveď z obsahu vašej firmy, s citáciou zdroja. Nie z internetu. Z vášho sveta.",
    },
    logos: "Postavené na MongoDB Atlas · Next.js · Node.js",
    features: {
      eyebrow: "Funkcie",
      title: "Jedno miesto pre všetok firemný obsah",
      items: [
        {
          icon: "search",
          title: "Inteligentné vyhľadávanie",
          text: "Sémantické hľadanie naprieč všetkými zdrojmi naraz. Používateľ píše prirodzene, Contineo nájde podstatu.",
        },
        {
          icon: "layers",
          title: "Všetky zdroje pohromade",
          text: "Weby, projekty, normy, interné predpisy a FAQ na jednom mieste. Žiadne prepínanie medzi systémami.",
        },
        {
          icon: "quote",
          title: "Odpovede s citáciou",
          text: "Každá odpoveď uvádza zdroj a verziu dokumentu. Žiadne dohady — len overený obsah.",
        },
        {
          icon: "ticket",
          title: "Helpdesk a ticketing",
          text: "Keď vyhľadávanie nestačí, používateľ jedným klikom pošle otázku ako ticket alebo e-mail správcovi.",
        },
        {
          icon: "brain",
          title: "Učí sa z odpovedí",
          text: "Schválené odpovede správcov sa stávajú novou znalosťou. Systém je každým dňom presnejší.",
        },
        {
          icon: "shield",
          title: "Oddelené pre každú firmu",
          text: "Multi-tenant architektúra — obsah a prístupy každej organizácie sú bezpečne oddelené.",
        },
      ],
    },
    how: {
      eyebrow: "Ako to funguje",
      title: "Od otázky k overenej odpovedi",
      steps: [
        {
          n: "01",
          title: "Pripojíte zdroje",
          text: "Weby, projekty, PDF normy, interné predpisy či FAQ. Obsah sa rozdelí a označí podľa témy a platnosti.",
        },
        {
          n: "02",
          title: "Používateľ sa pýta",
          text: "Položí otázku prirodzeným jazykom priamo vo vašom webe alebo aplikácii.",
        },
        {
          n: "03",
          title: "Contineo nájde a odpovie",
          text: "Prehľadá všetky zdroje a vygeneruje odpoveď len z overeného obsahu — s odkazom na zdroj a verziu.",
        },
        {
          n: "04",
          title: "Podpora a učenie",
          text: "Pri neúspechu vznikne ticket; odpoveď správcu sa vráti späť ako nová znalosť.",
        },
      ],
    },
    demo: {
      eyebrow: "Živé demo",
      title: "Skúste, ako to vyzerá pre používateľa",
      subtitle:
        "Toto je ukážka inteligentného vyhľadávania s vzorovými dátami. Skúste „prestup termín“, „ISSF heslo“ alebo „dva zápasy za deň“.",
      placeholder: "Opýtaj sa na čokoľvek z vášho obsahu…",
      brand: "inteligentné vyhľadávanie",
      poweredBy: "Poháňa Contineo · odpovede z overeného obsahu",
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
      title: "Pre organizácie s množstvom obsahu",
      items: [
        { title: "Firmy a inštitúcie", text: "Weby, projekty, smernice a predpisy roztrúsené po systémoch — zjednotené do jedného vyhľadávania." },
        { title: "Tímy a zamestnanci", text: "Rýchle odpovede na bežné otázky bez hľadania v zložkách a bez čakania na kolegu." },
        { title: "Podpora a IT", text: "Návody a FAQ k aplikáciám — menej opakovaných ticketov, viac vyriešeného samoobslužne." },
      ],
    },
    roadmap: {
      eyebrow: "Pripravujeme",
      title: "Z obsahu automaticky web",
      subtitle:
        "V ďalších verziách Contineo z vašich zdrojov vytvorí prehľadný web — automatický prehľad informácií, projektov a noriem, vždy aktuálny.",
      items: [
        { title: "Automatický prehľad", text: "Z pripojených zdrojov vznikne štruktúrovaný portál bez ručného písania." },
        { title: "Projekty a informácie", text: "Prehľad projektov, dokumentov a noviniek na jednom mieste, vždy aktuálny." },
        { title: "Bez údržby", text: "Aktualizácia zdroja sa premietne do webu automaticky." },
      ],
      tag: "Plánované v ďalších verziách",
    },
    tech: {
      navLabel: "Technológia",
      eyebrow: "Technické riešenie",
      title: "Postavené na overených technológiách",
      subtitle:
        "Contineo spája sémantické vyhľadávanie (RAG) nad vaším obsahom s jazykovým modelom, ktorý odpovedá výhradne z overených zdrojov — s citáciou a verziou.",
      download: "Stiahnuť technický návrh (PDF)",
      back: "Späť na hlavnú stránku",
      architectureTitle: "Architektúra a dátový tok",
      architectureCaption:
        "Zdroje obsahu → spracovanie a embeddingy → MongoDB Atlas (Vector Search) → RAG + LLM → rozhrania. Vrátane učiaceho cyklu a eskalácie na ticket.",
      pillarsTitle: "Kľúčové piliere",
      pillars: [
        { icon: "search", title: "RAG + Vector Search", text: "Sémantické vyhľadávanie cez MongoDB Atlas Vector Search s filtrom na zdroj, tému a platnú verziu. Odpoveď generuje LLM len z nájdených pasáží." },
        { icon: "quote", title: "Citácie a verzie", text: "Každá odpoveď uvádza zdroj a verziu. Import novej verzie nestratí starú — cituje sa vždy platné znenie." },
        { icon: "shield", title: "Multi-tenant a bezpečnosť", text: "Obsah a prístupy každej organizácie sú oddelené. Role a audit pri každej zmene znalostí." },
        { icon: "layers", title: "Viac zdrojov naraz", text: "Weby (RSS), PDF normy, FAQ, interné predpisy a projekty — zjednotené do jedného indexu." },
        { icon: "ticket", title: "Helpdesk a e-mail", text: "Sledovanie e-mailových schránok, ticketing a predpripravené odpovede s eskaláciou z vyhľadávania." },
        { icon: "brain", title: "Učiaci cyklus", text: "Schválené odpovede správcov sa vracajú do znalostí ako nové páry — systém sa zlepšuje." },
      ],
      stackTitle: "Technologický stack",
      stack: [
        "MongoDB Atlas + Vector Search",
        "Node.js worker + fronta úloh",
        "Next.js (App Router)",
        "Multilingválne embeddingy + LLM",
        "Integrácie: e-mail (IMAP), ISSF, Sportnet / IS športu",
      ],
    },
    cta: {
      title: "Pripravení dostať svoj obsah na dosah ruky?",
      subtitle: "Ukážeme vám Contineo na vašich vlastných zdrojoch.",
      button: "Kontaktujte nás",
      email: "office@contineo.app",
    },
    footer: {
      tagline: "Opýtajte sa svojho obsahu.",
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
    metaDescription:
      "Intelligent search over your company's content. Just ask — the answer comes from your own content, with a citation.",
    nav: {
      features: "Features",
      how: "How it works",
      demo: "Demo",
      audience: "Who it's for",
      roadmap: "What's next",
      cta: "Try it",
    },
    hero: {
      badge: "Intelligent search and helpdesk over your content",
      title: "Ask. Don't search.",
      claim: "Answers from your world, not the internet.",
      subtitle:
        "Contineo finds the answer in your own content — websites, projects, regulations and internal guidelines. No digging through folders, no guessing from the internet. Just a verified answer from where it actually lives.",
      ctaPrimary: "Try the search",
      ctaSecondary: "How it works",
      note: "Embeddable into any website or app in one line.",
    },
    manifesto: {
      eyebrow: "Why Contineo",
      text: "For years we learned to search — typing keywords, opening ten tabs, digging through folders. Contineo flips it: you simply ask and get the answer. And not just any answer — one from your company's content, with a source citation. Not from the internet. From your world.",
    },
    logos: "Built on MongoDB Atlas · Next.js · Node.js",
    features: {
      eyebrow: "Features",
      title: "One place for all your company content",
      items: [
        {
          icon: "search",
          title: "Intelligent search",
          text: "Semantic search across all sources at once. Users write naturally, Contineo finds the substance.",
        },
        {
          icon: "layers",
          title: "All sources together",
          text: "Websites, projects, regulations, internal guidelines and FAQs in one place. No switching between systems.",
        },
        {
          icon: "quote",
          title: "Answers with citations",
          text: "Every answer states the source and document version. No guessing — only verified content.",
        },
        {
          icon: "ticket",
          title: "Helpdesk & ticketing",
          text: "When search isn't enough, users send the question as a ticket or e-mail to an admin in one click.",
        },
        {
          icon: "brain",
          title: "Learns from answers",
          text: "Approved admin answers become new knowledge. The system gets more accurate every day.",
        },
        {
          icon: "shield",
          title: "Isolated per company",
          text: "Multi-tenant architecture — each organisation's content and access are securely separated.",
        },
      ],
    },
    how: {
      eyebrow: "How it works",
      title: "From a question to a verified answer",
      steps: [
        {
          n: "01",
          title: "You connect sources",
          text: "Websites, projects, PDF regulations, internal guidelines or FAQs. Content is chunked and tagged by topic and validity.",
        },
        {
          n: "02",
          title: "A user asks",
          text: "They ask a question in natural language, right inside your website or app.",
        },
        {
          n: "03",
          title: "Contineo finds and answers",
          text: "It searches all sources and generates an answer only from verified content — linking the source and version.",
        },
        {
          n: "04",
          title: "Support and learning",
          text: "On failure a ticket is created; the admin's answer flows back as new knowledge.",
        },
      ],
    },
    demo: {
      eyebrow: "Live demo",
      title: "See how it looks for a user",
      subtitle:
        "This is a demo of intelligent search with sample data. Try “transfer deadline”, “ISSF password” or “two matches in a day”.",
      placeholder: "Ask anything from your content…",
      brand: "intelligent search",
      poweredBy: "Powered by Contineo · answers from verified content",
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
      title: "For organisations with lots of content",
      items: [
        { title: "Companies & institutions", text: "Websites, projects, policies and rules scattered across systems — unified into one search." },
        { title: "Teams & employees", text: "Fast answers to common questions without digging through folders or waiting for a colleague." },
        { title: "Support & IT", text: "Guides and FAQs for apps — fewer repeated tickets, more solved self-service." },
      ],
    },
    roadmap: {
      eyebrow: "What's next",
      title: "From content to an automatic website",
      subtitle:
        "In upcoming versions Contineo will build a clear website from your sources — an automatic overview of information, projects and rules, always up to date.",
      items: [
        { title: "Automatic overview", text: "A structured portal generated from your connected sources, with no manual writing." },
        { title: "Projects & information", text: "An overview of projects, documents and updates in one place, always current." },
        { title: "Zero maintenance", text: "A source update is reflected on the website automatically." },
      ],
      tag: "Planned for future versions",
    },
    tech: {
      navLabel: "Technology",
      eyebrow: "Technical solution",
      title: "Built on proven technology",
      subtitle:
        "Contineo combines semantic search (RAG) over your content with a language model that answers only from verified sources — with a citation and version.",
      download: "Download the technical design (PDF)",
      back: "Back to home",
      architectureTitle: "Architecture and data flow",
      architectureCaption:
        "Content sources → processing and embeddings → MongoDB Atlas (Vector Search) → RAG + LLM → interfaces. Including the learning loop and ticket escalation.",
      pillarsTitle: "Key pillars",
      pillars: [
        { icon: "search", title: "RAG + Vector Search", text: "Semantic search via MongoDB Atlas Vector Search, filtered by source, topic and the valid version. The LLM answers only from the retrieved passages." },
        { icon: "quote", title: "Citations and versions", text: "Every answer states the source and version. A new import never loses the old one — always citing the valid wording." },
        { icon: "shield", title: "Multi-tenant and security", text: "Each organisation's content and access are isolated. Roles and an audit trail on every knowledge change." },
        { icon: "layers", title: "Many sources at once", text: "Websites (RSS), PDF regulations, FAQs, internal guidelines and projects — unified into one index." },
        { icon: "ticket", title: "Helpdesk and e-mail", text: "Mailbox monitoring, ticketing and prepared replies with escalation from search." },
        { icon: "brain", title: "Learning loop", text: "Approved admin answers flow back into the knowledge base as new pairs — the system keeps improving." },
      ],
      stackTitle: "Technology stack",
      stack: [
        "MongoDB Atlas + Vector Search",
        "Node.js worker + job queue",
        "Next.js (App Router)",
        "Multilingual embeddings + LLM",
        "Integrations: e-mail (IMAP), ISSF, Sportnet / IS športu",
      ],
    },
    cta: {
      title: "Ready to get your content at your fingertips?",
      subtitle: "We'll show you Contineo on your own sources.",
      button: "Get in touch",
      email: "office@contineo.app",
    },
    footer: {
      tagline: "Ask your content.",
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
