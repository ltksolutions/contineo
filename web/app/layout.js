import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://contineo.app"),
  title: "Contineo — inteligentné vyhľadávanie a helpdesk",
  description:
    "Inteligentné vyhľadávanie nad obsahom vašej firmy. Opýtajte sa — odpoveď príde z vášho vlastného obsahu, s citáciou.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  );
}
