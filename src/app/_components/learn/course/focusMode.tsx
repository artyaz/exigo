"use client";

import { useState, useEffect, type RefObject } from "react";

export function useActiveFocusTargets({
  containerRef,
  enabled,
  contentVersion,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  contentVersion: string;
}) {
  const [activeFocusTargets, setActiveFocusTargets] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) {
      setActiveFocusTargets(new Set());
      return;
    }

    const container = containerRef.current;
    if (!container) {
      setActiveFocusTargets(new Set());
      return;
    }

    let animationFrameId = 0;

    const updateActiveTargets = () => {
      animationFrameId = 0;

      const focusTargets = Array.from(
        container.querySelectorAll<HTMLElement>("[data-focus-target]")
      );

      if (focusTargets.length === 0) {
        setActiveFocusTargets(new Set());
        return;
      }

      // Collect elements in the focus band (generous viewport region)
      const bandTop = window.innerHeight * 0.15;
      const bandBottom = window.innerHeight * 0.75;
      const anchor = window.innerHeight * 0.34;

      const scored = focusTargets
        .map((target) => {
          const rect = target.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          const inBand = rect.bottom >= bandTop && rect.top <= bandBottom;
          return { id: target.dataset.focusTarget!, distance: Math.abs(mid - anchor), inBand };
        })
        .filter((s) => s.inBand);

      // Pick closest elements — up to 5, or all within 200px of best
      scored.sort((a, b) => a.distance - b.distance);
      const threshold = scored.length > 0 ? scored[0]!.distance + 200 : 0;
      const active = new Set(
        scored.filter((s) => s.distance <= threshold).slice(0, 5).map((s) => s.id)
      );

      setActiveFocusTargets(active);
    };

    const scheduleUpdate = () => {
      if (animationFrameId !== 0) return;
      animationFrameId = window.requestAnimationFrame(updateActiveTargets);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (animationFrameId !== 0) window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [containerRef, contentVersion, enabled]);

  return activeFocusTargets;
}

export function FocusModeToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.12em] transition-all ${enabled
        ? "border-cyan-400/40 bg-cyan-400/12 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]"
        : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/70"
        }`}
      title="Toggle focus mode (F)"
    >
      <span>{enabled ? "Focus On" : "Focus Off"}</span>
      <kbd className="rounded-md border border-current/20 bg-black/30 px-1.5 py-0.5 text-[10px] tracking-[0.08em]">
        F
      </kbd>
    </button>
  );
}
