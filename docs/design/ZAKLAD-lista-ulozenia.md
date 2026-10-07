# ZAKLAD — lišta uloženia (DESIGN_ODCHYLKY P9)

> **Stav: rozhodnuté 7. 10. 2026** — Q1–Q6 podľa odporúčania, pripravené na implementáciu.

Referencia: `ZAKLAD-lista-ulozenia.html`. Základ: `ZAKLAD.md`, `ZAKLAD-podmenu-a-akcie.md` (jedno plné tlačidlo), `ZAKLAD-vyber-a-prepinace.md`, `HR-pridelit-nadpis-karty.md` (`.form-group`), `MANAGE-COURSE-akcie.md` (úloha prevezme plné tlačidlo). Vzor v aplikácii: `/organisation/general` (`.set-form`, `.set-sec`, `.set-savebar`), `/channels/[key]` (vedľajšie akcie v karte pod formulárom, `.button--danger`).

Je to **rozdiel oproti existujúcim obrazovkám**. Polia, ich mená a význam ostávajú, mení sa zoskupenie formulárov a tlačidlá.

## Čo sa mení

**Pravidlo:** stránka s nastaveniami má jeden formulár `form.card.set-form` so sekciami `section.set-sec` a jednu lištu `.set-savebar` s jediným plným „Uložiť". Akcie, ktoré nič neukladajú (poslať e-mail, odstrániť, vypnúť), sú v karte **„Ďalšie akcie"** (`section.card.more`) pod formulárom: vratné tiché, nevratné `.button--danger` s potvrdením cez adresu. Zoznam s akciami v riadkoch nemá lištu. Plné je tam tlačidlo v hlavičke, ktoré otvorí úlohu (`?request=1`, `?add=people`); úloha potom prevezme plné tlačidlo.

**Lišta:** `position: sticky; bottom: 0` (už v `globals.css` ~6790). Obsah: plné „Uložiť" + `.quiet` veta **„Uloží všetky sekcie na tejto stránke."** Bez počtu zmien a bez „neuložené zmeny": bez JS to stránka nevie.

**Nové triedy** (bez inline štýlov):

```css
.more { display: grid; }
.more-head { padding: 16px 22px 4px; }
.more-head h2 { margin: 0; font-size: var(--fs-section); }
.more-row { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: center; padding: 14px 22px; border-top: 1px solid var(--line); }
.more-head + .more-row { border-top: 0; }
.more-main { flex: 1 1 280px; display: grid; gap: 2px; min-width: 0; }
.more-main span { font-size: 13px; color: var(--muted); }
.more-confirm { display: grid; gap: 10px; padding: 14px 22px 18px; border-top: 1px solid var(--line); background: var(--bad-bg); }
.button--sm { min-height: 36px; padding: 0 14px; font-size: var(--fs-small); }
@media (max-width: 639px) {
  .more-head, .more-row, .more-confirm { padding-left: 14px; padding-right: 14px; }
  .button--sm { min-height: 44px; }
}
.page-head--section { margin: 0 0 4px; }  /* hlavička časti v /organisation (Domény) */
```

## Kde

### 1. `/organisation/signin`
- `ProviderRow` × 2 + `saveAutoProvisionAction` → **jeden** `form.card.set-form`: sekcie *Prihlásenie cez Microsoft* (štítok stavu v nadpise), *Prihlásenie cez Google*, *Automatické zakladanie*; `.set-savebar`.
- Mená polí s predponou poskytovateľa: `microsoft.clientId`, `microsoft.clientSecret`, `microsoft.tenantMode`, `microsoft.allowedTenantIds`, `google.clientId`, `google.clientSecret`, `google.hostedDomain`; `autoProvisionDomains` bez zmeny.
- Nová akcia `saveSignInPageAction`: uloží oba poskytovateľa aj domény naraz (Q6). Prázdne tajomstvo = ponechať (dnes `clientSecretNote`). Poskytovateľ s prázdnym `clientId` a bez uloženého vlastného nastavenia sa nezakladá.
- Karta **Ďalšie akcie**, len pri `source === "tenant"`: riadok „Odstrániť vlastné prihlásenie cez Microsoft" + `.button--danger` „Odstrániť…" → `?remove=microsoft`. Pod riadkom sa otvorí `.more-confirm` s poľom kódu organizácie a `.button--danger` „Odstrániť", plus „Zrušiť" (odkaz). `deleteSignInAction` bez zmeny (Q1).

### 2. `/organisation/gdpr`
- Tri `set-form` → **jeden** so sekciami *Kontakt*, *Lehoty uchovávania*, *Doplnok k vyhláseniu*; `.set-savebar`.
- Nová akcia `saveGdprPageAction` volá tie isté zápisy ako `saveGdprContactAction`, `saveRetentionAction`, `saveExtraAction`. **Lehoty zapíše a mazanie spustí len vtedy, keď sa zmenili** (Q2).
- Varovanie `.lnote--bad` ostáva v sekcii Lehoty.
- Kto nie je DPO (`!canEditGdpr`): `fieldset disabled` ako dnes, **bez lišty** a s vetou `t.gdpr.readOnly` nad formulárom.

### 3. `/organisation/domains`
- Bez lišty. V `org-body` hlavička časti `.page-head.page-head--section`: `h1` „Domény" (alebo `h2`, podľa `org-head`) + plné **„Požiadať o doménu"** → `?request=1` (Q3).
- `?request=1`: karta úlohy s poľom `host`, plné „Požiadať" + „Zrušiť" (odkaz). Tlačidlo v hlavičke sa vtedy nekreslí. `requestDomainAction` bez zmeny. Formulár žiadosti pod zoznamom sa ruší.
- Čakajúce domény: `.form-group` „Čakajú na overenie · N", riadok = doména · `tag--warn` · od dátumu · záznam DNS · tiché `.button--sm` „Overiť" a „Zrušiť žiadosť". Inline `style` z tlačidiel preč.
- Fungujúce domény: riadok s `tag--ok`. „Odstrániť" (pri viac ako jednej) ako `.button--danger.button--sm` s potvrdením `?remove=<host>` (Q4).

### 4. `/admin/tenants/[code]`
- Ostáva na čítanie: Čísla, stav domén (naživo, D27), Audit.
- **Jeden** `set-form`: *Vzhľad a údaje* (názov, krátky názov, logo, farba, e-mail podpory, jazyky, predvolený jazyk) · *Domény a zakladanie* (`hostnames`, `autoProvisionDomains`) · *Prihlásenie cez Microsoft* · *Prihlásenie cez Google*; `.set-savebar`. Nová akcia `saveTenantPageAction` = `saveTenantAction` + oba `saveSignInAction`, atomicky.
- **Ďalšie akcie**: *Poslať pokyny k doméne* (len pri čakajúcich, pole `to` v riadku, tiché „Poslať pokyny", `sendInstructionsAction`) · *Odstrániť vlastné prihlásenie* (danger → `?remove=<provider>`) · *Vypnúť organizáciu* (danger → `?disable=1`, potvrdenie kódom ako dnes). Pri vypnutej organizácii tiché „Zapnúť organizáciu" bez potvrdenia (Q5).

### 5. `/hr/tracks/[key]`
- `.page-head`: názov · štítok · spacer · plné **„Pridať ľudí"** → `?add=people`.
- `?add=people`: karta úlohy hneď pod hlavičkou (oddelenia, ľudia, prepínač e-mailu). Plné je „Pridať na trasu", „Zrušiť" je odkaz bez parametra. „Pridať ľudí" v hlavičke sa vtedy nekreslí. `<details>` so súhrnom ako plným tlačidlom sa ruší. `addMembersAction` bez zmeny.
- **Nastavenia trasy**: jeden zbalený `<details>` namiesto dvoch (Q3 nižšie — Jánovo rozhodnutie z 2. 10.: hore pri názve, zbalené). V súhrne je „Nastavenia trasy · termín 14 dní od pridania". Vnútri sú Názov, Popis a Termín (`.choice-row`, `dueMode`, `dueDays` bez zmeny) a tiché „Uložiť nastavenia". Nová akcia `saveTrackSettingsAction` = `renameTrackAction` + `setTrackDueAction`.
- Kroky: riadok = číslo · názov · s potvrdením / len na prečítanie · ↑ ↓ · tiché „Odobrať". `carry` (skryté polia poradia) ostáva v každom formulári.
- „Pridať krok": `.form-group` pod krokmi (Dokument `Picker(.menu)`, prepínač Vyžaduje potvrdenie), tiché „Pridať krok".
- Ľudia na trase: tiché „Odobrať" v riadku, „Upozorniť e-mailom" tiché pri nadpise (bez zmeny).
- **Ďalšie akcie**: „Deaktivovať trasu" / „Aktivovať trasu" tiché, je to vratné (`setTrackActiveAction`).

## Prečo

Plné tlačidlo má hovoriť „toto je hlavný krok tejto obrazovky". Pri troch až piatich plných „Uložiť" nevie človek, či uloží celú stránku alebo len kúsok. Ak zmení dve sekcie a klikne len na jedno „Uložiť", druhú zmenu potichu stratí. Jedna lišta to rieši: uloží sa všetko a tlačidlo je stále na dosah. Nevratné akcie (odstrániť prihlásenie, vypnúť organizáciu) dnes stoja v tom istom rade ako „Uložiť" a odlišuje ich len tichý vzhľad.

## Rozhodnutia v repozitári — dodržané

- **Tajomstvo sa nevypisuje, prázdne = nemeniť** (`admin/tenants/[code]/page.tsx`, D43) — dodržané.
- **Vypnutie organizácie a kód len v `/admin`** (hlavička `organisation/[section]/page.tsx`) — dodržané, v `/organisation` vypnutie nie je.
- **Automatické zakladanie patrí k prihlasovaniu** (Ján 25. 9. 2026) — ostáva na `/signin` ako sekcia.
- **Nastavenia trasy hore pri názve, zbalené** (Ján 2. 10. 2026, `hr/tracks/[key]`) — dodržané: dva `<details>` sa spoja do jedného, ostáva hore a zbalený.
- **Kroky trasy sa posielajú celé pri každej zmene** (`carry`) — bez zmeny.
- **Termín trasy len v dňoch** (3. 10. 2026) — bez zmeny.
- **E-mail pri pridaní na trasu predvolene zapnutý** (Ján 3. 10. 2026) — bez zmeny.
- **Bez JavaScriptu** (`admin/tenants` hlavička) — všetko je formulár alebo adresa.
- **`.set-savebar` ako na `/organisation/general`** — rovnaký tvar aj veta.

## Rámy

- **1440 svetlá**: `/organisation/signin` (Microsoft vlastné, Google od dodávateľa) · `/admin/tenants/SFZ` (čakajúca doména, zapnutá) · `/hr/tracks/nastup-2026`.
- **390 tmavá**: `/organisation/gdpr` (DPO, lišta prilepená dole) · `/organisation/domains` (dve čakajúce) · `/hr/tracks/nastup-2026?add=people`.

## SwiftUI

| SwiftUI | Tu |
| --- | --- |
| `Form` + `Section` | `.set-form` + `.set-sec` |
| `toolbar` (`.confirmationAction`) | `.set-savebar` — jedno „Uložiť" |
| `Section` na konci `Form` s `Button(role: .destructive)` | „Ďalšie akcie" |
| `.confirmationDialog` | potvrdenie cez `?remove=`, `?disable=1` |
| `toolbar` + `.sheet` | „Pridať ľudí" / „Požiadať o doménu" → úloha |

## Údaje, ktoré v modeli neexistujú

Žiadne. Schéma bez zmeny. Nové sú len serverové akcie, ktoré spájajú existujúce zápisy: `saveSignInPageAction`, `saveGdprPageAction`, `saveTenantPageAction`, `saveTrackSettingsAction`. Mená polí poskytovateľov dostanú predponu `microsoft.` / `google.`. Nové i18n: `common.saveBarNote` („Uloží všetky sekcie na tejto stránke."), `common.moreActions` („Ďalšie akcie"), texty riadkov v „Ďalšie akcie" (sk/cs/en).

## Rozhodnuté (7. 10. 2026 — všetky podľa odporúčania)

- **Q1** Odstránenie vlastného prihlásenia: potvrdenie kódom až po kliknutí (`?remove=<provider>`).
- **Q2** GDPR: lehoty sa zapíšu a mazanie spustí len pri zmene.
- **Q3** Domény: plné „Požiadať o doménu" v hlavičke časti → `?request=1`.
- **Q4** Odstránenie fungujúcej domény: `.button--danger` s potvrdením `?remove=<host>`.
- **Q5** „Zapnúť organizáciu": tiché v „Ďalšie akcie", bez potvrdenia.
- **Q6** Spoločné uloženie atomicky; chyba pri sekcii, vyplnené polia ostanú.

## Otázky

Žiadne otvorené.

<!-- pôvodné znenie otázok:
- **Q1** — Odstránenie vlastného prihlásenia: potvrdenie kódom až po kliknutí (`?remove=microsoft`, pole v riadku „Ďalšie akcie")?
  **Odporúčam áno.** Dnes je pole kódu stále pod formulárom a vyzerá ako súčasť nastavenia; po zlúčení do jedného formulára by sa navyše odoslalo s „Uložiť".
- **Q2** — Pri spoločnom uložení GDPR zapísať lehoty a spustiť mazanie len vtedy, keď sa zmenili?
  **Odporúčam áno.** Inak by oprava e-mailu DPO znova potvrdila aj lehoty, pri ktorých stojí varovanie o mazaní.
- **Q3** — Domény: plné „Požiadať o doménu" v hlavičke časti, ktoré otvorí pole (`?request=1`)?
  **Odporúčam áno.** Je to jediný krok, ktorý na tej stránke niečo začína; „Overiť" v riadkoch je kontrola a má byť tiché.
- **Q4** — Odstránenie fungujúcej domény ako `.button--danger` s potvrdením (`?remove=<host>`)?
  **Odporúčam áno.** Ľudia, ktorí na portál chodia cez túto adresu, sa naň po odstránení nedostanú. Dnes stačí jedno kliknutie.
- **Q5** — „Zapnúť organizáciu" pri vypnutej: tiché v „Ďalšie akcie", nie plné?
  **Odporúčam áno.** Plné je na stránke len „Uložiť". Zapnutie je vratné a nepotrebuje potvrdenie.
- **Q6** — Spoločné uloženie atomicky: keď jedna sekcia neprejde kontrolou, neuloží sa nič a chyba sa ukáže pri sekcii?
  **Odporúčam áno.** Čiastočné uloženie by človek nepoznal. Vyplnené polia ostanú, takže stačí opraviť a uložiť znova.

-->

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/ZAKLAD-lista-ulozenia.html + .md.
Vetva design/lista-ulozenia z main. DESIGN_ODCHYLKY P9.

Pravidlo: jeden form.card.set-form so sekciami .set-sec a jedna .set-savebar
(jedno plné „Uložiť" + .quiet „Uloží všetky sekcie na tejto stránke.").
Vedľajšie/nevratné akcie v section.card.more „Ďalšie akcie" pod formulárom:
vratné tiché, nevratné .button--danger s potvrdením cez adresu. Zoznam s akciami
v riadkoch bez lišty; plné tlačidlo v hlavičke otvorí úlohu (?request=1, ?add=people),
úloha prevezme plné tlačidlo. Žiadne inline štýly — nové triedy podľa .md.

1. globals.css: .more, .more-head, .more-row, .more-main, .more-confirm, .button--sm,
   .page-head--section (svetlá aj tmavá, <640 odsadenie 14 px, .button--sm 44 px).
2. /organisation/signin: jeden set-form (Microsoft, Google, Automatické zakladanie),
   polia s predponou microsoft./google., saveSignInPageAction (atomicky, prázdne
   tajomstvo = ponechať). Ďalšie akcie: ?remove=<provider> → .more-confirm s kódom,
   deleteSignInAction bez zmeny.
3. /organisation/gdpr: jeden set-form, saveGdprPageAction (lehoty + mazanie len pri
   zmene). !canEditGdpr: fieldset disabled, bez lišty.
4. /organisation/domains: hlavička časti + plné „Požiadať o doménu" → ?request=1
   (karta úlohy, tlačidlo v hlavičke skryť). Overiť/Zrušiť žiadosť tiché .button--sm,
   inline style preč. Odstrániť fungujúcu → .button--danger.button--sm, ?remove=<host>.
5. /admin/tenants/[code]: jeden set-form (Vzhľad a údaje, Domény a zakladanie,
   Microsoft, Google), saveTenantPageAction atomicky. Ďalšie akcie: Poslať pokyny
   (tiché, pole to), Odstrániť vlastné prihlásenie (danger, ?remove=), Vypnúť
   (danger, ?disable=1, kód) / Zapnúť (tiché).
6. /hr/tracks/[key]: .page-head plné „Pridať ľudí" → ?add=people (karta úlohy pod
   hlavičkou, plné „Pridať na trasu", Zrušiť odkaz; tlačidlo v hlavičke skryť;
   starý <details> preč). Jeden <details> „Nastavenia trasy · termín …" (názov,
   popis, termín), tiché Uložiť, saveTrackSettingsAction. Pridať krok tiché.
   Deaktivovať/Aktivovať v Ďalšie akcie, tiché. carry bez zmeny.
7. i18n sk/cs/en: common.saveBarNote, common.moreActions, texty riadkov.

Bez JS musí fungovať všetko. Over 1440 svetlá + 390 tmavá, len klávesnicou;
tsc, eslint, vitest, build. Komentáre: odkaz na ZAKLAD-lista-ulozenia (7. 10. 2026).
Do DESIGN_ODCHYLKY P9 stav ✓ s dátumom.
```
