/**
 * Celý text znenia predpisu z katalógu legislatívy (ADR-039) — spoločné pre
 * správcovský detail (Organizácia → Zdroje → Slov-Lex) a čitateľský detail
 * (`/documents/law/…`, ADR-041 D273). Jeden text, dve obrazovky: keby sa
 * kreslil dvakrát, kotvy paragrafov by sa časom rozišli.
 *
 * Bloky Markdownu cez `FormattedText`, nikdy ako HTML. Paragrafy dostanú
 * kotvu v tvare, aký má portál (`#paragraf-58`), takže odkaz z odpovede
 * asistenta sedí aj tu.
 */

import FormattedText from "@/components/FormattedText"
import { anchorFor } from "@/lib/lawCatalog"
import { splitBlocks, headingText, type TextBlock } from "@/lib/chunkBlocks"

/** Jeden blok znenia — nadpis s kotvou paragrafu, tabuľka v rámiku, ostatné ako formátovaný text. */
function BlockView({ block }: { block: TextBlock }) {
  if (block.kind === "heading") {
    const text = headingText(block)
    const id = anchorFor(text) ?? undefined
    return block.level <= 2 ? <h2 id={id}>{text}</h2> : <h3 id={id}>{text}</h3>
  }
  if (block.kind === "table") return <pre className="cut-pre">{block.text}</pre>
  return <FormattedText text={block.text} />
}

export default function LawActText({ markdown, heading, note }: { markdown: string; heading: string; note: string }) {
  const blocks = splitBlocks(markdown)
  return (
    <>
      <h2 id="text" style={{ margin: "24px 0 10px" }}>{heading}</h2>
      <p className="quiet" style={{ margin: "0 0 12px", fontSize: 13 }}>{note}</p>
      <article className="cut-doc card" aria-label={heading}>
        <section className="cut-block">
          {blocks.map(b => <BlockView key={b.index} block={b} />)}
        </section>
      </article>
    </>
  )
}
