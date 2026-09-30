# ASK — jedno pole v hlavičke, plachta otázky, `/ask` s behom

Referencia: `ASK-otazka-z-hlavicky.html`. Základ: `ZAKLAD.md`, `ASK.md`, `SHELL-rozcestnik` (hlavička a pás cesty).
Zdroj: `components/Header.tsx` (`.header-search`), `components/Search.tsx`, `components/Answer.tsx`, `components/ContineoMark.tsx`, `app/ask/page.tsx`, `components/PendingWidget.tsx`, `lib/i18n.ts` (`ask.*`, `home.*`, `pending.*`), `app/layout.tsx`, `proxy.ts`, `web/app/icon.svg|favicon.ico|apple-icon.png`.

Požiadavka používateľa 29. 9. 2026: na `/ask` nepatrí „Nevybavené žiadosti" ani „Vyskúšajte, ako systém odpovedá"; ikona poľa v hlavičke má byť značka Continea; chýba favicon na `intranet.futbalsfz.sk` aj `app.contineo.app`; jedno pole ako Google, po kliknutí plachta na dlhšiu otázku s popisom a vzormi, po odoslaní `/ask` s bežiacim hľadaním.

## Čo sa mení

1. **Pole v hlavičke = jediné miesto na otázku.** 40 px, radius 20, max. 600 px, vľavo `ContineoMark` 18 px v `--accent`, vpravo `⌘K`/`Ctrl K`. Na `/ask` je v poli položená otázka.
2. **Plachta otázky.** Klik, fokus alebo `⌘K` rozšíri pole na mieste (nie modál v strede): `<textarea name="q" maxlength=1000>` 17 px, rastie do 6 riadkov → lišta (Enter odošle · Shift+Enter nový riadok · Esc zavrie · počítadlo od 800 znakov · „Opýtať sa") → veta `ask.sheet.info` → vzory `ask.examples` (klik vloží do poľa, neodošle; pri neprázdnom poli sa skryjú). Závoj 22 %. Esc / klik mimo zavrie, text ostane. `role="dialog"`, fokus do poľa, po zavretí späť.
3. **`/ask?q=` spustí beh hneď.** `Search` dostane `autoRun`: pri pripojení raz `send(preset)`. Dnes `preset` iba predvyplní pole a človek musí kliknúť znova. Nadpis stránky = otázka (24/640), pod ňou čas a „Upraviť otázku" (otvorí plachtu s otázkou). Odpoveď, fázy (`ask.phases`), zdroje, hodnotenie, stav „nič sa nenašlo" a chyba ostávajú z `ASK.md` (úlohy 1–4).
4. **`/ask` bez `q`**: nadpis „Opýtať sa", jedna veta a tá istá plachta vložená do stránky (bez závoja). Sem vedie tabbar na telefóne.
5. **Z `/ask` sa odstraňuje:** `PendingWidget` („Nevybavené žiadosti"), `home.heading` + `home.intro` („Vyskúšajte, ako systém odpovedá"), `.ask-hero` s vlastným poľom a príkladmi.
6. **390:** ťuknutie do poľa otvorí celú obrazovku (`fixed`, `100dvh`): „×" · „Opýtať sa", pole s kurzorom, veta, vzory 48 px, dole „Opýtať sa" 48 px nad klávesnicou.
7. **Favicon:** do `app/src/app/` skopírovať `icon.svg`, `favicon.ico` (16/32/48) a `apple-icon.png` z `web/app/`. Dnes v aplikácii nie sú vôbec, hoci `proxy.ts` ich z presmerovania vynecháva, teda ich očakáva. Tá istá ikona na každej doméne.

## Prečo

Pole v hlavičke, hero pole na `/ask` a hero pole na Prehľade robili tú istú vec na troch miestach. Plachta dá dlhej otázke priestor tam, kde sa začala. Vysvetlenie („len z dokumentov, s odkazom na zdroj") sa ukáže v okamihu, keď ho človek potrebuje, nie ako nadpis testovacieho rozhrania. `/ask` je obrazovka odpovede: po odoslaní na nej netreba nič robiť, len čítať.

## Konflikt s rozhodnutím v repozitári

- **Ikona poľa.** `Header.tsx` (komentár pri `.header-search-icon`) a `ZAKLAD.md`, odchýlka B: v poli má byť bublina `ask`, nie značka, lebo „pri 16 px z nej vyjde krúžok s rúčkou, teda lupa". `ContineoMark.tsx` však značku 22. 9. prekreslil práve kvôli tomu: chvostík visí zvisle dole a kruh má hrubší ťah. Návrh kreslí značku v 18 px. → **Q1**.
- **`PendingWidget` na `/ask`** je z D36 („prvá vec na úvodnej strane"), z čias, keď `/ask` bola úvodná strana. Od PR 5 je úvodná strana Prehľad a tam sú tie isté úlohy v KPI a v paneli „Čaká na vás". → **Q2**.
- **Hero pole na Prehľade** (`.overview-ask`, PREHLAD.md) duplikuje pole v hlavičke. → **Q3**.

## Rozhodnutia 30. 9. 2026 (odsúhlasil používateľ)

- **Q1 ✅ (30. 9.)** Značka Continea v poli namiesto bubliny `ask`? Odporúčam áno: prekreslená značka (22. 9.) sa ako lupa nečíta a v 18 px (nie 16) jej oči vidieť. Pole je oblé, takže nepripomína filter zoznamu. Ak by sa to nečítalo, ostáva bublina.
- **Q2 ✅ (30. 9.)** `PendingWidget` z `/ask` odstrániť úplne? Odporúčam áno: úlohy sú na Prehľade. Komponent ostáva, ak ho niečo iné používa; ak nie, zmazať aj s `pending.*` i18n.
- **Q3 ✅ (30. 9.)** Odstrániť hero pole otázky z Prehľadu (ostane len v hlavičke)? Odporúčam áno. Jedno pole = jedno miesto. Oslovenie a KPI na Prehľade ostávajú. Ak zostane, má otvárať tú istú plachtu, nie mať vlastnú logiku.
- **Q4 ✅ (30. 9.)** `home.metaTitle` je „Contineo — testovacie rozhranie", a to sa ukazuje v záložke aj na `intranet.futbalsfz.sk`. Zmeniť na „{stránka} · {displayName organizácie}"? Odporúčam áno (mimo tohto rámu, len názov).

## Rámy

- **1440** Prehľad: pole v pokoji · plachta prázdna · plachta s dlhou otázkou.
- **1440** `/ask`: beží (fázy) · odpoveď so zdrojmi · nič sa nenašlo · bez `?q=`.
- **834** plachta. **390** celá obrazovka · odpoveď.
- Favicon v záložke (16 px) a 48 px.

## Rozmery

Pole 40 / radius 20 / max. 600, značka 18, text 14, `kbd` 11. Plachta: top −8, left −8, šírka poľa + 96 (min. 680; 834: + 60), radius 18, tieň `0 18px 48px rgba(20,28,42,.2)`, textarea 17/1.5, min. 78 px, max. 6 riadkov. Veta 13.5 `--muted`, prvá veta tučne `--ink`. Vzory 40 px (390: 48), ikona `ask` 15. Tlačidlo „Opýtať sa" 40 / radius 20 (390: 48 na celú šírku). `/ask`: stĺpec max. 760, nadpis 24/640 (390: 19), odpoveď 15.5/1.7 (390: 16/1.65), zdroj min. 44 px na 390.

## i18n (sk/cs/en)

Nové: `ask.sheet.info` („Odpoveď sa skladá len z dokumentov {organizácie}. Pri každom tvrdení je odkaz na zdroj. Ak to v dokumentoch nie je, systém to povie a nič si nevymyslí."), `ask.sheet.examplesLabel` „Napríklad", `ask.sheet.hint` „Enter odošle · Shift+Enter nový riadok · Esc zavrie", `ask.sheet.insert` „vložiť", `ask.edit` „Upraviť otázku", `ask.askedAt` („Opýtali ste sa o {čas}"), `ask.answerKicker` („Odpoveď z dokumentov {skratka}"), `ask.emptyLead`. Odpadá: `home.heading`, `home.intro` (po Q2 aj `pending.*`, ak ich nič nepoužíva). `ask.examples` ostáva.

## Údaje, ktoré v modeli neexistujú

Žiadne. Vzory otázok sú i18n (ako dnes). Poznámka: vzory sú rovnaké pre každú organizáciu a sú futbalové. Pre iného tenanta by mali byť v nastavení organizácie, ale to je mimo tohto rámu (zapísať do TODO). 🔴 Zmena schémy: **žiadna**.

## Prompt pre Claude Code

```
Implementuj design_handoff_contineo_intranet/ASK-otazka-z-hlavicky.html + .md.
Q1–Q4 sú rozhodnuté (30. 9. 2026), pozri .md.
Najprv prečítaj Header.tsx, Search.tsx, Answer.tsx, ContineoMark.tsx, app/ask/page.tsx,
PendingWidget.tsx, app/page.tsx (overview-ask), app/layout.tsx, proxy.ts, ZAKLAD.md
(odchýlka B) a docs/DEVLOG.md k /ask a ikone poľa.

Rozsah (vetva design/ask-z-hlavicky):
1. Favicon: skopíruj web/app/icon.svg, favicon.ico, apple-icon.png do app/src/app/.
   Over v builde, že <link rel="icon"> je v HTML a /favicon.ico vracia 200 na oboch
   hostiteľoch (proxy.ts ich už vynecháva).
2. Header.tsx: pole otázky 40 px / radius 20 / max 600, ContineoMark 18 px namiesto
   Icon "ask" (Q1), aktualizovať komentár. Klik/fokus/⌘K otvorí plachtu
   (components/AskSheet.tsx, klient): textarea name="q" maxlength 1000, auto-výška do
   6 riadkov, Enter odošle / Shift+Enter riadok / Esc zavrie, počítadlo od 800,
   ask.sheet.info, vzory ask.examples (klik vloží, neodošle; skryť pri neprázdnom poli),
   závoj, klik mimo zavrie, text ostane, role="dialog", fokus späť na pole.
   Odoslanie = router.push(`/ask?q=${encodeURIComponent(q)}`). Bez JS ostáva dnešný
   <form method="get" action="/ask"> s <input name="q">. Na /ask pole nesie aktuálnu q.
   Pod 640 px plachta na celú obrazovku (fixed, 100dvh), tlačidlo 48 px dole.
3. Search.tsx: prop autoRun — pri pripojení raz send(preset) (useEffect s ref proti
   dvojitému spusteniu v StrictMode). Vlastné pole a príklady z /ask?q= preč; pri /ask
   bez q vykresli AskSheet vložený do stránky (inline, bez závoja).
4. app/ask/page.tsx: odstrániť PendingWidget a home.heading/intro (Q2). S q: nadpis =
   otázka, čas, „Upraviť otázku" (otvorí plachtu s q), potom Answer. Bez q: nadpis
   „Opýtať sa", ask.emptyLead, inline plachta. Stavy none/error z ASK.md ostávajú.
5. Prehľad: odstrániť .overview-ask (Q3), oslovenie a KPI ostávajú.
6. home.metaTitle → "{stránka} · {displayName}" (Q4), bez „testovacie rozhranie";
   bez prihlásenia na app.contineo.app „Contineo".
i18n sk/cs/en podľa .md; nepoužívané kľúče zmazať (pending.* len ak ich nič nečíta).
Zapíš do docs/DEVLOG.md (Q1 mení ZAKLAD odchýlku B — poznámka tam aj do ZAKLAD.md),
do TODO vzory otázok podľa organizácie.
Overenie: tsc, eslint (baseline), vitest, build; render 1440 / 834 / 390: pole v pokoji,
plachta prázdna aj s dlhou otázkou, /ask beh → odpoveď, nič sa nenašlo, /ask bez q;
svetlá aj tmavá; bez JS (formulár odošle, /ask odpovie po načítaní JS); favicon v záložke.
```
