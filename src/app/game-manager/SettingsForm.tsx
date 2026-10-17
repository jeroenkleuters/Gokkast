"use client";

import { useActionState, useState } from "react";
import {
  ODDS_LEVELS,
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_PROVIDERS,
  SETTING_LIMITS,
  type GameSettings,
  type PaymentProvider,
  type SettingKey,
  type SettingsRow,
} from "@/lib/settings";
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
  payment: {
    available: Record<PaymentProvider, boolean>; // sleutels ingesteld op deze server
    defaultProvider: PaymentProvider; // GAME_PAYMENT_PROVIDER, anders Mollie
  };
}

// Leeg veld = standaard: het spel gebruikt dan de waarde uit .env
export default function SettingsForm({ row, defaults, payment }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateSettings, initialState);
  const [values, setValues] = useState<Record<SettingKey, string>>({
    odds: row?.odds?.toString() ?? "",
    maxTries: row?.maxTries?.toString() ?? "",
    roundsPerPayment: row?.roundsPerPayment?.toString() ?? "",
  });
  const set = (key: SettingKey, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const [provider, setProvider] = useState<string>(row?.paymentProvider ?? "");
  const providerError = state.errors?.paymentProvider;
  const optionLabel = (p: PaymentProvider) => `${PAYMENT_PROVIDER_LABELS[p]}${payment.available[p] ? "" : " — niet ingesteld"}`;

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

      <fieldset className={styles.field}>
        <label htmlFor="paymentProvider">Betaalmethode</label>
        <div className={styles.inputRow}>
          <select
            id="paymentProvider"
            name="paymentProvider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            aria-invalid={providerError ? true : undefined}
            aria-describedby={`paymentProvider-hint${providerError ? " paymentProvider-error" : ""}`}
            className={styles.input}
          >
            <option value="">Standaard: {optionLabel(payment.defaultProvider)}</option>
            {PAYMENT_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {optionLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <p id="paymentProvider-hint" className={styles.muted}>
          Waarmee spelers betalen. Een methode die niet ingesteld is (geen sleutels op deze server) wordt
          overgeslagen: dan gebruikt het spel de andere. Leeg = standaard uit <code>.env</code>.
        </p>
        {providerError && (
          <p id="paymentProvider-error" className={styles.fieldError}>
            {providerError}
          </p>
        )}
      </fieldset>

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
