# ADR-004 — Termín potvrdenia (`due`) a pripomienky pred ním aj po ňom

> **Stav:** návrh na schválenie · **Dátum:** 2026-09-09
> **Rozhodol:** Ján Letko (termín na pridelení + denné pripomienky), zvyšok je návrh
> **Nadväzuje na:** `docs/ADR-003-onboarding-a-potvrdzovanie.md` (D6, D24, D27, D30, D50)
> **Súvisiace:** `docs/DESIGN_GAP.md` (obrazovka Prehľad si termín vyžiada), `app/src/lib/reminders.ts`, `app/src/app/api/cron/overdue/route.ts`
> **Implementácia:** zatiaľ žiadna — toto rozhodnutie predchádza kódu.

---

## 1. Čo problém odhalilo

Obrazovka „Prehľad" z návrhu má pri každej nesplnenej povinnosti termínový chip
(`do 12. 9.`) a farbí ho podľa blízkosti. Pri kontrole dát sa ukázalo, že **také
pole v systéme nie je**: `PendingItem` nesie `assignedAt`, `assignments` termín
nemá, a jediné číslo v okolí je prah pripomienok `DEFAULT_DAYS = 14`.

Ponúkalo sa dopočítať termín ako `assignedAt + 14`. To sme zamietli: 14 dní je
**spúšťač e-mailu pre personalistu**, nie sľub daný človeku. Kto potvrdí na 15.
deň, bol by „po termíne", hoci mu nikto termín nedal — a v systéme, ktorého
výstupom je dôkaz o oboznámení, je rozdiel medzi „mešká" a „prekročil termín"
podstatný.

**Rozhodnutie Jána Letka: termín patrí na pridelenie.** HR ho určí tam, kde už
dnes povinne zadáva dôvod (D30) a kde sa kontroluje platnosť znenia (D6).

---

## 2. Rozhodnutie

### D61 — Termín je súčasťou pridelenia, nie odvodený z prahu

`Assignment` dostane pole `due`. Prah pripomienok zostáva tým, čím je: interným
spúšťačom prehľadu pre personalistu.

Pridelenie **bez termínu je platný stav**, nie chyba. Existujúce pridelenia sa
nemigrujú a termín sa im nedopočítava — dopísať termín spätne by znamenalo
vymyslieť dátum, ktorý nikto nedal. V rozhraní taká povinnosť ukáže, ako dlho
čaká, nie termín.

### D62 — Termín má dva tvary, absolútny a relatívny

```ts
type Due =
  | { kind: "date"; at: Date }      // „všetci do 30. 9."
  | { kind: "days"; days: number }  // „do 14 dní odkedy povinnosť vznikla"
```

Jeden tvar nestačí a **nie je to bohatstvo pre bohatstvo**:

- **Absolútny** je to, čo HR obvykle chce („do konferencie SFZ") a čo kreslí
  návrh. Má ale dieru: kto do oddelenia príde 29. 9., dostane na normu jeden deň.
- **Relatívny** tú dieru nemá a **sedí na D50** („úloha z oddelenia platí odo dňa
  príchodu"). Odkedy povinnosť pre konkrétneho človeka beží, už dnes počíta
  `dateForPerson()` — berie neskorší z `assignedAt` a dňa príchodu do oddelenia
  alebo skupiny.

Termín pre jednu osobu je teda jedna funkcia nad existujúcou:

```ts
dueForPerson(a, person) =
  a.due?.kind === "date" ? a.due.at
  : a.due?.kind === "days" ? addDays(dateForPerson(a, person), a.due.days)
  : null   // bez termínu — platný stav
```

**Tým sa zároveň odpovedá otvorená otázka o trasách.** Pri trase pridelenie
neexistuje, takže absolútny dátum nemá kam zapísať; relatívny tvar má a plynie
od toho istého okamihu, ktorý už `dateForPerson()` vracia. Praktický dôsledok:
povinnosti z trás dostanú termín len v relatívnom tvare, na úrovni kroku trasy.

### D63 — Stav povinnosti voči termínu je odvodený, nie uložený

Rovnaká zásada ako D27:

| stav | podmienka | farba v návrhu |
| --- | --- | --- |
| `none` | termín nie je | `--surface-2` / `--muted` |
| `open` | do termínu viac než 5 dní | `--surface-2` / `--muted` |
| `soon` | 5 a menej dní vrátane dňa termínu | `--warn-bg` / `--warn-fg` |
| `over` | po termíne | `--bad-bg` / `--bad-fg` |

Deň termínu patrí do `soon`, nie do `over`: kto potvrdí v ten deň, termín
splnil.

---

## 3. Pripomienky — a dve námietky k zadaniu

Zadanie: *„upozornenia nech chodia 5 dní každý deň pred koncom `dueAt` a po
`dueAt` každý deň, aj s upozornením, že buď sa blíži koniec určeného termínu,
alebo je už po termíne."*

Prvá polovica je bez námietky. Druhá má dve, a obe stoja na tom, čo je už
v repozitári zapísané.

### 3.1 Ide to proti rozhodnutiu z 2026-09-06 (a prečo je to tu obhájiteľné)

`api/cron/overdue/route.ts` hovorí doslova: *„Nerozposiela pripomienky ľuďom…
jedna chyba v podmienke by sa pri automatickom rozposielaní prejavila až tým, že
sa ozve sto nahnevaných ľudí."* Preto dnes cron píše **personalistovi** a ten
odosiela sám.

Nové zadanie chce automatické e-maily **ľuďom**. Myslím si, že je to
obhájiteľné, a dôvod je konkrétny: vtedy bol spúšťačom **dopočítaný prah**
(14 dní pre všetkých rovnako), teraz je ním **dátum, ktorý na to konkrétne
pridelenie zadal človek**. Chyba v podmienke „prah pre všetkých" zasiahne
všetkých; pri termíne na pridelení je najhorší prípad ohraničený tým, čo HR
zadalo, a je to vidieť na obrazovke prideľovania ešte pred odoslaním.

Podmienka, ktorú by som k tomu držal: **náhľad pred prvým behom** a limit počtu
adresátov na jeden beh, aby prvé nasadenie nemohlo rozposlať tisíc e-mailov skôr,
než si to niekto pozrie.

### 3.2 „Po termíne každý deň" — proti tomu namietam

Ten istý súbor: *„denný e-mail o tom istom zozname je do troch dní pošta, ktorú
personalista prestane otvárať — a tým prestane fungovať aj upozorňovanie."* Pri
človeku je to horšie než pri personalistovi:

- kto je mesiac na nemocenskej s jednou nepotvrdenou normou, dostane **30
  e-mailov** a vráti sa do plnej schránky,
- denná pošta o tej istej veci si vypestuje filter alebo pravidlo „do koša",
  takže nabudúce nezaberie ani prvý e-mail,
- pri doručovaní to poškodí domény zväzu — hromadná pošta, ktorú nikto neotvára,
  je presne to, čo poštové služby merajú.

Po termíne navyše nie je problém v tom, že človek zabudol. Tam už je problém
organizačný. Preto navrhujem **eskaláciu namiesto opakovania**:

| kedy | komu |
| --- | --- |
| D-5 … D-0 (šesť dní) | osobe, každý deň, „termín sa blíži" |
| D+1, D+3, D+7 | osobe, „ste po termíne" |
| od D+7 raz týždenne | osobe **a** personalistovi (súhrn) |

Šesť e-mailov pred termínom je ohraničené a odôvodnené — termín sa naozaj blíži.
Po termíne tri, potom týždenne. Kto na to nereaguje mesiac, nepotrebuje 30.
e-mail; potrebuje, aby o tom vedel jeho nadriadený.

**Toto je návrh, nie hotová vec.** Ak trváš na dennom režime aj po termíne,
implementujem to tak, ako si povedal — je to tvoje rozhodnutie a nesie ho
organizácia, nie ja. Chcem len, aby bolo urobené s vedomím, čo to spôsobí, a nie
omylom.

### 3.3 Čo platí v oboch prípadoch

- **Jeden e-mail na osobu, dokument a deň, nikdy dva.** Odoslanie sa eviduje
  (`notified[]` na pridelení už existuje) s dňom v kľúči, takže druhý beh
  crona v ten istý deň nepošle nič.
- **Text hovorí stav, nie len fakt**: pred termínom „termín je *dátum*, zostávajú
  *N* dni", po terméne „termín bol *dátum*, ste po ňom *N* dní". Dva tvary
  jednej šablóny, ako to už má `reminderEmail(…, mode)`.
- **Potvrdené povinnosti vypadnú** z výberu, nie sa filtrujú v šablóne.
- Bez `due` sa nepripomína automaticky vôbec — ostáva dnešná cesta cez
  personalistu.

---

## 4. Čo to znamená v kóde

| krok | súbory | poznámka |
| --- | --- | --- |
| 1. schéma a zápis | `lib/assignments.ts` (`Assignment.due`, `NewAssignment`, `assign`), `dueForPerson()` | pole voliteľné, bez migrácie |
| 2. prideľovanie | `app/hr/assign/page.tsx`, `app/hr/actions.ts`, `lib/i18n.ts` | dve polia: dátum alebo počet dní, žiadne z nich povinné |
| 3. zobrazenie | `lib/pending.ts` (`PendingItem.due`), Prehľad, `/documents`, HR výkaz | chip podľa D63 |
| 4. pripomienky | `lib/reminders.ts`, `lib/ecomail.ts`, `api/cron/overdue` | až po rozhodnutí o 3.2 |
| 5. plán behu | `app/vercel.json` | **zmena produkčného nastavenia** — dnes `0 6 * * 1` (týždenne), pre denný režim treba `0 6 * * *`. Ide do PR, nemerguje sa bez súhlasu. |

### Riziká

- **Krok 4 sa nedá overiť inak než na ostro.** Cron beží na Verceli a náhľady sú
  za SSO. Preto najprv beh „naprázdno" (spočíta a nepošle) a jeho výstup do logu.
- Termín na obrazovke znamená, že si ho ľudia začnú pamätať. Zmena `due` na už
  rozposlanom pridelení je preto zmena sľubu — patrí do auditu (D51) rovnako ako
  oprava dátumu platnosti.
- `docs/TODO.md` tvrdil, že naplánovanú úlohu nemáme. **Máme** — `vercel.json`
  ju má od začiatku. Zápis bol zastaraný a je opravený; dokumentácia je indícia,
  kód je pravda.
