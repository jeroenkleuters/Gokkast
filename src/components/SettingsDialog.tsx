"use client";

import { useState } from "react";
import { parseOdds } from "@/lib/game";

interface SettingsDialogProps {
  odds: number;
  onSave(odds: number): void;
  onClose(): void;
}

// Wordt alleen gerenderd als hij open is, dus de invoer start steeds bij de huidige winkans.
export default function SettingsDialog({ odds, onSave, onClose }: SettingsDialogProps) {
  const [value, setValue] = useState(String(odds));

  function save() {
    const v = parseOdds(value);
    if (v !== null) onSave(v);
    onClose();
  }

  return (
    <div id="settings" className="open">
      <div className="box">
        <h3>Instellingen</h3>
        <label>
          Winkans: 1 op{" "}
          <input
            type="number"
            min={1}
            max={100000}
            step={1}
            value={value}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") onClose();
              e.stopPropagation();
            }}
          />
        </label>
        <div className="hint">
          Kans per draai op drie dezelfde plaatjes als er geen rollen vastgezet zijn. Vastgezette rollen met
          hetzelfde plaatje vergroten de kans.
          <br />
          Ook in te stellen via de adresbalk, bijv. <code>?kans=10</code>
        </div>
        <div className="row">
          <button className="cancel" onClick={onClose}>
            Annuleer
          </button>
          <button className="ok" onClick={save}>
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}
