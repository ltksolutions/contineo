# -*- coding: utf-8 -*-
"""
test_metriky.py — testy výpočtov pre O1, bez siete a bez modelov.
    python3 test_metriky.py     (návratový kód 0 = všetko prešlo)
"""
import sys, random
from metriky import (normalizuj, kosinus, truncate_mrl, poradie,
                     prekryv_topk, spearman, zhoda_prveho, priemer)

R = []
def t(nazov, ok, extra=""):
    R.append((ok, nazov)); print(f"{'OK   ' if ok else 'CHYBA'} {nazov}" + ("" if ok else f"  → {extra}"))
def blizko(a, b, eps=1e-9): return abs(a - b) < eps

# ── normalizacia a kosinus ───────────────────────────────────────────────
t("normalizuj: (3,4) -> dlzka 1", blizko(sum(x*x for x in normalizuj([3,4])), 1.0))
t("normalizuj: nulovy vektor nespadne", normalizuj([0,0]) == [0,0])
t("kosinus rovnakych = 1", blizko(kosinus([1,0],[1,0]), 1.0))
t("kosinus kolmych = 0", blizko(kosinus([1,0],[0,1]), 0.0))
t("kosinus opacnych = -1", blizko(kosinus([1,0],[-1,0]), -1.0))
try:
    kosinus([1,0],[1,0,0]); t("rozne dimenzie -> chyba", False, "nevyhodilo")
except ValueError:
    t("rozne dimenzie -> chyba", True)

# ── MRL ──────────────────────────────────────────────────────────────────
t("MRL: skrati a znormalizuje", truncate_mrl([3,4,99,99], 2) == [0.6, 0.8])
t("MRL: dlzka 1 po skrateni", blizko(sum(x*x for x in truncate_mrl([1,2,3,4], 2)), 1.0))
t("MRL: dim >= dlzka -> bez zmeny", truncate_mrl([1,2], 5) == [1,2])

# ── poradie ──────────────────────────────────────────────────────────────
docs = [[1,0], [0,1], [0.7071,0.7071]]
t("poradie: najpodobnejsi prvy", poradie([1,0], docs)[0] == 0)
t("poradie: vrati vsetky", len(poradie([1,0], docs)) == 3)

# ── prekryv ──────────────────────────────────────────────────────────────
t("prekryv: uplna zhoda = 1.0", prekryv_topk([1,2,3],[1,2,3],3) == 1.0)
t("prekryv: ziadna zhoda = 0.0", prekryv_topk([1,2,3],[7,8,9],3) == 0.0)
t("prekryv: polovicna", blizko(prekryv_topk([1,2,3,4],[1,2,9,8],4), 0.5))
t("prekryv: nezavisi na poradi v ramci top-k", prekryv_topk([1,2,3],[3,2,1],3) == 1.0)

# ── spearman ─────────────────────────────────────────────────────────────
t("spearman: zhodne poradie = 1", blizko(spearman([0,1,2,3],[0,1,2,3]), 1.0))
t("spearman: opacne poradie = -1", blizko(spearman([0,1,2,3],[3,2,1,0]), -1.0))
t("spearman: jedna polozka = 1", spearman([0],[0]) == 1.0)
nahodne_a = list(range(50)); nahodne_b = nahodne_a[:]; random.seed(7); random.shuffle(nahodne_b)
t("spearman: nahodne poradie blizko nuly", abs(spearman(nahodne_a, nahodne_b)) < 0.4,
  str(spearman(nahodne_a, nahodne_b)))

# ── zhoda prveho ─────────────────────────────────────────────────────────
t("zhoda prveho: sedi", zhoda_prveho([5,1,2],[5,9,8]) == 1.0)
t("zhoda prveho: nesedi", zhoda_prveho([5,1,2],[1,5,2]) == 0.0)
t("zhoda prveho: prazdne", zhoda_prveho([],[]) == 0.0)

# ── priemer ──────────────────────────────────────────────────────────────
t("priemer", blizko(priemer([1,2,3]), 2.0))
t("priemer prazdneho = 0", priemer([]) == 0.0)

# ── scenar: identicke modely musia dat plnu zhodu ────────────────────────
random.seed(1)
d = [normalizuj([random.gauss(0,1) for _ in range(16)]) for _ in range(20)]
q = [normalizuj([random.gauss(0,1) for _ in range(16)]) for _ in range(5)]
prekryvy = [prekryv_topk(poradie(x, d), poradie(x, d), 5) for x in q]
t("identicky model -> prekryv 1.0", all(p == 1.0 for p in prekryvy))

# ── scenar: nezavisly sum musi dat nizku zhodu ───────────────────────────
q2 = [normalizuj([random.gauss(0,1) for _ in range(16)]) for _ in range(5)]
prekryvy2 = [prekryv_topk(poradie(a, d), poradie(b, d), 5) for a, b in zip(q, q2)]
t("nezavisle dotazy -> nizky prekryv", priemer(prekryvy2) < 0.6, str(priemer(prekryvy2)))

zle = [n for ok, n in R if not ok]
print("\n" + "="*56)
print(f"{len(R)-len(zle)}/{len(R)} testov preslo" if not zle else f"ZLYHALO {len(zle)}: " + "; ".join(zle))
sys.exit(1 if zle else 0)
