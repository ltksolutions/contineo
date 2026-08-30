/**
 * tajomstva.ts — šifrovanie údajov, ktoré musíme uložiť, ale nesmieme prezradiť.
 *
 * Dnes je to jediná vec: `clientSecret` k Entra alebo Google aplikácii
 * zákazníka. Nie je to náš údaj — je to prístup do cudzieho systému, ktorý nám
 * niekto zveril. Uložený v čitateľnej podobe by pri jedinom úniku výpisu
 * z databázy znamenal, že sa dá vydávať za prihlasovaciu bránu zväzu.
 *
 * **AES-256-GCM**, nie AES-CBC: GCM overuje aj neporušenosť, takže zmenený
 * zápis sa nerozšifruje na nezmysel, ale spadne. Pri prístupových údajoch je
 * hlasné zlyhanie správna odpoveď.
 *
 * Kľúč je v `OAUTH_SECRET_ENCRYPTION_KEY` (64 hexadecimálnych znakov = 32
 * bajtov). **Nie je v repozitári a nikdy nebude.** Keď chýba, šifrovanie sa
 * nezapne a poskytovatelia prihlásenia sa jednoducho neponúknu — aplikácia
 * beží ďalej. Padnúť pri štarte kvôli nenastavenej voliteľnej funkcii by
 * znamenalo, že zabudnutá premenná zhodí celý portál vrátane prihlásenia
 * e-mailom, ktoré s ňou nemá nič spoločné.
 */

import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
/** GCM odporúča 96-bitový nonce; dlhší sa interne aj tak hashuje. */
const IV_LENGTH = 12
const TAG_LENGTH = 16

export class SecretError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TajomstvoError"
  }
}

/**
 * Kľúč z prostredia, alebo `null`.
 *
 * Nesprávne dlhý kľúč je **chyba, nie „nemáme kľúč"**: znamená, že ho niekto
 * nastaviť chcel a pomýlil sa, a ticho vypnúť šifrovanie by v takom prípade
 * bolo to najhoršie, čo sa dá spraviť.
 */
export function encryptionKey(hex = process.env.OAUTH_SECRET_ENCRYPTION_KEY): Buffer | null {
  const s = hex?.trim()
  if (!s) return null
  if (!/^[0-9a-fA-F]{64}$/.test(s)) {
    throw new SecretError(
      "OAUTH_SECRET_ENCRYPTION_KEY musí mať 64 hexadecimálnych znakov (32 bajtov). " +
      "Nový vygeneruješ: openssl rand -hex 32"
    )
  }
  return Buffer.from(s, "hex")
}

/** Je šifrovanie k dispozícii? Nehádže — na rozhodovanie, nie na zápis. */
export function encryptionAvailable(): boolean {
  try {
    return encryptionKey() !== null
  } catch {
    return false
  }
}

/**
 * Zašifruje text. Výsledok je jeden reťazec `v1.<iv>.<značka>.<šifra>`
 * v base64url.
 *
 * Predpona verzie tam je preto, aby sa dal formát raz zmeniť bez toho, aby sa
 * staré zápisy stali nečitateľnými — bez nej sa to zistí až vtedy, keď sa
 * pokúsiš rozšifrovať niečo z minulého roka.
 */
export function encrypt(text: string, key = encryptionKey()): string {
  if (!key) throw new SecretError("Šifrovanie nie je nastavené (OAUTH_SECRET_ENCRYPTION_KEY).")
  if (!text) throw new SecretError("Prázdne tajomstvo sa nešifruje.")

  const iv = crypto.randomBytes(IV_LENGTH)
  const c = crypto.createCipheriv(ALGORITHM, key, iv)
  const cipher = Buffer.concat([c.update(text, "utf8"), c.final()])
  const tag = c.getAuthTag()

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), cipher.toString("base64url")].join(".")
}

/**
 * Rozšifruje. Hádže, keď kľúč nesedí, zápis je poškodený alebo formát neznámy.
 *
 * Zámerne **nevracia `null`**: volajúci by ho ticho považoval za „tajomstvo
 * nie je nastavené" a poskytovateľ by sa prestal ponúkať bez toho, aby
 * ktokoľvek vedel, že sa v skutočnosti pokazil kľúč.
 */
export function decrypt(stored: string, key = encryptionKey()): string {
  if (!key) throw new SecretError("Šifrovanie nie je nastavené (OAUTH_SECRET_ENCRYPTION_KEY).")

  const parts = stored?.split(".") ?? []
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new SecretError("Neznámy formát zašifrovaného údaja.")
  }

  const iv = Buffer.from(parts[1], "base64url")
  const tag = Buffer.from(parts[2], "base64url")
  const cipher = Buffer.from(parts[3], "base64url")
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new SecretError("Poškodený zašifrovaný údaj.")
  }

  try {
    const d = crypto.createDecipheriv(ALGORITHM, key, iv)
    d.setAuthTag(tag)
    return Buffer.concat([d.update(cipher), d.final()]).toString("utf8")
  } catch {
    // Skutočná príčina sa zámerne nezverejňuje ďalej — či nesedí kľúč alebo
    // značka, je informácia pre útočníka a pre nás to isté: nedá sa to čítať.
    throw new SecretError("Údaj sa nepodarilo rozšifrovať — nesedí kľúč alebo je zápis poškodený.")
  }
}

/**
 * Náhľad tajomstva pre obrazovku.
 *
 * **Nikdy nevracia hodnotu.** Človek potrebuje vedieť len to, či je niečo
 * nastavené a či sa to dá prečítať; samotné tajomstvo má vo vlastnom Entre.
 */
export function secretStatus(stored: string | undefined): "nenastavene" | "nastavene" | "necitatelne" {
  if (!stored) return "nenastavene"
  try {
    return decrypt(stored) ? "nastavene" : "necitatelne"
  } catch {
    return "necitatelne"
  }
}
