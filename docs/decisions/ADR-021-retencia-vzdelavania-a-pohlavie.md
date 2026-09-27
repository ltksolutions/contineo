# ADR-021 — Retencia vzdelávania a pohlavie osoby

> **Stav:** prijaté · **Dátum:** 2026-09-28
> **Rozhodol:** Ján Letko ako DPO (2026-09-28), odpovede na štyri otázky
> **Nadväzuje na:** ADR-012 (retencia reťaze dôkazov, D100–D105), ADR-018
> (modul `learning`, D119, D122), D24, D27
> **Dopĺňa:** ADR-012 o kolekcie modulu Vzdelávanie. Toto je „dodatok k ADR-012"
> z plánu L2 (O24); ADR-012 sa nemení, platí ďalej celé.
> **Implementácia:** čaká — kap. 5.

---

## 1. Kontext

Modul Vzdelávanie (ADR-018) ukladá o osobe nové záznamy: zápis do kurzu,
dokončenie časti, sledovanie videa (ktoré úseky videla), pokusy v testoch
(losované otázky, odpovede, výsledok) a certifikát. ADR-012 určil lehotu len
pre reťaz dôkazov k predpisom; tieto kolekcie v ňom nie sú, takže by sa
nemazali nikdy.

K tomu pribudlo pri osobe **pohlavie** (`persons.gender`) — na tvar
„absolvoval / absolvovala" na certifikáte a na štatistiky zloženia (podiel
žien medzi rozhodcami, v orgánoch). Každý údaj potrebuje účel a právny základ.

---

## 2. Rozhodnutie

### D130 — Záznamy vzdelávania majú lehotu dokladov o oboznámení

Zápisy (`enrollments`), dokončenia častí (`part_completions`), sledovanie
videa (`video_watch`) a pokusy (`test_attempts`) osoby sa mažú **tým istým
pravidlom ako doklady o oboznámení** (ADR-012, D100):

- vyradená osoba: 3 roky od `endedAt`, inak od `deactivatedAt`, inak strop
  5 rokov od poslednej udalosti;
- aktívna alebo pozvaná osoba: nič sa nemaže.

Maže **tá istá denná dávka** (D102) v tom istom režime `RETENTION_MODE`
a zapíše počty do `retention_log`. Posledná udalosť pre strop zahŕňa aj
zápis do kurzu, dokončenie časti a pokus — človek, ktorý pred rokom robil
test, nie je „bez udalosti 5 rokov".

**Prečo rovnako:** doklad o školení a doklad o oboznámení s predpisom slúžia
tomu istému — preukázať, že človek vedel, čo mal. Dve lehoty by znamenali,
že jeden doklad zanikne a druhý o tom istom človeku zostane.

### D131 — Podrobnosti rok po dokončení kurzu

**12 mesiacov po dokončení kurzu** sa zo záznamov toho zápisu odstráni to,
čo je podrobnejšie, než treba na preukázanie:

- v pokusoch **odpovede** (`answers`) a **losované otázky** (`questions`);
  zostane výsledok — body, percentá, prešiel, začiatok, odovzdanie;
  pokus dostane `detailsPurgedAt`;
- **sledovanie videa** (`video_watch`) toho zápisu celé; dokončenie časti
  (`part_completions`) zostáva — to je doklad.

Dokončenie kurzu sa **odvodzuje** (D119, D27), neukladá. **Nedokončený kurz
sa neorezáva**: stav sa odvodzuje aj zo sledovania videa a človek by stratil
rozpozerané video. Zodpovedná osoba teda rok po dokončení vidí, kde ľudia
v teste chybovali; potom už len výsledok.

Je to výnimka z D24 (záznam sa nemení), rovnakého druhu ako výmaz v ADR-012:
jediná cesta je táto dávka.

### D132 — Certifikát po lehote osoby: meno preč, číslo zostáva

Keď osobe uplynie lehota (D130), certifikát sa **nemaže, ale anonymizuje**:

- odstráni sa meno (`holderName: null`), väzba na osobu (`personId`),
  pohlavie (`holderGender`), a nastaví sa `anonymizedAt`;
- **uložené PDF sa zmaže** (`pdfFileId`) — meno je v ňom;
- číslo, kurz, verzia, dátumy, vydavateľ a stav odvolania **zostanú** —
  overenie cez `/verify` (aj QR z papiera, ktorý má človek doma) ďalej
  povie, že certifikát s týmto číslom bol vydaný a platí.

Verejné overenie meno neukazuje ani dnes (rám CERTIFICATE), takže
anonymizácia overenie nezmení. Držiteľ, ktorý má PDF alebo papier, má
doklad naďalej — Contineo len prestane vedieť, komu patrí.

### D133 — Pohlavie osoby

- **Účel:** štatistiky zloženia (podiel žien a mužov v skupinách, orgánoch,
  medzi rozhodcami) a gramatika textov o osobe („absolvoval / absolvovala").
- **Právny základ:** čl. 6 ods. 1 písm. f) — oprávnený záujem. Nejde
  o osobitnú kategóriu (čl. 9).
- **Voliteľné.** Vypĺňa HR (formulár osoby, pozvanie, import). Nevyplnené
  nič neblokuje — certifikát napíše „absolvoval(a)".
- **Z mena sa nehádá** — ani automaticky, ani pri importe.
- **Lehota:** s osobou, ako ostatné evidenčné údaje (`persons`, ADR-012 §4 —
  osud záznamu osoby je otvorený). Na certifikáte je kópia (`holderGender`),
  ktorá zanikne anonymizáciou (D132).

---

## 3. Čo sa tým vedome kazí

- **Po roku sa nedá ukázať, ako človek na otázku odpovedal** — len že test
  urobil s daným výsledkom. Pri spore o konkrétnu odpoveď to nestačí; lehotu
  určil DPO kvôli minimalizácii.
- **Anonymizovaný certifikát sa nedá priradiť človeku** ani na žiadosť
  (napr. „vystavte mi kópiu"). Kópiu si má držať držiteľ.
- **Štatistika podľa pohlavia je len taká úplná, ako HR údaj vyplní.**
  Nevyplnené sa vo výkaze ukáže ako samostatná skupina, nie sa rozpočíta.

---

## 4. Čo tento dokument nerieši

- Osud záznamu osoby (`persons`) po výmaze dokladov — naďalej otvorené (ADR-012 §4).
- Kurzy, banku otázok a testy samotné — nie sú osobné údaje (okrem mien
  zodpovedných osôb pri teste, ktoré sa riadia rolou, nie lehotou).
- Výkaz štatistík podľa pohlavia — samostatná obrazovka, keď bude treba.

---

## 5. Implementácia

Jeden PR:

1. `retentionDb.ts`: `deletePersonEvidence` maže aj `enrollments`,
   `part_completions`, `video_watch`, `test_attempts` osoby a anonymizuje jej
   certifikáty (D130, D132); `lastEvents` započíta udalosti vzdelávania;
   počty v `DeletionCounts`.
2. Denná úloha orezania podrobností (D131) v tom istom crone a režime;
   obrazovka výsledku pokusu povie, že podrobnosti boli po roku odstránené.
3. Testy: výkaz aj ostrý režim, nedokončený kurz sa neoreže, certifikát po
   anonymizácii ďalej overiteľný.
4. `docs/C2_…` a `docs/GDPR_DATA_PROTECTION.md` — v PR s týmto ADR.
