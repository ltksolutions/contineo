/**
 * trackNotify.ts — komu a s čím dať vedieť o trase (2. 10. 2026).
 *
 * Pridanie na trasu pošle e-mail len pri zaškrtnutom „poslať pridaným"
 * (3. 10. 2026, predvolene zapnuté), a len novo pridaným. Inak je dať vedieť
 * samostatné rozhodnutie s náhľadom (`/hr/tracks/[key]/notify`). Píše sa
 * **len tým, ktorí z trasy ešte niečo nepotvrdili**, a len o tom, čo im
 * chýba. Stránka náhľadu aj odoslanie volajú túto funkciu, takže náhľad
 * ukazuje presne to, čo odíde.
 */

import { trackByKey, type Track } from "./tracks"
import { duties, trackStatuses, type Duty } from "./hrReport"
import { listPeople, type PersonRow } from "./people"

export interface TrackRecipient {
  person: PersonRow
  /** Nepotvrdené dokumenty z tejto trasy. */
  open: Duty[]
}

export async function trackRecipients(
  companyCode: string,
  key: string,
): Promise<{ track: Track; recipients: TrackRecipient[] } | null> {
  const track = await trackByKey(companyCode, key)
  if (!track) return null
  const [rows, people] = await Promise.all([duties(companyCode), listPeople(companyCode)])
  const status = trackStatuses(rows).get(track.title)
  const recipients: TrackRecipient[] = []
  for (const person of people) {
    if (person.status === "inactive" || !person.tracks.includes(track.key)) continue
    const open = status?.perPerson.get(person.id)?.open ?? []
    if (open.length > 0) recipients.push({ person, open })
  }
  return { track, recipients }
}
