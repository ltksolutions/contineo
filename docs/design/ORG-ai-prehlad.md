# ORG-ai-prehlad — Prehľad spotreby AI

> Návrh z artefaktu typu *Design* v Claude
> (https://claude.ai/artifact/3o62dJ7okSqCEi9v3skJTA, verzia 1792847218-2e47,
> 24. 10. 2026) s pripojeným artefaktom „Contineo — design system". Zadanie:
> `ORG-ai-prehlad-zadanie.md`. Prvý návrh vytvorený po novom (`docs/DESIGN.md`).

## Súbory

| súbor | čo je |
|---|---|
| `ORG-ai-prehlad.html` | hlavná plocha (`project/Main.dc.html`) — Prehľad s prepínačmi `view` a `range` |
| `ORG-ai-prehlad-spotreba.html` | `project/Usage-fix-1440.dc.html` — Spotreba s opravou stĺpca OSOBA |

Ostatné plochy (`Month-834`, `Month-390`, `Year-1440`, `Year-390-dark`,
`Year-1440-models`, `Year-1440-dark-purposes`, `Empty-834`) sú len
`<dc-import name="Main">` s inými vlastnosťami — obsah je v hlavnej ploche.

## Rozhodnuté

Návrh `.md` so sekciou „Rozhodnuté" neobsahoval; rozhodol Ján pri stiahnutí
(24. 10. 2026):

- **Q1 Názov** — „Prehľad", `/organisation/ai/overview` (návrh to tak nakreslil).
- **Q2 Obdobie** — **podľa návrhu: Od–Do ako Spotreba**, predvolený aktuálny
  mesiac, rýchly výber „tento mesiac · rok · posledných 12 mesiacov · minulý
  rok". Jeden mesiac = rebríček, viac mesiacov = stĺpce a matica. (Zadanie
  odporúčalo len výber roka; Ján zvolil návrh.)
- **Q3 Modely a tokeny** — pohľad Modely v prepínači, pod sumou modelu tri
  riadky tokenov po mesiacoch; v ostatných pohľadoch stĺpec tokenov.
- **Q4 Porovnanie s minulým rokom** — áno, pri Sume.
- **Q5 Export** — Excel matice, tiché tlačidlo v hlavičke časti.
- **Q6 Oprava stĺpca OSOBA** — áno, v tom istom PR.
- **Nové prvky systému** — graf, rebríček, matica, malý graf a široké telo
  pridané **všeobecne** do `globals.css` a `conventions.md` (`.chart-*`,
  `.series-N`, `.matrix-*`, `.spark`, `.quick-ranges`, `.org-grid--wide`),
  nie ako `.ai-*` z návrhu.

## Odchýlky implementácie od návrhu

- Triedy `.ai-*` → všeobecné triedy systému (rozhodnutie vyššie).
- Pohľad je v adrese `?by=people|purposes|models`, nie `?view=` —
  `view` už rozlišuje časti sekcie.
- Bunky vedú do Spotreby cez skutočné filtre: osoba `person=<id>`, práca na
  pozadí `person=bg:<meno>` (nemá `personId`), účel `purpose=`, model
  `model=<presný identifikátor>`, model mimo cenníka `unpriced=1`. Spotreba
  ich vie; model a „mimo cenníka" ukáže vetou s „Zrušiť", prácu na pozadí
  ako skupinu v zozname Osoba.
- Pri práci na pozadí sa z mena vynecháva „(na pozadí)" — hovorí to štítok.
- Tokeny po mesiacoch v pohľade Modely sú v miliónoch bez jednotky
  („vstup (mil.)"), plný tvar sa do 12 stĺpcov nezmestil.
- Hlavička stĺpca tokenov je „Tokeny" (celý popis v `title` a v súčtoch).
- Os grafu: popis vpravo má vlastný pás 52 px, inak prekrýval súčet
  posledného stĺpca; horná hranica je okrúhle číslo tesne nad maximom.
- V tmavej téme sa odtiene série miešajú k textu, nie k ploche (inak boli
  takmer čierne).
- Cez prelom roka nesie rok len prvý mesiac a január („XI 25 · XII · I 26").
- Text prázdneho stavu bez „skontrolujte, či je asistent zapnutý" — odkaz
  „Nastavenie asistenta" to hovorí.
