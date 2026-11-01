# Stav 2026-09-27 (večer) — import osôb SFZ, ADR-019, ADR-020

## Hotové a nasadené (main, produkcia READY)

- **Import 153 osôb SFZ prebehol** (hárok „Na import do contineo" z `2026-licencie.xlsx`, 2. verzia). CSV `sfz-osoby-import.csv` v priečinku *Samouciaci system Helpdesku*: Meno, Priezvisko, Email, Pozicia (= Title + Department z M365). Oddelenie zámerne vynechané — je to číselník, zaradenie do štruktúry ručne. Vyhodené: tri technické/cudzie adresy ([e-maily maskované]) a technické kontá z hárku „Vynechané". Ján sám v exporte nie je (iný typ licencie) — vie o tom.
- **ADR-019** (D124–D126): existujúcim osobám import dopĺňa len prázdne polia (ako `fillMissing` z Entra); prepis je výslovný prepínač „Aktualizovať existujúcich" / `--prepisat`. `undefined` sa do `$set` nedostane (predtým `department`/`startDate` → `null`).
- **Náhľad importu ako tabuľka** (PR #148): stav (Nová / Doplní sa / Zmení sa / Bez zmeny / Chyba), osoba, „čo sa zapíše" dnes → po; filtre cez čísla; hľadanie v mene/adrese (PR #151); karty pod 640 px. Náhľad aj zápis idú cez jednu `planChanges()` v `lib/persons.ts`; `previewImport(rows, mode)` vracia `RowPlan[]`, jeden `$in` dotaz. Zápis na obrazovke len bez chybných riadkov.
- Skript `import_persons.mjs` opravený (staré názvy po premenovaní), `--org=KOD`, `--prepisat`.
- **ADR-020** (D127–D129): každá súbežná session vo vlastnom `git worktree` v `.worktrees/<nazov>` (`.git/info/exclude`), `npm ci` (Turbopack odmieta symlink `node_modules`), `.env.local` kópiou; po zlúčení odstrániť s vetvou; konflikty v `globals.css`/`i18n.ts` = ponechať oboje + skontrolovať zátvorky.
- `CLAUDE.md`: sekcia „Dve sessions v jednom repozitári = dve vetvy" + odkaz na ADR-020. Globálne pre všetky repá na Macu: `~/.claude/CLAUDE.md` (nový). Šablóna `~/Downloads/CLAUDE-template.md` doplnená (záloha `.bak`).

## Poučenia dňa

- `12d7f3b` (PR #145, druhá session) zobral cez `git add -A` rozrobenú prácu tejto session + pomocný `_i18n-mine.patch` (odstránený v `9abf46a`). Preto ADR-020.
- Z Cowork VM sa Atlas nedosiahne (SRV); DB náhľad, testy, build cez Control your Mac. `do shell script` má časový strop — dlhé behy cez `nohup` + log.
- Timeouty 5 s v stránkových testoch pri súbežnom builde nie sú chyby kódu — opakovať samostatne.

## Otvorené

- 3 existujúce osoby dostali doplnenú pozíciu; zaradenie 153 ľudí do oddelení (strom) je ručná práca — čaká.
- `Tenant.phonePrefix` stále bez obrazovky; pracoviská v číselníku SFZ prázdne (od D85).
- Rozhodnúť, či `@sfzmarketing.sk` (22 ľudí) zostanú v tenante SFZ ako `employee` — importované tak.
- NEXT.md neaktualizovaný (mení sa len pri „Poupratuj").
