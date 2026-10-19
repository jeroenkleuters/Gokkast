import type { Metadata } from "next";
import { Open_Sans, VT323 } from "next/font/google";
import "./globals.css";
import "./jungle.css";

// Lettertypes van het jungle-design (borden en LED-bord), zelf gehost door Next.js
const boardFont = Open_Sans({ subsets: ["latin"], variable: "--font-board" });
const ledFont = VT323({ subsets: ["latin"], weight: "400", variable: "--font-led" });

export const metadata: Metadata = {
  title: "Jackpot",
  description: "Jackpot: een webbased eenarmige bandiet met drie rollen, meerdere pogingen en rollen vastzetten.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={`${boardFont.variable} ${ledFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
