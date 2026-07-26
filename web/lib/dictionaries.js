export const locales = ["sk", "en"];

export const dictionaries = {
  sk: {
    locale: "sk",
    metaDescription:
      "RAG helpdesk s hybridným vyhľadávaním nad vaším obsahom. MongoDB $rankFusion, vymeniteľné AI adaptéry — cloud (Voyage, Claude) alebo plne on-prem (Infinity, vLLM). EU hosting, GDPR. Odpoveď s citáciou zdroja.",
    nav: {
      features: "Funkcie",
      how: "Ako to funguje",
      demo: "Demo",
      audience: "Pre koho",
      roadmap: "Pripravujeme",
      modes: "Nasadenie",
      overview: "Čo je Contineo",
      versions: "Verzie",
      runtime: "Prevádzka",
      identity: "Identita",
      security: "Bezpečnosť",
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
    logos: "Postavené na MongoDB $rankFusion · Voyage AI alebo Infinity/TEI · Claude alebo vLLM · Next.js · EU hosting · GDPR",
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
          title: "Podpora a kurácia",
          text: "Pri neúspechu vznikne ticket; odpoveď správcu sa vráti späť ako nová znalosť.",
        },
      ],
    },
    demo: {
      eyebrow: "Živé demo",
      title: "Skúste, ako to vyzerá pre používateľa",
      subtitle:
        "Toto je ukážka inteligentného vyhľadávania s vzorovými dátami. Skúste „home office“, „dovolenka termín“ alebo „reset hesla“.",
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
      appliesAll: "platí pre celú firmu (ACME)",
    },
    modes: {
      eyebrow: "Spôsoby nasadenia",
      title: "Dva spôsoby, ako Contineo nasadiť",
      subtitle: "Použite Contineo ako uzamknutý firemný portál, alebo ako vložené inteligentné vyhľadávanie priamo vo vašej stránke.",
      intranet: {
        tag: "Intranet",
        title: "Samostatný portál na subdoméne",
        text: "Vyhľadávanie a portál s firemným obsahom na vašej subdoméne (napr. hladaj.vasafirma.sk). Uzamknuteľné len pre prihlásených interných používateľov.",
        points: [
          "Prihlásenie cez Microsoft Entra, Google Workspace či iné SSO viazané na doménu",
          "Prístup len pre interných používateľov organizácie",
          "Portál s prehľadom firemného obsahu na jednom mieste",
        ],
      },
      embed: {
        tag: "Vložené vyhľadávanie",
        title: "Ikona vyhľadávania priamo vo vašej stránke",
        text: "Do existujúcej stránky pridáte ikonu Contineo. Po kliknutí sa rozbalí ako vrchná vrstva (overlay) a nahradí bežné vyhľadávanie na stránke.",
        points: [
          "Jeden riadok kódu, žiadne zásahy do obsahu stránky",
          "Overlay v dizajne Contineo, sadne do svetlej aj tmavej stránky",
          "Ideálne ako náhrada vyhľadávania na verejnom webe",
        ],
        demoHint: "Vyskúšajte: kliknite na ikonu vyhľadávania v ukážkovej stránke.",
      },
      site: {
        name: "Vaša stránka",
        nav: ["Domov", "Novinky", "Dokumenty", "Kontakt"],
        headline: "Ukážková stránka",
        sub: "Toto je len demonštračné pozadie. Vpravo hore je ikona vyhľadávania Contineo.",
        cards: ["Aktuality", "Dokumenty", "Projekty"],
        placeholder: "Opýtajte sa čokoľvek z obsahu stránky…",
        close: "Zavrieť",
        poweredBy: "Poháňa Contineo",
      },
    },
    runtime: {
      eyebrow: "Prevádzkové režimy",
      title: "Rovnaká aplikácia v cloude aj za zamknutými dverami",
      subtitle:
        "Jadro vyhľadávania je v oboch režimoch identické — hybridný dotaz $rankFusion beží rovnako v MongoDB Atlas aj v self-hosted Community edícii. Líšia sa len tri vymeniteľné adaptéry, ktoré sa vyberajú konfiguráciou tenanta, nie zásahom do kódu.",
      cloud: {
        tag: "Cloud",
        title: "Riadená prevádzka v EÚ",
        text: "MongoDB Atlas v európskom regióne, embedding aj rerank priamo v databáze, generovanie cez Claude API. Žiadny nákup hardvéru, nasadenie v dňoch.",
        points: [
          "Automated Embedding — vektory vznikajú priamo v databáze",
          "Overiteľné citácie cez Citations API",
          "Bez vstupnej investície do hardvéru, platí sa za dotaz",
        ],
      },
      onprem: {
        tag: "On-prem",
        title: "Uzavreté riešenie na vašom železe",
        text: "MongoDB Community 8.2 na vlastnom stroji, embedding a rerank cez Infinity alebo TEI, generovanie cez vLLM. Obsah ani dotazy neopustia váš perimeter.",
        points: [
          "Vhodné pre citlivé kategórie údajov aj utajované skutočnosti",
          "Voľba modelu — Qwen3, EuroLLM, Gemma a ďalšie",
          "Funguje aj úplne bez pripojenia na internet",
        ],
      },
      adaptersTitle: "Tri vymeniteľné adaptéry",
      cloudLabel: "Cloud",
      onpremLabel: "On-prem",
      adapters: [
        {
          name: "Embedding",
          co: "Rozumie významu, nielen slovám",
          popis:
            "Prevedie každý odsek na číselný odtlačok významu. Vďaka tomu nájde správnu pasáž, aj keď ste použili iné slová než predpis — na otázku „koľko sa platí za prestup“ vráti článok o odstupnom.",
          cloud: "Atlas Automated Embedding (voyage-4)",
          onprem: "Infinity / TEI (voyage-4-nano, BGE-M3)",
        },
        {
          name: "Rerank",
          co: "Druhé čítanie, ktoré upraví poradie",
          popis:
            "Prvé hľadanie je rýchle, ale hrubé — prejde tisíce odsekov a vyberie desiatky kandidátov. Rerank ich prečíta pozorne spolu s otázkou a preusporiada tak, aby úplne hore skončilo to najpresnejšie.",
          cloud: "$rerank priamo v databáze (rerank-2)",
          onprem: "Infinity / TEI (BGE-reranker-v2-m3)",
        },
        {
          name: "Generovanie",
          co: "Zloží odpoveď a doloží, odkiaľ je",
          popis:
            "Z nájdených pasáží napíše odpoveď v bežnej reči a ku každému tvrdeniu pripojí predpis a článok, z ktorého čerpá. Keď odpoveď v podkladoch nie je, povie to — namiesto toho, aby si ju vymyslel.",
          cloud: "Claude API (Citations, prompt caching)",
          onprem: "vLLM (Qwen3, EuroLLM, Gemma)",
        },
      ],
      note: "Voľba je na úrovni tenanta — jedna inštalácia obslúži cloudových aj on-prem zákazníkov súčasne.",
    },
    security: {
      eyebrow: "Bezpečnosť dát",
      title: "Vaše dáta ostávajú u vás",
      subtitle: "Contineo je postavené tak, že obsah vašej firmy zostáva bezpečne vo vašej databáze a úložisku. AI je len pomocník — nie miesto, kam vaše dáta odchádzajú.",
      points: [
        { icon: "lock", title: "Dáta vo vašej databáze", text: "Obsah žije vo vašej MongoDB a úložisku, oddelene pre každého tenanta. Nie je verejný a neindexuje ho verejný internet." },
        { icon: "shield", title: "Žiadna verejná AI", text: "Nepoužívame verejnú spotrebiteľskú AI. Verejné modely sa na vašich dátach netrénujú." },
        { icon: "search", title: "AI je len pomocník", text: "Jazykový model odpovedá výhradne z nájdených pasáží vášho obsahu (RAG) a pripája citáciu zdroja." },
        { icon: "layers", title: "Vy si volíte režim", text: "Cloud s databázou v EÚ, alebo plne on-prem, kde dáta nikdy neopustia vašu infraštruktúru. Rovnaká aplikácia, iná konfigurácia — podrobný rozpis dátových tokov nájdete v sekcii Dátová rezidencia." },
      ],
    },
    residency: {
      navLabel: "Bezpečnosť",
      eyebrow: "Dátová rezidencia",
      title: "Kam sa dostane váš text",
      subtitle:
        "Nie kde ležia dáta, ale kde sa spracúvajú. Ten rozdiel rozhoduje o tom, či prejdete tendrom — a väčšina dodávateľov ho zamlčí.",
      levels: [
        {
          icon: "globe",
          title: "1 · Dáta v pokoji v EÚ",
          text: "Databáza, indexy a zálohy sú v EÚ. Volanie AI modelov von je prípustné pri spracovateľskej zmluve a štandardných zmluvných doložkách.",
          who: "bežné komerčné nasadenie",
        },
        {
          icon: "shield",
          title: "2 · Nič neopustí EÚ",
          text: "Aj modely bežia v EÚ — vrátane otázok, ktoré píšu vaši ľudia. Nie je to požiadavka GDPR, ale býva v súťažných podmienkach.",
          who: "verejná správa, väčšie firmy",
        },
        {
          icon: "lock",
          title: "3 · Nič neopustí perimeter",
          text: "Celý systém beží na vašej infraštruktúre. Bez konektivity von, ak je to potrebné.",
          who: "utajované skutočnosti, uzavreté siete",
        },
      ],
      levelsNote:
        "Úroveň 1 je právne v poriadku — GDPR prenos mimo EÚ nezakazuje, len ho podmieňuje. Ale ak je v zadaní napísané „údaje nesmú opustiť EÚ“, je to organizačná požiadavka, ktorú zmluvou nevyriešite. Kto vie ponúknuť len úroveň 1, býva vyradený formálne, nie vecne.",

      modesTitle: "Režimy, ktoré vieme nasadiť",
      modesIntro:
        "Režim je vlastnosť vašej organizácie, nie našej verzie. Rovnaká aplikácia, iná konfigurácia — a nepovolenú kombináciu systém odmietne spustiť.",
      modesHead: {
        mode: "Režim",
        meaning: "Čo znamená",
        embedding: "Embedding",
        rerank: "Rerank",
        generation: "Generovanie",
      },
      modes: [
        { key: "eu-data", meaning: "Dáta v EÚ, spracovanie môže byť mimo",
          embedding: "MongoDB Atlas", rerank: "MongoDB Atlas", generation: "Claude API" },
        { key: "eu-full", meaning: "Žiadny text neopustí EÚ",
          embedding: "vlastná služba", rerank: "vlastná služba", generation: "vlastný model" },
        { key: "on-prem", meaning: "Všetko na vašej infraštruktúre",
          embedding: "vlastná služba", rerank: "vlastná služba", generation: "vlastný model" },
        { key: "air-gap", meaning: "Uzavretá sieť bez konektivity von",
          embedding: "vlastná služba", rerank: "vlastná služba", generation: "vlastný model" },
      ],

      whereTitle: "Kde spracovanie prebieha — vrátane toho, čo overujeme",
      whereIntro:
        "Každý riadok je doložený verejným dokumentom dodávateľa, nie odhadom. Komponenty spracúvajúce mimo EÚ sa v režimoch eu-full, on-prem a air-gap nepoužijú — profil s takou kombináciou sa odmietne spustiť.",
      whereHead: {
        component: "Komponent",
        provider: "Poskytovateľ",
        location: "Lokalita spracovania",
        evidence: "Podklad",
      },
      where: [
        { component: "Databáza, indexy, zálohy", provider: "MongoDB Atlas",
          location: "EÚ (Frankfurt)", stav: "ok",
          evidence: "voľba regiónu pri založení clustera" },
        { component: "Hybridné vyhľadávanie", provider: "mongot v clusteri",
          location: "EÚ (Frankfurt)", stav: "ok",
          evidence: "počíta sa priamo v clusteri" },
        { component: "Reranking", provider: "$rerank (Voyage)",
          location: "mimo EÚ (USA)", stav: "mimo",
          evidence: "uvedené v nastavení projektu Atlas" },
        { component: "Embedding", provider: "Atlas Automated Embedding",
          location: "mimo EÚ (USA)", stav: "mimo",
          evidence: "zoznam subprocesorov MongoDB: Google LLC, United States" },
        { component: "Generovanie odpovede", provider: "Anthropic Claude (priame API)",
          location: "mimo EÚ (USA)", stav: "mimo",
          evidence: "spracovanie v americkej infraštruktúre" },
        { component: "Generovanie odpovede", provider: "Claude cez AWS Bedrock / Vertex AI",
          location: "EÚ (Frankfurt, Írsko, Paríž)", stav: "ok",
          evidence: "voľba regiónu pri nasadení" },
        { component: "Embedding, rerank, generovanie", provider: "vlastné služby (on-prem)",
          location: "vaša infraštruktúra", stav: "ok",
          evidence: "beží u vás" },
      ],

      honestyTitle: "Prečo to vypisujeme takto podrobne.",
      honestyText:
        "Pretože sa na to pri obstarávaní niekto spýta. Väčšina dodávateľov uvedie „dáta v EÚ“ a mlčí o tom, kde beží model — pritom práve tam ide text otázky aj nájdených pasáží. Každý riadok vyššie vieme doložiť dokumentom dodávateľa a ak sa stav zmení, zmeníme aj túto tabuľku.",
      legalNote:
        "Táto stránka je technický popis dátových tokov, nie právne posúdenie. Pri konkrétnom nasadení odporúčame posúdenie odborníkom na ochranu osobných údajov.",
    },
    audience: {
      eyebrow: "Pre koho",
      title: "Nie je to nástroj len pre veľké organizácie",
      subtitle:
        "Rozhoduje množstvo predpisov, nie počet zamestnancov. Desaťčlenná firma so stavebnou legislatívou má rovnaký problém ako ministerstvo — len menší rozpočet a nikoho, kto by to sledoval na plný úväzok.",
      items: [
        { title: "Malé a stredné firmy", text: "Interné smernice, návody k produktom a legislatíva, ktorú musíte dodržiavať. Bez vlastného právnika a bez človeka, ktorý by sledoval každú novelu." },
        { title: "Školy a inštitúcie", text: "Školský zákon, vyhlášky, vnútorné poriadky a smernice zriaďovateľa. Nový učiteľ alebo administratívny pracovník sa zorientuje za hodinu, nie za mesiace." },
        { title: "Zväzy a komory", text: "Vlastné predpisy nadväzujúce na zákon, ktorý sa mení. Členovia sa pýtajú stále to isté — a odpoveď musí sedieť s platným znením." },
        { title: "Verejná správa", text: "Zákony, vykonávacie predpisy a interné akty riadenia. On-prem alebo v uzavretej sieti, ak to vyžadujú pravidlá." },
        { title: "Podpora a helpdesk", text: "Návody a FAQ k aplikáciám — menej opakovaných ticketov, viac vyriešeného samoobslužne." },
        { title: "Noví aj skúsení zamestnanci", text: "Odpoveď s odkazom na konkrétny článok. Nový sa zaučí rýchlejšie, skúsený nemusí odpovedať na to isté po piaty raz." },
      ],
      more: "Pozrieť konkrétne situácie a otázky",
    },
    versions: {
      eyebrow: "Verzie a platné znenie",
      title: "Problém nie je nájsť predpis. Problém je vedieť, ktorý platí.",
      subtitle:
        "Zákon sa novelizuje, vyhláška sa mení, interná smernica zaostane o dva roky. V zložke leží päť súborov s podobným názvom a nikto si netrúfa povedať, ktorý je ten správny.",

      exampleTitle: "Konkrétne:",
      exampleText:
        "zákon o športe je účinný od roku 2016 a odvtedy prešiel desiatkami zmien. Kto sa v športovej organizácii pýta „ako je to dnes“, dostane odpoveď podľa toho, koho sa spýtal a ktorú verziu si stiahol. To isté platí pre stavebný zákon, školský zákon aj zákonník práce.",

      problems: [
        {
          icon: "layers",
          title: "Päť verzií, jedna platná",
          text: "Novely, úplné znenia, pracovné verzie a prílohy sa hromadia. Bez evidencie verzií je hľadanie lotéria — a odpoveď z neplatného znenia vyzerá rovnako dôveryhodne ako správna.",
        },
        {
          icon: "scale",
          title: "Interné normy zaostávajú za zákonom",
          text: "Smernica sa píše raz a potom sa na ňu zabudne. Zákon sa medzitým zmení a v organizácii platia dva rozporné texty — jeden zo zákona, druhý z vlastného predpisu.",
        },
        {
          icon: "help",
          title: "Nový človek nemá šancu",
          text: "Zorientovať sa v desiatkach predpisov trvá mesiace. Otázky preto smerujú na jedného-dvoch skúsených kolegov, ktorí odpovedajú stále to isté — a keď odídu, vedomosť odíde s nimi.",
        },
      ],

      nowTitle: "Čo Contineo rieši dnes",
      nowIntro: "Funguje a je nasadené.",
      now: [
        "Každý dokument má verzie. Staršie sa archivujú, ale nezmažú — vyhľadávanie ich predvolene preskočí.",
        "Odpoveď vždy vychádza z platného znenia a uvádza konkrétny predpis aj článok, z ktorého čerpá.",
        "Pravidlá prednosti: vyššia norma pred nižšou, osobitná pred všeobecnou, novšia pred staršou.",
        "Historické znenie sa dá vyžiadať zvlášť — na otázku „ako to bolo v roku 2019“.",
      ],

      nextTitle: "Na čom pracujeme",
      nextTag: "Pripravujeme",
      nextIntro: "Zatiaľ nie je súčasťou nasadenia.",
      next: [
        "Automatické sledovanie externých zdrojov — zbierka zákonov a vestníky sa aktualizujú samy.",
        "Upozornenie na rozpor: interná smernica hovorí niečo iné než platný zákon alebo vykonávací predpis.",
        "Prehľad, ktoré vlastné predpisy sa novelou dotkli a treba ich prejsť.",
      ],
    },
    usecases: {
      navLabel: "Pre koho",
      eyebrow: "Pre koho",
      title: "Rozhoduje množstvo predpisov, nie počet zamestnancov",
      subtitle:
        "Desaťčlenná firma so stavebnou legislatívou má rovnaký problém ako ministerstvo — len menší rozpočet a nikoho, kto by zmeny sledoval na plný úväzok.",
      note:
        "Nižšie sú štyri typické situácie a otázky, ktoré v nich ľudia reálne kladú. Ak sa v niektorej spoznávate, Contineo vám vieme ukázať priamo na vašich dokumentoch.",

      benefitLabel: "Čo sa zmení",
      questionsLabel: "Takto sa ľudia pýtajú",

      segments: [
        {
          icon: "layers",
          title: "Malé a stredné firmy",
          situation:
            "Máte smernice, návody k produktom a legislatívu, ktorú musíte dodržiavať — ale nemáte právnika ani nikoho, kto by sledoval každú novelu. Dokumenty ležia na disku, v e-mailoch a v hlavách dvoch ľudí. Keď jeden z nich odíde na dovolenku, práca sa zastaví.",
          questions: [
            "Aké školenie BOZP musí absolvovať nový zamestnanec pred nástupom?",
            "Do kedy musíme archivovať faktúry a v akej forme?",
            "Platí naša smernica o cestovných náhradách ešte podľa aktuálneho zákona?",
          ],
          answerNote: "Odpoveď cituje konkrétnu smernicu alebo paragraf a jej platnú verziu.",
          benefits: [
            "Odpoveď za sekundy namiesto hľadania v zložkách alebo čakania na kolegu.",
            "Vedomosť prestane byť viazaná na jedného človeka.",
            "Vidíte, ktoré vaše smernice sa odvolávajú na predpis, ktorý sa medzitým zmenil.",
          ],
        },
        {
          icon: "quote",
          title: "Školy a vzdelávacie inštitúcie",
          situation:
            "Školský zákon, vyhlášky ministerstva, smernice zriaďovateľa, vnútorný poriadok a rozhodnutia rady školy. Každý z týchto textov sa mení iným tempom a v inom čase. Nový učiteľ alebo administratívny pracovník sa v tom orientuje mesiace — a väčšinou tak, že sa pýta kolegov.",
          questions: [
            "Koľko dní dovolenky má pedagogický zamestnanec?",
            "Aký je postup pri komisionálnej skúške?",
            "Kto schvaľuje individuálny vzdelávací plán a v akej lehote?",
          ],
          answerNote: "Rozlíši, čo hovorí zákon a čo váš vnútorný poriadok — a ktorý má prednosť.",
          benefits: [
            "Zaučenie nového človeka sa skráti z mesiacov na hodiny.",
            "Sekretariát prestane byť úzkym hrdlom pre bežné otázky.",
            "Odpoveď vždy vychádza z platného znenia, nie zo staršieho súboru na disku.",
          ],
        },
        {
          icon: "scale",
          title: "Zväzy, komory a združenia",
          situation:
            "Máte vlastné predpisy postavené na zákone, ktorý sa mení. Členovia sa pýtajú stále to isté a odpoveď musí sedieť — lebo podľa nej sa rozhoduje o prestupoch, sankciách alebo členstve. Zle citovaný článok je reklamácia, nie preklep.",
          questions: [
            "Aká je lehota na podanie námietky proti výsledku?",
            "Koľko je odstupné za hráča od 20 rokov z tretej ligy?",
            "Kto schvaľuje prestup maloletého do iného klubu?",
          ],
          answerNote:
            "Toto sú skutočné otázky z nášho nasadenia nad normami SFZ — odpoveď uvádza článok aj odsek.",
          benefits: [
            "Členovia dostanú odpoveď sami, bez telefonátu na sekretariát.",
            "Každá odpoveď je doložená článkom, takže sa dá overiť aj spochybniť.",
            "Historické znenie zostáva dostupné pre spory o staršie obdobia.",
          ],
        },
        {
          icon: "shield",
          title: "Verejná správa",
          situation:
            "Zákony, vykonávacie predpisy, interné akty riadenia a metodické usmernenia. K tomu požiadavka, aby údaje neopustili EÚ alebo aby celý systém bežal vo vašej sieti. Bežné cloudové nástroje tu neprejdú ani do užšieho výberu.",
          questions: [
            "Ktorý predpis upravuje lehotu na vybavenie tohto podania?",
            "Zmenilo sa niečo v metodike po poslednej novele?",
            "Čo hovorí interný akt riadenia oproti zákonu?",
          ],
          answerNote: "Dostupné aj v režime, kde žiadny text neopustí vašu infraštruktúru.",
          benefits: [
            "Nasadenie on-prem alebo v uzavretej sieti bez pripojenia na internet.",
            "Doložiteľné, kde sa každá časť spracovania vykonáva — pre audit aj pre obstarávanie.",
            "Prístupové práva podľa existujúceho prihlásenia, bez zakladania nových účtov.",
          ],
        },
      ],

      commonTitle: "Spoločné všetkým štyrom",
      commonText:
        "Odpoveď vždy vychádza z vášho obsahu a uvádza, odkiaľ pochádza — predpis, článok aj verziu. Keď odpoveď v podkladoch nie je, systém to povie namiesto toho, aby si ju vymyslel. To je rozdiel medzi nástrojom, ktorý sa dá použiť pri rozhodovaní, a nástrojom, ktorý sa dá použiť len na inšpiráciu.",
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
    identity: {
      eyebrow: "Identita a prístup",
      title: "Správa používateľov a prihlásenia",
      subtitle: "Používatelia sa prihlasujú cez vaše existujúce SSO a vidia presne to, na čo majú právo — bez ručného zakladania účtov.",
      providers: ["Microsoft Entra ID", "Google Workspace", "OAuth / OIDC", "sportnet.online (príklad)", "Vlastná databáza"],
      providersLabel: "Podporovaní poskytovatelia identity",
      points: [
        { icon: "lock", title: "SSO a jednotné prihlásenie", text: "Prihlásenie cez OAuth/OIDC — Microsoft Entra ID, Google Workspace, vlastné účty či ďalší poskytovateľ identity. Jedna kanonická session naprieč celým systémom." },
        { icon: "refresh", title: "Automatické zakladanie účtov", text: "Používatelia, roly a skupiny vznikajú automaticky z pripojeného CRM / zdroja identity. Žiadne ručné spravovanie účtov — onboarding aj offboarding sa deje sám." },
        { icon: "layers", title: "Multi-tenant prístup", text: "Hierarchia organizácií (centrála → regionálne → lokálne jednotky). Verejný obsah vidia všetci; interný len príslušníci danej jednotky, so zdieľaním konfigurovateľným per dokument." },
        { icon: "shield", title: "Bezpečnosť na úrovni dotazu", text: "Prístupové právo je povinný filter odvodený zo session na strane servera (default-deny). Aplikuje sa pred jazykovým modelom — nedá sa obísť promptom. Audit pri každej zmene." },
      ],
    },
    tech: {
      navLabel: "Technológia",
      eyebrow: "Technické riešenie",
      title: "Postavené na overených technológiách",
      subtitle:
        "Contineo spája sémantické vyhľadávanie (RAG) nad vaším obsahom s jazykovým modelom, ktorý odpovedá výhradne z overených zdrojov — s citáciou a verziou.",
      exampleNote:
        "Príklady na tejto stránke (sekcie, značky, dotazy) vychádzajú z generickej firmy. Contineo je doménovo univerzálne — „predpis“ je len jeden druh dokumentu a „jednotka“ len jeden druh organizácie. Konkrétne nasadenie do veľkej organizácie nájdete v prípadovej štúdii nižšie.",
      back: "Späť na hlavnú stránku",
      architectureTitle: "Architektúra a dátový tok",
      architectureCaption:
        "Vstupné kanály → spracovanie (chunking + značkovanie) → MongoDB (jadro: hybridné vyhľadávanie) → AI adaptéry (embedding, rerank, generovanie) → rozhrania. Jadro je v cloude aj on-prem identické — $rankFusion beží rovnako v Atlase aj v self-hosted Community 8.2. Líšia sa len tri adaptéry, ktoré sa vyberajú konfiguráciou tenanta. AI dostane vždy len relevantné pasáže; dáta zostávajú vo vašej databáze. Súčasťou sú dva spätné cykly: kurácia (kontrola kvality) a eskalácia na ticket.",
      pillarsTitle: "Kľúčové piliere",
      pillars: [
        { icon: "search", title: "RAG + Hybrid Search", text: "Hybridné vyhľadávanie $rankFusion (vektor 60 % + fulltext 40 %) je jadro systému a beží identicky v MongoDB Atlas aj v self-hosted Community 8.2. Odpoveď vzniká výhradne z nájdených pasáží." },
        { icon: "layers", title: "Vymeniteľné AI adaptéry", text: "Embedding, rerank a generovanie sú tri nezávislé adaptéry vyberané konfiguráciou tenanta, nie kódom. Cloud: Voyage a Claude. On-prem: Infinity alebo TEI a vLLM s modelom podľa vášho výberu (Qwen3, EuroLLM, Gemma)." },
        { icon: "quote", title: "Citácie a verzie", text: "Každá odpoveď uvádza zdroj a verziu. Import novej verzie nestratí starú — cituje sa vždy platné znenie." },
        { icon: "shield", title: "Multi-tenant a bezpečnosť", text: "Hierarchia organizácií (centrála → regionálne → lokálne jednotky) ako samostatní tenanti. Verejný obsah vidia všetci; interný obsah len príslušníci danej jednotky. Audit pri každej zmene znalostí." },
        { icon: "layers", title: "Vstupné kanály (obsah aj integrácie)", text: "Jedna vrstva, ktorou tečie obsah: PDF dokumenty a predpisy, FAQ, weby (RSS), interné smernice, MCP konektory (Drive, SharePoint, Confluence…) aj e-mail (IMAP) — zjednotené do jedného indexu. Pripojený zdroj identity (napr. sportnet.online) tu poskytuje identitu, nie obsah." },
        { icon: "ticket", title: "Helpdesk a e-mail", text: "Sledovanie e-mailových schránok, ticketing a predpripravené odpovede s eskaláciou z vyhľadávania." },
        { icon: "brain", title: "Kontrola kvality a kurácia", text: "Nejde o strojové učenie modelu, ale o ľudskú kuráciu: správca ohodnotí a schváli odpoveď, tá sa uloží ako nový pár (qa_pair) a embeduje späť. Nový pár nikdy potichu neprepíše schválený predpis." },
      ],
      stackTitle: "Technologický stack",
      stack: [
        "MongoDB — jadro: $rankFusion (Atlas EU alebo Community 8.2)",
        "Cloud · Voyage AI voyage-4 — Automated Embedding",
        "Cloud · Voyage AI rerank-2.5 — $rerank v databáze",
        "Cloud · Claude API — Citations, prompt caching",
        "On-prem · Infinity / TEI — embedding + rerank",
        "On-prem · vLLM — Qwen3, EuroLLM, Gemma",
        "Next.js 14 (App Router) · Node.js worker",
        "Integrácie: e-mail (IMAP), zdroj identity/CRM (napr. sportnet.online), MCP konektory",
      ],
      flowsTitle: "Kľúčové dátové toky",
      flows: [
        { title: "Odpovedanie (RAG + Hybrid)", text: "Dotaz sa klasifikuje (fulltext / vector / hybrid). $rankFusion zlúči $vectorSearch a $search — identicky v oboch režimoch. Rerank a generovanie potom obslúži adaptér podľa profilu tenanta: v cloude $rerank v databáze a Claude API, on-prem Infinity a vLLM. Odpoveď ide streamingom s citáciou zdroja." },
        { title: "Eskalácia na ticket", text: "Neúspech = nízke skóre podobnosti alebo negatívne hodnotenie. Po 3 neúspechoch na tú istú tému bot ponúkne vytvorenie ticketu aj s celým kontextom konverzácie." },
        { title: "Kontrola kvality a kurácia", text: "Nie strojové učenie, ale ľudská kurácia: schválené odpovede z ContineoLearning aj z upravených e-mailových odpovedí sa uložia ako qa_pair a embedujú späť do znalostí. Nový pár nikdy potichu neprepíše schválený predpis." },
      ],
      collectionsTitle: "Hlavné kolekcie",
      collectionsIntro: "Návrh oddeľuje znalosti (jadro RAG) od konverzácií a ticketov. Verzovanie noriem zaručuje, že import novej verzie nestratí staršiu.",
      collDocLabel: "document_chunks — jadro RAG",
      collTicketLabel: "tickets",
      vectorTitle: "Hybridný vyhľadávací dotaz ($rankFusion)",
      vectorIntro: "Otázka z prostredia jednotky „ACME-BA”, sekcia interné smernice, len platná verzia. $rankFusion kombinuje vektorové a fulltextové vyhľadávanie — tento dotaz je identický v cloude aj on-prem. Rerank je samostatný krok mimo tohto dotazu: v cloude ako $rerank stage, on-prem cez Infinity nad výsledkom.",
      adaptersTitle: "Vymeniteľné adaptéry a profil tenanta",
      adaptersIntro:
        "Embedding, rerank aj generovanie sú tri nezávislé adaptéry. Ktorý sa použije, určuje záznam v kolekcii tenant_profiles — nie kód. Jedna inštalácia tak obslúži cloudového aj on-prem zákazníka súčasne, s rovnakým jadrom vyhľadávania.",
      collProfileLabel: "tenant_profiles — voľba adaptérov",
      parityTitle: "Čo sa medzi režimami líši",
      parityIntro: "Jadro je identické, ale úplná funkčná parita neexistuje. Toto sú rozdiely, s ktorými treba počítať pri výbere režimu.",
      parityHead: { cap: "Schopnosť", cloud: "Cloud", onprem: "On-prem" },
      parity: [
        { cap: "$rankFusion hybridné vyhľadávanie", cloud: "áno", onprem: "áno — identické" },
        { cap: "Automatický embedding v databáze", cloud: "áno", onprem: "volá Voyage API — pre air-gap nepoužiteľné" },
        { cap: "$rerank priamo v pipeline", cloud: "áno", onprem: "nie — rerank v aplikačnej vrstve" },
        { cap: "Overiteľné citácie (Citations API)", cloud: "áno", onprem: "nie — citácie sa žiadajú promptom" },
        { cap: "Prompt caching", cloud: "áno", onprem: "prefix caching vo vLLM, iná sémantika" },
        { cap: "Dáta neopustia perimeter", cloud: "nie", onprem: "áno" },
      ],
      adrNote: "Vektory nie sú prenositeľné medzi modelmi — zmena embedding modelu znamená úplný re-embed korpusu. Rozhodnutie a jeho dôsledky sú zdokumentované v ADR-001.",
      taggingTitle: "Značkovanie obsahu",
      taggingIntro: "Každý úryvok odpovedá na tri otázky — o čom je (sekcia), pre koho platí (organizácia/rozsah) a z ktorej verzie. Hodnoty sa vyberajú z číselníka, nie ako voľný text.",
      taggingSectionsTitle: "Číselník sekcií",
      sections: [
        { key: "vseobecne", label: "Všeobecné informácie" },
        { key: "smernice", label: "Interné smernice" },
        { key: "hr", label: "HR a personalistika" },
        { key: "ekonomicke", label: "Ekonomika a financie" },
        { key: "it_aplikacie", label: "IT a aplikácie" },
        { key: "gdpr", label: "GDPR a právne" },
      ],
      scopeTitle: "Rozsah platnosti",
      scopes: [
        "scope: global + centrála (napr. ACME) → platí pre celú firmu",
        "scope: company + kód jednotky → platí len pre danú jednotku",
        "scope: region → platí pre regionálnu úroveň",
      ],
      taggingExampleLabel: "Príklady označkovaných úryvkov",
      rulesTitle: "Pravidlá pre konzistentné značkovanie",
      rules: [
        "sectionKey a companyCode vždy z číselníka, nikdy voľný text.",
        "Celofiremné predpisy: centrála + scope global — nekopírovať pre každú jednotku.",
        "articleRef vypĺňať pri predpisoch — používa sa v citácii odpovede.",
        "Pri novej verzii staré chunky nemazať — isActive: false + effectiveTo.",
      ],
      ticketTitle: "Životný cyklus ticketu",
      ticketIntro: "Ticket vznikne z bota alebo z e-mailu a prechádza stavmi:",
      ticketStages: [
        { s: "new", t: "prišiel, prebieha auto-triage (sekcia, jednotka, návrh odpovede)" },
        { s: "open", t: "priradený správcovi, pracuje sa naň" },
        { s: "waiting", t: "čaká sa na doplnenie od žiadateľa (SLA pozastavené)" },
        { s: "resolved", t: "odoslaná odpoveď; úprava pri odoslaní = nový qa_pair" },
        { s: "closed", t: "uzavretý; reopen vráti do open" },
      ],
      integrationsTitle: "Integrácie",
      integrations: [
        { title: "E-mail (IMAP)", text: "Dve sledované schránky (tickety + štandardné otázky); worker ich smeruje do ticketu alebo do učiaceho toku." },
        { title: "Zdroj identity a CRM (napr. sportnet.online)", text: "Prihlásenie cez OAuth a CRM ako zdroj pravdy o osobách a organizačných jednotkách: používatelia sa zakladajú automaticky, roly a skupiny podľa príslušnosti k jednotke/tímu (cez mapovaciu tabuľku alebo ručne). Contineo má vlastnú databázu, nezapisuje späť. V športovom nasadení je týmto zdrojom sportnet.online (pozri prípadovú štúdiu)." },
        { title: "RSS / web", text: "Pre všeobecné informácie worker periodicky ťahá RSS; nové položky → documents → chunky." },
        { title: "MCP konektory", text: "Pripojiteľné zdroje cez MCP — Google Drive, SharePoint, Confluence, Notion, Slack a ďalšie. Obsah sa indexuje rovnako ako ostatné zdroje." },
      ],
      securityTitle: "Bezpečnosť a prevádzka",
      security: [
        "Prístup podľa príslušnosti k organizácii/jednotke a skupín (automaticky z pripojeného zdroja identity, napr. sportnet.online v športe); kto smie nahrávať obsah, sa povoľuje ručne. Audit pri každej zmene znalostí.",
        "Prihlásenie cez SSO: Microsoft Entra ID, Google Workspace (v športe aj sportnet.online); verejný obsah aj bez prihlásenia.",
        "Citácia verzie v každej odpovedi a archivácia starých verzií predpisov.",
        "Monitoring kvality: skóre, podiel eskalácií a hodnotenia ako spätná väzba.",
        "Multi-tenant hierarchia (centrála → regionálne → lokálne jednotky): verejný obsah vidia všetci, interný obsah je oddelený per organizácia.",
        "Súkromie dát: obsah ostáva vo vašej databáze a úložisku; AI odpovedá výhradne z vášho obsahu (RAG), verejná spotrebiteľská AI sa nepoužíva.",
        "Voľba prevádzkového režimu na úrovni tenanta: cloud (EU rezidencia, zero-retention zmluva) alebo plne on-prem — obsah ani dotazy neopustia vašu infraštruktúru. Jedna inštalácia obslúži oba typy zákazníkov súčasne.",
      ],
      caseStudy: {
        eyebrow: "Prípadová štúdia",
        title: "Nasadenie vo veľkej organizácii — športový zväz (SFZ)",
        intro: "Contineo je doménovo univerzálne. Takto vyzerá jedno reálne nasadenie do veľkej organizácie — Slovenského futbalového zväzu a jeho podriadených zväzov.",
        points: [
          "Tenant hierarchia: SFZ → regionálne → oblastné zväzy ako samostatné organizácie.",
          "Obsah: súťažné a prestupové poriadky, rozpisy súťaží, smernice, IT FAQ (aplikácia ISSF).",
          "Identita: prihlásenie a CRM cez sportnet.online (OAuth) — používatelia a roly podľa príslušnosti k zväzu/klubu.",
          "Príklad otázky: „Môže hráč nastúpiť v dvoch stretnutiach za jeden deň?“ → odpoveď s citáciou § a verzie.",
        ],
      },
      identity: {
        title: "Identita a riadenie prístupu",
        intro: "Prihlásenie cez existujúce SSO; prístupové právo je povinný filter odvodený zo session a aplikovaný na obe vetvy hybridného vyhľadávania ($vectorSearch aj $search).",
        providersTitle: "Poskytovatelia identity (NextAuth) → jedna kanonická session",
        providers: [
          { name: "OAuth / OIDC", role: "primárny login; v športovom nasadení napr. sportnet.online + zdroj členstiev a rolí" },
          { name: "Microsoft Entra ID", role: "SSO pre firemné účty zamestnancov" },
          { name: "Google Workspace", role: "SSO (alternatíva)" },
          { name: "CRM / API zdroja identity", role: "zdroj pravdy o osobách a organizačných jednotkách; mapovanie na companyCode, roly a skupiny" },
          { name: "Vlastná databáza", role: "účty mimo SSO (credentials)" },
        ],
        principlesTitle: "Princípy bezpečnosti",
        principles: [
          "Server-side only — filter sa skladá zo session, nikdy z parametrov klienta.",
          "Default-deny — čo nie je výslovne povolené, sa nevráti; bez identity len verejný obsah.",
          "Filter pred LLM — model vidí len povolené chunky; nedá sa obísť promptom (platí aj pre citácie).",
          "Auto-provisioning — používatelia, roly a skupiny sa zakladajú a synchronizujú z CRM (login + webhook).",
        ],
        modesTitle: "Dva režimy nasadenia",
        modes: [
          { name: "Verejný widget", text: "anonymný; vidí len verejný obsah naprieč celou hierarchiou." },
          { name: "Interný portál (SSO)", text: "prihlásený; vidí verejný + interný obsah jednotiek, ku ktorým má vzťah." },
        ],
      },
    },
    cta: {
      title: "Pripravení dostať svoj obsah na dosah ruky?",
      subtitle: "Ukážeme vám Contineo na vašich vlastných zdrojoch.",
      button: "Kontaktujte nás",
      email: "office@contineo.app",
    },
    legal: {
      compliance: {
        heading: "Súlad a otvorenosť",
        license: "LGPL-2.1",
        eupl: "EUPL-1.2 compatible",
        reuse: "REUSE compliant",
        gdpr: "GDPR ready",
        wcag: "WCAG 2.1 AA",
      },
      privacy: {
        title: "Ochrana údajov",
        intro: "Toto je vzorová šablóna. Pred zverejnením ju prispôsobte vašej organizácii a nechajte skontrolovať právnikom.",
        sections: [
          { h: "Prevádzkovateľ", p: "Doplňte názov spoločnosti, sídlo a kontaktný e-mail (napr. office@contineo.app)." },
          { h: "Aké údaje spracúvame", p: "Tento web nepoužíva analytické ani reklamné cookies. Ukladá iba voľbu svetlej/tmavej témy v prehliadači (localStorage), čo nie je osobný údaj." },
          { h: "Obsah zákazníka", p: "V produkte Contineo zostáva obsah vašej firmy vo vašej databáze a úložisku. AI vrstva dostane len relevantné pasáže; verejná AI sa nepoužíva a verejné modely sa na vašich dátach netrénujú." },
          { h: "Právny základ a rezidencia", p: "Spracúvanie umožňuje EU rezidenciu a zero-retention u poskytovateľa AI, alebo plne self-hosted nasadenie." },
          { h: "Vaše práva", p: "Podľa GDPR máte právo na prístup, opravu, vymazanie, prenosnosť a právo namietať. Žiadosti smerujte na kontaktný e-mail." },
          { h: "Kontakt", p: "office@contineo.app" },
        ],
      },
      accessibility: {
        title: "Prístupnosť",
        intro: "Contineo je navrhnuté tak, aby spĺňalo WCAG 2.1 úroveň AA.",
        points: [
          "Sémantická štruktúra (nadpisy, orientačné prvky, jeden hlavný obsah na stránku).",
          "Viditeľný fokus pre ovládanie klávesnicou a odkaz „Preskočiť na obsah“.",
          "Dostatočný farebný kontrast v svetlej aj tmavej téme.",
          "Textové alternatívy pre obrázky a zrozumiteľné menovky pre ovládacie prvky.",
          "Rešpektovanie nastavenia „obmedziť pohyb“ (prefers-reduced-motion).",
        ],
        contactH: "Spätná väzba",
        contact: "Ak narazíte na bariéru v prístupnosti, napíšte nám na office@contineo.app a opravíme to.",
      },
    },
    footer: {
      tagline: "Opýtajte sa svojho obsahu.",
      overview: "Čo je Contineo",
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
      "Contineo is an intelligent RAG helpdesk over your own content. Hybrid search (MongoDB $rankFusion) with swappable AI adapters — cloud (Voyage, Claude) or fully on-prem (Infinity, vLLM). Answers with citations. EU hosting, GDPR.",
    nav: {
      features: "Features",
      how: "How it works",
      demo: "Demo",
      audience: "Who it's for",
      roadmap: "What's next",
      modes: "Deployment",
      overview: "What Contineo is",
      versions: "Versions",
      runtime: "Runtime",
      identity: "Identity",
      security: "Security",
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
    logos: "Built on MongoDB $rankFusion · Voyage AI or Infinity/TEI · Claude or vLLM · Next.js · EU hosting · GDPR",
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
          title: "Support and curation",
          text: "On failure a ticket is created; the admin's answer flows back as new knowledge.",
        },
      ],
    },
    demo: {
      eyebrow: "Live demo",
      title: "See how it looks for a user",
      subtitle:
        "This is a demo of intelligent search with sample data. Try “home office”, “leave deadline” or “password reset”.",
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
      appliesAll: "applies company-wide (ACME)",
    },
    modes: {
      eyebrow: "Deployment options",
      title: "Two ways to deploy Contineo",
      subtitle: "Use Contineo as a locked-down company portal, or as embedded intelligent search right inside your website.",
      intranet: {
        tag: "Intranet",
        title: "Standalone portal on a subdomain",
        text: "Search and a portal of company content on your subdomain (e.g. search.yourcompany.com). Lockable to signed-in internal users only.",
        points: [
          "Sign-in via Microsoft Entra, Google Workspace or other domain-bound SSO",
          "Access limited to your organisation's internal users",
          "A portal with an overview of company content in one place",
        ],
      },
      embed: {
        tag: "Embedded search",
        title: "A search icon right inside your website",
        text: "Add the Contineo icon to your existing site. On click it expands as an overlay layer and replaces the site's regular search.",
        points: [
          "One line of code, no changes to your page content",
          "Overlay in Contineo's design, fits light and dark sites",
          "Ideal as a replacement for search on a public website",
        ],
        demoHint: "Try it: click the search icon in the sample page.",
      },
      site: {
        name: "Your website",
        nav: ["Home", "News", "Documents", "Contact"],
        headline: "Sample page",
        sub: "This is just a demo backdrop. The Contineo search icon is in the top right.",
        cards: ["News", "Documents", "Projects"],
        placeholder: "Ask anything from the page content…",
        close: "Close",
        poweredBy: "Powered by Contineo",
      },
    },
    runtime: {
      eyebrow: "Runtime modes",
      title: "The same application in the cloud or behind locked doors",
      subtitle:
        "The search core is identical in both modes — the $rankFusion hybrid query runs the same way in MongoDB Atlas and in the self-hosted Community edition. Only three swappable adapters differ, and they are chosen by tenant configuration, not by changing code.",
      cloud: {
        tag: "Cloud",
        title: "Managed operation in the EU",
        text: "MongoDB Atlas in a European region, embedding and reranking directly in the database, generation via the Claude API. No hardware to buy, deployed in days.",
        points: [
          "Automated Embedding — vectors are created inside the database",
          "Verifiable citations via the Citations API",
          "No upfront hardware investment, you pay per query",
        ],
      },
      onprem: {
        tag: "On-prem",
        title: "A closed solution on your own hardware",
        text: "MongoDB Community 8.2 on your own machine, embedding and reranking via Infinity or TEI, generation via vLLM. Neither content nor queries leave your perimeter.",
        points: [
          "Suitable for special categories of data and classified information",
          "Your choice of model — Qwen3, EuroLLM, Gemma and others",
          "Works fully air-gapped, with no internet connection",
        ],
      },
      adaptersTitle: "Three swappable adapters",
      cloudLabel: "Cloud",
      onpremLabel: "On-prem",
      adapters: [
        {
          name: "Embedding",
          co: "Understands meaning, not just words",
          popis:
            "Turns every paragraph into a numeric fingerprint of its meaning. That is how it finds the right passage even when you phrased things differently from the regulation — ask about “what you pay for a transfer” and it returns the article on transfer fees.",
          cloud: "Atlas Automated Embedding (voyage-4)",
          onprem: "Infinity / TEI (voyage-4-nano, BGE-M3)",
        },
        {
          name: "Rerank",
          co: "A second reading that fixes the order",
          popis:
            "The first pass is fast but rough — it sweeps thousands of paragraphs and picks dozens of candidates. Rerank reads those carefully alongside the question and reorders them so the most precise one ends up at the very top.",
          cloud: "$rerank inside the database (rerank-2)",
          onprem: "Infinity / TEI (BGE-reranker-v2-m3)",
        },
        {
          name: "Generation",
          co: "Writes the answer and shows its sources",
          popis:
            "Composes a plain-language answer from the retrieved passages and attaches the regulation and article behind every claim. When the answer is not in the material, it says so — instead of inventing one.",
          cloud: "Claude API (Citations, prompt caching)",
          onprem: "vLLM (Qwen3, EuroLLM, Gemma)",
        },
      ],
      note: "The choice is per tenant — a single installation serves cloud and on-prem customers at the same time.",
    },
    security: {
      eyebrow: "Data security",
      title: "Your data stays with you",
      subtitle: "Contineo is built so your company's content stays safely in your database and storage. AI is only a helper — not a place your data goes.",
      points: [
        { icon: "lock", title: "Data in your database", text: "Content lives in your MongoDB and storage, isolated per tenant. It isn't public and isn't indexed by the public internet." },
        { icon: "shield", title: "No public AI", text: "We never use public consumer AI. Public models are not trained on your data." },
        { icon: "search", title: "AI is only a helper", text: "The language model answers strictly from retrieved passages of your content (RAG) and attaches a source citation." },
        { icon: "layers", title: "You choose the mode", text: "Cloud with EU residency and a zero-retention agreement, or fully on-prem where data never leaves your infrastructure. Same application, different configuration." },
      ],
    },
    residency: {
      navLabel: "Security",
      eyebrow: "Data residency",
      title: "Where your text actually goes",
      subtitle:
        "Not where the data rests, but where it gets processed. That distinction decides whether you pass procurement — and most vendors leave it out.",
      levels: [
        {
          icon: "globe",
          title: "1 · Data at rest in the EU",
          text: "Database, indexes and backups sit in the EU. Calling AI models abroad is permissible under a processing agreement and standard contractual clauses.",
          who: "ordinary commercial deployment",
        },
        {
          icon: "shield",
          title: "2 · Nothing leaves the EU",
          text: "The models run in the EU too — including the questions your people type. Not a GDPR requirement, but it does appear in tender conditions.",
          who: "public sector, larger companies",
        },
        {
          icon: "lock",
          title: "3 · Nothing leaves the perimeter",
          text: "The whole system runs on your infrastructure. Without outbound connectivity, if required.",
          who: "classified material, closed networks",
        },
      ],
      levelsNote:
        "Level 1 is legally sound — GDPR does not forbid transfers outside the EU, it conditions them. But when a tender says “data must not leave the EU”, that is an organisational requirement no contract can satisfy. A vendor who can only offer level 1 gets excluded on form, not on merit.",

      modesTitle: "Modes we can deploy",
      modesIntro:
        "The mode is a property of your organisation, not of our edition. Same application, different configuration — and a disallowed combination simply refuses to start.",
      modesHead: {
        mode: "Mode",
        meaning: "What it means",
        embedding: "Embedding",
        rerank: "Rerank",
        generation: "Generation",
      },
      modes: [
        { key: "eu-data", meaning: "Data in the EU, processing may be outside",
          embedding: "MongoDB Atlas", rerank: "MongoDB Atlas", generation: "Claude API" },
        { key: "eu-full", meaning: "No text leaves the EU",
          embedding: "own service", rerank: "own service", generation: "own model" },
        { key: "on-prem", meaning: "Everything on your infrastructure",
          embedding: "own service", rerank: "own service", generation: "own model" },
        { key: "air-gap", meaning: "Closed network, no outbound connectivity",
          embedding: "own service", rerank: "own service", generation: "own model" },
      ],

      whereTitle: "Where processing happens — including what we are still verifying",
      whereIntro:
        "Every row is backed by the vendor's own public documentation, not by an estimate. Components processing outside the EU are not used in the eu-full, on-prem and air-gap modes — a profile with such a combination refuses to start.",
      whereHead: {
        component: "Component",
        provider: "Provider",
        location: "Processing location",
        evidence: "Basis",
      },
      where: [
        { component: "Database, indexes, backups", provider: "MongoDB Atlas",
          location: "EU (Frankfurt)", stav: "ok",
          evidence: "region chosen when creating the cluster" },
        { component: "Hybrid search", provider: "mongot in cluster",
          location: "EU (Frankfurt)", stav: "ok",
          evidence: "computed inside the cluster" },
        { component: "Reranking", provider: "$rerank (Voyage)",
          location: "outside the EU (US)", stav: "mimo",
          evidence: "stated in Atlas project settings" },
        { component: "Embedding", provider: "Atlas Automated Embedding",
          location: "outside the EU (US)", stav: "mimo",
          evidence: "MongoDB subprocessor list: Google LLC, United States" },
        { component: "Answer generation", provider: "Anthropic Claude (direct API)",
          location: "outside the EU (US)", stav: "mimo",
          evidence: "processed in US infrastructure" },
        { component: "Answer generation", provider: "Claude via AWS Bedrock / Vertex AI",
          location: "EU (Frankfurt, Ireland, Paris)", stav: "ok",
          evidence: "region chosen at deployment" },
        { component: "Embedding, rerank, generation", provider: "own services (on-prem)",
          location: "your infrastructure", stav: "ok",
          evidence: "runs at your site" },
      ],

      honestyTitle: "Why we spell this out in such detail.",
      honestyText:
        "Because someone in procurement will ask. Most vendors state “data in the EU” and stay silent about where the model runs — yet that is exactly where the question and the retrieved passages go. Every row above is backed by the vendor's own documentation, and if the situation changes, so does this table.",
      legalNote:
        "This page is a technical description of data flows, not a legal assessment. For a specific deployment we recommend review by a data protection specialist.",
    },
    audience: {
      eyebrow: "Who it's for",
      title: "Not a tool only for large organisations",
      subtitle:
        "What matters is the volume of regulation, not the headcount. A ten-person firm under construction law has the same problem as a ministry — with a smaller budget and nobody tracking it full time.",
      items: [
        { title: "Small and mid-sized firms", text: "Internal directives, product documentation and the legislation you have to comply with. Without in-house counsel and without anyone watching every amendment." },
        { title: "Schools and institutions", text: "Education law, decrees, internal rules and the founder's directives. A new teacher or administrator gets oriented in an hour, not in months." },
        { title: "Associations and chambers", text: "Your own rules built on top of a statute that keeps changing. Members keep asking the same questions — and the answer has to match the text in force." },
        { title: "Public administration", text: "Acts, implementing decrees and internal management acts. On-premise or in a closed network where the rules require it." },
        { title: "Support and helpdesk", text: "Guides and FAQs for your applications — fewer repeat tickets, more resolved self-service." },
        { title: "New and experienced staff alike", text: "An answer with a link to the specific article. Newcomers ramp up faster; veterans stop answering the same thing for the fifth time." },
      ],
      more: "See concrete situations and questions",
    },
    versions: {
      eyebrow: "Versions and what is in force",
      title: "The problem is not finding the regulation. It is knowing which one applies.",
      subtitle:
        "Acts get amended, decrees change, an internal directive falls two years behind. Five files with near-identical names sit in a folder and nobody dares say which one is right.",

      exampleTitle: "Concretely:",
      exampleText:
        "Slovakia's Sports Act has been in force since 2016 and has gone through dozens of amendments since. Ask “how does it work today” inside a sports organisation and the answer depends on who you asked and which copy they downloaded. The same holds for construction law, education law and the labour code.",

      problems: [
        {
          icon: "layers",
          title: "Five versions, one in force",
          text: "Amendments, consolidated texts, drafts and annexes pile up. Without version tracking, searching is a lottery — and an answer from a repealed text looks just as trustworthy as the correct one.",
        },
        {
          icon: "scale",
          title: "Internal rules fall behind the law",
          text: "A directive gets written once and then forgotten. The statute changes in the meantime and the organisation ends up with two contradictory texts — one in law, one in its own rulebook.",
        },
        {
          icon: "help",
          title: "A newcomer has no chance",
          text: "Getting on top of dozens of regulations takes months. So questions go to the one or two experienced colleagues who keep answering the same things — and when they leave, the knowledge leaves with them.",
        },
      ],

      nowTitle: "What Contineo solves today",
      nowIntro: "Working and deployed.",
      now: [
        "Every document is versioned. Older versions are archived, not deleted — and search skips them by default.",
        "Answers always come from the text in force and name the exact regulation and article behind them.",
        "Precedence rules: higher law over lower, specific over general, newer over older.",
        "Historical wording can be requested explicitly — for “how did this work back in 2019”.",
      ],

      nextTitle: "What we are working on",
      nextTag: "In progress",
      nextIntro: "Not part of the deployment yet.",
      next: [
        "Automatic tracking of external sources — the statute book and official bulletins update themselves.",
        "Conflict alerts: an internal directive says something different from the law or implementing decree in force.",
        "An overview of which of your own rules an amendment touched and need reviewing.",
      ],
    },
    usecases: {
      navLabel: "Who it's for",
      eyebrow: "Who it's for",
      title: "What matters is the volume of regulation, not the headcount",
      subtitle:
        "A ten-person firm under construction law has the same problem as a ministry — with a smaller budget and nobody tracking the changes full time.",
      note:
        "Below are four typical situations and the questions people actually ask in them. If you recognise yourself in one, we can show you Contineo on your own documents.",

      benefitLabel: "What changes",
      questionsLabel: "This is how people ask",

      segments: [
        {
          icon: "layers",
          title: "Small and mid-sized firms",
          situation:
            "You have directives, product documentation and legislation to comply with — but no in-house counsel and nobody tracking every amendment. Documents sit on a drive, in email and in two people's heads. When one of them goes on holiday, work stops.",
          questions: [
            "What safety training must a new hire complete before starting?",
            "How long do we have to keep invoices, and in what form?",
            "Does our travel expense policy still match the current law?",
          ],
          answerNote: "The answer cites the specific directive or section and the version in force.",
          benefits: [
            "An answer in seconds instead of digging through folders or waiting for a colleague.",
            "Knowledge stops being tied to one person.",
            "You can see which of your directives cite a rule that has since changed.",
          ],
        },
        {
          icon: "quote",
          title: "Schools and education",
          situation:
            "Education law, ministry decrees, the founder's directives, internal rules and school board decisions. Each of those changes at its own pace and at its own time. A new teacher or administrator takes months to get oriented — mostly by asking colleagues.",
          questions: [
            "How many days of leave does a teaching staff member get?",
            "What is the procedure for a board examination?",
            "Who approves an individual education plan, and within what deadline?",
          ],
          answerNote: "It distinguishes what the law says from your internal rules — and which prevails.",
          benefits: [
            "Onboarding shortens from months to hours.",
            "The front office stops being a bottleneck for routine questions.",
            "Answers always come from the text in force, not an older file on a drive.",
          ],
        },
        {
          icon: "scale",
          title: "Associations and chambers",
          situation:
            "Your own rules sit on top of a statute that keeps changing. Members ask the same things over and over and the answer has to be right — decisions on transfers, sanctions or membership rest on it. A misquoted article is a complaint, not a typo.",
          questions: [
            "What is the deadline for filing an objection to a result?",
            "What is the transfer fee for a player aged 20+ from the third division?",
            "Who approves a minor's transfer to another club?",
          ],
          answerNote:
            "These are real questions from our deployment over the Slovak FA's regulations — answers cite article and paragraph.",
          benefits: [
            "Members get answers themselves, without phoning the secretariat.",
            "Every answer is backed by an article, so it can be verified — or challenged.",
            "Historical wording stays available for disputes about earlier periods.",
          ],
        },
        {
          icon: "shield",
          title: "Public administration",
          situation:
            "Acts, implementing decrees, internal management acts and methodological guidance. Plus a requirement that data must not leave the EU, or that the whole system runs inside your network. Ordinary cloud tools do not make the shortlist here.",
          questions: [
            "Which regulation sets the deadline for handling this submission?",
            "Did anything change in the methodology after the latest amendment?",
            "What does the internal management act say compared to the statute?",
          ],
          answerNote: "Also available in a mode where no text leaves your infrastructure.",
          benefits: [
            "On-premise deployment or a closed network with no internet connection.",
            "Documented processing location for every component — for audit and for procurement.",
            "Access rights follow your existing sign-in, with no new accounts to create.",
          ],
        },
      ],

      commonTitle: "Common to all four",
      commonText:
        "Answers always come from your content and state where they came from — the regulation, the article and the version. When the answer is not in the material, the system says so instead of inventing one. That is the difference between a tool you can use to decide something and a tool you can only use for inspiration.",
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
    identity: {
      eyebrow: "Identity & access",
      title: "User management and sign-in",
      subtitle: "Users sign in via your existing SSO and see exactly what they're entitled to — with no manual account creation.",
      providers: ["Microsoft Entra ID", "Google Workspace", "OAuth / OIDC", "sportnet.online (example)", "Own database"],
      providersLabel: "Supported identity providers",
      points: [
        { icon: "lock", title: "SSO and single sign-on", text: "Sign in via OAuth/OIDC — Microsoft Entra ID, Google Workspace, your own accounts or another identity provider. One canonical session across the whole system." },
        { icon: "refresh", title: "Automatic account provisioning", text: "Users, roles and groups are created automatically from a connected CRM / identity source. No manual account management — onboarding and offboarding happen on their own." },
        { icon: "layers", title: "Multi-tenant access", text: "A hierarchy of organisations (headquarters → regional → local units). Public content is visible to everyone; internal only to members of that unit, with per-document sharing." },
        { icon: "shield", title: "Security at query level", text: "An access right is a mandatory filter derived from the server-side session (default-deny). It is applied before the language model — it cannot be bypassed by a prompt. Audit on every change." },
      ],
    },
    tech: {
      navLabel: "Technology",
      eyebrow: "Technical solution",
      title: "Built on proven technology",
      subtitle:
        "Contineo combines semantic search (RAG) over your content with a language model that answers only from verified sources — with a citation and version.",
      exampleNote:
        "The examples on this page (sections, tags, queries) come from a generic company. Contineo is domain-agnostic — a “policy” is just one kind of document and a “unit” just one kind of organisation. For a real deployment into a large organisation, see the case study below.",
      back: "Back to home",
      architectureTitle: "Architecture and data flow",
      architectureCaption:
        "Input channels → processing (chunking + tagging) → MongoDB (the core: hybrid search) → AI adapters (embedding, rerank, generation) → interfaces. The core is identical in cloud and on-prem — $rankFusion runs the same way in Atlas and in self-hosted Community 8.2. Only three adapters differ, and they are selected by tenant configuration. The AI always receives just the relevant passages; your data stays in your database. Including two feedback loops: curation (quality control) and ticket escalation.",
      pillarsTitle: "Key pillars",
      pillars: [
        { icon: "search", title: "RAG + Hybrid Search", text: "The $rankFusion hybrid query (vector 60 % + fulltext 40 %) is the core of the system and runs identically in MongoDB Atlas and in self-hosted Community 8.2. Answers are produced only from the retrieved passages." },
        { icon: "layers", title: "Swappable AI adapters", text: "Embedding, rerank and generation are three independent adapters selected by tenant configuration, not by code. Cloud: Voyage and Claude. On-prem: Infinity or TEI and vLLM with the model of your choice (Qwen3, EuroLLM, Gemma)." },
        { icon: "quote", title: "Citations and versions", text: "Every answer states the source and version. A new import never loses the old one — always citing the valid wording." },
        { icon: "shield", title: "Multi-tenant and security", text: "A hierarchy of organisations (headquarters → regional → local units) as separate tenants. Public content is visible to everyone; internal content only to members of that unit. Audit trail on every knowledge change." },
        { icon: "layers", title: "Input channels (content & integrations)", text: "One layer through which content flows: PDF documents and policies, FAQs, websites (RSS), internal guidelines, MCP connectors (Drive, SharePoint, Confluence…) and e-mail (IMAP) — unified into one index. A connected identity source (e.g. sportnet.online) provides identity here, not content." },
        { icon: "ticket", title: "Helpdesk and e-mail", text: "Mailbox monitoring, ticketing and prepared replies with escalation from search." },
        { icon: "brain", title: "Quality control & curation", text: "Not machine learning of the model, but human curation: an admin rates and approves an answer, it is stored as a new pair (qa_pair) and embedded back. A new pair never silently overrides an approved document." },
      ],
      stackTitle: "Technology stack",
      stack: [
        "MongoDB — the core: $rankFusion (Atlas EU or Community 8.2)",
        "Cloud · Voyage AI voyage-4 — Automated Embedding",
        "Cloud · Voyage AI rerank-2.5 — $rerank in the database",
        "Cloud · Claude API — Citations, prompt caching",
        "On-prem · Infinity / TEI — embedding + rerank",
        "On-prem · vLLM — Qwen3, EuroLLM, Gemma",
        "Next.js 14 (App Router) · Node.js worker",
        "Integrations: e-mail (IMAP), identity/CRM source (e.g. sportnet.online), MCP connectors",
      ],
      flowsTitle: "Key data flows",
      flows: [
        { title: "Answering (RAG + Hybrid)", text: "The query is classified (fulltext / vector / hybrid). $rankFusion merges $vectorSearch and $search — identically in both modes. Rerank and generation are then handled by the adapter from the tenant profile: $rerank in the database and the Claude API in the cloud, Infinity and vLLM on-prem. The answer is streamed with a source citation." },
        { title: "Ticket escalation", text: "A failure = low similarity score or a negative rating. After 3 failures on the same topic the bot offers to create a ticket, including the full conversation context." },
        { title: "Quality control & curation", text: "Not machine learning but human curation: approved answers from ContineoLearning and edited e-mail replies are stored as a qa_pair and embedded back into the knowledge base. A new pair never silently overrides an approved document." },
      ],
      collectionsTitle: "Main collections",
      collectionsIntro: "The design separates knowledge (the RAG core) from conversations and tickets. Versioning ensures importing a new version never loses the older one.",
      collDocLabel: "document_chunks — the RAG core",
      collTicketLabel: "tickets",
      vectorTitle: "Hybrid search query ($rankFusion)",
      vectorIntro: "A question from unit “ACME-BA”, section internal policies, valid version only. $rankFusion combines vector (Voyage AI auto-embed) and fulltext search; $rerank orders results by relevance.",
      adaptersTitle: "Swappable adapters and the tenant profile",
      adaptersIntro:
        "Embedding, rerank and generation are three independent adapters. Which one is used is decided by a record in the tenant_profiles collection — not by code. A single installation therefore serves cloud and on-prem customers at the same time, on the same search core.",
      collProfileLabel: "tenant_profiles — adapter selection",
      parityTitle: "What differs between the modes",
      parityIntro: "The core is identical, but full feature parity does not exist. These are the differences to account for when choosing a mode.",
      parityHead: { cap: "Capability", cloud: "Cloud", onprem: "On-prem" },
      parity: [
        { cap: "$rankFusion hybrid search", cloud: "yes", onprem: "yes — identical" },
        { cap: "Automated embedding in the database", cloud: "yes", onprem: "calls the Voyage API — unusable air-gapped" },
        { cap: "$rerank inside the pipeline", cloud: "yes", onprem: "no — rerank in the application layer" },
        { cap: "Verifiable citations (Citations API)", cloud: "yes", onprem: "no — citations requested via the prompt" },
        { cap: "Prompt caching", cloud: "yes", onprem: "prefix caching in vLLM, different semantics" },
        { cap: "Data never leaves the perimeter", cloud: "no", onprem: "yes" },
      ],
      adrNote: "Vectors are not portable between models — changing the embedding model means a full re-embed of the corpus. The decision and its consequences are documented in ADR-001.",
      taggingTitle: "Content tagging",
      taggingIntro: "Every chunk answers three questions — what it is about (section), whom it applies to (company/scope) and which version. Values are picked from a controlled list, not free text.",
      taggingSectionsTitle: "Section list",
      sections: [
        { key: "vseobecne", label: "General information" },
        { key: "smernice", label: "Internal policies" },
        { key: "hr", label: "HR & people" },
        { key: "ekonomicke", label: "Finance" },
        { key: "it_aplikacie", label: "IT & applications" },
        { key: "gdpr", label: "GDPR & legal" },
      ],
      scopeTitle: "Scope of validity",
      scopes: [
        "scope: global + HQ (e.g. ACME) → applies company-wide",
        "scope: company + unit code → applies to that unit only",
        "scope: region → applies to a regional level",
      ],
      taggingExampleLabel: "Examples of tagged chunks",
      rulesTitle: "Rules for consistent tagging",
      rules: [
        "sectionKey and companyCode always from the list, never free text.",
        "Company-wide policies: HQ + scope global — don't copy per unit.",
        "Fill articleRef for policies — it's used in the citation.",
        "On a new version don't delete old chunks — set isActive: false + effectiveTo.",
      ],
      ticketTitle: "Ticket lifecycle",
      ticketIntro: "A ticket is created from the bot or e-mail and moves through states:",
      ticketStages: [
        { s: "new", t: "arrived, auto-triage in progress (section, unit, suggested reply)" },
        { s: "open", t: "assigned to an admin, being worked on" },
        { s: "waiting", t: "waiting for input from the requester (SLA paused)" },
        { s: "resolved", t: "reply sent; an edit on send = a new qa_pair" },
        { s: "closed", t: "closed; reopen returns to open" },
      ],
      integrationsTitle: "Integrations",
      integrations: [
        { title: "E-mail (IMAP)", text: "Two monitored mailboxes (tickets + standard questions); the worker routes them into a ticket or the learning flow." },
        { title: "Identity & CRM source (e.g. sportnet.online)", text: "Login via OAuth and a CRM as the source of truth about people and organisational units: users are created automatically, roles and groups follow membership in a unit/team (via a mapping table or manually). Contineo has its own database and doesn't write back. In the sports deployment this source is sportnet.online (see the case study)." },
        { title: "RSS / web", text: "For general information the worker periodically pulls RSS; new items → documents → chunks." },
        { title: "MCP connectors", text: "Pluggable sources via MCP — Google Drive, SharePoint, Confluence, Notion, Slack and more. Content is indexed like any other source." },
      ],
      securityTitle: "Security and operations",
      security: [
        "Access by membership in an organisation/unit and groups (automatically from a connected identity source, e.g. sportnet.online in sports); who may upload content is allow-listed manually. Audit trail on every knowledge change.",
        "SSO login: Microsoft Entra ID, Google Workspace (sportnet.online in sports too); public content also without login.",
        "A version citation in every answer and archiving of old document versions.",
        "Quality monitoring: score, escalation rate and ratings as feedback.",
        "Multi-tenant hierarchy (headquarters → regional → local units): public content visible to all, internal content isolated per organisation.",
        "Data privacy: content stays in your database and storage; the AI answers strictly from your content (RAG), no public consumer AI is used.",
        "Runtime mode chosen per tenant: cloud (EU residency, zero-retention agreement) or fully on-prem — neither content nor queries leave your infrastructure. A single installation serves both kinds of customer at once.",
      ],
      caseStudy: {
        eyebrow: "Case study",
        title: "Deployment in a large organisation — a sports association (SFZ)",
        intro: "Contineo is domain-agnostic. This is what one real deployment into a large organisation looks like — the Slovak Football Association and its subordinate associations.",
        points: [
          "Tenant hierarchy: SFZ → regional → district associations as separate organisations.",
          "Content: competition and transfer rules, fixtures, guidelines, IT FAQ (the ISSF app).",
          "Identity: login and CRM via sportnet.online (OAuth) — users and roles by membership in an association/club.",
          "Example question: “Can a player play in two matches in a single day?” → an answer citing the article and version.",
        ],
      },
      identity: {
        title: "Identity and access control",
        intro: "Sign-in via existing SSO; an access right is a mandatory filter derived from the session and applied to both branches of hybrid search ($vectorSearch and $search).",
        providersTitle: "Identity providers (NextAuth) → one canonical session",
        providers: [
          { name: "OAuth / OIDC", role: "primary login; in the sports deployment e.g. sportnet.online + source of memberships and roles" },
          { name: "Microsoft Entra ID", role: "SSO for employees' corporate accounts" },
          { name: "Google Workspace", role: "SSO (alternative)" },
          { name: "Identity source CRM / API", role: "source of truth about people and organisational units; mapping to companyCode, roles and groups" },
          { name: "Own database", role: "accounts outside SSO (credentials)" },
        ],
        principlesTitle: "Security principles",
        principles: [
          "Server-side only — the filter is built from the session, never from client parameters.",
          "Default-deny — anything not explicitly allowed is not returned; without identity, public content only.",
          "Filter before the LLM — the model sees only allowed chunks; it can't be bypassed by a prompt (applies to citations too).",
          "Auto-provisioning — users, roles and groups are created and synced from the CRM (login + webhook).",
        ],
        modesTitle: "Two deployment modes",
        modes: [
          { name: "Public widget", text: "anonymous; sees only public content across the whole hierarchy." },
          { name: "Internal portal (SSO)", text: "signed-in; sees public + internal content of the units they're related to." },
        ],
      },
    },
    cta: {
      title: "Ready to get your content at your fingertips?",
      subtitle: "We'll show you Contineo on your own sources.",
      button: "Get in touch",
      email: "office@contineo.app",
    },
    legal: {
      compliance: {
        heading: "Compliance & openness",
        license: "LGPL-2.1",
        eupl: "EUPL-1.2 compatible",
        reuse: "REUSE compliant",
        gdpr: "GDPR ready",
        wcag: "WCAG 2.1 AA",
      },
      privacy: {
        title: "Privacy",
        intro: "This is a template. Adapt it to your organisation and have it reviewed by a lawyer before publishing.",
        sections: [
          { h: "Controller", p: "Add your company name, registered seat and a contact e-mail (e.g. office@contineo.app)." },
          { h: "What we process", p: "This website uses no analytics or advertising cookies. It only stores your light/dark theme choice in the browser (localStorage), which is not personal data." },
          { h: "Customer content", p: "In the Contineo product your company's content stays in your database and storage. The AI layer receives only relevant passages; no public AI is used and public models are not trained on your data." },
          { h: "Legal basis and residency", p: "Processing supports EU residency and zero-retention with the AI provider, or a fully self-hosted deployment." },
          { h: "Your rights", p: "Under GDPR you have the right to access, rectify, erase, port your data and to object. Send requests to the contact e-mail." },
          { h: "Contact", p: "office@contineo.app" },
        ],
      },
      accessibility: {
        title: "Accessibility",
        intro: "Contineo is designed to meet WCAG 2.1 level AA.",
        points: [
          "Semantic structure (headings, landmarks, one main content per page).",
          "Visible focus for keyboard control and a “Skip to content” link.",
          "Sufficient colour contrast in both light and dark themes.",
          "Text alternatives for images and clear labels for controls.",
          "Respects the “reduce motion” setting (prefers-reduced-motion).",
        ],
        contactH: "Feedback",
        contact: "If you hit an accessibility barrier, e-mail us at office@contineo.app and we'll fix it.",
      },
    },
    footer: {
      tagline: "Ask your content.",
      overview: "What Contineo is",
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
      k: ["home", "office", "domu", "doma", "práca", "praca", "diaľku", "dialku"],
      q: "Koľko dní home office mám nárok mesačne?",
      a: "Zamestnanec má nárok na prácu z domu podľa internej smernice — štandardne až 10 dní mesačne po dohode s nadriadeným. Výnimky určuje vedúci útvaru.",
      src: "Smernica o práci z domu",
      art: "čl. 4 ods. 2",
      ver: "verzia 2026",
      rel: ["Ako požiadam o home office?", "Platí home office aj počas skúšobnej doby?"],
    },
    {
      k: ["dovolenka", "dovolenku", "termín", "termin", "žiadosť", "ziadost", "voľno", "volno"],
      q: "Dokedy treba podať žiadosť o dovolenku?",
      a: "Žiadosť o dovolenku sa podáva najneskôr 14 dní vopred cez interný systém. Pri kratšom termíne ju schvaľuje priamy nadriadený individuálne.",
      src: "Pracovný poriadok",
      art: "čl. 9",
      ver: "verzia 2026",
      rel: ["Koľko dní dovolenky mi zostáva?", "Ako prenesiem dovolenku do ďalšieho roka?"],
    },
    {
      k: ["heslo", "prihlás", "prihlas", "konto", "reset", "vpn"],
      q: "Ako si obnovím firemné heslo?",
      a: "Heslo si obnovíte cez tlačidlo „Zabudnuté heslo“ na prihlasovacej obrazovke firemného konta. Odkaz na obnovenie príde na váš pracovný e-mail.",
      src: "IT podpora",
      art: null,
      ver: "FAQ",
      rel: ["Nedostal som e-mail na obnovenie", "Ako si nastavím VPN?"],
    },
  ],
  en: [
    {
      k: ["home", "office", "remote", "work", "wfh"],
      q: "How many home-office days am I entitled to per month?",
      a: "Employees are entitled to remote work under the internal policy — typically up to 10 days per month by agreement with their manager. Exceptions are set by the department head.",
      src: "Remote work policy",
      art: "Art. 4 (2)",
      ver: "version 2026",
      rel: ["How do I request home office?", "Does home office apply during probation?"],
    },
    {
      k: ["leave", "vacation", "holiday", "deadline", "request"],
      q: "What's the deadline to request leave?",
      a: "Leave is requested at least 14 days in advance via the internal system. For shorter notice, your direct manager approves it individually.",
      src: "Work rules",
      art: "Art. 9",
      ver: "version 2026",
      rel: ["How much leave do I have left?", "How do I carry leave into next year?"],
    },
    {
      k: ["password", "login", "account", "reset", "vpn"],
      q: "How do I reset my company password?",
      a: "Reset your password via the “Forgotten password” button on the company login screen. The reset link is sent to your work e-mail.",
      src: "IT support",
      art: null,
      ver: "FAQ",
      rel: ["I didn't receive the reset e-mail", "How do I set up VPN?"],
    },
  ],
};
