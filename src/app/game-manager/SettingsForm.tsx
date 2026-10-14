"use client";

import { useActionState, useState } from "react";
import { ODDS_LEVELS, SETTING_LIMITS, type GameSettings, type SettingKey, type SettingsRow } from "@/lib/settings";
import { updateSettings, type SettingsFormState } from "./actions";
import styles from "./game-manager.module.css";

const FIELDS: { key: SettingKey; label: string; prefix?: string; hint: string }[] = [
  { key: "odds", label: "Winkans", prefix: "1 op", hint: "Kans per draai zonder vastgezette rollen. Hoger = moeilijker." },
  { key: "maxTries", label: "Pogingen per spel", hint: "Aantal keer draaien per spel." },
  { key: "roundsPerPayment", label: "Speelrondes per betaling", hint: "Zoveel spelletjes (credits) krijgt een speler na één betaling." },
];

const initialState: SettingsFormState = { status: "idle" };

interface SettingsFormProps {
  row: SettingsRow | null; // wat er nu in de database staat (null-velden = standaard)
  defaults: GameSettings; // de .env-waarden
}

// Leeg veld = standaard: het spel gebruikt dan de waarde uit .env
export default function SettingsForm({ row, defaults }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateSettings, initialState);
  const [values, setValues] = useState<Record<SettingKey, string>>({
    odds: row?.odds?.toString() ?? "",
    maxTries: row?.maxTries?.toString() ?? "",
    roundsPerPayment: row?.roundsPerPayment?.toString() ?? "",
  });
  const set = (key: SettingKey, value: string) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <form action={formAction} className={styles.form}>
      {FIELDS.map(({ key, label, prefix, hint }) => {
        const error = state.errors?.[key];
        return (
          <fieldset key={key} className={styles.field}>
            <label htmlFor={key}>{label}</label>
            {key === "odds" && (
              <div className={styles.levels} role="group" aria-label="Moeilijkheidsgraad">
                {ODDS_LEVELS.map((level) => (
                  <button
                    key={level.odds}
                    type="button"
                    className={`${styles.button} ${styles.secondary}`}
                    aria-pressed={values.odds === String(level.odds)}
                    onClick={() => set("odds", String(level.odds))}
                  >
                    {level.label} (1 op {level.odds})
                  </button>
                ))}
              </div>
            )}
            <div className={styles.inputRow}>
              {prefix && <span>{prefix}</span>}
              <input
                id={key}
                name={key}
                type="number"
                inputMode="numeric"
                min={1}
                max={SETTING_LIMITS[key]}
                step={1}
                placeholder={`standaard: ${defaults[key]}`}
                value={values[key]}
                onChange={(e) => set(key, e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${key}-hint${error ? ` ${key}-error` : ""}`}
                className={styles.input}
              />
              <button
                type="button"
                className={`${styles.button} ${styles.secondary}`}
                onClick={() => set(key, "")}
                disabled={values[key] === ""}
                aria-label={`${label}: terug naar standaard`}
              >
                Terug naar standaard
              </button>
            </div>
            <p id={`${key}-hint`} className={styles.muted}>
              {hint} Leeg = standaard uit <code>.env</code> ({prefix ? `${prefix} ` : ""}
              {defaults[key]}), 1 t/m {SETTING_LIMITS[key]}.
            </p>
            {error && (
              <p id={`${key}-error`} className={styles.fieldError}>
                {error}
              </p>
            )}
          </fieldset>
        );
      })}

      <div className={styles.inputRow}>
        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Bezig met opslaan…" : "Opslaan"}
        </button>
      </div>
      <p aria-live="polite" role="status" className={state.status === "saved" ? styles.success : styles.fieldError}>
        {state.message}
      </p>
    </form>
  );
}
