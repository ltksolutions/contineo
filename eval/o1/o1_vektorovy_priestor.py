# -*- coding: utf-8 -*-
"""
o1_vektorovy_priestor.py — odpovedá na otvorenú otázku O1 z ADR-001.

OTÁZKA
  Cloud embedduje cez `voyage-4` v Atlase (1024 dim), on-prem by embedoval
  lokálne cez `voyage-4-nano` (natívne 2048 dim, MRL-skrátené na 1024).
  Voyage tvrdí, že modely rodiny voyage-4 zdieľajú vektorový priestor.
  Platí to aj po skrátení na 1024? A stačí to na migráciu bez re-embedu?

PREČO NESTAČÍ POROVNAŤ KOSÍNUS
  Surová podobnosť medzi vektormi dvoch modelov pre ten istý text je len
  diagnostika. Pre nás je rozhodujúce, či sa zhoduje PORADIE VÝSLEDKOV —
  teda či dotaz embedovaný modelom A nájde v indexe postavenom modelom B
  tie isté dokumenty. To je jediný test, ktorý zodpovedá reálnemu použitiu:
  index máte z Atlasu, dotaz by prišiel z lokálneho modelu.

  Preto sa meria KRÍŽOVÝ RETRIEVAL: index voyage-4, dotaz voyage-4-nano.

SPUSTENIE (Mac, GPU netreba — 340M model beží na CPU aj MPS)
    pip install sentence-transformers torch
    export VOYAGE_API_KEY=...
    python3 o1_vektorovy_priestor.py

    --dim 1024        cieľová dimenzia (default 1024, podľa Atlas indexu)
    --vzorka x.json   vlastný korpus {"dokumenty": [...], "dotazy": [...]}
    --k 5             veľkosť top-k pri porovnaní
    --bez-lokalneho   len Voyage API (na overenie kľúča a prístupu)

VÝSTUP
  Tabuľka metrík a jednoznačné go/no-go pre migráciu bez re-embedu.
"""
import argparse, json, os, ssl, sys, time
from urllib import request as urlreq, error as urlerr

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from metriky import (normalizuj, kosinus, truncate_mrl, poradie,
                     prekryv_topk, spearman, zhoda_prveho, priemer)

HERE = os.path.dirname(os.path.abspath(__file__))
VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"

# Python z python.org na macOS nepoužíva systémové úložisko certifikátov,
# takže bez tohto padne na CERTIFICATE_VERIFY_FAILED. certifi je závislosť
# huggingface-hub, takže po `pip install sentence-transformers` už tam je.
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

# Prahy pre rozhodnutie.
#
# Metriky NIE SÚ rovnocenné. V reálnej pipeline sa ťahá 20 kandidátov, tie
# preusporiada reranker a do kontextu ide osem. Dokument, ktorý sa posunie
# z piatej na šiestu pozíciu, do odpovede aj tak dorazí — preto je prekryv
# top-k len informatívny. Rozhoduje, či sedí najlepší nález a celkové poradie.
PRAHY = {
    "zhoda_prveho":  0.90,   # ROZHODUJÚCA — sedí najlepší výsledok?
    "spearman":      0.90,   # ROZHODUJÚCA — drží celkové poradie?
    "prekryv_topk":  0.80,   # informatívna — posun na hranici top-k nevadí
}
ROZHODUJUCE = ("zhoda_prveho", "spearman")

# Pod týmto počtom dotazov je výsledok príliš zašumený na tvrdý verdikt.
# Pri 15 dotazoch posunie jediný dotaz metriku o ~6,7 bodu.
MIN_DOTAZOV = 40


# ── Cache ────────────────────────────────────────────────────────────────────
# Embeddingy sa nemenia, tak ich držíme na disku. Experimenty s --k tak
# nestoja ani jedno volanie API (a nenarazia na limit 3 req/min na free tieri).
CACHE = os.path.join(HERE, ".cache_embeddingov.json")

def _kluc(texty, model, input_type, dim):
    import hashlib
    h = hashlib.sha256("\u0000".join(texty).encode()).hexdigest()[:16]
    return f"{model}|{input_type}|{dim}|{len(texty)}|{h}"

def _cache_nacitaj():
    try:
        return json.load(open(CACHE, encoding="utf-8"))
    except (OSError, ValueError):
        return {}

def _cache_uloz(data):
    try:
        json.dump(data, open(CACHE, "w", encoding="utf-8"))
    except OSError:
        pass


# ── Voyage API ───────────────────────────────────────────────────────────────
def voyage_embed(texty, model, input_type, dim, api_key, batch=64):
    """input_type musí byť 'query' alebo 'document' — modely majú iné prompty."""
    cache = _cache_nacitaj()
    ck = _kluc(texty, model, input_type, dim)
    if ck in cache:
        print(f"      (z cache: {len(cache[ck])} vektorov)")
        return cache[ck]

    out = []
    for i in range(0, len(texty), batch):
        davka = texty[i:i + batch]
        body = json.dumps({
            "input": davka, "model": model,
            "input_type": input_type, "output_dimension": dim,
        }).encode()
        req = urlreq.Request(VOYAGE_URL, data=body, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        })
        data = None
        for pokus in range(5):
            try:
                with urlreq.urlopen(req, timeout=60, context=SSL_CTX) as r:
                    data = json.loads(r.read())
                break
            except urlerr.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")[:400]
                if e.code == 429:
                    # Free tier bez platobnej metódy má 3 požiadavky za minútu.
                    cakaj = 25 * (pokus + 1)
                    print(f"      limit API, čakám {cakaj} s (pokus {pokus+1}/5)…")
                    time.sleep(cakaj)
                    continue
                sys.exit(f"\nVoyage API {e.code}: {detail}\n"
                         f"Skontroluj VOYAGE_API_KEY a či model '{model}' "
                         f"podporuje output_dimension={dim}.")
            except urlerr.URLError as e:
                if "CERTIFICATE_VERIFY_FAILED" in str(e.reason):
                    sys.exit("\nSSL: nepodarilo sa overiť certifikát.\n"
                             "Python z python.org nepoužíva systémové certifikáty. Oprav to takto:\n"
                             "  pip install --upgrade certifi\n"
                             "  a spusti: /Applications/Python 3.12/Install Certificates.command\n")
                sys.exit(f"\nSieťová chyba: {e.reason}")
        if data is None:
            sys.exit("\nVoyage API stále vracia 429 (limit požiadaviek).\n"
                     "Počkaj minútu, alebo pridaj platobnú metódu na "
                     "https://dashboard.voyageai.com/ (free tokeny zostávajú).")
        polozky = sorted(data["data"], key=lambda d: d.get("index", 0))
        out.extend(normalizuj(p["embedding"]) for p in polozky)
        time.sleep(0.2)

    cache[ck] = out
    _cache_uloz(cache)
    return out


# ── Lokálny model ────────────────────────────────────────────────────────────
def lokalne_embed(dokumenty, dotazy, model_id):
    """
    Vracia (doc_vecs_2048, query_vecs_2048) v natívnej dimenzii.
    Skrátenie na cieľovú dimenziu robíme až potom, aby sa dali porovnať obe.
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        sys.exit("Chýba sentence-transformers. Nainštaluj:\n"
                 "  pip install -r requirements.txt")

    # Kontrola verzie ešte pred sťahovaním modelu — nech sa nečaká zbytočne.
    try:
        import transformers
        hlavna = int(transformers.__version__.split(".")[0])
        if hlavna >= 5:
            sys.exit(
                f"\ntransformers {transformers.__version__} nie je kompatibilný "
                f"s vlastným kódom modelu {model_id}.\n"
                "Kód modelu (modeling_qwen3_bidirectional.py) nenastavuje `config_class`, "
                "čo vetva 5.x vyžaduje.\n\nOprav to takto:\n"
                '  pip install "transformers>=4.44,<5"\n'
            )
    except ImportError:
        pass

    print(f"  načítavam {model_id} (prvýkrát sa sťahuje ~700 MB)…")
    try:
        model = SentenceTransformer(model_id, trust_remote_code=True)
    except AttributeError as e:
        if "config_class" in str(e) or "__name__" in str(e):
            sys.exit(
                f"\nModel sa nepodarilo načítať: {e}\n"
                "Typicky ide o nekompatibilnú verziu transformers. Skús:\n"
                '  pip install "transformers>=4.44,<5"\n'
            )
        raise

    # encode_query / encode_document samy pridajú správne prompty —
    # bez nich by porovnanie s Voyage API nebolo férové.
    d = model.encode_document(dokumenty, show_progress_bar=False)
    q = model.encode_query(dotazy, show_progress_bar=False)
    return [normalizuj(list(map(float, v))) for v in d], \
           [normalizuj(list(map(float, v))) for v in q]


# ── Vyhodnotenie ─────────────────────────────────────────────────────────────
def porovnaj(nazov, doc_a, q_a, doc_b, q_b, k):
    """
    Porovná dve zostavy (index + dotazy) podľa toho, aké poradie vrátia.

    Pre ostrý test sa doc_a a doc_b zhodujú — mení sa len model dotazu.
    Pre referenciu sa líšia obe, lebo porovnávame 2048 vs 1024 dimenzií;
    v rámci jednej zostavy musia dimenzie sedieť.
    """
    if len(doc_a[0]) != len(q_a[0]):
        raise ValueError(f"zostava A: dokument {len(doc_a[0])} vs dotaz {len(q_a[0])} dim")
    if len(doc_b[0]) != len(q_b[0]):
        raise ValueError(f"zostava B: dokument {len(doc_b[0])} vs dotaz {len(q_b[0])} dim")

    prekryvy, spearmany, prve = [], [], []
    for qa, qb in zip(q_a, q_b):
        pa = poradie(qa, doc_a)
        pb = poradie(qb, doc_b)
        prekryvy.append(prekryv_topk(pa, pb, k))
        spearmany.append(spearman(pa, pb))
        prve.append(zhoda_prveho(pa, pb))
    return {
        "nazov": nazov,
        "prekryv_topk": priemer(prekryvy),
        "spearman": priemer(spearmany),
        "zhoda_prveho": priemer(prve),
    }


def vypis(v, k):
    print(f"\n  {v['nazov']}")
    for kluc, popis in [("zhoda_prveho", "zhoda 1. výsledku"),
                        ("spearman", "Spearman poradia"),
                        ("prekryv_topk", f"prekryv top-{k}")]:
        h = v[kluc]
        prah = PRAHY[kluc]
        znak = "✔" if h >= prah else "✘"
        vaha = "" if kluc in ROZHODUJUCE else "  (informatívna)"
        print(f"    {popis:20} {h*100:6.1f} %   (prah {prah*100:.0f} %)  {znak}{vaha}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dim", type=int, default=1024)
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--vzorka", default=os.path.join(HERE, "vzorka.json"))
    ap.add_argument("--cloud-model", default="voyage-4")
    ap.add_argument("--lokalny-model", default="voyageai/voyage-4-nano")
    ap.add_argument("--bez-lokalneho", action="store_true")
    a = ap.parse_args()

    api_key = os.environ.get("VOYAGE_API_KEY")
    if not api_key or api_key in ("...", "sem-vloz-kluc"):
        sys.exit("Chýba (alebo je zástupný) VOYAGE_API_KEY.\n"
                 "  export VOYAGE_API_KEY='pa-...'\n"
                 "  Kľúč sa vytvára na https://dashboard.voyageai.com/api-keys")

    # Upozorníme, ak sa beží mimo virtuálneho prostredia — balíky potom
    # môžu chýbať alebo sa miešať so systémovými.
    if not a.bez_lokalneho and sys.prefix == sys.base_prefix:
        print("Pozn.: nebežíš vo virtuálnom prostredí (.venv). "
              "Ak zlyhá import sentence-transformers, aktivuj ho:\n"
              "  source .venv/bin/activate\n")

    vz = json.load(open(a.vzorka, encoding="utf-8"))
    dokumenty, dotazy = vz["dokumenty"], vz["dotazy"]
    print(f"\nO1 — zhoda vektorových priestorov")
    print(f"Vzorka: {len(dokumenty)} dokumentov, {len(dotazy)} dotazov · cieľová dimenzia {a.dim}\n")

    print(f"[1/2] Voyage API — {a.cloud_model} @ {a.dim} dim")
    cloud_doc = voyage_embed(dokumenty, a.cloud_model, "document", a.dim, api_key)
    cloud_q = voyage_embed(dotazy, a.cloud_model, "query", a.dim, api_key)
    print(f"      hotovo ({len(cloud_doc)} + {len(cloud_q)} vektorov)")

    if a.bez_lokalneho:
        print("\n--bez-lokalneho: prístup k Voyage API overený, končím.\n")
        return

    print(f"\n[2/2] Lokálne — {a.lokalny_model}")
    nano_doc_full, nano_q_full = lokalne_embed(dokumenty, dotazy, a.lokalny_model)
    nativna = len(nano_doc_full[0])
    print(f"      hotovo, natívna dimenzia {nativna}")

    nano_doc = [truncate_mrl(v, a.dim) for v in nano_doc_full]
    nano_q = [truncate_mrl(v, a.dim) for v in nano_q_full]

    # ── diagnostika: surová podobnosť pre ten istý text ──
    print("\n" + "─" * 66)
    print("DIAGNOSTIKA — surová podobnosť pre ten istý text")
    sur = priemer(kosinus(c, n) for c, n in zip(cloud_doc, nano_doc))
    print(f"  voyage-4 vs voyage-4-nano @ {a.dim}:  {sur:.4f}")
    print("  (nízke číslo tu ešte neznamená problém — rozhoduje poradie nižšie)")

    # ── hlavný test: krížový retrieval ──
    print("\n" + "─" * 66)
    print(f"KRÍŽOVÝ RETRIEVAL — index z voyage-4, dotaz z iného modelu")
    vysledky = [
        # Referencia: celý retrieval v natívnych 2048 vs celý v skrátených 1024.
        # Izoluje vplyv samotného MRL skrátenia, bez rozdielu medzi modelmi.
        porovnaj(f"referencia: nano @ {nativna} vs nano @ {a.dim}  (samotné MRL skrátenie)",
                 nano_doc_full, nano_q_full,
                 nano_doc, nano_q, a.k),
        # Ostrý test: rovnaký index z voyage-4, mení sa len model dotazu.
        # Presne to, čo by sa dialo pri migrácii cloud -> on-prem.
        porovnaj(f"OSTRÝ TEST: dotaz z voyage-4 vs z voyage-4-nano @ {a.dim}",
                 cloud_doc, cloud_q, cloud_doc, nano_q, a.k),
    ]
    for v in vysledky:
        vypis(v, a.k)

    # ── záver ──
    ostry = vysledky[-1]
    presiel = all(ostry[k] >= PRAHY[k] for k in ROZHODUJUCE)
    malo_dat = len(dotazy) < MIN_DOTAZOV

    print("\n" + "=" * 66)
    if presiel:
        print("ZÁVER: ✔ GO — zdieľaný vektorový priestor funguje.")
        print("  Migrácia cloud ↔ on-prem NEVYŽADUJE re-embed korpusu.")
        print(f"  Do profilu tenanta možno dať voyage-4-nano s dim={a.dim}.")
        if ostry["prekryv_topk"] < 0.95:
            print(f"\n  Pozn.: prekryv top-{a.k} je {ostry['prekryv_topk']*100:.1f} %.")
            print("  Dva rôzne modely tej istej rodiny preusporiadajú okraj výsledkov —")
            print("  to je očakávané. Pipeline ťahá 20 kandidátov a rerankuje,")
            print("  takže dokument na hranici top-k sa do kontextu aj tak dostane.")
    else:
        print("ZÁVER: ✘ NO-GO — nesedí najlepší výsledok alebo celkové poradie.")
        print("  Migrácia by tíško zhoršila retrieval. Možnosti:")
        print(f"    a) zjednotiť oba režimy na natívnych {nativna} dim")
        print("    b) prijať úplný re-embed pri migrácii (scripts/reembed.mjs)")
        print("    c) použiť on-prem iný model (BGE-M3) a rátať s re-embedom vždy")

    if malo_dat:
        print(f"\n  ⚠ Vzorka má len {len(dotazy)} dotazov (odporúčané ≥ {MIN_DOTAZOV}).")
        print(f"    Jediný dotaz posunie metriku o ~{100/len(dotazy):.1f} bodu,")
        print("    takže rozdiel pár bodov je šum, nie signál.")
        print("    Väčšiu vzorku dodáš cez --vzorka vlastny.json")
    print("=" * 66)

    out = os.path.join(HERE, "vysledok_o1.json")
    json.dump({"dim": a.dim, "k": a.k, "nativna_dimenzia": nativna,
               "pocet_dotazov": len(dotazy), "pocet_dokumentov": len(dokumenty),
               "surova_podobnost": sur, "vysledky": vysledky,
               "prahy": PRAHY, "rozhodujuce": list(ROZHODUJUCE),
               "male_data": malo_dat, "go": presiel},
              open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nUložené: {out}\n")


if __name__ == "__main__":
    main()
