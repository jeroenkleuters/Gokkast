import type { Metadata } from "next";
import styles from "./game-manager.module.css";

export const metadata: Metadata = {
  title: "Game-manager — Eenarmige Bandiet",
  robots: { index: false, follow: false },
};

export default function GameManagerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.screen}>
      <main className={styles.panel}>{children}</main>
    </div>
  );
}
