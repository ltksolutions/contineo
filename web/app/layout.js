import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://contineo.app"),
  title: "Contineo — inteligentný helpdesk",
  description:
    "Contineo odpovedá na otázky z overených noriem a dokumentov. Inteligentné vyhľadávanie, ktoré sa učí.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  );
}
