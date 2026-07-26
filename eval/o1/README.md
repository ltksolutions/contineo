# O1 — zhoda vektorových priestorov

Odpovedá na otvorenú otázku **O1** z `docs/ADR-001-provider-adaptery.md`.

**GPU netreba.** `voyage-4-nano` má 340M parametrov a beží na CPU aj na Apple Silicon (MPS). Pri fp32 na CPU je výsledok tohto merania dokonca presnejší než pri bf16 na GPU.

## Otázka

Cloud embedduje cez `voyage-4` v Atlase (1024 dim). On-prem by embedoval lokálne cez `voyage-4-nano` — ten dáva natívne **2048 dim**, takže by sa musel MRL-skrátiť na 1024.

Voyage tvrdí, že modely rodiny voyage-4 zdieľajú vektorový priestor. **Platí to aj po skrátení?** Ak áno, migrácia cloud ↔ on-prem nevyžaduje prepočet korpusu. Ak nie, každý presun tenanta je re-embed všetkého.

## Prečo sa nemeria kosínusová podobnosť

Surová podobnosť medzi vektormi dvoch rôznych modelov pre ten istý text je len diagnostika — nízke číslo ešte nič neznamená.

Rozhodujúce je, či sa zhoduje **poradie výsledkov**. Skript preto meria **krížový retrieval**: index postavený z `voyage-4`, dotaz raz embedovaný `voyage-4`, raz `voyage-4-nano`. To presne zodpovedá reálnemu scenáru — index máte z Atlasu, dotaz by prišiel z lokálneho modelu.

## Spustenie

```bash
cd eval/o1
pip install -r requirements.txt
export VOYAGE_API_KEY='pa-...'
python3 o1_vektorovy_priestor.py
```

**Verzie sú pripnuté zámerne.** `transformers` musí byť z vetvy 4.x — vlastný kód modelu `voyage-4-nano` nenastavuje `config_class`, čo vetva 5.x vyžaduje a padne na `AttributeError`. Skript to kontroluje ešte pred sťahovaním modelu.

Prvý beh stiahne model (~700 MB). Celé meranie trvá pár minút.

| Prepínač | Význam |
|---|---|
| `--dim 1024` | cieľová dimenzia (default 1024, podľa Atlas indexu) |
| `--k 5` | veľkosť top-k pri porovnaní poradia |
| `--vzorka x.json` | vlastný korpus `{"dokumenty": [...], "dotazy": [...]}` |
| `--bez-lokalneho` | len Voyage API — na overenie kľúča a prístupu |

**Odporúčam najprv** `--bez-lokalneho`, aby si overil kľúč predtým, než sa začne sťahovať model.

## Metriky a prahy

| Metrika | Čo hovorí | Prah |
|---|---|---|
| prekryv top-k | podiel spoločných dokumentov v prvých k | ≥ 90 % |
| Spearman poradia | zhoda celkového poradia | ≥ 0,90 |
| zhoda 1. výsledku | ako často sedí najlepší nález | ≥ 90 % |

Skript vypíše aj **referenčný riadok** — nano @ 2048 vs nano @ 1024. Ten izoluje vplyv samotného MRL skrátenia od rozdielu medzi modelmi. Ak už referencia neprejde, problém je v skrátení, nie v zdieľanom priestore.

## Ako čítať výsledok

**GO** → migrácia bez re-embedu je bezpečná, `voyage-4-nano` s `dim: 1024` môže ísť do profilu tenanta.

**NO-GO** → tri možnosti, v poradí podľa ceny:

1. zjednotiť oba režimy na natívnych 2048 dim (mení sa Atlas index)
2. prijať úplný re-embed pri migrácii (`app/scripts/reembed.mjs`)
3. použiť on-prem iný model (BGE-M3) a rátať s re-embedom vždy

## Súbory

| Súbor | Načo je |
|---|---|
| `o1_vektorovy_priestor.py` | samotné meranie |
| `metriky.py` | výpočty, bez závislostí — oddelené, aby sa dali testovať |
| `test_metriky.py` | 26 testov metrík, bez siete a modelov |
| `vzorka.json` | 40 slovenských dokumentov + 15 dotazov v štýle futbalových noriem |
| `vysledok_o1.json` | výstup behu (vzniká až po spustení) |

## Poznámka k prompt asymetrii

`voyage-4-nano` používa iné prompty pre dotaz a pre dokument (`encode_query` vs `encode_document`), rovnako ako Voyage API cez `input_type`. Skript to rešpektuje — bez toho by porovnanie nebolo férové a výsledok by vyšiel falošne zle.
