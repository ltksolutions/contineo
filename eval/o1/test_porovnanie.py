# -*- coding: utf-8 -*-
"""
test_porovnanie.py — testy funkcie porovnaj() zo skriptu O1.
Bez siete a bez modelov.  python3 test_porovnanie.py
"""
import importlib.util, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv = [sys.argv[0]]                      # aby argparse nezasahoval pri importe
spec = importlib.util.spec_from_file_location("o1", os.path.join(HERE, "o1_vektorovy_priestor.py"))
o1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(o1)
from metriky import normalizuj, truncate_mrl

R = []
def t(n, ok, extra=""):
    R.append((ok, n)); print(f"{'OK   ' if ok else 'CHYBA'} {n}" + ("" if ok else f"  → {extra}"))

random.seed(42)
def vek(d): return normalizuj([random.gauss(0, 1) for _ in range(d)])

docs_2048 = [vek(2048) for _ in range(20)]
qs_2048   = [vek(2048) for _ in range(6)]
docs_1024 = [truncate_mrl(v, 1024) for v in docs_2048]
qs_1024   = [truncate_mrl(v, 1024) for v in qs_2048]

# ── zhodná zostava musí dať dokonalú zhodu ───────────────────────────────
v = o1.porovnaj("identicka", docs_2048, qs_2048, docs_2048, qs_2048, 5)
t("identicka zostava -> prekryv 1.0", v["prekryv_topk"] == 1.0, str(v))
t("identicka zostava -> spearman 1.0", abs(v["spearman"] - 1.0) < 1e-9)
t("identicka zostava -> zhoda prveho 1.0", v["zhoda_prveho"] == 1.0)

# ── rôzne dimenzie v rôznych zostavách sú v poriadku ─────────────────────
try:
    v = o1.porovnaj("2048 vs 1024", docs_2048, qs_2048, docs_1024, qs_1024, 5)
    t("2048 vs 1024 nespadne (toto bola chyba)", True)
    t("2048 vs 1024 vrati metriky", all(k in v for k in ("prekryv_topk", "spearman", "zhoda_prveho")))
except ValueError as e:
    t("2048 vs 1024 nespadne (toto bola chyba)", False, str(e))

# ── nesúlad dimenzií V RÁMCI zostavy musí spadnúť zrozumiteľne ───────────
try:
    o1.porovnaj("zla zostava", docs_1024, qs_2048, docs_1024, qs_1024, 5)
    t("nesulad v ramci zostavy -> chyba", False, "nevyhodilo")
except ValueError as e:
    t("nesulad v ramci zostavy -> chyba", "zostava A" in str(e), str(e))

try:
    o1.porovnaj("zla zostava B", docs_1024, qs_1024, docs_2048, qs_1024, 5)
    t("nesulad v zostave B -> chyba", False, "nevyhodilo")
except ValueError as e:
    t("nesulad v zostave B -> chyba", "zostava B" in str(e), str(e))

# ── nezávislé dotazy musia dať nízku zhodu ───────────────────────────────
ine_qs = [vek(2048) for _ in range(6)]
v = o1.porovnaj("nezavisle", docs_2048, qs_2048, docs_2048, ine_qs, 5)
t("nezavisle dotazy -> nizky prekryv", v["prekryv_topk"] < 0.6, str(v["prekryv_topk"]))

# ── prahy ────────────────────────────────────────────────────────────────
t("prahy su definovane pre vsetky metriky",
  set(o1.PRAHY) == {"prekryv_topk", "spearman", "zhoda_prveho"}, str(set(o1.PRAHY)))

zle = [n for ok, n in R if not ok]
print("\n" + "=" * 56)
print(f"{len(R)-len(zle)}/{len(R)} testov preslo" if not zle else f"ZLYHALO {len(zle)}: " + "; ".join(zle))
sys.exit(1 if zle else 0)
