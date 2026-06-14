import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://contineo.app"),
  title: "Contineo — inteligentné vyhľadávanie a helpdesk",
  description:
    "Inteligentné vyhľadávanie nad obsahom vašej firmy. Opýtajte sa — odpoveď príde z vášho vlastného obsahu, s citáciou.",
};

const themeScript = `(function(){try{var t=localStorage.getItem('contineo-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="sk" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
