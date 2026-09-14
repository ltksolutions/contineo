/**
 * guide.ts — text Návodu.
 *
 * **Prečo nie v i18n.ts.** Slovník má cez 6 800 riadkov a je to zoznam
 * krátkych reťazcov pre rozhranie. Návod je súvislý text na dve obrazovky;
 * v slovníku by ho nikto nenašiel a pri troch jazykoch by ho strojnásobil.
 * V i18n zostáva len obal obrazovky — nadpis, úvod, poznámka o jazyku.
 *
 * **Prečo Markdown a nie JSX.** Ten istý rozklad, ktorý vykresľuje znenie
 * predpisu a odpoveď vyhľadávania (`FormattedText`), vykreslí aj toto —
 * vrátane odkazov v tvare [text](/cesta). Text tak vie upraviť ktokoľvek,
 * kto vie napísať vetu, bez zásahu do komponentu.
 *
 * **Zatiaľ len po slovensky.** Rozhodnutie Jána Letka: text má byť jeden
 * a presný, nie tri a rozchádzajúce sa. Česká a anglická obrazovka naň
 * odkážu; keď sa rozhranie naozaj začne používať aj v tých jazykoch, návod
 * sa preloží celý naraz.
 *
 * Odkazy v texte musia viesť na skutočné cesty — stráži to
 * `tests/guide.test.ts`. Návod, ktorý odkazuje inam, než kam sa dá kliknúť,
 * je horší než žiadny.
 */

export const GUIDE_SK = `
Tento návod hovorí, ako sa dokument dostane do systému a čo sa s ním po ceste stane. Je písaný pre správcu obsahu, schvaľovateľa a personalistu — teda pre toho, kto do systému vkladá, nie pre toho, kto len potvrdzuje.

## 1. Odporúčaný postup od nahratia dokumentu

**Nový dokument a nové znenie sú dve rôzne veci.** Nový Súťažný poriadok sa nestane novou verziou existujúceho Súťažného poriadku tým, že sa nahrá — musíte povedať, čo z toho robíte. Systém preto nahratie na obsadený kľúč odmietne a ukáže, ktorý dokument ten kľúč už má.

1. **Nový dokument** sa zakladá v [Knižnici](/library) tlačidlom Nahrať dokument. Vyplní sa názov, zaradenie a kľúč dokumentu; súbor môže byť DOCX, PDF, XLSX alebo Markdown.
2. **Nové znenie už existujúceho dokumentu** sa nahráva na detaile toho dokumentu, nie cez nahratie nového. Systém vám hneď povie, či sa text líši od platného znenia a o koľko riadkov, a rozdiel po riadkoch si viete pozrieť ešte pred zverejnením.
3. **Prevod do textu.** Zo súboru sa urobí čistý text. Pri skenovanom PDF ho prepisuje jazykový model, a preto **prevedený text vždy prečítajte** — model číta dobre, ale nie bezchybne. Originálny súbor zostáva uložený a dá sa stiahnuť.
4. **Metadáta.** Označenie znenia (napríklad „účinné od 1. 1. 2027“), dátum účinnosti a **zdroj toho dátumu** — odkiaľ viete, že platí práve odvtedy. Zdroj je povinný, lebo bez neho sa o rok nedá povedať, či dátum niekto opísal z dokumentu alebo odhadol.
5. **Schválenie.** Predloží sa menovaným schvaľovateľom. Až po schválení sa dá znenie zverejniť.
6. **Zverejnenie.** Znenie sa objaví v knižnici, systém z neho odpovedá a dá sa prideliť ľuďom na potvrdenie.

**Poradie sa nedá obísť.** Neschválené znenie sa zverejniť nedá a nezverejnené znenie sa nedá prideliť. Je to zámer: kto si predpis nájde sám, číta ho bez ohľadu na to, či ho niekto schválil — a systém, ktorý z neho odpovedá, zaň ručí rovnako.

## 2. Možnosti schvaľovania

**Schvaľuje sa znenie, nie dokument.** Schvaľuje sa presne ten text, ktorý ľudia dostanú na potvrdenie a ktorý sa doslova ocitne vo formulke, pod ktorú sa podpíšu.

**Schvaľovatelia sú menovaní ľudia, nie rola.** Rolu možno použiť na predvyplnenie zoznamu, ale do záznamu sa zapíše meno. „Schválil niekto z útvaru Právne“ je o rok bezcenný záznam; „schválila Marta Horváthová“ nie.

**Schvaľuje sa súbežne, nie za sebou.** Musia schváliť všetci menovaní, na poradí nezáleží. Nikto nečaká, kým to pred ním niekto otvorí.

**Kto text nahral, ten ho neschvaľuje.** Inak je schválenie podpis pod vlastnú prácu.

**Zamietnutie je záznam, nie zmazanie.** Jedno zamietnutie zastaví celé kolo a znenie sa vráti do konceptu. **Dôvod je povinný** — bez neho predkladateľ nevie, čo opraviť, a o rok sa nedá povedať, prečo prvé kolo neprešlo. Väčšinové schválenie neexistuje: pri záväznom predpise nie je dôvod prehlasovať toho, kto namieta.

**Schválené a účinné sú dve nezávislé veci.** Znenie sa dá schváliť v septembri s účinnosťou od januára. Prideliť sa dá len to, čo je schválené **aj** účinné.

**Každá úprava textu po schválení schválenie ruší.** Kolo sa vedie na odtlačku textu, takže iný text znamená iné znenie. Nie je to chyba — je to jediný spôsob, ako zaručiť, že schválili presne to, čo ľudia čítajú.

Čo čaká na vás, vidíte na obrazovke [Na schválenie](/approvals).

## 3. Čo je trasa

**Trasa je poradie krokov: „prejdi týchto N dokumentov v tomto poradí“.** Je to nástroj personalistu — spôsob, ako povedať, že nový človek nemá dostať desať dokumentov naraz, ale postupne a v zmysluplnom slede.

**Príklad.** Trasa „Nástup do zamestnania“ má štyri kroky:

1. Pracovný poriadok SFZ
2. Etický kódex
3. Smernica o ochrane osobných údajov
4. Smernica o cestovných náhradách

Nový zamestnanec uvidí zoznam a v ňom, kde skončil: „Krok 2 zo 4“. Systém mu ostatné dokumenty neschová, ale povie, čo má prejsť najbližšie.

**Stav sa nikde neukladá.** Odvodzuje sa z toho, čo má trasa v krokoch, a z toho, čo má človek potvrdené. Znie to ako podrobnosť, ale je to podstatné: keby sa progres ukladal zvlášť, raz by sa rozišiel so skutočnosťou — a rozišiel by sa práve pri novom znení dokumentu, teda vtedy, keď na správnosti najviac záleží. Takto sa nové znenie **samo** objaví ako nesplnený krok u každého, kto potvrdil to staré.

**Trasa nie je to isté, čo pridelenie.** Pridelenie hovorí „tento dokument je vaša povinnosť“. Trasa hovorí „a preberte ich v tomto poradí“. Dokument môže byť pridelený aj bez trasy.

## 4. Členenie, index a inteligentné vyhľadávanie

Toto je časť, ktorú nikto nevypĺňa ručne, ale oplatí sa jej rozumieť — rozhoduje o tom, či systém na otázku odpovie presne, alebo od veci.

**Text sa nareže na úseky.** Nie po odsekoch a nie po znakoch, ale **podľa členenia predpisu**: časť, hlava, diel, článok, paragraf, príloha. Úsek tak zodpovedá tomu, na čo sa človek odvoláva, keď hovorí „podľa článku 78“.

**Každý úsek si nesie, odkiaľ je.** Na jeho začiatku je cestička — dokument, časť, článok. Bez nej by úsek vytrhnutý z prostriedku predpisu neniesol informáciu o tom, čoho je súčasťou, a odpoveď by sa oň oprela naslepo.

**Úseky sa prevedú na čísla (index).** Vďaka tomu vie systém nájsť úsek, ktorý odpovedá na otázku, aj keď v ňom nie je ani jedno slovo z otázky. Preto „Do kedy treba nahlásiť prestup?“ nájde článok, ktorý hovorí o lehote na podanie žiadosti.

**Odpoveď sa skladá len z nájdených úsekov a cituje ich doslova.** Pri každej odpovedi vidíte citácie — presné vety, o ktoré sa opiera — a zoznam úsekov, ktoré systém prehľadal. Keď citácia chýba, tvrdenie nemá oporu a treba to tak brať.

**Spôsob narezania sa nastavuje pre každý dokument zvlášť**, nie pre celú organizáciu. Norma s článkami a zápisnica zo zasadnutia sa nemajú rezať rovnako. Profily sú v [Nastavení organizácie](/organisation?tab=chunking); dokument, ktorý nemá vlastný, používa základný.

**Potvrdenie sa viaže na text, členenie nie.** Preindexovanie dokumentu teda nikoho nenúti potvrdzovať znova — mení sa len to, ako systém v texte hľadá, nie čo je v ňom napísané.
`.trim()
