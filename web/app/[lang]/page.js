import { notFound } from "next/navigation";
import { locales, getDictionary, sampleKB } from "@/lib/dictionaries";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Manifesto from "@/components/Manifesto";
import BotDemo from "@/components/BotDemo";
import Modes from "@/components/Modes";
import Audience from "@/components/Audience";
import Roadmap from "@/components/Roadmap";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home({ params }) {
  const { lang } = params;
  if (!locales.includes(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <Nav dict={dict} lang={lang} />
      <main>
        <Hero dict={dict} />
        <Features dict={dict} />
        <HowItWorks dict={dict} />
        <Manifesto dict={dict} />
        <BotDemo dict={dict} kb={sampleKB[lang]} />
        <Modes dict={dict} kb={sampleKB[lang]} />
        <Audience dict={dict} />
        <Roadmap dict={dict} />
        <CTA dict={dict} />
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
