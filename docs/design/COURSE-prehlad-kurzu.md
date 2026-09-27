# COURSE — Prehľad kurzu (`/learning/[courseKey]`)

Referencia: `COURSE-prehlad-kurzu.html`. Základ: `ZAKLAD.md`, `LEARNING-moje-kurzy.md` (`.stag`, pás postupu). Zadanie: `docs/design/LEARNING-zadanie.md`, rám 2 z 9. Model: ADR-018.

## Čo sa mení

Nová obrazovka prehľadu kurzu pre študenta. Nový komponent **zoznam častí** (`PartList`). Nový variant hlášky `.notice--info`.

## Rozloženie

- Hlavička: „← Vzdelávanie", téma (12.5 px, `--muted`), `.page-title`, podnázov, `.stag`, fakty (odhad času, počet častí, verzia, zapísaný od).
- **1440**: dva stĺpce `minmax(0,1fr) 300px` — vľavo popis + zoznam častí, vpravo karta „Váš postup".
- **834 / 390**: jeden stĺpec, karta „Váš postup" **nad** zoznamom (`order:-1`). Na 390 je popis v `<details>` „O kurze".

## Karta „Váš postup"

- „3 z 5" (26 px) + „povinných častí" + pás 6 px `--accent`.
- `.button` na celú šírku: „Začať" (nezačatý) / „Pokračovať tu" (rozpracovaný) → prvá nehotová povinná časť; pod ním „Ďalej: Časť 4 · Evakuácia budovy".
- Dokončený: `.button--quiet` „Zobraziť certifikát" (len ak kurz vydáva certifikát).
- `.kv`: Verzia · Zapísaný od (+ „pridelením" / „samozápisom") · Jazyk obsahu · Odhad času · Certifikát · Poradie častí (postupne / ľubovoľne).

## Zoznam častí

Riadok = značka 28 px · „N. Názov" · stav vpravo; pod tým `.tag` Povinná / `.tag--archived` Nepovinná + obsah („3 bloky · povinné video 12 minút"); pod tým testy.

| Stav | Značka | Názov | Vpravo |
| --- | --- | --- | --- |
| hotová | ✓ `--ok-bg`/`--ok-fg` | odkaz | „Hotová 12. 9." v `--ok-fg` |
| rozpracovaná | číslo, prstenec 2 px `--accent` | odkaz | + v meta „rozpracovaná — video pozreté 62 %" |
| dostupná | číslo v obryse `--line` | odkaz | „Dostupná" |
| zamknutá | zámok, `--surface-2` | text `--muted`, **nie odkaz** | „Sprístupní sa po časti 4" |
| „Pokračovať tu" | — | — | `.button` namiesto stavu; riadok `--accent-soft` + `inset 3px 0 0 var(--accent)` |

- Zamknutá **len** pri kurze s poradím „postupne". Nepovinná časť poradie neblokuje a do „N z M" sa nepočíta.
- Test pri časti: „Test · názov · povinný/nepovinný · výsledok" — „nespustený" · „prešiel 85 %" (`--ok-fg`) · „neprešiel 60 % · ďalší pokus o 25 minút · zostávajú 2 z 3" (`--bad-fg`).
- Otvorený pokus (TEST-ATTEMPT Q2 ✅): „Test · názov · povinný · rozpracovaný · zostáva 12 minút · Pokračovať v teste" (`--warn-fg`). „Pokračovať tu" vedie do časti, nie do testu.
- Na 390 stav a tlačidlo idú pod názov, tlačidlo na celú šírku 44 px.

## Hlášky nad obsahom

- Dokončený: `.notice` „Kurz ste dokončili 18. 9. 2026. Certifikát SFZ-2026-0198 — zobraziť certifikát."
- Nová verzia: `.notice--info` „Kurz má novú verziu 3 (zverejnená 20. 9. 2026). Dokončujete verziu 2, do ktorej ste sa zapísali — nič netreba robiť."
- Archivovaný (LEARNING Q2 ✅): `.notice--info` „Kurz bol archivovaný — dokončiť ho môžete. Nikto nový sa doň už nezapíše."

Nový variant (do `globals.css` za `.notice--error`, tokeny existujú):

```css
.notice--info { background: var(--surface); border-color: var(--line); }
.notice--info .notice-mark { background: var(--surface-2); color: var(--ink); }
.notice--info .notice-text { color: var(--ink); }
```

## Rámy

- **390**: rozpracovaný · nezačatý · dokončený · tmavá · nová verzia · archivovaný · nezapísaný.
- **834**: rozpracovaný.
- **1440**: rozpracovaný · dokončený.

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

| Čo | Kde |
| --- | --- |
| AppShell, `.card`, `.tag--*`, `.button`, `.notice`, `.page-title` | `globals.css`, `AppNav.tsx` |
| `.kv` / meta riadky ako v detaile dokumentu | `.detail-meta-*` |
| Pás postupu | `.detail-bar` (rovnaký tvar) |
| FormattedText (popis kurzu) | komponent |
| Notice, Skeleton | komponenty |

Nové: `PartList`, `.notice--info`, `.pr-*`, `.prog-card`.

## Údaje, ktoré v modeli zatiaľ nie sú

- `course.sequential` (poradie častí postupne / ľubovoľne) — zadanie ho spomína („zamknutá len ak kurz má sekvenčné poradie"), ADR-018 nie. Pridať do verzie kurzu.
- `course.subtitle`, `course.description`, `version.publishedAt`.
- Pri časti: počet blokov a súhrn typov (odvodené z `blocks[]`), dĺžka videa (`durationSec` pri nahratí).
- Pri teste: čas ďalšieho pokusu (odvodené z posledného pokusu + pauza testu), zostávajúce pokusy.

## Rozhodnutia Jána 27. 9. 2026

- **Q1 ✅** Nezapísaný človek na otvorenom kurze vidí zoznam častí (názvy,
  povinnosť, obsah) bez odkazov.

## Otázky pre Jána

- **Q1** — Nezapísaný človek na otvorenom kurze: vidí zoznam častí (názvy, povinnosť, obsah) bez odkazov, aby vedel, do čoho sa zapisuje? Návrh: áno. Zadanie tento stav nemá.
