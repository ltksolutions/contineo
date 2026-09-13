# D81 — oprava záznamu o potvrdení (návrh, na rozhodnutie)

> **Stav:** ⬜ návrh. Nadväzuje na D24 (append-only kolekcia), D28 (znenie
> formulky), D71 (dôvod povinný), ADR-005 (reťaz dôkazov), ADR-007 (oprava
> údajov a textu znenia).
> **Založené:** 2026-09-13. Otvorený bod vedený v `docs/TODO.md`, sekcia **O4**.

## 1. Čo je dnes — overené v kóde

Typ `correction` **existuje v type a nikde inde**:

- `RecordType = "acknowledgement" | "revocation" | "correction"`
  (`app/src/lib/acknowledgements.ts`);
- `supersedes` je v type aj v zázname, ale `acknowledge()` doň zapisuje
  natvrdo `null`;
- implementovaná je len vetva `revocation` (`revoke()`, brána `revokeProblem()`);
- **`validAcknowledgements()` filtruje `type: { $in: ["acknowledgement",
  "revocation"] }`** — oprava by sa dnes do čítania nedostala vôbec;
- unikátny index `acknowledgement_cycle_unique` má
  `partialFilterExpression: { type: "acknowledgement" }`, takže záznam typu
  `correction` sa oň nezasekne. To je dobrá správa: schéma sa kvôli tomu
  meniť nemusí.

## 2. Kedy vôbec treba niečo opravovať

Toto je otázka, ktorú treba zodpovedať **pred** návrhom mechanizmu. Záznam je
odtlačok — kopíruje údaje v čase potvrdenia zámerne, aby bol čitateľný o tri
roky. Odtlačok, ktorý bol vtedy pravdivý, sa neopravuje ani vtedy, keď sa
skutočnosť medzitým zmenila (človek sa presťahoval, oddelenie sa premenovalo).
**Meniť sa má len to, čo bolo nepravdivé už v okamihu zápisu.**

Reálne prípady sú dva a oba sú doložené:

**(a) Oprava údajov znenia pod už podpísaným záznamom.** `fixVersion()`
s voľbou `onDateChange: "correction"` opraví dátum platnosti a **potvrdenia
nechá tak** — je to vedomé rozhodnutie z ADR-007. Lenže potvrdzovacia formulka
obsahuje dátum doslovne (D28) a záznam si ju uložil ako text. Po takej oprave
teda záznam tvrdí „platná od 1. 1." a znenie hovorí „od 1. 2.". Dnes s tým
nespravíme nič. To isté platí pre opravené označenie znenia a názov dokumentu.

**(b) Chybný odtlačok osoby.** Meno alebo oddelenie boli v `persons` zle už
v čase potvrdenia (preklep pri importe) a záznam si tú chybu skopíroval.

Prípad, ktorý sem **nepatrí**: `acknowledgements.trackId` sa nikdy nevyplní,
lebo `/api/acknowledgements` posiela natvrdo `null`. To nie je oprava záznamu,
to je nedorobená cesta — vedené zvlášť v sekcii I.

## 3. Jadro veci: čo sa opraviť nesmie nikdy

**`statementText` a `statementHash` sú podpis.** Je to doslovné znenie, ktoré
človek videl a potvrdil. Keby sa dalo opraviť, dal by sa spätne vyrobiť stav,
v ktorom človek „potvrdil" niečo, čo nikdy nevidel — a celá reťaz dôkazov
(ADR-005) by tým stratila zmysel. Rovnako `acknowledgedAt`, `ip`, `userAgent`,
`personId`, `versionId` a `cycle`: to je záznam o úkone, nie údaj o svete.

Z toho plynie nepríjemná, ale správna vec: **po oprave zostáva v evidencii
pravda, že človek potvrdil formulku s nesprávnym dátumom.** Oprava k nej len
dopíše, čo je správne a prečo. Zakryť to nejde — a nemá.

Kto chce, aby ľudia potvrdili **správnu** formulku, nepoužije opravu, ale
`requiresReacknowledgement` (D30) — tá cesta už existuje a je to druhá voľba
v tom istom dialógu `fixVersion()`.

## 4. Návrh

### 4.1 Oprava je nový záznam, nie úprava starého

Presne ako odvolanie. Záznam typu `correction`:

| pole | hodnota |
|---|---|
| `type` | `"correction"` |
| `supersedes` | `_id` opravovaného záznamu |
| `cycle` | rovnaké ako opravovaný záznam |
| `personId`, `versionId`, `documentId` | rovnaké — oprava sa neprenáša inam |
| `statementText`, `statementHash`, `acknowledgedAt`, `ip`, `userAgent` | **kópia pôvodných**, nikdy nie nové hodnoty |
| `documentTitle`, `versionLabel`, `effectiveFrom`, `fullName`, `email`, `departmentId`, `departmentNames` | **opravené hodnoty** |
| `reason` | povinný |
| `actedBy` | personalista, ktorý opravu vykonal |
| `createdAt` | čas opravy |

Pôvodný záznam zostáva nedotknutý a čitateľný.

### 4.2 Oprava nemení platnosť

`isAcknowledged()` počíta potvrdenia mínus odvolania. **Oprava nie je ani
jedno** — povinnosť sa ňou nemení. Ale musí byť v čítaní prítomná, inak by
výkaz ukazoval staré hodnoty:

- `validAcknowledgements()` rozšíri filter o `"correction"`;
- korekcia sa **nezapočítava** do `acknowledgements` ani `revocations`;
- pri zobrazení sa údaje berú z **najnovšej** korekcie na daný `supersedes`.

Toto je najzraniteľnejšie miesto celej zmeny: pravidlo „čo platí" je dnes na
jednom mieste zámerne (`isAcknowledged()`), a pridanie tretieho typu je presne
ten druh úpravy, po ktorej výkaz personalistu povie niečo iné než detail
dokumentu. Musí to byť pokryté testom, nie pozornosťou.

### 4.3 Kto a za akých podmienok

Rovnako ako pri odvolaní: **koná personalista, dôvod je povinný.** Brána
`correctionProblem()` bez databázy, vedľa `revokeProblem()`:

- `correction.notHr` — rola sa pýta prvá;
- `correction.nothingToCorrect` — záznam neexistuje alebo už neplatí;
- `correction.reasonRequired`;
- `correction.nothingChanged` — opravené hodnoty sú zhodné s pôvodnými.
  Záznam, ktorý nič nemení, je šum v dôkaznej reťazi.

## 5. Zvažované a zamietnuté

**Žiadna oprava — kto má zlý záznam, dostane odvolanie a potvrdí znova.**
Najjednoduchšie a bez novej schémy. Zamietam to preto, že trest za cudziu
chybu nesie osoba: pri preklepe v dátume by musela znova potvrdzovať celá
organizácia. Cesta „odvolať a potvrdiť znova" má zostať pre prípad, keď sa
zmenila **povinnosť**, nie zápis o nej.

**Oprava smie zmeniť aj formulku.** Zamietnuté v §3 — spätne prepísaný podpis
nie je podpis.

**Oprava priamo v zázname (`$set`).** Proti D24. Append-only nie je štýl, je to
jediný dôvod, prečo sa tej kolekcii dá veriť.

## 6. Kroky

| # | Krok | Odhad |
|---|---|---|
| 1 | `correctionProblem()` — pravidlá bez databázy + testy | 0,5 d |
| 2 | `correct()` v `lib/acknowledgements.ts` | 0,5 d |
| 3 | Čítanie: `validAcknowledgements()` s korekciami, najnovšia vyhráva + testy | 0,5 d |
| 4 | Výkaz personalistu: formulár opravy pri zázname, mobile-first | 1 d |
| 5 | Zobrazenie v histórii osoby — oprava musí byť vidieť, nielen jej výsledok | 0,5 d |
| 6 | ADR-008 (z tohto dokumentu), CHANGELOG, TODO | 0,5 d |

## 7. Riziká

| # | Riziko | Ošetrenie |
|---|---|---|
| R1 | Tretí typ rozbije „čo platí". Sedem miest číta potvrdenia cez `validAcknowledgements()`; stačí, aby jedno počítalo korekciu ako potvrdenie, a povinnosť niekomu zmizne. | Pravidlo zostáva v `isAcknowledged()`, korekcie doň nevstupujú. Test: korekcia nemení výsledok `isAcknowledged()` ani počet v HR výkaze. |
| R2 | Dve korekcie toho istého záznamu. Index ich nezakáže (`partialFilterExpression` mieri len na `acknowledgement`). | Pravidlo „najnovšia vyhráva" podľa `createdAt`, napísané raz a otestované. Zakazovať druhú opravu nemá zmysel — aj oprava môže byť chybná. |
| R3 | Oprava sa použije na zakrytie nepríjemného stavu. | Pôvodný záznam zostáva a v histórii osoby je vidieť aj korekciu, nielen jej výsledok (krok 5). Dôvod je povinný. |
| R4 | Zvedie to na opravovanie odtlačkov, ktoré boli vtedy pravdivé (premenované oddelenie). | Formulár ponúka len polia zo §4.1 a hláška hovorí, že oprava je pre údaje nepravdivé **v čase zápisu**. Zmena sveta sa neopravuje. |

## 8. Otázky na rozhodnutie

1. **Púšťame to vôbec?** Alternatíva „odvolať a potvrdiť znova" je zadarmo
   a už existuje. Za opravou stojí prípad (a) z §2 — opravený dátum znenia pod
   podpísanými záznamami. Ak sa to v praxi nestane, D81 nie je potrebné.
2. **Smie opravu vykonať aj správca obsahu**, keď opravuje dôsledok vlastnej
   opravy znenia (`fixVersion`)? Alebo výhradne personalista, ako pri odvolaní?
3. **Má `fixVersion()` s voľbou `correction` ponúknuť opravu záznamov hneď**,
   ako súčasť toho istého úkonu? Je to pohodlné a nebezpečné zároveň —
   hromadná oprava dôkazov jedným kliknutím.
4. **Kedy?** Sekcia O4 je za Fázou 8. Prípad (a) ale môže nastať hocikedy.
