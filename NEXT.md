# NEXT — kde sme a čo je ďalší krok

> Jedna strana pre rituál **„Zorientuj sa"**. Podrobnosti a odôvodnenia sú
> v `docs/TODO.md`; sem patrí len to, čo treba vedieť pri štarte.
>
> **Tento súbor je indícia, `git log` je pravda.** Keď si protirečia, verí sa
> gitu a NEXT.md sa opraví. Aktualizuje sa pri rituáli **„Poupratuj"**.

Posledná aktualizácia: **2026-09-24 popoludní** (po PR #108: ADR-012 retencia a DPO, C1 `/privacy`, ADR-013 údaje o znení)

---

## Kde sme teraz

Všetko je **zlúčené v `main` a nasadené** na `intranet.futbalsfz.sk`; jediná
vetva je `main`. Hash nasadeného commitu je v pätičke. Staršia história
(handoff PR 0–14, knižnica proti `MASTER.md`, D91/D92) je v `CHANGELOG.md`
a `docs/DEVLOG.md`.

**ADR-011 (PDF ako schvaľovaný dokument) beží naostro.** Pracovný poriadok SFZ
je nahratý ako PDF + `.docx`, text je čistý (PR #101) a koncept prešiel
prvým kolom schvaľovania. Súbory nahradeného konceptu sa po novom nahratí
mažú samy.

**ADR-012 — retencia a DPO** (PR #102–#106, podľa druhého kola odpovedí DPO):

- doklady 3 roky od skončenia pomeru/vzťahu (`persons.endedAt`), poistka od
  vyradenia (`deactivatedAt`), strop 5 rokov len pre vyradené bez dátumu;
- denná dávka v `/api/cron/overdue` beží v režime **`report`** — nič nemaže;
- audit 24 mesiacov (TTL `audit_ttl` je na produkcii);
- rola **`dpo`** (má ju **Ján — DPO je on**), `/dpo` s výkazom právnych
  základov, štvrťročný e-mail a **námietky** podľa čl. 21;
- **`/privacy`** (C1) je verejná, s údajmi prevádzkovateľa SFZ z nastavenia
  organizácie. Návrhy C1–C3 sú v `docs/C1_…`–`C3_…` a ako `.docx`.

**ADR-013 — údaje o znení** (PR #108): autor, schválil, dátum schválenia,
dátum účinnosti. Zadávajú sa pri nahratí, predvypĺňajú z prvej strany `.docx`,
sú súčasťou schválenia a po predložení sa nemenia. Dátum účinnosti = „Platné od".

**Naostro neoverené:** `/dpo` (výkaz, CSV, námietka), dátum skončenia na karte
osoby, uloženie údajov o znení a zverejnenie s nimi; z D93 audit presunu
do priečinka.

## Čo čaká na rozhodnutie Jána

**Ako DPO — `C1_C3_ochrana_udajov.docx`:** schváliť text informovania (C1),
kto a dokedy zapíše záznam o spracovateľských činnostiach (C2), záver, že
pred pilotom DPIA netreba (C3). Otvorený je aj **termín balančného testu**
(A3, A11). C1 a A3 sú brány pred pilotom.

**Kontrola číselníka právnych základov** (`Pravne_zaklady_navrh_ciselnika.docx`)
sa od Švehlovej nevrátila — kým ju DPO nepotvrdí, podľa číselníka sa
základy nevyberajú.

**Zapnúť ostré mazanie** — `RETENTION_MODE=delete` na Verceli po kontrole
výkazu `retention` v odpovedi cronu.

**Automatický prevod `.docx` → PDF** (Graph, nové povolenia v Entra ID) a
**D93 — deväť otázok v časti 6 plánu** (`docs/D93_plan_vyber_podla_filtra.md`)
čakajú ako doteraz. Drobnosti (`.page-head` o dve hodnoty, `sectionKey`
v Atlas indexe) sú v `docs/TODO.md`.

## Najbližšie kroky

0. **Pracovný poriadok dotiahnuť do konca:** na detaile uložiť predvyplnené
   údaje o znení (Oddelenie ľudských zdrojov · VV SFZ · 7. 9. 2026 ·
   7. 9. 2026) — **zruší to doterajšie schválenie** —, predložiť znova,
   schváliť, zverejniť. Tým sa naostro overí ADR-013 aj zverejnenie s PDF.
   Potom priradiť na potvrdenie a vyskúšať potvrdenie PDF na telefóne (390 px).
1. **Prejsť `/dpo` naostro:** výkaz a CSV; námietku skúsiť len na testovacej
   osobe (vyhovenie maže doklady natrvalo).
2. **Odkaz na `/privacy` do pozvánky** (päta `inviteEmail`) — posledná
   chýbajúca časť C1.
3. **D93 PR 2 — testy `moveManyAction`** pri dnešnom správaní; na rozhodnutí
   nezávisí.

## Ako sa projekt overuje

Všetko sa púšťa z adresára `app/`:

```
cd app && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build
```

Baseline, proti ktorej sa porovnáva: **0 errors, 42 warnings, 1623 testov
v 102 súboroch.** Nová chyba alebo nové varovanie znamená regresiu, nie šum.

**Tieto štyri brzdy nevidia chyby za behu.** 23. 9. prešli všetky štyri
a produkcia aj tak spadla (dočasná mŕtva zóna v `library/page.tsx`). Preto
je odteraz `@typescript-eslint/no-use-before-define` zapnuté ako **chyba** —
`tsc` túto triedu chýb chytiť nevie, hlási len priamy odkaz v tom istom
mieste, nie odkaz vnútri callbacku.

**Stránka sa overuje telom odpovede, nie stavovým kódom.** Next servíruje
chybovú stránku s kódom **200**, takže `curl -o /dev/null -w '%{http_code}'`
o ničom nevypovedá. Hľadá sa reťazec „A server error occurred" v tele.

**A overuje sa to, čo ľudia s obrazovkou robia, nie to, čo sa menilo.**
Knižnica nasadená bez vyskúšaného filtra nie je overená knižnica.

Rozhranie sa overuje **mobile first**: 390 px tmavá a 1440 px svetlá.
Zlomové body sú len **640 a 1024**, iné nepribúdajú.

`npm run build` zhodí bežiaci `npm run dev` — zdieľajú `.next`. Buildom sa
overuje až po zastavení dev servera.

**Lokálne SFZ je na `http://sfz.localhost:3000`, nie na `localhost`** — ten
patrí tenantovi LTK a osoba Jána tam nie je (D90), takže knižnica hlási
„Stránka sa nenašla" aj pri prihlásení. Prihlasuje sa zvlášť; odkaz z e-mailu
má v `callbackUrl` https, po prihlásení treba ručne otvoriť `http://`.
**Lokálny server píše do ostrej databázy** — zápisy (presun, audit) sa
naživo skúšajú len so súhlasom Jána.

**Marketingový web má vlastnú sadu** a púšťa sa z `web/`:

```
cd web && npx eslint . && npx vitest run && npm run build
```

Baseline: **0 errors, 0 warnings, 13 testov v 2 súboroch, 62 predgenerovaných
stránok** (z toho 18 OG a Twitter obrázkov). `next lint` tu už neexistuje —
volá sa priamo `eslint`.

## Mapa dokumentácie

`CLAUDE.md` sú konvencie repozitára a rituály. **`NEXT.md` (tento súbor)** je
stav a ďalší krok. `docs/TODO.md` je dlhý backlog s odôvodneniami — čo sa
nerobí a prečo. `docs/DEVLOG.md` je datovaný denník práce. `CHANGELOG.md` sú
zmeny pre používateľa. **Rozhodnutia sú v `docs/decisions/`** (prijaté ADR,
rozcestník v `README.md` toho priečinka, konvencia MADR) a `docs/OPEN_DECISIONS.md`
(otvorené, očíslované `D1`, `D2`…). Plány `docs/D79_plan_*.md` a `docs/O7_plan_*.md`
sú návrhy postupu, nie rozhodnutia, a zostávajú v `docs/`.
