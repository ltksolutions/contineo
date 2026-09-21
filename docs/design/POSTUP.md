# POSTUP.md — ako to nasadiť na produkciu

**Odpoveď na otázku „môžeme začať?“: áno, ale nie všetko naraz a nie hneď
na `main`.**

Navrhnutých je všetkých 31 rout handoffu (`MASTER.md`). Poradie ale nie je
ľubovoľné: `ZAKLAD` nesie všetko ostatné a vlna A sú obrazovky, ktoré človek
vidí každý deň.

---

## Zoznam PR — všetkých 31 obrazoviek

Navrhnuté je všetko. Poradie je podľa toho, koľko ľudí obrazovku vidí.

| PR | Zadanie | Obrazovky | Riziko |
| --- | --- | --- | --- |
| **0** | `ZAKLAD.md` | všetky (tokeny, komponenty) | nízke — pridáva, nemení |
| **1** | `PREHLAD.md` | `/` | nízke |
| **2** | `DOCUMENTS.md` | `/documents` | **stredné** — úloha 1 siaha do `acknowledgementDuties()` |
| **3** | `APPROVALS.md` | `/approvals` | nízke |
| **4** | `ZNENIE.md` | `/documents/[documentId]` | nízke |
| **5** | `DETAIL.md` | `/library/[id]` | **stredné** — prestavba hierarchie |
| **6** | `ASK.md` | `/ask` | **stredné** — mení, čo systém tvrdí |
| **7** | `NAHRAVANIE.md` | `/library/new` | nízke |
| **8** | `PRIECINKY.md` | `/library/folders` | nízke |
| **9** | `SPRAVA.md` | `/library/tracks`, `/library/curation`, `/notifications`, `/more` | nízke — dá sa rozdeliť po kapitolách |
| **10** | `HR.md` | `/hr` + 5 podstránok | **vyššie** — úloha 1 zjednocuje škálu naprieč 6 obrazovkami |
| **11** | `POSUDENIE.md` | `/evaluation`, `/acknowledgements` | nízke |
| **12** | `OSOBY.md` | `/people` + 4 podstránky | **stredné** — úloha 2 pridáva filtre do URL |
| **13** | `ADMIN.md` | `/admin`, `/guide` | nízke |
| — | `KNIZNICA.md` | `/library` | ✅ hotové (PR 8) |
| — | — | `/directory`, `/organisation`, `/sign-in` | ✅ hotové |

**PR 0 musí byť prvý** — všetko ostatné číta jeho tokeny a triedy.
Ostatné na sebe nezávisia; PR 1–13 sa dajú robiť v ľubovoľnom poradí,
aj súbežne.

**Dva PR sú väčšie než ostatné a nemajú sa skladať s ničím iným:**
PR 10 (`HR.md` — šesť obrazoviek, zjednotenie stavovej škály) a PR 9
(`SPRAVA.md` — štyri obrazovky; ak je to veľa, rozdeľ po kapitolách,
každá má vlastné číslovanie úloh).

PR 6 (`ASK`) je zámerne až po vlne A — jeho úloha 1 hovorí, že bez zdrojov
sa odpoveď **nezobrazí vôbec**, a to je zmena správania produktu, nie
vzhľadu. Nech si na ňu najprv zvykne niekto interne.

## Postup pri každom PR

1. **Prečítaj zadanie celé**, vrátane tabuľky „Čo je UŽ HOTOVÉ“. Väčšina
   práce je hotová — zadanie je diff, nie stavba od nuly.
2. **Otvor statickú referenciu** (`*.html`) v prehliadači a porovnávaj.
   `.dc.html` súbory needituj a nepozeraj — sú to šablóny.
3. **Jeden commit na úlohu.** Číslo úlohy do správy commitu:
   `ZAKLAD úloha 3 — vypnutý stav ovládačov`.
4. **i18n hneď, nie potom.** Nový text = nový kľúč v `lib/i18n.ts` vo
   všetkých troch jazykoch. Nie `TODO: preložiť`.
5. **Pred commitom:**
   ```
   cd app
   npx tsc --noEmit
   npx eslint .
   npx vitest run
   npm run build
   ```
6. **Prejdi obrazovku v tmavej téme** (`html[data-theme="dark"]`) a **na
   390 px**. Obe sú v zadaniach vyznačené ako rizikové miesta.
7. **Zápis do `docs/TODO.md`** — jeden riadok s dátumom, ako pri PR 1–8.
   Vrátane odchýlok: ak si niečo urobil inak než zadanie, napíš prečo.

---

## Čo sa NESMIE bez Jánovho súhlasu

- **`layout.tsx`** — jediná povolená zmena zatiaľ bola `viewport-fit=cover`
  (schválená 21. 9. 2026).
- **Zmena schémy.** Žiadne zo štrnástich zadaní ju nepotrebuje. Ak ju niektoré
  vyžaduje, je to v ňom vyznačené 🔴 a čaká na rozhodnutie.
- **`--accent` `#232a35`** a **`darken(hex, 0.16)`.** Tenant farbu skladá
  `tenantStyle()`.
- **`normalizeQuery` / `toQuery`.** Stav nesie adresa — na tom stojí celá
  bezJS cesta.
- **Odstránenie `/ask`.** Pole v hlavičke naň odosiela `?q=` z každej
  obrazovky.

---

## Dve otvorené rozhodnutia, ktoré treba urobiť počas vlny A

Nebrzdia PR 0–5, ale bez nich sú dve úlohy nedokončiteľné.

### 1. Termín v `acknowledgementDuties()`

Termín (`due`) nesie `pendingForPerson()`, ale `acknowledgementDuties()` —
ktorú `/documents` volá — ho v krokoch trasy nevracia. Preto na troch
obrazovkách za sebou (`/documents`, `/documents/[id]`) termín chýba, hoci
Prehľad ho hlási.

**Dáta existujú, schéma sa nemení.** Treba rozhodnúť len to, či sa doplní do
návratového typu (a či to znamená druhý dotaz). **Rozhodnutie pre Jána pri
PR 2.**

### 2. „Uložiť pohľad“ — potvrdiť, že sa naozaj nerobí

`MASTER.md` hovorí, že sa nerobí a odkaz sa z knižnice **odstráni**.
Ak s tým Ján nesúhlasí, je to 🔴 zmena schémy a samostatný PR — nie prílepok
k vlne A.

---

## Kam s tým, kým to nie je overené

`CLAUDE.md` hovorí, že Ján smie commitovať priamo do `main`, ostatní idú
cez pull request. Pri tejto vlne odporúčam **aj Jánovi ísť cez PR**, a to
z jedného dôvodu: `main` je to, čo o pár minút beží na
`intranet.futbalsfz.sk`, a PR 0 sa dotýka **každej** obrazovky v aplikácii
naraz — vrátane tých pätnástich, ktoré nie sú navrhnuté.

Konkrétne: `.button:disabled`, `.empty`, `.pager` a
`.doc-table th.doc-col-right` zmenia vzhľad aj na `/hr`, `/people`,
`/admin` a `/evaluation`. Zmena je vždy k lepšiemu (dopĺňa chýbajúci stav),
ale **treba tie obrazovky po PR 0 prejsť očami** — nie preto, že by sa mali
prerábať, ale aby sa vedelo, že sa nič nerozbilo.

Odporúčaný postup: vetva `design/pr0-zaklad` → PR → prejsť 31 rout
v svetlej aj tmavej téme → merge. Pri PR 1–6 už stačí prejsť dotknutú
obrazovku.

---

## Návrh je kompletný

Všetkých 31 rout má zadanie (`MASTER.md`). Nič sa nedopĺňa a na nič sa
nečaká.

**Čo z toho vyplýva pri implementácii:** keď naďabíš na niečo, čo zadanie
danej obrazovky nepokrýva, napíš to do PR ako otázku a kód nechaj, ako je.
Zadania sú diffy proti skutočnému kódu — čo v nich nie je, je buď
v poriadku, alebo o tom ešte nepadlo rozhodnutie (tie sú pod značkou 🔴).
