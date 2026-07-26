import { notFound } from "next/navigation";
import { locales, getDictionary, sampleKB } from "@/lib/dictionaries";
import Nav from "@/components/Nav";
import Modes from "@/components/Modes";
import Runtime from "@/components/Runtime";
import Roadmap from "@/components/Roadmap";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }) {
  const dict = getDictionary(params.lang);
  return {
    title: "Contineo — " + dict.nav.runtime,
    description: dict.runtime.subtitle ?? dict.modes.subtitle,
  };
}

export default function PrevadzkaPage({ params }) {
  const { lang } = params;
  if (!locales.includes(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <Nav dict={dict} lang={lang} />
      <main>
        <Runtime dict={dict} />
        <Modes dict={dict} kb={sampleKB[lang]} />
        <Roadmap dict={dict} />
        <CTA dict={dict} />
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
