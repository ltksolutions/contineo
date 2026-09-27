/**
 * Bloky obsahu časti kurzu (rám PART-cast-kurzu, ADR-018 D117) — text,
 * obrázok, galéria, dokument z knižnice, video interné a externé.
 *
 * Serverový komponent; jediný klientsky kus je `VideoPlayer`. Súbory idú
 * cez `/api/learning/media/[id]` (prístup podľa kurzu), PDF znenia cez
 * `/api/documents/[id]/pdf?version=` — odkaz na **konkrétne znenie**
 * z kurzu, nie na práve platné (D118).
 */

import Link from "next/link"
import type { Part } from "@/lib/courses"
import type { CourseDocInfo } from "@/lib/courseDocs"
import { embedUrl } from "@/lib/courseView"
import { isWatched, type ProgressFacts } from "@/lib/learningProgress"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import FormattedText from "./FormattedText"
import VideoPlayer from "./VideoPlayer"

const media = (id: string) => `/api/learning/media/${encodeURIComponent(id)}`

export default function ContentBlocks({
  part, courseKey, facts, docs, recording, language,
}: {
  part: Part
  courseKey: string
  facts: ProgressFacts
  docs: Map<string, CourseDocInfo>
  /** Zapísaný človek — sledovanie videa sa zapisuje. */
  recording: boolean
  language: UiLanguage
}) {
  const tp = dictionary(language).learning.part
  const labels = {
    play: tp.play, pause: tp.pause, mute: tp.mute, unmute: tp.unmute, fullscreen: tp.fullscreen, progress: tp.progress,
    mustWatchChip: tp.mustWatchChip, mustWatchNote: tp.mustWatchNote, watchedChip: tp.watchedChip, noScriptNote: tp.noScriptNote,
  }

  return (
    <div className="pp-blocks">
      {part.blocks.map(b => {
        switch (b.type) {
          case "text":
            return <div key={b.id} className="blk-text"><FormattedText text={b.markdown} /></div>
          case "image":
            return (
              <figure key={b.id} className="blk-fig">
                {/* eslint-disable-next-line @next/next/no-img-element -- súbor z GridFS za prístupovou kontrolou, nie statický obrázok */}
                <img src={media(b.fileId)} alt={b.alt} loading="lazy" />
                {b.caption && <figcaption>{b.caption}</figcaption>}
              </figure>
            )
          case "gallery":
            return (
              <div key={b.id} className="blk-gal">
                {b.items.map(it => (
                  <a key={it.fileId} href={media(it.fileId)} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element -- ako vyššie */}
                    <img src={media(it.fileId)} alt={it.alt} loading="lazy" />
                  </a>
                ))}
              </div>
            )
          case "document": {
            const info = docs.get(b.id)
            return (
              <div key={b.id}>
                <div className="card bdoc">
                  <span className="bdoc-ico" aria-hidden="true">PDF</span>
                  <div className="bdoc-main">
                    <div className="bdoc-kick">{tp.docKicker}</div>
                    <span className="bdoc-title">{b.title}</span>
                    <div className="bdoc-meta">
                      {/* Označenie znenia už nesie dátum účinnosti (ADR-016). */}
                      {info?.label ?? tp.docMissing}
                    </div>
                  </div>
                  {info?.label && (
                    <div className="bdoc-act">
                      <a className="button button--quiet" href={`/api/documents/${encodeURIComponent(b.documentId)}/pdf?version=${encodeURIComponent(b.versionId)}`} target="_blank" rel="noopener">{tp.openPdf}</a>
                      <Link className="lc-link" href={`/documents/${encodeURIComponent(b.documentId)}`}>{tp.docDetail}</Link>
                    </div>
                  )}
                </div>
                {/* PART Q2 ✅: odkaz ostáva na znenie z kurzu, novšie sa len oznámi. */}
                {info?.newer && <p className="bdoc-newer">{tp.docNewer(info.newer.label)}</p>}
              </div>
            )
          }
          case "video": {
            if (b.source.kind === "external") {
              const url = embedUrl(b.source.provider, b.source.url)
              return (
                <div key={b.id} className="vid-wrap">
                  {url
                    ? <div className="vid vid--embed"><iframe src={url} title={tp.externalChip} allow="fullscreen; picture-in-picture" loading="lazy" /></div>
                    : <p className="bdoc-newer">{tp.externalBad}</p>}
                  <p className="vchip vchip--neutral">{tp.externalChip}</p>
                </div>
              )
            }
            const w = facts.watches.find(x => x.partKey === part.key && x.blockId === b.id)
            return (
              <VideoPlayer
                key={b.id}
                src={media(b.source.assetId)}
                poster={b.posterFileId ? media(b.posterFileId) : undefined}
                durationSec={b.durationSec}
                mustWatch={b.mustWatch}
                initialRanges={w?.watchedRanges ?? []}
                initialWatched={Boolean(w && isWatched(w.watchedRanges, b.durationSec ?? w.durationSec))}
                courseKey={courseKey}
                partKey={part.key}
                blockId={b.id}
                labels={labels}
                recording={recording}
              />
            )
          }
        }
      })}
    </div>
  )
}
