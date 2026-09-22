# ESLint vo `web/`

Konfigurácia je **klasická** (`.eslintrc.json` + `next lint`), nie plochá ako
v `app/`. Nie je to rozmar, je to dôsledok verzií:

| | Next | ESLint | konfigurácia | príkaz |
| --- | --- | --- | --- | --- |
| `app/` (intranet) | 16 | 9 | `eslint.config.mjs` (plochá) | `eslint .` |
| `web/` (marketing) | 14 | 8 | `.eslintrc.json` | `next lint` |

`eslint-config-next@14` plochý tvar nemá a `next lint` v Next 16 už neexistuje —
každá polovica teda musí ísť cestou svojej verzie. **Pri povýšení `web/` na
Next 16 sa toto zlúči** do plochého tvaru presne ako v `app/`; dovtedy sú to
dve konfigurácie, o ktorých sa vie.

## Vypnuté pravidlá

**`react/no-unescaped-entities`** — apostrofy a úvodzovky v slovenskom
a českom texte sú bežné a escapovať ich v JSX by z textov spravilo
neči­tateľnú kašu. Na webe v troch jazykoch je to šum, nie nález.

## Čo sa nekontroluje

`public/` (generované obrázky a diagramy) a `scripts/` (`gen_diagram.py` je
Python, nie JavaScript).
