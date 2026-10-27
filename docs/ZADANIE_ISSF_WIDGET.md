# Zadanie pre vývoj ISSF: pomocník Contineo namiesto formulára Pomoc

> Pre vývojára ISSF (Apache Wicket). Pripravil Ján Letko, SFZ, 27. 10. 2026.
> Technický podklad s podrobnosťami: `docs/WIDGET_ISSF.md`, rozhodnutia
> ADR-042 v repozitári Contineo.

## O čo ide

Formulár **Pomoc** v ISSF (`/Pomoc`), ktorý dnes len prepošle správu na
`helpdesk@futbalsfz.sk`, nahradí **pomocník Contineo**. Je to riadok otázky
hore v strede obrazovky. Človek sa v ňom pýta na predpisy SFZ a návody k ISSF
a odpoveď dostane hneď. Keď odpoveď nenájde, pošle z pomocníka správu
helpdesku a tá v Contineu založí ticket aj s jeho údajmi z ISSF. Odpoveď
helpdesku mu príde e-mailom.

Vzhľad, texty, jazyky a správanie pomocníka sa nastavujú v Contineu.
**ISSF urobí len štyri veci**, raz, a ďalej do pomocníka nezasahuje:

1. vydá prihlásenému používateľovi **podpísaný token** s jeho údajmi,
2. pridá endpoint na **obnovu tokenu**,
3. vloží **skript pomocníka** do stránok po prihlásení,
4. presmeruje odkazy **„Pomoc“** na pomocníka a **zruší formulár a stránku
   `/Pomoc`**.

## Čo dostanete od SFZ

| čo | hodnota |
|---|---|
| kľúč kanála (verejný) | `d9589242-8b85-4850-a10a-a30ebbbe8f18` |
| adresa skriptu | `https://intranet.futbalsfz.sk/api/widget/d9589242-8b85-4850-a10a-a30ebbbe8f18/script` |
| **tajný kľúč kanála** | pošle Ján Letko **zvlášť, bezpečnou cestou** (nie e-mailom s týmto zadaním) |
| povolené pôvody | `https://issf.futbalsfz.sk`; **adresu testovacieho ISSF nám pošlite**, pridáme ju |

Tajný kľúč patrí len na server ISSF: do konfigurácie mimo repozitára
(premenná prostredia alebo `.properties`). **Nikdy** do zdrojového kódu,
šablóny, JavaScriptu ani logov. Ak unikne, SFZ vytvorí nový a starý prestane
platiť.

## 1. Token pre prihláseného používateľa

JWT podpísaný **HS256** tajným kľúčom kanála. Vydáva ho server ISSF pri
každom vykreslení stránky po prihlásení. **Platnosť najviac 15 minút.**

| claim | povinné | obsah z ISSF |
|---|---|---|
| `iss` | áno | `https://issf.futbalsfz.sk` (na testovacom ISSF jeho adresa) |
| `aud` | áno | kľúč kanála `d9589242-8b85-4850-a10a-a30ebbbe8f18` |
| `sub` | áno | **registračné číslo** (`login`) |
| `email` | áno | overený e-mail účtu — sem príde odpoveď helpdesku |
| `given_name`, `family_name` | áno | meno, priezvisko |
| `roles` | áno | pole rolí, napr. `["klubový manažér"]`; prázdne pole, keď nemá žiadnu |
| `club` | nie | klub |
| `phone_number` | nie | `mobil`, inak `telefon` |
| `lang` | nie | `sk`, `cs` alebo `en`, ak ISSF jazyk používateľa pozná |
| `context` | nie | ďalšie údaje pre helpdesk, objekt názov → text, **najviac 10**, čísla bez medzier, napr. `{"ID klubu": "1234", "Zväzy": "ObFZ …", "ID používateľa": "123456", "ID osoby": "654321"}` |
| `iat`, `exp` | áno | čas vydania a platnosti v sekundách; `exp − iat ≤ 900` |

Údaje z `context` a telefón vidí riešiteľ pri tickete v tabuľke „Údaje
z ISSF“. Sú to tie isté údaje, ktoré dnes posiela formulár Pomoc
(`sys_*`, `zvazy` …). Čas a prostredie netreba posielať.

**Vzor v Jave 8+ bez knižníc** — trieda `ContineoToken`. Rovnaký kód
s vyplneným `iss` a `aud` je v Contineu v nastavení kanála pod „Kód na
vloženie → Token na serveri“; overili sme, že ho Contineo prijme:

```java
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class ContineoToken {
  static final String ISSUER = "https://issf.futbalsfz.sk";
  static final String CHANNEL_KEY = "d9589242-8b85-4850-a10a-a30ebbbe8f18";

  public static String issue(String secret, String sub, String email, String givenName,
                             String familyName, List<String> roles, String club, String lang,
                             String phone, Map<String, String> context) throws Exception {
    long iat = System.currentTimeMillis() / 1000;
    StringBuilder r = new StringBuilder("[");
    for (int i = 0; i < roles.size(); i++) r.append(i > 0 ? "," : "").append(q(roles.get(i)));
    r.append("]");
    StringBuilder c = new StringBuilder("{");
    for (Map.Entry<String, String> e : context.entrySet()) {
      if (c.length() > 1) c.append(",");
      c.append(q(e.getKey())).append(":").append(q(e.getValue()));
    }
    c.append("}");
    String payload = "{\"iss\":" + q(ISSUER) + ",\"aud\":" + q(CHANNEL_KEY) + ",\"sub\":" + q(sub)
        + ",\"email\":" + q(email) + ",\"given_name\":" + q(givenName) + ",\"family_name\":" + q(familyName)
        + ",\"roles\":" + r + (club != null ? ",\"club\":" + q(club) : "") + ",\"lang\":" + q(lang)
        + (phone != null ? ",\"phone_number\":" + q(phone) : "") + ",\"context\":" + c
        + ",\"iat\":" + iat + ",\"exp\":" + (iat + 900) + "}";
    String h = b64("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
    String p = b64(payload.getBytes(StandardCharsets.UTF_8));
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    return h + "." + p + "." + b64(mac.doFinal((h + "." + p).getBytes(StandardCharsets.UTF_8)));
  }

  private static String b64(byte[] b) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }

  private static String q(String v) {
    StringBuilder o = new StringBuilder("\"");
    for (char ch : v.toCharArray()) {
      if (ch == '"' || ch == '\\') o.append('\\').append(ch);
      else if (ch < 0x20) o.append(String.format("\\u%04x", (int) ch));
      else o.append(ch);
    }
    return o.append('"').toString();
  }
}
```

Volanie: `ContineoToken.issue(secret, registracneCislo, email, meno,
priezvisko, roly, klub, "sk", telefon, udaje)`. Klub a telefón môžu byť
`null`, roly prázdny zoznam, údaje prázdna mapa (`LinkedHashMap` drží
poradie). Ak ISSF jazyk nepozná, pošlite `"sk"`. Pomocník má aj vlastný
prepínač jazyka SK / CZ / EN.

## 2. Obnova tokenu

Token platí 15 minút, stránka ISSF býva otvorená dlhšie. Pridajte endpoint
**na rovnakej doméne ako ISSF**, napr. `GET /api/contineo-token`:

- prihlásenému používateľovi vráti **nový token** ako `text/plain`
  (alebo JSON `{"token": "…"}`);
- neprihlásenému vráti **401**;
- nesmie sa cachovať (`Cache-Control: no-store`).

Pomocník ho zavolá sám, keď mu Contineo odpovie, že token vypršal.

Vo Wickete napr. `mountResource("/api/contineo-token", …)` v
`Application.init()`.

## 3. Vloženie pomocníka

Do **spoločnej základnej stránky po prihlásení** (z ktorej dedia ostatné),
pred `</body>`:

```html
<div id="contineo-helpdesk-fallback" hidden>
  Pomocníka sa teraz nepodarilo načítať. Napíšte na <a href="mailto:helpdesk@futbalsfz.sk">helpdesk@futbalsfz.sk</a>
</div>
<script src="https://intranet.futbalsfz.sk/api/widget/d9589242-8b85-4850-a10a-a30ebbbe8f18/script"
        data-token="TOKEN_Z_KROKU_1"
        data-token-url="/api/contineo-token"
        onerror="document.getElementById('contineo-helpdesk-fallback').hidden=false"
        defer></script>
```

- `data-token` vyplní server pri každom vykreslení, vo Wickete napr.
  `AttributeModifier.replace("data-token", …)` na komponente `<script>`.
- Na stránkach **pred prihlásením** sa pomocník nevkladá.
- Náhradný blok sa ukáže, len keď sa skript nepodarí načítať.

Pomocník beží v Shadow DOM: štýly ISSF ho neovplyvnia a on neovplyvní ISSF.
Nepotrebuje jQuery ani inú knižnicu.

## 4. Odkazy „Pomoc“ a zrušenie formulára

Všetky odkazy **„Pomoc“** (hore pod menom, pätička, text na Pracovnej ploche
„… kliknutím na odkaz Pomoc …“) budú otvárať pomocníka:

```html
<a href="mailto:helpdesk@futbalsfz.sk"
   onclick="return !(window.ContineoHelpdesk && ContineoHelpdesk.open())">Pomoc</a>
```

Ak sa pomocník nenačíta, odkaz otvorí e-mail na helpdesk.

Vo Wickete je to statické `<a>` v šablóne alebo `ExternalLink` s
`onclick` cez `AttributeModifier`. **Nie** `Link` s `onClick()` na
serveri, ten by znova načítal stránku.

Potom **zrušte formulár Pomoc a stránku `/Pomoc`**, vrátane položky
„formulár Pomoc“ v Elektronickej podateľni. Text na Pracovnej ploche,
ktorý na formulár odkazuje, upravte, napr.: „V prípade akýchkoľvek problémov
sa opýtajte pomocníka hore na stránke alebo napíšte na
helpdesk@futbalsfz.sk.“

Kedy to spustiť naostro, dohodneme. Formulár sa vypína v deň spustenia
pomocníka, nie neskôr.

## Postup a skúška

1. **Testovacie ISSF:** pošlite nám jeho adresu. SFZ ju pridá medzi
   povolené pôvody a pošle tajný kľúč.
2. Implementujte body 1–3 na testovacom ISSF (`iss` = adresa testovacieho
   ISSF).
3. Spolu vyskúšame (kontrolný zoznam nižšie). Potom body 1–4 na ostrom ISSF.

**Kontrolný zoznam** (robí sa po prihlásení):

- [ ] Hore v strede je riadok „Máte otázku? …“. Pri prvej návšteve sa pod ním
      ukáže tip „Nový pomocník SFZ“.
- [ ] Kliknutie do riadku otvorí pomocníka. Otázka dostane odpoveď so zdrojmi
      (nie chybu „token“ ani „Pomocníka sa nepodarilo načítať“).
- [ ] Stránka ostala otvorená vyše 15 minút, otázka stále prejde (obnova
      tokenu).
- [ ] „Napísať helpdesku“ → „Odoslať helpdesku“ založí v Contineu ticket
      s menom, registračným číslom, rolami, klubom, telefónom a údajmi
      z `context`. Na e-mail z tokenu príde potvrdenie.
- [ ] Odkaz „Pomoc“ otvorí pomocníka a neotvorí stránku `/Pomoc`.
- [ ] V zdrojovom kóde stránky v prehliadači nie je tajný kľúč, je tam len
      token.
- [ ] Odhlásený používateľ pomocníka nevidí. `/api/contineo-token` mu vráti 401.

Keď niečo nejde, hlásenie z pomocníka a čas pošlite Jánovi Letkovi. Chyby
tokenu majú v odpovedi kód (`widget.tokenClaims`, `widget.tokenSignature`
a podobne).

## Čo ISSF robiť nemusí

- vzhľad, polohu, texty, jazyky, vzory otázok ani správanie pomocníka —
  to je nastavenie v Contineu a zmena sa v ISSF prejaví do 5 minút;
- ukladať otázky, odpovede ani tickety — všetko je v Contineu;
- posielať e-maily helpdesku — robí to Contineo.
