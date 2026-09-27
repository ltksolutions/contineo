# MANAGE-COURSE — Úprava kurzu (`/learning/manage/[courseKey]`)

Referencia: `MANAGE-COURSE-uprava-kurzu.html`. Základ: `ZAKLAD.md`, `MANAGE-sprava-kurzov.md` (`.tabs`), `KNIZNICA-postup-znenia.md` (karta postupu), `KOMPONENT-vyber-oddelenia.md` (Select/MultiSelect). Zadanie: `docs/design/LEARNING-zadanie.md`, rám 5 z 9. Model: ADR-018 (D117, D118, D121, D122).

## Čo sa mení

Nová obrazovka správcu kurzu (`learning-admin`). Nové komponenty: **vstup smart:tagov** (`SmartTagInput`), **formulár Pridať blok**, zoznam častí a blokov s poradím (tvar `TreeWithOrder`). Nový variant `.notice--warn`.

## Karta stavu verzie

Tvar z `KNIZNICA-postup-znenia` (`.flow`, `.steps`, `.check`, `.flow-foot`), **tri kroky**: Koncept → Zverejnené → Archív.

| Stav | Telo | Päta |
| --- | --- | --- |
| koncept bez častí | „Na zverejnenie chýba": ✓/! riadky s vetou a odkazom, kde sa to doplní | vypnuté „Zverejniť verziu 1" + veta |
| koncept pripravený | všetko ✓ + „Verzia 2 zostáva zverejnená, kým nezverejníte túto. Zapísaní vo v2 ju dokončia; noví sa zapíšu do v3." | „Zverejniť verziu 3" · „Náhľad ako študent" · „Uložené …" |
| zverejnený | „Zverejnená verzia sa nemení. Zmena = nová verzia (kópia)." | „Nová verzia" · „Archivovať" |
| archív | „Nikto nový sa nezapíše… rozpracovaní dokončia (3)." | „Obnoviť ako novú verziu" |

Podmienky zverejnenia: aspoň 1 povinná časť · každá časť ≥ 1 blok · téma · právny základ · priradené testy `ready` · nahraté povinné videá. Testy sú nepovinné.

## Záložka Časti (`?tab=parts`)

- Zoznam: ⋮⋮ · číslo · názov · `.tag` Povinná/Nepovinná · „6 blokov · 2 testy" · ↑ ↓ · „Upraviť".
- Poradie ako `TreeWithOrder`: ťahanie je nadstavba, šípky sú formuláre bez JS; zapisuje sa tlačidlom. Na 390 bez ⋮⋮, šípky 40 px.
- Dole „Nová časť": názov + prepínač Povinná + „Pridať časť".
- Prázdne: `.empty` „Kurz zatiaľ nemá žiadnu časť" + pole a „Pridať časť".
- Zverejnený/archív: bez poradia a úprav, „Zobraziť".

### Detail časti (`?tab=parts&part=[partKey]`)

- 1440: vľavo zoznam častí (zvolená `--accent-soft` + pruh), vpravo bloky a testy. 834/390: „← Všetky časti".
- Bloky: typ ako malý štítok (TEXT, OBRÁZOK, DOKUMENT Z KNIŽNICE, VIDEO, GALÉRIA, VIDEO EXTERNÉ) + súhrn · ↑ ↓ · „Upraviť".
- **Pridať blok**: typ prepínačmi (text · obrázok · galéria · dokument z knižnice · video). Pri videe:
  - Zdroj: „Nahrať MP4 (do 25 MB)" → zóna ako `UploadFiles` (nad 25 MB podľa `videoStorage` tenanta) · „Externý odkaz" → pole URL.
  - **Priebeh nahrávania = modálne okno v strede** (`.upload-overlay`, rozhodnutie Jána 23. 9. 2026). V zóne sa priebeh nekreslí.
  - Prepínač „Povinné dopozeranie" + veta „Pretáčanie dopredu sa vypne; časť sa dá označiť až po pozretí 90 %."
  - Externé: prepínač vypnutý + `.notice--warn` „Pri externom videu sa dopozeranie neoverí… ak ho potrebujete, nahrajte MP4."
- Dokument z knižnice: výber platného znenia (Select s hľadaním) — odkaz na konkrétne znenie, nie kópia.
- **Testy časti**: riadok = názov · „20 otázok · hranica 80 % · 3 pokusy · zodpovedá …" · prepínač Povinný · „Odobrať". „Priradiť test" = Select s hľadaním len z testov `ready`. Zverejnenie zmrazí `testKey` + `testVersion`.

## Záložka Nastavenia (`?tab=settings`)

Názov (kľúč sa po vytvorení nemení) · Podnázov · Popis · Téma (Select) · Jazyk obsahu (Select, „Kurz v inom jazyku je iný kurz.") · Odhad času v minútach · smart:tagy (`SmartTagInput`).
Skupina **Priebeh**: Časti idú postupne (`sequential`) · Otvorený na zápis · Vydáva certifikát.
Skupina **Právny základ**: `LegalBasisForm` (číselník D92) + veta, že výsledky sú osobné údaje.
Zverejnený: polia ako text na `--surface-2` + `.ro` „Verzia 2 je zverejnená — polia sú len na čítanie. Zmeny: Nová verzia".

## Vstup smart:tagov (`SmartTagInput`)

- Pilulky „Kľúč: Hodnota" (kľúč `--muted`) s ×, pole „Kľúč: Hodnota". Enter pridá, Backspace odoberie posledný.
- Pred dvojbodkou: návrhy **kľúčov** (s počtom hodnôt) + „Nový kľúč „…"".
- Po dvojbodke: návrhy **hodnôt** toho kľúča (s použitím „1 kurz · 11 otázok") + „Nová hodnota".
- Hľadanie bez diakritiky, klávesnica a rozmery ako `MultiSelect` (44 px ovládanie, 38 px riadok).
- Bez JS: `<textarea>`, jeden tag na riadok.
- Použije sa aj v TESTS (otázka, test, sekcia testu).

## Záložka Zapísaní (`?tab=people`)

- Filter `.view-switch`: Všetci · Nezačali · Rozpracovaní · Dokončili. „Prideliť kurz" · „Export CSV".
- Tabuľka (390: karty): Meno · Oddelenie · Zápis (pridelením / samozápisom) · Stav („3 z 5 častí" / „dokončil 18. 9." `--ok-fg` / „nezačal") · Posledná aktivita. **Bez skóre** (D121).
- **Prideliť kurz** (`?assign=1`): adresáti prepínačmi — Všetkým v organizácii / Oddeleniam / Skupinám / Trase; oddelenia cez `MultiSelect` so stromom; súhrn „Zapíše sa 19 ľudí do verzie 2 · 4 sú už zapísaní a nič sa im nezmení." + „Prideliť 19 ľuďom". Prideliť môže aj `hr`.

## Rámy

- **390**: časti koncept · detail časti MP4 · externý odkaz · koncept bez častí · zverejnený · archív · nastavenia · nastavenia len čítanie · zapísaní · prideliť.
- **834**: časti koncept.
- **1440**: časti koncept · detail časti · koncept bez častí · nastavenia · zapísaní + prideliť.

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

| Čo | Kde |
| --- | --- |
| Karta postupu (`.flow`, `.steps`, `.check`) | `KNIZNICA-postup-znenia` (PR #113–#123) |
| TreeWithOrder (⋮⋮ + šípky, zápis tlačidlom) | `components/TreeWithOrder.tsx` |
| UploadFiles + `.upload-overlay` | `components/UploadFiles.tsx` |
| LegalBasisForm | `components/LegalBasisForm.tsx` |
| KeyFromLabel | komponent |
| Select `searchable`, MultiSelect | `Select.tsx`, `MultiSelect.tsx` |
| Adresáti (všetci / oddelenie / skupina / trasa) | `/hr/assign`, `Audience` |
| `.doc-table`, `.pager`, `.view-switch`, `.empty`, `.ro` | `globals.css` |

Nové: `SmartTagInput`, `AddBlockForm`, `.notice--warn`, `.btype`, `.orow`, `.seg`, `.sw` (overiť, či repozitár nemá prepínač — inak nový).

```css
.notice--warn { background: var(--warn-bg); border-color: rgba(180,83,9,.2); }
.notice--warn .notice-mark, .notice--warn .notice-text { color: var(--warn-fg); }
```

## Údaje, ktoré v modeli zatiaľ nie sú

- `version.sequential` (ADR-018 nemá).
- `block.video`: `source` (`upload` | `external`), `url`, `fileId`, `durationSec`, `requireFullWatch` (pri `external` vždy `false`).
- `part.tests[]`: `{ testKey, testVersion, required }` (zmrazené pri zverejnení).
- Súhrn prideľovania: počet nových zápisov vs. už zapísaných (odvodené pred odoslaním).

## Rozhodnutia Jána 27. 9. 2026

- **Q1 ✅** „Obnoviť ako novú verziu" pri archivovanom kurze vytvorí koncept
  z poslednej verzie (`startNewVersion`).
- **Q2 ✅** Voľba „Trase" ostáva: zapíše ľudí, ktorí trasu majú — ako adresát
  normy (`Audience` kind `track`). Trasa **z kurzov** zostáva mimo L1–L3.

## Otázky pre Jána

- **Q1** — „Obnoviť ako novú verziu" pri archivovanom kurze: vytvorí koncept z poslednej verzie (návrh), alebo sa archív nedá vrátiť vôbec?
- **Q2** — Pridelenie kurzu **trase** (onboarding): v L1–L3 je trasa z kurzov mimo rozsahu (ADR-018). Nechať voľbu „Trase" = zapísať ľudí, ktorí trasu majú (ako adresát normy), alebo ju v L1 skryť?
