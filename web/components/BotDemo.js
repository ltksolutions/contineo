"use client";

import { useState, useRef } from "react";
import Icon from "./Icon";

export default function BotDemo({ dict, kb }) {
  const d = dict.demo;
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(kb[0]);
  const [notFound, setNotFound] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showTicket, setShowTicket] = useState(false);
  const [ticketDone, setTicketDone] = useState("");
  const fails = useRef({});

  function answer(text) {
    const s = (text || "").toLowerCase();
    let best = null;
    let score = 0;
    kb.forEach((it) => {
      const m = it.k.filter((w) => s.indexOf(w) >= 0).length;
      if (m > score) {
        score = m;
        best = it;
      }
    });
    setFeedback("");
    setShowTicket(false);
    setTicketDone("");
    if (best && score > 0) {
      setResult(best);
      setNotFound(false);
    } else {
      setResult(null);
      setNotFound(true);
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && query.trim()) answer(query);
  }

  function rate(up) {
    if (up) {
      setFeedback(d.thanks);
      if (result) fails.current[result.src] = 0;
    } else {
      setFeedback(d.sorry);
      if (result) {
        fails.current[result.src] = (fails.current[result.src] || 0) + 1;
        if (fails.current[result.src] >= 2) setShowTicket(true);
      }
    }
  }

  function makeTicket(n) {
    setTicketDone(`${n} ` + d.ticketDone);
  }

  function pickRelated(q) {
    setQuery(q);
    answer(q);
  }

  return (
    <section id="demo" className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 40 }}>
          <span className="eyebrow">{d.eyebrow}</span>
          <h2>{d.title}</h2>
          <p className="lead" style={{ marginTop: 16 }}>
            {d.subtitle}
          </p>
        </div>

        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            background: "var(--surface-2)",
            borderRadius: "var(--radius-lg)",
            padding: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                background: "var(--teal-600)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="chat" size={15} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Contineo</span>
            <span className="muted" style={{ fontSize: 12 }}>{d.brand}</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-lg)",
              padding: "10px 14px",
            }}
          >
            <span className="muted" style={{ display: "flex" }}>
              <Icon name="search" size={20} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder={d.placeholder}
              aria-label={d.placeholder}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 16,
                height: 28,
                color: "var(--ink)",
              }}
            />
            <kbd
              style={{
                fontSize: 11,
                color: "var(--muted)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: "2px 6px",
              }}
            >
              Enter
            </kbd>
          </div>

          <div style={{ marginTop: 14 }}>
            {result && (
              <AnswerCard
                d={d}
                it={result}
                feedback={feedback}
                onRate={rate}
                showTicket={showTicket}
                ticketDone={ticketDone}
                onTicket={() => makeTicket("CNT-2026-000413")}
                onRelated={pickRelated}
              />
            )}
            {notFound && (
              <div className="card" style={{ padding: "20px 24px" }}>
                <h3 style={{ fontSize: 16, marginBottom: 6 }}>{d.noAnswerTitle}</h3>
                <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
                  {d.noAnswerText}
                </p>
                {ticketDone ? (
                  <span style={{ fontSize: 14, color: "var(--teal-600)", fontWeight: 600 }}>
                    {ticketDone}
                  </span>
                ) : (
                  <button className="btn btn--ghost" onClick={() => makeTicket("CNT-2026-000414")}>
                    <Icon name="ticket" size={16} /> {d.sendTicket}
                  </button>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid var(--line)",
            }}
          >
            <span className="muted" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="sparkles" size={13} /> {d.poweredBy}
            </span>
            <span className="muted" style={{ fontSize: 12 }}>SsFZ</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnswerCard({ d, it, feedback, onRate, showTicket, ticketDone, onTicket, onRelated }) {
  const cite = it.art ? `${it.src}, ${it.art}` : it.src;
  return (
    <div className="card" style={{ padding: "20px 24px" }}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Icon name="help" size={15} /> {it.q}
      </p>
      <p style={{ fontSize: 16, lineHeight: 1.7, marginBottom: 14 }}>{it.a}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <span
          style={{
            fontSize: 12,
            background: "var(--teal-50)",
            color: "var(--teal-700)",
            borderRadius: "var(--radius)",
            padding: "5px 10px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 600,
          }}
        >
          <Icon name="file" size={14} /> {cite} · {it.ver}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>{d.appliesAll}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <span className="muted" style={{ fontSize: 13 }}>{d.helpful}</span>
        <button className="iconbtn" aria-label={d.yes} onClick={() => onRate(true)}>
          <Icon name="thumbUp" size={16} />
        </button>
        <button className="iconbtn" aria-label={d.no} onClick={() => onRate(false)}>
          <Icon name="thumbDown" size={16} />
        </button>
        {feedback && <span className="muted" style={{ fontSize: 12, marginLeft: 4 }}>{feedback}</span>}
      </div>

      {showTicket && (
        <div
          style={{
            marginTop: 12,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
          }}
        >
          <p style={{ fontSize: 14, marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="ticket" size={16} /> {d.escalateTitle}
          </p>
          <br />
          {ticketDone ? (
            <span style={{ fontSize: 13, color: "var(--teal-600)", fontWeight: 600 }}>{ticketDone}</span>
          ) : (
            <button className="btn btn--ghost" style={{ padding: "8px 14px", fontSize: 13 }} onClick={onTicket}>
              {d.sendTicket}
            </button>
          )}
        </div>
      )}

      {it.rel && it.rel.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{d.related}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {it.rel.map((r, i) => (
              <button key={i} className="chip" onClick={() => onRelated(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .iconbtn { border: 1px solid var(--line); background: #fff; border-radius: var(--radius); width: 34px; height: 30px; cursor: pointer; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; transition: background .15s ease; }
        .iconbtn:hover { background: var(--surface); }
        .chip { font-size: 13px; border: 1px solid var(--line); background: #fff; border-radius: var(--radius); padding: 6px 11px; cursor: pointer; color: var(--muted); transition: background .15s ease, color .15s ease; }
        .chip:hover { background: var(--surface); color: var(--ink); }
      `}</style>
    </div>
  );
}
