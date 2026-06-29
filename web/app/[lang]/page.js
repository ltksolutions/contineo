import { notFound } from "next/navigation";
import { locales, getDictionary, sampleKB } from "@/lib/dictionaries";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Manifesto from "@/components/Manifesto";
import BotDemo from "@/components/BotDemo";
import Modes from "@/components/Modes";
import Identity from "@/components/Identity";
import Security from "@/components/Security";
import Audience from "@/components/Audience";
import Roadmap from "@/components/Roadmap";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";

export default function Home({ params }) {
  const { lang } = params;
  if (!locales.includes(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <JsonLd dict={dict} lang={lang} />
      <Nav dict={dict} lang={lang} />
      <main id="main">
        <Hero dict={dict} />
        <Features dict={dict} />
        <HowItWorks dict={dict} />
        <Manifesto dict={dict} />
        <BotDemo dict={dict} kb={sampleKB[lang]} />
        <Modes dict={dict} kb={sampleKB[lang]} />
        <Identity dict={dict} />
        <Security dict={dict} />
        <Audience dict={dict} />
        <Roadmap dict={dict} />
        <CTA dict={dict} />
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
