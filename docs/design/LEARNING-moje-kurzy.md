# LEARNING — Vzdelávanie · Moje kurzy (`/learning`)

Referencia: `LEARNING-moje-kurzy.html`. Základ: `ZAKLAD.md`. Zdroj zadania: `docs/design/LEARNING-zadanie.md` (a6c7ddc), rám 1 z 9. Model: ADR-018 (D117–D123).

## Čo sa mení

Nová obrazovka `/learning` pre bežnú osobu (modul zapnutý `Tenant.modules.learning`, inak `notFound()`). Nový komponent **karta kurzu**. Nová položka navigácie „Vzdelávanie".

## Obrazovka

- Hlavička: `.page-title` „Vzdelávanie" + `.page-lead` (na telefóne bez lead).
- **Tri skupiny v tomto poradí**: Rozpracované → Na zápis → Dokončené. Nadpis `h2` + počet v `--muted`. Prázdna skupina sa nekreslí (ani nadpis).
- **Na zápis** = najprv pridelené nezačaté (zápis existuje, žiadna udalosť postupu), potom otvorené kurzy (`openEnrollment`), do ktorých človek zapísaný nie je.
- **Dokončené** = kurz hotový podľa D119 (všetky povinné časti hotové) — zoradené podľa dátumu dokončenia, najnovšie prvé. Nad 6 kartami `.pager` (ZAKLAD, úloha 2).
- Mriežka kariet: `repeat(auto-fill, minmax(290px, 1fr))`, gap 12 → 1 stĺpec 390, 2 stĺpce 834, 3 stĺpce 1440.

## Karta kurzu (nový komponent `CourseCard`)

| Časť | Obsah |
| --- | --- |
| Horný riadok | téma (12 px, 600, `--muted`, elipsa) · stavová pilulka zápisu vpravo |
| Názov | 16 px / 650, odkaz na `/learning/[courseKey]` |
| smart:tagy | `.stag` „Kľúč: Hodnota" — kľúč `--muted`, pozadie `--surface-2`, r6, 24 px; odkaz na filter; zvolený `is-on` (`--accent-soft` + 1 px `--accent` inset) |
| Meta | odhad času slovom („približne 40 minút"), počet častí („7 častí, z toho 6 povinných"), „certifikát" ak kurz vydáva |
| Postup | len Rozpracovaný: „3 z 5 povinných častí" + pás 6 px v `--accent` |
| Akcia | za čiarou `--line`; na 390 tlačidlo na celú šírku, 44 px |

Stavy:

| Stav zápisu | Pilulka | Akcia | Veta vedľa |
| --- | --- | --- | --- |
| Rozpracovaný | `.tag--review` | `.button` „Pokračovať" → prvá nehotová povinná časť | „Ďalej: Časť 4 · Evakuácia budovy" |
| Pridelený | `.tag--draft` | `.button` „Začať" → prehľad kurzu | „Pridelené 22. 9. 2026 · {kto}" |
| Otvorený na zápis | `.tag` | `.button--quiet` „Zapísať sa" — `<form method="post">` | „Kurz je otvorený — zapísať sa môže ktokoľvek v organizácii." |
| Dokončený + certifikát | `.tag--published` | odkaz „Certifikát" → `/learning/[courseKey]/certificate` | číslo certifikátu |
| Dokončený bez certifikátu | `.tag--published` | odkaz „Otvoriť kurz" | „Kurz nevydáva certifikát." |

„Ďalej: …" a postup sa **odvodzujú** (D119) — v databáze nie je „aktuálna časť".

## Filter

- Stav nesie adresa: `?topic=` (jedna hodnota) a `?tag=Kľúč:Hodnota` (opakovateľné). Bez JS.
- **1440**: ľavý stĺpec 232 px — Téma (`.facet` bez políčka, jedna hodnota), potom skupina na každý kľúč smart:tagu (`.facet` s políčkom), veta o AND/OR.
- **834 / 390**: pilulky tém (`.pill`, na 390 posun do strany, 44 px) + `<details>` „smart:tagy" (otvorené, keď je niečo zvolené), hodnoty ako `.stag`.
- Zvolené tagy nad zoznamom: `.library-chip` s × + „Zrušiť filtre".
- Rôzne kľúče = AND, rovnaký kľúč = OR (D117). Počty = kurzy viditeľné tejto osobe.
- Filter sa uplatní na všetky tri skupiny naraz.

## Prázdne stavy

- **Nič pridelené, nič otvorené**: `.empty` „Zatiaľ tu nemáte žiadny kurz" / „Keď vám organizácia pridelí kurz alebo otvorí kurz na zápis, uvidíte ho tu. Nič netreba robiť." Bez akcie, bez filtra.
- **Len dokončené**: kompaktný `.empty` (padding 18/16) „Nič nečaká" nad skupinou Dokončené.
- **Filtru nič nevyhovuje**: `.empty` s vetou, ktorá menuje zvolené hodnoty, + `.button--quiet` „Zrušiť filtre".

## Rámy

- **390**: bežný · filter · filtru nič nevyhovuje · prázdny · len dokončené · tmavá téma.
- **834**: bežný.
- **1440**: bežný · filter · prázdny.

## Navigácia

- `NavKey` + `"learning"`, `href: "/learning"`, pre každého pri zapnutom module (za „Adresár").
- Spodná lišta bežnej osoby: Prehľad · Opýtať sa · **Vzdelávanie** · Úlohy · Viac (Q1 ✅). V `tabbarItems()`: `learning` sa pridá na tretiu pozíciu len vtedy, keď v zozname nie je `library`; inak ide do `MORE_GROUPS.organisation`.

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

| Čo | Kde |
| --- | --- |
| AppShell (hlavička, pás, bočný panel, spodná lišta) | `AppNav.tsx`, `lib/appNav.ts` |
| `.card`, `.tag--*`, `.button`, `.button--quiet`, `.empty`, `.pager`, `.pill`, `.facet`, `.library-chip` | `globals.css` |
| `.page-title`, `.page-lead`, `.page-head` | `globals.css` |
| Notice, Skeleton | komponenty |
| Filter cez adresu | `normalizeQuery`, `toQuery` |
| KeyFromLabel, ResponsiblePicker, TreeWithOrder, FormattedText, UploadFiles | na tejto obrazovke sa nepoužívajú |

Nové: `CourseCard`, `.stag` (pilulka smart:tagu — použijú ju aj ďalšie rámy), `.lc-*` triedy karty.

## Údaje, ktoré v modeli zatiaľ nie sú

Modul je v repozitári len ako rozhodnutie (ADR-018) — kolekcie `courses`, `enrollments`, `part_completions` ešte nie sú. Obrazovka potrebuje:
- `course.estimatedMinutes`, `course.issuesCertificate`, `course.openEnrollment`, `course.topicId`, `course.smartTags[]`
- `enrollment.source` (`assignment` | `self`) a kto pridelil (na vetu „Pridelené … · Oddelenie ľudských zdrojov")
- dátum dokončenia kurzu = dátum poslednej udalosti, ktorá ho dokončila (odvodené, nie uložené)
- `certificate.registrationNumber`

## Rozhodnutia Jána 27. 9. 2026

- **Q1 ✅** Bežná osoba: „Vzdelávanie“ je na spodnej lište na 3. pozícii (Prehľad · Opýtať sa · Vzdelávanie · Úlohy · Viac). Správca obsahu (lišta plná) ho má pod „Viac“ v skupine Organizácia.
- **Q2 ✅** Archivovaný kurz, ktorý človek ešte nedokončil, **ostáva v Rozpracovaných** s vetou pod metou „Kurz bol archivovaný — dokončiť ho môžete.“ (D118: dokončuje sa verzia zo zápisu). Otvorený archivovaný kurz sa v „Na zápis“ neponúka.

## Pôvodné otázky

- **Q1** — Spodná lišta: bežná osoba má dnes 4 položky (bez Knižnice). Dať „Vzdelávanie" na 3. pozíciu (návrh), alebo pod „Viac"? Správca obsahu má lištu plnú → u neho pod „Viac" (skupina Organizácia). Tá istá pozícia palca by u dvoch ľudí viedla inam — rovnaký dôvod, pre ktorý sa lišta dnes nedopĺňa.
- **Q2** — Kurz, do ktorého je človek zapísaný, sa **archivuje** pred dokončením: ostáva v Rozpracovaných (človek dokončuje svoju verziu, D118), alebo sa skryje? Návrh: ostáva, s vetou „Kurz bol archivovaný — dokončiť ho môžete."

🔴 Zmena schémy: nové kolekcie podľa ADR-018 (D123); existujúce sa nemenia.
