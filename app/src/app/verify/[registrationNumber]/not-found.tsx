/**
 * Certifikát sa nenašiel — zlé číslo aj zlý hash dávajú **tú istú**
 * odpoveď (404), bez loga organizácie. Neprezradí sa, či číslo existuje.
 */

import { ContineoMark } from "@/components/ContineoMark"
import { currentTenant } from "@/lib/session"
import { dictionary } from "@/lib/i18n"

export default async function VerifyNotFound() {
  const tenant = await currentTenant().catch(() => null)
  const t = dictionary(tenant?.defaultLanguage).learning.cert
  return (
    <div className="vf">
      <section className="card vf-card">
        <h1 className="mc-h2">{t.vNotFound}</h1>
        <p>{t.vNotFoundText}</p>
        <p className="quiet mc-note">{t.vSecurity}</p>
      </section>
      <p className="vf-foot quiet"><ContineoMark size={16} /> {t.vFooter}</p>
    </div>
  )
}
