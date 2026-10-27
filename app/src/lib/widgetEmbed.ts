/**
 * widgetEmbed.ts — kód na vloženie widgetu do cudzej stránky (Ján 8. 10. 2026).
 *
 * Skladá sa tu, nie v šablóne stránky, aby ho bolo možné otestovať
 * a aby nastavenie kanála aj návod (`docs/WIDGET_ISSF.md`) ukazovali to isté.
 *
 * Náhradný blok rieši prípad, keď skript vôbec nenabehne (výpadok, kanál
 * vypnutý, zmenený kľúč): `<script>` vtedy vyvolá `onerror` a skrytý blok
 * s kontaktom sa ukáže. Keď skript nabehne, ale zlyhá volanie API, kontakt
 * ukáže samotný widget (`widgetScript.ts`).
 */

export const FALLBACK_ELEMENT_ID = "contineo-helpdesk-fallback"

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export interface EmbedInput {
  /** Hostiteľ aplikácie organizácie, napr. `intranet.futbalsfz.sk`. */
  host: string
  channelKey: string
  /** Veta náhradného bloku bez adresy, napr. „Pomocníka sa nepodarilo načítať. Napíšte na". */
  fallbackText: string
  /** Kontakt pri výpadku; bez neho sa náhradný blok nevloží. */
  contact: string | null
  /**
   * Popis do HTML komentára nad kódom — kód sa kopíruje k vývojárovi cudzej
   * stránky a obrazovku nastavenia on neuvidí (Ján 8. 10. 2026).
   */
  doc?: { title: string; params: { name: string; text: string }[]; token: TokenDoc }
}

/**
 * Údaje tokenu a či ich server vyžaduje — podľa `verifyWidgetToken()`:
 * bez `iss`, `aud`, `sub`, `email`, `iat`, `exp` token neprejde; meno je
 * odporúčané (riešiteľ ho vidí pri tickete), ostatné nepovinné.
 */
export type ClaimLevel = "required" | "recommended" | "optional"
export const TOKEN_CLAIMS: { name: string; level: ClaimLevel; example: (c: { iss: string; aud: string }) => unknown }[] = [
  { name: "iss", level: "required", example: c => c.iss },
  { name: "aud", level: "required", example: c => c.aud },
  { name: "sub", level: "required", example: () => "1234567" },
  { name: "email", level: "required", example: () => "jan.novak@example.sk" },
  { name: "given_name", level: "recommended", example: () => "Ján" },
  { name: "family_name", level: "recommended", example: () => "Novák" },
  { name: "name", level: "optional", example: () => "Ján Novák" },
  { name: "roles", level: "optional", example: () => ["klubový manažér"] },
  { name: "club", level: "optional", example: () => "FK Príklad" },
  { name: "lang", level: "optional", example: () => "sk" },
  { name: "phone_number", level: "optional", example: () => "+421900123456" },
  { name: "context", level: "optional", example: () => ({ "ID klubu": "1234", "Zväzy": "ObFZ Senica" }) },
  { name: "iat", level: "required", example: () => 1760000000 },
  { name: "exp", level: "required", example: () => 1760000900 },
]

export interface TokenDoc {
  heading: string
  /** Pôvod stránky pre `iss` (prvý povolený) a kľúč kanála pre `aud`. */
  iss: string
  aud: string
  levels: Record<ClaimLevel, string>
  /** Vysvetlenie ku každému údaju podľa názvu. */
  claims: Record<string, string>
  /** Riadky o podpise (hlavička, kľúč, platnosť). */
  signing: string[]
}

/**
 * Vzor obsahu tokenu: JSON s komentárom pri každom riadku — úroveň
 * (POVINNÉ / odporúčané / nepovinné) a čo tam dať. `iss` a `aud` sú
 * skutočné hodnoty kanála. Exportované kvôli obrazovke aj testom.
 */
export function tokenPayloadLines(d: TokenDoc): string[] {
  const rows = TOKEN_CLAIMS.map((c, i) => {
    const value = `  ${JSON.stringify(c.name)}: ${JSON.stringify(c.example({ iss: d.iss, aud: d.aud }))}${i < TOKEN_CLAIMS.length - 1 ? "," : ""}`
    return { value, note: `${d.levels[c.level]} — ${d.claims[c.name] ?? ""}` }
  })
  const width = Math.max(...rows.map(r => r.value.length)) + 2
  return ["{", ...rows.map(r => `${r.value.padEnd(width)}// ${r.note}`), "}"]
}

/** `--` v HTML komentári komentár ukončí; nahradí sa pomlčkou. */
function commentSafe(s: string): string {
  return s.replace(/--+/g, "—").replace(/>/g, "›")
}

function docComment(d: NonNullable<EmbedInput["doc"]>): string[] {
  const pad = Math.max(...d.params.map(p => p.name.length)) + 2
  return [
    `<!-- ${commentSafe(d.title)}`,
    ...d.params.map(p => `     ${p.name.padEnd(pad)}${commentSafe(p.text)}`),
    ``,
    `     ${commentSafe(d.token.heading)}`,
    ...tokenPayloadLines(d.token).map(l => `     ${commentSafe(l)}`),
    ...d.token.signing.map(l => `     ${commentSafe(l)}`),
    `-->`,
  ]
}

export function widgetEmbedCode(i: EmbedInput): string {
  const src = `https://${i.host}/api/widget/${encodeURIComponent(i.channelKey)}/script`
  const lines: string[] = i.doc ? docComment(i.doc) : []
  if (i.contact) {
    lines.push(
      `<div id="${FALLBACK_ELEMENT_ID}" hidden>`,
      `  ${esc(i.fallbackText)} <a href="mailto:${esc(i.contact)}">${esc(i.contact)}</a>`,
      `</div>`,
    )
  }
  lines.push(
    `<script src="${esc(src)}"`,
    `        data-token="TOKEN_Z_VASHO_SERVERA"`,
    `        data-token-url="/api/contineo-token"`,
    ...(i.contact ? [`        onerror="document.getElementById('${FALLBACK_ELEMENT_ID}').hidden=false"`] : []),
    `        defer></script>`,
  )
  return lines.join("\n")
}

/**
 * Vzor vydania tokenu v Jave (skúška v ISSF 26. 10. 2026: ISSF beží na
 * Apache Wicket, vzor v Node mu nepomôže). Čistá Java 8+, bez knižníc —
 * nevieme, ktoré JWT knižnice ISSF smie pridať. `iss` a `aud` sú skutočné
 * hodnoty kanála. Bez komentárov v kóde: vysvetlenie je v texte nad ním
 * (i18n), kód sa nemusí prekladať. Overené `verifyWidgetToken()` v teste
 * `widgetEmbed.test.ts` (podpis, diakritika, úvodzovky v mene).
 */
export function javaTokenExample(c: { iss: string; aud: string }): string {
  return [
    `import java.nio.charset.StandardCharsets;`,
    `import java.util.Base64;`,
    `import java.util.List;`,
    `import java.util.Map;`,
    `import javax.crypto.Mac;`,
    `import javax.crypto.spec.SecretKeySpec;`,
    ``,
    `public final class ContineoToken {`,
    `  static final String ISSUER = ${JSON.stringify(c.iss)};`,
    `  static final String CHANNEL_KEY = ${JSON.stringify(c.aud)};`,
    ``,
    `  public static String issue(String secret, String sub, String email, String givenName,`,
    `                             String familyName, List<String> roles, String club, String lang,`,
    `                             String phone, Map<String, String> context) throws Exception {`,
    `    long iat = System.currentTimeMillis() / 1000;`,
    `    StringBuilder r = new StringBuilder("[");`,
    `    for (int i = 0; i < roles.size(); i++) r.append(i > 0 ? "," : "").append(q(roles.get(i)));`,
    `    r.append("]");`,
    `    StringBuilder c = new StringBuilder("{");`,
    `    for (Map.Entry<String, String> e : context.entrySet()) {`,
    `      if (c.length() > 1) c.append(",");`,
    `      c.append(q(e.getKey())).append(":").append(q(e.getValue()));`,
    `    }`,
    `    c.append("}");`,
    `    String payload = "{\\"iss\\":" + q(ISSUER) + ",\\"aud\\":" + q(CHANNEL_KEY) + ",\\"sub\\":" + q(sub)`,
    `        + ",\\"email\\":" + q(email) + ",\\"given_name\\":" + q(givenName) + ",\\"family_name\\":" + q(familyName)`,
    `        + ",\\"roles\\":" + r + (club != null ? ",\\"club\\":" + q(club) : "") + ",\\"lang\\":" + q(lang)`,
    `        + (phone != null ? ",\\"phone_number\\":" + q(phone) : "") + ",\\"context\\":" + c`,
    `        + ",\\"iat\\":" + iat + ",\\"exp\\":" + (iat + 900) + "}";`,
    `    String h = b64("{\\"alg\\":\\"HS256\\",\\"typ\\":\\"JWT\\"}".getBytes(StandardCharsets.UTF_8));`,
    `    String p = b64(payload.getBytes(StandardCharsets.UTF_8));`,
    `    Mac mac = Mac.getInstance("HmacSHA256");`,
    `    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));`,
    `    return h + "." + p + "." + b64(mac.doFinal((h + "." + p).getBytes(StandardCharsets.UTF_8)));`,
    `  }`,
    ``,
    `  private static String b64(byte[] b) {`,
    `    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);`,
    `  }`,
    ``,
    `  private static String q(String v) {`,
    `    StringBuilder o = new StringBuilder("\\"");`,
    `    for (char ch : v.toCharArray()) {`,
    `      if (ch == '"' || ch == '\\\\') o.append('\\\\').append(ch);`,
    `      else if (ch < 0x20) o.append(String.format("\\\\u%04x", (int) ch));`,
    `      else o.append(ch);`,
    `    }`,
    `    return o.append('"').toString();`,
    `  }`,
    `}`,
  ].join("\n")
}
