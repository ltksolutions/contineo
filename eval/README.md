# eval/ — zlatá sada D9

Meranie kvality vyhľadávania pred go-live a pri porovnávaní modelov.
Popis, matica pokrytia a prahy: **`docs/D9_EVAL_zlata_sada.md`**.

## Súbory

| Súbor | Načo je |
|---|---|
| `D9_zlata_sada.xlsx` | **hárok pre legislatívca** — toto sa posiela na vyplnenie |
| `seed/questions_seed.json` | 74 návrhov otázok bez odpovedí (zdroj pre generovanie hárku) |
| `build_sheet.py` | vygeneruje XLSX zo seedu — spustiť po zmene otázok |
| `sheet_to_json.py` | vyplnený XLSX → JSON pre runner; berie len riadky so stavom `hotovo` |
| `run_eval.py` | prejde sadu cez `/api/chat`, spočíta metriky proti prahom |
| `test_scoring.py` | testy vyhodnocovacej logiky, bez potreby servera |
| `vysledky/` | výstupy behov (`.json`) a hárky na ľudské hodnotenie (`.csv`) |

## Rýchly štart

```bash
# hárok je vyplnený -> previesť na JSON
python3 sheet_to_json.py

# zmerať jednu konfiguráciu
python3 run_eval.py --url http://localhost:3000 --label "cloud Claude Sonnet 5"

# porovnať s druhou (ADR-001)
python3 run_eval.py --url http://localhost:3000 --label "on-prem Qwen3-8B"

# skúšobný beh na 5 otázkach
python3 run_eval.py --limit 5 --label skuska

# testy
python3 test_scoring.py
```

## Dve veci, ktoré treba vedieť

**Správnosť a halucinácie skript nemeria.** Vyžadujú úsudok, nie porovnanie reťazcov. Runner preto vypíše `vysledky/<label>_hodnotenie.csv` s prázdnymi stĺpcami `spravna_0_1` a `halucinacia_0_1` — vyhodnotenie je úplné až po ich doplnení.

**Únik dát je tvrdá brána.** Jediný výskyt interného obsahu vo verejnej odpovedi znamená neúspech bez ohľadu na ostatné metriky.

## Závislosti

`openpyxl` (generovanie a čítanie hárku). Runner používa iba štandardnú knižnicu.
