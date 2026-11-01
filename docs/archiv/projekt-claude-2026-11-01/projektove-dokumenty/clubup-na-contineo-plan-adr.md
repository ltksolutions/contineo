# ClubUp na platforme Contineo — schválený plán ADR (odložené)

Stav: **plán schválený 2026-09-17 (Ján Letko), ADR sa zatiaľ nepíše** — priorita je Fáza 8 (onboarding).

## Východisko
- Tréneri, ktorým bolo Contineo ukázané, chcú LMS ako službu.
- Návrh: ClubUp po funkčnej stránke beží na platforme Contineo; obsah LMS/CMS sa využije aj na interné vzdelávanie (zamestnanci, tréneri).
- Aplikačný kód ClubUpu **neexistuje** → nič sa nemigruje ani nezlučuje (licencie LGPL/EUPL tým odpadajú).
- Identita: Contineo si **založí osobu pri SSO prihlásení cez SportUp**, podobne ako pri Entra.
- ClubUp bude kurzy v budúcnosti aj **predávať**.
- So Žilinskou univerzitou (ŽU) je **veľmi úzka spolupráca** → tvrdenie v ADR-003 platí; pred fázou certifikátov zistiť, čo presne ŽU vyžaduje (garancia obsahu, certifikát, akreditácia, evidencia).

## Číslo ADR
Pôvodne navrhnuté ako „ADR-004" — **to číslo je obsadené** (`ADR-004-termin-potvrdenia.md`). Ďalšie voľné k 2026-09-17: **ADR-009** (overiť pred zápisom).

## Osnova ADR
1. Kontext
2. Varianty: A) ClubUp samostatne + prepojenie, B) ClubUp ako produkt nad platformou Contineo, C) zdieľané služby
3. Navrhované rozhodnutie B — ClubUp zostáva značkou a doménou, v kóde modul `learning` zapínaný profilom tenanta (D34: modul, nie fork)
4. Hranica modulov: onboarding dokladuje, že si čítal; learning overuje, či si pochopil
5. Identita: SportUp SSO, osoba založená pri prvom prihlásení, pravidlá spájania účtov (Entra + SportUp = jedna osoba; spájať podľa e-mailu len ak ho SportUp overuje)
6. Vlastníctvo záznamov: záznam o kurze a certifikát patrí tenantovi ClubUp (poskytovateľ), nie klubu — tréner si ho nesie pri prestupe, D33 bez výnimky
7. Oprávnenie oddelené od platby: prístup ku kurzu = oprávnenie (pridelenie / nákup / zadarmo)
8. Dátový model — kostra: kurz, verzia kurzu, lekcia, otázky viazané na verziu, pokus, certifikát
9. Fázy: L1 kurz a postup (nad trasami) → L2 testy → L3 certifikáty → L4 predaj
10. Zámerne odložené, riziká, otvorené otázky

## Dotknuté súbory (keď sa bude písať)
Nový ADR; `OPEN_DECISIONS.md` (nové D od ďalšieho voľného čísla); ADR-003 kap. 3.1 len poznámka „čiastočne nahradené"; `Contineo_RAG_Projektovy_plan.md` (nová fáza); `CHANGELOG.md`, `NEXT.md`. Žiadny kód, žiadna DB.

## Riziká a otvorené otázky
- LMS nesmie predbehnúť dotiahnutie onboardingu do ostrej prevádzky — poradie rozhodne Ján.
- Stav SSO v SportUpe (OIDC) — neznámy.
- Požiadavky ŽU na certifikáty a evidenciu — neznáme.
- GDPR: výsledky testov sú hodnotenie osoby (kto vidí, retencia).
- Predaj: platby, faktúry, DPH, spotrebiteľské podmienky — s účtovníkom a právnikom.
