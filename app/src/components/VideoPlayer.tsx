"use client"

/**
 * Prehrávač videa kurzu (rám PART-cast-kurzu, ADR-018 D119, D122).
 *
 * Vlastné ovládanie namiesto systémového: pás musí ukázať **pozreté úseky**
 * a hranicu „najďalej pozreté", a pri povinnom dopozeraní sa dopredu smie
 * pretáčať len po ňu. Systémové ovládanie nič z toho nevie.
 *
 * Pozreté úseky sa posielajú na server každých 10 s, pri pauze, na konci
 * a pri odchode zo stránky (`sendBeacon`). Je to meranie, nie dôkaz —
 * hranicu 90 % vyhodnocuje server (`recordVideoWatch`), nie tento súbor.
 *
 * Bez JavaScriptu zostane `<video controls>` s vetou, že dopozeranie sa
 * nezaznamená (server-side render kreslí systémové ovládanie, klient ho
 * po načítaní nahradí vlastným).
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import Icon from "./Icon"
import { furthestSecond, mergeRanges, watchedShare, WATCH_THRESHOLD, type WatchRange } from "@/lib/learningProgress"

export interface VideoPlayerLabels {
  play: string
  pause: string
  mute: string
  unmute: string
  fullscreen: string
  /** Šablóna s `{p}` — percento pozretého. */
  mustWatchChip: string
  mustWatchNote: string
  watchedChip: string
  noScriptNote: string
  progress: string
}

const SEND_EVERY_MS = 10_000

const noop = () => () => {}

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`
}

export default function VideoPlayer({
  src, poster, durationSec, mustWatch, initialRanges, initialWatched, courseKey, partKey, blockId, labels, recording,
}: {
  src: string
  poster?: string
  durationSec?: number
  mustWatch: boolean
  initialRanges: WatchRange[]
  initialWatched: boolean
  courseKey: string
  partKey: string
  blockId: string
  labels: VideoPlayerLabels
  /** Zapisuje sa len zapísanému človeku. */
  recording: boolean
}) {
  const router = useRouter()
  const video = useRef<HTMLVideoElement>(null)
  const box = useRef<HTMLDivElement>(null)
  // Na serveri `false` (systémové ovládanie), v prehliadači `true` — bez
  // setState v efekte a bez rozdielu pri hydratácii.
  const js = useSyncExternalStore(noop, () => true, () => false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(durationSec ?? 0)
  const [ranges, setRanges] = useState<WatchRange[]>(() => mergeRanges(initialRanges, durationSec))
  const [watched, setWatched] = useState(initialWatched)
  const segment = useRef<WatchRange | null>(null)
  const pending = useRef<WatchRange[]>([])
  const lastTime = useRef(0)

  const guard = mustWatch && !watched
  const furthest = furthestSecond(ranges, duration || undefined)
  const share = watchedShare(ranges, duration || undefined)

  const send = useCallback((beacon = false) => {
    if (!recording) return
    if (segment.current) pending.current.push([...segment.current])
    if (!pending.current.length) return
    const body = JSON.stringify({ courseKey, partKey, blockId, ranges: pending.current, durationSec: duration || undefined })
    pending.current = []
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/learning/watch", new Blob([body], { type: "application/json" }))
      return
    }
    fetch("/api/learning/watch", { method: "POST", body, headers: { "Content-Type": "application/json" } })
      .then(r => (r.ok ? r.json() : null))
      .then((r: { watched?: boolean } | null) => {
        // Hranicu potvrdil server — pás časti (tlačidlo „Označiť") sa prekreslí.
        if (r?.watched && !watched) {
          setWatched(true)
          router.refresh()
        }
      })
      .catch(() => { /* meranie; ďalší pokus o 10 s */ })
  }, [recording, courseKey, partKey, blockId, duration, watched, router])

  useEffect(() => {
    const t = setInterval(() => { if (playing) send() }, SEND_EVERY_MS)
    const leave = () => send(true)
    window.addEventListener("pagehide", leave)
    return () => { clearInterval(t); window.removeEventListener("pagehide", leave) }
  }, [playing, send])

  function onTime() {
    const v = video.current
    if (!v) return
    const now = v.currentTime
    setTime(now)
    if (!v.paused) {
      const step = now - lastTime.current
      // Plynulé prehrávanie predlžuje úsek; skok (pretočenie) začína nový.
      if (segment.current && step >= 0 && step < 1.5) segment.current[1] = now
      else {
        if (segment.current) pending.current.push([...segment.current])
        segment.current = [now, now]
      }
      const seg: WatchRange = [segment.current[0], segment.current[1]]
      setRanges(r => mergeRanges([...r, seg], duration || undefined))
    }
    lastTime.current = now
  }

  function onSeeking() {
    const v = video.current
    if (!v || !guard) return
    // Dopredu len po najďalej pozreté miesto (+1 s tolerancia).
    if (v.currentTime > furthest + 1) v.currentTime = furthest
  }

  function toggle() {
    const v = video.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

  function seekTo(e: React.MouseEvent<HTMLDivElement>) {
    const v = video.current
    if (!v || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    let target = ((e.clientX - rect.left) / rect.width) * duration
    if (guard) target = Math.min(target, furthest)
    v.currentTime = Math.max(0, target)
  }

  function onBarKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const v = video.current
    if (!v) return
    if (e.key === "ArrowLeft") { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5) }
    if (e.key === "ArrowRight") {
      e.preventDefault()
      const target = v.currentTime + 5
      v.currentTime = guard ? Math.min(target, furthest) : target
    }
  }

  const pct = (x: number) => (duration ? `${Math.min(100, (x / duration) * 100)}%` : "0%")

  return (
    <div className="vid-wrap">
      <div className="vid" ref={box}>
        <video
          ref={video}
          src={src}
          poster={poster}
          preload="metadata"
          playsInline
          controls={!js}
          onClick={js ? toggle : undefined}
          onPlay={() => { setPlaying(true); lastTime.current = video.current?.currentTime ?? 0 }}
          onPause={() => { setPlaying(false); send() }}
          onEnded={() => { setPlaying(false); send() }}
          onTimeUpdate={onTime}
          onSeeking={onSeeking}
          onLoadedMetadata={() => { if (!durationSec && video.current) setDuration(video.current.duration) }}
          onVolumeChange={() => setMuted(Boolean(video.current?.muted))}
        />
        {js && (
          <div className="vid-ctrl">
            <button type="button" className="vid-btn" onClick={toggle} aria-label={playing ? labels.pause : labels.play}>
              <Icon name={playing ? "pause" : "play"} size={18} />
            </button>
            <span className="vid-time">{clock(time)} / {clock(duration)}</span>
            <div className="vid-bar" role="slider" tabIndex={0} aria-label={labels.progress}
                 aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(time)}
                 onClick={seekTo} onKeyDown={onBarKey}>
              {ranges.map(([a, b], i) => <span key={i} className="vid-seen" style={{ left: pct(a), width: pct(b - a) }} />)}
              <span className="vid-now" style={{ width: pct(time) }} />
              {guard && <span className="vid-limit" style={{ left: pct(furthest) }} />}
            </div>
            <button type="button" className="vid-btn" onClick={() => { if (video.current) video.current.muted = !video.current.muted }}
                    aria-label={muted ? labels.unmute : labels.mute}>
              <Icon name={muted ? "muted" : "volume"} size={18} />
            </button>
            <button type="button" className="vid-btn" onClick={() => void box.current?.requestFullscreen?.()} aria-label={labels.fullscreen}>
              <Icon name="fullscreen" size={18} />
            </button>
          </div>
        )}
      </div>
      {mustWatch && (watched ? (
        <p className="vchip vchip--ok"><span aria-hidden="true">✓</span> {labels.watchedChip}</p>
      ) : (
        <div className="vchip vchip--warn">
          <span>{labels.mustWatchChip.replace("{p}", String(Math.floor(share * 100)))}</span>
          <span className="vchip-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (share / WATCH_THRESHOLD) * 100)}%` }} /></span>
          <span className="vchip-note">{labels.mustWatchNote}</span>
        </div>
      ))}
      {mustWatch && <noscript><p className="vchip-note">{labels.noScriptNote}</p></noscript>}
    </div>
  )
}
