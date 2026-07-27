/**
 * authAdapter.ts — úložisko prihlasovania nad našou MongoDB.
 *
 * Prečo vlastný a nie `@next-auth/mongodb-adapter`: ten oficiálny vyžaduje
 * ovládač `mongodb` verzie 4 alebo 5, my používame 6. Dá sa to obísť cez
 * `--legacy-peer-deps`, ale to znamená spoliehať sa, že sa medzi verziami
 * nezmenilo nič podstatné — a keby áno, prejaví sa to až za behu, pri
 * prihlasovaní právnika. Tento súbor má osemdesiat riadkov, ktorým rozumieme.
 *
 * Sedenie beží na JWT, takže tabuľky sedení nepotrebujeme. Adaptér musí
 * pokryť len dve veci: používateľov a jednorazové prihlasovacie tokeny.
 */

import type { Adapter, AdapterUser, VerificationToken } from "next-auth/adapters"
import type { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"

interface UlozenyPouzivatel {
  _id?: ObjectId
  id: string
  email: string
  emailVerified: Date | null
  name?: string | null
  image?: string | null
}

const bezMongoId = (d: UlozenyPouzivatel | null): AdapterUser | null =>
  d ? { id: d.id, email: d.email, emailVerified: d.emailVerified, name: d.name, image: d.image } : null

export function mongoAdapter(): Adapter {
  const pouzivatelia = () => getCollection<UlozenyPouzivatel>("auth_users")
  const tokeny = () => getCollection<VerificationToken>("auth_tokens")

  return {
    async createUser(u: Omit<AdapterUser, "id">) {
      const zaznam: UlozenyPouzivatel = {
        id: crypto.randomUUID(),
        email: u.email,
        emailVerified: u.emailVerified ?? null,
        name: u.name ?? null,
        image: u.image ?? null,
      }
      await (await pouzivatelia()).insertOne(zaznam)
      return bezMongoId(zaznam)!
    },

    async getUser(id) {
      return bezMongoId(await (await pouzivatelia()).findOne({ id }))
    },

    async getUserByEmail(email) {
      // E-maily porovnávame bez ohľadu na veľkosť písmen. Bez toho by sa
      // „Jan.Letko@" a „jan.letko@" stali dvomi rôznymi používateľmi
      // a druhý by nebol na zozname pozvaných.
      return bezMongoId(await (await pouzivatelia()).findOne({ email: email.toLowerCase() }))
    },

    // Prihlasujeme sa výhradne e-mailom, žiadny externý účet sa nepripája.
    async getUserByAccount() { return null },
    async linkAccount() { return undefined },

    async updateUser(u) {
      const { id, ...zvysok } = u
      await (await pouzivatelia()).updateOne({ id: id! }, { $set: zvysok })
      return bezMongoId(await (await pouzivatelia()).findOne({ id: id! }))!
    },

    async createVerificationToken(t) {
      await (await tokeny()).insertOne(t)
      return t
    },

    /**
     * Vymení token za povolenie prihlásiť sa — a hneď ho zmaže.
     *
     * `findOneAndDelete` je tu podstatné: keby sa najprv čítalo a potom
     * mazalo, dal by sa ten istý odkaz použiť dvakrát. Pri prihlasovacom
     * odkaze, ktorý chodí e-mailom a môže skončiť v cudzej schránke, to
     * nie je teoretická obava.
     */
    async useVerificationToken({ identifier, token }) {
      const col = await tokeny()
      const najdeny = await col.findOneAndDelete({ identifier, token })
      if (!najdeny) return null
      const { _id, ...zvysok } = najdeny as VerificationToken & { _id?: unknown }
      return zvysok as VerificationToken
    },

    // Sedenie drží JWT v cookie, takže tieto metódy sa nikdy nezavolajú.
    // Musia však existovať, aby typ sedel.
    async createSession(s) { return s },
    async getSessionAndUser() { return null },
    async updateSession() { return null },
    async deleteSession() { return undefined },
  }
}
