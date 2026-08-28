# Udalosti a upozornenia — koncepcia

> **Stav: rozsah A schválený 2026-08-28 (D40 = a).** Zadanie: na úvodnej strane widget „Nevybavené
> žiadosti" a interný systém upozornení, aby človek videl, čo je nové a čo
> nevybavené. Rozšírené o poznámku zo zadania: pri novej verzii normy vznikne
> **udalosť**, ktorá rozpošle úlohu prideleným skupinám a osobám.
>
> Zaradenie: **Fáza 9**, nadväzuje na Fázu 8 (onboarding) a otvára sa smerom
> k Fáze 4b (helpdesk).

---

## 1. Prečo to nie je len widget

Dnes je „čo mám urobiť" roztrúsené: normy na potvrdenie sú na `/dokumenty`,
helpdesk zatiaľ neexistuje, systémové hlásenia nikde. Kto sa prihlási, nevie
bez preklikania, či naňho niečo čaká.

To je zrejmá časť. Menej zrejmá je druhá: **rozposlanie úlohy je dnes tiché.**
Keď pribudne nová verzia normy, `trackProgress()` ju začne rátať ako
nepotvrdenú všetkým, koho sa trasa týka — bez toho, aby to niekto rozhodol,
a bez stopy, kedy sa to stalo. Pri oprave preklepu to znamená sto ľudí
potvrdzujúcich to isté znova (otvorené ako **D30 / O13**).

Widget bez tohto rozhodnutia by problém zväčšil: dal by tichému rozposlaniu
viditeľné miesto na úvodnej strane.

---

## 2. Kľúčové rozlíšenie: úloha sa odvodzuje, pridelenie sa zaznamenáva

Fáza 8 stojí na tom, že **stav sa neukladá, ale odvodzuje** (D27): progres je
prienik krokov trasy a existujúcich potvrdení. Toto pravidlo zostáva.

Pridáva sa k nemu druhé, na prvý pohľad protichodné:

| Vec | Odkiaľ sa berie | Prečo tak |
|---|---|---|
| **Čo mám urobiť** | odvodí sa (trasa × platná verzia − potvrdenia) | druhá kópia pravdy sa rozíde práve pri novej verzii, teda vtedy, keď na správnosti najviac záleží (D27) |
| **Že sa to má urobiť znova** | **záznam** (`assignments`) | je to ľudské rozhodnutie, nie výpočet — systém nevie odlíšiť opravu preklepu od novej povinnosti (D30) |
| **Kedy a komu to bolo pridelené** | **záznam** | bez neho sa po roku nedá povedať, či človek úlohu dostal |

Rovnaký vzor ako pri potvrdeniach: `acknowledgements` je záznam, nie príznak.
Kto potvrdil, má to zapísané doslovne; čo má potvrdiť, sa dopočíta.

---

## 3. Čo widget ukazuje

**Osobná schránka: „čo čaká na mňa."** Nie prehľad organizácie — ten je iná
obrazovka s inými právami (rozsah B). Bežný člen zväzu nemá vidieť, kto zo
sto ľudí ešte nepotvrdil.

Zdroje položiek sú rôzne, tvar je jeden:

```ts
interface PendingItem {
  source: "acknowledgement" | "curation" | "helpdesk"
  id: string
  title: string
  href: string
  /** Odkedy to čaká — z pridelenia, nie z dnešného dňa. */
  since: Date
}
```

Widget nevie nič o normách ani tiketoch; pýta sa registra zdrojov. Nový zdroj
sa pridá bez zásahu do widgetu — inak by každý ďalší modul znamenal ďalšiu
vetvu v komponente, ktorý má len vypísať zoznam.

Zdroje v rozsahu A: **nepotvrdené normy**. Kurácia a helpdesk až keď existujú.

---

## 4. Dátový model

### 4.1 `assignments` — udalosť pridelenia

```ts
interface Assignment {
  companyCode: string
  /** Čo sa prideľuje. */
  subject: { type: "document"; documentId: string; versionId: string }
  /** Komu. Prienik, nie postupnosť — človek dostane úlohu raz, aj keď spadá do dvoch skupín. */
  audience: { tracks?: string[]; groups?: string[]; personIds?: string[] }
  /** Prečo sa prideľuje znova. Vypĺňa človek, nikdy sa neodvodzuje (D30). */
  reason: "new-document" | "substantial-change" | "ad-hoc"
  note?: string
  assignedBy: string
  assignedAt: Date
  /** Do kedy sa má úloha vybaviť. Prázdne = bez termínu. */
  dueAt?: Date | null
}
```

**Čo tu zámerne nie je:** zoznam osôb, ktorým sa úloha ukázala. Ten sa odvodí
z `audience` a aktuálneho stavu `persons`. Uložený zoznam by o mesiac klamal —
ľudia pribúdajú aj odchádzajú.

### 4.2 Skupiny

Dnes existuje `persons.tracks` (čo mám prejsť) a `persons.department` (kam
patrím v organizačnej štruktúre). Ani jedno nie je skupina na prideľovanie:
trasa je obsah, útvar je štruktúra.

Návrh: `persons.groups: string[]` ako **tretia, samostatná dimenzia**.
Zlúčiť ju s trasami by znamenalo, že sa nedá prideliť jednorazová úloha bez
toho, aby sa vyrobila umelá trasa.

---

## 5. Ako sa počíta „nové"

Voľba zo zadania: **upozornenia sa odvodzujú, vlastná kolekcia sa nerobí.**
Úloha je „nová", keď je jej pridelenie novšie než `persons.lastLoginAt` —
pole, ktoré už existuje a už sa zapisuje.

Cena tejto voľby, aby bola vidno dopredu:

- **Nedá sa označiť ako prečítané.** Príznak „nové" zmizne pri ďalšom
  prihlásení, nie kliknutím.
- Kto sa prihlási dvakrát rýchlo za sebou, o príznak príde.

Za to sa nezakladá žiadna nová kolekcia s osobnými údajmi o správaní, ktorú by
bolo treba odôvodniť a mazať (O15, O16).

> **Pri implementácii rozsahu A sa ukázalo, že to nestačí (2026-08-28).**
> `lastLoginAt` povie, *kedy sa človek naposledy prihlásil*, ale porovnávať to
> treba s tým, *kedy mu úloha pribudla* — a to v rozsahu A neexistuje.
> Náhrady sú obe zlé: `effectiveFrom` je právna platnosť, takže norma platná
> od roku 2019 by nebola „nová" ani pri prvom stretnutí; `publishedAt` je
> nepovinné a importované dokumenty ho nemusia mať.
>
> Preto rozsah A **„odkedy to čaká" ani príznak „nové" neukazuje vôbec.**
> Radšej nesľúbiť nič, než ukázať číslo, ktoré znamená niečo iné, než čo je
> pri ňom napísané. Oboje pribudne v rozsahu B, keď ich dodá `assignedAt` —
> jediné pole, ktoré na to má správny význam. Rozhodnutie D39 tým zostáva
> v platnosti: vlastná kolekcia upozornení sa nezakladá.

---

## 6. Rozpor, ktorý treba pomenovať

Zadanie žiada aj **interné hlásenia systému**. Časť z nich sa odvodiť **nedá**:

| Druh | Odvodí sa? |
|---|---|
| „Máte 3 normy na potvrdenie" | áno — z trás a potvrdení |
| „Pribudla nová verzia smernice X" | áno — z `assignments` |
| „Import zlyhal 3. 9. o 4:00" | **nie** — udalosť, ktorá nezanechala stav |
| „HR vám poslala odkaz" | **nie** |

Jednorazové hlásenie nemá stav, z ktorého by sa dalo dopočítať. Buď:

- **(a)** rozsah A ich nemá vôbec a widget ukazuje len úlohy — čisté, ale
  „interný systém notifikácií" to ešte nie je;
- **(b)** pribudne malá kolekcia `notifications` len na tieto správy, so
  stavom prečítané a retenciou.

**✅ Rozhodnuté 2026-08-28: (a).** Rozsah A jednorazové hlásenia nemá; widget
ukazuje výhradne úlohy. Kolekcia `notifications` vznikne až vtedy, keď bude
existovať prvý skutočný odosielateľ takých správ (kurácia alebo helpdesk) —
inak by vznikla kolekcia bez odosielateľa a s ňou aj povinnosť odôvodniť ju
v O15/O16.

**Dôsledok pre názov:** v rozsahu A to je zoznam úloh, nie „systém
notifikácií". Ak to tak nazveme v rozhraní, človek bude čakať aj hlásenia,
ktoré tam nebudú. Widget sa preto volá tak, ako znelo zadanie —
**„Nevybavené žiadosti"** — a nie „Upozornenia".

---

## 7. Fázovanie

**Rozsah A** ✅ **hotové 2026-08-28** — widget má čo ukazovať
- register zdrojov + `PendingItem`
- zdroj „nepotvrdené normy" nad existujúcim `trackProgress()`
- widget na úvodnej strane nad hľadaním, mobile first
- **„odkedy" a „nové" sa presunuli do rozsahu B** — viď poznámku nižšie

**Rozsah B `[1–1,5 týždňa]`** — prideľovanie prestane byť tiché
- kolekcia `assignments` + `persons.groups`
- obrazovka pre HR/kurátora: „prideliť verziu skupine", s dôvodom
- opätovné potvrdenie pri novej verzii sa naviaže na pridelenie (uzatvára D30)
- prehľad pre rolu `hr`: čo je nevybavené v organizácii

**Rozsah C** — až keď existujú ďalšie zdroje
- kurácia (dokumenty čakajúce na kurátora, otvorený rozpor s D25)
- helpdesk (Fáza 4b)
- prípadné jednorazové hlásenia podľa bodu 6

---

## 8. Otvorené rozhodnutia

| # | Otázka | Stav |
|---|---|---|
| **D36** | Widget ukazuje „čo čaká na mňa", nie prehľad organizácie | ✅ rozhodnuté 2026-08-28 |
| **D37** | Úloha sa odvodzuje, pridelenie sa zaznamenáva ako udalosť | 🟡 návrh |
| **D38** | `persons.groups` ako tretia dimenzia vedľa trás a útvarov | 🟡 návrh |
| **D39** | „Nové" sa počíta voči `lastLoginAt`, bez stavu prečítané | ✅ rozhodnuté 2026-08-28 |
| **D40** | Jednorazové systémové hlásenia sa v rozsahu A nerobia | ✅ rozhodnuté 2026-08-28 — možnosť (a) |

**Súvisiace:** D27 (progres sa odvodzuje), D30/O13 (čo je podstatná zmena —
rozsah B ho uzatvára), D32 (viditeľnosť per `companyCode`), D25 (kurácia),
O15/O16 (právny základ a retencia).
