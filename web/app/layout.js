import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://contineo.app"),
  applicationName: "Contineo",
  title: "Contineo — inteligentné vyhľadávanie a helpdesk",
  description:
    "Inteligentné vyhľadávanie nad obsahom vašej firmy. Opýtajte sa — odpoveď príde z vášho vlastného obsahu, s citáciou.",
  keywords: [
    "Contineo",
    "inteligentné vyhľadávanie",
    "helpdesk",
    "RAG",
    "firemný obsah",
    "intranet",
    "ticketing",
    "vyhľadávanie noriem",
    "enterprise search",
  ],
  authors: [{ name: "Contineo" }],
  creator: "Contineo",
  publisher: "Contineo",
  alternates: {
    canonical: "/",
    languages: { sk: "/sk", en: "/en", "x-default": "/sk" },
  },
  openGraph: {
    type: "website",
    siteName: "Contineo",
    url: "https://contineo.app",
    title: "Contineo — inteligentné vyhľadávanie a helpdesk",
    description:
      "Opýtajte sa. Nehľadajte. Odpovede z vášho sveta, nie z internetu.",
    locale: "sk_SK",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contineo — inteligentné vyhľadávanie a helpdesk",
    description:
      "Opýtajte sa. Nehľadajte. Odpovede z vášho sveta, nie z internetu.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  manifest: "/manifest.webmanifest",
};

const themeScript = `(function(){try{var t=localStorage.getItem('contineo-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);var l=location.pathname.split('/')[1];document.documentElement.lang=(l==='en'?'en':'sk');}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    /*
     * `data-scroll-behavior="smooth"` je **protiváha**, nie ozdoba.
     *
     * V `globals.css` je `html { scroll-behavior: smooth }` kvôli odkazom
     * v rámci stránky. Do Next 15 vrátane framework tento štýl pri prechode
     * medzi stránkami sám potlačil, takže nová stránka naskočila hore
     * okamžite. Next 16 to prestal robiť — bez tohto atribútu by sa prechod
     * medzi stránkami plynulo posúval, čo pri dlhej stránke vyzerá ako
     * zaseknutie. Atribút vracia pôvodné správanie.
     */
    <html lang="sk" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
