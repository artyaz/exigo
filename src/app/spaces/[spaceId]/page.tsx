"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useState, use, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  BookOpen,
  Zap,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { LearnTab } from "../../_components/learn/LearnTab";
import { CourseTutor } from "../../_components/learn/CourseTutor";
import { TestGrid } from "../../_components/tests/TestGrid";
import { TestGenerateButton } from "../../_components/tests/TestGenerateButton";
import { KnowledgeTab } from "../../_components/spaces/KnowledgeTab";
import { KnowledgeNodeModal } from "../../_components/spaces/KnowledgeNodeModal";

function useSpaceData(spaceId: Id<"spaces">, userId: string | null | undefined) {
  const space = useQuery(api.spaces.get, userId ? { spaceId } : "skip");
  const pieces = useQuery(
    api.knowledgePieces.getForSpace,
    userId ? { spaceId } : "skip",
  );
  const spaceTests = useQuery(
    api.tests.getForSpace,
    userId ? { spaceId } : "skip",
  );
  const spaceQuestions = useQuery(
    api.questions.getForSpace,
    userId ? { spaceId } : "skip",
  );
  return { space, pieces, spaceTests, spaceQuestions };
}

export default function SpaceDetailPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const searchParams = useSearchParams();
  const { userId } = useAuth();
  const { spaceId } = use(params);
  const sId = spaceId as Id<"spaces">;

  const { space, pieces, spaceTests, spaceQuestions } = useSpaceData(
    sId,
    userId,
  );

  const [mainTab, setMainTab] = useState<"tests" | "knowledge" | "learn">(
    () => {
      const tab = searchParams.get("tab");
      if (tab === "tests" || tab === "knowledge") return tab;
      return "learn";
    },
  );

  const [viewingPieceId, setViewingPieceId] = useState<string | null>(null);
  const closeNodeModal = useCallback(() => setViewingPieceId(null), []);

  if (space === undefined || pieces === undefined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (space === null) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center flex-col gap-4">
        <h1 className="text-2xl font-medium tracking-tight">Space not found</h1>
        <Link
          href="/spaces"
          className="text-secondary hover:text-primary text-sm transition-colors"
        >
          Return to Spaces
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <header className="flex items-center gap-4">
          <Link
            href="/spaces"
            className="p-2 glass-card rounded-xl hover:bg-white/5 spring-interact text-secondary hover:text-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-primary">
            {space.name}
          </h1>
        </header>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-white/10">
          <button
            onClick={() => setMainTab("learn")}
            className={`px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              mainTab === "learn"
                ? "border-white text-primary"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Learn
          </button>
          <button
            onClick={() => setMainTab("tests")}
            className={`px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              mainTab === "tests"
                ? "border-white text-primary"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Tests
            {spaceTests && spaceTests.length > 0 && (
              <span className="text-[10px] font-mono text-tertiary bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">
                {spaceTests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMainTab("knowledge")}
            className={`px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              mainTab === "knowledge"
                ? "border-white text-primary"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Knowledge
            {pieces.length > 0 && (
              <span className="text-[10px] font-mono text-tertiary bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">
                {pieces.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {mainTab === "tests" ? (
            <motion.div
              key="tests-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-6"
            >
              <TestGenerateButton spaceId={spaceId} pieces={pieces} />
              <div className="border-t border-white/5 my-2" />
              <TestGrid
                spaceTests={spaceTests}
                spaceQuestions={spaceQuestions}
              />
            </motion.div>
          ) : mainTab === "knowledge" ? (
            <motion.div
              key="knowledge-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <KnowledgeTab
                spaceId={sId}
                userId={userId}
                pieces={pieces}
                onViewPiece={setViewingPieceId}
              />
            </motion.div>
          ) : (
            <motion.div
              key="learn-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-6"
            >
              <LearnTab
                spaceId={spaceId}
                userId={userId ?? ""}
                spaceName={space.name}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <KnowledgeNodeModal
        pieceId={viewingPieceId}
        userId={userId}
        onClose={closeNodeModal}
      />

      <CourseTutor spaceId={space._id} />
    </div>
  );
}
