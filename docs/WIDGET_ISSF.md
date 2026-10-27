# Widget helpdesku pre cudzí systém (ISSF)

> Pre prevádzkovateľa ISSF (Informačný systém slovenského futbalu) a správcu
> kanála v Contineu. **ISSF nie je Sportnet**: Sportnet je platforma
> sportnet.online s CRM a identifikátorom `sportnetID`; ISSF má vlastný
> identifikátor osoby, **registračné číslo**. Rozhodnutie:
> ADR-028, D166. Stav 26. 10. 2026: implementované (krok 5); skúška
> priamo v stránke ISSF prešla (widget sa vykreslí, token z Javy Contineo
> prijme — pozri „Skúška v ISSF"). Naostro neoverené — čaká na tajný kľúč
> kanála a vydávanie tokenu na strane ISSF.

## Ako to funguje

1. Človek je prihlásený v ISSF. ISSF mu po prihlásení vydá **krátko platný
   podpísaný token** (JWT HS256) s jeho identitou.
2. Stránka ISSF vloží skript widgetu z Continea a dá mu token. Widget je
   plávajúce tlačidlo a panel; bez knižníc, v Shadow DOM, farba organizácie.
3. Otázka ide na `/api/widget/<kanál>/chat` na doméne organizácie
   (`intranet.futbalsfz.sk`) s tokenom. Contineo token overí, osobu si
   založí alebo spáruje (bez prístupu do intranetu), odpovie z predpisov
   a FAQ kanála — **len verejný obsah** — a odpoveď zapíše na hodnotenie.
4. Palec dole dvakrát v rozhovore → widget ponúkne **napísať helpdesku**.
   Ticket pristane vo fronte riešiteľov kanála (Kanály → Tickety). Človeku
   príde z adresy schránky kanála **potvrdenie** a tým vznikne e-mailové
   vlákno (ADR-042, D277): riešiteľ odpovedá v ňom a keď človek odpovie
   e-mailom, správa sa pripojí k tomu istému ticketu.

## Čo urobí správca kanála (Contineo)

Kanály (menu, správca organizácie) → kanál typu **widget**:

- **Kľúč kanála** pridelí Contineo pri založení (UUID, napr.
  `6f1d2c3a-9b4e-4c7d-8a2f-1e5b7c9d0a3b`); je na obrazovke kanála.
  Odovzdať prevádzkovateľovi ISSF spolu s tajným kľúčom — ide do `aud`
  tokenu a do adresy skriptu.
- **Povolené pôvody**: `https://issf.futbalsfz.sk` (presný pôvod stránky,
  bez cesty). Z iného pôvodu API odpovie 403.
- **Tajný kľúč**: „Vytvoriť nový tajný kľúč" — ukáže sa **raz**;
  odovzdať prevádzkovateľovi ISSF bezpečným kanálom. Každé ďalšie vytvorenie
  starý zneplatní. Kľúč kanála je verejný (je v adrese skriptu), tajný kľúč
  nie — podpisuje ním tokeny len server ISSF.
- **Obsah kanála** (priečinky knižnice) a **jazyky** — prvý jazyk je jazyk
  textov widgetu, keď token jazyk nenesie.
- **Strop otázok na osobu a hodinu** (predvolene 60).
- **Vzhľad a správanie widgetu** (ADR-042, Dodatok 1 a 2): poloha na
  ôsmich miestach okolo obrazovky — **hore a dole v strede je zatvorený
  widget riadok otázky** (značka, nápoveda, šípka), inde tlačidlo;
  predvolene **hore v strede** (dole by na viacerých obrazovkách ISSF
  prekryl funkčné tlačidlá; hlavička ISSF nie je pripnutá a pri posunutí
  odíde, D286). Veľkosť plachty malá / stredná / veľká /
  **na obrazovku (80 % × 80 %, predvolená)**; na telefóne je plachta celá
  obrazovka. V jazykoch kanála: nápoveda v riadku, text tlačidla,
  privítanie a **vzory otázok** (najviac 6, v prázdnej plachte; klik otázku
  vloží). Prázdna plachta ukáže aj **nedávne otázky** človeka (len z
  widgetu, nie interné z intranetu). Kanál s viac jazykmi má v plachte
  **prepínač jazyka SK / CZ / EN** (texty aj odpoveď; ISSF jazyk v tokene posielať nemusí).
  Widget vyká.
  Všetko sa mení tu, ISSF kód nemení.
- **Ponuka správy helpdesku** (ADR-042, D275, D283): okrem prahu
  neúspechov **stále viditeľný odkaz „Napísať helpdesku“** pod poľom otázky
  po prvej odpovedi (predvolene zapnutý) a **frázy**, pri ktorých widget
  ponúkne správu hneď a asistenta sa nepýta (jedna na riadok, v každom
  jazyku kanála; stačí časť vety, veľké písmená a diakritika nerozhodujú;
  prázdne = predvolené krátke jadrá ako „helpdesk“, „s človekom“,
  „s operátorom“ — slovosled a ohýbanie im nevadia). Formulár správy je predvyplnený poslednou otázkou a ukazuje
  „Odpoveď príde na …“ — e-mail z tokenu.
- **Náhľad widgetu** (tlačidlo pod vzhľadom): uložené nastavenie na
  prázdnej stránke s tokenom prihláseného správcu. Je to skutočný widget —
  otázky sa zapíšu na hodnotenie a správa helpdesku založí ticket. Treba
  tajný kľúč a aspoň jeden povolený pôvod.

## Čo urobí ISSF

### 1. Vydávanie tokenu

Na strane servera ISSF, pre prihláseného používateľa, JWT **HS256**
podpísaný tajným kľúčom kanála:

Názvy `iss`, `aud`, `sub`, `iat`, `exp` sú **štandardné claimy JWT**
a `given_name`, `family_name`, `email` štandardné claimy OIDC (rovnaké
posielajú tokeny Microsoftu a Googlu). Každá JWT knižnica ich sama nastaví
aj overí; preto nemajú vlastné názvy (rozhodnutie Jána 6. 10. 2026).

| claim | význam v ISSF |
|---|---|
| `iss` | **kto token vydal** — pôvod stránky ISSF, napr. `https://issf.futbalsfz.sk`. Musí byť medzi povolenými pôvodmi kanála v Contineu. |
| `aud` | **pre koho je** — kľúč kanála v Contineu (UUID z obrazovky kanála), napr. `6f1d2c3a-9b4e-4c7d-8a2f-1e5b7c9d0a3b`. |
| `sub` | **jedinečný identifikátor osoby v ISSF** — registračné číslo. Podľa neho sa osoba pri ďalšej otázke spozná a riešiteľ ju podľa neho nájde v ISSF. (Iný systém by sem dal svoj identifikátor, napr. platforma Sportnet `sportnetID`.) |
| `email` | e-mail účtu — sem príde odpoveď helpdesku. Musí byť v ISSF overený. |
| `given_name` | meno |
| `family_name` | priezvisko |
| `name` | celé meno — len záloha, keď `given_name` a `family_name` chýbajú |
| `roles` | pole rolí, napr. `["klubový manažér", "rozhodca"]` — vyberá FAQ pre publikum, riešiteľ ich vidí pri tickete |
| `club` | klub (nepovinné) |
| `lang` | `sk`, `cs` alebo `en` (nepovinné) |
| `phone_number` | telefón (štandardný claim OIDC, nepovinné) — z `mobil` alebo `telefon`; riešiteľ ho vidí pri tickete |
| `context` | ďalšie údaje pre riešiteľa ako objekt názov → text, najviac 10 (nepovinné) — napr. `{"ID klubu": "1234", "Zväzy": "ObFZ …", "ID používateľa": "123456", "ID osoby": "654321"}`; **čísla bez oddeľovača tisícov**. Riešiteľ ich vidí v karte „Údaje z issf.futbalsfz.sk" (ADR-042, D276). |
| `iat`, `exp` | vydanie a platnosť; `exp − iat` **najviac 15 minút** |

Token s dlhšou platnosťou Contineo odmietne (`widget.tokenClaims`).
Tolerancia hodín je 60 s.

Príklad (Node):

```js
const { createHmac } = require("node:crypto")
const CHANNEL_KEY = "6f1d2c3a-9b4e-4c7d-8a2f-1e5b7c9d0a3b" // kľúč kanála z Continea
const b64 = s => Buffer.from(s).toString("base64url")
function issueToken(user, secret) {
  const iat = Math.floor(Date.now() / 1000)
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = b64(JSON.stringify({
    iss: "https://issf.futbalsfz.sk", aud: CHANNEL_KEY, sub: user.registrationNumber,
    email: user.email, given_name: user.firstName, family_name: user.lastName,
    roles: user.roles, club: user.club, lang: "sk",
    iat, exp: iat + 15 * 60,
  }))
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")
  return `${header}.${payload}.${sig}`
}
```

Príklad (Java 8+, bez knižníc — **ISSF beží na Apache Wicket**). Ten istý
kód s vyplneným `iss` a `aud` je v nastavení kanála pod **Vzor v Jave**
(`javaTokenExample()` v `app/src/lib/widgetEmbed.ts`); token, ktorý vydal,
overuje `app/tests/widgetEmbed.test.ts`:

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
priezvisko, roly, klub, "sk", telefon, udaje)` — klub a telefón môžu byť
`null`, roly prázdny zoznam, údaje prázdna mapa; `LinkedHashMap` drží
poradie riadkov pri tickete.
`q()` escapuje úvodzovky a spätnú lomku; bez toho by meno ako
`Novák "Jano"` rozbilo JSON a token by neprešiel.

**Kde to vo Wickete sedí** (návrh pre vývojárov ISSF, ich kód nepoznáme):

- tajný kľúč z konfigurácie servera (premenná prostredia, `.properties`
  mimo repozitára), nikdy v zdrojovom kóde ani v stránke;
- `data-token` v **spoločnej šablóne** stránok po prihlásení — napr.
  `AttributeModifier.replace("data-token", …)` na `<script>` v základnej
  stránke, z ktorej dedia ostatné; token sa vydá pri každom vykreslení;
- `/api/contineo-token` ako `mountResource(...)` v `Application.init()` —
  pre prihláseného v session vráti nový token ako `text/plain`,
  neprihlásenému 401.

### 2. Obnova tokenu

Token platí 15 minút, stránka ISSF dlhšie. ISSF vystaví **endpoint na
rovnakom pôvode** (napr. `GET /api/contineo-token`), ktorý prihlásenému
používateľovi vráti nový token — ako čistý text alebo `{"token": "…"}`.
Widget ho zavolá sám, keď API odpovie 401.

### 3. Vloženie skriptu

Hotový kód aj s popisom parametrov je na konci nastavenia kanála
(**Kód na vloženie**, 8. 10. 2026). Tvar:

```html
<div id="contineo-helpdesk-fallback" hidden>
  Pomocníka sa teraz nepodarilo načítať. Napíšte na <a href="mailto:helpdesk@futbalsfz.sk">helpdesk@futbalsfz.sk</a>
</div>
<script src="https://intranet.futbalsfz.sk/api/widget/6f1d2c3a-9b4e-4c7d-8a2f-1e5b7c9d0a3b/script"
        data-token="<token vydaný pri načítaní stránky>"
        data-token-url="/api/contineo-token"
        onerror="document.getElementById('contineo-helpdesk-fallback').hidden=false"
        defer></script>
```

**Kontakt pri výpadku** je nastavenie kanála; prázdne = Kontaktná adresa
organizácie (Organizácia → Všeobecné). Keď skript vôbec nenabehne (výpadok,
vypnutý kanál), `onerror` ukáže náhradný blok. Keď nabehne, ale zlyhá
volanie API, kontakt ukáže sám widget pod chybovou hláškou.

Skript sa cachuje **5 minút** s `ETag` (ADR-042, D284); zmena vzhľadu,
textov alebo farby v Contineu sa prejaví do 5 minút bez zásahu v ISSF.

### 4. Odkazy „Pomoc“ otvárajú widget (len ISSF)

Formulár Pomoc aj stránka `/Pomoc` zanikajú (ADR-042, D285). Odkazy
„Pomoc“ v menu a pätičke ISSF ostanú, ale otvoria panel widgetu. Skript
na to ponúka `ContineoHelpdesk.open()` — otvorí panel a vráti `true`.
Odkaz má ako `href` e-mail helpdesku, takže keď skript nenabehol, otvorí
sa e-mailový klient:

```html
<a href="mailto:helpdesk@futbalsfz.sk"
   onclick="return !(window.ContineoHelpdesk && ContineoHelpdesk.open())">Pomoc</a>
```

Vo Wickete je to obyčajný `ExternalLink` (alebo statické `<a>` v šablóne)
s atribútom `onclick` cez `AttributeModifier` — nie `Link`
s `onClick` na serveri, ten by stránku znova načítal.

Panel sa otvorí prázdny (s privítaním, ak je nastavené): človek najprv
hľadá a správu helpdesku napíše odkazom „Napísať helpdesku“, frázou alebo
po neúspechoch (D275). Je to integrácia ISSF, nie nastavenie kanála;
iný cudzí systém dostane len plávajúce tlačidlo.

## Skúška bez ISSF

Kým ISSF token nevydáva, krok 5 sa dá vyskúšať lokálnou stránkou, ktorá
token podpíše tajným kľúčom kanála sama (to isté, čo urobí ISSF):

```bash
cd app && npm run widget:test -- --company SFZ --channel 6f1d2c3a-9b4e-4c7d-8a2f-1e5b7c9d0a3b --origin http://localhost:4567 --app https://intranet.futbalsfz.sk --email jan@klub.sk --given Ján --family Letko --sub 1234567
```

`--channel` je kľúč kanála z jeho obrazovky. Predtým v Kanáloch pridať
`http://localhost:4567` medzi povolené pôvody kanála. Stránka beží na tom pôvode, vloží skript widgetu
z aplikácie a pri 401 si vyžiada nový token z `/token`. Po skúške pôvod
z kanála odobrať.

## Skúška v ISSF (26. 10. 2026)

Kód na vloženie bol vložený do živej pracovnej plochy ISSF len
v prehliadači (nič sa v ISSF ani Contineu neuložilo). Zistené:

- ISSF je **Apache Wicket** (Java), jQuery 1.6.1; **bez
  Content-Security-Policy**, skript z `intranet.futbalsfz.sk` sa smie
  načítať. Shadow DOM funguje, najvyšší `z-index` stránky je 1005.
- Tlačidlo a panel sa vykreslia vo farbe SFZ; bez platného tokenu widget
  ukáže chybu a kontakt pri výpadku.
- `/api/contineo-token` na ISSF zatiaľ vracia 404 — treba ho pridať.
- **Preflight bez tajného kľúča vracal 503**, prehliadač to hlásil ako
  chybu CORS („Failed to fetch"). Opravené: `OPTIONS` overuje len kanál
  a pôvod (`widgetPreflight`), `widget.noSecret` príde v odpovedi na
  samotné volanie.

Zostáva: tajný kľúč kanála (vytvára Ján na obrazovke kanála), vydávanie
tokenu a `/api/contineo-token` na strane ISSF, vloženie kódu.

## Čo API vracia

| volanie | odpoveď |
|---|---|
| `POST …/chat` `{token, query, language?}` | SSE stream ako `/api/chat` (`phase`, `token`, `citation`, `done`) + `{type:"recorded", id}` po zápise odpovede; 401 s `{error:"widget.token…"}` pri zlom tokene; 429 `widget.rateLimited` nad stropom |
| `POST …/feedback` `{token, id, verdict: 0\|1}` | `{ok:true}`; len vlastné záznamy |
| `POST …/ticket` `{token, message, conversation:[{recordId, question, verdict}]}` | `{ok:true, id}` — ticket vo fronte kanála |

Všetky volania vyžadujú hlavičku `Origin` z povolených pôvodov; preflight
`OPTIONS` vracia 204 s CORS hlavičkami pre ten pôvod.

## Osobné údaje

- **Osoba je e-mailový kontakt, účet ISSF je údaj** (ADR-042, D280). Jeden
  e-mail v ISSF zdieľa viac účtov (rodič za deti, manažér za hráčov), preto
  sa osoba hľadá **podľa e-mailu** a registračné čísla účtov, z ktorých
  z adresy písali, sa **pridávajú do zoznamu** — nič sa neprepisuje a meno
  ostáva z prvého tokenu. Zamestnanec s rovnakou adresou v ISSF aj
  intranete sa len spáruje a intranet mu ostáva. Inak sa osoba založí
  s druhom **`external`**: **nemôže sa prihlásiť do intranetu**, aj keby
  mala adresu, ktorú by prihlásenie prijalo. Import osôb správcom druh
  prepíše a tým ju pustí dnu.
- E-mail, meno, priezvisko, roly, klub, registračné číslo (`sub`),
  telefón a `context` sú kópia z tokenu v čase správy; spolu s adresou
  stránky ISSF, z ktorej človek písal (posiela ju widget), ich riešiteľ
  vidí pri tickete v karte „Údaje z …" (ADR-042, D276).
- Otázky a odpovede sú záznamy v `evaluations` ako pri intranete
  (hodnotenie, kurácia); účel „helpdesk" patrí do informovania dotknutých
  osôb (ADR-022) — doplní DPO.
