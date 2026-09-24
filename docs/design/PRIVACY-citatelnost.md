# PRIVACY — čitateľnosť (`/privacy`)

Referencia: `PRIVACY-citatelnost.html`. Zdroj: `app/src/app/privacy/page.tsx`, i18n `privacy`, `lib/privacy.ts` (`dpoContacts`, `PRIVACY_NOTICE_VERSION`). ADR-012, C1.

## Čo sa nemení

Verejná stránka (`publicRoutes.ts`), jazyk prihláseného alebo organizácie, všetky texty a tabuľky z i18n, poradie sekcií, verzia textu dole. Text informovania je právny dokument — **žiadna veta sa neprepisuje**.

## Čo sa mení (podoba)

1. **Obsah stránky** — od 1024 px bočný stĺpec 220 px, `position: sticky`; pod 1024 px riadok odkazov (chips, `overflow-x: auto`). Položky = existujúce `*Heading`. Každý `h2` dostane `id` a `scroll-margin-top`. Nadpis „Obsah" nový text.
2. **Prevádzkovateľ + DPO** ako dve karty vedľa seba hneď pod úvodom (`auto-fit, minmax(240px,1fr)`). Veta `requests` („Žiadosti posielajte…") sa zobrazí aj v karte DPO — ⚠️ duplicita, alebo presun? viď otázky.
3. **Tabuľky** (`Table`) — od 640 px tabuľka s tučným prvým stĺpcom; pod 640 px zoznam kariet (`<ul>`): prvý stĺpec tučne, ostatné pod ním. Pri sprostredkovateľoch: „Kto" tučne, „Na čo · Kde" pod ním.
4. **Právo namietať** (`objection`) — rámček `--accent-soft` s nadpisom „Právo namietať" namiesto `<strong>` odseku.
5. **Text** — riadok `max-width: 68ch`; na telefóne 15 px.
6. **Verzia textu** — pätička s čiarou.

## Otázky pre Jána

**Odpovede Jána 24. 9. 2026:** bod 2 — vetu `requests` **presunúť do karty DPO** (na konci už nie) · bod 4 — nadpis „Právo namietať" **áno**.

- Bod 2: „Žiadosti posielajte zodpovednej osobe (DPO)." — presunúť z konca do karty DPO, alebo nechať na konci a v karte nič?
- Bod 4: nový nadpis „Právo namietať" — môže byť? (Obsah odseku bez zmeny.)

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | obsah vľavo, karty, tabuľky, rámček námietky |
| **834** | obsah ako chips, tabuľky |
| **390** | chips, tabuľky ako zoznam |

🔴 Zmena schémy: **žiadna.**
