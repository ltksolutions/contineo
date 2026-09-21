# ZADANIE.md — ako vlnu A a B zadať Coworku

Krátky návod. Celý postup a poradie PR je v `POSTUP.md`; toto je to, čo
sa reálne píše do okna.

---

## Krok 1 — vymeniť celý obsah `docs/design/`

```
rm -rf contineo/docs/design/*
```

a rozbaliť balík na jeho miesto. **Adresár sa vymieňa celý**, nedopĺňa sa —
po prvej vlne v ňom zostali tri súbory, ktoré si s novým handoffom
protirečia (`NASADENIE.md` s vlastným poradím PR, `SPRAVCA.md` a
`OSOBY.html` ako duplikáty vlny D).

Po rozbalení má `docs/design/` obsahovať **30 súborov**: 21 `.md`
a 9 `.html`. Nič viac.

**Do `docs/design/` nepatria** (a v balíku nie sú):
`*.dc.html`, `support.js`, `ios-frame.jsx`, `github.md` — sú to živé
návrhové súbory, ktoré Cowork nevie vykresliť. Presne preto sú v balíku
statické `.html` referencie.

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

**Poradie PR je jedno a je v `POSTUP.md`** — tam a nikde inde. Tu je len
to, ktorá referencia patrí ku ktorému zadaniu:

| Zadanie | Referencia na pozeranie |
| --- | --- |
| `ZAKLAD.md` | `ZAKLAD.html` |
| `PREHLAD.md` | `PREHLAD.html` |
| `DOCUMENTS.md` | `DOCUMENTS.html` |
| `APPROVALS.md` | `APPROVALS.html` |
| `ZNENIE.md` | `DETAIL.html` (dolná časť) |
| `DETAIL.md` | `DETAIL.html` (horná časť) |
| `ASK.md` | `ASK.html` |
| `NAHRAVANIE.md` | `SPRAVA.html` (časť 1) |
| `PRIECINKY.md` | `SPRAVA.html` (časť 2) |
| `SPRAVA.md` | `SPRAVA.html` (časť 3–6) |
| `HR.md` | `HR.html` |
| `POSUDENIE.md` | `HR.html` (časť 4–5) |
| `OSOBY.md` | `PEOPLE.html` |
| `ADMIN.md` | `PEOPLE.html` (časť 3–4) |

**PR 0 musí byť prvý.** Všetko ostatné číta jeho tokeny a triedy.
Zvyšok už na sebe nezávisí — PR 1–13 sa dajú robiť v ľubovoľnom poradí, aj
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

## Rozhodnutia, ktoré padnú na teba

Sú v `POSTUP.md` podrobne; v skratke:

1. **PR 2 (`DOCUMENTS.md`, úloha 1):** termín chýba na troch obrazovkách,
   lebo `acknowledgementDuties()` ho nevracia, hoci `pendingForPerson()`
   ho má. Dáta existujú, schéma sa nemení. Cowork sa spýta, či to doplniť
   do návratového typu — povedz áno.
2. **„Uložiť pohľad"** v knižnici: MASTER.md hovorí, že sa nerobí a odkaz
   sa odstráni. Ak s tým nesúhlasíš, povedz to **pred** PR 0.
3. **PR 12 (`OSOBY.md`, úloha 5):** čo sa má stať pri importe CSV s osobou,
   ktorá už v systéme je — prepísať, preskočiť, alebo import zastaviť.
   Cowork najprv zistí, ako sa to chová dnes, a napíše ti to.
