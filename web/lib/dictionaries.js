// Poradie určuje aj poradie v prepínači jazykov.
export const locales = ["sk", "cs", "en"];

export const dictionaries = {
  sk: {
    locale: "sk",
    metaDescription:
      "RAG helpdesk s hybridným vyhľadávaním nad vaším obsahom. MongoDB $rankFusion, Voyage a Claude. EU hosting, GDPR. Odpoveď s citáciou zdroja.",
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
        "Contineo nájde odpoveď vo vašom vlastnom obsahu — v normách, smerniciach a interných predpisoch, ktoré do neho nahráte. Žiadne listovanie v zložkách, žiadne dohady z internetu. Len overená odpoveď odtiaľ, kde naozaj žije.",
      ctaPrimary: "Vyskúšať vyhľadávanie",
      ctaSecondary: "Ako to funguje",
      note: "Firemný portál na vašej subdoméne, prístupný po prihlásení cez SSO.",
    },
    manifesto: {
      eyebrow: "Prečo Contineo",
      text: "Roky sme sa učili hľadať — vypisovať kľúčové slová, otvárať desať záložiek, prehľadávať zložky. Contineo to obracia: jednoducho sa opýtate a dostanete odpoveď. A nie hocijakú — odpoveď z obsahu vašej firmy, s citáciou zdroja. Nie z internetu. Z vášho sveta.",
    },
    logos: "Postavené na MongoDB $rankFusion · Voyage AI · Claude · Next.js · EU hosting · GDPR",
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
          text: "Normy, smernice, interné predpisy a návody na jednom mieste. Žiadne prepínanie medzi systémami.",
        },
        {
          icon: "quote",
          title: "Odpovede s citáciou",
          text: "Každá odpoveď uvádza zdroj a verziu dokumentu. Žiadne dohady — len overený obsah.",
        },
        {
          icon: "ticket",
          title: "Kvalita odpovedí (ticketing pripravujeme)",
          text: "Keď odpoveď nesedí, čitateľ to jedným klikom nahlási a hodnotiteľ ju posúdi. Ticketing a e-mailový kanál pripravujeme ako ďalšiu vrstvu.",
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
          text: "Nahráte DOCX, PDF, XLSX alebo Markdown. Obsah sa prevedie, rozdelí a označí podľa témy a platnosti. Weby a ďalšie kanály pripravujeme.",
        },
        {
          n: "02",
          title: "Používateľ sa pýta",
          text: "Položí otázku prirodzeným jazykom v portáli Contineo, po prihlásení cez firemné SSO.",
        },
        {
          n: "03",
          title: "Contineo nájde a odpovie",
          text: "Prehľadá všetky zdroje a vygeneruje odpoveď len z overeného obsahu — s odkazom na zdroj a verziu.",
        },
        {
          n: "04",
          title: "Podpora a kurácia",
          text: "Keď odpoveď nesedí, čitateľ ju nahlási. Hodnotiteľ znenie opraví a správca obsahu ho vráti späť do znalostí ako overenú odpoveď.",
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
      noAnswerText: "Skúste ju preformulovať alebo nepresnosť nahláste.",
      escalateTitle: "Nenašli ste odpoveď? Nahláste to — pozrie sa na to hodnotiteľ.",
      sendTicket: "Nahlásiť nepresnosť",
      ticketDone: "Nahlásené. Hodnotiteľ to posúdi a znenie opraví.",
      appliesAll: "platí pre celú firmu (ACME)",
    },
    modes: {
      eyebrow: "Spôsoby nasadenia",
      title: "Ako sa Contineo nasadzuje",
      subtitle: "Dnes ako uzamknutý firemný portál na vašej subdoméne. Vložené vyhľadávanie do existujúcej stránky pripravujeme.",
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
        tag: "Vložené vyhľadávanie — pripravujeme",
        title: "Ikona vyhľadávania priamo vo vašej stránke",
        text: "Do existujúcej stránky pridáte ikonu Contineo. Po kliknutí sa rozbalí ako vrchná vrstva (overlay) a nahradí bežné vyhľadávanie na stránke. Zatiaľ neexistuje — dnes je Contineo portál za prihlásením.",
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
        "Jadro vyhľadávania je prenositeľné: $rankFusion je od verzie 8.2 aj v Community edícii, takže ten istý dotaz má bežať v oboch režimoch. Líšia sa tri vymeniteľné adaptéry, ktoré sa vyberajú konfiguráciou tenanta, nie zásahom do kódu. Dnes beží cloudová vetva; self-hosted zatiaľ overujeme a rerank v nej rieši aplikačná vrstva, nie databáza.",
      cloud: {
        tag: "Cloud",
        title: "Riadená prevádzka v EÚ",
        text: "MongoDB Atlas v európskom regióne, embedding aj rerank priamo v databáze, generovanie cez Claude API. Toto beží dnes. Žiadny nákup hardvéru — portál na vašej subdoméne spúšťame rádovo v dňoch, obsah plníte priebežne.",
        points: [
          "Automated Embedding — vektory vznikajú priamo v databáze",
          "Overiteľné citácie cez Citations API",
          "Bez vstupnej investície do hardvéru, platí sa za dotaz",
        ],
      },
      onprem: {
        tag: "On-prem — pripravujeme",
        title: "Uzavreté riešenie na vašom železe",
        text: "MongoDB Community 8.2 na vlastnom stroji, embedding a rerank cez Infinity alebo TEI, generovanie cez vLLM. Obsah ani dotazy by neopustili váš perimeter. Pripravujeme — adaptéry sú v kóde hotové; prvé nasadenie príde s hardvérom.",
        points: [
          "Navrhnuté pre citlivé interné predpisy — pre utajované skutočnosti treba samostatné posúdenie",
          "Voľba modelu — Qwen3, EuroLLM, Gemma a ďalšie",
          "Cieľom je prevádzka aj bez pripojenia na internet",
        ],
      },
      adaptersTitle: "Tri vymeniteľné adaptéry",
      cloudLabel: "Cloud",
      onpremLabel: "On-prem (pripravujeme)",
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
      note: "Voľba je na úrovni tenanta — jedna inštalácia je navrhnutá tak, aby obslúžila cloudových aj on-prem zákazníkov súčasne.",
    },
    security: {
      eyebrow: "Bezpečnosť dát",
      title: "Vaše dokumenty zostávajú v EÚ",
      subtitle: "Obsah beží v databáze v EÚ, oddelene pre každú organizáciu. Von ide len otázka a nájdené pasáže — do modelov, s ktorými máme zmluvu. Presný rozpis nájdete v sekcii Dátová rezidencia; nezakrývame ho.",
      points: [
        { icon: "lock", title: "Obsah v databáze v EÚ", text: "Dokumenty, indexy aj zálohy sú v MongoDB Atlas vo Frankfurte, oddelené pre každú organizáciu podmienkou v každom dotaze. Nie sú verejné a neindexuje ich internet." },
        { icon: "shield", title: "Žiadna verejná AI", text: "Nepoužívame verejnú spotrebiteľskú AI. Pri generovaní odpovede máme s Anthropic dohodnuté neuchovávanie a žiadne trénovanie na vašich dátach; pri embeddingu a preradení (Voyage cez Atlas) to ešte potvrdzujeme." },
        { icon: "search", title: "AI je len pomocník", text: "Jazykový model odpovedá výhradne z nájdených pasáží vášho obsahu (RAG) a pripája citáciu zdroja." },
        { icon: "layers", title: "Dnes cloud, on-prem pripravujeme", text: "Dnes beží cloud s databázou v EÚ. Plne on-prem režim, kde dáta neopustia váš perimeter, máme navrhnutý a adaptéry v kóde — nasadený zatiaľ nebol. Podrobný rozpis dátových tokov je v sekcii Dátová rezidencia." },
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
        "Režim je vlastnosť vašej organizácie, nie našej verzie. Rovnaká aplikácia, iná konfigurácia — a nepovolenú kombináciu systém odmietne spustiť. Dnes beží režim eu-data; ostatné tri sú pripravené v kóde a prvé nasadenie príde s hardvérom.",
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

      tiersTitle: "Druhá otázka: beží to len pre nás?",
      tiersIntro:
        "Režim vyššie hovorí, v ktorej krajine sa text spracúva. Nehovorí ale, či ho spracúva stroj vyhradený vám, alebo služba, ktorá v tej istej chvíli obsluhuje aj iných zákazníkov. Sú to dve nezávislé otázky a systém kontroluje obe.",
      tiersHead: {
        tier: "Úroveň",
        meaning: "Čo znamená",
        who: "Kedy to má zmysel",
      },
      tiers: [
        { key: "T1", name: "Zdieľaná",
          meaning: "Spoločná infraštruktúra. Vaše dokumenty sú oddelené prístupovými pravidlami, ale model, ktorý ich spracúva, obsluhuje aj iných.",
          who: "bežné komerčné nasadenie, malé a stredné firmy" },
        { key: "T2", name: "Vyhradená",
          meaning: "Embedding, rerank aj generovanie bežia na inštanciách, ktoré neobsluhujú nikoho iného. Váš text neprejde cez spoločný proces.",
          who: "banky, veľké spoločnosti, citlivé interné smernice" },
        { key: "T3", name: "Odpojená",
          meaning: "Ako vyhradená a navyše bez konektivity von. Vyžaduje režim air-gap — inak by odpojenie bolo len na papieri.",
          who: "utajované skutočnosti, uzavreté siete" },
      ],
      tiersNote:
        "Úrovne sa s režimami kombinujú, nie sú to stupne jednej škály: zdieľaná služba môže bežať celá v EÚ (T1 + eu-full) a vyhradená inštancia môže stáť kdekoľvek (T2 + global). A jedna vec, ktorú väčšina dodávateľov nepovie nahlas: vyhradený účet u poskytovateľa cloudu nie je vyhradený hardvér. Preto na úrovni T2 neprejde ani Claude cez AWS Bedrock, hoci beží vo Frankfurte — model tam obsluhuje aj ostatných.",

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
        "Pretože sa na to pri obstarávaní niekto spýta. Väčšina dodávateľov uvedie „dáta v EÚ“ a mlčí o tom, kde beží model — pritom práve tam ide text otázky aj nájdených pasáží. Každý riadok vyššie vieme doložiť dokumentom dodávateľa a ak sa stav zmení, zmeníme aj túto tabuľku. A rovno aj otvorený bod, ktorý nezakrývame: pri Voyage (embedding a rerank cez Atlas) zatiaľ nemáme písomne potvrdené neuchovávanie ani presný región spracovania.",
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
        { title: "Banky a veľké spoločnosti", text: "Skupinové politiky, lokálne smernice a regulácia nad tým. Jedna odpoveď naprieč pobočkami, doložená pre audit." },
        { title: "Verejná správa", text: "Zákony, vykonávacie predpisy a interné akty riadenia. Dáta a hosting v EÚ; on-prem a uzavretú sieť pripravujeme." },
        { title: "Podpora a interné návody", text: "Návody a časté otázky k aplikáciám na jednom mieste — ľudia nájdu odpoveď sami a menej vecí skončí na kolegoch." },
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
        "Novšie znenie má prednosť pred starším — odpoveď vychádza z verzie platnej k dnešku.",
      ],

      nextTitle: "Na čom pracujeme",
      nextTag: "Pripravujeme",
      nextIntro: "Zatiaľ nie je súčasťou nasadenia.",
      next: [
        "Čalšie pravidlá prednosti — vyššia norma pred nižšou, osobitná pred všeobecnou.",
        "Dotaz na historické znenie — archivované verzie sú uložené aj s dátumami platnosti, sprístupnenie vo vyhľadávaní pripravujeme.",
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
            "Každá odpoveď uvádza, z ktorej smernice a z ktorého článku pochádza — dá sa overiť aj spochybniť.",
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
          icon: "globe",
          title: "Banky, nadnárodné a veľké spoločnosti",
          situation:
            "Skupinové politiky sú po anglicky, lokálne smernice v jazyku krajiny a nad tým regulácia, ktorá sa mení každý rok. Zamestnanec v Bratislave nevie, či platí group policy alebo lokálny dodatok — a keď sa spýta, dostane od dvoch kolegov dve odpovede. Navyše hľadá po slovensky v dokumente, ktorý po slovensky nie je. Interný audit sa pýta to isté, len s väčšími dôsledkami.",
          questions: [
            "Ktorá verzia skupinovej politiky platí pre slovenskú pobočku?",
            "Aký je limit na schválenie výdavku bez druhého podpisu?",
            "Líši sa naša interná smernica od požiadavky regulátora?",
          ],
          answerNote:
            "Odpoveď rozlíši skupinovú politiku od lokálnej a povie, ktorá má v danom prípade prednosť.",
          benefits: [
            "Rovnaká odpoveď naprieč pobočkami — nie podľa toho, koho sa človek spýtal.",
            "Otázka po slovensky, zdroj po anglicky. Model významu aj jazykový model sú viacjazyčné a každý dokument nesie svoj jazyk ako údaj, takže sa dá filtrovať aj miešať.",
            "Každá odpoveď je doložená dokumentom, článkom a verziou, takže obstojí pri internom audite.",
            "Zaškolenie stoviek ľudí na novú politiku bez toho, aby ju všetci museli prečítať celú.",
            "Nasadenie v EÚ; plne on-prem režim pripravujeme — prvé príde s hardvérom.",
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
          answerNote: "Dnes v EÚ; režim, kde žiadny text neopustí vašu infraštruktúru, pripravujeme.",
          benefits: [
            "On-prem a uzavretá sieť bez pripojenia na internet — pripravujeme, prvé nasadenie príde s hardvérom.",
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
      providers: ["E-mailový odkaz", "Microsoft Entra ID", "Google Workspace"],
      providersLabel: "Poskytovatelia identity, ktorí dnes bežia (ďalších vieme doplniť)",
      points: [
        { icon: "lock", title: "SSO a jednotné prihlásenie", text: "Prihlásenie e-mailovým odkazom alebo cez SSO — Microsoft Entra ID a Google Workspace. Jedna kanonická session naprieč celým systémom; ďalších poskytovateľov OIDC vieme doplniť." },
        { icon: "refresh", title: "Automatické zakladanie účtov", text: "Osoba sa založí sama pri prvom prihlásení cez SSO, ak patrí do domény, ktorú organizácia povolila. Roly sa prideľujú v aplikácii; synchronizáciu rolí a skupín z CRM pripravujeme." },
        { icon: "layers", title: "Multi-tenant prístup", text: "Každá organizácia je samostatný priestor na vlastnej doméne. Verejný obsah vidia všetci prihlásení; interný len ľudia danej organizácie. Viacúrovňovú hierarchiu a menovité zdieľanie dokumentu inej organizácii pripravujeme." },
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
        "Vstupné kanály → spracovanie (chunking + značkovanie) → MongoDB (jadro: hybridné vyhľadávanie) → AI adaptéry (embedding, rerank, generovanie) → rozhrania. Jadro je prenositeľné — $rankFusion je aj v Community 8.2, takže ten istý dotaz má bežať v oboch režimoch; dnes beží cloudová vetva. Líšia sa len tri adaptéry, ktoré sa vyberajú konfiguráciou tenanta. AI dostane vždy len relevantné pasáže; dáta zostávajú vo vašej databáze. Spätný cyklus je jeden: ľudská kurácia — overená odpoveď sa vracia do indexu. Eskaláciu na ticket pripravujeme.",
      pillarsTitle: "Kľúčové piliere",
      pillars: [
        { icon: "search", title: "RAG + Hybrid Search", text: "Hybridné vyhľadávanie $rankFusion (vektor 60 % + fulltext 40 %) je jadro systému a beží identicky v MongoDB Atlas aj v self-hosted Community 8.2. Odpoveď vzniká výhradne z nájdených pasáží." },
        { icon: "layers", title: "Vymeniteľné AI adaptéry", text: "Embedding, rerank a generovanie sú tri nezávislé adaptéry vyberané konfiguráciou tenanta, nie kódom. Cloud: Voyage a Claude. On-prem: Infinity alebo TEI a vLLM s modelom podľa vášho výberu (Qwen3, EuroLLM, Gemma)." },
        { icon: "quote", title: "Citácie a verzie", text: "Každá odpoveď uvádza zdroj a verziu. Import novej verzie nestratí starú — cituje sa vždy platné znenie." },
        { icon: "shield", title: "Multi-tenant a bezpečnosť", text: "Hierarchia organizácií (centrála → regionálne → lokálne jednotky) ako samostatní tenanti. Verejný obsah vidia všetci; interný obsah len príslušníci danej jednotky. Audit pri každej zmene znalostí." },
        { icon: "layers", title: "Vstupné kanály (obsah aj integrácie)", text: "Jedna vrstva, ktorou tečie obsah. Dnes cez ňu ide nahratý súbor — DOCX, PDF, XLSX, Markdown, TXT, CSV — prevod beží u nás a všetko končí v jednom indexe. Čalšie kanály (weby a RSS, MCP konektory, e-mail) pripravujeme. Zdroj identity poskytuje identitu, nie obsah." },
        { icon: "ticket", title: "Helpdesk a e-mail (pripravujeme)", text: "Sledovanie e-mailových schránok, ticketing a predpripravené odpovede s eskaláciou z vyhľadávania. Zatiaľ nie je súčasťou nasadenia — dnes beží nahlásenie nepresnosti a fronta hodnotiteľa." },
        { icon: "brain", title: "Kontrola kvality a kurácia", text: "Nejde o strojové učenie modelu, ale o ľudskú kuráciu: správca ohodnotí a schváli odpoveď, tá sa uloží ako overená odpoveď a embeduje späť. Nová overená odpoveď nikdy potichu neprepíše schválený predpis." },
      ],
      stackTitle: "Technologický stack",
      stack: [
        "MongoDB — jadro: $rankFusion (Atlas EU alebo Community 8.2)",
        "Cloud · Voyage AI voyage-4 — Automated Embedding",
        "Cloud · Voyage AI rerank-2 — $rerank v databáze",
        "Cloud · Claude API — Citations, prompt caching",
        "Pripravené, nenasadené · Infinity / TEI — embedding + rerank",
        "Pripravené, nenasadené · vLLM — Qwen3, EuroLLM, Gemma",
        "Next.js 16 (App Router) · Vercel cron",
        "Pripravujeme: e-mail (IMAP), zdroj členstiev/CRM, MCP konektory",
      ],
      flowsTitle: "Kľúčové dátové toky",
      flows: [
        { title: "Odpovedanie (RAG + Hybrid)", text: "Dotaz sa klasifikuje (fulltext / vector / hybrid). $rankFusion zlúči $vectorSearch a $search — identicky v oboch režimoch. Rerank a generovanie potom obslúži adaptér podľa profilu tenanta: v cloude $rerank v databáze a Claude API, on-prem Infinity a vLLM. Odpoveď ide streamingom s citáciou zdroja." },
        { title: "Kvalita z prevádzky", text: "Pri každej odpovedi sa zaznamená „sedí / nesedí“ od čitateľa a prípadný popis, čo bolo zle. Nepresné odpovede idú do fronty hodnotiteľa (`/evaluation`). Eskaláciu na ticket pripravujeme." },
        { title: "Kontrola kvality a kurácia", text: "Nie strojové učenie, ale ľudská kurácia: hodnotiteľ prejde nahlásenú nepresnosť, overené znenie pripraví a správca obsahu ho zverejní — uloží sa do indexu ako samostatný úsek s prístupom odvodeným z najprísnejšieho zdroja. Overená odpoveď nikdy potichu neprepíše schválený predpis." },
      ],
      collectionsTitle: "Hlavné kolekcie",
      collectionsIntro: "Jadro RAG je kolekcia `document_chunks`. Verzovanie noriem zaručuje, že nové znenie nestratí staršie — staré úseky sa archivujú (`isActive: false`), nemažú sa. Schéma ticketov nižšie je návrh; kolekcia zatiaľ neexistuje.",
      collDocLabel: "document_chunks — jadro RAG",
      collTicketLabel: "tickets — návrh, zatiaľ neexistuje",
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
      ticketTitle: "Životný cyklus ticketu (pripravujeme)",
      ticketIntro: "Návrh, ktorý zatiaľ nie je súčasťou nasadenia. Ticket by vznikol z bota alebo z e-mailu a prechádzal stavmi:",
      ticketStages: [
        { s: "new", t: "prišiel, prebieha auto-triage (sekcia, jednotka, návrh odpovede)" },
        { s: "open", t: "priradený správcovi, pracuje sa naň" },
        { s: "waiting", t: "čaká sa na doplnenie od žiadateľa (SLA pozastavené)" },
        { s: "resolved", t: "odoslaná odpoveď; úprava pri odoslaní = nová overená odpoveď" },
        { s: "closed", t: "uzavretý; reopen vráti do open" },
      ],
      integrationsTitle: "Integrácie",
      integrations: [
        { title: "E-mail (IMAP) — pripravujeme", text: "Dve sledované schránky (tickety + štandardné otázky) smerované do ticketu alebo do učiaceho toku. Dnes systém poštu nečíta — odosiela len pozvánky a pripomienky." },
        { title: "Zdroj identity a CRM — pripravujeme", text: "Dnes: prihlásenie e-mailovým odkazom, cez Microsoft Entra ID alebo Google Workspace; osoba sa založí z domény povolenej organizáciou. Napojenie na členské CRM ako zdroj pravdy o osobách a jednotkách (v športe sportnet.online) pripravujeme; Contineo má vlastnú databázu a nezapisuje späť." },
        { title: "RSS / web — pripravujeme", text: "Periodické sťahovanie RSS a webov. Dnes sa obsah nahráva ako súbor a re-import je manuálny — je to vedomé rozhodnutie: predpis, ktorý sa zmenil sám od seba, nikto neschválil." },
        { title: "MCP konektory — pripravujeme", text: "Pripojiteľné zdroje cez MCP — Google Drive, SharePoint, Confluence, Notion, Slack a ďalšie. Navrhnuté; dnes sa obsah nahráva priamo." },
      ],
      securityTitle: "Bezpečnosť a prevádzka",
      security: [
        "Prístup podľa príslušnosti k organizácii: verejný obsah vidí každý prihlásený, interný len ľudia danej organizácie. Kto smie nahrávať obsah, sa povoľuje ručne. Audit pri každej zmene znalostí.",
        "Prihlásenie e-mailovým odkazom alebo cez SSO: Microsoft Entra ID a Google Workspace. Bez prihlásenia sa dnes k obsahu nedostanete — verejný anonymný režim pripravujeme.",
        "Citácia verzie v každej odpovedi a archivácia starých verzií predpisov.",
        "Monitoring kvality: skóre vyhľadávania, hodnotenia „sedí / nesedí“ a nahlásené nepresnosti — kvalita sa meria z prevádzky, nie z testovacej sady.",
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
          "Identita: prihlásenie e-mailovým odkazom, cez Microsoft Entra ID alebo Google Workspace; roly sa prideľujú v aplikácii. Napojenie na sportnet.online ako zdroj členstiev je ďalší krok.",
          "Príklad otázky: „Môže hráč nastúpiť v dvoch stretnutiach za jeden deň?“ → odpoveď s citáciou § a verzie.",
        ],
      },
      identity: {
        title: "Identita a riadenie prístupu",
        intro: "Prihlásenie cez existujúce SSO; prístupové právo je povinný filter odvodený zo session a aplikovaný na obe vetvy hybridného vyhľadávania ($vectorSearch aj $search).",
        providersTitle: "Poskytovatelia identity (NextAuth) → jedna kanonická session",
        providers: [
          { name: "E-mailový odkaz", role: "prihlásenie bez hesla; používa sa aj na pozvánky" },
          { name: "Microsoft Entra ID", role: "SSO pre firemné účty zamestnancov" },
          { name: "Google Workspace", role: "SSO (alternatíva)" },
          { name: "CRM / zdroj členstiev — pripravujeme", role: "napr. sportnet.online: zdroj pravdy o osobách a jednotkách, mapovanie na companyCode, roly a skupiny" },
        ],
        principlesTitle: "Princípy bezpečnosti",
        principles: [
          "Server-side only — filter sa skladá zo session, nikdy z parametrov klienta.",
          "Default-deny — čo nie je výslovne povolené, sa nevráti; bez identity len verejný obsah.",
          "Filter pred LLM — model vidí len povolené chunky; nedá sa obísť promptom (platí aj pre citácie).",
          "Auto-provisioning — osoba sa založí pri prvom prihlásení cez SSO z domény povolenej organizáciou. Priebežnú synchronizáciu rolí z CRM pripravujeme.",
        ],
        modesTitle: "Režimy nasadenia",
        modes: [
          { name: "Interný portál (SSO)", text: "dnes jediný režim: prihlásený človek vidí verejný aj interný obsah svojej organizácie." },
          { name: "Verejný widget — pripravujeme", text: "anonymný prístup len k verejnému obsahu. Zatiaľ neexistuje — bez prihlásenia sa dnes k obsahu nedostanete." },
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
      ownerLabel: "Projekt vlastní a vyvíja",
      ownerName: "LTK Solutions",
      ownerUrl: "https://ltk.solutions",
    },
  },

  cs: {
    locale: "cs",
    metaDescription:
      "RAG helpdesk s hybridním vyhledáváním nad vaším obsahem. MongoDB $rankFusion, Voyage a Claude. EU hosting, GDPR. Odpověď s citací zdroje.",
    nav: {
      features: "Funkce",
      how: "Jak to funguje",
      demo: "Demo",
      audience: "Pro koho",
      roadmap: "Připravujeme",
      modes: "Nasazení",
      overview: "Co je Contineo",
      versions: "Verze",
      runtime: "Provoz",
      identity: "Identita",
      security: "Bezpečnost",
      cta: "Vyzkoušet",
    },
    hero: {
      badge: "Inteligentní vyhledávání a helpdesk nad vaším obsahem",
      title: "Zeptejte se. Nehledejte.",
      claim: "Odpovědi z vašeho světa, ne z internetu.",
      subtitle:
        "Contineo najde odpověď ve vašem vlastním obsahu — v normách, směrnicích a interních předpisech, které do něj nahrajete. Žádné listování ve složkách, žádné dohady z internetu. Jen ověřená odpověď odtud, kde skutečně žije.",
      ctaPrimary: "Vyzkoušet vyhledávání",
      ctaSecondary: "Jak to funguje",
      note: "Firemní portál na vaší subdoméně, přístupný po přihlášení přes SSO.",
    },
    manifesto: {
      eyebrow: "Proč Contineo",
      text: "Roky jsme se učili hledat — vypisovat klíčová slova, otevírat deset záložek, prohledávat složky. Contineo to obrací: prostě se zeptáte a dostanete odpověď. A ne ledajakou — odpověď z obsahu vaší firmy, s citací zdroje. Ne z internetu. Z vašeho světa.",
    },
    logos: "Postaveno na MongoDB $rankFusion · Voyage AI · Claude · Next.js · EU hosting · GDPR",
    features: {
      eyebrow: "Funkce",
      title: "Jedno místo pro všechen firemní obsah",
      items: [
        {
          icon: "search",
          title: "Inteligentní vyhledávání",
          text: "Sémantické hledání napříč všemi zdroji najednou. Uživatel píše přirozeně, Contineo najde podstatu.",
        },
        {
          icon: "layers",
          title: "Všechny zdroje pohromadě",
          text: "Normy, směrnice, interní předpisy a návody na jednom místě. Žádné přepínání mezi systémy.",
        },
        {
          icon: "quote",
          title: "Odpovědi s citací",
          text: "Každá odpověď uvádí zdroj a verzi dokumentu. Žádné dohady — jen ověřený obsah.",
        },
        {
          icon: "ticket",
          title: "Kvalita odpovědí (ticketing připravujeme)",
          text: "Když odpověď nesedí, čtenář to jedním klikem nahlásí a hodnotitel ji posoudí. Ticketing a e-mailový kanál připravujeme jako další vrstvu.",
        },
        {
          icon: "brain",
          title: "Učí se z odpovědí",
          text: "Schválené odpovědi správců se stávají novou znalostí. Systém je každým dnem přesnější.",
        },
        {
          icon: "shield",
          title: "Odděleno pro každou firmu",
          text: "Multi-tenant architektura — obsah a přístupy každé organizace jsou bezpečně odděleny.",
        },
      ],
    },
    how: {
      eyebrow: "Jak to funguje",
      title: "Od otázky k ověřené odpovědi",
      steps: [
        {
          n: "01",
          title: "Připojíte zdroje",
          text: "Nahrajete DOCX, PDF, XLSX nebo Markdown. Obsah se převede, rozdělí a označí podle tématu a platnosti. Weby a další kanály připravujeme.",
        },
        {
          n: "02",
          title: "Uživatel se ptá",
          text: "Položí otázku přirozeným jazykem v portálu Contineo, po přihlášení přes firemní SSO.",
        },
        {
          n: "03",
          title: "Contineo najde a odpoví",
          text: "Prohledá všechny zdroje a vygeneruje odpověď jen z ověřeného obsahu — s odkazem na zdroj a verzi.",
        },
        {
          n: "04",
          title: "Podpora a kurace",
          text: "Když odpověď nesedí, čtenář ji nahlásí. Hodnotitel znění opraví a správce obsahu ho vrátí zpět do znalostí jako ověřenou odpověď.",
        },
      ],
    },
    demo: {
      eyebrow: "Živé demo",
      title: "Zkuste, jak to vypadá pro uživatele",
      subtitle:
        "Toto je ukázka inteligentního vyhledávání se vzorovými daty. Zkuste „home office“, „dovolená termín“ nebo „reset hesla“.",
      placeholder: "Zeptejte se na cokoli z vašeho obsahu…",
      brand: "inteligentní vyhledávání",
      poweredBy: "Pohání Contineo · odpovědi z ověřeného obsahu",
      question: "Otázka",
      helpful: "Pomohla odpověď?",
      yes: "Ano",
      no: "Ne",
      thanks: "Děkujeme za zpětnou vazbu.",
      sorry: "Mrzí nás to — zkusíme to upřesnit.",
      related: "Související otázky",
      noAnswerTitle: "Na tuto otázku zatím nemám ověřenou odpověď.",
      noAnswerText: "Zkuste ji přeformulovat nebo otázku pošlete správci.",
      escalateTitle: "Nenašli jste odpověď? Nahlaste to — podívá se na to hodnotitel.",
      sendTicket: "Nahlásit nepřesnost",
      ticketDone: "Nahlášeno. Hodnotitel to posoudí a znění opraví.",
      appliesAll: "platí pro celou firmu (ACME)",
    },
    modes: {
      eyebrow: "Způsoby nasazení",
      title: "Jak se Contineo nasazuje",
      subtitle: "Dnes jako uzamčený firemní portál na vaší subdoméně. Vložené vyhledávání do existující stránky připravujeme.",
      intranet: {
        tag: "Intranet",
        title: "Samostatný portál na subdoméně",
        text: "Vyhledávání a portál s firemním obsahem na vaší subdoméně (např. hledej.vasefirma.cz). Uzamykatelné jen pro přihlášené interní uživatele.",
        points: [
          "Přihlášení přes Microsoft Entra, Google Workspace či jiné SSO vázané na doménu",
          "Přístup jen pro interní uživatele organizace",
          "Portál s přehledem firemního obsahu na jednom místě",
        ],
      },
      embed: {
        tag: "Vložené vyhledávání — připravujeme",
        title: "Ikona vyhledávání přímo ve vaší stránce",
        text: "Do existující stránky přidáte ikonu Contineo. Po kliknutí se rozbalí jako vrchní vrstva (overlay) a nahradí běžné vyhledávání na stránce. Zatím neexistuje — dnes je Contineo portál za přihlášením.",
        points: [
          "Jeden řádek kódu, žádné zásahy do obsahu stránky",
          "Overlay v designu Contineo, sedne do světlé i tmavé stránky",
          "Ideální jako náhrada vyhledávání na veřejném webu",
        ],
        demoHint: "Vyzkoušejte: klikněte na ikonu vyhledávání v ukázkové stránce.",
      },
      site: {
        name: "Vaše stránka",
        nav: ["Domů", "Novinky", "Dokumenty", "Kontakt"],
        headline: "Ukázková stránka",
        sub: "Toto je jen demonstrační pozadí. Vpravo nahoře je ikona vyhledávání Contineo.",
        cards: ["Aktuality", "Dokumenty", "Projekty"],
        placeholder: "Zeptejte se na cokoli z obsahu stránky…",
        close: "Zavřít",
        poweredBy: "Pohání Contineo",
      },
    },
    runtime: {
      eyebrow: "Provozní režimy",
      title: "Stejná aplikace v cloudu i za zamčenými dveřmi",
      subtitle:
        "Jádro vyhledávání je přenositelné: $rankFusion je od verze 8.2 i v Community edici, takže týž dotaz má běžet v obou režimech. Liší se tři vyměnitelné adaptéry, které se vybírají konfigurací tenanta, ne zásahem do kódu. Dnes běží cloudová větev; self-hosted zatím ověřujeme a rerank v ní řeší aplikační vrstva, ne databáze.",
      cloud: {
        tag: "Cloud",
        title: "Řízený provoz v EU",
        text: "MongoDB Atlas v evropském regionu, embedding i rerank přímo v databázi, generování přes Claude API. Toto běží dnes. Žádný nákup hardwaru — portál na vaší subdoméně spouštíme řádově v dnech, obsah plníte průběžně.",
        points: [
          "Automated Embedding — vektory vznikají přímo v databázi",
          "Ověřitelné citace přes Citations API",
          "Bez vstupní investice do hardwaru, platí se za dotaz",
        ],
      },
      onprem: {
        tag: "On-prem — připravujeme",
        title: "Uzavřené řešení na vašem železe",
        text: "MongoDB Community 8.2 na vlastním stroji, embedding a rerank přes Infinity nebo TEI, generování přes vLLM. Obsah ani dotazy by neopustily váš perimetr. Připravujeme — adaptéry jsou v kódu hotové; první nasazení přijde s hardwarem.",
        points: [
          "Navrženo pro citlivé interní předpisy — pro utajované skutečnosti je třeba samostatné posouzení",
          "Volba modelu — Qwen3, EuroLLM, Gemma a další",
          "Cílem je provoz i bez připojení k internetu",
        ],
      },
      adaptersTitle: "Tři vyměnitelné adaptéry",
      cloudLabel: "Cloud",
      onpremLabel: "On-prem (připravujeme)",
      adapters: [
        {
          name: "Embedding",
          co: "Rozumí významu, ne jen slovům",
          popis:
            "Převede každý odstavec na číselný otisk významu. Díky tomu najde správnou pasáž, i když jste použili jiná slova než předpis — na otázku „kolik se platí za přestup“ vrátí článek o odstupném.",
          cloud: "Atlas Automated Embedding (voyage-4)",
          onprem: "Infinity / TEI (voyage-4-nano, BGE-M3)",
        },
        {
          name: "Rerank",
          co: "Druhé čtení, které upraví pořadí",
          popis:
            "První hledání je rychlé, ale hrubé — projde tisíce odstavců a vybere desítky kandidátů. Rerank je přečte pozorně spolu s otázkou a přeuspořádá tak, aby úplně nahoře skončilo to nejpřesnější.",
          cloud: "$rerank přímo v databázi (rerank-2)",
          onprem: "Infinity / TEI (BGE-reranker-v2-m3)",
        },
        {
          name: "Generování",
          co: "Složí odpověď a doloží, odkud je",
          popis:
            "Z nalezených pasáží napíše odpověď běžnou řečí a ke každému tvrzení připojí předpis a článek, ze kterého čerpá. Když odpověď v podkladech není, řekne to — místo toho, aby si ji vymyslel.",
          cloud: "Claude API (Citations, prompt caching)",
          onprem: "vLLM (Qwen3, EuroLLM, Gemma)",
        },
      ],
      note: "Volba je na úrovni tenanta — jedna instalace obslouží cloudové i on-prem zákazníky současně.",
    },
    security: {
      eyebrow: "Bezpečnost dat",
      title: "Vaše dokumenty zůstávají v EU",
      subtitle: "Obsah běží v databázi v EU, odděleně pro každou organizaci. Ven jde jen dotaz a nalezené pasáže — do modelů, se kterými máme smlouvu. Přesný rozpis najdete v sekci Datová rezidence; nezakrýváme ho.",
      points: [
        { icon: "lock", title: "Obsah v databázi v EU", text: "Dokumenty, indexy i zálohy jsou v MongoDB Atlas ve Frankfurtu, oddělené pro každou organizaci podmínkou v každém dotazu. Nejsou veřejné a neindexuje je internet." },
        { icon: "shield", title: "Žádná veřejná AI", text: "Nepoužíváme veřejnou spotřebitelskou AI. Při generování odpovědi máme s Anthropic dohodnuté neuchovávání a žádné trénování na vašich datech; u embeddingu a přeřazení (Voyage přes Atlas) to ještě potvrzujeme." },
        { icon: "search", title: "AI je jen pomocník", text: "Jazykový model odpovídá výhradně z nalezených pasáží vašeho obsahu (RAG) a připojuje citaci zdroje." },
        { icon: "layers", title: "Dnes cloud, on-prem připravujeme", text: "Dnes běží cloud s databází v EU. Plně on-prem režim, kde data neopustí váš perimetr, máme navržený a adaptéry v kódu — nasazený zatím nebyl. Podrobný rozpis datových toků je v sekci Datová rezidence." },
      ],
    },
    residency: {
      navLabel: "Bezpečnost",
      eyebrow: "Datová rezidence",
      title: "Kam se dostane váš text",
      subtitle:
        "Ne kde leží data, ale kde se zpracovávají. Ten rozdíl rozhoduje o tom, zda projdete tendrem — a většina dodavatelů ho zamlčí.",
      levels: [
        {
          icon: "globe",
          title: "1 · Data v klidu v EU",
          text: "Databáze, indexy a zálohy jsou v EU. Volání AI modelů ven je přípustné při zpracovatelské smlouvě a standardních smluvních doložkách.",
          who: "běžné komerční nasazení",
        },
        {
          icon: "shield",
          title: "2 · Nic neopustí EU",
          text: "I modely běží v EU — včetně otázek, které píší vaši lidé. Není to požadavek GDPR, ale bývá v zadávacích podmínkách.",
          who: "veřejná správa, větší firmy",
        },
        {
          icon: "lock",
          title: "3 · Nic neopustí perimetr",
          text: "Celý systém běží na vaší infrastruktuře. Bez konektivity ven, pokud je to potřeba.",
          who: "utajované skutečnosti, uzavřené sítě",
        },
      ],
      levelsNote:
        "Úroveň 1 je právně v pořádku — GDPR přenos mimo EU nezakazuje, jen ho podmiňuje. Ale pokud je v zadání napsáno „údaje nesmí opustit EU“, je to organizační požadavek, který smlouvou nevyřešíte. Kdo umí nabídnout jen úroveň 1, bývá vyřazen formálně, ne věcně.",

      modesTitle: "Režimy, které umíme nasadit",
      modesIntro:
        "Režim je vlastnost vaší organizace, ne naší verze. Stejná aplikace, jiná konfigurace — a nepovolenou kombinaci systém odmítne spustit. Dnes běží režim eu-data; ostatní tři jsou připravené v kódu a první nasazení přijde s hardwarem.",
      modesHead: {
        mode: "Režim",
        meaning: "Co znamená",
        embedding: "Embedding",
        rerank: "Rerank",
        generation: "Generování",
      },
      modes: [
        { key: "eu-data", meaning: "Data v EU, zpracování může být mimo",
          embedding: "MongoDB Atlas", rerank: "MongoDB Atlas", generation: "Claude API" },
        { key: "eu-full", meaning: "Žádný text neopustí EU",
          embedding: "vlastní služba", rerank: "vlastní služba", generation: "vlastní model" },
        { key: "on-prem", meaning: "Vše na vaší infrastruktuře",
          embedding: "vlastní služba", rerank: "vlastní služba", generation: "vlastní model" },
        { key: "air-gap", meaning: "Uzavřená síť bez konektivity ven",
          embedding: "vlastní služba", rerank: "vlastní služba", generation: "vlastní model" },
      ],

      tiersTitle: "Druhá otázka: běží to jen pro nás?",
      tiersIntro:
        "Režim výše říká, ve které zemi se text zpracovává. Neříká ale, jestli ho zpracovává stroj vyhrazený vám, nebo služba, která ve stejnou chvíli obsluhuje i jiné zákazníky. Jsou to dvě nezávislé otázky a systém kontroluje obě.",
      tiersHead: {
        tier: "Úroveň",
        meaning: "Co znamená",
        who: "Kdy to dává smysl",
      },
      tiers: [
        { key: "T1", name: "Sdílená",
          meaning: "Společná infrastruktura. Vaše dokumenty jsou oddělené přístupovými pravidly, ale model, který je zpracovává, obsluhuje i jiné.",
          who: "běžné komerční nasazení, malé a střední firmy" },
        { key: "T2", name: "Vyhrazená",
          meaning: "Embedding, rerank i generování běží na instancích, které neobsluhují nikoho jiného. Váš text neprojde společným procesem.",
          who: "banky, velké společnosti, citlivé interní směrnice" },
        { key: "T3", name: "Odpojená",
          meaning: "Jako vyhrazená a navíc bez konektivity ven. Vyžaduje režim air-gap — jinak by odpojení bylo jen na papíře.",
          who: "utajované skutečnosti, uzavřené sítě" },
      ],
      tiersNote:
        "Úrovně se s režimy kombinují, nejsou to stupně jedné škály: sdílená služba může běžet celá v EU (T1 + eu-full) a vyhrazená instance může stát kdekoli (T2 + global). A jedna věc, kterou většina dodavatelů nahlas neřekne: vyhrazený účet u poskytovatele cloudu není vyhrazený hardware. Proto na úrovni T2 neprojde ani Claude přes AWS Bedrock, přestože běží ve Frankfurtu — model tam obsluhuje i ostatní.",

      whereTitle: "Kde zpracování probíhá — včetně toho, co ověřujeme",
      whereIntro:
        "Každý řádek je doložen veřejným dokumentem dodavatele, ne odhadem. Komponenty zpracovávající mimo EU se v režimech eu-full, on-prem a air-gap nepoužijí — profil s takovou kombinací se odmítne spustit.",
      whereHead: {
        component: "Komponenta",
        provider: "Poskytovatel",
        location: "Lokalita zpracování",
        evidence: "Podklad",
      },
      where: [
        { component: "Databáze, indexy, zálohy", provider: "MongoDB Atlas",
          location: "EU (Frankfurt)", stav: "ok",
          evidence: "volba regionu při založení clusteru" },
        { component: "Hybridní vyhledávání", provider: "mongot v clusteru",
          location: "EU (Frankfurt)", stav: "ok",
          evidence: "počítá se přímo v clusteru" },
        { component: "Reranking", provider: "$rerank (Voyage)",
          location: "mimo EU (USA)", stav: "mimo",
          evidence: "uvedeno v nastavení projektu Atlas" },
        { component: "Embedding", provider: "Atlas Automated Embedding",
          location: "mimo EU (USA)", stav: "mimo",
          evidence: "seznam subprocesorů MongoDB: Google LLC, United States" },
        { component: "Generování odpovědi", provider: "Anthropic Claude (přímé API)",
          location: "mimo EU (USA)", stav: "mimo",
          evidence: "zpracování v americké infrastruktuře" },
        { component: "Generování odpovědi", provider: "Claude přes AWS Bedrock / Vertex AI",
          location: "EU (Frankfurt, Irsko, Paříž)", stav: "ok",
          evidence: "volba regionu při nasazení" },
        { component: "Embedding, rerank, generování", provider: "vlastní služby (on-prem)",
          location: "vaše infrastruktura", stav: "ok",
          evidence: "běží u vás" },
      ],

      honestyTitle: "Proč to vypisujeme takto podrobně.",
      honestyText:
        "Protože se na to při zadávacím řízení někdo zeptá. Většina dodavatelů uvede „data v EU“ a mlčí o tom, kde běží model — přitom právě tam jde text otázky i nalezených pasáží. Každý řádek výše umíme doložit dokumentem dodavatele a pokud se stav změní, změníme i tuto tabulku.",
      legalNote:
        "Tato stránka je technický popis datových toků, ne právní posouzení. U konkrétního nasazení doporučujeme posouzení odborníkem na ochranu osobních údajů.",
    },
    audience: {
      eyebrow: "Pro koho",
      title: "Není to nástroj jen pro velké organizace",
      subtitle:
        "Rozhoduje množství předpisů, ne počet zaměstnanců. Desetičlenná firma se stavební legislativou má stejný problém jako ministerstvo — jen menší rozpočet a nikoho, kdo by to sledoval na plný úvazek.",
      items: [
        { title: "Malé a střední firmy", text: "Interní směrnice, návody k produktům a legislativa, kterou musíte dodržovat. Bez vlastního právníka a bez člověka, který by sledoval každou novelu." },
        { title: "Školy a instituce", text: "Školský zákon, vyhlášky, vnitřní řády a směrnice zřizovatele. Nový učitel nebo administrativní pracovník se zorientuje za hodinu, ne za měsíce." },
        { title: "Svazy a komory", text: "Vlastní předpisy navazující na zákon, který se mění. Členové se ptají stále na totéž — a odpověď musí sedět s platným zněním." },
        { title: "Banky a velké společnosti", text: "Skupinové politiky, lokální směrnice a regulace nad tím. Jedna odpověď napříč pobočkami, doložená pro audit." },
        { title: "Veřejná správa", text: "Zákony, prováděcí předpisy a interní akty řízení. Data a hosting v EU; on-prem a uzavřenou síť připravujeme." },
        { title: "Podpora a helpdesk", text: "Návody a FAQ k aplikacím — méně opakovaných ticketů, více vyřešeného samoobslužně." },
        { title: "Noví i zkušení zaměstnanci", text: "Odpověď s odkazem na konkrétní článek. Nový se zaučí rychleji, zkušený nemusí odpovídat na totéž popáté." },
      ],
      more: "Podívat se na konkrétní situace a otázky",
    },
    versions: {
      eyebrow: "Verze a platné znění",
      title: "Problém není najít předpis. Problém je vědět, který platí.",
      subtitle:
        "Zákon se novelizuje, vyhláška se mění, interní směrnice zaostane o dva roky. Ve složce leží pět souborů s podobným názvem a nikdo si netroufá říct, který je ten správný.",

      exampleTitle: "Konkrétně:",
      exampleText:
        "zákoník práce prošel od roku 2006 desítkami novel — jen velká novela v roce 2023 změnila desítky paragrafů. Kdo se ve firmě ptá „jak to je dnes“, dostane odpověď podle toho, koho se zeptal a kterou verzi si stáhl. Totéž platí pro stavební zákon i školský zákon.",

      problems: [
        {
          icon: "layers",
          title: "Pět verzí, jedna platná",
          text: "Novely, úplná znění, pracovní verze a přílohy se hromadí. Bez evidence verzí je hledání loterie — a odpověď z neplatného znění vypadá stejně důvěryhodně jako správná.",
        },
        {
          icon: "scale",
          title: "Interní normy zaostávají za zákonem",
          text: "Směrnice se napíše jednou a pak se na ni zapomene. Zákon se mezitím změní a v organizaci platí dva rozporné texty — jeden ze zákona, druhý z vlastního předpisu.",
        },
        {
          icon: "help",
          title: "Nový člověk nemá šanci",
          text: "Zorientovat se v desítkách předpisů trvá měsíce. Otázky proto míří na jednoho dva zkušené kolegy, kteří odpovídají stále totéž — a když odejdou, znalost odejde s nimi.",
        },
      ],

      nowTitle: "Co Contineo řeší dnes",
      nowIntro: "Funguje a je nasazeno.",
      now: [
        "Každý dokument má verze. Starší se archivují, ale nemažou — vyhledávání je ve výchozím stavu přeskočí.",
        "Odpověď vždy vychází z platného znění a uvádí konkrétní předpis i článek, ze kterého čerpá.",
        "Novější znění má přednost před starším — odpověď vychází z verze platné k dnešku.",
      ],

      nextTitle: "Na čem pracujeme",
      nextTag: "Připravujeme",
      nextIntro: "Zatím není součástí nasazení.",
      next: [
        "Další pravidla přednosti — vyšší norma před nižší, zvláštní před obecnou.",
        "Dotaz na historické znění — archivované verze jsou uložené i s daty platnosti, zpřístupnění ve vyhledávání připravujeme.",
        "Automatické sledování externích zdrojů — Sbírka zákonů a věstníky se aktualizují samy.",
        "Upozornění na rozpor: interní směrnice říká něco jiného než platný zákon nebo prováděcí předpis.",
        "Přehled, kterých vlastních předpisů se novela dotkla a je třeba je projít.",
      ],
    },
    usecases: {
      navLabel: "Pro koho",
      eyebrow: "Pro koho",
      title: "Rozhoduje množství předpisů, ne počet zaměstnanců",
      subtitle:
        "Desetičlenná firma se stavební legislativou má stejný problém jako ministerstvo — jen menší rozpočet a nikoho, kdo by změny sledoval na plný úvazek.",
      note:
        "Níže je pět typických situací a otázky, které v nich lidé skutečně kladou. Pokud se v některé poznáváte, Contineo vám umíme ukázat přímo na vašich dokumentech.",

      benefitLabel: "Co se změní",
      questionsLabel: "Takto se lidé ptají",

      segments: [
        {
          icon: "layers",
          title: "Malé a střední firmy",
          situation:
            "Máte směrnice, návody k produktům a legislativu, kterou musíte dodržovat — ale nemáte právníka ani nikoho, kdo by sledoval každou novelu. Dokumenty leží na disku, v e-mailech a v hlavách dvou lidí. Když jeden z nich odjede na dovolenou, práce se zastaví.",
          questions: [
            "Jaké školení BOZP musí absolvovat nový zaměstnanec před nástupem?",
            "Jak dlouho musíme archivovat faktury a v jaké formě?",
            "Platí naše směrnice o cestovních náhradách ještě podle aktuálního zákona?",
          ],
          answerNote: "Odpověď cituje konkrétní směrnici nebo paragraf a její platnou verzi.",
          benefits: [
            "Odpověď během sekund místo hledání ve složkách nebo čekání na kolegu.",
            "Znalost přestane být vázaná na jednoho člověka.",
            "Každá odpověď uvádí, ze které směrnice a z kterého článku pochází — dá se ověřit i zpochybnit.",
          ],
        },
        {
          icon: "quote",
          title: "Školy a vzdělávací instituce",
          situation:
            "Školský zákon, vyhlášky ministerstva, směrnice zřizovatele, vnitřní řád a rozhodnutí školské rady. Každý z těchto textů se mění jiným tempem a v jiné době. Nový učitel nebo administrativní pracovník se v tom orientuje měsíce — a většinou tak, že se ptá kolegů.",
          questions: [
            "Kolik dní dovolené má pedagogický pracovník?",
            "Jaký je postup u komisionální zkoušky?",
            "Kdo schvaluje individuální vzdělávací plán a v jaké lhůtě?",
          ],
          answerNote: "Rozliší, co říká zákon a co váš vnitřní řád — a který má přednost.",
          benefits: [
            "Zaučení nového člověka se zkrátí z měsíců na hodiny.",
            "Sekretariát přestane být úzkým hrdlem pro běžné dotazy.",
            "Odpověď vždy vychází z platného znění, ne ze staršího souboru na disku.",
          ],
        },
        {
          icon: "scale",
          title: "Svazy, komory a spolky",
          situation:
            "Máte vlastní předpisy postavené na zákoně, který se mění. Členové se ptají stále na totéž a odpověď musí sedět — protože podle ní se rozhoduje o přestupech, sankcích nebo členství. Špatně citovaný článek je reklamace, ne překlep.",
          questions: [
            "Jaká je lhůta pro podání námitky proti výsledku?",
            "Kolik je odstupné za hráče od 20 let ze třetí ligy?",
            "Kdo schvaluje přestup nezletilého do jiného klubu?",
          ],
          answerNote:
            "Toto jsou skutečné otázky z našeho nasazení nad předpisy Slovenského fotbalového svazu — odpověď uvádí článek i odstavec.",
          benefits: [
            "Členové dostanou odpověď sami, bez telefonátu na sekretariát.",
            "Každá odpověď je doložena článkem, takže se dá ověřit i zpochybnit.",
            "Historické znění zůstává dostupné pro spory o starší období.",
          ],
        },
        {
          icon: "globe",
          title: "Banky, nadnárodní a velké společnosti",
          situation:
            "Skupinové politiky jsou anglicky, lokální směrnice v jazyce země a nad tím regulace, která se mění každý rok. Zaměstnanec v Praze neví, jestli platí group policy nebo lokální dodatek — a když se zeptá, dostane od dvou kolegů dvě odpovědi. Navíc hledá česky v dokumentu, který česky není. Interní audit se ptá na totéž, jen s většími důsledky.",
          questions: [
            "Která verze skupinové politiky platí pro českou pobočku?",
            "Jaký je limit pro schválení výdaje bez druhého podpisu?",
            "Liší se naše interní směrnice od požadavku regulátora?",
          ],
          answerNote:
            "Odpověď rozliší skupinovou politiku od lokální a řekne, která má v daném případě přednost.",
          benefits: [
            "Stejná odpověď napříč pobočkami — ne podle toho, koho se člověk zeptal.",
            "Otázka česky, zdroj anglicky. Model významu i jazykový model jsou vícejazyčné a každý dokument nese svůj jazyk jako údaj, takže se dá filtrovat i míchat.",
            "Každá odpověď je doložena dokumentem, článkem a verzí, takže obstojí při interním auditu.",
            "Zaškolení stovek lidí na novou politiku, aniž by ji všichni museli přečíst celou.",
            "Nasazení v EU; plně on-prem režim připravujeme — první přijde s hardwarem.",
          ],
        },
        {
          icon: "shield",
          title: "Veřejná správa",
          situation:
            "Zákony, prováděcí předpisy, interní akty řízení a metodické pokyny. K tomu požadavek, aby údaje neopustily EU nebo aby celý systém běžel ve vaší síti. Běžné cloudové nástroje tu neprojdou ani do užšího výběru.",
          questions: [
            "Který předpis upravuje lhůtu pro vyřízení tohoto podání?",
            "Změnilo se něco v metodice po poslední novele?",
            "Co říká interní akt řízení oproti zákonu?",
          ],
          answerNote: "Dnes v EU; režim, kde žádný text neopustí vaši infrastrukturu, připravujeme.",
          benefits: [
            "On-prem a uzavřená síť bez připojení k internetu — připravujeme, první nasazení přijde s hardwarem.",
            "Doložitelné, kde se každá část zpracování provádí — pro audit i pro zadávací řízení.",
            "Přístupová práva podle existujícího přihlášení, bez zakládání nových účtů.",
          ],
        },
      ],

      commonTitle: "Společné všem pěti",
      commonText:
        "Odpověď vždy vychází z vašeho obsahu a uvádí, odkud pochází — předpis, článek i verzi. Když odpověď v podkladech není, systém to řekne místo toho, aby si ji vymyslel. To je rozdíl mezi nástrojem, který se dá použít při rozhodování, a nástrojem, který se dá použít jen pro inspiraci.",
    },
    roadmap: {
      eyebrow: "Připravujeme",
      title: "Z obsahu automaticky web",
      subtitle:
        "V dalších verzích Contineo z vašich zdrojů vytvoří přehledný web — automatický přehled informací, projektů a norem, vždy aktuální.",
      items: [
        { title: "Automatický přehled", text: "Z připojených zdrojů vznikne strukturovaný portál bez ručního psaní." },
        { title: "Projekty a informace", text: "Přehled projektů, dokumentů a novinek na jednom místě, vždy aktuální." },
        { title: "Bez údržby", text: "Aktualizace zdroje se promítne do webu automaticky." },
      ],
      tag: "Plánováno v dalších verzích",
    },
    identity: {
      eyebrow: "Identita a přístup",
      title: "Správa uživatelů a přihlášení",
      subtitle: "Uživatelé se přihlašují přes vaše existující SSO a vidí přesně to, na co mají právo — bez ručního zakládání účtů.",
      providers: ["E-mailový odkaz", "Microsoft Entra ID", "Google Workspace"],
      providersLabel: "Podporovaní poskytovatelé identity",
      points: [
        { icon: "lock", title: "SSO a jednotné přihlášení", text: "Přihlášení e-mailovým odkazem nebo přes SSO — Microsoft Entra ID a Google Workspace. Jedna kanonická session napříč celým systémem; další poskytovatele OIDC umíme doplnit." },
        { icon: "refresh", title: "Automatické zakládání účtů", text: "Osoba se založí sama při prvním přihlášení přes SSO, pokud patří do domény, kterou organizace povolila. Role se přidělují v aplikaci; synchronizaci rolí a skupin z CRM připravujeme." },
        { icon: "layers", title: "Multi-tenant přístup", text: "Každá organizace je samostatný prostor na vlastní doméně. Veřejný obsah vidí všichni přihlášení; interní jen lidé dané organizace. Víceúrovňovou hierarchii a jmenovité sdílení dokumentu jiné organizaci připravujeme." },
        { icon: "shield", title: "Bezpečnost na úrovni dotazu", text: "Přístupové právo je povinný filtr odvozený ze session na straně serveru (default-deny). Aplikuje se před jazykovým modelem — nedá se obejít promptem. Audit při každé změně." },
      ],
    },
    tech: {
      navLabel: "Technologie",
      eyebrow: "Technické řešení",
      title: "Postaveno na ověřených technologiích",
      subtitle:
        "Contineo spojuje sémantické vyhledávání (RAG) nad vaším obsahem s jazykovým modelem, který odpovídá výhradně z ověřených zdrojů — s citací a verzí.",
      exampleNote:
        "Příklady na této stránce (sekce, značky, dotazy) vycházejí z generické firmy. Contineo je doménově univerzální — „předpis“ je jen jeden druh dokumentu a „jednotka“ jen jeden druh organizace. Konkrétní nasazení do velké organizace najdete v případové studii níže.",
      back: "Zpět na hlavní stránku",
      architectureTitle: "Architektura a datový tok",
      architectureCaption:
        "Vstupní kanály → zpracování (chunking + značkování) → MongoDB (jádro: hybridní vyhledávání) → AI adaptéry (embedding, rerank, generování) → rozhraní. Jádro je přenositelné — $rankFusion je i v Community 8.2, takže týž dotaz má běžet v obou režimech; dnes běží cloudová větev. Liší se jen tři adaptéry, které se vybírají konfigurací tenanta. AI dostane vždy jen relevantní pasáže; data zůstávají ve vaší databázi. Zpětný cyklus je jeden: lidská kurace — ověřená odpověď se vrací do indexu. Eskalaci na ticket připravujeme.",
      pillarsTitle: "Klíčové pilíře",
      pillars: [
        { icon: "search", title: "RAG + Hybrid Search", text: "Hybridní vyhledávání $rankFusion (vektor 60 % + fulltext 40 %) je jádro systému a běží identicky v MongoDB Atlas i v self-hosted Community 8.2. Odpověď vzniká výhradně z nalezených pasáží." },
        { icon: "layers", title: "Vyměnitelné AI adaptéry", text: "Embedding, rerank a generování jsou tři nezávislé adaptéry vybírané konfigurací tenanta, ne kódem. Cloud: Voyage a Claude. On-prem: Infinity nebo TEI a vLLM s modelem podle vašeho výběru (Qwen3, EuroLLM, Gemma)." },
        { icon: "quote", title: "Citace a verze", text: "Každá odpověď uvádí zdroj a verzi. Import nové verze neztratí starou — cituje se vždy platné znění." },
        { icon: "shield", title: "Multi-tenant a bezpečnost", text: "Hierarchie organizací (centrála → regionální → lokální jednotky) jako samostatní tenanti. Veřejný obsah vidí všichni; interní obsah jen příslušníci dané jednotky. Audit při každé změně znalostí." },
        { icon: "layers", title: "Vstupní kanály (obsah i integrace)", text: "Jedna vrstva, kterou teče obsah. Dnes jí jde nahraný soubor — DOCX, PDF, XLSX, Markdown, TXT, CSV — převod běží u nás a všechno končí v jednom indexu. Další kanály (weby a RSS, MCP konektory, e-mail) připravujeme. Zdroj identity poskytuje identitu, ne obsah." },
        { icon: "ticket", title: "Helpdesk a e-mail (připravujeme)", text: "Sledování e-mailových schránek, ticketing a předpřipravené odpovědi s eskalací z vyhledávání. Zatím není součástí nasazení — dnes běží nahlášení nepřesnosti a fronta hodnotitele." },
        { icon: "brain", title: "Kontrola kvality a kurace", text: "Nejde o strojové učení modelu, ale o lidskou kuraci: správce ohodnotí a schválí odpověď, ta se uloží jako ověřená odpověď a naembeduje zpět. Nová ověřená odpověď nikdy potichu nepřepíše schválený předpis." },
      ],
      stackTitle: "Technologický stack",
      stack: [
        "MongoDB — jádro: $rankFusion (Atlas EU nebo Community 8.2)",
        "Cloud · Voyage AI voyage-4 — Automated Embedding",
        "Cloud · Voyage AI rerank-2 — $rerank v databázi",
        "Cloud · Claude API — Citations, prompt caching",
        "Připraveno, nenasazeno · Infinity / TEI — embedding + rerank",
        "Připraveno, nenasazeno · vLLM — Qwen3, EuroLLM, Gemma",
        "Next.js 16 (App Router) · Vercel cron",
        "Připravujeme: e-mail (IMAP), zdroj členství/CRM, MCP konektory",
      ],
      flowsTitle: "Klíčové datové toky",
      flows: [
        { title: "Odpovídání (RAG + Hybrid)", text: "Dotaz se klasifikuje (fulltext / vector / hybrid). $rankFusion sloučí $vectorSearch a $search — identicky v obou režimech. Rerank a generování pak obslouží adaptér podle profilu tenanta: v cloudu $rerank v databázi a Claude API, on-prem Infinity a vLLM. Odpověď jde streamingem s citací zdroje." },
        { title: "Kvalita z provozu", text: "U každé odpovědi se zaznamená „sedí / nesedí“ od čtenáře a případný popis, co bylo špatně. Nepřesné odpovědi jdou do fronty hodnotitele (`/evaluation`). Eskalaci na ticket připravujeme." },
        { title: "Kontrola kvality a kurace", text: "Ne strojové učení, ale lidská kurace: hodnotitel projde nahlášenou nepřesnost, ověřené znění připraví a správce obsahu ho zveřejní — uloží se do indexu jako samostatný úsek s přístupem odvozeným z nejpřísnějšího zdroje. Ověřená odpověď nikdy potichu nepřepíše schválený předpis." },
      ],
      collectionsTitle: "Hlavní kolekce",
      collectionsIntro: "Jádro RAG je kolekce `document_chunks`. Verzování norem zaručuje, že nové znění neztratí starší — staré úseky se archivují (`isActive: false`), nemažou se. Schéma ticketů níže je návrh; kolekce zatím neexistuje.",
      collDocLabel: "document_chunks — jádro RAG",
      collTicketLabel: "tickets — návrh, zatím neexistuje",
      vectorTitle: "Hybridní vyhledávací dotaz ($rankFusion)",
      vectorIntro: "Otázka z prostředí jednotky „ACME-PR”, sekce interní směrnice, jen platná verze. $rankFusion kombinuje vektorové a fulltextové vyhledávání — tento dotaz je identický v cloudu i on-prem. Rerank je samostatný krok mimo tento dotaz: v cloudu jako $rerank stage, on-prem přes Infinity nad výsledkem.",
      adaptersTitle: "Vyměnitelné adaptéry a profil tenanta",
      adaptersIntro:
        "Embedding, rerank i generování jsou tři nezávislé adaptéry. Který se použije, určuje záznam v kolekci tenant_profiles — ne kód. Jedna instalace tak obslouží cloudového i on-prem zákazníka současně, se stejným jádrem vyhledávání.",
      collProfileLabel: "tenant_profiles — volba adaptérů",
      parityTitle: "Co se mezi režimy liší",
      parityIntro: "Jádro je identické, ale úplná funkční parita neexistuje. Toto jsou rozdíly, se kterými je třeba počítat při výběru režimu.",
      parityHead: { cap: "Schopnost", cloud: "Cloud", onprem: "On-prem" },
      parity: [
        { cap: "$rankFusion hybridní vyhledávání", cloud: "ano", onprem: "ano — identické" },
        { cap: "Automatický embedding v databázi", cloud: "ano", onprem: "volá Voyage API — pro air-gap nepoužitelné" },
        { cap: "$rerank přímo v pipeline", cloud: "ano", onprem: "ne — rerank v aplikační vrstvě" },
        { cap: "Ověřitelné citace (Citations API)", cloud: "ano", onprem: "ne — citace se žádají promptem" },
        { cap: "Prompt caching", cloud: "ano", onprem: "prefix caching ve vLLM, jiná sémantika" },
        { cap: "Data neopustí perimetr", cloud: "ne", onprem: "ano" },
      ],
      adrNote: "Vektory nejsou přenositelné mezi modely — změna embedding modelu znamená úplný re-embed korpusu. Rozhodnutí a jeho důsledky jsou zdokumentovány v ADR-001.",
      taggingTitle: "Značkování obsahu",
      taggingIntro: "Každý úryvek odpovídá na tři otázky — o čem je (sekce), pro koho platí (organizace/rozsah) a z které verze. Hodnoty se vybírají z číselníku, ne jako volný text.",
      taggingSectionsTitle: "Číselník sekcí",
      sections: [
        { key: "vseobecne", label: "Obecné informace" },
        { key: "smernice", label: "Interní směrnice" },
        { key: "hr", label: "HR a personalistika" },
        { key: "ekonomicke", label: "Ekonomika a finance" },
        { key: "it_aplikacie", label: "IT a aplikace" },
        { key: "gdpr", label: "GDPR a právní" },
      ],
      scopeTitle: "Rozsah platnosti",
      scopes: [
        "scope: global + centrála (např. ACME) → platí pro celou firmu",
        "scope: company + kód jednotky → platí jen pro danou jednotku",
        "scope: region → platí pro regionální úroveň",
      ],
      taggingExampleLabel: "Příklady označkovaných úryvků",
      rulesTitle: "Pravidla pro konzistentní značkování",
      rules: [
        "sectionKey a companyCode vždy z číselníku, nikdy volný text.",
        "Celofiremní předpisy: centrála + scope global — nekopírovat pro každou jednotku.",
        "articleRef vyplňovat u předpisů — používá se v citaci odpovědi.",
        "Při nové verzi staré chunky nemazat — isActive: false + effectiveTo.",
      ],
      ticketTitle: "Životní cyklus ticketu (připravujeme)",
      ticketIntro: "Návrh, který zatím není součástí nasazení. Ticket by vznikl z bota nebo z e-mailu a procházel stavy:",
      ticketStages: [
        { s: "new", t: "přišel, probíhá auto-triage (sekce, jednotka, návrh odpovědi)" },
        { s: "open", t: "přidělen správci, pracuje se na něm" },
        { s: "waiting", t: "čeká se na doplnění od žadatele (SLA pozastavena)" },
        { s: "resolved", t: "odeslána odpověď; úprava při odeslání = nová ověřená odpověď" },
        { s: "closed", t: "uzavřen; reopen vrátí do open" },
      ],
      integrationsTitle: "Integrace",
      integrations: [
        { title: "E-mail (IMAP) — připravujeme", text: "Dvě sledované schránky (tickety + standardní dotazy) směrované do ticketu nebo do učicího toku. Dnes systém poštu nečte — odesílá jen pozvánky a připomínky." },
        { title: "Zdroj identity a CRM — připravujeme", text: "Dnes: přihlášení e-mailovým odkazem, přes Microsoft Entra ID nebo Google Workspace; osoba se založí z domény povolené organizací. Napojení na členské CRM jako zdroj pravdy o osobách a jednotkách (ve sportu sportnet.online) připravujeme; Contineo má vlastní databázi a nezapisuje zpět." },
        { title: "RSS / web — připravujeme", text: "Periodické stahování RSS a webů. Dnes se obsah nahrává jako soubor a re-import je manuální — je to vědomé rozhodnutí: předpis, který se změnil sám od sebe, nikdo neschválil." },
        { title: "MCP konektory — připravujeme", text: "Připojitelné zdroje přes MCP — Google Drive, SharePoint, Confluence, Notion, Slack a další. Navrženo; dnes se obsah nahrává přímo." },
      ],
      securityTitle: "Bezpečnost a provoz",
      security: [
        "Přístup podle příslušnosti k organizaci: veřejný obsah vidí každý přihlášený, interní jen lidé dané organizace. Kdo smí nahrávat obsah, se povoluje ručně. Audit při každé změně znalostí.",
        "Přihlášení e-mailovým odkazem nebo přes SSO: Microsoft Entra ID a Google Workspace. Bez přihlášení se dnes k obsahu nedostanete — veřejný anonymní režim připravujeme.",
        "Citace verze v každé odpovědi a archivace starých verzí předpisů.",
        "Monitoring kvality: skóre vyhledávání, hodnocení „sedí / nesedí“ a nahlášené nepřesnosti — kvalita se měří z provozu, ne z testovací sady.",
        "Multi-tenant hierarchie (centrála → regionální → lokální jednotky): veřejný obsah vidí všichni, interní obsah je oddělen per organizace.",
        "Soukromí dat: obsah zůstává ve vaší databázi a úložišti; AI odpovídá výhradně z vašeho obsahu (RAG), veřejná spotřebitelská AI se nepoužívá.",
        "Volba provozního režimu na úrovni tenanta: cloud (databáze v EU) nebo plně on-prem — obsah ani dotazy neopustí vaši infrastrukturu. Jedna instalace obslouží oba typy zákazníků současně.",
      ],
      caseStudy: {
        eyebrow: "Případová studie",
        title: "Nasazení ve velké organizaci — sportovní svaz (SFZ)",
        intro: "Contineo je doménově univerzální. Takto vypadá jedno reálné nasazení do velké organizace — Slovenského fotbalového svazu a jeho podřízených svazů.",
        points: [
          "Tenant hierarchie: SFZ → regionální → oblastní svazy jako samostatné organizace.",
          "Obsah: soutěžní a přestupní řády, rozpisy soutěží, směrnice, IT FAQ (aplikace ISSF).",
          "Identita: přihlášení e-mailovým odkazem, přes Microsoft Entra ID nebo Google Workspace; role se přidělují v aplikaci. Napojení na sportnet.online jako zdroj členství je další krok.",
          "Příklad otázky: „Může hráč nastoupit ve dvou utkáních za jeden den?“ → odpověď s citací § a verze.",
        ],
      },
      identity: {
        title: "Identita a řízení přístupu",
        intro: "Přihlášení přes existující SSO; přístupové právo je povinný filtr odvozený ze session a aplikovaný na obě větve hybridního vyhledávání ($vectorSearch i $search).",
        providersTitle: "Poskytovatelé identity (NextAuth) → jedna kanonická session",
        providers: [
          { name: "E-mailový odkaz", role: "přihlášení bez hesla; používá se i na pozvánky" },
          { name: "Microsoft Entra ID", role: "SSO pro firemní účty zaměstnanců" },
          { name: "Google Workspace", role: "SSO (alternativa)" },
          { name: "CRM / API zdroje identity", role: "zdroj pravdy o osobách a organizačních jednotkách; mapování na companyCode, role a skupiny" },
          { name: "Vlastní databáze", role: "účty mimo SSO (credentials)" },
        ],
        principlesTitle: "Principy bezpečnosti",
        principles: [
          "Server-side only — filtr se skládá ze session, nikdy z parametrů klienta.",
          "Default-deny — co není výslovně povoleno, se nevrátí; bez identity jen veřejný obsah.",
          "Filtr před LLM — model vidí jen povolené chunky; nedá se obejít promptem (platí i pro citace).",
          "Auto-provisioning — osoba se založí při prvním přihlášení přes SSO z domény povolené organizací. Průběžnou synchronizaci rolí z CRM připravujeme.",
        ],
        modesTitle: "Režimy nasazení",
        modes: [
          { name: "Interní portál (SSO)", text: "dnes jediný režim: přihlášený člověk vidí veřejný i interní obsah své organizace." },
          { name: "Veřejný widget — připravujeme", text: "anonymní přístup jen k veřejnému obsahu. Zatím neexistuje — bez přihlášení se dnes k obsahu nedostanete." },
        ],
      },
    },
    cta: {
      title: "Připraveni dostat svůj obsah na dosah ruky?",
      subtitle: "Ukážeme vám Contineo na vašich vlastních zdrojích.",
      button: "Kontaktujte nás",
      email: "office@contineo.app",
    },
    legal: {
      compliance: {
        heading: "Soulad a otevřenost",
        license: "LGPL-2.1",
        eupl: "EUPL-1.2 compatible",
        reuse: "REUSE compliant",
        gdpr: "GDPR ready",
        wcag: "WCAG 2.1 AA",
      },
      privacy: {
        title: "Ochrana údajů",
        intro: "Toto je vzorová šablona. Před zveřejněním ji přizpůsobte vaší organizaci a nechte zkontrolovat právníkem.",
        sections: [
          { h: "Správce", p: "Doplňte název společnosti, sídlo a kontaktní e-mail (např. office@contineo.app)." },
          { h: "Jaké údaje zpracováváme", p: "Tento web nepoužívá analytické ani reklamní cookies. Ukládá pouze volbu světlého/tmavého motivu v prohlížeči (localStorage), což není osobní údaj." },
          { h: "Obsah zákazníka", p: "V produktu Contineo zůstává obsah vaší firmy ve vaší databázi a úložišti. AI vrstva dostane jen relevantní pasáže; veřejná AI se nepoužívá a veřejné modely se na vašich datech netrénují." },
          { h: "Právní základ a rezidence", p: "Zpracování umožňuje databázi v EU, nasazení modelů v EU, nebo plně self-hosted variantu. Podrobný rozpis najdete v sekci Datová rezidence." },
          { h: "Vaše práva", p: "Podle GDPR máte právo na přístup, opravu, výmaz, přenositelnost a právo vznést námitku. Žádosti směřujte na kontaktní e-mail." },
          { h: "Kontakt", p: "office@contineo.app" },
        ],
      },
      accessibility: {
        title: "Přístupnost",
        intro: "Contineo je navrženo tak, aby splňovalo WCAG 2.1 úroveň AA.",
        points: [
          "Sémantická struktura (nadpisy, orientační prvky, jeden hlavní obsah na stránku).",
          "Viditelný fokus pro ovládání klávesnicí a odkaz „Přeskočit na obsah“.",
          "Dostatečný barevný kontrast ve světlém i tmavém motivu.",
          "Textové alternativy pro obrázky a srozumitelné popisky pro ovládací prvky.",
          "Respektování nastavení „omezit pohyb“ (prefers-reduced-motion).",
        ],
        contactH: "Zpětná vazba",
        contact: "Pokud narazíte na bariéru v přístupnosti, napište nám na office@contineo.app a opravíme to.",
      },
    },
    footer: {
      tagline: "Zeptejte se svého obsahu.",
      product: "Produkt",
      company: "Společnost",
      links: {
        features: "Funkce",
        how: "Jak to funguje",
        demo: "Demo",
        contact: "Kontakt",
        privacy: "Ochrana údajů",
      },
      rights: "Všechna práva vyhrazena.",
      ownerLabel: "Projekt vlastní a vyvíjí",
      ownerName: "LTK Solutions",
      ownerUrl: "https://ltk.solutions",
    },
  },

  en: {
    locale: "en",
    metaDescription:
      "Contineo is an intelligent RAG helpdesk over your own content. Hybrid search (MongoDB $rankFusion) with Voyage and Claude. Answers with citations. EU hosting, GDPR.",
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
        "Contineo finds the answer in your own content — in the regulations, policies and internal guidelines you upload into it. No digging through folders, no guessing from the internet. Just a verified answer from where it actually lives.",
      ctaPrimary: "Try the search",
      ctaSecondary: "How it works",
      note: "A company portal on your own subdomain, reachable after SSO sign-in.",
    },
    manifesto: {
      eyebrow: "Why Contineo",
      text: "For years we learned to search — typing keywords, opening ten tabs, digging through folders. Contineo flips it: you simply ask and get the answer. And not just any answer — one from your company's content, with a source citation. Not from the internet. From your world.",
    },
    logos: "Built on MongoDB $rankFusion · Voyage AI · Claude · Next.js · EU hosting · GDPR",
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
          text: "Regulations, policies, internal guidelines and how-tos in one place. No switching between systems.",
        },
        {
          icon: "quote",
          title: "Answers with citations",
          text: "Every answer states the source and document version. No guessing — only verified content.",
        },
        {
          icon: "ticket",
          title: "Answer quality (ticketing in preparation)",
          text: "When an answer doesn't hold up, the reader flags it in one click and an evaluator reviews it. Ticketing and an e-mail channel are in preparation as the next layer.",
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
          text: "You upload DOCX, PDF, XLSX or Markdown. Content is converted, chunked and tagged by topic and validity. Websites and further channels are in preparation.",
        },
        {
          n: "02",
          title: "A user asks",
          text: "They ask a question in natural language in the Contineo portal, after signing in with company SSO.",
        },
        {
          n: "03",
          title: "Contineo finds and answers",
          text: "It searches all sources and generates an answer only from verified content — linking the source and version.",
        },
        {
          n: "04",
          title: "Support and curation",
          text: "When an answer doesn't hold up, the reader flags it. An evaluator corrects the wording and a content admin publishes it back into the knowledge base as a verified answer.",
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
      noAnswerText: "Try rephrasing it, or flag the answer as inaccurate.",
      escalateTitle: "Didn't find an answer? Flag it — an evaluator will take a look.",
      sendTicket: "Flag as inaccurate",
      ticketDone: "Flagged. An evaluator will review it and correct the wording.",
      appliesAll: "applies company-wide (ACME)",
    },
    modes: {
      eyebrow: "Deployment options",
      title: "How Contineo is deployed",
      subtitle: "Today as a locked-down company portal on your own subdomain. Embedded search inside an existing website is in preparation.",
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
        tag: "Embedded search — in preparation",
        title: "A search icon right inside your website",
        text: "Add the Contineo icon to your existing site. On click it expands as an overlay layer and replaces the site's regular search. It does not exist yet — today Contineo is a portal behind sign-in.",
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
        "The search core is portable: $rankFusion has been in the Community edition since 8.2, so the same query should run in both modes. Three swappable adapters differ, chosen by tenant configuration rather than by changing code. The cloud branch is what runs today; the self-hosted one is still being verified, and reranking there is handled by the application layer, not the database.",
      cloud: {
        tag: "Cloud",
        title: "Managed operation in the EU",
        text: "MongoDB Atlas in a European region, embedding and reranking directly in the database, generation via the Claude API. This is what runs today. No hardware to buy — we launch the portal on your subdomain within days; you fill the content as you go.",
        points: [
          "Automated Embedding — vectors are created inside the database",
          "Verifiable citations via the Citations API",
          "No upfront hardware investment, you pay per query",
        ],
      },
      onprem: {
        tag: "On-prem — in preparation",
        title: "A closed solution on your own hardware",
        text: "MongoDB Community 8.2 on your own machine, embedding and reranking via Infinity or TEI, generation via vLLM. Neither content nor queries would leave your perimeter. In preparation — the adapters are written; the first deployment comes with the hardware.",
        points: [
          "Designed for sensitive internal policies — classified information requires a separate assessment",
          "Your choice of model — Qwen3, EuroLLM, Gemma and others",
          "Air-gapped operation is the goal, not yet verified",
        ],
      },
      adaptersTitle: "Three swappable adapters",
      cloudLabel: "Cloud",
      onpremLabel: "On-prem (in preparation)",
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
      title: "Your documents stay in the EU",
      subtitle: "Content lives in a database in the EU, isolated per organisation. What leaves is the question and the retrieved passages — to models we hold contracts with. The exact breakdown is in the Data residency section; we don't hide it.",
      points: [
        { icon: "lock", title: "Content in an EU database", text: "Documents, indexes and backups sit in MongoDB Atlas in Frankfurt, isolated per organisation by a condition on every query. They aren't public and aren't indexed by the internet." },
        { icon: "shield", title: "No public AI", text: "We never use public consumer AI. For answer generation we have a zero-retention, no-training agreement with Anthropic; for embedding and reranking (Voyage via Atlas) we are still confirming it." },
        { icon: "search", title: "AI is only a helper", text: "The language model answers strictly from retrieved passages of your content (RAG) and attaches a source citation." },
        { icon: "layers", title: "Cloud today, on-prem in preparation", text: "Today we run cloud with the database in the EU. A fully on-prem mode, where data never leaves your perimeter, is designed and the adapters are written — it has not been deployed yet. The full data-flow breakdown is in the Data residency section." },
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
        "The mode is a property of your organisation, not of our edition. Same application, different configuration — and a disallowed combination simply refuses to start. The mode running today is eu-data; the other three are written in code and the first deployment comes with the hardware.",
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

      tiersTitle: "The second question: does it run for us alone?",
      tiersIntro:
        "The mode above says which country processes your text. It does not say whether that processing happens on a machine reserved for you, or on a service that is serving other customers at the same moment. These are two independent questions and the system checks both.",
      tiersHead: {
        tier: "Level",
        meaning: "What it means",
        who: "When it makes sense",
      },
      tiers: [
        { key: "T1", name: "Shared",
          meaning: "Shared infrastructure. Your documents are separated by access rules, but the model processing them also serves others.",
          who: "standard commercial deployment, small and mid-sized companies" },
        { key: "T2", name: "Dedicated",
          meaning: "Embedding, reranking and generation run on instances that serve no one else. Your text never passes through a shared process.",
          who: "banks, large enterprises, sensitive internal policies" },
        { key: "T3", name: "Disconnected",
          meaning: "Dedicated, plus no outbound connectivity. Requires air-gap mode — otherwise the disconnection exists only on paper.",
          who: "classified material, closed networks" },
      ],
      tiersNote:
        "Levels combine with modes; they are not steps on a single scale. A shared service can run entirely inside the EU (T1 + eu-full), and a dedicated instance can sit anywhere (T2 + global). And one thing most vendors will not say out loud: a dedicated cloud account is not dedicated hardware. That is why Claude via AWS Bedrock does not pass at level T2 even though it runs in Frankfurt — the model there serves everyone else too.",

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
        "Because someone in procurement will ask. Most vendors state “data in the EU” and stay silent about where the model runs — yet that is exactly where the question and the retrieved passages go. Every row above is backed by the vendor's own documentation, and if the situation changes, so does this table. And here is the open point we don't hide: with Voyage (embedding and reranking via Atlas) we do not yet have zero-retention or the exact processing region confirmed in writing.",
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
        { title: "Banks and large enterprises", text: "Group policies, local directives and regulation on top. One answer across branches, evidenced for audit." },
        { title: "Public administration", text: "Acts, implementing decrees and internal management acts. Data and hosting in the EU; on-premise and closed networks are in preparation." },
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
        "Newer wording takes precedence over older — answers come from the version in force today.",
      ],

      nextTitle: "What we are working on",
      nextTag: "In progress",
      nextIntro: "Not part of the deployment yet.",
      next: [
        "Further precedence rules — higher law over lower, specific over general.",
        "Querying historical wording — archived versions are stored with their validity dates; exposing them in search is in preparation.",
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
          icon: "globe",
          title: "Banks, multinationals and large enterprises",
          situation:
            "Group policies are in English, local directives in the national language, and regulation on top changes every year. Someone in the local office cannot tell whether the group policy or the local addendum applies — and asking two colleagues yields two answers. They are also searching in one language inside a document written in another. Internal audit asks the same question, only with bigger consequences.",
          questions: [
            "Which version of the group policy applies to the Slovak branch?",
            "What is the spending limit that needs no second signature?",
            "Does our internal directive differ from what the regulator requires?",
          ],
          answerNote:
            "The answer separates group policy from local rules and says which one prevails in the given case.",
          benefits: [
            "The same answer across branches — not one that depends on who you asked.",
            "Ask in one language, get an answer from a source in another. Both the meaning model and the language model are multilingual, and every document carries its language as a field, so you can filter or mix.",
            "Every answer is backed by a document, an article and a version, so it holds up in internal audit.",
            "Roll a new policy out to hundreds of people without all of them having to read it end to end.",
            "Deployment in the EU; a fully on-prem mode is in preparation — the first one comes with the hardware.",
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
          answerNote: "In the EU today; a mode where no text leaves your infrastructure is in preparation.",
          benefits: [
            "On-premise and a closed network with no internet connection — in preparation; the first deployment comes with the hardware.",
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
      providers: ["E-mail link", "Microsoft Entra ID", "Google Workspace"],
      providersLabel: "Supported identity providers",
      points: [
        { icon: "lock", title: "SSO and single sign-on", text: "Sign in with an e-mail link or via SSO — Microsoft Entra ID and Google Workspace. One canonical session across the whole system; further OIDC providers can be added." },
        { icon: "refresh", title: "Automatic account provisioning", text: "A person is created on first SSO sign-in if they belong to a domain the organisation has allow-listed. Roles are assigned in the app; syncing roles and groups from a CRM is in preparation." },
        { icon: "layers", title: "Multi-tenant access", text: "Each organisation is its own space on its own domain. Public content is visible to every signed-in person; internal only to people of that organisation. A multi-level hierarchy and per-document sharing with another organisation are in preparation." },
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
        "Input channels → processing (chunking + tagging) → MongoDB (the core: hybrid search) → AI adapters (embedding, rerank, generation) → interfaces. The core is portable — $rankFusion is in Community 8.2 too, so the same query should run in both modes; the cloud branch is what runs today. Only three adapters differ, and they are selected by tenant configuration. The AI always receives just the relevant passages; your data stays in your database. There is one feedback loop: human curation — a verified answer goes back into the index. Ticket escalation is in preparation.",
      pillarsTitle: "Key pillars",
      pillars: [
        { icon: "search", title: "RAG + Hybrid Search", text: "The $rankFusion hybrid query (vector 60 % + fulltext 40 %) is the core of the system and runs identically in MongoDB Atlas and in self-hosted Community 8.2. Answers are produced only from the retrieved passages." },
        { icon: "layers", title: "Swappable AI adapters", text: "Embedding, rerank and generation are three independent adapters selected by tenant configuration, not by code. Cloud: Voyage and Claude. On-prem: Infinity or TEI and vLLM with the model of your choice (Qwen3, EuroLLM, Gemma)." },
        { icon: "quote", title: "Citations and versions", text: "Every answer states the source and version. A new import never loses the old one — always citing the valid wording." },
        { icon: "shield", title: "Multi-tenant and security", text: "A hierarchy of organisations (headquarters → regional → local units) as separate tenants. Public content is visible to everyone; internal content only to members of that unit. Audit trail on every knowledge change." },
        { icon: "layers", title: "Input channels (content & integrations)", text: "One layer through which content flows. Today that means an uploaded file — DOCX, PDF, XLSX, Markdown, TXT, CSV — converted on our side and landing in a single index. Further channels (websites and RSS, MCP connectors, e-mail) are in preparation. A connected identity source provides identity here, not content." },
        { icon: "ticket", title: "Helpdesk and e-mail (in preparation)", text: "Mailbox monitoring, ticketing and prepared replies with escalation from search. Not part of the deployment yet — today we run inaccuracy flagging and an evaluator queue." },
        { icon: "brain", title: "Quality control & curation", text: "Not machine learning of the model, but human curation: an admin rates and approves an answer, it is stored as a verified answer and embedded back. A new verified answer never silently overrides an approved document." },
      ],
      stackTitle: "Technology stack",
      stack: [
        "MongoDB — the core: $rankFusion (Atlas EU or Community 8.2)",
        "Cloud · Voyage AI voyage-4 — Automated Embedding",
        "Cloud · Voyage AI rerank-2 — $rerank in the database",
        "Cloud · Claude API — Citations, prompt caching",
        "Ready, not deployed · Infinity / TEI — embedding + rerank",
        "Ready, not deployed · vLLM — Qwen3, EuroLLM, Gemma",
        "Next.js 16 (App Router) · Vercel cron",
        "In preparation: e-mail (IMAP), membership/CRM source, MCP connectors",
      ],
      flowsTitle: "Key data flows",
      flows: [
        { title: "Answering (RAG + Hybrid)", text: "The query is classified (fulltext / vector / hybrid). $rankFusion merges $vectorSearch and $search — identically in both modes. Rerank and generation are then handled by the adapter from the tenant profile: $rerank in the database and the Claude API in the cloud, Infinity and vLLM on-prem. The answer is streamed with a source citation." },
        { title: "Quality from production", text: "Every answer records the reader's “held up / didn't” verdict and, optionally, what was wrong. Inaccurate answers go into the evaluator queue (`/evaluation`). Ticket escalation is in preparation." },
        { title: "Quality control & curation", text: "Not machine learning but human curation: an evaluator reviews the flagged answer, prepares the verified wording and a content admin publishes it — it is stored in the index as its own passage, with access derived from the strictest source. A verified answer never silently overrides an approved document." },
      ],
      collectionsTitle: "Main collections",
      collectionsIntro: "The RAG core is the `document_chunks` collection. Versioning ensures a new revision never loses the older one — old passages are archived (`isActive: false`), never deleted. The ticket schema below is a design; the collection does not exist yet.",
      collDocLabel: "document_chunks — the RAG core",
      collTicketLabel: "tickets — design, does not exist yet",
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
      ticketTitle: "Ticket lifecycle (in preparation)",
      ticketIntro: "A design that is not part of the deployment yet. A ticket would be created from the bot or e-mail and move through these states:",
      ticketStages: [
        { s: "new", t: "arrived, auto-triage in progress (section, unit, suggested reply)" },
        { s: "open", t: "assigned to an admin, being worked on" },
        { s: "waiting", t: "waiting for input from the requester (SLA paused)" },
        { s: "resolved", t: "reply sent; an edit on send = a new verified answer" },
        { s: "closed", t: "closed; reopen returns to open" },
      ],
      integrationsTitle: "Integrations",
      integrations: [
        { title: "E-mail (IMAP) — in preparation", text: "Two monitored mailboxes (tickets + standard questions) routed into a ticket or the learning flow. Today the system does not read mail — it only sends invitations and reminders." },
        { title: "Identity & CRM source — in preparation", text: "Today: sign-in with an e-mail link, via Microsoft Entra ID or Google Workspace; a person is created from a domain the organisation allow-listed. Connecting a membership CRM as the source of truth about people and units (sportnet.online in sports) is in preparation; Contineo keeps its own database and doesn't write back." },
        { title: "RSS / web — in preparation", text: "Periodic pulling of RSS and websites. Today content is uploaded as a file and re-import is manual — a deliberate choice: a policy that changed by itself is a policy nobody approved." },
        { title: "MCP connectors — in preparation", text: "Pluggable sources via MCP — Google Drive, SharePoint, Confluence, Notion, Slack and more. Designed; today content is uploaded directly." },
      ],
      securityTitle: "Security and operations",
      security: [
        "Access by membership in an organisation: public content is visible to every signed-in person, internal only to people of that organisation. Who may upload content is allow-listed manually. Audit trail on every knowledge change.",
        "Sign-in with an e-mail link or via SSO: Microsoft Entra ID and Google Workspace. Without signing in you reach no content today — a public anonymous mode is in preparation.",
        "A version citation in every answer and archiving of old document versions.",
        "Quality monitoring: search score, “held up / didn't” ratings and flagged inaccuracies — quality is measured from production, not from a test set.",
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
          "Identity: sign-in with an e-mail link, via Microsoft Entra ID or Google Workspace; roles are assigned in the app. Connecting sportnet.online as the source of memberships is the next step.",
          "Example question: “Can a player play in two matches in a single day?” → an answer citing the article and version.",
        ],
      },
      identity: {
        title: "Identity and access control",
        intro: "Sign-in via existing SSO; an access right is a mandatory filter derived from the session and applied to both branches of hybrid search ($vectorSearch and $search).",
        providersTitle: "Identity providers (NextAuth) → one canonical session",
        providers: [
          { name: "E-mail link", role: "passwordless sign-in; also used for invitations" },
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
          "Auto-provisioning — a person is created on first SSO sign-in from a domain the organisation allow-listed. Continuous role syncing from a CRM is in preparation.",
        ],
        modesTitle: "Deployment modes",
        modes: [
          { name: "Internal portal (SSO)", text: "the only mode today: a signed-in person sees public and internal content of their organisation." },
          { name: "Public widget — in preparation", text: "anonymous access to public content only. Does not exist yet — without signing in you reach no content today." },
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
      ownerLabel: "Owned and developed by",
      ownerName: "LTK Solutions",
      ownerUrl: "https://ltk.solutions",
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
  cs: [
    {
      k: ["home", "office", "domu", "doma", "práce", "prace", "dálku", "dalku"],
      q: "Kolik dní home office mám nárok měsíčně?",
      a: "Zaměstnanec má nárok na práci z domova podle interní směrnice — standardně až 10 dní měsíčně po dohodě s nadřízeným. Výjimky určuje vedoucí útvaru.",
      src: "Směrnice o práci z domova",
      art: "čl. 4 odst. 2",
      ver: "verze 2026",
      rel: ["Jak požádám o home office?", "Platí home office i během zkušební doby?"],
    },
    {
      k: ["dovolená", "dovolenou", "dovolena", "termín", "termin", "žádost", "zadost", "volno"],
      q: "Do kdy je třeba podat žádost o dovolenou?",
      a: "Žádost o dovolenou se podává nejpozději 14 dní předem přes interní systém. Při kratším termínu ji schvaluje přímý nadřízený individuálně.",
      src: "Pracovní řád",
      art: "čl. 9",
      ver: "verze 2026",
      rel: ["Kolik dní dovolené mi zbývá?", "Jak převedu dovolenou do dalšího roku?"],
    },
    {
      k: ["heslo", "přihlás", "prihlas", "účet", "ucet", "reset", "vpn"],
      q: "Jak si obnovím firemní heslo?",
      a: "Heslo si obnovíte přes tlačítko „Zapomenuté heslo“ na přihlašovací obrazovce firemního účtu. Odkaz na obnovení přijde na váš pracovní e-mail.",
      src: "IT podpora",
      art: null,
      ver: "FAQ",
      rel: ["Nedostal jsem e-mail na obnovení", "Jak si nastavím VPN?"],
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
