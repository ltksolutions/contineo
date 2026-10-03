import { CopyLink } from 'contineo-design-system'

/** Skopírovanie overovacej adresy certifikátu — tiché tlačidlo. */
export function VerifyLink() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <code style={{ fontSize: 'var(--fs-small)' }}>https://intranet.futbalsfz.sk/verify/SFZ-2026-0142</code>
      <CopyLink value="https://intranet.futbalsfz.sk/verify/SFZ-2026-0142" label="Kopírovať odkaz" done="Skopírované" />
    </div>
  )
}
