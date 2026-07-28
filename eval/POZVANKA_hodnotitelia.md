# Pozvánka pre hodnotiteľov

> Text na rozposlanie. Každému pošlite spoločnú časť + jeho odsek.
> Adresa: **https://app.contineo.app** · prihlásenie odkazom v e-maile, bez hesla.

---

## Spoločná časť

Predmet: **Contineo — prosba o kontrolu odpovedí (asi 1–3 hodiny, dá sa po častiach)**

Ahoj,

skúšame systém, ktorý odpovedá na otázky o našich predpisoch a ku každej odpovedi
uvádza, z ktorého článku ju má. Predtým, než ho niekomu ukážeme, potrebujeme
vedieť, či tie odpovede sedia — a to vieš posúdiť len ty.

**Ako to funguje:**

1. Otvor **https://app.contineo.app** a zadaj svoju pracovnú adresu. Príde ti
   odkaz, klikneš a si prihlásený. Žiadne heslo si pamätať nemusíš.
2. Choď na **Zlatá sada**. Je tam 74 otázok; pri každej je uvedená oblasť,
   takže hneď vidíš, ktoré sú tvoje.
3. Klikni na otázku, stlač **Položiť túto otázku** a prečítaj si odpoveď aj
   doslovné citácie pod ňou.
4. Odpovedz na dve veci: **je to vecne správne?** a **netvrdí niečo, čo v tých
   citáciách nie je?**

Ukladá sa to hneď po kliknutí, žiadne tlačidlo Uložiť. Môžeš prestať kedykoľvek
a pokračovať neskôr.

**Čo je najcennejšie:**

- Ak je odpoveď nesprávna, klikni „Doplniť správnu odpoveď a §" a napíš, ako to
  má byť. Z toho sa systém učí, čo je správne.
- Ak otázka znie neprirodzene — nikto by sa tak nespýtal — **uprav ju**. Otázky
  sú náš návrh, nie zadanie.
- Ak otázka nedáva zmysel vôbec, **vyraď ju** a napíš prečo. To je rovnako
  užitočné ako posudok.

**Dve veci, ktoré ťa môžu prekvapiť:**

Pri niektorých otázkach uvidíš upozornenie, že ide o **zámernú skúšku** — napríklad
„Aké bude zajtra počasie?". Tam systém odpovedať *nemá* a posudzuje sa, či sa
správne zdržal. Bez toho upozornenia by si správne odmietnutie označil ako chybu.

Časť otázok posudzujú **dvaja ľudia nezávisle**. Pri nich neuvidíš, ako to posúdil
ten druhý, kým sa nevyjadríš sám. Nie je to tajnostkárstvo — keby si jeho záver
videl vopred, merali by sme, či si mu uveril, nie či sa zhodnete. Ak sa rozídete,
je to pre nás najcennejší nález: znamená to, že vec nie je jednoznačná ani pre
odborníkov, a systém ju teda nemá rozhodovať sám.

Vďaka,
Jan

---

## Osobné odseky

### Miroslav Richtárik — rozpisy a Súťažný poriadok

Tvoja časť je najväčšia: **36 otázok**, z toho 19 posudzuješ spolu s Lukášom.
Väčšina tých spoločných je typu *„Rozpis určuje inú lehotu ako Súťažný poriadok —
ktorá platí?"* alebo *„Je toto ustanovenie rozpisu ultra vires?"*.

Sú to otázky o vzťahu rozpisu a poriadku, preto ich posudzujete dvaja: ty vieš,
čo rozpis hovorí, Lukáš, či to smie hovoriť. Odhad: **asi 3 hodiny**, pokojne
na viackrát.

### Lukáš Piťek — smernice a Disciplinárny poriadok

Tvoja časť je **19 otázok**. K tomu ťa poprosím o druhý pohľad na **18 otázok
o precedencii** z Miroslavovej časti — či rozpis smie upraviť to, čo upravuje,
a čo platí, keď si odporujú.

Odhad: **asi 3 hodiny**. Tá druhá časť je pre nás najdôležitejšia z celej sady.

### Marek Vavro — Prestupový poriadok

Tvoja časť je **10 otázok** o prestupoch, transferoch maloletých a odstupnom.
Jedna z nich je na precedenciu, tú posúdi ešte niekto druhý.

Odhad: **necelá hodina**.

### Ján Letko — IT a aplikácie

Štyri otázky o ISSF plus päť pascí mimo domény (počasie, hokej, ceny lístkov),
ktoré nepotrebujú odbornosť.

Pozor: systém si staviame sami, takže pri odpovediach máme tendenciu čítať
zhovievavo — vieme, čo tým model „myslel". Preto by sme nemali byť druhým
hlasom pri otázkach na precedenciu.

---

## Priebežná kontrola

```bash
cd ~/Documents/GitHub/contineo/app
node --env-file=.env.local scripts/hodnotenia_prehlad.mjs
```

Ukáže, koľko je hotové, aké sú metriky D9 a **na ktorých otázkach sa hodnotitelia
rozišli**. Nezhoda nie je chyba — je to zoznam miest, kde je výklad sporný.
