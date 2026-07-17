"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  Loader2,
  CheckCircle2,
  Target,
  TrendingUp,
  AlertTriangle,
  X,
} from "lucide-react";
import { RESOLUTION_THRESHOLD } from "../../../../shared/planConfig";

function getNodeTypeInfo(nodeType: "feels_hard" | "struggle" | "improvement") {
  switch (nodeType) {
    case "feels_hard":
      return {
        label: "Feels Hard",
        icon: AlertTriangle,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
      };
    case "struggle":
      return {
        label: "Struggle Area",
        icon: Target,
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/20",
      };
    default:
      return {
        label: "Improvement",
        icon: TrendingUp,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
      };
  }
}

interface KnowledgeNodeModalProps {
  pieceId: string | null;
  userId: string | null | undefined;
  onClose: () => void;
}

export function KnowledgeNodeModal({
  pieceId,
  userId,
  onClose,
}: KnowledgeNodeModalProps) {
  const activeNodes = useQuery(
    api.knowledgeNodes.getActiveForPiece,
    userId && pieceId
      ? { knowledgePieceId: pieceId as Id<"knowledgePieces"> }
      : "skip",
  );

  useEffect(() => {
    if (!pieceId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pieceId, onClose]);

  return (
    <AnimatePresence>
      {pieceId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[85vh] glass-card rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Knowledge Nodes"
          >
            {/* Modal header */}
            <div className="shrink-0 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <BrainCircuit className="w-4 h-4 text-white/40" />
                <h3 className="text-sm font-semibold text-primary tracking-tight">
                  Knowledge Nodes
                </h3>
                {activeNodes !== undefined && (
                  <span className="text-[10px] font-mono text-tertiary bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">
                    {activeNodes.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 spring-interact text-white/40 hover:text-white"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Node list */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {(() => {
                if (activeNodes === undefined) {
                  return (
                    <div className="flex justify-center p-12">
                      <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                    </div>
                  );
                }

                if (activeNodes.length === 0) {
                  return (
                    <div className="text-center flex flex-col items-center gap-3 p-12 opacity-50">
                      <CheckCircle2 className="w-8 h-8 opacity-50" />
                      <p className="text-sm">
                        No active focus areas. You&apos;re doing great.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid gap-3">
                    {activeNodes.map((node) => {
                      const nodeInfo = getNodeTypeInfo(node.type);
                      const Icon = nodeInfo.icon;
                      const progressPct = Math.round(
                        (node.resolutionScore / RESOLUTION_THRESHOLD) * 100,
                      );

                      return (
                        <div
                          key={node._id}
                          className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-start gap-4"
                        >
                          <div
                            className={`p-2 rounded-lg border shrink-0 ${nodeInfo.bg} ${nodeInfo.border} ${nodeInfo.color}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/80">
                                {nodeInfo.label}
                              </h4>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-white/30 truncate">
                                  Target: {node.resolutionScore}/
                                  {RESOLUTION_THRESHOLD} ({progressPct}%)
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                              {node.content}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Modal footer */}
            <div className="shrink-0 px-6 py-3 border-t border-white/[0.06] flex items-center justify-between bg-black/50">
              <p className="text-xs text-white/30 truncate max-w-[250px]">
                Nodes are generated by your interactions and resolve as you test
                accurately.
              </p>
              <div className="flex items-center gap-2 text-white/20 shrink-0">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono">
                  Esc
                </kbd>
                <span className="text-[10px]">Close</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
