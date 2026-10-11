# KANALY — fronta kurátora návrhov FAQ (`/channels/<kanál>/proposals`)

> **Stav: rozhodnuté 11. 10. 2026 (používateľ) — Q1–Q7 podľa odporúčania A.**

Referencia: `KANALY-navrhy-faq-kuracia.html`. Vzor: `KNIZ-kontrola-suladu-detail.md` (panel, `?p=` jeden otvorený, „Uložiť a ďalší"). Základ: `ZAKLAD.md`, `ZAKLAD-podmenu-a-akcie.md`, `ZAKLAD-segmented-control.md`, `ZAKLAD-vyber-a-prepinace.md` (`.choice-row`, `.select-row`), `ZAKLAD-prazdny-stav-citatelnost.md` (`.empty`), `EVAL-posudok.md` (`.quote`). Zdroj: `app/channels/[key]/proposals/page.tsx`, `app/channels/proposalActions.ts`, `lib/faqProposals.ts`, `lib/complianceCheck.ts` (`isRunning`, `REVIEW_VERDICTS`), ADR-030 D185, ADR-032 D191–D193.

Je to **rozdiel oproti existujúcej obrazovke**. Ostáva: `approveProposalAction`, `saveProposalAction`, `rejectProposalAction`, `mergeProposalAction`, `applyReviewAction`, `dismissReviewAction`, `startReviewAction`, `back()` s `view/topic/review`, `wordDiff` + `.pr-diff`, `.pr-original`, `SubmitButton`, texty `channels.proposal*` / `channels.review*`. Nové texty sú pomenované nižšie.

## Vzory SwiftUI
| Časť | SwiftUI | V aplikácii |
|---|---|---|
| Témy + návrhy | `NavigationSplitView` od 1024 px; v kompaktnej šírke riadok-odkaz | `.split` > `.side` + `.main`; pod 1024 px `a.form-row.pick` → `?topics=1` |
| Pohľad | `Picker(.segmented)` | `.view-switch` (sivý) |
| Výsledok kontroly | filter tokenmi (`searchScopes`) | čipy-odkazy `a.chip` `?review=` |
| Návrh | `DisclosureGroup` (jeden otvorený) | `article.card.fc` zbalený / `.is-open` |
| Varianty | `List` s výberom (`EditButton`) | `.select-row` s `checkbox` — odškrtnutý = zmazať |
| Zlúčiť | `Picker(.inline)` | `.choice-row` s `radio` |
| Skontrolovať | `toolbar` | `.page-tools`, tiché |

## Čo sa mení

### 1 · Hlavička
- `AppShell trail`: Kanály › ISSF Helpdesk › Návrhy FAQ (dnes len kanál). Žiadne „← Späť".
- `.page-head-main`: `h1` `t.proposals`; `p.page-lead` `t.proposalsLead(kanál, otvorené, roky)` „ISSF Helpdesk · 54 otvorených · 3 roky e-mailov". Štítok kanála `.tag` sa ruší (je v ceste aj v riadku).
- `.page-tools`: tiché `a.button--quiet` `t.reviewStart` „Skontrolovať proti dokumentom" → `?check=1`. Pri `?check=1` sa pod hlavičkou kreslí `form.card.task-card` s dnešným obsahom karty Kontrola (`MultiSelect documentIds`, rozsah témy, tiché `SubmitButton`, odkaz „Zrušiť"). Karta „Kontrola proti dokumentom" nad zoznamom sa ruší.
- **Stav 6** — `isRunning(run)`: namiesto tlačidla `span.run` `t.reviewRunningShort(hotové, spolu)` „Kontrola beží · 23 z 54". Nový štart sa neponúka (Ján 11. 10. 2026). **Plné tlačidlo na obrazovke nie je.**
- `Notice` zo `?msg` ostáva.

### 2 · Postup (jedna `section.card`)
- `b` `t.decidedOf(12, 66)` „12 z 66 rozhodnutých" + `.quiet` `t.remaining(54)`; `.bar` (`--ok-fg`, `role="progressbar"`). Čísla z `proposalCounts`.
- `.kinds`: „Kontrola:" + `.tag` `t.reviewVerdictsShort[v] n` — Sedí 11 · Odlišuje sa 29 · Dokumenty neriešia 14 · Rozpor 0 (z `run.counts`) + `.tag--warn` `t.decisionCount(6)` „Na rozhodnutie 6". Len na čítanie.
- `<details class="disc">` `t.reviewLast` „Posledná kontrola" + dátum · počet dokumentov; telo `t.reviewAgainst(...)` ako dnes. Bez behu sa kinds a details nekreslia.

### 3 · Témy (Q1, Q2)
- **Od 1024 px** `.split` (320 px + obsah): `.side` (sticky) `t.topics(17)` „Témy · 17 otvorených" a karta s `a.form-row` → `?topic=<topicKey>` (zachová `view`, zahodí `p`, `review`):
  - `b` `topicLabel`; `span.form-row-sub` `t.topicDiffers(n)` „4 odlišuje sa" alebo `t.topicNotCovered` „dokumenty neriešia" (keď sú takí všetci);
  - `.tag--warn` `t.topicDecision(n)` „2 na rozhodnutie", vpravo počet nerozhodnutých; téma bez otvorených `.tag--published` „hotovo" (na konci zoznamu);
  - vybraná `.on`, `aria-current="page"`.
- Poradie ako `proposalTopics` (viac vlákien skôr).
- **Pod 1024 px** `a.card.form-row.pick` → `?topic=…&topics=1`: `t.topicPosition(1, 17)` „Téma 1 z 17", názov, počet, `›`. Pri `?topics=1` zoznam tém na celú šírku.
- Bez `?topic=` prvá téma s [NA ROZHODNUTIE], inak prvá s otvorenými (Q2).

### 4 · Vybraná téma
- `.topic-h`: `h2` téma + `.quiet` `t.openInTopic(6)` „6 nerozhodnutých".
- `nav.view-switch` → `?view=open|decision|decided|all`: `t.proposalsViewOpen` „Nerozhodnuté" · `t.proposalsViewDecision` „Na rozhodnutie" · `t.proposalsViewDecided` „Rozhodnuté" · `t.proposalsViewAll` „Všetky" (nové), počty za tému. Predvolené `open`.
- Čipy výsledku kontroly (len keď je `run`): „Kontrola:" + `a.chip` `?review=differs|conflict|not_covered|agree` s počtom; zvolený `.on`, druhý klik (odkaz bez `review`) zruší. S nulou `span.chip.dis`. Nahrádza `<select>` + „Použiť".
- Stránkovanie po 20 sa ruší (téma má najviac desiatky návrhov; strop `listProposals` 500 ostáva).

### 5 · Návrh
`article.card#<id>`, poradie ako `listProposals`.

**Stav 1 — zbalený** `.fc-row`: `.q` > `b` otázka + `span` `t.threads(n)` „187 vlákien"; vpravo `.tag--warn` „Na rozhodnutie" (poznámka s `DECISION_MARK`), štítok verdiktu (`differs` `.tag--warn`, `conflict` `.tag--bad`, `agree` `.tag--published`, `not_covered` `.tag`); tiché `a.button--sm` `t.decide` „Rozhodnúť" → `?…&p=<id>#<id>`.

**Stav 2 — otvorený** (`?p=`, vždy len jeden) `.fc.is-open`:
1. `.fc-head` otázka + „Zbaliť" (adresa bez `p`); `.who` `t.proposalThreads(...)` ako dnes.
2. **[NA ROZHODNUTIE]** (stav 4): `div.lnote.lnote--warn` s „?" ako **prvý blok karty** — `b` `t.decisionNote` „Na rozhodnutie", text poznámky bez značky. Ostatná poznámka (`note` bez značky, napr. zo zlúčenia) je `.lnote--info` na tom istom mieste.
3. **Výsledok kontroly** `div.rv`: verdikt, `t.reviewHeading` „Výsledok kontroly", dátum; `review.note`; `t.norm` „Norma" — odkaz `title, articleRef` → `/library/<id>` s `target="_blank" rel="noopener"` a „↗" (`aria-label` „otvorí sa v novom okne"), pod ním `blockquote.quote` `ci.quote`. Pri viacerých citáciách každá zvlášť.
   - `differs` a návrh znenia bez `review.decision`: `t.reviewChange` „Zmena odpovede" = `wordDiff(p.answer, proposed.answer)` (zmena otázky nad tým, len ak sa líši) a **dve tiché `SubmitButton`** `t.reviewApply` „Prevziať návrh z kontroly" / `t.reviewDismiss` „Ponechať pôvodné" (Q6). `anchor` = `p`, vráti sa na ten istý otvorený návrh.
   - `not_covered` (stav 3): bez zmeny a bez volieb; `.who` `t.reviewAgainst(...)`.
   - `agree`: jeden riadok `.rv-head` s citáciou (834).
   - Po rozhodnutí: `.tag` `t.reviewDecision[decision]` „Prevzaté z kontroly" / „Ponechané pôvodné" v `.rv-head`, bez volieb.
4. **Úprava** `.sec2` (`h3` `t.edit` „Úprava") — jeden `form action={approveProposalAction}`:
   - `question` input.
   - **Varianty**: `t.proposalVariants` + počet; každý ako `label.form-row.select-row` s `input type="checkbox" name="variants" value=… checked`. Odškrtnutý sa uložením zmaže (bez JS). Prvé 4, zvyšok v `<details>` `t.moreVariants(10)` „Ďalších 10 variantov". Pole `textarea name="variantsNew"` `t.variantsAdd` „Pridať varianty", po riadkoch.
   - `answer` `textarea rows=10` + hint `t.markdownHint`. Editor ostáva pole (Markdown sa vykreslí vo FAQ); náhľad nekreslíme.
   - `audience` ako dnes.
   - **Zdroje**: riadok `div.src` = `Select name="sourceDoc"` (dokumenty knižnice) + `input name="sourceRef"` článok + `label.x` s `checkbox name="sourceRemove"` „✕"; na konci jeden prázdny riadok na pridanie. Pod 640 px článok pod dokumentom.
   - `documentId` `Select` cieľový FAQ dokument (dnešné `faqOptions`, kanálové prvé).
5. **Upravený návrh**: `details.pr-original` `t.proposalOriginal` „Pôvodný návrh z ťažby" + `t.proposalEdited(kto, kedy)` v `summary`, zbalený; telo ako dnes.
6. **Úkony** `.acts`, všetko tiché: `SubmitButton` `t.approveNext` „Schváliť do FAQ a ďalší" + `formAction={saveProposalAction}` `t.proposalSave` „Uložiť"; `.quiet` `t.nextIs(otázka)` „Ďalší: …". Pri poslednom nerozhodnutom v kanáli `t.proposalApprove` „Schváliť do FAQ" a `t.lastOpen`. Skryté `next` = id ďalšieho nerozhodnutého (najprv v téme, potom prvý v ďalšej téme s otvorenými). Bez FAQ dokumentu ako dnes len Uložiť + `t.proposalsNoFaq`.
7. `.acts2` pod čiarou: `a.button--quiet.button--sm` `t.rejectOpen` „Zamietnuť…" → `&act=reject#<id>`, `t.mergeOpen` „Zlúčiť s…" → `&act=merge#<id>` (len ak má téma ďalší otvorený návrh).
   - `act=reject`: `form.sub-form` (`rejectProposalAction`) — `textarea name="reason" required maxLength=500` `t.rejectReason` „Dôvod", hint `t.rejectReasonHint`; tiché „Zamietnuť" + odkaz „Zrušiť" (bez `act`).
   - `act=merge`: `form.sub-form` (`mergeProposalAction`) — `.choice-list` s `label.choice-row` + `radio name="into"` pre otvorené návrhy témy (otázka, počet vlákien), predvolený prvý; veta `t.mergeExplain`; tiché „Zlúčiť" + „Zrušiť". Nahrádza `Select`.

**Stav 5 — Rozhodnuté** (`view=decided`): zbalené `.fc-row` bez tlačidla:
- `.tag--published` `t.proposalStatus.approved` „Schválené do FAQ" · otázka · `decidedBy · decidedAt` · odkaz na `/library/<faqDocumentId>/faq` „FAQ ↗".
- `.tag` „Zamietnuté" · kto · kedy · `rejectReason`.
- `.tag` „Zlúčené" · kto · kedy · „do" odkaz `?p=<mergedInto>` s otázkou cieľa.
- `view=all`: otvorené zbalené hore, rozhodnuté pod nimi.

**Stav 7** — `open` prázdny: `div.card.empty` `t.topicAllDecided` „Všetky návrhy témy sú rozhodnuté." + `.empty-text` súhrn + `.empty-action` `t.nextTopic(téma)` → `?topic=<ďalšia s otvorenými>`. Kanál bez otvorených: `.empty` `t.proposalsEmpty` bez odkazu.

### 6 · Šírky
- **≥ 1024** (macOS): `.split`, obsah do 880 px.
- **640–1023** (iPadOS): riadok `.pick` nad obsahom.
- **< 640** (iOS): `.pick`, `.view-switch` cez celú šírku (4 voľby: počet pod popisom, výška 44 px, popis sa smie zalomiť), čipy 40 px so zalomením, Prevziať / Ponechať a úkony cez celú šírku (44 px), zdroj pod sebou. Dole len hlavná lišta aplikácie.
- Svetlá aj tmavá z tokenov; `del`/`ins` aj prečiarknutím/podčiarknutím. cs/en: prepínač má krátke popisy, `.fc-row`, `.rv-head`, `.acts` majú `flex-wrap`.

## Stav v adrese
`?topic=<topicKey>` · `view=open|decision|decided|all` (predvolené `open`, vynecháva sa) · `review=<verdikt>` · `p=<id>` (otvorený návrh) · `act=reject|merge` · `topics=1` (zoznam tém pod 1024 px) · `check=1` (úloha kontroly). `back()` v `proposalActions.ts` doplní zoznam povolených kľúčov o `p`; `page` sa ruší. Všetko odkazy a `form`; bez JS funguje všetko.

## Údaje, ktoré v modeli neexistujú
1. **Dôvod zamietnutia** — `FaqProposal.rejectReason` a pole `reason` v `rejectProposalAction` (dnes zamietnutie bez dôvodu).
2. **Úprava zdrojov** — `entryFields` nečíta zdroje; `approveProposal` berie `p.sources`. Treba `sources` z formulára (`sourceDoc[]`, `sourceRef[]`, `sourceRemove[]`) v `approve` aj `update`; `title` dopočítať z knižnice.
3. **Varianty po riadkoch** — `variants` z viacerých `checkbox` + `variantsNew` (dnes jedna `textarea`).
4. **Ďalší nerozhodnutý** — pole `next` a presmerovanie na `?topic=…&p=<next>#<next>` v `approveProposalAction` (a po zamietnutí / zlúčení).
5. **Počty za tému** — `proposalTopics` vracia len `open`; treba aj `decision`, počty verdiktov a témy bez otvorených (pre „hotovo" a stav 7). `proposalFilterCounts` + `all`.
6. **„3 roky e-mailov"** — obdobie ťažby kanála (min `firstMonth` – max `lastMonth`, alebo z behu ťažby).
7. **Priebeh behu** „23 z 54" — `run.total - run.pending.length` existuje; len nový text.
8. `threads` sú **vlákna**, nie e-maily — v riadku „187 vlákien", nie „187 e-mailov".

## Rozhodnutia v repozitári — dodržané
- Pôvod (vlákna) sa po rozhodnutí maže, ostáva počet a obdobie (ADR-030 D185, DPO 5) — Rozhodnuté nemajú odkaz do schránky.
- Odpoveď zlučovaného ide do poznámky cieľa, zdroje sa spoja (Ján 10. 10. 2026, `mergeProposal`) — veta v `act=merge`.
- Model nič nemení sám; prevzatie je úkon kurátora, pôvodné ostáva v `revision` (D192).
- Uloženie bez schválenia (Ján 10. 10. 2026) — „Uložiť" ostáva.
- Kým kontrola beží, nový štart sa neponúka (Ján 11. 10. 2026).
- Referenčné dokumenty len verejné, nie FAQ (D194) — výber v `?check=1` bez zmeny.
- Všetky tlačidlá v kartách tiché (komentár v `page.tsx`, R1).

## Rámy
- **1440 svetlá:** stav 2 v téme Prihlásenie s panelom tém.
- **1440 tmavá:** stav 6 (hlavička), 1, 3, 4, Zamietnuť, Zlúčiť, 5, 7.
- **834 svetlá:** stav 4 (GDPR) s riadkom témy.
- **390:** rozhodovanie (tmavá), `?topics=1` (svetlá), Rozhodnuté + hotová téma (tmavá).

## Rozhodnuté
Všetky otázky rozhodnuté 11. 10. 2026 podľa **A**.

**Q1 ✅ A — Témy vľavo a výber v adrese `?topic=`, alebo jeden dlhý zoznam so stránkovaním po 20?**
A: témy · B: zoznam po 20.
**Odporúčam A** — kurácia ide po témach a zlúčenie je len v rámci témy.

**Q2 ✅ A — Predvolene „Nerozhodnuté" v prvej téme s [NA ROZHODNUTIE], alebo v najväčšej téme?**
A: prvá s [NA ROZHODNUTIE] · B: najväčšia.
**Odporúčam A** — najprv rozhodnutia, ktoré blokujú schválenie.

**Q3 ✅ A — „Schváliť do FAQ a ďalší" ako hlavný úkon, alebo samostatné „Schváliť"?**
A: a ďalší · B: Schváliť.
**Odporúčam A** — 54 návrhov sa prechádza za sebou.

**Q4 ✅ A — Zlúčenie ako výber z návrhov témy v otvorenej karte, alebo ťahanie kariet na seba?**
A: výber · B: ťahanie.
**Odporúčam A** — funguje bez JS a na telefóne.

**Q5 ✅ A — Pohľad „Bez zdroja" (dnes v prepínači, `nosource`) zrušiť a ukazovať štítok „bez zdroja" pri návrhu, alebo ponechať ako piatu voľbu?** *(mení dnešný stav v repozitári)*
A: štítok pri návrhu · B: piata voľba.
**Odporúčam A** — zdroj sa teraz dopĺňa priamo v karte a päť volieb sa pod 640 px nezmestí.

**Q6 ✅ A — Prevziať / Ponechať ako dva samostatné úkony nad Úpravou, alebo voľba vo formulári schválenia?**
A: samostatné úkony · B: voľba vo formulári.
**Odporúčam A** — prevzatie prepíše polia Úpravy a kurátor má nové znenie vidieť a doladiť pred schválením.

**Q7 ✅ A — Dôvod zamietnutia povinný, alebo nepovinný?**
A: povinný · B: nepovinný.
**Odporúčam A** — pri zamietnutí sa pôvod maže, dôvod je jediná stopa, prečo téma vo FAQ chýba.
