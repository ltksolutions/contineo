import Link from "next/link";
import Icon from "./Icon";

const DOC_CHUNKS = `{
  _id, documentId, versionId,
  sourceType: "pdf",            // pdf | faq | rss | qa | email

  // tagging (used for filtering at search time)
  sectionKey: "sutazny_poriadok",
  associationCode: "SsFZ",      // "SFZ" = applies to everyone
  scope: "zvaz",                // global | zvaz | oblast
  language: "sk",

  // content
  articleRef: "§ 12 ods. 3",
  heading: "Štart hráča",
  text: "Hráč nesmie nastúpiť v dvoch stretnutiach...",

  // vector + state
  embedding: [0.0123, -0.044, ...],   // 3072 dims
  embeddingModel: "text-embedding-3-large",
  isActive: true,               // false = archived version
  effectiveFrom, effectiveTo
}`;

const TICKETS = `{
  ticketNumber: "CNT-2026-000412",
  source: "bot",                // bot | email
  status: "open",               // lifecycle below
  priority: "normal",
  sectionKey: "prestupovy_poriadok",
  associationCode: "SsFZ",
  requester: { email, name, userRef },
  subject, conversationId,      // full context if from bot
  assignedTo, slaDueAt,
  resolution: { answeredBy, qaPairId, closedAt },
  tags: []
}`;

const VECTOR_QUERY = `db.document_chunks.aggregate([
  { $vectorSearch: {
      index: "chunks_vector",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 8,
      filter: {
        sectionKey:      { $eq: "sutazny_poriadok" },
        associationCode: { $in: ["SsFZ", "SFZ"] },
        isActive:        { $eq: true },
        language:        { $eq: "sk" }
      }
  }},
  { $project: {
      text: 1, heading: 1, articleRef: 1,
      score: { $meta: "vectorSearchScore" }   // -> escalation signal
  }}
])`;

const TAG_EXAMPLES = `// nationwide rule (applies to all associations)
{ sourceType: "pdf", sectionKey: "sutazny_poriadok",
  associationCode: "SFZ", scope: "global",
  articleRef: "§ 12 ods. 3", isActive: true }

// fixtures of a specific association
{ sourceType: "pdf", sectionKey: "rozpis_sutazi",
  associationCode: "SsFZ", scope: "zvaz",
  articleRef: "čl. 8", isActive: true }

// IT FAQ for the ISSF app (FAQ, not a rule)
{ sourceType: "faq", sectionKey: "it_aplikacie",
  associationCode: "SFZ", scope: "global",
  articleRef: null, isActive: true }`;

function Code({ children, label }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--teal-700)", marginBottom: 6 }}>{label}</p>
      )}
      <pre
        style={{
          margin: 0,
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          padding: "14px 16px",
          overflowX: "auto",
          fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
          fontSize: 12.5,
          lineHeight: 1.55,
          color: "var(--ink)",
        }}
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}

function SectionHead({ title, intro }) {
  return (
    <div className="maxw-720" style={{ marginBottom: 28 }}>
      <h2>{title}</h2>
      {intro && <p className="muted" style={{ marginTop: 12 }}>{intro}</p>}
    </div>
  );
}

export default function Tech({ dict, lang }) {
  const t = dict.tech;
  return (
    <main id="main">
      <section
        style={{
          background: "linear-gradient(180deg, var(--surface-2) 0%, var(--bg) 100%)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="container" style={{ padding: "72px 24px 56px", textAlign: "center" }}>
          <span className="eyebrow">{t.eyebrow}</span>
          <h1 className="maxw-720 mx-auto">{t.title}</h1>
          <p className="lead maxw-720 mx-auto" style={{ marginTop: 20 }}>{t.subtitle}</p>
          <div style={{ marginTop: 28 }}>
            <Link className="btn btn--ghost" href={`/${lang}`}>{t.back}</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="center maxw-720 mx-auto" style={{ marginBottom: 36 }}>
            <h2>{t.architectureTitle}</h2>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", padding: "clamp(16px, 3vw, 32px)" }}>
            <img src="/contineo_diagram.png" alt={t.architectureTitle} style={{ width: "100%", height: "auto", display: "block", borderRadius: "var(--radius)" }} />
          </div>
          <p className="muted center" style={{ marginTop: 16, fontSize: 14 }}>{t.architectureCaption}</p>
        </div>
      </section>

      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="container">
          <div className="center maxw-720 mx-auto" style={{ marginBottom: 44 }}>
            <h2>{t.pillarsTitle}</h2>
          </div>
          <div className="grid grid--3">
            {t.pillars.map((p, i) => (
              <div className="card" key={i} style={{ background: "var(--bg)" }}>
                <div className="card__icon"><Icon name={p.icon} size={22} /></div>
                <h3 style={{ marginBottom: 8 }}>{p.title}</h3>
                <p className="muted">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="center maxw-720 mx-auto" style={{ marginBottom: 44 }}>
            <h2>{t.flowsTitle}</h2>
          </div>
          <div className="grid grid--3">
            {t.flows.map((f, i) => (
              <div className="card" key={i}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--teal-500)", marginBottom: 10 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{f.title}</h3>
                <p className="muted" style={{ fontSize: 15 }}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="container">
          <SectionHead title={t.collectionsTitle} intro={t.collectionsIntro} />
          <div className="grid grid--2">
            <Code label={t.collDocLabel}>{DOC_CHUNKS}</Code>
            <Code label={t.collTicketLabel}>{TICKETS}</Code>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead title={t.vectorTitle} intro={t.vectorIntro} />
          <Code>{VECTOR_QUERY}</Code>
        </div>
      </section>

      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="container">
          <SectionHead title={t.taggingTitle} intro={t.taggingIntro} />

          <h3 style={{ fontSize: 17, marginBottom: 12 }}>{t.taggingSectionsTitle}</h3>
          <div style={{ overflowX: "auto", marginBottom: 28 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
              <tbody>
                {t.sections.map((s, i) => (
                  <tr key={i} style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono, monospace)", fontSize: 13, color: "var(--teal-700)", whiteSpace: "nowrap" }}>{s.key}</td>
                    <td style={{ padding: "10px 14px", fontSize: 14 }}>{s.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: 17, marginBottom: 12 }}>{t.scopeTitle}</h3>
          <ul className="muted" style={{ margin: "0 0 28px", paddingLeft: 20, lineHeight: 1.8, fontSize: 15 }}>
            {t.scopes.map((s, i) => <li key={i}>{s}</li>)}
          </ul>

          <Code label={t.taggingExampleLabel}>{TAG_EXAMPLES}</Code>

          <h3 style={{ fontSize: 17, margin: "8px 0 12px" }}>{t.rulesTitle}</h3>
          <ul className="muted" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 15 }}>
            {t.rules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead title={t.ticketTitle} intro={t.ticketIntro} />
          <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
            {t.ticketStages.map((st, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "baseline", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
                <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13, fontWeight: 600, color: "var(--teal-700)", minWidth: 78 }}>{st.s}</span>
                <span className="muted" style={{ fontSize: 14 }}>{st.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="container">
          <div className="center maxw-720 mx-auto" style={{ marginBottom: 44 }}>
            <h2>{t.integrationsTitle}</h2>
          </div>
          <div className="grid grid--3">
            {t.integrations.map((it, i) => (
              <div className="card" key={i} style={{ background: "var(--bg)" }}>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{it.title}</h3>
                <p className="muted">{it.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead title={t.securityTitle} />
          <ul className="muted" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, fontSize: 15, maxWidth: 720 }}>
            {t.security.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      </section>

      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="container">
          <div className="center maxw-720 mx-auto" style={{ marginBottom: 32 }}>
            <h2>{t.stackTitle}</h2>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {t.stack.map((s, i) => (
              <span key={i} style={{ fontSize: 15, background: "var(--teal-50)", color: "var(--teal-700)", border: "1px solid var(--teal-100)", borderRadius: 999, padding: "8px 16px", fontWeight: 500 }}>{s}</span>
            ))}
          </div>
          <div className="center" style={{ marginTop: 36 }}>
            <Link className="btn btn--ghost" href={`/${lang}`}>{t.back}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
