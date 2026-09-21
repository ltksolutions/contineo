# ZADANIE.md — ako vlnu A a B zadať Coworku

Krátky návod. Celý postup a poradie PR je v `POSTUP.md`; toto je to, čo
sa reálne píše do okna.

---

## Krok 1 — dostať balík do repozitára

Rozbaľ obsah do `contineo/docs/design/` a commitni.

**Prepíšu sa tri staršie súbory** (`README.md`, `NASADENIE.md`,
`KNIZNICA.md` tam už sú) — to je v poriadku, nové sú ich pokračovanie.
Po commite má `docs/design/` obsahovať:

```
MASTER.md      ZAKLAD.md      POSTUP.md      ZADANIE.md
PREHLAD.md     ASK.md         DOCUMENTS.md   APPROVALS.md
ZNENIE.md      DETAIL.md      KNIZNICA.md    NAHRAVANIE.md
PRIECINKY.md   SPRAVA.md      HR.md          POSUDENIE.md
OSOBY.md       SPRAVCA.md
ZAKLAD.html    PREHLAD.html   ASK.html       DOCUMENTS.html
APPROVALS.html DETAIL.html    SPRAVA.html    HR.html
OSOBY.html
```

`.html` súbory sa **needitujú** — sú to referencie na pozeranie.

## Krok 2 — jedno zadanie na jeden PR

Coworku sa nezadáva „urob vlnu A". Zadáva sa **jeden súbor naraz**, v tomto
poradí. Text na skopírovanie:

```
Implementuj docs/design/ZAKLAD.md.

Najprv si prečítaj docs/design/MASTER.md — sú v ňom pravidlá, ktoré platia
všade, a rozhodnutia, ktoré sa už urobili (stavový model, terminológia,
stĺpce tabuľky).

ZAKLAD.md je diff proti súčasnému kódu, nie stavba od nuly. Tabuľku
„Čo je v repozitári UŽ HOTOVÉ" ber ako zákaz — tie veci neprepisuj.

Vizuálna referencia je docs/design/ZAKLAD.html — otvor ju v prehliadači.
Needituj ju.

Jeden commit na úlohu. Po dokončení zapíš riadok do docs/TODO.md.
```

Pri ďalších stačí prvý riadok zmeniť:

| # | Zadaj | Referencia |
| --- | --- | --- |
| 0 | `docs/design/ZAKLAD.md` | `ZAKLAD.html` |
| 1 | `docs/design/PREHLAD.md` | `PREHLAD.html` |
| 2 | `docs/design/DOCUMENTS.md` | `DOCUMENTS.html` |
| 3 | `docs/design/APPROVALS.md` | `APPROVALS.html` |
| 4 | `docs/design/ZNENIE.md` | `DETAIL.html` (dolná časť) |
| 5 | `docs/design/DETAIL.md` | `DETAIL.html` (horná časť) |
| 6 | `docs/design/ASK.md` | `ASK.html` |
| 7 | `docs/design/NAHRAVANIE.md` | `SPRAVA.html` (časť 1) |
| 8 | `docs/design/PRIECINKY.md` | `SPRAVA.html` (časť 2) |
| 9 | `docs/design/SPRAVA.md` | `SPRAVA.html` (časť 3–4) |
| 10 | `docs/design/HR.md` | `HR.html` |
| 11 | `docs/design/POSUDENIE.md` | `HR.html` (časť 4–5) |
| 12 | `docs/design/OSOBY.md` | `OSOBY.html` |
| 13 | `docs/design/SPRAVCA.md` | `OSOBY.html` (časť 3–4) |

**PR 0 musí byť prvý.** Všetko ostatné číta jeho tokeny a triedy.
Zvyšok už na sebe nezávisí — 1 až 13 sa dajú robiť v ľubovoľnom poradí, aj
súbežne, ak na nich robí viac ľudí.

**Dva súbory obsahujú viac obrazoviek naraz:** `SPRAVA.md` (Kolá, Kurácia,
Upozornenia, Viac) a `HR.md` (šesť obrazoviek personalistu). Ak je to na
jeden PR veľa, rozdeľ ich po kapitolách — každá je samostatná a má vlastné
číslovanie úloh.

## Krok 3 — čo Coworku povedať, keď sa opýta

Tri veci sa stanú skoro isto:

**„Toto v zadaní nie je, mám to doplniť?"**
> Nie. Zadania sú diffy proti skutočnému kódu — čo v nich nie je, je buď
> v poriadku, alebo o tom nepadlo rozhodnutie. Napíš to do PR ako otázku
> a kód nechaj tak.

**„Toto by sa dalo urobiť lepšie takto…"**
> Ak je to v rámci zadanej úlohy, sem s tým. Ak je to nová vec, napíš to do
> PR a nerob to.

**„Potrebujem zmeniť schému / `layout.tsx` / `--accent`."**
> Zastav sa a napíš mi to. Bez môjho súhlasu nič z toho.

## Krok 4 — po každom PR

1. Prejdi dotknutú obrazovku **na 390 px** a **v tmavej téme**. Obe sú
   v zadaniach vyznačené ako rizikové.
2. Skontroluj, že v `lib/i18n.ts` pribudli kľúče vo **všetkých troch**
   jazykoch, nie len v `sk`.
3. Pozri zápis v `docs/TODO.md` — má tam byť aj to, čo Cowork urobil **inak**
   než zadanie, a prečo. Tie odchýlky sú cennejšie než potvrdenie, že sa to
   podarilo.

**Po PR 0 navyše:** prejdi všetkých 31 rout. PR 0 pridáva `.empty`,
`.pager`, vypnutý stav a opravu zarovnania hlavičky — dotkne sa aj
pätnástich obrazoviek, ktoré navrhnuté nie sú. Zmena je k lepšiemu, ale
treba vedieť, že sa nič nerozbilo.

---

## Dve rozhodnutia, ktoré padnú na teba počas vlny A

Sú v `POSTUP.md` podrobne; v skratke:

1. **PR 2 (`DOCUMENTS.md`, úloha 1):** termín chýba na troch obrazovkách,
   lebo `acknowledgementDuties()` ho nevracia, hoci `pendingForPerson()`
   ho má. Dáta existujú, schéma sa nemení. Cowork sa spýta, či to doplniť
   do návratového typu — povedz áno.
2. **„Uložiť pohľad"** v knižnici: MASTER.md hovorí, že sa nerobí a odkaz
   sa odstráni. Ak s tým nesúhlasíš, povedz to **pred** PR 0.
