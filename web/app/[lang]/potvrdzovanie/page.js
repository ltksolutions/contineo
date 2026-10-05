import { notFound } from "next/navigation";
import { locales, getDictionary } from "@/lib/dictionaries";
import Nav from "@/components/Nav";
import AckViews from "@/components/AckViews";
import Governance from "@/components/Governance";
import AckFaq from "@/components/AckFaq";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: "Contineo — " + dict.ackPage.navLabel,
    description: dict.governance.subtitle,
    alternates: {
      canonical: `/${lang}/potvrdzovanie`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/potvrdzovanie`])),
    },
  };
}

export default async function AckPage({ params }) {
  const { lang } = await params;
  if (!locales.includes(lang)) notFound();
  const dict = getDictionary(lang);
  const g = dict.governance;

  return (
    <>
      <Nav dict={dict} lang={lang} />
      <main id="main">
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="container">
            <div className="center mx-auto" style={{ maxWidth: 820, paddingBottom: 56 }}>
              <span className="eyebrow">{g.eyebrow}</span>
              <h1 style={{ fontSize: "clamp(30px, 4.6vw, 48px)" }}>{g.title}</h1>
              <p className="lead" style={{ marginTop: 18 }}>{g.subtitle}</p>
            </div>
          </div>
        </section>
        <AckViews dict={dict} />
        <Governance dict={dict} bare />
        <AckFaq dict={dict} />
        <CTA dict={dict} />
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
