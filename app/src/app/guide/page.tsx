/**
 * Návod — ako pracovať so systémom.
 *
 * **Vidí ho každý prihlásený**, nie len správca obsahu. Rozhodnutie Jána
 * Letka: kto potvrdzuje predpis, má právo vedieť, odkiaľ sa tam vzal a čo sa
 * s ním dialo. Návod, ktorý vidia len tí, čo systém obsluhujú, je príručka
 * pre obsluhu, nie návod.
 *
 * Text je v `content/guide.ts` ako Markdown a vykresľuje ho ten istý
 * komponent ako znenie predpisu a odpoveď vyhľadávania. Úprava textu tak
 * nevyžaduje zásah do tejto obrazovky.
 *
 * Zatiaľ len po slovensky; česká a anglická obrazovka to povedia nahlas
 * namiesto toho, aby ticho ukázali cudzí jazyk.
 */

import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import FormattedText from "@/components/FormattedText"
import { GUIDE_SK } from "@/content/guide"
import { dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function GuidePage() {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state === "not-in-tenant") notFound()

  const language = ctx.person.language
  const t = dictionary(language).guide
  const branding = brandingView(ctx.tenant)

  return (
    <AppShell language={language}>
      {/*
        Užší stĺpec než ostatné obrazovky. Návod je súvislý text a riadok cez
        celú šírku sa na veľkom monitore zle číta — oko stráca začiatok
        ďalšieho riadku.
      */}
      <div style={{ maxWidth: 720, ...tenantStyle(branding) }}>
        <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
        <p className="quiet" style={{ fontSize: 15, margin: "0 0 20px" }}>{t.intro}</p>

        {/*
          Poznámka o jazyku patrí len na neslovenskú obrazovku. Na slovenskej
          by hovorila, že text je v jazyku, v ktorom ho čitateľ práve číta.
        */}
        {language !== "sk" && (
          <p
            className="card"
            style={{ padding: "12px 15px", margin: "0 0 22px", fontSize: 14, lineHeight: 1.6 }}
          >
            {t.onlySlovak}
          </p>
        )}

        {/* Biela karta ako všade inde — text priamo na podklade stránky
            vyzeral ako nedokončená obrazovka, nie ako obsah. */}
        <article className="answer card" style={{ lineHeight: 1.75, padding: "24px 26px" }}>
          <FormattedText text={GUIDE_SK} />
        </article>
      </div>
    </AppShell>
  )
}
