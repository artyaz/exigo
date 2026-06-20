"use client";
/* The inline card every reactive exercise lives inside. Owns the shell
   chrome: accent rail, curiosity hook, streak chip, proximity rail,
   celebration canvas, and the feedback footer. */
import React from "react";
import type { Accent, ShellVariant } from "../runtime/types";
import { useExerciseStyles } from "./styles";
import { accentOf, Ico, renderInline, useStreak } from "./runtimeUi";

export interface ShellProps {
  kind?: string;
  prompt?: string;
  hook?: string;
  accent?: Accent;
  variant?: ShellVariant;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  proximity?: number | null;
  solved?: boolean;
  popKey?: number;
  burstRef?: React.RefObject<HTMLCanvasElement | null>;
  label?: string;
  streak?: boolean;
}

export function ExerciseShell({
  kind,
  prompt,
  hook,
  accent = "amber",
  variant = "inset",
  children,
  footer,
  proximity,
  solved = false,
  popKey = 0,
  burstRef,
  label = "Try it",
  streak = true,
}: ShellProps): React.JSX.Element {
  useExerciseStyles();
  const ac = accentOf(accent);
  const [pop, setPop] = React.useState(false);
  const streakN = useStreak();

  React.useEffect(() => {
    if (!popKey) return;
    setPop(false);
    const r = requestAnimationFrame(() => setPop(true));
    const t = setTimeout(() => setPop(false), 480);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, [popKey]);

  return (
    <div
      className={`exg-ex exg-ex--${variant}${solved ? " exg-ex--solved" : ""}${pop ? " exg-ex--pop" : ""}`}
      style={{ "--ex-rgb": ac.rgb } as React.CSSProperties}
    >
      {proximity != null ? (
        <div className="exg-ex__prox">
          <i style={{ width: `${Math.round(Math.max(0, Math.min(1, proximity)) * 100)}%` }} />
        </div>
      ) : null}
      <canvas ref={burstRef} className="exg-ex__burst" aria-hidden="true" />
      <div className="exg-ex__bar">
        <span className="exg-ex__tab">{label}</span>
        {kind ? <span className="exg-ex__kind">{kind}</span> : null}
        {streak ? (
          <span className={`exg-ex__streak${streakN >= 1 ? " exg-ex__streak--show" : ""}`}>
            {Ico.flame}
            {streakN} in a row
          </span>
        ) : null}
      </div>
      {hook ? (
        <div className="exg-ex__hook">
          {Ico.spark}
          <span>{renderInline(hook)}</span>
        </div>
      ) : null}
      {prompt ? <div className="exg-ex__prompt">{renderInline(prompt)}</div> : null}
      <div className="exg-ex__body">{children}</div>
      {footer ? <div className="exg-ex__foot">{footer}</div> : null}
    </div>
  );
}

const STATUS_FB: Record<string, { cls: string; icon: React.ReactNode }> = {
  ok: { cls: "ok", icon: <span style={{ display: "inline-flex", width: 16, height: 16 }}>{Ico.check}</span> },
  no: { cls: "no", icon: <span style={{ display: "inline-flex", width: 16, height: 16 }}>{Ico.x}</span> },
  hint: { cls: "hint", icon: <span style={{ display: "inline-flex", width: 16, height: 16 }}>{Ico.bulb}</span> },
};

export interface FooterProps {
  onCheck?: (() => void) | null;
  onReset?: () => void;
  status?: { kind: "ok" | "no" | "hint"; msg?: string } | null;
  disabled?: boolean;
  checkLabel?: string;
  extra?: React.ReactNode;
}

export function CheckFooter({ onCheck, onReset, status, disabled, checkLabel = "Check", extra }: FooterProps): React.JSX.Element {
  const fb = status ? STATUS_FB[status.kind] : undefined;
  return (
    <>
      {extra}
      {onReset ? (
        <button className="exg-ex__btn exg-ex__btn--ghost" onClick={onReset} type="button" aria-label="Reset">
          {Ico.reset}
        </button>
      ) : null}
      <span className="exg-ex__spacer" />
      <span className={`exg-ex__fb${status ? " exg-ex__fb--show" : ""} ${fb ? "exg-ex__fb--" + fb.cls : ""}`} role="status">
        {fb ? fb.icon : null}
        {status?.msg}
      </span>
      {onCheck ? (
        <button className="exg-ex__btn exg-ex__btn--check" onClick={onCheck} disabled={disabled} type="button">
          {checkLabel}
        </button>
      ) : null}
    </>
  );
}
