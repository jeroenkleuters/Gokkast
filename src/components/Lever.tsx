"use client";

interface LeverProps {
  pulled: boolean;
  disabled: boolean;
  onPull(): void;
}

export default function Lever({ pulled, disabled, onPull }: LeverProps) {
  return (
    <div
      id="lever"
      className={`${pulled ? "pulled" : ""}${disabled ? " disabled" : ""}`}
      onClick={onPull}
      role="button"
      aria-label="Trek aan de hendel"
      aria-disabled={disabled}
    >
      <div className="base" />
      <div className="arm">
        <div className="rod" />
        <div className="ball" />
      </div>
    </div>
  );
}
