---
name: contineo-project
description: "Contineo — intelligent search + helpdesk over a company's own content (the user's project)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6c79673a-d79b-41c7-ac1a-4688b5eb4f4d
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

Contineo: SaaS for fast, intelligent search + helpdesk/ticketing over a tenant company's own content (websites, projects, regulations, internal guidelines). Stack: MongoDB Atlas (Vector Search) + Node.js + Next.js. Future versions: auto-generated portal/website from sources. (Originally named "Helpy", renamed to Contineo.)

Domain: contineo.app (live, deployed on Vercel from GitHub) — this is the MARKETING web (`web/`). The RAG APP (`app/`) IS now deployed: https://app.contineo.app (Vercel project `contineo-app`, root dir `app`, team `ltksolutions-projects`), Atlas cluster in Frankfurt, magic-link login via Ecomail. Cluster tier is **M0 (Free) — no backups**; production requires M10+ (see [[onboarding-faza8]] D31).
GitHub repo: github.com/ltksolutions/contineo (SSH remote: git@github.com:ltksolutions/contineo.git). Marketing web lives in `web/` (Next.js 14.2.x, App Router, SK/EN via app/[lang]); Vercel Root Directory = web/. Design docs + brand voice in `docs/`. Public-facing texts are data-driven from `web/lib/dictionaries.js` (dict.sk / dict.en); the /technologia page renders from `dict.tech` via `web/components/Tech.js`.

**Architecture diagram is GENERATED — never hand-edit the SVGs.** Source of truth: `web/scripts/gen_diagram.py` (layout + SK/CS/EN dictionary) → writes `web/public/contineo_diagram{,.cs,.en}.svg` and `docs/contineo_diagram.svg`. Added 2026-08-27 because four hand-maintained copies had already drifted (docs said `rerank-2.5`, web said `rerank-2`). PNG is not referenced by any code (Tech.js uses only the SVG) — it is a convenience artifact; render it with headless Chromium, not ImageMagick.

WORKING PRACTICE (decided 2026-06-25): work EXCLUSIVELY inside the cloned git repo. No scratch copies / loose docs outside the repo. See [[git-workflow-mounted-repo]].

CANONICAL CLONE: `/Users/janletko/Documents/GitHub/contineo` (HTTPS remote). The old "Samouciaci system Helpdesku" mount is now an EMPTY folder — no divergence risk any more; ignore it.

DELIVERY MODEL (D34, decided 2026-08-27): primary product is **contineo.app as multi-tenant SaaS for small and mid-size companies**. Large organisations get **their own deployment of the same platform** — same repo, own infrastructure and DB, behaviour set by tenant profile (ADR-001 adapters, ADR-002 residency/tier) — **NOT a source fork**. A fork means undeliverable security fixes and N incompatible Contineos. If a source fork is ever required (state, bank, tender condition), that is a licensing decision — repo already has LICENSE, LICENSES/, REUSE.toml.

MULTI-TENANT HIERARCHY + VISIBILITY (D32, decided 2026-08-27 — the user corrected an earlier wrong version, get this right): `companyCode` + `parent` models headquarters → subsidiaries → sites (for SFZ: union → regional → district). **Visibility has exactly three sources and no others: (1) matching `companyCode`, (2) the viewer's code listed in `sharedWithCompanyCodes[]`, (3) `accessLevel: public`. `companyCode.parent` grants NOTHING** — the hierarchy is for relevance and for norm precedence (PRECEDENCIA_NORIEM R4), never for access. A subsidiary does not see the parent's internal content by being a subsidiary.
[stated] 2026-09-17: tenanti musia byť „galvanicky" oddelení — filter `companyCode` vždy, zdieľanie dokumentov medzi tenantmi (`sharedWithCompanyCodes`) radšej nie; toto mení zdroje 2 a 3 z D32 vyššie.
**Do not confuse the two axes:** `scope` (`global`/`company`/`region`) says WHO A NORM APPLIES TO; `accessLevel` + `companyCode` say WHO MAY SEE IT. `DATA_MODEL_konzistencia.md` warns about this explicitly — an earlier draft of D32 used `scope: global` as an access grant and had to be corrected. Rationale for strictness: "sees too much" fails silently, "sees too little" fails loudly — pick the loud failure.

Positioning/voice: "Opýtajte sa. Nehľadajte." + claim "Odpovede z vášho sveta, nie z internetu." Core idea: answers from the company's OWN content, not the public internet.

Data-privacy principle (important, advertised on site): customer content stays in the tenant's own MongoDB + storage; AI is only a helper that answers strictly from that content via RAG; no public consumer AI; public models are never trained on the data. Privacy is HYBRID per tenant: default = enterprise AI API with zero-retention + no-training + EU residency; option = fully self-hosted embedding+LLM so data never leaves the tenant's infrastructure. Two deployment modes: (1) standalone locked intranet portal on a subdomain with SSO (Entra/Google Workspace), (2) embeddable Contineo search icon that opens an overlay on any site. Full voice guide in docs/brand-messaging.md. See [[terminal-commands-preference]].
