# Devlog — Contineo

> Denník práce. **Nie je to `CHANGELOG.md`.** Changelog hovorí, *čo sa zmenilo*
> a je písaný pre toho, kto sa na projekt pozrie o rok. Devlog hovorí, *ako to
> šlo* — čo sa rozhodlo a prečo, čo nevyšlo, čo stálo čas a čo by som nabudúce
> urobil inak. Zápis vzniká na konci pracovného dňa.
>
> Založené 2026-09-15. Staršie dni zapísané nie sú; ich stopa je v `CHANGELOG.md`
> a v `git log`.

---

## 2026-09-15 — meranie kvality: von so zlatou sadou, dnu s prevádzkou

**Commity:** `75a494d`, `98af0a8`, `e38eec8`, `b556a00`, `29285f5`, `0533101`,
`3abeae5`, `7b90ac4`. Deň mal jednu líniu: reťaz *bežný človek → hodnotiteľ →
overená odpoveď v znalostiach*.

### Rozhodnutia (Ján Letko)

- **Zlatá sada von, celá.** Nie odložiť, nie zmenšiť — zrušiť. Dva mesiace bez
  jediného posudku sú odpoveď. `docs/ADR-008-zrusenie-zlatej-sady.md`.
- **Rola `evaluator`.** Bežný človek povie „sedí / nesedí" a čo mu vadilo;
  posudok potvrdzuje a opravuje hodnotiteľ. Identifikátor po anglicky,
  preklady SK/CZ/EN.
- **Kurácia ako stav na zázname** (varianta A), nie nová kolekcia.
- **„Únik cez `accessLevel` nikdy nesmie nastať."** Táto veta určila návrh
  celej kurácie viac než čokoľvek iné.
- **Štítok „overená odpoveď"** v zozname zdrojov.
- **Premenovať `spravca-obsahu` → `content-admin`.**

### Čo nevyšlo a čo sa z toho dá vziať

**Založil som kolekciu `answer_reports`, ktorá duplikovala `evaluations`.**
Najdrahšia chyba dňa a celá moja. Hlásenie nepresnosti *je* pole existujúceho
záznamu o odpovedi — otázka aj odpoveď už v ňom sú. Opravené v `75a494d`,
kolekcia zahodená. Poučenie je krátke: **pred novou kolekciou sa pozrieť, čo
už existuje**, nie navrhovať od nuly.

**Vercel 86 minút nenasadil `98af0a8`.** Diagnostika po vrstvách, nie hádanie:
projekt nie je pozastavený (`paused: null`), väzba na git drží
(`productionBranch: main`, sedí `repoId`), `commandForIgnoringBuildStep` nie je
nastavený, konto aktívne. Rozhodol až pohľad do GitHubu: `main` na správnom
SHA, ale **0 commit statuses** oproti štyrom pri predchádzajúcom commite —
teda Vercel sa o pushi nikdy nedozvedel. Stratené doručenie webhooku GitHub
App. Riešené vytvorením nasadenia cez API (`POST /v13/deployments` s
`gitSource`). Ďalšie dva pushe sa nasadili samy, takže to bol jednorazový
výpadok. **Nabudúce:** ak nasadenie nenabehne do pár minút, ísť rovno na
commit statuses v GitHube; to je najkratšia cesta k rozlíšeniu „Vercel to
nevzal" od „Vercel to nedostal".

**Skript na úpravu `i18n.ts` prestrelil koniec skupiny.** Typový blok sa
zatvára `  }` bez čiarky, hľadalo sa `  },` — tak zmizli aj `admin`, `org`,
`people` a `errors`. Chytil to `tsc` (~30 chýb), nie oko. `git checkout --` a
skript prepísať tak, aby uznal oba tvary.

**Slovenské úvodzovky mi dvakrát ukončili reťazec.** `„Nesedí"` — zatvárací
znak je `“`, nie `"`. TS1002/TS1005. Pri generovaní TSX z Pythonu je to pasca,
do ktorej sa dá spadnúť opakovane.

**Skoro som odstránil `preset`.** Vyzeralo to ako zvyšok po zlatej sade; v
skutočnosti je to odovzdanie otázky z hlavičky na `/ask?q=`. Chytil `tsc`.
Doplnený komentár, nech to nabudúce nevyzerá ako sirota.

**`.next/types/validator.ts` sa odvolával na zmazanú routu.** Typová kontrola
padala na súbore, ktorý sa generuje. `rm -rf .next/types` pred každým `tsc`.

**Git na Macu si vypýtal licenciu Xcode** uprostred práce. Dočasne
`/Library/Developer/CommandLineTools/usr/bin/git`, potom to Ján vyriešil
natrvalo (`xcodebuild -license`).

### Nález, ktorý stál za celý deň

Pri štítku sa ukázalo, že **`saveMetadata()` prepisoval `accessLevel` na
všetkých úsekoch dokumentu vrátane kurovaných párov**. Pár odvodený z troch
predpisov by prevzal úroveň jedného z nich — stačilo prepnúť ten jeden na
verejný. Nenašlo sa to premýšľaním o kurácii, ale čítaním všetkých ciest
zápisu do knižnice. Odvtedy je v hlavičke `lib/curation.ts` napísané, čo každá
z nich s párom robí, aby sa to pri štvrtej ceste (RSS, e-mail, ISSF) nemuselo
objavovať znova.

### Vedomé obmedzenie

`buildSources()` doteraz neniesol `chunkId`, takže **odpovede spred dneška sa
kurovať nedajú** — nedá sa spätne povedať, z ktorých úsekov vznikli, a úroveň
prístupu by bola odhad. Radšej nič než pár, ktorého úroveň je odhad.

### Stav na konci dňa

`main` nasadený na `intranet.futbalsfz.sk`, `npm run check` bez nálezu, 1318
testov zelených, `eslint` 0 errors. Overované na produkcii, nie na dôvere:
čitateľova cesta („nesedí" + poznámka → fronta), posudok hodnotiteľa
(`evaluatedAt`/`evaluatedBy` v databáze, položka z fronty zmizne), kurácia
(pripraviť → zverejniť → štítok v živej odpovedi → archivovať) aj premenovanie
roly (pred migráciou, po nej a po odstránení prechodu).

**Otvorené** je v `docs/TODO.md` — tlmenie páru v poradí (spúšťač: po prvých
desiatich pároch), štvrtá cesta zápisu, brána pred go-live nad rámec tvrdého
prahu na únik, retencia `evaluations` a zmienka o „eval sade D9" na verejnom
webe.
