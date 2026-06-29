import Link from "next/link";
import Icon from "./Icon";

const DOC_CHUNKS = `{
  _id, documentId, versionId,
  sourceType: "pdf",            // pdf | faq | rss | qa | email

  // tagging (used for filtering at search time)
  sectionKey: "smernice",
  companyCode: "ACME-BA",       // "ACME" = applies company-wide
  scope: "company",         // global | company | region
  language: "sk",

  // content
  articleRef: "čl. 4 ods. 2",
  heading: "Práca z domu (home office)",
  text: "Zamestnanec má nárok na home office...",

  // vector + state
  embedding: [0.0123, -0.044, ...],   // 1024 dims (Voyage AI voyage-4)
  embeddingModel: "voyage-4",         // Automated Embedding in Atlas
  isActive: true,               // false = archived version
  effectiveFrom, effectiveTo
}`;

const TICKETS = `{
  ticketNumber: "CNT-2026-000412",
  source: "bot",                // bot | email
  status: "open",               // lifecycle below
  priority: "normal",
  sectionKey: "hr",
  companyCode: "ACME-BA",
  requester: { email, name, userRef },
  subject, conversationId,      // full context if from bot
  assignedTo, slaDueAt,
  resolution: { answeredBy, qaPairId, closedAt },
  tags: []
}`;

const VECTOR_QUERY = `db.document_chunks.aggregate([
  { $rankFusion: {
      input: {
        pipelines: {
          vector: [{ $vectorSearch: {
            index: "rag_vector_index",   // voyage-4 auto-embed
            path: "embedding",
            queryVector: queryEmbedding, // 1024 dims
            numCandidates: 200, limit: 20,
            filter: { sectionKey: { $eq: "smernice" },
                      companyCode: { $in: ["ACME-BA","ACME"] },
                      isActive: { $eq: true } }
          }}],
          fulltext: [{ $search: {
            index: "rag_text_index",
            text: { query: queryText, path: "text" }
          }}]
        }
      },
      combination: { weights: { vector: 0.6, fulltext: 0.4 } }
  }},
  { $limit: 10 },
  { $rerank: {
      index: "rag_rerank_index",         // voyage-rerank-2
      query: queryText, limit: 8
  }},
  { $project: {
      text: 1, heading: 1, articleRef: 1,
      score: { $meta: "rankFusionScore" }  // -> escalation signal
  }}
])`;

const TAG_EXAMPLES = `// company-wide policy (applies to all units)
{ sourceType: "pdf", sectionKey: "smernice",
  companyCode: "ACME", scope: "global",
  articleRef: "čl. 4 ods. 2", isActive: true }

// document specific to one unit
{ sourceType: "pdf", sectionKey: "hr",
  companyCode: "ACME-BA", scope: "company",
  articleRef: "čl. 8", isActive: true }

// IT FAQ for an internal app (FAQ, not a policy)
{ sourceType: "faq", sectionKey: "it_aplikacie",
  companyCode: "ACME", scope: "global",
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
          {t.exampleNote && (
            <p className="muted maxw-720 mx-auto" style={{ marginTop: 16, fontSize: 14 }}>{t.exampleNote}</p>
          )}
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

      {t.caseStudy && (
        <section className="section">
          <div className="container">
            <div style={{ maxWidth: 720, margin: "0 auto", background: "var(--teal-50)", border: "1px solid var(--teal-100)", borderRadius: "var(--radius-lg)", padding: "clamp(20px, 3vw, 32px)" }}>
              <span className="eyebrow" style={{ color: "var(--teal-700)" }}>{t.caseStudy.eyebrow}</span>
              <h2 style={{ marginTop: 8 }}>{t.caseStudy.title}</h2>
              <p className="muted" style={{ marginTop: 12 }}>{t.caseStudy.intro}</p>
              <ul className="muted" style={{ margin: "16px 0 0", paddingLeft: 20, lineHeight: 1.8, fontSize: 15 }}>
                {t.caseStudy.points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}

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
