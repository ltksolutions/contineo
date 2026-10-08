# OSOBY — karta osoby (`/people/[id]`)

> **Stav: rozhodnuté 8. 10. 2026** — Q1–Q4 podľa odporúčania, pripravené na implementáciu.

Referencia: `OSOBY-karta-osoby.html`. Základ: `ZAKLAD.md`, `ZAKLAD-lista-ulozenia.md` (`.set-form`, `.set-savebar`, `.more`), `ZAKLAD-vyber-a-prepinace.md`, `ZAKLAD-vyber-skupin-a-znaciek.md` (`ValueSelect`), `OSOBY.md`, `OSOBY-skoncenie-vztahu.md`. Zdroj: `app/src/app/people/[id]/page.tsx`, `people/actions.ts` (`savePersonAction`, `togglePersonStatusAction`, `resendInviteAction`, `setEndedAtAction`), `components/ValueSelect.tsx`, `EvidenceTimeline.tsx`. DESIGN_ODCHYLKY: „karta osoby bez karty v karte" (r. 198, 270).

Je to **rozdiel oproti existujúcej obrazovke**. Polia, ich mená (`givenName`, `surname`, `titleBefore`, `titleAfter`, `email`, `mobilePhone` + krajina, `jobTitle`, `workplace`, `departmentId`, `personType`, `language`, `gender`, `groups` + `groupsNew`, `track`, `roles`) a akcie ostávajú.

## Čo sa mení

1. **Hlavička:** `.page-head` (meno s titulmi + `personTagClass`) a jeden `p.quiet.page-lead`. Pri aktívnej osobe je v ňom e-mail · naposledy …, pri pozvanej `invitedNotSignedIn` / `newNotInvited`, pri vyradenej `excludedNoSignIn`. Dva riadky s inline štýlmi sa rušia. `emailHistory` („Predtým: …") a `accounts` („prihlasuje sa cez …") sú `field-hint` pod e-mailom v sekcii Kontakt; `emailNote` zostáva pred nimi.
2. **Formulár:** `form.card.set-form` (bez inline paddingu) so sekciami `section.set-sec`:

   | Sekcia | Polia |
   | --- | --- |
   | Osoba | `givenName` + `surname` (`.field-row`), `titleBefore` + `titleAfter` (`.field-row`), nápoveda `nameNote` / `nameMissing` / `titlesNote` |
   | Kontakt | `email` (+ `emailNote`, predošlé adresy, účty), `PhoneField` |
   | Zaradenie | `jobTitle` + `workplace` (`.field-row` od 640 px), `departmentId`, `personType`, veta `legacyDepartment` |
   | Jazyk a oslovenie | `language` + `gender` (`.field-row`) (Q4) |
   | Skupiny a trasy | `ValueSelect` skupín (bez karty), Trasy (`track`) vrátane `orphanTracks` |
   | Roly | `roles`; skrytá `LEARNING_ROLE` pri vypnutom module ostáva |

3. **Výbery bez karty v karte:** nový tvar **`.sec-rows`** (nadpis `.sec-rows-head`, riadky `.form-row.select-row` cez celú šírku sekcie, čiara medzi riadkami aj nad prvým a pod posledným, pätička `.sec-rows-foot`). `ValueSelect` dostane prop `variant="rows"`: namiesto `fieldset.form-group` + `.card` vykreslí `fieldset.sec-rows` (pole „Hľadať alebo pridať" a varovanie `SimilarWarning` ostávajú). (Q2)
4. **Lišta:** `.set-savebar` na konci formulára (sticky): `SubmitButton` „Uložiť" + `.quiet` „Uloží všetky sekcie na tejto stránke." (`common.saveBarNote`).
5. **Ďalšie akcie** (`section.card.more#more`) namiesto `<details>` „Prístup a členstvo":
   - *Pozvánka* — len pri `needsInvitation(o)`: text `inviteNote` (+ odkedy, kedy odoslaná), tiché `resendInviteAction` (`inviteSubmit` / `inviteSubmitFirst`).
   - *Vyradiť osobu* — nevyradená osoba: `a.button.button--danger` „Vyradiť…" → `?exclude=1#more`. Pri `?exclude=1` sa tlačidlo skryje a pod riadkom sa otvorí `.more-confirm` s obsahom dnešnej karty `.ex`: časová os, `endedAt` (nepovinné, `max` = dnes), adresa na opísanie, `confirmation`, `button--danger` „Vyradiť" (`togglePersonStatusAction`, `status=inactive`) a „Zrušiť" (odkaz bez parametra). (Q1)
   - *Skončenie vzťahu* — vyradená osoba: fakty (Vyradená · Vzťah skončil · Doklady sa zmažú od), pole `endedAt`, tiché „Uložiť dátum" (`setEndedAtAction`). Samostatný formulár.
   - *Vrátiť osobu* — vyradená osoba: `returnNote…`, tiché „Vrátiť osobu" (`togglePersonStatusAction`, `status=invited`).
6. **Povinnosti** (len `isHr`, pod Ďalšími akciami): `.form-group` s nadpisom „Povinnosti · N" a odkazom „Výkaz všetkých ľudí" (`/hr/evidence`). V karte `.duty` je riadok dokument · `dutyTagClass` · posledný krok z `timeline` · `versionLabel` a pod ním `<details>` „Časová os" s `EvidenceTimeline`. Pätička je veta `notifiedMissing`. Prázdny stav `.empty` ostáva. (Q3)
7. **Šírka:** obal `.page-narrow` (max 760 px; dnes inline `maxWidth: 680`). Riadok `tenantStyle(branding)` sa presúva na obal bez inline rozmeru.

## Kde

Len `app/src/app/people/[id]/page.tsx`, `globals.css` (`.sec-rows*`, `.duty*`, `.page-narrow`) a `components/ValueSelect.tsx` (`variant`). Akcie v `people/actions.ts` sa nemenia, okrem presmerovania po chybe vyradenia na `?exclude=1#more`, aby karta ostala otvorená.

## Prečo

- Karta v karte (výbery s vlastným rámom vnútri rámu formulára) vytvára dve úrovne hrán a riadky výberu vyzerajú ako samostatný formulár s vlastným uložením.
- Štrnásť polí pod sebou bez nadpisov sa nedá prehľadať. Sekcie pomenúvajú, čo kde je, a zodpovedajú tomu, ako personalista uvažuje (kto to je, ako ho zastihnúť, kam patrí).
- „Uložiť" na telefóne až po 3–4 obrazovkách: kto opravil telefón hore, musí posúvať na koniec. Lišta je stále na dosah.
- `<details>` „Prístup a členstvo" mal vnútri tri karty, teda opäť kartu v karte. Riadky „Ďalších akcií" sú rovnaké ako na `/organisation/signin` a `/admin/tenants`.

## Rozhodnutia v repozitári — dodržané

- **Adresa sa nedá prepísať pod existujúcimi záznamami** (hlavička `page.tsx`) — pole `email` a jeho správanie sa nemenia.
- **Meno = dve polia, `fullName` skladá server** (D83) — bez zmeny. Dvojice ostávajú `.field-row`.
- **Meno s titulmi v nadpise a stav pilulkou `personTagClass`; stav osoby a stav povinnosti sú dve škály** (OSOBY.md úloha 1) — dodržané.
- **Vyradenie je vzácne a nevratné, predvolene zatvorené; potvrdenie napísaním adresy sa neprepisuje na obyčajné tlačidlo** (OSOBY.md úloha 3, r. 36, 97) — dodržané: bez `?exclude=1` je vidno len riadok a tlačidlo, potvrdenie adresou ostáva.
- **Karta vyradenia: časová os, adresa na opísanie, nepovinný `endedAt`; vrátenie a oprava dátumu sú dva formuláre** (OSOBY-skoncenie-vztahu, Ján 24. 9.) — obsah sa prenáša do `.more-confirm` a riadkov bez zmeny.
- **Pozvánka len kým sa osoba neprihlásila, vyradenej nie** (`needsInvitation`, D47) — dodržané.
- **Povinnosti (os dôkazov) vidí len rola `hr`, nie `people-admin`** (ADR-005, D67) — dodržané.
- **Os je posledná, pod správou osoby** (komentár v `page.tsx`) — dodržané.
- **Trasy podľa názvu; `orphanTracks` ostane zaškrtnutý; `LEARNING_ROLE` pri vypnutom module skryto ostáva** — bez zmeny.
- **Termín „vyradiť", nie „vylúčiť"** (i18n `excludeHeading`, KONTROLA-2026-09-24) — návrh používa „Vyradiť".

## Rámy

- **1440 svetlá:** aktívna osoba (skupiny rozhodcovia + delegati, trasa Rozhodcovia 2026, rola hr, 3 povinnosti, jedna os rozbalená) · pozvaná osoba (pozvánka v Ďalších akciách) · `?exclude=1` (karta vyradenia otvorená v riadku).
- **390 tmavá:** aktívna osoba (lišta prilepená dole, hlásenie „Osoba uložená") · vyradená osoba posunutá na koniec (lišta pod Rolami, skončenie vzťahu, Vrátiť).

## SwiftUI

| SwiftUI | Tu |
| --- | --- |
| `Form` + `Section` | `.set-form` + `.set-sec` |
| `List(selection:)` v `Section` | `.sec-rows` + `.select-row` |
| `toolbar` (`.confirmationAction`) | `.set-savebar` |
| `Section` s `Button(role: .destructive)` | „Ďalšie akcie" |
| `.confirmationDialog` | `?exclude=1` → `.more-confirm` |
| `DisclosureGroup` | „Časová os" v riadku povinnosti |

## Údaje, ktoré v modeli neexistujú

Žiadne. „Posledný krok" povinnosti je posledná položka `timeline` z `evidenceForPerson()`. „Doklady sa zmažú od" je už dnes odvodené (`addYears`). Nové i18n: názvy sekcií (`sectionPerson`, `sectionContact`, `sectionPlacement`, `sectionLanguage`, `sectionGroups`, `sectionRoles`), `moreActions`, `excludeOpen` („Vyradiť…"), `dutyTimeline` („Časová os"), `dutyLast*` (sk/cs/en).

## Rozhodnuté (8. 10. 2026 — všetky podľa odporúčania)

- **Q1** Vyradenie: v „Ďalších akciách" len riadok s „Vyradiť…"; karta vyradenia sa otvorí pri `?exclude=1#more`.
- **Q2** Výbery v sekcii ako `.sec-rows` (riadky cez celú šírku sekcie), bez vlastnej karty; `ValueSelect variant="rows"`.
- **Q3** Povinnosti: časová os pri každom dokumente zbalená v `<details>` „Časová os".
- **Q4** Sekcia s jazykom a pohlavím sa volá „Jazyk a oslovenie".

## Otázky

Žiadne otvorené.

<!-- pôvodné znenie otázok:
- **Q1** — Vyradenie: v „Ďalších akciách" len riadok s „Vyradiť…" a karta vyradenia sa otvorí až pri `?exclude=1` (nie stále otvorená)?
  **Odporúčam áno.** Ján chcel vyradenie predvolene zavreté (`<details>`). Adresa tú istú vec robí bez JS a zároveň sa dá poslať odkaz rovno na vyradenie.
- **Q2** — Výbery v sekcii ako `.sec-rows` (riadky cez celú šírku sekcie s čiarami), nie `.form-group` s vlastnou kartou?
  **Odporúčam áno.** Je to jediný spôsob, ako zrušiť kartu v karte a zachovať 44 px terč na celý riadok, ako má SwiftUI `List` v `Form`.
- **Q3** — Povinnosti: celú os zbaliť do `<details>` v riadku (ADR-005 hovorí „os pre každý dokument")?
  **Odporúčam áno.** Os ostáva pri každom dokumente, len zbalená. Pri 10+ povinnostiach je dnes karta osoby hlavne výkaz, a to komentár v `page.tsx` výslovne nechce.
- **Q4** — Sekciu s jazykom a pohlavím nazvať „Jazyk a oslovenie", nie „Prostredie"?
  **Odporúčam „Jazyk a oslovenie".** Pohlavie slúži na oslovenie a tvary textov (`genderNote`), s prostredím aplikácie nesúvisí. Ak sa používa aj na štatistiku vzdelávania (ADR-021), lepší je názov „Jazyk a pohlavie".

-->

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/OSOBY-karta-osoby.html + .md.
Vetva design/karta-osoby z main. DESIGN_ODCHYLKY „karta osoby bez karty v karte".

1. Hlavička: .page-head (displayName + personTagClass) + jeden p.quiet.page-lead
   (email · lastSeen / invitedNotSignedIn / newNotInvited / excludedNoSignIn).
   emailHistory a accounts → field-hint pod e-mailom. Inline štýly preč.
2. Obal .page-narrow (max 760) s tenantStyle; inline maxWidth preč.
3. Jeden form.card.set-form so sekciami .set-sec: Osoba · Kontakt · Zaradenie ·
   Jazyk a oslovenie · Skupiny a trasy · Roly (polia a mená bez zmeny, .field-row
   dvojice). Na konci .set-savebar (SubmitButton „Uložiť" + common.saveBarNote).
4. globals.css: .sec-rows, .sec-rows-head, .sec-rows-foot (riadky .form-row cez
   celú šírku sekcie, čiara medzi riadkami aj na krajoch, <640 odsadenie 14 px),
   .duty, .duty-row, .duty-top, .duty-sub, .page-narrow. ValueSelect variant="rows".
5. Ďalšie akcie section.card.more#more namiesto <details>: Pozvánka (needsInvitation,
   tiché), Vyradiť (a.button--danger → ?exclude=1#more; pri parametri tlačidlo
   skryť a otvoriť .more-confirm s obsahom dnešnej .ex — os, endedAt, adresa,
   confirmation, button--danger „Vyradiť", „Zrušiť" odkaz), pri vyradenej
   Skončenie vzťahu (fakty + endedAt + tiché „Uložiť dátum") a Vrátiť osobu (tiché).
   Chyba vyradenia presmeruje na ?exclude=1#more.
6. Povinnosti (isHr): .form-group „Povinnosti · N" + odkaz /hr/evidence; riadok
   dokument · dutyTagClass · posledný krok z timeline · versionLabel; <details>
   „Časová os" s EvidenceTimeline. Prázdny stav .empty bez zmeny.
7. i18n sk/cs/en podľa .md.

Bez JS musí fungovať všetko. Over 1440 svetlá + 390 tmavá (aktívna, pozvaná,
vyradená, ?exclude=1), len klávesnicou; tsc, eslint, vitest, build.
Komentáre: odkaz na OSOBY-karta-osoby (8. 10. 2026). DESIGN_ODCHYLKY: stav ✓ s dátumom.
```
