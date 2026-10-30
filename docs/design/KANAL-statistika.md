# KANAL — štatistika kanála (`/channels/<key>/stats`)

> **Stav: rozhodnuté 30. 10. 2026** — Q1–Q5 podľa odporúčania (A).
> Zadanie: `KANAL-statistika-zadanie.md`. Referencia: `KANAL-statistika.html`
> (hlavná plocha artefaktu *Design* https://claude.ai/artifact/76i98tBN6FphD6xH6WiQTL;
> čísla v ňom sú vymyslené).

## Čo vzniklo

- Nová časť kanála **Štatistika** v podmenu Tickety | Štatistika | Nastavenie,
  len pri kanáli typu widget. Vidí ju riešiteľ kanála aj správca organizácie;
  **cenu a blok AI a cena len správca** (Q3).
- Obdobie `.view-switch` Deň | Týždeň | Mesiac | Rok, kalendárne v čase SFZ,
  týždeň od pondelka (Q2). Šípky `.period-nav` na predchádzajúce a ďalšie
  obdobie, budúce sa neponúka. Stav v adrese `?period=week&at=2026-10-26`.
- Dlaždice `.stat-tiles`: Otázky, Zodpovedané %, Spokojnosť %, Presnosť %,
  Tickety, Cena — so zmenou oproti predchádzajúcemu obdobiu.
- Graf otázok po hodinách / dňoch / mesiacoch (zodpovedané + „nenašlo sa"),
  rebríčky Hodnotenie používateľov a Posudky hodnotiteľa, dlaždice ticketov,
  AI a cena (súhrn, matica účel × deň pri týždni a × mesiac pri roku, inak súčet).
- Odkazy z čísel (Q4): hodnotenia a posudky do `/evaluation` (len hodnotiteľ),
  tickety do zoznamu ticketov kanála (len riešiteľ), cena do Spotreby AI.
- Export Excel (Q5): hárky Súhrn, Kvalita, Tickety, AI a cena; zvolené
  obdobie a 12 predchádzajúcich v stĺpcoch.

## Odchýlky od návrhu

- Stĺpce grafu nie sú odkazy (návrh `a.chart-col`) — k jednému dňu nie je
  zoznam, na ktorý by viedli.
- Súčet nad stĺpcom sa kreslí len do 12 stĺpcov; pri 24 hodinách a 31 dňoch
  by sa prekrýval. Popis osi má pri dni každá tretia hodina, pri mesiaci
  každý piaty deň.
- Matica ceny po stĺpcoch len pri týždni a roku. Deň (24) a mesiac (31)
  majú súčet, podiel a tokeny — tabuľka by bola nečitateľná.
- Nezodpovedané otázky neboli doteraz nikde: vzniká kolekcia
  `unanswered_questions` (kanál a čas, bez znenia a osoby; 25 mesiacov).
  Upozornenie `.lnote` to pri obdobiach pred 31. 10. 2026 hovorí.

## Design system

`.stat-tiles` a `.period-nav` pribudli do `globals.css` a
`.design-sync/conventions.md` (Grafy a matice) so súhlasom Jána (Q1).
