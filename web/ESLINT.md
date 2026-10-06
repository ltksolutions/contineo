# ESLint vo `web/`

Konfigurácia je **plochá** (`eslint.config.mjs`, ESLint 9), rovnaká ako
v `app/`. Volá sa `eslint .`, nie `next lint` — ten príkaz v Next 16 už
neexistuje.

Do 22. 9. 2026 tu bola klasická konfigurácia (`.eslintrc.json` + `next lint`)
a tento dokument vysvetľoval, prečo sa polovice repozitára líšia: `web/` bežal
na Next 14 a `eslint-config-next@14` plochý tvar nemal. Povýšením `web/` na
Next 16 ten dôvod zanikol a rozdiel s ním.

## Vypnuté pravidlá

**`react/no-unescaped-entities`** — apostrofy a úvodzovky v slovenskom,
českom aj anglickom texte sú bežné a escapovať ich v JSX by z marketingových
textov spravilo nečitateľnú kašu. Na webe v troch jazykoch je to šum,
nie nález.

## Čo sa nekontroluje

`public/` (obrázky a diagramy). `scripts/` sa kontroluje — od 6. 10. 2026 je
tam `diagram.mjs` (kontrola zhody troch SVG a PNG), Python generátor
`gen_diagram.py` je zmazaný.
