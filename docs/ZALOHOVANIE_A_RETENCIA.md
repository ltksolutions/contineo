# Zálohovanie a retencia — prevádzková politika

> **Čo to je:** ako sa dáta zálohujú, ako sa obnovujú a ako dlho sa držia — po kolekciách.
> **Čo to nie je:** právne stanovisko. Retenčné lehoty pri reťazi dôkazov **nie sú
> rozhodnuté** a čakajú na odpoveď k O16 (`docs/O15_O16_otazky_pre_DPO.md`, časť B).
> **Súvisiace:** `docs/GDPR_DATA_PROTECTION.md` (kap. 4 a 7), `docs/ATLAS_SETUP.md`,
> `docs/ADR-005-retaz-dokazov.md`, `docs/ADR-002-datova-rezidencia.md`.
> **Založené:** 2026-09-14.

## 1. Čo sa zálohuje

**Všetko je v jednom Atlas clusteri** (M10, AWS Frankfurt, Cloud Backup zapnutý od
2026-08-28) — a to je zámer, nie náhoda: dátová rezidencia sa rieši raz, pri Atlase
(ADR-002). Druhé úložisko by znamenalo druhé miesto, kde žijú údaje zákazníka,
a druhú zálohovaciu politiku, ktorá sa s prvou rozíde.

Dôsledok, ktorý stojí za vyslovenie: **pôvodné nahraté PDF a DOCX sú v zálohe tiež.**
Sú v GridFS (`cms_files`) v tom istom clusteri, nie v cudzej službe. Otázka „čo bolo
v tom PDF, ktoré nám poslali" má preto odpoveď aj po obnove.

| Čo | Kde | V zálohe |
|---|---|---|
| Všetkých 17 kolekcií (`documents`, `acknowledgements`, `persons`, …) | Atlas M10 | áno |
| Pôvodné nahraté súbory | GridFS `cms_files`, ten istý cluster | áno |
| Fotky osôb | `person_photos` | áno |
| Značka organizácie (logo) | `tenant_assets` | áno |
| Tajomstvá (`.env`, tokeny) | Vercel Environment Variables | **nie** — a nemajú byť |

**Tajomstvá v zálohe nie sú a to je správne.** Obnova databázy preto nie je obnova
prevádzky: bez premenných prostredia sa aplikácia nerozbehne. Kto obnovuje, musí mať
prístup aj k nim — viď kap. 4.

## 2. Čo treba overiť v konzole

Zápis hovorí, že Cloud Backup je zapnutý. **Nehovorí, akú má politiku** — a predvolená
politika Atlasu nie je to isté ako rozhodnutie. Pred ostrou prevádzkou treba
v konzole overiť a sem doplniť:

- [ ] frekvencia snímok a ako dlho sa držia (hodinové / denné / týždenné / mesačné)
- [ ] či je zapnutý **Point-in-Time Restore** (a teda aké je reálne RPO)
- [ ] či sú snímky uložené v **EÚ** — záloha mimo EÚ by zmarila ADR-002
- [ ] kto má v Atlase právo obnoviť a kto ho má odobrať

Kým to nie je overené, **RPO a RTO sú neznáme**. Tvrdiť číslo, ktoré nikto nezmeral,
je horšie než priznať, že sa nevie.

## 3. Retencia po kolekciách

Legenda: **TTL** = maže databáza sama · **O16** = čaká na právnika · **—** = drží sa,
kým existuje predmet (dokument, organizácia)

| Kolekcia | Lehota | Ako sa maže | Stav |
|---|---|---|---|
| `acknowledgements` | od skončenia pracovného pomeru | ručne, dávkou | **O16** |
| `assignments` | ako `acknowledgements` | ručne, dávkou | **O16** |
| `document_opens` | ako `acknowledgements` | ručne, dávkou | **O16** |
| `approval_rounds` | ako `acknowledgements` | ručne, dávkou | **O16** |
| `persons` | počas aktívneho vzťahu + lehota pre reťaz dôkazov | ručne | **O16** — viď nižšie |
| `person_photos` | s osobou | s osobou | **O16** |
| `reading_times` | 12 mesiacov | **TTL** `reading_ttl` | ✅ rozhodnuté 2026-09-06 |
| `reminder_log` | 90 dní | **TTL** `reminder_log_ttl` | ✅ rozhodnuté |
| `audit` | 24 mesiacov | zatiaľ **nemaže sa** | ⬜ TTL nie je zavedený |
| `evaluations` | 12 mesiacov | zatiaľ nemaže sa | ⬜ |
| `documents`, `document_chunks`, `cms_folders`, `cms_files` | kým je dokument v knižnici | s dokumentom (`npm run docs:delete`) | ✅ |
| `tenants`, `tenant_assets`, `departments`, `onboarding_tracks` | kým existuje organizácia | ručne | ✅ |

### `persons` je zložitejšie než „zmazať po odchode"

Osoba odíde zo zväzu a lokálna kópia identity by sa mala zmazať (GDPR kap. 4,
„Identita"). Lenže **`acknowledgements` na ňu ukazujú cez `personId`** a doklad
o oboznámení má prežiť odchod — práve preto, aby sa dal použiť pri spore, ktorý
vznikne až po ňom (O16/B1).

Zmazať osobu a nechať doklady by znamenalo doklady bez toho, koho sa týkajú.
Záznam v `acknowledgements` si síce nesie **odtlačok** mena, adresy a oddelenia
v čase potvrdenia (D24, D50) — takže je čitateľný sám o sebe — ale spojenie „toto
je tá istá osoba" drží `personId`.

Sú tri cesty a **vybrať musí právnik**, nie my:

1. **Osobu nechať do konca lehoty pre doklady** a potom zmazať oboje naraz.
   Najjednoduchšie, ale drží identitu dlho po odchode.
2. **Osobu anonymizovať** (meno a adresu preč, `personId` a pracovný vzťah
   zostanú) a doklady nechať. Doklad si nesie odtlačok mena, takže zostáva
   čitateľný; z `persons` zmizne, kto to bol.
3. **Zmazať oboje pri odchode.** Čisté, ale reťaz dôkazov (ADR-005) prestane
   existovať presne vtedy, keď býva potrebná.

Náš návrh je **2**. Otázka je v `O15_O16_otazky_pre_DPO.md` časť B; tento zápis ju
nepredbieha, len pomenúva, prečo pri `persons` nestačí jedno číslo.

## 4. Obnova

**Obnova databázy nie je obnova prevádzky.** Postup, kým nie je overená kap. 2:

1. Atlas → Backup → vybrať snímku → obnoviť do **nového clustera**, nie cez bežiaci.
   Obnova cez bežiaci cluster zahodí všetko, čo vzniklo od snímky — a pri auditnom
   zázname to znamená zahodiť dôkazy.
2. Overiť obsah na obnovenom clusteri: `npm run check` (invarianty medzi dokumentmi,
   úsekmi a potvrdeniami) a `npm run smoke` (celá reťaz vyhľadávania).
3. Až potom prepnúť `MONGODB_URI` vo Verceli.
4. **Vektorové a fulltextové indexy sa musia vytvoriť znova** — Atlas Search indexy
   nie sú súčasťou obnovy dát. `scripts/atlas_init.mjs`, potom `npm run smoke`.
5. Zapísať do `CHANGELOG.md`, čo sa obnovovalo a prečo.

- [ ] **Skúšobná obnova sa nikdy nerobila.** Záloha, ktorá sa neobnovila, je
      domnienka. Naplánovať jednu do testovacieho projektu a zmerať, ako dlho trvá
      — to číslo je RTO.

## 5. Záloha vs. právo na výmaz

Toto je miesto, kde sa zálohovanie a GDPR bijú a treba to mať napísané **predtým**,
než sa niekto spýta.

Keď sa údaj na žiadosť zmaže z prevádzkovej databázy, **v starších snímkach zostáva**
až do ich expirácie. Snímky sa kvôli jednej osobe neprepisujú — je to technicky
neúnosné a zároveň by to znamenalo meniť zálohu, čo je presne to, čo záloha robiť
nesmie.

Pravidlo, ktoré navrhujeme zapísať do záznamu o spracovateľských činnostiach:

- výmaz sa vykoná v prevádzkovej databáze **bezodkladne**;
- v zálohách údaj zanikne **uplynutím retencie snímok** (číslo doplniť po kap. 2);
- ak sa medzitým zo zálohy obnovuje, **výmaz sa po obnove zopakuje** — a je to krok
  v postupe obnovy, nie vec, na ktorú si niekto spomenie;
- žiadateľa o výmaz o tomto informujeme.

- [ ] Doplniť krok „zopakovať vykonané výmazy" do kap. 4 ako číslovaný bod, keď bude
      existovať evidencia vykonaných výmazov. Dnes taká evidencia **nie je** — a bez
      nej sa ten krok nedá vykonať, len sľúbiť.

## 6. Čo z toho je otvorené

| # | Čo | Kto rozhodne |
|---|---|---|
| 1 | Politika snímok, PITR, rezidencia záloh (kap. 2) | IT — stačí pozrieť do konzoly |
| 2 | Retenčné lehoty reťaze dôkazov | právnik (O16) |
| 3 | Čo s `persons` po odchode — cesty 1/2/3 (kap. 3) | právnik (O16) |
| 4 | Skúšobná obnova a zmeranie RTO | IT |
| 5 | TTL pre `audit` a `evaluations` | IT, po potvrdení lehôt |
| 6 | Evidencia vykonaných výmazov (kap. 5) | IT, až po O16 |
