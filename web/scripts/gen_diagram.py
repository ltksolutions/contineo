#!/usr/bin/env python3
"""
gen_diagram.py — jediný zdroj pre architektonický diagram Continea.

Prečo generátor a nie tri ručne udržiavané SVG: predtým existovali štyri kópie
(docs/ zdroj + SK/CS/EN vo web/public/) a už sa rozišli — docs verzia niesla
„rerank-2.5", webová „rerank-2". Rozdiel dvoch bajtov, ktorý si nikto nevšimol.
Tu je rozloženie na jednom mieste a jazyky sú len slovník.

Spustenie:  python3 web/scripts/gen_diagram.py
Výstup:     web/public/contineo_diagram{,.cs,.en}.svg  +  docs/contineo_diagram.svg
PNG:        rendruje sa zvlášť (nie je nikde v kóde použité, len pre dokumenty).
"""

import os

# ─────────────────────────────────────────────────────────────── rozloženie ──
W, H = 1520, 1010
BOX_Y, BOX_H, BOX_W = 236, 372, 264
COLS = [40, 333, 626, 919, 1212]          # ľavý okraj piatich stĺpcov
ARROW_Y = BOX_Y + 186                     # 422 — zvislý stred stĺpcov
FRAME = dict(x=26, y=170, w=586, h=524)   # CMS obopína kanály + worker


def y(orig):
    """Pôvodné súradnice boli počítané od BOX_Y=170; celý riadok sa posunul."""
    return orig + 66


# ─────────────────────────────────────────────────────────────────── jazyky ──
SK = dict(
    title="Contineo — architektúra a dátový tok",
    subtitle="CMS (kanály · spracovanie · review) → MongoDB (jadro) → AI adaptéry → rozhrania. Adaptéry sa vyberajú konfiguráciou tenanta, nie kódom.",
    identity="Zdroj identity a CRM (osoby, jednotky, roly) · auto-zakladanie používateľov",

    cms_h="CMS — SPRÁVA OBSAHU",
    cms_sub="jediné miesto pravdy pre obsah — knižnica, verzie, tagy, review",
    cur_h="KURÁTOR — brána pred publikovaním",
    cur_sub="tagy z číselníka → review → publish · kanál smie len predvyplniť, publikuje človek",

    ch_h="VSTUPNÉ KANÁLY", ch_sub="obsah aj integrácie = jedna vrstva",
    ch1="• PDF normy a smernice", ch2="• RSS / web (Všeobecné info)", ch3="• FAQ",
    ch4="• E-mail (IMAP)  ⇅", ch5="• MCP konektory",
    ch5a="Drive · SharePoint · Confluence", ch5b="Notion · Slack …",
    ch_note="⇅ e-mail je aj výstupný kanál",

    wk_h="WORKER", wk_sub="spracovanie (mimo DB)",
    wk1="• Chunking — úryvok po §/čl.", wk2="• Značkovanie z číselníka:",
    wk2a="sekcia · scope · companyCode", wk2b="verzia (effectiveFrom/To)",
    wk3="• Embedding pri ingescii", wk3a="cez adaptér podľa profilu",
    wk4="• Verzovanie — staré chunky", wk4a="isActive:false, nemazať",

    db_h="MongoDB — JADRO", db_sub="rovnaké dotazy cloud aj on-prem",
    db1="• $vectorSearch + $search", db2="• $rankFusion — hybrid",
    db2a="vektor 60 % + fulltext 40 %", db3="• Filter companyCode",
    db3a="default-deny, pred LLM",
    coll_label="Kolekcie:",
    coll1="documents (+ versions) · document_chunks",
    coll2="channels · channel_runs · navigation",
    coll3="categories · qa_pairs · tickets",
    coll4="conversations · tenant_profiles",
    coll5="persons · acknowledgements · onboarding_tracks",
    hier1="companyCode.parent — hierarchia tenantov",
    hier2="centrála → dcéry → prevádzky",
    db_note="Atlas EU · alebo Community 8.2 on-prem",

    ai_h="AI VRSTVA — ADAPTÉRY", ai_sub="výber tenant profilom, nie kódom",
    ai_emb="EMBEDDING", ai_emb1="cloud · Atlas auto-embed (voyage-4)", ai_emb2="on-prem · Infinity / TEI",
    ai_rr="RERANK", ai_rr1="cloud · $rerank (rerank-2)", ai_rr2="on-prem · Infinity (BGE-v2-m3)",
    ai_gen="GENEROVANIE", ai_gen1="cloud · Claude (Citations API)", ai_gen2="on-prem · vLLM (Qwen3 / EuroLLM)",
    ai_n1="Rerank beží nad výsledkom", ai_n2="$rankFusion — v pipeline (cloud)", ai_n3="alebo v aplikácii (on-prem).",

    if_h="ROZHRANIA", if_sub="odpoveď vždy s citáciou + verziou",
    if1="• Chat", if1a="streaming, história konverzácie",
    if2="• E-mail odpovede  ⇅", if2a="IMAP vstup aj výstup",
    if3="• Tickety", if3a="helpdesk, SLA, životný cyklus",
    if4="• Vložený widget", if4a="overlay v cudzej stránke",
    if5="• Portál (KB + onboarding)", if5a="verejná KB · potvrdzovanie noriem",

    loops_h="Dva spätné cykly",
    lg1="qa_pair — schválená odpoveď späť do znalostí",
    lg2="ticket — eskalácia s kontextom konverzácie",
    b1_h="① KURÁCIA — kontrola kvality",
    b1_1="Správca ohodnotí a schváli odpoveď → uloží sa ako qa_pair → embeduje späť.",
    b1_2="Nie je to strojové „učenie“, ale ľudská kurácia obsahu.",
    b2_h="② ESKALÁCIA — na ticket",
    b2_1="Nízke skóre podobnosti alebo 3× neúspech na tú istú tému →",
    b2_2="bot ponúkne vytvorenie ticketu s celým kontextom konverzácie.",

    f1="Cloud: MongoDB Atlas EU · Voyage voyage-4 + rerank-2 · Claude API (Citations)  │  On-prem: MongoDB Community 8.2 · Infinity / TEI · vLLM (Qwen3 / EuroLLM)",
    f2="Jadro je v oboch režimoch identické — $rankFusion beží aj self-hosted. Líšia sa len tri adaptéry: embedding, rerank, generovanie (ADR-001).",
    f3="Rozdiely: $rerank je zatiaľ Atlas-only · Citations API len pri Claude · auto-embed volá Voyage API, preto pre air-gap nepoužiteľné.",
)

CS = dict(SK,
    title="Contineo — architektura a datový tok",
    subtitle="CMS (kanály · zpracování · review) → MongoDB (jádro) → AI adaptéry → rozhraní. Adaptéry se vybírají konfigurací tenanta, ne kódem.",
    identity="Zdroj identity a CRM (osoby, jednotky, role) · auto-zakládání uživatelů",

    cms_h="CMS — SPRÁVA OBSAHU",
    cms_sub="jediné místo pravdy pro obsah — knihovna, verze, tagy, review",
    cur_h="KURÁTOR — brána před publikováním",
    cur_sub="tagy z číselníku → review → publish · kanál smí jen předvyplnit, publikuje člověk",

    ch_h="VSTUPNÍ KANÁLY", ch_sub="obsah i integrace = jedna vrstva",
    ch1="• PDF normy a směrnice", ch2="• RSS / web (Obecné info)",
    ch_note="⇅ e-mail je i výstupní kanál",

    wk_sub="zpracování (mimo DB)",
    wk1="• Chunking — úryvek po §/čl.", wk2="• Značkování z číselníku:",
    wk2a="sekce · scope · companyCode", wk2b="verze (effectiveFrom/To)",
    wk3="• Embedding při ingesci", wk3a="přes adaptér podle profilu",
    wk4="• Verzování — staré chunky", wk4a="isActive:false, nemazat",

    db_h="MongoDB — JÁDRO", db_sub="stejné dotazy cloud i on-prem",
    db3="• Filtr companyCode", db3a="default-deny, před LLM",
    coll_label="Kolekce:",
    hier1="companyCode.parent — hierarchie tenantů",
    hier2="centrála → dceřiné firmy → provozy",
    db_note="Atlas EU · nebo Community 8.2 on-prem",

    ai_sub="výběr tenant profilem, ne kódem",
    ai_gen="GENEROVÁNÍ",
    ai_n1="Rerank běží nad výsledkem", ai_n3="nebo v aplikaci (on-prem).",

    if_h="ROZHRANÍ", if_sub="odpověď vždy s citací + verzí",
    if1a="streaming, historie konverzace",
    if2="• E-mail odpovědi  ⇅", if2a="IMAP vstup i výstup",
    if3a="helpdesk, SLA, životní cyklus",
    if4a="overlay v cizí stránce",
    if5="• Portál (KB + onboarding)", if5a="veřejná KB · potvrzování norem",

    loops_h="Dva zpětné cykly",
    lg1="qa_pair — schválená odpověď zpět do znalostí",
    lg2="ticket — eskalace s kontextem konverzace",
    b1_h="① KURACE — kontrola kvality",
    b1_1="Správce ohodnotí a schválí odpověď → uloží se jako qa_pair → naembeduje zpět.",
    b1_2="Není to strojové „učení“, ale lidská kurace obsahu.",
    b2_h="② ESKALACE — na ticket",
    b2_1="Nízké skóre podobnosti nebo 3× neúspěch na totéž téma →",
    b2_2="bot nabídne vytvoření ticketu s celým kontextem konverzace.",

    f2="Jádro je v obou režimech identické — $rankFusion běží i self-hosted. Liší se jen tři adaptéry: embedding, rerank, generování (ADR-001).",
    f3="Rozdíly: $rerank je zatím Atlas-only · Citations API jen u Claude · auto-embed volá Voyage API, proto pro air-gap nepoužitelné.",
)

EN = dict(SK,
    title="Contineo — architecture and data flow",
    subtitle="CMS (channels · processing · review) → MongoDB (core) → AI adapters → interfaces. Adapters are selected by tenant configuration, not by code.",
    identity="Identity source and CRM (people, units, roles) · automatic user provisioning",

    cms_h="CMS — CONTENT MANAGEMENT",
    cms_sub="the single source of truth for content — library, versions, tags, review",
    cur_h="CURATOR — the gate before publishing",
    cur_sub="tags from a controlled list → review → publish · a channel may only pre-fill; a human publishes",

    ch_h="INPUT CHANNELS", ch_sub="content and integrations = one layer",
    ch1="• PDF regulations and directives", ch2="• RSS / web (general info)",
    ch5="• MCP connectors", ch_note="⇅ e-mail is an output channel too",

    wk_sub="processing (outside the DB)",
    wk1="• Chunking — one excerpt per §/article", wk2="• Tagging from a controlled list:",
    wk2a="section · scope · companyCode", wk2b="version (effectiveFrom/To)",
    wk3="• Embedding at ingest", wk3a="via the adapter from the profile",
    wk4="• Versioning — old chunks", wk4a="isActive:false, never deleted",

    db_h="MongoDB — CORE", db_sub="same queries in cloud and on-prem",
    db2a="vector 60 % + fulltext 40 %", db3="• companyCode filter",
    db3a="default-deny, before the LLM",
    coll_label="Collections:",
    hier1="companyCode.parent — tenant hierarchy",
    hier2="headquarters → subsidiaries → sites",
    db_note="Atlas EU · or Community 8.2 on-prem",

    ai_h="AI LAYER — ADAPTERS", ai_sub="chosen by tenant profile, not by code",
    ai_gen="GENERATION",
    ai_n1="Rerank runs on the result of", ai_n2="$rankFusion — in the pipeline (cloud)",
    ai_n3="or in the application (on-prem).",

    if_h="INTERFACES", if_sub="every answer with a citation + version",
    if1a="streaming, conversation history",
    if2="• E-mail replies  ⇅", if2a="IMAP inbound and outbound",
    if3="• Tickets", if3a="helpdesk, SLA, life cycle",
    if4="• Embedded widget", if4a="overlay inside a third-party page",
    if5="• Portal (KB + onboarding)", if5a="public KB · policy acknowledgements",

    loops_h="Two feedback loops",
    lg1="qa_pair — an approved answer back into the knowledge base",
    lg2="ticket — escalation with the conversation context",
    b1_h="① CURATION — quality control",
    b1_1="An admin rates and approves an answer → it is stored as a qa_pair → embedded back.",
    b1_2="This is not machine „learning“, but human curation of content.",
    b2_h="② ESCALATION — to a ticket",
    b2_1="Low similarity score or 3 failures on the same topic →",
    b2_2="the bot offers to create a ticket with the whole conversation context.",

    f2="The core is identical in both modes — $rankFusion runs self-hosted too. Only three adapters differ: embedding, rerank, generation (ADR-001).",
    f3="Differences: $rerank is Atlas-only for now · Citations API only with Claude · auto-embed calls the Voyage API, so it is unusable in air-gap.",
)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build(t):
    c0, c1, c2, c3, c4 = COLS
    B = BOX_Y
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L7,3 L0,6 Z" fill="#5f6368"/>
    </marker>
    <marker id="arrowTeal" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L7,3 L0,6 Z" fill="#00897B"/>
    </marker>
    <marker id="arrowRed" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L7,3 L0,6 Z" fill="#D93025"/>
    </marker>
    <marker id="arrowGray" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L7,3 L0,6 Z" fill="#9aa0a6"/>
    </marker>
  </defs>

  <text x="40" y="48" font-size="26" font-weight="700" fill="#202124">{esc(t["title"])}</text>
  <text x="40" y="74" font-size="14" fill="#5f6368">{esc(t["subtitle"])}</text>

  <rect x="470" y="96" width="580" height="34" rx="17" fill="#F1F3F4" stroke="#dadce0"/>
  <text x="760" y="118" font-size="13" fill="#3c4043" text-anchor="middle">{esc(t["identity"])}</text>
  <path d="M760,130 L760,{B - 8}" stroke="#9aa0a6" stroke-width="1.6" stroke-dasharray="4 3" marker-end="url(#arrowGray)"/>

  <!-- CMS ako vrstva nad kanálmi a workerom -->
  <rect x="{FRAME["x"]}" y="{FRAME["y"]}" width="{FRAME["w"]}" height="{FRAME["h"]}" rx="18"
        fill="#F7F9FE" stroke="#1A73E8" stroke-width="1.6" stroke-dasharray="8 5"/>
  <text x="46" y="196" font-size="15" font-weight="700" fill="#174EA6">{esc(t["cms_h"])}</text>
  <text x="46" y="215" font-size="11" fill="#5f6368">{esc(t["cms_sub"])}</text>

  <!-- VSTUPNÉ KANÁLY -->
  <rect x="{c0}" y="{B}" width="{BOX_W}" height="{BOX_H}" rx="14" fill="#E8F0FE" stroke="#1A73E8" stroke-width="1.5"/>
  <text x="{c0+20}" y="{y(200)}" font-size="15" font-weight="700" fill="#174EA6">{esc(t["ch_h"])}</text>
  <text x="{c0+20}" y="{y(219)}" font-size="11" fill="#5f6368">{esc(t["ch_sub"])}</text>
  <g font-size="12.5" fill="#202124">
    <text x="{c0+20}" y="{y(250)}">{esc(t["ch1"])}</text>
    <text x="{c0+20}" y="{y(276)}">{esc(t["ch2"])}</text>
    <text x="{c0+20}" y="{y(302)}">{esc(t["ch3"])}</text>
    <text x="{c0+20}" y="{y(328)}">{esc(t["ch4"])}</text>
    <text x="{c0+20}" y="{y(354)}">{esc(t["ch5"])}</text>
    <text x="{c0+34}" y="{y(374)}" font-size="11" fill="#5f6368">{esc(t["ch5a"])}</text>
    <text x="{c0+34}" y="{y(391)}" font-size="11" fill="#5f6368">{esc(t["ch5b"])}</text>
  </g>
  <text x="{c0+20}" y="{y(430)}" font-size="11" fill="#1A73E8">{esc(t["ch_note"])}</text>

  <!-- WORKER -->
  <rect x="{c1}" y="{B}" width="{BOX_W}" height="{BOX_H}" rx="14" fill="#FEF3E0" stroke="#E8920C" stroke-width="1.5"/>
  <text x="{c1+20}" y="{y(200)}" font-size="15" font-weight="700" fill="#B05A00">{esc(t["wk_h"])}</text>
  <text x="{c1+20}" y="{y(219)}" font-size="11" fill="#5f6368">{esc(t["wk_sub"])}</text>
  <g font-size="12.5" fill="#202124">
    <text x="{c1+20}" y="{y(250)}">{esc(t["wk1"])}</text>
    <text x="{c1+20}" y="{y(284)}">{esc(t["wk2"])}</text>
    <text x="{c1+34}" y="{y(303)}" font-size="11" fill="#5f6368">{esc(t["wk2a"])}</text>
    <text x="{c1+34}" y="{y(320)}" font-size="11" fill="#5f6368">{esc(t["wk2b"])}</text>
    <text x="{c1+20}" y="{y(352)}">{esc(t["wk3"])}</text>
    <text x="{c1+34}" y="{y(371)}" font-size="11" fill="#5f6368">{esc(t["wk3a"])}</text>
    <text x="{c1+20}" y="{y(403)}">{esc(t["wk4"])}</text>
    <text x="{c1+34}" y="{y(422)}" font-size="11" fill="#5f6368">{esc(t["wk4a"])}</text>
  </g>

  <!-- KURÁTORSKÁ BRÁNA (v rámci CMS) -->
  <rect x="40" y="622" width="557" height="58" rx="10" fill="#E8F0FE" stroke="#1A73E8" stroke-width="1.5"/>
  <text x="58" y="645" font-size="13.5" font-weight="700" fill="#174EA6">{esc(t["cur_h"])}</text>
  <text x="58" y="666" font-size="11.5" fill="#3c4043">{esc(t["cur_sub"])}</text>

  <!-- MongoDB JADRO -->
  <rect x="{c2}" y="{B}" width="{BOX_W}" height="{BOX_H}" rx="14" fill="#E6F4EA" stroke="#137333" stroke-width="2"/>
  <text x="{c2+20}" y="{y(200)}" font-size="15" font-weight="700" fill="#0B6E2E">{esc(t["db_h"])}</text>
  <text x="{c2+20}" y="{y(219)}" font-size="11" fill="#5f6368">{esc(t["db_sub"])}</text>
  <g font-size="12.5" fill="#202124">
    <text x="{c2+20}" y="{y(250)}">{esc(t["db1"])}</text>
    <text x="{c2+20}" y="{y(282)}">{esc(t["db2"])}</text>
    <text x="{c2+34}" y="{y(301)}" font-size="11" fill="#5f6368">{esc(t["db2a"])}</text>
    <text x="{c2+20}" y="{y(331)}">{esc(t["db3"])}</text>
    <text x="{c2+34}" y="{y(350)}" font-size="11" fill="#5f6368">{esc(t["db3a"])}</text>
  </g>
  <line x1="{c2+20}" y1="434" x2="{c2+244}" y2="434" stroke="#A8D5B5" stroke-width="1"/>
  <text x="{c2+20}" y="450" font-size="11.5" fill="#0B6E2E" font-weight="600">{esc(t["coll_label"])}</text>
  <text x="{c2+20}" y="468" font-size="11" fill="#3c4043">{esc(t["coll1"])}</text>
  <text x="{c2+20}" y="485" font-size="11" fill="#3c4043">{esc(t["coll2"])}</text>
  <text x="{c2+20}" y="502" font-size="11" fill="#3c4043">{esc(t["coll3"])}</text>
  <text x="{c2+20}" y="519" font-size="11" fill="#3c4043">{esc(t["coll4"])}</text>
  <text x="{c2+20}" y="536" font-size="10.5" fill="#3c4043">{esc(t["coll5"])}</text>
  <line x1="{c2+20}" y1="550" x2="{c2+244}" y2="550" stroke="#A8D5B5" stroke-width="1"/>
  <text x="{c2+20}" y="568" font-size="10.5" fill="#0B6E2E">{esc(t["hier1"])}</text>
  <text x="{c2+20}" y="583" font-size="10.5" fill="#5f6368">{esc(t["hier2"])}</text>
  <text x="{c2+20}" y="600" font-size="10.5" fill="#5f6368">{esc(t["db_note"])}</text>

  <!-- AI VRSTVA -->
  <rect x="{c3}" y="{B}" width="{BOX_W}" height="{BOX_H}" rx="14" fill="#E0F7FA" stroke="#00838F" stroke-width="2"/>
  <text x="{c3+20}" y="{y(200)}" font-size="15" font-weight="700" fill="#006064">{esc(t["ai_h"])}</text>
  <text x="{c3+20}" y="{y(219)}" font-size="11" fill="#5f6368">{esc(t["ai_sub"])}</text>
  <text x="{c3+20}" y="{y(249)}" font-size="11.5" font-weight="700" fill="#006064">{esc(t["ai_emb"])}</text>
  <text x="{c3+20}" y="{y(267)}" font-size="10.5" fill="#1A73E8">{esc(t["ai_emb1"])}</text>
  <text x="{c3+20}" y="{y(283)}" font-size="10.5" fill="#137333">{esc(t["ai_emb2"])}</text>
  <text x="{c3+20}" y="{y(315)}" font-size="11.5" font-weight="700" fill="#006064">{esc(t["ai_rr"])}</text>
  <text x="{c3+20}" y="{y(333)}" font-size="10.5" fill="#1A73E8">{esc(t["ai_rr1"])}</text>
  <text x="{c3+20}" y="{y(349)}" font-size="10.5" fill="#137333">{esc(t["ai_rr2"])}</text>
  <text x="{c3+20}" y="{y(381)}" font-size="11.5" font-weight="700" fill="#006064">{esc(t["ai_gen"])}</text>
  <text x="{c3+20}" y="{y(399)}" font-size="10.5" fill="#1A73E8">{esc(t["ai_gen1"])}</text>
  <text x="{c3+20}" y="{y(415)}" font-size="10.5" fill="#137333">{esc(t["ai_gen2"])}</text>
  <line x1="{c3+20}" y1="{y(434)}" x2="{c3+244}" y2="{y(434)}" stroke="#80DEEA" stroke-width="1"/>
  <text x="{c3+20}" y="{y(454)}" font-size="10.5" fill="#5f6368">{esc(t["ai_n1"])}</text>
  <text x="{c3+20}" y="{y(470)}" font-size="10.5" fill="#5f6368">{esc(t["ai_n2"])}</text>
  <text x="{c3+20}" y="{y(486)}" font-size="10.5" fill="#5f6368">{esc(t["ai_n3"])}</text>

  <!-- ROZHRANIA -->
  <rect x="{c4}" y="{B}" width="{BOX_W}" height="{BOX_H}" rx="14" fill="#EEE9FB" stroke="#6B46C1" stroke-width="1.5"/>
  <text x="{c4+20}" y="{y(200)}" font-size="15" font-weight="700" fill="#54309E">{esc(t["if_h"])}</text>
  <text x="{c4+20}" y="{y(219)}" font-size="11" fill="#5f6368">{esc(t["if_sub"])}</text>
  <g font-size="12.5" fill="#202124">
    <text x="{c4+20}" y="{y(252)}">{esc(t["if1"])}</text>
    <text x="{c4+34}" y="{y(271)}" font-size="11" fill="#5f6368">{esc(t["if1a"])}</text>
    <text x="{c4+20}" y="{y(303)}">{esc(t["if2"])}</text>
    <text x="{c4+34}" y="{y(322)}" font-size="11" fill="#5f6368">{esc(t["if2a"])}</text>
    <text x="{c4+20}" y="{y(354)}">{esc(t["if3"])}</text>
    <text x="{c4+34}" y="{y(373)}" font-size="11" fill="#5f6368">{esc(t["if3a"])}</text>
    <text x="{c4+20}" y="{y(405)}">{esc(t["if4"])}</text>
    <text x="{c4+34}" y="{y(424)}" font-size="11" fill="#5f6368">{esc(t["if4a"])}</text>
    <text x="{c4+20}" y="{y(456)}">{esc(t["if5"])}</text>
    <text x="{c4+34}" y="{y(475)}" font-size="11" fill="#5f6368">{esc(t["if5a"])}</text>
  </g>

  <path d="M{c0+BOX_W},{ARROW_Y} L{c1-2},{ARROW_Y}" stroke="#5f6368" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M{c1+BOX_W},{ARROW_Y} L{c2-2},{ARROW_Y}" stroke="#5f6368" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M{c2+BOX_W},{ARROW_Y} L{c3-2},{ARROW_Y}" stroke="#5f6368" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M{c3+BOX_W},{ARROW_Y} L{c4-2},{ARROW_Y}" stroke="#5f6368" stroke-width="2" marker-end="url(#arrow)"/>

  <path d="M1300,608 C1258,656 1020,664 838,614" fill="none" stroke="#00897B" stroke-width="2.2" marker-end="url(#arrowTeal)"/>
  <path d="M1392,608 C1430,678 1064,686 880,616" fill="none" stroke="#D93025" stroke-width="2.2" stroke-dasharray="6 4" marker-end="url(#arrowRed)"/>

  <text x="40" y="742" font-size="15" font-weight="700" fill="#202124">{esc(t["loops_h"])}</text>
  <circle cx="52" cy="766" r="4.5" fill="#00897B"/>
  <text x="66" y="771" font-size="12.5" fill="#00695C"><tspan font-weight="700">① {esc(t["lg1"].split(" — ")[0])}</tspan> — {esc(t["lg1"].split(" — ", 1)[1])}</text>
  <circle cx="52" cy="792" r="4.5" fill="#D93025"/>
  <text x="66" y="797" font-size="12.5" fill="#B31412"><tspan font-weight="700">② {esc(t["lg2"].split(" — ")[0])}</tspan> — {esc(t["lg2"].split(" — ", 1)[1])}</text>

  <rect x="40" y="820" width="700" height="88" rx="12" fill="#E0F2F1" stroke="#00897B" stroke-width="1.5"/>
  <text x="60" y="848" font-size="15" font-weight="700" fill="#00695C">{esc(t["b1_h"])}</text>
  <text x="60" y="872" font-size="12.5" fill="#3c4043">{esc(t["b1_1"])}</text>
  <text x="60" y="892" font-size="12" fill="#5f6368">{esc(t["b1_2"])}</text>

  <rect x="776" y="820" width="700" height="88" rx="12" fill="#FCE8E6" stroke="#D93025" stroke-width="1.5"/>
  <text x="796" y="848" font-size="15" font-weight="700" fill="#B31412">{esc(t["b2_h"])}</text>
  <text x="796" y="872" font-size="12.5" fill="#3c4043">{esc(t["b2_1"])}</text>
  <text x="796" y="892" font-size="12.5" fill="#3c4043">{esc(t["b2_2"])}</text>

  <text x="40" y="944" font-size="11.5" fill="#9aa0a6">{esc(t["f1"])}</text>
  <text x="40" y="964" font-size="11.5" fill="#9aa0a6">{esc(t["f2"])}</text>
  <text x="40" y="984" font-size="11.5" fill="#9aa0a6">{esc(t["f3"])}</text>
</svg>
'''


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

TARGETS = [
    (SK, os.path.join(ROOT, "web", "public", "contineo_diagram.svg")),
    (CS, os.path.join(ROOT, "web", "public", "contineo_diagram.cs.svg")),
    (EN, os.path.join(ROOT, "web", "public", "contineo_diagram.en.svg")),
    (SK, os.path.join(ROOT, "docs", "contineo_diagram.svg")),
]

if __name__ == "__main__":
    for lang, path in TARGETS:
        with open(path, "w", encoding="utf-8") as f:
            f.write(build(lang))
        print("zapísané:", os.path.relpath(path, ROOT))
