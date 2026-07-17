"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Deterministic 32-bit hash for stable pseudo-random stack rotations. */
export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + (str.codePointAt(i) ?? 0);
    hash = Math.trunc(hash);
  }
  return hash;
}

export type TestCardProgressStatus = "done" | "in_progress" | "new";

export function getProgressStatus(
  answered: number,
  target: number,
): TestCardProgressStatus {
  if (answered >= target) return "done";
  if (answered > 0) return "in_progress";
  return "new";
}

export function formatTestTypeLabel(type: string | undefined): string {
  return type === "select" ? "Multiple Choice" : "Written";
}

const STATUS_META: Record<
  TestCardProgressStatus,
  { label: string; icon: LucideIcon; color: string; bg: string; border: string }
> = {
  done: {
    label: "Done",
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  in_progress: {
    label: "In Progress",
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  new: {
    label: "Not Started",
    icon: Clock,
    color: "text-white/40",
    bg: "bg-white/5",
    border: "border-white/10",
  },
};

export interface TestStackCardProps {
  id: string;
  href: string;
  /** Raw layer count; clamped to 1–5 for the visual stack. */
  stackDepth: number;
  status: TestCardProgressStatus;
  typeLabel: string;
  title: string;
  /** Optional line above the title (e.g. space name on the global list). */
  eyebrow?: string;
  answered: number;
  target: number;
  /** Optional right-side count on the progress row (e.g. "12 questions"). */
  secondaryCountLabel?: string;
  /** Optional creation timestamp shown in the footer. */
  createdAt?: number;
  showOpenCta?: boolean;
  animationDelay?: number;
}

/**
 * Shared 3D stack card used by the global /tests list and space TestGrid.
 */
export function TestStackCard({
  id,
  href,
  stackDepth: rawDepth,
  status,
  typeLabel,
  title,
  eyebrow,
  answered,
  target,
  secondaryCountLabel,
  createdAt,
  showOpenCta = false,
  animationDelay = 0,
}: TestStackCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const stackDepth = Math.min(Math.max(rawDepth, 1), 5);
  const padTop = Math.max(0, (stackDepth - 1) * 6);
  const padLeft = Math.max(0, (stackDepth - 1) * 2);
  const progress = Math.min(
    100,
    Math.max(0, target > 0 ? (answered / target) * 100 : 0),
  );
  const statusInfo = STATUS_META[status];
  const StatusIcon = statusInfo.icon;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <Link href={href}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: animationDelay,
          type: "spring",
          stiffness: 400,
          damping: 25,
        }}
        className="group relative cursor-pointer"
        style={{ paddingTop: `${padTop}px`, paddingLeft: `${padLeft}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseMove={handleMouseMove}
      >
        {Array.from({ length: stackDepth }).map((_, i) => {
          if (i === stackDepth - 1) return null;
          const depth = stackDepth - 1 - i;
          const h = hashCode(id + i);
          const rot = ((h % 5) - 2) * 0.6;
          return (
            <motion.div
              key={`bg-${i}`}
              className="absolute rounded-xl border border-white/[0.05] bg-neutral-950/50"
              animate={{
                rotate: isHovered ? rot * 1.5 : rot,
                x: isHovered ? -depth * 3 : -depth * 2,
                y: isHovered ? -depth * 5 : -depth * 4,
              }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              style={{
                zIndex: i,
                top: `${padTop}px`,
                left: `${padLeft}px`,
                right: 0,
                bottom: 0,
              }}
            />
          );
        })}

        <motion.div
          className="relative glass-card rounded-xl overflow-hidden"
          animate={{ scale: isHovered ? 1.02 : 1, y: isHovered ? -3 : 0 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          style={{ zIndex: stackDepth }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              background: isHovered
                ? `radial-gradient(250px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.04), transparent 60%)`
                : "none",
            }}
          />

          <div className="relative z-10 p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider ${statusInfo.color} ${statusInfo.bg} border ${statusInfo.border}`}
              >
                <StatusIcon className="w-2.5 h-2.5" />
                {statusInfo.label}
              </div>
              <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-semibold text-white/50 uppercase tracking-wider">
                {typeLabel}
              </div>
            </div>

            <div className={eyebrow ? "mt-1" : undefined}>
              {eyebrow ? (
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-1">
                  {eyebrow}
                </p>
              ) : null}
              <p
                className={`font-medium text-sm text-primary leading-tight line-clamp-2 ${eyebrow ? "" : "mt-1"}`}
              >
                {title}
              </p>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-secondary">
                  {answered} / {target} q
                </span>
                {secondaryCountLabel ? (
                  <span className="text-tertiary">{secondaryCountLabel}</span>
                ) : progress > 0 ? (
                  <span className="text-tertiary">{Math.round(progress)}%</span>
                ) : null}
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${status === "done" ? "bg-emerald-500/50" : "bg-white/20"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                />
              </div>
            </div>

            {(createdAt !== undefined || showOpenCta) && (
              <div className="flex items-center justify-between mt-1">
                {createdAt !== undefined ? (
                  <span className="text-[10px] text-white/15 font-mono">
                    {new Date(createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                ) : (
                  <span />
                )}
                {showOpenCta ? (
                  <div className="flex items-center gap-1 text-white/20 group-hover:text-white/70 transition-colors">
                    <span className="text-[10px] font-semibold uppercase tracking-widest">
                      Open
                    </span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </Link>
  );
}
