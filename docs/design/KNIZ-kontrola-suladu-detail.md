# KNIZ — detail kontroly súladu (`/library/compliance/<runId>`)

> **Stav: rozhodnuté 11. 10. 2026 (používateľ) — Q1–Q5 podľa odporúčania A.**

Referencia: `KNIZ-kontrola-suladu-detail.html`. Základ: `ZAKLAD.md`, `ZAKLAD-podmenu-a-akcie.md`, `ZAKLAD-segmented-control.md`, `ZAKLAD-vyber-a-prepinace.md` (`.choice-row`), `EVAL-posudok.md` (citát `.quote`). Zdroj: `app/library/compliance/[runId]/page.tsx`, `library/complianceActions.ts`, `lib/complianceCheck.ts`, `lib/complianceAccess.ts`, ADR-032 D196 a **D199** (rozhodnutie Jána 11. 10. 2026), `.pr-diff` z `channels/[key]/proposals/page.tsx`.

Je to **rozdiel oproti existujúcej obrazovke**. Ostáva: `decideFindingAction` (polia `runId, documentId, findingId, decision, text, reason`), `applyFindingAction`, `SubmitButton`, prepínanie volieb cez CSS `:has`, texty `library.compliance.*`. Nové texty sú pomenované nižšie.

## Vzory SwiftUI
| Časť | SwiftUI | V aplikácii |
|---|---|---|
| Dokumenty + nálezy | `NavigationSplitView` (od 1024 px), v kompaktnej šírke riadok-odkaz na zoznam | `.split` > `.side` + `.main`; pod 1024 px `a.form-row.pick` → `?docs=1` |
| Filter | `Picker(.segmented)` | `.view-switch` (sivý) |
| Rozhodnutie | `Picker(.segmented)` od 640 px, `Picker(.inline)` pod 640 px | `.decision-switch` / `.choice-row` s natívnym `radio` |
| Údaje o behu | `DisclosureGroup` + `LabeledContent` | `<details>` + `.lc` |
| Spustiť znova | `toolbar` | `.page-tools`, tiché |

## Čo sa mení

### 1 · Hlavička
- Cesta `Knižnica › Kontrola súladu › 11. 10. 2026` (posledná položka = dátum behu; `trail` ako dnes). Žiadne „← Späť".
- `.page-head` > `.page-head-main`: `h1` = `run.name` (Q4), inak `t.runDefaultName(dátum)` „Kontrola 11. 10. 2026". `p.page-lead` `t.runScope(10, 7, osoba, dátum)` „10 dokumentov proti 7 normám · spustil Ján Letko 11. 10. 2026".
- `.page-tools`: tiché `t.runAgain` „Spustiť znova" — `form action={startDocumentReviewAction}` so skrytými `subjectIds`, `documentIds` (a `name`) z behu. Len s rolou `compliance`. **Na obrazovke nie je žiadne plné tlačidlo.**
- `Notice` zo `?msg` ostáva.

### 2 · Postup a údaje o behu (jedna `section.card`)
- `b` `t.decidedOf(3, 62)` „3 z 62 nálezov rozhodnutých" + `.quiet` `t.remaining(59)` „59 ostáva".
- `.bar` (6 px, `--ok-fg`), šírka = rozhodnuté / všetky. `role="progressbar"`, `aria-valuenow`.
- Štítky podľa druhu z `FINDING_KINDS`: `t.kindsShort[kind] + počet` — Rozpor 15 (`.tag--warn`) · Chýba 34 · Nejasné 13. Len na čítanie.
- Počas behu namiesto prvého riadku dnešný `state` (`t.progress` / `t.stopped`) a `.bar` podľa dokumentov.
- `<details class="disc">` — `summary` `t.metaHeading` „Údaje o behu" + `model · t.duration(min) · cena USD`. Telo: dnešné riadky `meta` ako `.lc` (Spustil, Dokončené, Model, Volania, Tokeny, Cena, Referenčné normy, Kroky `t.steps(n)` „3 na dokument"). Predvolene zbalené.

### 3 · Dokumenty (Q1, Q5)
- **Od 1024 px** `.split` (320 px + obsah, `gap` 28): vľavo `.side` (`position: sticky`) — `.side-h` `t.documents(10)` „Dokumenty · 10" a karta s `a.form-row` → `?doc=<documentId>` (zachová `view`, zahodí `f`):
  - `b` `res.title`, `span.form-row-sub` kód/štítok dokumentu;
  - vpravo nerozhodnuté `t.openOf(8, 10)` „8 z 10"; všetko rozhodnuté → `.tag--published` `t.docDone` „hotovo"; bez nálezov → `.tag` `t.docNoFindings` „bez nálezov";
  - vybraný: `.on` (`--accent-soft`, ľavý pásik `--accent`), `aria-current="page"`.
- **Pod 1024 px** namiesto panela `a.card.form-row.pick` → `?doc=…&docs=1`: `span.k` `t.docPosition(8, 10)` „Dokument 8 z 10", `b` názov, „8 z 10", `›` — v farbe organizácie. Pri `?docs=1` sa namiesto obsahu dokumentu kreslí zoznam z panela na celú šírku.
- Bez `?doc=` sa vyberie prvý dokument s nerozhodnutým nálezom, inak prvý.

### 4 · Vybraný dokument
- `.doc-head`: `h2` `res.title` + `.tag--draft` `t.draftMark` „koncept" alebo `.tag` `t.validLabel(label)` „platné 1.0" + odkaz `t.openDraft` „Otvoriť koncept" → `/library/<id>/text` (pri platnom bez konceptu `t.openDocument` „Otvoriť dokument" → `/library/<id>`).
- `p` `res.summary` — **jedno zhrnutie za dokument** (Q3).
- `nav.view-switch` (sivý) s `Link` na `?doc=…&view=open|decided|all`, počty `.view-switch-count`: `t.viewOpen` „Nerozhodnuté" · `t.viewDecided` „Rozhodnuté" · `t.viewAll` „Všetky". Predvolené `open` (Q2). Pod 640 px na celú šírku.
- Prázdny filter Nerozhodnuté: `.empty` `t.docAllDecided` „Všetky nálezy dokumentu sú rozhodnuté." + `.empty-action` odkaz na ďalší dokument s nerozhodnutými.

### 5 · Karta nálezu
Poradie podľa `FINDING_KINDS` ako dnes. `article.card#<documentId>-<findingId>`.

**Stav 1 — nerozhodnuté, zbalené** `.fc-row`: štítok druhu (`t.kinds[kind]`; Rozpor `.tag--warn`, ostatné `.tag`), `f.location`, tiché `a.button--sm` `t.decide` „Rozhodnúť" → `?doc=…&view=…&f=<id>#<anchor>`.

**Stav 2 — otvorené** (`?f=<id>`, vždy len jeden): `.fc.is-open`
- `.fc-head`: štítok, `b` `f.location`, odkaz `t.collapse` „Zbaliť" (adresa bez `f`).
- `t.change` „Zmena znenia": `div.diff` = `wordDiff(f.quote, f.proposed)` s `del`/`ins` (štýl `.pr-diff`). Bez `f.proposed` len `f.quote` a veta `t.proposedMissing`.
- `t.norm` „Norma": odkaz `citation.title + articleRef` → `/library/<documentId>`, pod ním `blockquote.quote` `citation.quote`.
- `t.recommendation` „Odporúčanie": `f.recommendation`.
- `form.dec` (`decideFindingAction`):
  - `fieldset` `t.status` „Rozhodnutie": dve `label.decision-option` s `radio name="decision"` `kept` / `accepted` — `t.decisionKeep` „Ponechať existujúce znenie", `t.decisionAccept` „Prijať a upraviť". Pod 640 px `.choice-list` > `label.choice-row` (fajka vpravo).
  - `textarea name="text"` `t.proposed` „Nové znenie", `rows=5` — viditeľné len pri `accepted` (`.dec:has(input[value=kept]:checked) .decision-text {display:none}`). Hint ako dnes (`proposedHintDraft` / `Valid` / `NoRights`).
  - `textarea name="reason"` `t.reason` „Dôvod", `rows=3`, `required`, `maxLength=1000`; hint `t.reasonHint` „Povinné pri oboch voľbách. Zapíše sa do auditu dokumentu."
  - `.acts`: tiché `SubmitButton` `t.saveNext` „Uložiť a ďalší" + `.quiet` `t.nextIs(location)` „Ďalší: 3. Reklamácia položky" (z iného dokumentu `t.nextInDoc(title)`). Pri poslednom nerozhodnutom `t.save` „Uložiť" a `t.lastOpen` „Posledný nerozhodnutý nález."
  - Skryté pole `next` = `documentId:findingId` ďalšieho nerozhodnutého (počíta stránka). Akcia presmeruje na `?doc=<next.doc>&f=<next.id>#<anchor>` a `msg` (dnes `back(path, message, false, anchor)` na ten istý nález).

**Stav 3 — prijaté a zapísané do konceptu** (`status accepted|fixed`, `applied: "draft"`): `.lnote` „✓" `t.stateDraft` „Prijaté a zapísané do konceptu" · `decidedBy, decidedAt`, `small` dôvod. `t.acceptedText` „Prijaté znenie" = `wordDiff(f.quote, f.acceptedText)`. Úkony: tiché „Otvoriť koncept", „Zmeniť rozhodnutie" `t.changeDecision` → `?f=<id>&change=1` (formulár stavu 2 predvyplnený; dnešný `<details>` sa ruší).

**Stav 4 — vedome ponechané** (`kept`): `.lnote--info` `t.stateKept` „Ponechané existujúce znenie" · kto, kedy, dôvod. Blok `t.keptText` „Ponechané znenie" = `f.quote` bez vyznačenia. Úkon: „Zmeniť rozhodnutie".

**Stav 5 — prijaté, čaká na správcu obsahu** (`applied: "manual"`, dôvod práva — nové pole, nižšie): `.lnote--warn` „!" `t.stateWaiting` „Prijaté, čaká na správcu obsahu" · `t.acceptedBy(osoba, dátum)` „prijala …", `small` `t.waitingNote` „Do konceptu ho zapíše správca obsahu." + dôvod. Správca obsahu (`canEditDrafts`): tiché `t.applyToDraft` „Zapísať do konceptu" (`applyFindingAction`). Bez `content-admin`: namiesto tlačidla `.quiet` `t.waitingNotified` „Správcovia obsahu dostali upozornenie." „Zmeniť rozhodnutie" len s `compliance`.

**Stav 6 — úryvok sa nenašiel** (`applied: "manual"`, dôvod nenájdené): `.lnote--warn` `t.stateManual` „Treba vložiť ručne" + `small` `t.manualNote` „Úryvok sa v koncepte nenašiel jednoznačne — nahraďte ho v koncepte sami." Pod diffom `textarea readonly` `t.manualText` „Znenie na vloženie". Úkony: `CopyLink` `t.copyText` „Kopírovať znenie" (len s JS; bez JS ostáva pole na označenie), „Otvoriť koncept", „Zmeniť rozhodnutie".

### 6 · Šírky
- **≥ 1024** (macOS): `.split`, obsah do 880 px, segmented rozhodnutie.
- **640–1023** (iPadOS): bez panela, riadok `.pick` nad obsahom, rozhodnutie segmented.
- **< 640** (iOS): `.pick`, `.view-switch` cez celú šírku, rozhodnutie `.choice-row` pod sebou, tlačidlá cez celú šírku (44 px). Dole len hlavná lišta aplikácie.
- Svetlá aj tmavá téma z tokenov; `del`/`ins` majú okrem farby aj prečiarknutie/podčiarknutie (nie len farba).
- Dlhšie slová v cs/en: popisy filtra sú krátke, voľby rozhodnutia sa pod 640 px dávajú pod seba, `.fc-row` a `.doc-head` majú `flex-wrap`.

## Stav v adrese
`?doc=<documentId>` · `view=open|decided|all` (predvolené `open`, vynecháva sa) · `f=<findingId>` (otvorený nález) · `change=1` (zmena rozhodnutia) · `docs=1` (zoznam dokumentov pod 1024 px). Všetko odkazy a `form`; bez JS funguje všetko okrem „Kopírovať znenie" a skrývania poľa Nové znenie.

## Údaje, ktoré v modeli neexistujú
1. **`ComplianceRun.name`** — názov kontroly (Q4). Nové nepovinné pole pri spustení na `/library/compliance`; prázdne = „Kontrola <dátum>".
2. **Dôvod `applied: "manual"`** — dnes jedna hodnota pre „bez práv" aj „úryvok sa nenašiel". Treba ich rozlíšiť, napr. `applied: "draft" | "pending" | "manual"` (`pending` = čaká na správcu obsahu, `manual` = nenašlo sa). Bez toho sa stav 5 a 6 nedá nakresliť správne.
3. **Zhrnutie dokumentu z posledného kroku** (Q3) — dnes `res.summary` spája zhrnutia krokov („RaPP v tomto kroku nebol…"). Treba, aby posledný krok dostal predošlé zistenia a vrátil jedno zhrnutie za dokument.
4. **Ďalší nerozhodnutý nález** — pole `next` vo formulári a presmerovanie naň v `decideFindingAction`.
5. **Spustiť znova** — `startDocumentReviewAction` s výberom z existujúceho behu (dnes len z formulára na `/library/compliance`).
6. Počty podľa druhu a postup sa počítajú z `run.results[].findings` — nové pole netreba.

## Rozhodnuté
Všetky otázky rozhodnuté 11. 10. 2026 podľa **A**.

**Q1 ✅ A — Bočný panel s dokumentmi a výber v adrese `?doc=`, alebo jedna dlhá stránka ako dnes?**
A: panel (`?doc=`) · B: dlhá stránka.
**Odporúčam A** — 62 nálezov na jednej stránke je nekonečný scroll a pri práci na viackrát sa človek nevie vrátiť na miesto.

**Q2 ✅ A — Predvolený filter „Nerozhodnuté", alebo „Všetky"?**
A: Nerozhodnuté · B: Všetky.
**Odporúčam A** — práca je o tom, čo ostáva; rozhodnuté sú o klik ďalej.

**Q3 ✅ A — Zhrnutie dokumentu jedno za celý dokument (napíše posledný krok), alebo spojené zhrnutia krokov?**
A: jedno · B: spojené.
**Odporúčam A** — spojené obsahujú vety typu „RaPP v tomto kroku nebol…", ktoré čitateľovi nič nehovoria.

**Q4 ✅ A — Nepovinné pole „Názov kontroly" pri spustení (prázdne = „Kontrola 11. 10. 2026"), alebo názov odvodený automaticky?**
A: pole · B: odvodiť.
**Odporúčam A** — odvodzovanie z výberu dokumentov býva nepresné a človek vie najlepšie, čo kontroluje.

**Q5 ✅ A — 640–1023 px: riadok „Dokument 8 z 10 ›" nad obsahom (ako iOS), alebo užší bočný panel?**
A: riadok nad obsahom · B: panel 240 px.
**Odporúčam A** — pri 834 px by na nález s porovnaním a dvoma poľami ostalo ~520 px a voľby rozhodnutia by sa lámali.
