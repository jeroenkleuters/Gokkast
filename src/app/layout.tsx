import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eenarmige Bandiet",
  description: "Een webbased eenarmige bandiet met drie rollen, drie pogingen en rollen vastzetten.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
