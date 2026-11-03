# KNIZ-kontrola-slov — kontrola slov s originálom

> Zdroj: artefakt *Design* https://claude.ai/artifact/RqVgZzeqTUSizvqHBsJG4M
> s pripojeným „Contineo — design system". Hlavná plocha je
> `KNIZ-kontrola-slov.html` (1440 svetlá); 834 svetlá, 390 tmavá a 390 „všetko
> potvrdené" sú tá istá plocha s inými vlastnosťami. Zadanie:
> `KNIZ-kontrola-slov-zadanie.md`.

## Rozhodnuté (Ján 3. 11. 2026, podľa odporúčania)

- **Q1** — presun (rovnaké slová „chýba" + „navyše") je jedna položka „Presunuté".
- **Q2** — potvrdenie pri položke („Text je správny"), pri strane
  („Potvrdiť stranu (n)") a interpunkcia naraz; bez zaškrtávacích okienok.
- **Q3** — vyznačené slová `.diff-mark`, chýbajúce `.diff-mark--gone`.
- **Q4** — „Otvoriť PDF na strane N ↗" pri každej strane (`#page=N`).
- **Q5** — „Opraviť v texte" vedie na `#line-N`; editor prepne do Markdownu
  a označí riadok, bez JavaScriptu posunie k editoru.

## Odchýlky (schválené s Q3)

- `.diff-mark`, `.diff-mark--gone`, `.check-groups`, `.check-page`,
  `.check-page-head`, `.check-item`, `.check-item-head`, `.check-compare`,
  `.check-item-note`, `.check-actions`, `.check-minor` — pridané do
  `globals.css` a opísané v `.design-sync/conventions.md`.

## Odchýlky implementácie od návrhu

- Texty tykajú („pozri sa", „potvrď") ako zvyšok editora textu; návrh vykal.
- „Ďalšie 4 presuny na tejto strane ▾" sa nezbaľujú — strana ukáže všetky
  položky; pri ÚLK ich je na strane najviac pár.
- Karta editora pod kontrolou v návrhu je len zástupná; editor ostáva, aký je.
