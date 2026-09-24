# ADR-017 — Znenie môže mať viac právnych základov

> **Stav:** prijaté · **Dátum:** 2026-09-25
> **Zadal a odsúhlasil:** Ján Letko (DPO) — „Plnenie zákonnej povinnosti
> a Oprávnený záujem môžu byť kombinovateľné, jeden dokument, viac právnych
> základov"; pravidlo námietky odsúhlasené v ten istý deň.
> **Nadväzuje na:** D91 (právny základ pri znení), D92 (číselník), ADR-012
> (D104 výkaz DPO, D105 námietka)
> **Mení:** D91 — jeden základ pri znení → jeden alebo viac.

---

## 1. Rozhodnutie

### D115 — Jeden alebo viac základov

- Zodpovedná osoba vyberá **jeden alebo viac** základov z číselníka, aj
  z oboch kategórií (zaškrtávacie políčka namiesto prepínačov).
- Znenie ich nesie ako zoznam `legalBases[]` ({kategória, kľúč, názov,
  odkaz}); potvrdenie si pri zázname uloží kópiu zoznamu (D24).
- Zmena už určeného výberu vyžaduje dôvod, ako doteraz; ten istý výber
  v inom poradí nie je zmena.

### D116 — Zákonná povinnosť má prednosť

- **Rozhodujúci druh** znenia je „plnenie zákonnej povinnosti", keď ju má
  aspoň raz; inak „oprávnený záujem".
- **Námietka (čl. 21 GDPR):** potvrdenie znenia, ktoré má medzi základmi
  zákonnú povinnosť, sa pri vyhovení **nezmaže** — záznam je potrebný kvôli
  zákonu. Zmaže sa len pri znení s výlučne oprávneným záujmom.
- Rozhodujúci druh sa ukladá do pôvodného poľa `legalBasis`, spojené názvy
  a odkazy do `legalBasisLabel` / `legalBasisReference`. Námietky, retencia,
  kontroly a kópie v potvrdeniach, ktoré tieto polia čítajú, tak platia bez
  zmeny.

## 2. Dôsledky

- **Výkaz DPO:** nedostatky sa hodnotia pri každom základe (bez kľúča =
  mimo číselníka, zákonná povinnosť bez odkazu = chýba odkaz). Dlaždice
  rátajú predpis s oboma druhmi v oboch.
- Lehota uchovania je pri oboch druhoch rovnaká (3 roky, ADR-012).
- Znenia spred ADR-017 majú jeden základ v pôvodných poliach a čítajú sa
  ako zoznam s jednou položkou (`basesOf()`); migrácia netreba.
