# ADR-007 — Oprava textu publikovaného znenia bez novej verzie

> **Stav:** schválené · **Dátum:** 2026-09-13
> **Zadal:** Ján Letko — „schválime nový dokument, pridelíme ho ľuďom na schvaľovanie
> a tiež ho dáme do RAG, ľudia začnú schvaľovať a niekto pošle pripomienku, že máte tam
> gramatickú chybu, tá nemení význam, potrebujeme vedieť na úrovni schvaľovateľa
> dokumentu upraviť chybu ale bez novej verzie, existujúce súhlasy osôb zostávajú platné,
> aj verzia dokumentu zostane tá istá, akurát sa opravia chyby a znovu sa pošle na
> indexovanie do RAG tá istá verzia, ktorá prepíše existujúcu“ (2026-09-12)
> **Odsúhlasil:** Ján Letko — opravuje **správca obsahu**, ukazuje sa **celý snímok**
> textu, a počas bežiaceho kola schvaľovania sa má radšej nechať vzniknúť nové kolo
> („bod 2 musíme pre čistotu nechať vytvoriť opätovné schvaľovanie“).
> **Nadväzuje na:** `docs/ADR-003-onboarding-a-potvrdzovanie.md` (D6, D24, D27, D28, D30, D57),
> `docs/ADR-006-schvalovanie-znenia.md` (D73, D74, D75)
> **Implementácia:** hotová (2026-09-13) — `src/lib/textFix.ts`, `fixText()`
> v `src/lib/libraryWrite.ts`, `fixTextAction()`, rozdiel a história v detaile dokumentu.

---

## 1. Čo problém odhalilo

Predpis je schválený, publikovaný, pridelený ľuďom a zaindexovaný do RAG. Ľudia ho
potvrdzujú. Príde pripomienka: **v článku 4 chýba čiarka.**

Dovtedy sa to dalo vyriešiť jedine novým znením. `versionId` sa počíta ako odtlačok
textu (D57), takže akákoľvek zmena textu — aj jednoznaková — vyrobí nové znenie. Na
`versionId` visia potvrdenia, pridelenia, trasy aj chunky, takže nové znenie znamená:

- **všetci, ktorí už potvrdili, potvrdzujú znova.** Za čiarku;
- výkaz personalistu skočí z „hotové“ na „nesplnené“ pri celej organizácii;
- v histórii dokumentu pribudne verzia, ktorá sa od predchádzajúcej líši jedným znakom
  — a o rok nikto nevie, či to bola novela alebo preklep.

Cena za opravu preklepu bola vyššia než cena za to nechať ho tam. To je zlá sústava:
robí z presnosti luxus.

---

## 2. Rozhodnutie

### D76 — `versionId` je **identita** znenia, nie odtlačok jeho dnešného textu

Odtlačok textu je to, čím `versionId` **vznikne** (D57 platí ďalej — pri publikovaní sa
počíta z textu). Nie je to ale to, čím `versionId` **je**: je to kľúč, na ktorom visia
potvrdenia, pridelenia, trasy a chunky.

Dnešný text nesie `contentHash`. Pole existovalo už predtým a pri publikovaní sa mu
nastavovala tá istá hodnota ako `versionId` — nie preto, že sú to to isté, ale preto, že
sa nemali ako rozísť. Po prvej oprave textu sa rozídu a to je celý mechanizmus:

| | čo to je | mení sa pri oprave textu |
|---|---|---|
| `versionId` | identita znenia | **nie** |
| `contentHash` | odtlačok textu, ako vyzerá teraz | áno |
| `chunkingId` | odtlačok členenia na úseky | áno (text sa zmenil) |

**Dôsledok, ktorý treba čítať:** `versionId` už nie je overiteľný prepočtom z textu. Kto
sa bude o rok pýtať „sedí odtlačok?“, musí vedieť, že sedí na text **pri publikovaní**,
nie na dnešný. Preto sa každá oprava zapisuje aj s celým predchádzajúcim textom.

### D77 — Text platného znenia smie opraviť **správca obsahu**, bez novej verzie

Podmienky sú štyri a žiadna nie je ozdoba:

1. **Rola.** Opravuje správca obsahu (`spravca-obsahu`), nie ktokoľvek, kto sa dostane
   do knižnice. Pravidlo je v `textFixProblem()` a pýta sa prvé — kto nesmie konať, nemá
   sa dozvedieť ani to, či je čo opravovať.
2. **Dôvod je povinný.** Rovnako ako pri zamietnutí znenia (D71) a pri oprave údajov
   o znení. Bez neho sa o rok nedá zistiť, čo sa v znení zmenilo a prečo pri tom
   potvrdenia zostali platné.
3. **Rozdiel musí byť vidieť pred uložením.** „Nemení to význam“ je tvrdenie toho, kto
   opravuje, a stojí na ňom platnosť cudzích podpisov. Tvrdenie, ktoré si nikto nemohol
   overiť, nie je doklad. Preto detail dokumentu ukazuje rozdiel konceptu proti platnému
   zneniu **skôr**, než sa dá na opravu kliknúť.
4. **Odkladá sa celý predchádzajúci text**, nie rozdiel. Rozdiel sa dá z dvoch textov
   dopočítať kedykoľvek; text z rozdielu nie. A pri otázke „čo presne stálo v tom, čo
   ľudia potvrdili“ je celý text jediná poctivá odpoveď.

**Potvrdenia zostávajú platné.** Formulka, ktorú ľudia podpísali, cituje názov, označenie
a dátum platnosti (D28) — nie text. Oprava čiarky z nej nerobí nepravdivé tvrdenie. Keby
sa menil význam, nie je to oprava, ale nové znenie; rozhodnúť to musí človek, systém ten
rozdiel nepozná (D30).

**Preindexovanie je súčasť úkonu, nie ďalšie tlačidlo.** `reindex()` vymieňa chunky pri
tom istom `versionId` — presne to, čo zadanie žiadalo („tá istá verzia, ktorá prepíše
existujúcu“). Keby to bol samostatný krok, existoval by stav, v ktorom knižnica ukazuje
opravený text a RAG odpovedá zo starého.

### D78 — Opravuje sa len **platné** znenie

Archivované znenie je doklad o tom, čo platilo vtedy. Prepísať ho by neznamenalo opraviť
chybu, ale zmeniť minulosť — a práve na to, že sa minulosť meniť nedá, sa celý reťazec
dôkazov (ADR-005) spolieha.

---

## 3. Čo sa tým vedome kazí

Toto je cena a nemá zmysel ju obchádzať:

- **Schválenie zostáva pri pôvodnom texte.** Kolá visia na `versionId`, ten sa nemení —
  takže po oprave je schválený text T a vonku text T'. Brána, ktorá od 2026-09-12 nepustí
  von neschválené znenie (D73), sa tu **obchádza**. Je to vedomé a vyvážené štyrmi
  podmienkami z D77: rolou, dôvodom, viditeľným rozdielom a snímkom. Kto mení význam,
  publikuje nové znenie a to prejde schvaľovaním celé.
- **Formulka potvrdenia už necituje text, ktorý je vonku, doslovne.** Cituje názov,
  označenie a dátum — a tie sa nemenia. Rozdiel medzi „potvrdil tento text“ a „potvrdil
  toto znenie“ existoval vždy; oprava ho len robí viditeľným.
- **Kto revertuje text späť na pôvodný**, dostane odtlačok zhodný s `versionId`, a
  `publish()` to vyhodnotí ako „už publikované“ (idempotencia) — nič sa nestane, hoci
  v `versions[]` je uložený opravený text. Je to úzka diera; rieši ju ďalšia oprava textu,
  nie publikovanie.

## 4. Čo tento dokument nerieši

- **Oprava záznamu o potvrdení** (typ `correction` v `acknowledgements`) — ~~stále otvorená
  v `docs/TODO.md`~~. **Zamietnutá 2026-09-13**, viď dodatok nižšie. Tento scenár ju
  nepotreboval.
- **Zvýraznenie rozdielu po slovách.** Rozdiel je po riadkoch; pri oprave čiarky to
  znamená jeden riadok dole a jeden hore. Stačí to a je to poctivé.
- **Oprava textu v archivovanom znení** (D78) a **hromadná oprava naprieč dokumentmi** —
  ani jedno nie je potrebné a obe by otvorili cesty, ktoré sa ťažko zatvárajú.


---

## Dodatok 1 (2026-09-13) — voľba pri zmene dátumu je zrušená (D82)

> **Stav:** schválené · **Odsúhlasil:** Ján Letko (2026-09-13)
> **Súvisiace:** `docs/D82_plan_zamknutie_udajov_znenia.md`, `docs/D81_plan_oprava_zaznamu_o_potvrdeni.md` (zamietnuté)

### Čo sa ruší

`fixVersion()` mal pri zmene dátumu platnosti nad potvrdeným znením pýtať
rozhodnutie: **`correction`** (rozdiel je nepodstatný, potvrdenia zostávajú) alebo
**`reacknowledge`** (nastaví `requiresReacknowledgement`). Parameter `onDateChange`
**zaniká** a s ním obe vetvy.

### Prečo

Bolo to vedomé rozhodnutie a rušíme ho z dvoch dôvodov, z ktorých druhý je vecný
a prvý je porucha:

**Vetva `reacknowledge` nerobila nič.** Nastavovala
`versions[].requiresReacknowledgement` a **ten príznak nikto nečíta** — overené
grepom cez celý `src`; jediný výskyt mimo zápisu je štítok v histórii verzií.
Povinnosť sa počíta ako *pridelenie × platná verzia − potvrdenia*, takže kto raz
potvrdil dané `versionId`, je hotový, a nové pridelenie toho istého znenia mu novú
povinnosť nevyrobí. Pole sa preto prestáva zapisovať; v type zostáva kvôli starým
záznamom.

**Vetva `correction` stála na predpoklade, ktorý sa nedá overiť.** Znela „rozdiel
je nepodstatný, podľa zlého dátumu nikto nekonal". To sa nedá vedieť. A pokiaľ to
nevieme, nechať platiť podpisy pod vetou s iným dátumom, než aký systém odvtedy
tvrdí, znamená vyrobiť rozpor, ktorý sa o rok nedá vysvetliť bez lovenia v audite.

### Čo platí namiesto toho

Deliaca čiara **nie je „malá vs. veľká zmena", ale „je ten údaj vo vete, ktorú
človek podpísal?"** Formulka (D28) cituje názov, označenie znenia a dátum platnosti.

- **Text vo formulke nie je** → jeho oprava zostáva presne taká, akú popisuje D77.
  Toto ADR sa tým nemení.
- **`label` a `effectiveFrom` vo formulke sú** → po prvom platnom potvrdení sa
  **zamykajú**. Odomkne ich jedine hromadné odvolanie potvrdení toho znenia
  (`revokeVersion()`, personalista, dôvod povinný); potom sa údaj opraví a ľudia
  potvrdia opravenú formulku.
- **Zdroj dátumu je povinný pri publikovaní.** Okno na bezbolestnú opravu je odteraz
  od publikovania po prvé potvrdenie, teda minúty — obrana sa preto presúva dopredu.

### Prečo nie „nová verzia a znovu schváliť"

Pôvodná formulácia zadania znela tak. Nejde to a nedáva to zmysel:

- `versionId = textFingerprint(markdown)` a `publish()` pri už existujúcom odtlačku
  vráti `alreadyDone` — **novú verziu s nezmeneným textom vyrobiť nejde**, a dve
  verzie s identickým textom by znamenali nejednoznačnú odpoveď na otázku „ktoré
  znenie platí" a zdvojené úseky vo vyhľadávaní;
- schvaľovanie sa viaže na **text**, nie na dátum. Dátum sa zadáva až pri
  publikovaní a schvaľovaním nikdy neprešiel. Kto dátum naozaj podpísal, sú tí, čo
  **potvrdili** — preto sa opakuje potvrdenie, nie schválenie.

Nová verzia a nové schvaľovanie zostávajú tam, kam patria: pri zmene textu.

### Cena, ktorá sa nezakrýva

Preklep v dátume alebo v označení stojí kolo potvrdení pre všetkých, ktorí znenie
už potvrdili. Je to vedomé: dátum platnosti nie je preklep v čiarke, je to údaj,
od ktorého sa počíta viazanosť.
