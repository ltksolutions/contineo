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

const ALGORITMUS = "aes-256-gcm"
/** GCM odporúča 96-bitový nonce; dlhší sa interne aj tak hashuje. */
const DLZKA_IV = 12
const DLZKA_ZNACKY = 16

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
export function encrypt(text: string, kluc = encryptionKey()): string {
  if (!kluc) throw new SecretError("Šifrovanie nie je nastavené (OAUTH_SECRET_ENCRYPTION_KEY).")
  if (!text) throw new SecretError("Prázdne tajomstvo sa nešifruje.")

  const iv = crypto.randomBytes(DLZKA_IV)
  const c = crypto.createCipheriv(ALGORITMUS, kluc, iv)
  const sifra = Buffer.concat([c.update(text, "utf8"), c.final()])
  const znacka = c.getAuthTag()

  return ["v1", iv.toString("base64url"), znacka.toString("base64url"), sifra.toString("base64url")].join(".")
}

/**
 * Rozšifruje. Hádže, keď kľúč nesedí, zápis je poškodený alebo formát neznámy.
 *
 * Zámerne **nevracia `null`**: volajúci by ho ticho považoval za „tajomstvo
 * nie je nastavené" a poskytovateľ by sa prestal ponúkať bez toho, aby
 * ktokoľvek vedel, že sa v skutočnosti pokazil kľúč.
 */
export function decrypt(ulozene: string, kluc = encryptionKey()): string {
  if (!kluc) throw new SecretError("Šifrovanie nie je nastavené (OAUTH_SECRET_ENCRYPTION_KEY).")

  const casti = ulozene?.split(".") ?? []
  if (casti.length !== 4 || casti[0] !== "v1") {
    throw new SecretError("Neznámy formát zašifrovaného údaja.")
  }

  const iv = Buffer.from(casti[1], "base64url")
  const znacka = Buffer.from(casti[2], "base64url")
  const sifra = Buffer.from(casti[3], "base64url")
  if (iv.length !== DLZKA_IV || znacka.length !== DLZKA_ZNACKY) {
    throw new SecretError("Poškodený zašifrovaný údaj.")
  }

  try {
    const d = crypto.createDecipheriv(ALGORITMUS, kluc, iv)
    d.setAuthTag(znacka)
    return Buffer.concat([d.update(sifra), d.final()]).toString("utf8")
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
export function secretStatus(ulozene: string | undefined): "nenastavene" | "nastavene" | "necitatelne" {
  if (!ulozene) return "nenastavene"
  try {
    return decrypt(ulozene) ? "nastavene" : "necitatelne"
  } catch {
    return "necitatelne"
  }
}
