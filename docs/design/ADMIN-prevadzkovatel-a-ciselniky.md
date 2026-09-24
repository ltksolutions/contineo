# ADMIN — prevádzkovateľ a číselníky (Nastavenie organizácie)

Referencia: `ADMIN-prevadzkovatel-a-ciselniky.html`. Základ: `ZAKLAD.md`, `ADMIN.md`. Zdroj: stránka nastavenia organizácie (záložky Vzhľad a jazyky, Číselníky), `legalBasesDb.ts`, `codelistsTenant`, i18n. Snímky `uploads/ADMIN-*`.

## Čo funguje — nemení sa

Polia, ich texty a nápovedy; jeden formulár s jedným Uložiť na záložke Vzhľad a jazyky; samostatný formulár Odstrániť logo; číselníky: základné položky sa nedajú odobrať, vlastné áno (len z ponuky); kľúč natrvalo a predgenerovaný z názvu; právne základy: štandardné skryť, vlastné vyradiť, nič sa nemaže.

## Čo sa mení (podoba)

### Vzhľad a jazyky
1. **Sekcie** v jednej karte: Identita · Farba · Kontakt · Prevádzkovateľ osobných údajov · Jazyky · Automatické založenie. Od 1024 px dva stĺpce (nadpis + vysvetlenie 240 px vľavo, polia vpravo), pod 1024 px pod sebou. Nadpisy sekcií Identita, Kontakt, Automatické založenie sú nové texty; ostatné existujú.
2. **Uložiť** v spodnej lište `position: sticky; bottom: 0` + veta „Jedno uloženie pre celú stránku." (nová).
3. **Kontakt, Sídlo + IČO** vedľa seba (`auto-fit, minmax(200px,1fr)`).
4. **Vlastná farba** za `<details>` „Vlastná hodnota" namiesto tlačidla „Skryť vlastnú hodnotu" + poľa.

### Číselníky
5. **Rozcestník** (kotvy na karty) s počtom položiek.
6. **Riadky so stĺpcami** Názov · Kľúč (mono) · Použitie · akcia; „základná" / „štandardná" ako sivý odznak; počet použití („použitá 1×", „1 znenie") v stĺpci Použitie.
7. **Pridať** — jeden riadok: Nový názov · Kľúč · Pridať, pod ním pravidlo kľúča. ⚠️ **Chyba dnes:** vo všetkých troch zoznamoch je v poliach sivý text „Metodický pokyn / metodicky_pokyn", ktorý vyzerá ako vyplnená hodnota. Má to byť `placeholder` s príkladom pre daný číselník (Druh: „napr. Rozhodnutie", Značka: „napr. mládež", Pracovisko: „napr. Senec").
8. **Právne základy** — skupiny „Plnenie zákonnej povinnosti" / „Oprávnený záujem", `reference` pod názvom; „Skryť" vždy v stĺpci akcie (dnes raz vpravo hore, raz pod textom). Formulár „Pridať právny základ" v `<details>`.
9. **Telefón** — riadok ako dvojica: názov + kľúč · použitie vľavo, akcia vpravo.

## Otázky pre Jána

**Odpovede Jána 24. 9. 2026:** Q1 ✅ „Odstrániť logo" pri logu · Q2 ✅ náhľad vety áno · Q3 ✅ základné položky nad tri zbaliť.

- **Q1** — „Odstrániť logo" ako červený odkaz pri logu namiesto samostatnej karty dole. Je to druhý formulár — vnoriť sa nedá, tlačidlo by bolo `form="remove-logo"` s formulárom mimo. Súhlas?
- **Q2** — Náhľad vety zo stránky Ochrana osobných údajov pod údajmi prevádzkovateľa (bez JS ukazuje uložené hodnoty). Chceš?
- **Q3** — Základné položky nad tri zbaliť („+ ďalších 6 základných")? Nedá sa s nimi nič robiť, len zaberajú miesto.

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | Vzhľad a jazyky, sekcie, sticky Uložiť |
| **834** | Číselníky: Druhy + Právne základy |
| **390** | Číselníky: Druhy |

🔴 Zmena schémy: **žiadna.**
