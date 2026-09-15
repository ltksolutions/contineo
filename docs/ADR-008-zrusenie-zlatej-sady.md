# ADR-008 — Zrušenie zlatej sady; kvalita sa meria z prevádzky

> **Stav:** prijaté 2026-09-15
> **Rozhodol:** Ján Letko
> **Prekonáva:** D9 (`docs/D9_EVAL_zlata_sada.md`, `docs/OPEN_DECISIONS.md`)
> **Súvisiace:** `docs/ADR-001-provider-adaptery.md`, `docs/ADR-002-datova-rezidencia.md`

---

## Kontext

D9 zaviedla **zlatú sadu 74 otázok** ako bránu pred go-live: sada s maticou
pokrytia, akceptačnými prahmi a ľudským posudkom 0/1 od doménového experta.
V aplikácii k nej vzniklo celé rozhranie — zoznam s postupom, detail otázky,
prekryv dvoch hodnotiteľov, úprava a vyraďovanie otázok.

**Za dva mesiace ju neposúdil nikto.** K 15. 9. 2026 bolo v `evaluations`
štrnásť odpovedí na otázky zo sady a **nula posudkov**. Dôvod nie je záhada
a je zapísaný priamo v D9: hárok sa legislatívcovi zámerne neposlal, kým si
systém nebude môcť vyskúšať v aplikácii, lebo „74 otázok v Exceli je bez
kontextu abstraktná domáca úloha". Tou podmienkou bolo funkčné testovacie
rozhranie — a to medzitým vzniklo.

Skutočná prekážka je iná: **sada stojí 4–8 hodín práce doménového experta na
človeka** a ten čas nikto nemá. Rozhodnutie to rešpektuje namiesto toho, aby
sa ďalší polrok čakalo na hodnotiteľa, ktorý nepríde.

## Rozhodnutie

1. **Zlatá sada sa ruší celá** — obrazovky, knižnica, kolekcia
   `eval_questions` (74 otázok) aj materiály v `eval/` okrem `o1/`, ktoré
   so sadou nesúvisí (patrí k O1 z ADR-001).
2. **Kvalita sa meria z prevádzky** — z hodnotení ľudí, ktorí systém naozaj
   používajú, a z nahlásených nepresností pod odpoveďou.
3. **`docs/D9_EVAL_zlata_sada.md` sa nemaže.** Zostáva ako záznam, čo sada
   mala merať a s akými prahmi. Zmazať ho by znamenalo, že o rok nikto
   nezistí, čo sa zrušilo a prečo.

## Čo tým padá — a hovoríme to nahlas

- **Regresia sa nedá merať.** „Zlepšilo sa to po zmene chunkovania alebo
  modelu?" nemá odpoveď, lebo voľné otázky sú zakaždým iné.
- **Pasce a precedencia R1–R4 sa netestujú vôbec.** Tridsaťdva otázok bolo
  stavaných na to, aby systém **neodpovedal**. Na takú sa nikto dobrovoľne
  nespýta.
- **ADR-001 a ADR-002 strácajú meradlo.** Voľba modelu, on-prem verzus cloud
  a nákup hardvéru sa budú rozhodovať bez čísla, ktoré na to D9 sľubovala.
  Zmienky o zlatej sade v oboch ADR sú odteraz **historické**.
- **`run_eval.py` bola jediná automatická metrika** hit@5, presnosti citácie
  a správneho odmietnutia. Padá s ňou.

## Čo zostáva — a je to viac, než sa zdalo

**Tvrdá brána na únik interného obsahu zostáva v platnosti.** Ukázalo sa, že
ju `scripts/ratings_overview.mjs` nikdy nerátal zo sady, ale zo **zdrojov,
ktoré systém pri odpovedi použil** — teda z reálnej prevádzky. Prah je
naďalej nula a jediný výskyt znamená neúspech.

Z prevádzky sa ďalej merajú: latencia p95, podiel odpovedí bez citácie,
rozpad času po fázach a — keď ich ľudia vyplnia — správnosť a halucinácie.

`scripts/rerank_compare.mjs` berie otázky z `evaluations` namiesto zo seedu.
Je to vecne lepšie: rerank sa meria na tom, na čo sa ľudia naozaj pýtajú.

## Otvorené

**Čo nastupuje na miesto akceptačného prahu pred go-live**, nie je
rozhodnuté. Dnes platí len tvrdá brána na únik obsahu; ostatné prahy z D9
(správnosť ≥ 90 %, halucinácie ≤ 2 %, presnosť citácie ≥ 85 %) sa merajú, ale
nie sú brána. Zapísané ako otvorený bod v `docs/OPEN_DECISIONS.md`.

**Verejná stránka `contineo.app/sk/technologia` spomína „eval sadu D9"** pri
porovnateľnosti režimov. Text je odteraz neaktuálny — opraviť mimo tohto
repozitára.
