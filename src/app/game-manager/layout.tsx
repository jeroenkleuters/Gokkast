import type { Metadata } from "next";
import { TabProvider } from "./ManagerTabs";
import styles from "./game-manager.module.css";

export const metadata: Metadata = {
  title: "Game-manager — Jackpot",
  robots: { index: false, follow: false },
};

export default function GameManagerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.screen}>
      <main className={styles.panel}>
        {/* Onthoudt de gekozen tab bij bladeren, sorteren en filteren */}
        <TabProvider>{children}</TabProvider>
      </main>
    </div>
  );
}
