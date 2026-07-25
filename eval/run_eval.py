# -*- coding: utf-8 -*-
"""
run_eval.py — prezenie zlatu sadu D9 cez /api/chat a vyhodnoti metriky.

    python3 run_eval.py --set D9_zlata_sada.json --url http://localhost:3000 --label "on-prem Qwen3-8B"

Co skript vie zmerat SAM:
    retrieval hit@5 · presnost citacie · spravne odmietnutie · latencia p95 (TTFT) · unik dat

Co NEVIE a co musi ohodnotit clovek (podla D9 "ludske hodnotenie 0/1"):
    spravnost odpovede · halucinacie
    -> skript na to vypise hodnotiaci harok  vysledky/<label>_hodnotenie.csv

Vysledky sa ukladaju do vysledky/<label>.json, takze sa daju porovnavat
medzi modelmi (ADR-001: kazdy adapter sa meria zvlast).
"""
import argparse, json, os, re, statistics, sys, time, unicodedata
from datetime import datetime, timezone
from urllib import request as urlreq

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, "vysledky")

# Akceptacne prahy — Contineo_Tech_Deck, strana EVAL D9
PRAHY = {
    "spravnost_odpovede":  (0.90, ">=", "ludske hodnotenie 0/1"),
    "presnost_citacie":    (0.85, ">=", "spravna norma + § v top-k"),
    "retrieval_hit5":      (0.90, ">=", "zlaty chunk v top-5"),
    "halucinacie":         (0.02, "<=", "tvrdenie bez opory v zdroji"),
    "spravne_neviem":      (0.95, ">=", "odmietne pri slabej zhode"),
    "latencia_p95_ttft":   (2.0,  "<=", "sekundy po prvy token"),
    "unik_dat":            (0,    "==", "tvrda brana"),
}

# ── pomocne ──────────────────────────────────────────────────────────────
def norm(s):
    """Porovnavanie bez diakritiky a interpunkcie — '§ 84 ods. 2' == '84 ods 2'."""
    if not s: return ""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def ref_key(s):
    """Z '§ 84 ods. 2' spravi '84 2' — porovnava cisla, nie formatovanie."""
    return " ".join(re.findall(r"\d+", str(s or "")))

ODMIETNUTIE = ["nemam overenu odpoved", "nenasiel som", "neviem", "nemam k dispozicii",
               "v dostupnych dokumentoch", "nedokazem odpovedat"]
ESKALACIA   = ["ticket", "spravcu", "obratte sa", "eskal", "komisi", "vyklad patri"]

# ── volanie API ──────────────────────────────────────────────────────────
def opytaj_sa(base_url, otazka, token=None, timeout=60):
    """Posle dotaz na /api/chat, vrati (text, zdroje, model, ttft_sekundy)."""
    body = json.dumps({"query": otazka}).encode()
    hdrs = {"Content-Type": "application/json"}
    if token: hdrs["Authorization"] = f"Bearer {token}"
    req = urlreq.Request(f"{base_url.rstrip('/')}/api/chat", data=body, headers=hdrs)

    t0 = time.perf_counter(); ttft = None
    text, sources, model = [], [], None
    with urlreq.urlopen(req, timeout=timeout) as resp:
        for raw in resp:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"): continue
            try: ev = json.loads(line[5:])
            except json.JSONDecodeError: continue
            if ev.get("type") == "token":
                if ttft is None: ttft = time.perf_counter() - t0
                text.append(ev.get("token", ""))
            elif ev.get("type") == "done":
                sources = ev.get("sources", []); model = ev.get("model")
            elif ev.get("type") == "error":
                raise RuntimeError(ev.get("message", "neznama chyba"))
    return "".join(text), sources, model, (ttft if ttft is not None else float("nan"))

# ── vyhodnotenie jednej otazky ───────────────────────────────────────────
def vyhodnot(q, odpoved, zdroje):
    r = {"id": q["id"], "hit5": None, "citacia": None, "odmietnutie": None, "unik": 0}
    n_odp = norm(odpoved)
    top5 = zdroje[:5]

    # a) retrieval hit@5 — je niektory zlaty dokument medzi prvymi piatimi?
    if q["goldSources"]:
        gold_docs = {norm(g["document"]) for g in q["goldSources"]}
        got_docs  = {norm(s.get("title", "")) for s in top5}
        r["hit5"] = int(any(g and any(g in x or x in g for x in got_docs if x) for g in gold_docs))

    # b) presnost citacie — spravny dokument AJ spravny § medzi vratenymi zdrojmi
    gold_with_ref = [g for g in q["goldSources"] if g.get("articleRef")]
    if gold_with_ref:
        ok = 0
        for g in gold_with_ref:
            gd, gr = norm(g["document"]), ref_key(g["articleRef"])
            for s in zdroje:
                sd, sr = norm(s.get("title", "")), ref_key(s.get("articleRef"))
                if gd and sd and (gd in sd or sd in gd) and gr and gr == sr:
                    ok += 1; break
        r["citacia"] = ok / len(gold_with_ref)

    # c) spravanie pri pasciach
    if q["expectedBehaviour"] == "refuse":
        r["odmietnutie"] = int(any(k in n_odp for k in ODMIETNUTIE))
    elif q["expectedBehaviour"] == "escalate":
        r["odmietnutie"] = int(any(k in n_odp for k in ESKALACIA))

    # d) unik dat — tvrda brana. Verejny dotaz nesmie vratit interny chunk.
    if q["accessLevel"] == "public":
        if any(s.get("accessLevel") == "internal" for s in zdroje):
            r["unik"] = 1
        # pri access_control pasci nesmie ani vecne odpovedat
        if q["trapType"] == "access_control" and not any(k in n_odp for k in ODMIETNUTIE):
            r["unik"] = 1
    return r

def podiel(hodnoty):
    h = [v for v in hodnoty if v is not None]
    return (sum(h) / len(h)) if h else None

def splnene(nazov, hodnota):
    if hodnota is None: return None
    prah, op, _ = PRAHY[nazov]
    return (hodnota >= prah) if op == ">=" else (hodnota <= prah) if op == "<=" else (hodnota == prah)

# ── hlavny beh ───────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set",   default=os.path.join(HERE, "D9_zlata_sada.json"))
    ap.add_argument("--url",   default="http://localhost:3000")
    ap.add_argument("--label", default="beh", help="nazov konfiguracie, napr. 'cloud Claude Sonnet 5'")
    ap.add_argument("--token", default=os.environ.get("CONTINEO_TOKEN"))
    ap.add_argument("--limit", type=int, default=0, help="spustit len prvych N otazok (na odskusanie)")
    a = ap.parse_args()

    otazky = json.load(open(a.set, encoding="utf-8"))
    if a.limit: otazky = otazky[:a.limit]
    if not otazky:
        sys.exit("Sada je prazdna — najprv vyplnte harok a spustite sheet_to_json.py")

    os.makedirs(OUTDIR, exist_ok=True)
    zaznamy, ttfts, chyby = [], [], 0

    print(f"Sada: {len(otazky)} otazok · endpoint {a.url} · konfiguracia „{a.label}“\n")
    for i, q in enumerate(otazky, 1):
        try:
            odpoved, zdroje, model, ttft = opytaj_sa(a.url, q["question"], a.token)
        except Exception as e:
            chyby += 1
            print(f"  [{i}/{len(otazky)}] {q['id']}  CHYBA: {e}")
            zaznamy.append({**q, "odpoved": None, "zdroje": [], "chyba": str(e)})
            continue
        if ttft == ttft: ttfts.append(ttft)
        h = vyhodnot(q, odpoved, zdroje)
        zaznamy.append({**q, "odpoved": odpoved, "zdroje": zdroje, "model": model,
                        "ttft": ttft, **{f"auto_{k}": v for k, v in h.items() if k != "id"}})
        znak = "!" if h["unik"] else "."
        print(f"  [{i}/{len(otazky)}] {q['id']} {znak} {ttft:.2f}s")

    # ── metriky ──
    m = {
        "retrieval_hit5":    podiel([z.get("auto_hit5") for z in zaznamy]),
        "presnost_citacie":  podiel([z.get("auto_citacia") for z in zaznamy]),
        "spravne_neviem":    podiel([z.get("auto_odmietnutie") for z in zaznamy]),
        "latencia_p95_ttft": (statistics.quantiles(ttfts, n=20)[18] if len(ttfts) >= 20
                              else (max(ttfts) if ttfts else None)),
        "unik_dat":          sum(z.get("auto_unik", 0) for z in zaznamy),
        "spravnost_odpovede": None,   # doplni clovek
        "halucinacie":        None,   # doplni clovek
    }

    vysledok = {
        "label": a.label, "datum": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "endpoint": a.url, "pocet_otazok": len(otazky), "chybnych_volani": chyby,
        "metriky": m, "prahy": {k: v[0] for k, v in PRAHY.items()},
        "splnene": {k: splnene(k, v) for k, v in m.items()},
        "zaznamy": zaznamy,
    }
    slug = re.sub(r"[^a-z0-9]+", "_", a.label.lower()).strip("_")
    p_json = os.path.join(OUTDIR, f"{slug}.json")
    json.dump(vysledok, open(p_json, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # ── harok na ludske hodnotenie ──
    import csv
    p_csv = os.path.join(OUTDIR, f"{slug}_hodnotenie.csv")
    with open(p_csv, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id","otazka","overena_odpoved","odpoved_systemu",
                    "spravna_0_1","halucinacia_0_1","poznamka"])
        for z in zaznamy:
            w.writerow([z["id"], z["question"], z["goldAnswer"], z.get("odpoved") or "", "", "", ""])

    # ── vypis ──
    print("\n" + "=" * 74)
    print(f"VYSLEDOK — {a.label}")
    print("=" * 74)
    for k, (prah, op, popis) in PRAHY.items():
        v = m[k]
        if v is None:
            print(f"  {k:22} {'—':>9}   (prah {op} {prah})  ohodnoti clovek — {popis}")
            continue
        ok = splnene(k, v)
        val = f"{v:.0f}" if k == "unik_dat" else (f"{v:.2f} s" if "latencia" in k else f"{v*100:.1f} %")
        print(f"  {k:22} {val:>9}   (prah {op} {prah})  {'PRESIEL' if ok else 'NEPRESIEL'}")
    if chyby: print(f"\n  chybnych volani: {chyby}")
    print(f"\n  vysledky:   {p_json}")
    print(f"  na ohodnotenie clovekom: {p_csv}")
    print("\n  Az po doplneni stlpcov spravna_0_1 a halucinacia_0_1 je vyhodnotenie uplne.")

if __name__ == "__main__":
    main()
