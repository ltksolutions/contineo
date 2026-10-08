# KANALY — prehľad kanálov

> **Stav: rozhodnuté 8. 10. 2026.** Q1–Q5 podľa odporúčania. Pripravené na „stiahni design".

Referencia: `KANALY-prehlad.html`. Základ: `ZAKLAD.md`, `ZAKLAD-podmenu-a-akcie.md` (jedno plné tlačidlo, podmenu), `HR-pridelit-nadpis-karty.md` (`.form-group`), `ZAKLAD-vyber-a-prepinace.md` (`.choice-row`), `ZAKLAD-prazdny-stav-citatelnost.md` (`.empty`). Zdroj: `app/channels/page.tsx`, `app/channels/actions.ts` (`saveChannelAction`, vetva `isNew` pri chybe), `components/ChannelTabs.tsx`, `lib/channels.ts` (`ChannelMailbox`, `isSyncDue`, `channelAccessLevel`), ADR-028 D161, D169, D170.

Je to **rozdiel oproti existujúcej obrazovke**. Serverová akcia `saveChannelAction`, polia `isNew`, `kind`, `name`, cesty `/channels`, `/channels/<kľúč>`, `/channels/tickets` a `channelsContext()` ostávajú.

## Čo sa mení

### 1 · Hlavička
- `.page-head` „Kanály" + plné `a.button` „Nový kanál" → **`/channels?new=1`** (dnes `#new`). Len správca, a len **bez** `?new=1`.
- `ChannelSectionTabs` bez zmeny (riešiteľ: Kanály · Moje tickety; správca bez kanálov ako riešiteľ podmenu nemá).
- `p.quiet.page-lead` `t.intro` bez zmeny; riešiteľ, ktorý nie je správca, dostane `t.introAgent` „Kanály, v ktorých odpovedáte na tickety." (nové).

### 2 · Skupina „Kanály" (správca)
- `section.card.detail-block` → `fieldset.form-group` > `legend.form-group-head` `t.list` + `div.card.form-group-body.form-group-body--rows > .form-list`.
- Riadok = **`a.form-row`** na `channelHref(c.key)` (celý riadok terč, min. 56 px):
  - `span.ico` ikona typu (widget: bublina, portál: kniha) — `Icon` z DS, `aria-hidden`;
  - `span.form-row-main` > `b` názov + `span.form-row-sub` podnadpis: `t.kinds[kind]` · `mailbox.address` (ak je) · úroveň `t.levels[channelAccessLevel(c)]` („verejný" / „interný");
  - vpravo `span.row-end` so štítkami: `.tag--expired` „Schránka nesynchronizuje" (bod 3), potom `.tag--draft` `t.openCount(n)` „6 otvorených" — len ak `c.tickets && open > 0`; `open = new + drafted + reopened` ako dnes;
  - `span.chev` „›" (`aria-hidden`).
- **Kľúč (UUID) sa nekreslí.** Celkový počet ticketov („z 65") sa ruší.
- Pod 640 px sú štítky v `.form-row-main` pod podnadpisom (`.row-end` sa presunie CSS-kom, jeden DOM).
- Žiadny kanál: namiesto `p.quiet t.empty` v karte `div.empty` > `.empty-title` `t.emptyTitle` „Zatiaľ žiadny kanál", `.empty-text` `t.emptyText` „Widget vložíte do cudzej stránky, portál otvorí knižnicu ďalším ľuďom. Kanál založíte tlačidlom hore." Bez vlastného tlačidla.

### 3 · Schránka, ktorá nesynchronizuje
- `mailboxStalled(m, now)` v `lib/channels.ts` (nové, čisté, s testom): `true`, keď `m.lastSyncError` **alebo** `lastSyncAt` je starší než `max(3 × syncIntervalMinutes, 30 min)`. Kanál so schránkou bez prvého behu (`lastSyncAt === null`) **nie je** porucha — čaká na cron.
- V riadku `span.tag.tag--expired` `t.mailboxStalled` „Schránka nesynchronizuje", `title` = `t.syncError(lastSyncError)` alebo `t.syncLast(...)`. Príčina a „Synchronizovať teraz" ostávajú v nastavení kanála.

### 4 · Skupina „Vstavané v intranete" (len správca)
- Samostatná `fieldset.form-group` pod kanálmi, `legend` `t.builtIn` (text „Vstavané v intranete").
- Dva `div.form-row` (nie odkazy, bez ›): sivá ikona · `t.builtInAssistant` / `t.builtInPortal` · podnadpis `t.kinds.widget` / `t.kinds.portal` · vpravo `span.quiet` `t.builtInFixed` „nenastavuje sa".

### 5 · Nový kanál (`?new=1`)
- Bez `?new=1` sa formulár **nekreslí** (dnes vždy na konci, `#new`).
- S `?new=1`: `form.card.task-card` hneď pod `page-lead`, nad skupinami. `action={saveChannelAction}`, `input hidden isNew=1`.
  - `h2` `t.newChannel`, `p.quiet` `t.newIntro` „Názov a typ. Typ sa po vytvorení nemení; ostatné nastavíte v kanáli."
  - Chyba (`error`): `div.lnote.lnote--bad` v karte nad poľami (nie `Notice`).
  - Typ: `div.field` > `span.field-label` `t.kind` + `div.choice-list` s dvomi `label.choice-row` > natívny `input type="radio" name="kind" value="widget|portal"` (predvolený `kind` z adresy, inak `widget`) + `span.form-row-main` (`t.kinds[k]`, pod ním `t.kindHints[k]`) + fajka vpravo. `Select` sa tu ruší.
  - `label.field` Názov — `input.field-input name="name" required maxLength=120 defaultValue={name}` + hint `t.nameHint` (nové).
  - `.acts`: plné `SubmitButton.button` `t.create` „Vytvoriť kanál" + `a.button.button--quiet href="/channels"` `t.cancel` „Zrušiť".
- `saveChannelAction`, vetva chyby pri `isNew`: `redirect(/channels?new=1&error=…&name=…&kind=…)` namiesto `…#new`. Úspech bez zmeny (na nastavenie kanála).

### 6 · Riešiteľ
- Len `ctx.visible` = jeho kanály; **bez** Vstavaných a bez „Nový kanál" (plné tlačidlo na obrazovke nie je).
- Riadok `a.form-row`: ikona · názov · podnadpis typ · adresa schránky; vpravo `span.count` > `b` počet otvorených + `span` „otvorených" (pri 0 sivé). Štítok `.tag--draft` sa nepoužíva — číslo je hlavný údaj.
- Správca, ktorý je aj riešiteľ, vidí pohľad správcu (Q2).

## Kde

`app/channels/page.tsx`, `app/channels/actions.ts` (len adresa pri chybe nového kanála), `lib/channels.ts` (`mailboxStalled`), `tests/channels.test.ts`, `globals.css` (`.form-row .ico`, `.row-end`, `.form-row .count`, `.choice-list` ak ešte nie je; inline `style` na stránke → triedy), i18n `channels.*`: `introAgent`, `levels.public/internal`, `openCount`, `mailboxStalled`, `builtInFixed`, `emptyTitle`, `emptyText`, `newIntro`, `nameHint`, `create`, `cancel`; zmazať `tickets(open,total)`, `empty`, `save` ak ich nič iné nepoužíva.

## Prečo

- Riadok s piatimi údajmi inline sa na telefóne rozpadal a odkaz bol len na názve. `List` v `Section` má jeden terč na riadok a pevné miesto pre stav.
- UUID je technický údaj pre vkladanie widgetu; patrí do nastavenia kanála, nie do prehľadu.
- Vždy otvorený formulár na konci robil zo zoznamu formulár a jeho tiché „Uložiť kanál" súperilo s plným tlačidlom hore, ktoré naň len skákalo. Úloha cez adresu (`?new=1`) je vzor z `domains` a `hr/tracks` (ZAKLAD-lista-ulozenia).
- Z dvoch typov je `.choice-row` s vysvetlením lepší než `Select`: obe voľby a ich rozdiel sú vidieť naraz a typ sa po vytvorení nemení.
- Zlyhaná schránka znamená, že e-maily sa nestávajú ticketmi. Dnes to správca zistí, len keď otvorí nastavenie.

## Rozhodnutia v repozitári — dodržané

- **Dva typy: widget a portál; typ sa po založení nemení** (D169, `saveChannel`) — preto je typ len v úlohe nového kanála.
- **Vstavané rozhrania sú v zozname ako pevné riadky** (D169) — samostatná skupina, nedajú sa otvoriť.
- **Správca vidí počty ticketov, nie obsah; riešiteľ len svoje kanály** (D170) — správca štítok, riešiteľ číslo; riadok vedie na rozcestník.
- **Klik na kanál = `/channels/<kľúč>` (rozcestník)** (D170, `channels/[key]/page.tsx`) — bez zmeny.
- **Kľúč je UUID pridelené pri založení, človek ho nevymýšľa** (D161, Ján 7. 10. 2026) — z prehľadu zmizne, v nastavení ostáva.
- **Widget je verejný vždy** (`channelAccessLevel`) — úroveň sa číta odtiaľ, nie z poľa.
- **Podmenu s jedinou položkou sa nekreslí** (`ChannelSectionTabs`) — bez zmeny.
- **Bez JavaScriptu** — riadky sú odkazy, úloha je adresa, typ sú rádiá.

## Rámy

- **1440 svetlá:** správca s ISSF Helpdesk (widget, schránka, 6 otvorených) a Rozhodcovia (portál, interný) + Vstavané · `?new=1` s chybou · ISSF Helpdesk so zlyhanou synchronizáciou.
- **390 tmavá:** správca (štítky pod podnadpisom) · riešiteľ s podmenu Kanály · Moje tickety · správca bez kanálov.

## SwiftUI

| SwiftUI | Tu |
| --- | --- |
| `List` + `Section` + `NavigationLink` | skupina Kanály, `a.form-row` s › |
| `LabeledContent` (riadok bez odkazu) | Vstavané v intranete |
| `Label` štítok stavu v riadku | „6 otvorených", „Schránka nesynchronizuje" |
| `.sheet` úloha → tu karta úlohy cez adresu | `?new=1` `.task-card` |
| `Picker(.inline)` | typ kanála `.choice-row` |
| `ContentUnavailableView` | prázdny stav |

## Údaje, ktoré v modeli neexistujú

- Žiadne nové pole. „Nesynchronizuje" sa odvodí z `mailbox.lastSyncError`, `lastSyncAt` a `syncIntervalMinutes` (`mailboxStalled`, nová funkcia).
- Nové sú len texty i18n (pozri Kde).

## Rozhodnuté (8. 10. 2026 — všetky podľa odporúčania)

- **Q1** „Schránka nesynchronizuje" pri `lastSyncError` alebo pri behu staršom než max(3 × interval, 30 min).
- **Q2** Správca, ktorý je aj riešiteľ, vidí pohľad správcu + podmenu Moje tickety.
- **Q3** Štítok o schránke vidí aj riešiteľ.
- **Q4** Úroveň („verejný") v podnadpise aj pri widgete.
- **Q5** Prázdny stav riešiteľa sa nekreslí (bez kanála sekciu nevidí); `.empty` len pre správcu.

## Otázky

Žiadne otvorené.

<!-- pôvodné znenie otázok:
- **Q1** — Hranica meškania: „nesynchronizuje" pri chybe alebo pri behu staršom než 3 × interval (najmenej 30 min)?
  **Odporúčam áno.** Jeden vynechaný beh cronu nie je porucha, trojnásobok intervalu už áno; spodná hranica 30 min zabráni falošnému poplachu pri 5-minútovom intervale.
- **Q2** — Správca, ktorý je zároveň riešiteľ: vidí pohľad správcu (štítok „6 otvorených") a podmenu Moje tickety?
  **Odporúčam áno.** Správca potrebuje úplný zoznam s Vstavanými; tickety má v Moje tickety, takže číslo ako hlavný údaj nepotrebuje.
- **Q3** — Riešiteľ vidí štítok „Schránka nesynchronizuje" tiež?
  **Odporúčam áno.** Vysvetlí mu, prečo nechodia e-maily, a vie to nahlásiť správcovi; nič nenastavuje.
- **Q4** — Úroveň („verejný") v podnadpise aj pri widgete, hoci je vždy verejný?
  **Odporúčam áno.** Správca vidí na prvý pohľad, že z widgetu ide len verejný obsah, a riadky widgetu a portálu majú rovnakú stavbu.
- **Q5** — Prázdny stav riešiteľa sa nekreslí, lebo riešiteľ bez kanála do sekcie nevidí (`channelsContext()` → 404)?
  **Odporúčam áno.** Položka Kanály sa mu v menu neukáže, takže obrazovka s prázdnym stavom by bola nedosiahnuteľná; prázdny stav je len pre správcu.
-->

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/KANALY-prehlad.html + .md.
Q1–Q5 rozhodnuté podľa odporúčania (pozri .md).
Vetva design/kanaly-prehlad z main. ADR-028 D169/D170.

1. channels/page.tsx: .detail-block → fieldset.form-group „Kanály" s .form-list;
   riadok a.form-row → channelHref(key): ikona typu, názov, .form-row-sub
   (typ · mailbox.address · úroveň z channelAccessLevel), .row-end štítky, ›.
   Bez <code>{c.key}</code>. Správca: .tag--draft openCount pri open>0;
   riešiteľ (nie správca): span.count s počtom otvorených, bez Vstavaných a
   Nového kanála, page-lead introAgent.
2. lib/channels.ts: mailboxStalled(m, now) = lastSyncError || lastSyncAt starší
   než max(3×interval, 30 min); null lastSyncAt = nie. Test v channels.test.ts.
   V riadku .tag--expired mailboxStalled s title príčiny.
3. Vstavané: samostatná .form-group „Vstavané v intranete", dva div.form-row
   bez odkazu, vpravo .quiet „nenastavuje sa".
4. Nový kanál len pri ?new=1: form.card.task-card pod page-lead (isNew, kind
   ako 2× label.choice-row s radio + kindHints, name, plné SubmitButton
   Vytvoriť kanál, a.button--quiet Zrušiť → /channels); chyba .lnote--bad
   v karte. Hlavičkové „Nový kanál" → ?new=1 a pri ?new=1 sa nekreslí.
   actions.ts: chyba isNew → /channels?new=1&error&name&kind.
5. Prázdny stav správcu: .empty (emptyTitle, emptyText) bez tlačidla.
6. i18n sk/cs/en podľa .md; inline štýly → triedy v globals.css.

Bez JS musí fungovať všetko. Over 1440 svetlá + 390 tmavá, klávesnicou
(Tab po riadkoch, šípky v rádiách), VoiceOver (ikony a › aria-hidden).
tsc, eslint, vitest, build. Komentár v page.tsx: odkaz na KANALY-prehlad
(8. 10. 2026).
```
