"use client";

// Tabs op de game-manager (taak 14). De gekozen tab staat niet in de URL (keuze gebruiker) maar in
// TabProvider in layout.tsx: een layout blijft staan bij bladeren, sorteren en filteren (die
// veranderen alleen de URL-parameters), dus de tab ook. Na herladen weer de eerste tab.
import { createContext, useContext, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./game-manager.module.css";

const TabContext = createContext<[string | null, (id: string) => void] | null>(null);

export function TabProvider({ children }: { children: ReactNode }) {
  const state = useState<string | null>(null);
  return <TabContext.Provider value={state}>{children}</TabContext.Provider>;
}

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

export default function ManagerTabs({ tabs }: { tabs: Tab[] }) {
  const context = useContext(TabContext);
  const [fallback, setFallback] = useState<string | null>(null);
  const [chosen, setChosen] = context ?? [fallback, setFallback];
  const active = tabs.find((tab) => tab.id === chosen)?.id ?? tabs[0].id;

  // Pijltjes, Home en End wisselen van tab (zoals bij een tablist hoort)
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.findIndex((tab) => tab.id === active);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setChosen(tabs[next].id);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }

  return (
    <div className={styles.tabs}>
      <div role="tablist" aria-label="Onderdelen" className={styles.tabList}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === active}
            aria-controls={`paneel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            className={styles.tab}
            onClick={() => setChosen(tab.id)}
            onKeyDown={onKeyDown}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        // Alle panelen blijven op de pagina (ingevulde velden blijven bewaard), alleen de gekozen is zichtbaar
        <div
          key={tab.id}
          role="tabpanel"
          id={`paneel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== active}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
