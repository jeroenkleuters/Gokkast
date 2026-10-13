"use client";

import type { GameSettings } from "@/lib/settings";

interface SettingsDialogProps {
  settings: GameSettings;
  onClose(): void;
}

// Alleen-lezen: de instellingen komen uit de database, met .env als terugval.
export default function SettingsDialog({ settings, onClose }: SettingsDialogProps) {
  return (
    <div id="settings" className="open" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h3>Instellingen</h3>
        <dl>
          <dt>Winkans</dt>
          <dd>1 op {settings.odds}</dd>
          <dt>Pogingen per spel</dt>
          <dd>{settings.maxTries}</dd>
          <dt>Speelrondes per betaling</dt>
          <dd>{settings.roundsPerPayment}</dd>
          <dt>Bron</dt>
          <dd data-testid="settings-source">{settings.source === "database" ? "database" : ".env"}</dd>
        </dl>
        <div className="hint">
          Kans per draai op drie dezelfde plaatjes als er geen rollen vastgezet zijn. Vastgezette rollen met
          hetzelfde plaatje vergroten de kans.
          <br />
          Deze waarden staan in de database (tabel <code>game_settings</code>); zonder database gelden de
          waarden uit het <code>.env</code>-bestand op de server.
        </div>
        <div className="row">
          <button className="ok" autoFocus onClick={onClose}>
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
