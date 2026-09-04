/**
 * layout.tsx — obal celej aplikácie.
 *
 * Zatiaľ je to testovacie rozhranie pre hodnotenie kvality odpovedí (D9),
 * nie produkčný portál. Preto `noindex`: obsahom sú interné normy a nechceme
 * ich vo vyhľadávačoch, ani keď je stránka za prihlásením.
 */

import type { Metadata } from "next"
import "./globals.css"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import SessionProvider from "@/components/SessionProvider"
import { currentTenant, currentEmail, currentPerson } from "@/lib/session"
import { libraryContext } from "@/lib/library"
import { platformContext } from "@/lib/admin"
import { hrContext } from "@/lib/hr"
import { peopleContext } from "@/lib/people"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { normalizeLanguage, dictionary, type UiLanguage } from "@/lib/i18n"

/**
 * Názov v záložke prehliadača je tiež informácia.
 *
 * Neznámy hostiteľ (D29) dostane `404` — ale keby v záložke svietilo
 * „Contineo", zamlčanie by nemalo zmysel: dozvedel by sa presne to, čo mu
 * odpoveď zamlčiava. Preto je to `generateMetadata`, nie konštanta.
 *
 * Pri výpadku databázy zostáva pôvodný názov: vtedy nejde o cudziu doménu,
 * ale o našu vlastnú, ktorá sa práve nedá overiť.
 */
/**
 * Celá aplikácia je dynamická a je to zámer, nie prehliadnutie.
 *
 * Obal číta hostiteľa (`headers()`), lebo **hostiteľ určuje tenanta** (D29) —
 * bez neho nevie, čí je to portál, akú má značku a či vôbec existuje. Nič
 * z toho sa nedá vopred vygenerovať, keď je zákazníkov n a pribúdajú.
 *
 * Bez tohto riadka sa Next pokúsi predgenerovať `/_not-found`, zakopne
 * o `headers()` a do logu nasadenia napíše dve `DYNAMIC_SERVER_USAGE` chyby.
 * Zachytené sú (`try/catch` nižšie), takže nasadenie prejde — ale chyba,
 * ktorá sa má prehliadať, je presne to, čo spôsobí, že sa raz prehliadne aj
 * tá skutočná.
 */
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  try {
    if (!(await currentTenant())) {
      return {
        title: dictionary(undefined).notFound.heading,
        robots: { index: false, follow: false },
      }
    }
  } catch {
    // ticho — vysvetlenie je nižšie v `RootLayout`, kde sa to aj zaloguje
  }
  // Metadáta sa skladajú skôr, než je jasné, kto sa pozerá — jazyk osoby tu
  // ešte nepoznáme, takže sa berie predvolený.
  const t = dictionary(undefined)
  return {
    title: t.home.metaTitle,
    description: t.home.metaDescription,
    robots: { index: false, follow: false },
  }
}

/**
 * Vzhľad tenanta sa načítava tu, teda **raz na požiadavku**, a nie v každej
 * stránke zvlášť — hlavička je spoločná a inak by sa vetvila podľa toho,
 * odkiaľ sa na ňu človek pozerá.
 *
 * Výpadok databázy sa **nesmie** prejaviť ako biela obrazovka: obal celej
 * aplikácie je posledné miesto, kde má zmysel padnúť. Bez tenanta zostane
 * pôvodná značka a stránka sa vykreslí.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let branding
  let unknownHost = false
  try {
    const tenant = await currentTenant()
    if (tenant) branding = brandingView(tenant)
    // `null` znamená doménu, ktorá nepatrí nikomu — nie výpadok. Výpadok
    // vyhodí výnimku a rieši sa nižšie.
    else unknownHost = true
  } catch (e) {
    console.error("[layout] vzhľad tenanta sa nepodarilo načítať:", e)
  }

  /*
   * Neznámy hostiteľ nedostane ani obal.
   *
   * D29 hovorí, že kto si nasmeruje vlastnú doménu na naše nasadenie, sa
   * nemá dozvedieť ani to, že tu nejaká aplikácia beží. Hlavička so značkou
   * organizácie a pätička s názvom, verziou a odkazom na repozitár by mu
   * povedali všetko naraz — a to na stránke `404`, ktorá to má práve
   * zamlčať. Zostane holý text.
   */
  if (unknownHost) {
    return (
      <html lang="sk">
        <body>{children}</body>
      </html>
    )
  }

  // Rovnaká opatrnosť ako pri vzhľade: keď sa relácia nedá prečítať, stránka
  // sa má vykresliť ako pre neprihláseného, nie spadnúť.
  let email: string | undefined
  let name: string | undefined
  let photo: string | undefined
  // Jazyk prostredia (D…): riadi sa osobou, nie hostiteľom. Kto prihlásený
  // nie je, dostane predvolený jazyk organizácie.
  let language: UiLanguage | undefined
  try {
    email = (await currentEmail()) ?? undefined
  } catch (e) {
    console.error("[layout] reláciu sa nepodarilo prečítať:", e)
  }

  // Meno pre avatar. Chýba u správcu, ktorý prešiel núdzovou brzdou a v
  // `persons` nie je — vtedy iniciály vyjdú z adresy a je to v poriadku.
  if (email) {
    try {
      const self = await currentPerson()
      name = self?.fullName
      if (self?.language) language = normalizeLanguage(self.language)
      // Verzia je v adrese, takže prehliadač si fotku odloží nadlho a nová
      // sa aj tak ukáže hneď (rovnako ako pri logu).
      if (self?.photoVersion) {
        photo = `/api/fotka/${encodeURIComponent(self.id)}?v=${encodeURIComponent(self.photoVersion)}`
      }
    } catch (e) {
      console.error("[layout] meno osoby sa nepodarilo načítať:", e)
    }
  }

  // Odkaz na správu tenantov sa ukáže len tomu, kto ňou naozaj prejde —
  // rozhoduje o tom tá istá funkcia ako o samotnej stránke, nie druhá kópia
  // pravidla. Zlyhanie sa berie ako „neukazovať".
  let isAdmin = false
  let isHr = false
  let isPeopleAdmin = false
  let isContentManager = false
  if (email) {
    try {
      isAdmin = (await platformContext()).state === "ready"
    } catch (e) {
      console.error("[layout] rolu správcu sa nepodarilo overiť:", e)
    }
    try {
      isHr = (await hrContext()).state === "ready"
    } catch (e) {
      console.error("[layout] rolu HR sa nepodarilo overiť:", e)
    }
    try {
      isPeopleAdmin = (await peopleContext()).state === "ready"
    } catch (e) {
      console.error("[layout] rolu správy osôb sa nepodarilo overiť:", e)
    }
    try {
      isContentManager = (await libraryContext()).state === "ready"
    } catch (e) {
      console.error("[layout] rolu správy obsahu sa nepodarilo overiť:", e)
    }
  }

  return (
    <html lang="sk">
      {/* Stĺpec s `min-height`, aby pätička na krátkej stránke sedela dole
          a nie hneď pod obsahom uprostred prázdnej obrazovky. */}
      <body style={{ ...tenantStyle(branding), minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <SessionProvider>
          <Header
            branding={branding}
            email={email}
            name={name}
            photo={photo}
            isAdmin={isAdmin}
            isHr={isHr}
            isPeopleAdmin={isPeopleAdmin}
            isContentManager={isContentManager}
            language={language}
          />
          <main style={{ flex: 1 }}>{children}</main>
          <Footer language={language} />
        </SessionProvider>
      </body>
    </html>
  )
}
