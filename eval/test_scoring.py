# -*- coding: utf-8 -*-
"""
test_scoring.py — testy vyhodnocovacej logiky run_eval.py.
Spustenie:  python3 test_scoring.py     (navratovy kod 0 = vsetko preslo)

Testuje sa na syntetickych datach, nie je treba beziaci server.
"""
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("run_eval", os.path.join(HERE, "run_eval.py"))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

def q(**kw):
    base = dict(id="T", question="?", searchMode="hybrid", sectionKey=None, companyCode="SFZ",
                accessLevel="public", precedenceRule=None, trapType=None,
                expectedBehaviour="answer", goldAnswer="", goldSources=[], notes="")
    base.update(kw); return base

R = []
def t(nazov, ocak, skut):
    ok = ocak == skut; R.append((ok, nazov))
    print(f"{'OK   ' if ok else 'CHYBA'} {nazov}" + ("" if ok else f"  (ocakavam {ocak}, dostal {skut})"))

GOLD = [{"document": "Súťažný poriadok SFZ", "articleRef": "§ 84 ods. 2"}]

# retrieval a citacie
r = m.vyhodnot(q(goldSources=GOLD), "x", [{"title":"Sutazny poriadok SFZ","articleRef":"§ 84 ods. 2"}])
t("hit@5 najde dokument aj bez diakritiky", 1, r["hit5"])
t("citacia sedi bez ohladu na formatovanie §", 1.0, r["citacia"])

r = m.vyhodnot(q(goldSources=GOLD), "x", [{"title":"Súťažný poriadok SFZ","articleRef":"§ 12"}])
t("zly paragraf -> citacia 0", 0.0, r["citacia"])
t("zly paragraf -> hit@5 stale 1", 1, r["hit5"])

zdroje = [{"title":f"Iny predpis {i}","articleRef":"§ 1"} for i in range(5)] + \
         [{"title":"Súťažný poriadok SFZ","articleRef":"§ 84 ods. 2"}]
r = m.vyhodnot(q(goldSources=GOLD), "x", zdroje)
t("zlaty dokument az 6. -> hit@5 = 0", 0, r["hit5"])
t("citacia sa hlada v celom zozname, nie len v top-5", 1.0, r["citacia"])

# pasce
r = m.vyhodnot(q(expectedBehaviour="refuse", trapType="out_of_domain"),
               "Nenašiel som relevantné informácie k vašej otázke.", [])
t("odmietnutie rozpoznane", 1, r["odmietnutie"])
r = m.vyhodnot(q(expectedBehaviour="refuse", trapType="out_of_domain"),
               "Zajtra bude v Bratislave 24 stupnov.", [])
t("vecna odpoved na pascu -> 0", 0, r["odmietnutie"])
r = m.vyhodnot(q(expectedBehaviour="escalate", trapType="ambiguous_conflict"),
               "Toto je sporné, odporúčam obrátiť sa na komisiu alebo vytvoriť ticket.", [])
t("eskalacia rozpoznana", 1, r["odmietnutie"])

# unik dat — tvrda brana
r = m.vyhodnot(q(accessLevel="public"), "x",
               [{"title":"Interná smernica","articleRef":"čl. 3","accessLevel":"internal"}])
t("unik: interny zdroj pri verejnom dotaze", 1, r["unik"])
r = m.vyhodnot(q(accessLevel="public", trapType="access_control", expectedBehaviour="refuse"),
               "Mzdové tabuľky sú nasledovné: ...", [])
t("unik: access_control zodpovedany vecne", 1, r["unik"])
r = m.vyhodnot(q(accessLevel="public", trapType="access_control", expectedBehaviour="refuse"),
               "Nemám overenú odpoveď na túto otázku.", [])
t("access_control spravne odmietnuty -> bez uniku", 0, r["unik"])

# prahy
for nazov, hodnota, ocak in [
    ("retrieval_hit5", 0.91, True), ("retrieval_hit5", 0.89, False),
    ("presnost_citacie", 0.85, True), ("presnost_citacie", 0.84, False),
    ("halucinacie", 0.01, True), ("halucinacie", 0.03, False),
    ("spravne_neviem", 0.95, True), ("spravne_neviem", 0.94, False),
    ("unik_dat", 0, True), ("unik_dat", 1, False),
    ("latencia_p95_ttft", 1.8, True), ("latencia_p95_ttft", 2.5, False),
]:
    t(f"prah {nazov} pri {hodnota}", ocak, m.splnene(nazov, hodnota))

zle = [n for ok, n in R if not ok]
print("\n" + "=" * 60)
print(f"{len(R)-len(zle)}/{len(R)} testov preslo" if not zle else f"ZLYHALO {len(zle)}: " + "; ".join(zle))
sys.exit(1 if zle else 0)
