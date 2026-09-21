# PROMPT.md — text na skopírovanie do Coworku

Dva prompty: prvý raz (výmena adresára), potom jeden na každý PR.

---

## 1. Prvý prompt — výmena obsahu `docs/design/`

```
Adresár docs/design/ som celý vymenil za nový handoff. Staré súbory sú
zmazané, nové sú v repozitári.

Najprv si prečítaj docs/design/INDEX.md — je to rozcestník. Potom
docs/design/MASTER.md (pravidlá platné všade a rozhodnutia, ktoré už padli)
a docs/design/POSTUP.md (poradie PR a zákazy).

Nič ešte neimplementuj. Napíš mi:
1. či ti niečo v zadaniach chýba alebo si protirečí,
2. či v repozitári zostali odkazy na zmazané súbory z docs/design
   (NASADENIE.md, SPRAVCA.md, OSOBY.html a pod.) — hľadaj v docs/ aj
   v app/src/,
3. či docs/TODO.md treba doplniť o odkaz na nový handoff.
```

## 2. Prompt na každý PR

Mení sa len prvý riadok. Poradie je v `POSTUP.md` — drž sa ho.

```
Implementuj docs/design/ZAKLAD.md.

Kontext, ktorý si prečítaj pred prácou:
- docs/design/MASTER.md — pravidlá platné všade (i18n sk/cs/en, nič
  nevyžaduje JavaScript, breakpointy len 640 a 1024, --accent ostáva
  #232a35, layout.tsx sa nemení) a rozhodnutia, ktoré už padli
  (stavový model dokumentu, terminológia Druh/Značka/Oddelenie,
  stĺpce tabuľky knižnice).
- docs/design/ZAKLAD.md — tokeny a komponenty, z ktorých čítajú všetky
  ostatné zadania.

Ako čítať zadanie:
- Je to DIFF proti súčasnému kódu, nie stavba od nuly.
- Tabuľku „Čo je v repozitári UŽ HOTOVÉ" ber ako zákaz — tie veci
  neprepisuj. Čísla riadkov v nej sú z globals.css.
- Úlohy sú číslované; rob ich v poradí, ktoré zadanie uvádza.

Vizuálna referencia: docs/design/ZAKLAD.html — otvor v prehliadači.
Je to statické HTML s reálnymi hodnotami, needituj ho.

Pravidlá práce:
- Jeden commit na úlohu, v správe číslo úlohy (napr. „ZAKLAD úloha 3 —
  vypnutý stav ovládačov").
- Nový text = nový kľúč v lib/i18n.ts vo VŠETKÝCH troch jazykoch, nie
  TODO: preložiť.
- Nové tokeny do :root aj do html[data-theme="dark"].
- Pred commitom: cd app && npx tsc --noEmit && npx eslint . &&
  npx vitest run && npm run build
- Po dokončení prejdi dotknuté obrazovky na 390 px a v tmavej téme.
- Zapíš riadok do docs/TODO.md — vrátane toho, čo si urobil INAK než
  zadanie, a prečo.

Keď naďabíš na niečo, čo zadanie nepokrýva: napíš to do PR ako otázku
a kód nechaj, ako je. Nedotváraj z hlavy.

Bez môjho súhlasu nemeň: schému, layout.tsx, --accent, darken(hex, 0.16),
normalizeQuery/toQuery.
```

## 3. Ďalšie PR — len prvý riadok

| PR | Prvý riadok | Referencia |
| --- | --- | --- |
| 1 | `Implementuj docs/design/PREHLAD.md.` | `PREHLAD.html` |
| 2 | `Implementuj docs/design/DOCUMENTS.md.` | `DOCUMENTS.html` |
| 3 | `Implementuj docs/design/APPROVALS.md.` | `APPROVALS.html` |
| 4 | `Implementuj docs/design/ZNENIE.md.` | `DETAIL.html` (dolná časť) |
| 5 | `Implementuj docs/design/DETAIL.md.` | `DETAIL.html` (horná časť) |
| 6 | `Implementuj docs/design/ASK.md.` | `ASK.html` |
| 7 | `Implementuj docs/design/NAHRAVANIE.md.` | `SPRAVA.html` (časť 1) |
| 8 | `Implementuj docs/design/PRIECINKY.md.` | `SPRAVA.html` (časť 2) |
| 9 | `Implementuj docs/design/SPRAVA.md.` | `SPRAVA.html` (časť 3–6) |
| 10 | `Implementuj docs/design/HR.md.` | `HR.html` |
| 11 | `Implementuj docs/design/POSUDENIE.md.` | `HR.html` (časť 4–5) |
| 12 | `Implementuj docs/design/OSOBY.md.` | `PEOPLE.html` |
| 13 | `Implementuj docs/design/ADMIN.md.` | `PEOPLE.html` (časť 3–4) |

**PR 0 musí byť prvý.** Zvyšok na sebe nezávisí.

**PR 9 a 10 sú väčšie** (štyri a šesť obrazoviek). Ak je to na jeden PR
veľa, zadaj ich po kapitolách — napríklad „Implementuj docs/design/HR.md,
úlohy 1 a 2" — každá kapitola je samostatná.

---

## 4. Čo odpovedať na časté otázky

**„Táto obrazovka nie je v zadaní, mám ju upraviť?"**
> Nie. Napíš to do PR ako otázku a kód nechaj tak.

**„Toto by sa dalo urobiť lepšie takto…"**
> Ak je to v rámci zadanej úlohy, sem s tým. Ak je to nová vec, napíš to
> do PR a nerob to.

**„Potrebujem zmeniť schému / layout.tsx / --accent."**
> Zastav sa a napíš mi to.

**„V zadaní je číslo riadku, ktoré v globals.css nesedí."**
> Zadania boli písané 21. 9. 2026. Ak sa kód odvtedy posunul, nájdi
> pravidlo podľa názvu triedy a napíš mi, že sa čísla rozišli.

---

## 5. Tri rozhodnutia, ktoré padnú na Jána

Cowork sa na ne spýta; odpovede nie sú v zadaniach.

1. **PR 2** — termín chýba na troch obrazovkách, lebo
   `acknowledgementDuties()` ho nevracia, hoci `pendingForPerson()` ho má.
   Dáta existujú, schéma sa nemení. → **doplniť do návratového typu**
2. **PR 0 / knižnica** — „Uložiť pohľad" sa nerobí a odkaz sa odstráni
   (adresa už je uložený pohľad). Ak Ján nesúhlasí, treba to povedať
   **pred** PR 0.
3. **PR 12** — čo pri importe CSV s osobou, ktorá už v systéme je:
   prepísať, preskočiť, alebo import zastaviť. Cowork najprv zistí, ako sa
   to chová dnes.
