# Formuláre — nadpis skupiny nad kartou

Referencia: `HR-pridelit-nadpis-karty.html`. Základ: `ZAKLAD.md`, `HR-pridelit-normy-hladanie.md`.
Rozhodnuté 6. 10. 2026: **variant B, všade kde má fieldset viditeľný rám**.

## Čo sa mení

1. Nadpis skupiny (`<legend>`) sa už nevkladá do hornej čiary rámu. Stojí **nad kartou**, rám nesie vnútorný `div`.
2. Jeden spoločný vzor namiesto `.hr-group` s rámom, `.mc-group` a `.assign-panel`:

```html
<fieldset class="form-group">
  <legend class="form-group-head">…</legend>          <!-- nad kartou -->
  <div class="card form-group-body">…</div>            <!-- rám a obsah -->
  <p class="form-group-foot quiet">…</p>              <!-- nápoveda, nepovinné -->
</fieldset>
```

```css
.form-group { display: grid; gap: 10px;   /* nadpis ↔ karta; --lg 14px (Janika 6. 10.: boli pri sebe) */ min-width: 0; border: 0; padding: 0; margin: 0; }
.form-group-head { float: left; width: 100%; padding: 0 4px; margin: 0;   /* float = legenda nie je v čiare */
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  font-size: var(--fs-small); font-weight: 600; color: var(--ink); }
.form-group-head--step { font-size: var(--fs-section); font-weight: 650; } /* s .assign-step */
.assign-step { width: 20px; height: 20px; font-size: 11.5px; }   /* menšie, nedotýka sa obrysu karty */
.form-group-body { display: grid; gap: 8px; padding: 12px 14px; min-width: 0; }
.form-group--lg { gap: 14px; }
.form-group--lg > .form-group-body { gap: 12px; padding: 18px 20px 20px; }  /* 390: 14px */
.form-group-foot { font-size: var(--fs-micro); padding: 0 4px; margin: 0; }
```

3. **/hr/assign:** karta „Dôvod | Termín" (`.assign-finish`) sa rozdelí na dve skupiny 3 a 4 vedľa seba (od 1100 px 1.1fr / 1fr), súhrn + tlačidlá v samostatnej karte bez nadpisu pod nimi. Odstup medzi skupinami 24 px. Nápovedy `reasonNote` a `dueNote` idú pod kartu (`form-group-foot`).
4. Krok 3 „Dôvod" je dnes `label.field` — stane sa `fieldset.form-group` s `legend` a textarea dostane `aria-labelledby` na legendu (alebo `<label>` vnútri karty s `sr-only`).

## Kde

| Obrazovka | Súbor | Skupiny |
| --- | --- | --- |
| Prideliť dokumenty | `app/hr/assign/page.tsx` | 1 Ktoré normy, 2 Komu, 3 Dôvod, 4 Termín (`--lg`, s číslom) |
| Osoba | `app/people/[id]/page.tsx` r. 295, 321 | Trasy, Roly |
| Posúdenie | `app/evaluation/page.tsx` r. 199 | Zdroje |
| Detail dokumentu | `app/library/[id]/page.tsx` r. 1735, 1752 | Komu, Termín |
| Kurz — úprava | `app/learning/manage/[courseKey]/page.tsx` r. 513, 526, 595, 600 | `.mc-group` ×4 |
| Test — úprava | `app/learning/tests/[testKey]/page.tsx` r. 83, 94, 124 | `.mc-group` ×3 |
| Testy | `app/learning/tests/page.tsx` r. 286, 296 | `.mc-group` ×2 |

**Nemení sa** (fieldset bez rámu, legenda je obyčajný štítok nad poľom): `ApprovalPanel`, `LegalBasisForm`, `ResponsiblePicker`, `library/[id]` r. 1093, `organisation/[section]` r. 923, `/dpo`, `/admin/tenants`, `.set-fieldset`. Predpoklad: `.hr-group` bez inline `border` rám nemá (r. 1834) — Claude Code overí v `globals.css`; ak ho má, patria do zoznamu hore aj tieto.

Inline `style={{ border: "1px solid var(--line)" }}` na `.hr-group` sa pri prechode odstráni — rám je na `.form-group-body`. `.mc-group` a `.mc-group legend` z `globals.css` (r. 7347–7348) sa zmažú.

## Prečo

Legenda v čiare je predvolené správanie prehliadača, nie zámer — nadpis sa bije s okrajom a zaobleným rohom karty. Dnes sú na stránkach tri rôzne vzory (`.hr-group` s inline rámom, `.mc-group`, `.assign-panel`); po zmene jeden.

## SwiftUI

`Form` + `Section(header:footer:)`, štýl inset grouped: hlavička nad zaoblenou skupinou, nápoveda pod ňou. Súhrn s tlačidlami = `Section` bez hlavičky.

## Rámy

- **1440** — /hr/assign, Normy | Komu, pod tým Dôvod | Termín, súhrn.
- **834**, **390** — jeden stĺpec; 390 vstupy 44 px / 16 px, tlačidlá na celú šírku.
- Pred / po: osoba (Trasy), posúdenie (Zdroje), test (Pravidlá).

## Údaje, ktoré v modeli neexistujú

Žiadne. Schéma bez zmeny. Mená a hodnoty polí bez zmeny; bez JS funguje rovnako.

## Rozhodnuté (6. 10. 2026)

- **Q1** Variant B — nadpis nad kartou.
- **Q2** Zjednotiť všade, kde má fieldset rám.
- **Q3** Nápoveda **pod kartou** (`.form-group-foot`).
- **Q4** Súhrn a tlačidlá **v karte bez nadpisu**.

## Otázky

Žiadne otvorené.

<!-- pôvodné znenie otázok:
- **Q3** Nápoveda pod kartou (`Section` footer) alebo v karte ako dnes? **Odporúčam pod kartou** — tak to robí SwiftUI a karta ostane len pre ovládače.
- **Q4** Súhrn a tlačidlá v karte bez nadpisu, alebo voľne na pozadí stránky? **Odporúčam v karte** — súhrn a dopad potrebujú biele pozadie kvôli kontrastu jantárového stavu.
-->

## Prompt pre Claude Code

```
Implementuj design_handoff_contineo_intranet/HR-pridelit-nadpis-karty.html + .md.
1. globals.css: pridaj .form-group, .form-group-head(--step), .form-group-body, .form-group--lg,
   .form-group-foot podľa .md. Zmaž .mc-group, .mc-group legend; .assign-panel nahraď.
   Najprv over, či .hr-group (r. 1834) má vlastný rám — ak áno, rozšír zoznam obrazoviek.
2. Prejdi všetky fieldsety s rámom zo zoznamu v .md: legenda → .form-group-head, obsah do
   <div class="card form-group-body">, inline border preč, nápoveda pod kartu (.form-group-foot).
3. /hr/assign: kroky 1–4 ako .form-group--lg s .assign-step; .assign-finish rozdeľ na dve skupiny
   (Dôvod | Termín, od 1100 px 1.1fr/1fr), súhrn + AssignFinish v samostatnej .card pod nimi.
   Dôvod: textarea prepoj s legendou (aria-labelledby). Mená a hodnoty polí nemeniť.
4. Bez JS musí všetko fungovať ako dnes.
Overenie: tsc, eslint, vitest, build; render 1440 svetlá + 390 tmavá v Safari aj Chrome
na /hr/assign, /people/[id], /learning/tests/[testKey].
```
