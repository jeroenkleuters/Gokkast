import type { Metadata } from "next";
import { Montserrat, Open_Sans, VT323 } from "next/font/google";
import "./globals.css";
import "./jungle.css";
import "./haven.css";

// Lettertypes van het jungle- en havendesign (borden, LED-bord, knoppen), zelf gehost door Next.js
const boardFont = Open_Sans({ subsets: ["latin"], variable: "--font-board" });
const ledFont = VT323({ subsets: ["latin"], weight: "400", variable: "--font-led" });
const titleFont = Montserrat({ subsets: ["latin"], weight: "800", variable: "--font-title" });

export const metadata: Metadata = {
  title: "Jackpot",
  description: "Jackpot: een webbased eenarmige bandiet met drie rollen, meerdere pogingen en rollen vastzetten.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={`${boardFont.variable} ${ledFont.variable} ${titleFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
