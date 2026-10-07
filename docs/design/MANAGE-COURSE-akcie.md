# MANAGE-COURSE — akcie na úprave kurzu

> **Stav: rozhodnuté 7. 10. 2026** — Q1–Q5 podľa odporúčania, pripravené na implementáciu.

Referencia: `MANAGE-COURSE-akcie.html`. Základ: `ZAKLAD.md`, `ZAKLAD-podmenu-a-akcie.md` (jedno plné tlačidlo, žiadne „← Späť…"), `ZAKLAD-vyber-a-prepinace.md` (`.toggle`, `.choice-row`, pilulky preč z formulárov), `HR-pridelit-nadpis-karty.md` (`.form-group`), `MANAGE-COURSE-uprava-kurzu.md` (pôvodný rám 27. 9.). Zdroj: `app/src/app/learning/manage/[courseKey]/page.tsx`, `actions.ts`.

## Čo sa mení a prečo

Pravidlá z 2. a 6. 10. sú na úprave kurzu uplatnené len čiastočne. Na detaile časti sú dnes **štyri plné tlačidlá** (Zverejniť v karte stavu, Uložiť, Pridať, Priradiť test). Typ bloku a zdroj videa sa vyberajú pilulkami, je tam odkaz „← Všetky časti" a riadok bloku má štyri ovládače. Archivácia kurzu aj odstránenie časti sa vykonajú na jedno kliknutie.

**Pravidlo:** na každej obrazovke je jedno plné tlačidlo. Keď sa otvorí úloha (Pridať blok, Prideliť kurz, potvrdenie), plné tlačidlo má úloha a tlačidlo, ktoré ju otvorilo, zmizne.

| Obrazovka | Plné tlačidlo |
| --- | --- |
| Časti (koreň kurzu) | stavový krok v karte stavu: Zverejniť verziu N / Nová verzia / Obnoviť ako novú verziu |
| Detail časti | „Pridať blok ▾" v `.page-head` (ponuka typov) |
| Detail časti s `?add=` | „Pridať blok" na konci formulára |
| Úprava bloku `?editBlock=` | „Uložiť blok" |
| Nastavenia | „Uložiť" |
| Zapísaní | „Prideliť kurz"; s `?assign=1` „Prideliť N ľuďom" |
| Potvrdenie `?archive=1`, `?removePart=1` | červené „Archivovať kurz" / „Odstrániť časť" |

## Zmeny po obrazovkách

### Všetky podstránky
- **Karta stavu len na koreni** (`/learning/manage/[courseKey]`). Na detaile časti, v Nastaveniach a Zapísaných sa v hlavičke kurzu (`.ch-facts`) zobrazí len štítok stavu ako odkaz na koreň: „Koncept v3 · pripravený na zverejnenie ›" (`--ok`), „Koncept v3 · 2 veci chýbajú ›" (`--warn`), „Zverejnené v2", „Archív". (Q1)

### Časti
- Riadok časti je odkaz na celý riadok (číslo · názov · štítok Povinná/Nepovinná · „6 blokov · 1 test" · ›). ↑ ↓ ostávajú vpravo ako samostatné formuláre. Odkaz „Upraviť"/„Zobraziť" sa ruší.
- „Nová časť": `.form-group` (pole názvu, prepínač Povinná). „Pridať časť" je tiché tlačidlo pod kartou.
- Karta stavu, koncept: „Zverejniť verziu N" (plné), **„Náhľad ako študent"** (tiché, nové; Q2), „Uložené …".
- Karta stavu, zverejnený: „Nová verzia" (plné), „Náhľad ako študent" (tiché), **„Archivovať…"** (tiché, červený text) → `?archive=1`.

### Detail časti
- „← Všetky časti" (`.mc-back`) sa ruší; kurz je v ceste. Bočný zoznam častí od 1024 px ostáva.
- Riadok nad blokmi: nadpis časti „2 · Hasiace prístroje" + vpravo **„Pridať blok ▾"** = `<details>` s odkazmi `?add=text#add`, `image`, `gallery`, `document`, `video`. Funguje bez JS (SwiftUI `Menu` v `toolbar`).
- Formulár nového bloku má v nadpise typ („Nový blok · Video"). Pilulky typu (`.lpills`) sa rušia.
- Video: zdroj ako `.choice-row` (radio `source=upload|external`). Zóna nahrávania alebo pole URL je pod zvoleným riadkom a prepína ho CSS `:has(input:checked)`, takže netreba JS ani `?src=`. Bez podpory `:has` sú viditeľné obe polia a server použije to, ktoré zodpovedá zvolenému `source`. Priebeh nahrávania ostáva v modálnom okne (`.upload-overlay`, rozhodnutie 23. 9.).
- Riadok bloku: typ · súhrn · ↑ ↓ · ›. Celý riadok vedie na `?editBlock=`. „Upraviť" a „Odstrániť" z riadku preč. (Q3)
- Úprava bloku: „Uložiť blok" (plné), „Zrušiť" (tiché), pod čiarou „Odstrániť blok" (červený text) + veta „Blok zmizne z konceptu vN. Verzia N−1 sa nemení."
- Testy časti: jeden formulár. Riadok = názov · údaje · odkaz „Odobrať" (`<button formaction={removePartTestAction} name="testKey">`) · prepínač **Povinný** (`.toggle`, `name="required:<testKey>"`). Riadok „Vybrať test…" + „Priradiť test" (tiché, `formaction={addPartTestAction}`). Pod kartou „Uložiť testy" (tiché).
- Údaje časti (Názov, Zhrnutie, Povinná, Odhad času) sú v `.form-group` „Časť" pod blokmi a testami. „Uložiť časť" je tiché.
- „Odstrániť časť…" je na konci stránky (tiché, červený text) a otvorí potvrdenie `?removePart=1`: „Odstrániť časť „Hasiace prístroje" so 6 blokmi a 1 testom?"

### Zapísaní
- Pri `?assign=1` sa „Prideliť kurz" v riadku prepínača nekreslí. „Export CSV" ostáva.

### Potvrdenie (archivácia, odstránenie časti)
- Server ho vykreslí pri `?archive=1` / `?removePart=1`. Pod 640 px je to plachta zdola, od 640 px okno v strede. Pod ním je stránka stlmená.
- Obsah archivácie: „Nikto nový sa nezapíše, kurz zmizne z ponuky." · „3 rozpracovaní ho dokončia vo verzii 2." · „Certifikáty a výsledky ostávajú." · „Kurz sa dá neskôr obnoviť ako nová verzia." Tlačidlá: „Archivovať kurz" (plné `--bad-fg`) a „Zrušiť" (odkaz bez parametra).
- Akcia ostáva `archiveAction` / `removePartAction`, len sa volá z potvrdenia.

## SwiftUI

| SwiftUI | Tu |
| --- | --- |
| `toolbar` + `Menu` | „Pridať blok ▾" v `.page-head` |
| `NavigationLink` v `List` | riadok časti, riadok bloku (›) |
| `Picker(.inline)` | zdroj videa (`.choice-row`) |
| `Toggle` | Povinná časť, Povinný test, Povinné dopozeranie |
| `Button(role: .destructive)` | Odstrániť blok / časť, Archivovať |
| `.confirmationDialog` / `.sheet` | potvrdenie archivácie a odstránenia |

## Rozhodnutia v repozitári — dodržané

- Karta stavu ako karta postupu znenia (`.flow`, `KNIZNICA-postup-znenia`, PR #113–#123): stavové tlačidlá ostávajú v jej päte, **nepresúvajú sa** do `.page-head` (Q5).
- Poradie ↑ ↓ ako formuláre bez JS (`TreeWithOrder`) — ostáva.
- Meniť sa dá len koncept (D118) — bez zmeny.
- Podstránky majú vlastné adresy (R3, `lib/learningPaths.ts`) — bez zmeny. Nové parametre `?archive=1`, `?removePart=1` sú stav úlohy na tej istej adrese (ako `?assign=1`, `?revoke=`).
- Priebeh nahrávania = modálne okno (Ján, 23. 9.) — bez zmeny.

## Rámy

- **1440**: Časti (koncept pripravený) · Detail časti s otvorenou ponukou „Pridať blok".
- **834**: Časti.
- **390**: Pridať blok · Video · Úprava bloku s „Odstrániť blok" · Zverejnený → Archivovať (plachta, tmavá téma).

## Údaje, ktoré v modeli neexistujú

- **Náhľad ako študent**: v kóde nie je trasa ani režim. Návrh: `/learning/[courseKey]?preview=v3`, len pre `learning-admin`, len na čítanie. Nezapisuje zápis ani priebeh, test sa nedá odoslať (Q2).
- Formulár testov časti pošle všetky prepínače naraz (`required:<testKey>`). Treba novú akciu `savePartTestsAction` alebo rozšíriť `partTestRequiredAction` na viac testov.
- Ostatné (počet rozpracovaných, počet blokov a testov časti) sa dá odvodiť z existujúcich údajov.

## Rozhodnuté (7. 10. 2026 — všetky podľa odporúčania)

- **Q1** Karta stavu len na koreni kurzu, na podstránkach štítok stavu.
- **Q2** „Náhľad ako študent" = `/learning/[courseKey]?preview=vN`, len na čítanie, bez zápisu a priebehu.
- **Q3** Odstránenie bloku len v úprave bloku.
- **Q4** Archivácia kurzu a odstránenie časti s potvrdením (`?archive=1`, `?removePart=1`).
- **Q5** Stavové tlačidlá ostávajú v päte karty stavu.

## Otázky

Žiadne otvorené.

<!-- pôvodné znenie otázok:
- **Q1** — Kartu stavu zobraziť len na koreni kurzu a na podstránkach nechať štítok stavu?
  **Odporúčam áno.** Inak sú v Nastaveniach a na detaile časti dve plné tlačidlá a karta s kontrolami zaberá pol obrazovky nad prácou, ktorá s ňou nesúvisí.
- **Q2** — „Náhľad ako študent" (je v ráme z 27. 9., v kóde chýba): režim `/learning/[courseKey]?preview=vN` len na čítanie?
  **Odporúčam áno.** Správca pred zverejnením uvidí presne to, čo študent, a nevznikne mu falošný zápis ani priebeh.
- **Q3** — Odstránenie bloku presunúť z riadku do úpravy bloku?
  **Odporúčam áno.** Riadok na 390 px s ↑ ↓ Upraviť Odstrániť je preplnený a zlým ťuknutím sa dá blok zmazať bez potvrdenia. V úprave je to zámerný krok.
- **Q4** — Archiváciu kurzu a odstránenie časti potvrdzovať (`?archive=1`, `?removePart=1`)?
  **Odporúčam áno.** Archivácia zastaví zápis všetkým a dnes ju spustí jedno kliknutie vedľa „Nová verzia". Pri časti sa s ňou stratia všetky bloky.
- **Q5** — Stavové tlačidlá nechať v päte karty stavu (rozhodnutie z `KNIZNICA-postup-znenia`), nie v `.page-head`?
  **Odporúčam nechať v karte.** Je to rozhodnutý vzor a pri vypnutom „Zverejniť" je vedľa neho vidno, čo chýba.

-->

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/MANAGE-COURSE-akcie.html + .md.
Vetva design/manage-course-akcie z main. Súbory: app/src/app/learning/manage/[courseKey]/page.tsx, actions.ts, globals.css, i18n.

Pravidlo: jedno plné tlačidlo na obrazovke; otvorená úloha (?add=, ?assign=1,
?archive=1, ?removePart=1) prevezme plné tlačidlo a tlačidlo, ktoré ju otvorilo, zmizne.

1. StatusCard len na koreni kurzu (tab parts bez part). Na podstránkach v .ch-facts
   štítok stavu ako odkaz na coursePath(key) (ok/warn podľa publishProblems).
2. Karta stavu: + „Náhľad ako študent" (button--quiet) → /learning/[key]?preview=vN
   (len learning-admin, na čítanie, bez zápisu priebehu). Zverejnený: „Archivovať…"
   → ?archive=1 (červený text).
3. PartList: riadok = Link na partPath (celý riadok, ›), ↑↓ ostávajú; „Pridať časť" quiet.
4. PartDetail: zrušiť .mc-back. Nadpis časti + „Pridať blok ▾" (<details>, odkazy
   ?add=<typ>#add) v .page-head; pri ?add= ho nekresliť. .lpills typu preč, typ v nadpise
   formulára. Zdroj videa = .choice-row radio source=upload|external, polia pod riadkom
   cez :has(:checked); ?src= zrušiť. „Pridať blok" vo formulári plné, „Zrušiť" quiet odkaz.
5. Riadok bloku: Link na ?editBlock= (›) + ↑↓. Úprava bloku: „Uložiť blok" plné, „Zrušiť",
   pod čiarou „Odstrániť blok" (removeBlockAction, červený text) + veta o verzii.
6. Testy časti: jeden form; .toggle Povinný na riadok (required:<testKey>), „Odobrať"
   a „Priradiť test" cez formaction; „Uložiť testy" quiet → nová savePartTestsAction.
7. Údaje časti do .form-group „Časť" pod testy, „Uložiť časť" quiet. „Odstrániť časť…"
   na konci stránky → ?removePart=1.
8. Potvrdenie: serverom vykreslená plachta (<640 zdola, inak v strede) pre ?archive=1
   a ?removePart=1; texty podľa .md; plné červené tlačidlo volá archiveAction /
   removePartAction, „Zrušiť" = odkaz bez parametra.
9. Zapísaní: pri ?assign=1 nekresliť „Prideliť kurz".
10. i18n sk/cs/en pre nové texty.

Bez JS musí fungovať všetko (menu = <details>, potvrdenie = adresa). Over 390/834/1440,
svetlá aj tmavá; tsc, eslint, vitest, build. Komentáre: odkaz na MANAGE-COURSE-akcie (7. 10. 2026).
```
