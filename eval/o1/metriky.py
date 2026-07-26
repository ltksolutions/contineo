# -*- coding: utf-8 -*-
"""
metriky.py — výpočty pre O1. Oddelené od siete, aby sa dali testovať.
Bez závislostí okrem štandardnej knižnice.
"""
from math import sqrt


def normalizuj(v):
    n = sqrt(sum(x * x for x in v))
    return [x / n for x in v] if n else list(v)


def kosinus(a, b):
    if len(a) != len(b):
        raise ValueError(f"rôzne dimenzie: {len(a)} vs {len(b)}")
    return sum(x * y for x, y in zip(a, b))


def truncate_mrl(v, dim):
    """MRL skrátenie + renormalizácia. Rovnaká logika ako v embedding/http.ts."""
    if dim >= len(v):
        return list(v)
    return normalizuj(v[:dim])


def poradie(dotaz_vec, doc_vecs):
    """Indexy dokumentov zoradené od najpodobnejšieho."""
    skore = [(i, kosinus(dotaz_vec, d)) for i, d in enumerate(doc_vecs)]
    skore.sort(key=lambda t: -t[1])
    return [i for i, _ in skore]


def prekryv_topk(a, b, k):
    """Podiel spoločných dokumentov v prvých k. 1.0 = úplná zhoda."""
    sa, sb = set(a[:k]), set(b[:k])
    return len(sa & sb) / k if k else 1.0


def spearman(a, b):
    """
    Spearmanova korelácia poradí. 1.0 = identické poradie, 0 = náhodné.
    Počíta sa nad všetkými položkami, nie len nad top-k.
    """
    n = len(a)
    if n < 2:
        return 1.0
    poz_a = {doc: i for i, doc in enumerate(a)}
    poz_b = {doc: i for i, doc in enumerate(b)}
    spolocne = set(poz_a) & set(poz_b)
    if len(spolocne) < 2:
        return 0.0
    d2 = sum((poz_a[d] - poz_b[d]) ** 2 for d in spolocne)
    m = len(spolocne)
    return 1 - (6 * d2) / (m * (m * m - 1))


def zhoda_prveho(a, b):
    """Zhoduje sa najlepší výsledok? Najprísnejšia a najpraktickejšia metrika."""
    return 1.0 if a and b and a[0] == b[0] else 0.0


def priemer(xs):
    xs = list(xs)
    return sum(xs) / len(xs) if xs else 0.0
