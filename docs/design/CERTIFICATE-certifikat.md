# CERTIFICATE — Certifikát a verejné overenie

Referencia: `CERTIFICATE-certifikat.html`. Základ: `ZAKLAD.md`, `COURSE-prehlad-kurzu.md` (odkaz na certifikát), `ADMIN-prevadzkovatel-a-ciselniky.md` (údaje o organizácii). Zadanie: `docs/design/LEARNING-zadanie.md`, rám 9 z 9 (L3). Model: ADR-018 (D121, D122), ADR-012 (retencia).

## Čo sa mení

Tri výstupy: obrazovka certifikátu `/learning/[courseKey]/certificate`, verejná stránka `/verify/[registrationNumber]?h=` a návrh PDF. Nové komponenty: **karta certifikátu** (`CertificateCard`), **blok overenia** (QR + odkaz), šablóna PDF.

## Logo na certifikáte (rozhodnutie Jána 27. 9. 2026)

Platí pre kartu v aplikácii, `/verify` aj PDF.

- Organizácia **má nahraté logo** (`branding.logoUrl`) → na certifikáte je jej logo. Pri vydaní sa **kópia** uloží do `issuedBy` — neskoršia zmena loga vydaný certifikát ani jeho PDF nezmení.
- Organizácia **logo nemá** → **logo Contineo** (značka z `web/app/icon.svg`: tmavý štvorec `#11151c` r7, biely kruh s dvoma bodkami a trojuholníkom). **Nie** názov organizácie textom.
- Názov organizácie zostáva pri **„Vydal"** / **„Vydavateľ"** (kópia `issuedBy`).
- Veľkosti: karta 40 px výška (logo organizácie max 96 × 40, `object-fit: contain`), `/verify` 40 px (Contineo 36 px), PDF vľavo hore max 150 × 64 (Contineo 64 px).

## `/learning/[courseKey]/certificate` (prihlásený držiteľ)

- „← {kurz}", karta certifikátu, akcie, blok overenia; 1440 bočný stĺpec „Čo overenie ukáže" a „Uchovanie".
- **Karta**: logo (organizácie alebo Contineo — viď vyššie) · stav (`.tag--published` Platný / `.tag--expired` Odvolaný) · „Certifikát o absolvovaní kurzu" · meno · „absolvoval kurz {názov} (verzia N)" · Číslo · Dátum dokončenia · Vydal. Dvojitý tenký rámik (`::before`).
- **Akcie**: `.button` „Stiahnuť PDF" (`VersionFile`) · „Späť na kurz".
- **Overenie**: QR 96 px + odkaz `…/verify/SFZ-2026-0198?h=…` v mono + veta „Kto má odkaz alebo naskenuje QR, uvidí číslo, kurz, dátum a vydavateľa — bez vášho mena." + „Kopírovať odkaz" (JS; bez JS text na označenie).
- **Odvolaný**: `.notice--error` s dátumom a dôvodom (vidí len držiteľ) · karta stlmená (meno a kurz `--muted`) + pilulka `.tag--expired` Odvolaný · „Stiahnuť PDF" vypnuté s vetou · blok overenia sa neukazuje.

## `/verify/[registrationNumber]?h=` (verejná)

- **Bez prihlásenia, bez AppShell** — vlastný layout ako `/sign-in`: hore len logo (organizácie alebo Contineo), karta v strede (max 520 px), dole „Overenie cez Contineo" so značkou 16 px.
- **Platný**: pás `--ok` ✓ „Certifikát je platný — Vydal ho … a nebol odvolaný." · Číslo · Kurz · Dátum dokončenia · Vydavateľ (názov, adresa, IČO z údajov prevádzkovateľa) · veta „Meno držiteľa sa pri overení nezobrazuje. Porovnajte ho s menom na certifikáte, ktorý vám bol predložený."
- **Odvolaný**: pás `--bad` ✕ „Certifikát bol odvolaný — Odvolaný 22. 9. 2026." **Dôvod sa verejne neukazuje** (môže byť osobný údaj).
- **Nenašiel sa**: zlé číslo **aj** zlý `h` → tá istá stránka „Certifikát sa nenašiel" + rada skontrolovať odkaz / naskenovať QR + „Z bezpečnostných dôvodov neprezradíme, či certifikát s týmto číslom existuje." Bez loga organizácie. HTTP 404.
- `noindex`, bez cookies, bez sledovania. Rate limit na `/verify` (skúšanie čísel).
- Anonymizovaný certifikát (ADR-012) sa overuje ďalej rovnako — meno sa tu nikdy neukazuje.

## PDF — A4 na šírku, jedna strana

297 × 210 mm (1123 × 794 px pri 96 dpi). Generuje Contineo pri vydaní, uloží ako `VersionFile`, nemení sa.

- Vľavo hore **logo organizácie** z `issuedBy` (bez loga: **logo Contineo** 64 px), vpravo hore číslo certifikátu (mono) a dátum vydania.
- Stred: „CERTIFIKÁT" (prepis 0.32em) · „o absolvovaní kurzu" (serif 44 px, light) · „{Organizácia} potvrdzuje, že" · **meno** (serif 38 px, podčiarknuté) · „úspešne absolvoval kurz {názov}" · „verzia N · M častí · K testy prejdené · dokončené {dátum}".
- Dole: **podpisové pole** (čiara 220 px, meno a funkcia podpisujúceho) · voliteľná pečiatka · **QR** 92 px + text odkazu.
- Dvojitý rámik `#232a35` 1.5 px + 0.5 px. Farby pevné (tlač, nie téma).
- Písmo: serif (Georgia / systémový) len pre nadpis a meno; zvyšok systémové sans (Q2).

## Rámy

- **390**: certifikát platný (logo SFZ) · bez loga (Contineo) · odvolaný · tmavá · overenie platný · overenie bez loga · odvolaný · nenašiel sa · overenie tmavá.
- **834**: certifikát platný.
- **1440**: certifikát platný · overenie platný.
- **PDF**: A4 na šírku — s logom organizácie a bez loga (Contineo).

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

| Čo | Kde |
| --- | --- |
| Layout bez shellu | `/sign-in` |
| Údaje o organizácii (názov, adresa, IČO) | prevádzkovateľ — `ADMIN-prevadzkovatel-a-ciselniky` |
| Logo organizácie `branding.logoUrl`, `tenantStyle()` | `lib/tenants.ts` |
| Značka Contineo | `web/app/icon.svg`, `ContineoMark.tsx` |
| `VersionFile`, GridFS | `fileStore.ts` (ADR-011) |
| ContineoMark | `ContineoMark.tsx` |
| `.notice--error`, `.tag--*`, `.card`, `.button` | `globals.css` |

Nové: `CertificateCard`, `VerifyPage`, šablóna PDF (generátor na serveri), QR generátor (knižnica bez siete — overiť licenciu).

## Údaje, ktoré v modeli zatiaľ nie sú

- `certificates.issuedBy.logo` — kópia loga pri vydaní (súbor, nie odkaz na `branding.logoUrl`).
- `certificates`: `registrationNumber` (`{SHORT}-{ROK}-{poradie}`), `verificationHash`, `issuedBy` (kópia), `courseTitle` + `courseVersion` (kópia), `holderName` (anonymizovateľné), `completedAt`, `pdfFileId`, `revokedAt`, `revokedReason`, `revokedBy`.
- Podpisujúci: meno a funkcia — pri kurze alebo v nastaveniach organizácie (Q1).
- Externý vydavateľ (ŽU pre ClubUp): ten istý záznam, ručne doplnené číslo a nahraté PDF (D122) — v UI len „Vydal: {externý}" a PDF nahraté, nie generované. Nakreslené ako návrh (sekcia „Odvolanie certifikátu — správca"): stĺpec Certifikát v Zapísaných, odkaz „Odvolať", karta `?revoke=` s povinným dôvodom, upozornenie držiteľovi, audit. Odvolať sa nedá vrátiť.

## Rozhodnutia Jána 27. 9. 2026

- **Q1 ✅** Nové pole kurzu „Podpisuje za vydavateľa" (meno + funkcia),
  predvolené z nastavení organizácie. V PDF je len meno nad čiarou, nie
  obrázok podpisu.
- **Q2 ✅** Serif v PDF (nadpis a meno) ostáva — jediná výnimka zo sans.
- **Logo ✅** — viď sekciu „Logo na certifikáte" vyššie.
- **Q3 ✅** Odvoláva `learning-admin` v `MANAGE-COURSE` → Zapísaní, pri
  dokončenom človeku „Odvolať certifikát" s povinným dôvodom (audit).

## Otázky pre Jána

- **Q1** — Kto podpisuje certifikát? Návrh: nové pole kurzu „Podpisuje za vydavateľa" (osoba + funkcia), predvolené z nastavení organizácie. Podpis je v PDF len meno nad čiarou — nie obrázok podpisu.
- **Q2** — Serif písmo v PDF (nadpis a meno) — jediná výnimka zo systémového sans. Ponechať, alebo celé PDF v sans ako zvyšok produktu?
- **Q3** — Kto certifikát odvoláva a kde? Návrh: `learning-admin` v `MANAGE-COURSE` → Zapísaní, pri dokončenom človeku „Odvolať certifikát" s povinným dôvodom (audit). Rám to nekreslí.
