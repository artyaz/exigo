"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2,
    MessageSquare,
    BrainCircuit,
    CornerDownLeft,
    AlertTriangle,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { renderMarkdown } from "./markdown";
import type { ToastPayload } from "./useTestAnswerValidation";

const SPRING_SNAPPY = { type: "spring" as const, stiffness: 500, damping: 30 };

type TestChatSidebarProps = {
    testId: Id<"tests">;
    currentQuestionId: Id<"questions"> | undefined;
    currentIndex: number;
    knowledgePieceId?: Id<"knowledgePieces">;
    userId: string | null | undefined;
    /** Optional external toast sink; if omitted, sidebar manages its own toast UI. */
    onToast?: (toast: ToastPayload) => void;
};

export function TestChatSidebar({
    testId,
    currentQuestionId,
    currentIndex,
    knowledgePieceId,
    userId,
    onToast,
}: TestChatSidebarProps) {
    const [chatInput, setChatInput] = useState("");
    const [isSendingChat, setIsSendingChat] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        messageId: string;
        messageContent: string;
    } | null>(null);
    const [feelsHardLoading, setFeelsHardLoading] = useState<string | null>(null);
    const [localToast, setLocalToast] = useState<ToastPayload | null>(null);

    const testMessages = useQuery(
        api.testMessages.getForQuestion,
        currentQuestionId && userId ? { questionId: currentQuestionId, userId } : "skip"
    );

    const showToast = useCallback(
        (toast: ToastPayload) => {
            if (onToast) {
                onToast(toast);
            } else {
                setLocalToast(toast);
            }
        },
        [onToast]
    );

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [testMessages]);

    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        globalThis.addEventListener("click", close);
        globalThis.addEventListener("scroll", close, true);
        return () => {
            globalThis.removeEventListener("click", close);
            globalThis.removeEventListener("scroll", close, true);
        };
    }, [contextMenu]);

    useEffect(() => {
        if (!localToast) return;
        const timer = setTimeout(() => setLocalToast(null), 3500);
        return () => clearTimeout(timer);
    }, [localToast]);

    const handleSendChat = async () => {
        if (!chatInput.trim() || !currentQuestionId) return;
        setIsSendingChat(true);
        const msg = chatInput;
        setChatInput("");

        try {
            const response = await fetch("/api/tests/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    testId,
                    questionId: currentQuestionId,
                    message: msg,
                }),
            });
            if (!response.ok) throw new Error("Chat failed");
        } catch (e) {
            console.error("Chat failed", e);
            setChatInput(msg);
        } finally {
            setIsSendingChat(false);
        }
    };

    const handleMessageContextMenu = useCallback(
        (e: React.MouseEvent, messageId: string, messageContent: string) => {
            e.preventDefault();
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                messageId,
                messageContent,
            });
        },
        []
    );

    const handleFeelsHard = async (messageId: string, messageContent: string) => {
        setContextMenu(null);
        if (!currentQuestionId) return;

        setFeelsHardLoading(messageId);

        try {
            const res = await fetch("/api/tests/feels-hard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    testId,
                    questionId: currentQuestionId,
                    messageContent,
                    knowledgePieceId,
                }),
            });

            if (!res.ok) {
                const errData = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(errData.error ?? "Failed to save");
            }

            showToast({ message: "Struggle note added to knowledge base", type: "success" });
        } catch (e) {
            console.error("Feels hard failed", e);
            showToast({
                message: e instanceof Error ? e.message : "Failed to save",
                type: "error",
            });
        } finally {
            setFeelsHardLoading(null);
        }
    };

    return (
        <>
            <div className="shrink-0 w-80 lg:w-[340px] border-l border-white/[0.06] flex flex-col bg-[#050505] hidden md:flex">
                <div className="shrink-0 px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center">
                        <MessageSquare className="w-3.5 h-3.5 text-white/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-xs text-white/80">AI Tutor</h3>
                        <p className="text-[10px] text-white/30 truncate">
                            {currentQuestionId ? `Q${currentIndex + 1} context` : "Select a question"}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
                    {!currentQuestionId ? (
                        <div className="h-full flex items-center justify-center">
                            <p className="text-xs text-white/20 text-center">No question selected</p>
                        </div>
                    ) : testMessages === undefined ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-white/20" />
                        </div>
                    ) : testMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center px-4">
                            <BrainCircuit className="w-6 h-6 text-white/10 mb-3" />
                            <p className="text-xs text-white/40 mb-1">Need help?</p>
                            <p className="text-[10px] text-white/20 leading-relaxed">
                                Ask the AI tutor about this question for a deeper explanation.
                            </p>
                        </div>
                    ) : (
                        testMessages.map((msg) => (
                            <motion.div
                                key={msg._id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={SPRING_SNAPPY}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`relative max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed group/msg ${
                                        msg.role === "user"
                                            ? "bg-white/[0.08] text-white/80 border border-white/[0.06]"
                                            : "bg-transparent text-white/70 border border-white/[0.06]"
                                    }`}
                                    onContextMenu={
                                        msg.role === "ai"
                                            ? (e) => handleMessageContextMenu(e, msg._id, msg.content)
                                            : undefined
                                    }
                                >
                                    <p className="whitespace-pre-wrap">{renderMarkdown(msg.content)}</p>
                                    {feelsHardLoading === msg._id && (
                                        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                                                <span className="text-[10px] text-amber-400 font-medium">
                                                    Saving...
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                    {isSendingChat && (
                        <div className="flex justify-start">
                            <div className="rounded-xl px-3.5 py-2.5 border border-white/[0.06]">
                                <Loader2 className="w-3 h-3 animate-spin text-white/30" />
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="shrink-0 p-4 border-t border-white/[0.06]">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void handleSendChat();
                        }}
                        className="relative flex items-center"
                    >
                        <input
                            ref={chatInputRef}
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Ask about this question..."
                            disabled={!currentQuestionId || isSendingChat}
                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/15 transition-colors disabled:opacity-40"
                        />
                        <button
                            type="submit"
                            disabled={!chatInput.trim() || isSendingChat}
                            className="absolute right-2 p-1.5 text-white/30 hover:text-white/70 disabled:text-white/10 transition-colors spring-interact"
                        >
                            <CornerDownLeft className="w-3.5 h-3.5" />
                        </button>
                    </form>
                </div>
            </div>

            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.1 }}
                        className="fixed z-[200] min-w-[180px] rounded-xl border border-white/[0.1] bg-[#1a1a1a]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() =>
                                void handleFeelsHard(contextMenu.messageId, contextMenu.messageContent)
                            }
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-left hover:bg-white/[0.06] transition-colors spring-interact"
                        >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-white/80 font-medium">Feels hard</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Local toast only when parent does not own toast presentation */}
            {!onToast && (
                <AnimatePresence>
                    {localToast && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, x: "-50%" }}
                            animate={{ opacity: 1, y: 0, x: "-50%" }}
                            exit={{ opacity: 0, y: 20, x: "-50%" }}
                            transition={SPRING_SNAPPY}
                            className={`fixed bottom-6 left-1/2 z-[200] flex items-center gap-2.5 px-5 py-3 rounded-xl border backdrop-blur-xl shadow-2xl text-xs font-medium ${
                                localToast.type === "success"
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    : "bg-red-500/10 border-red-500/20 text-red-400"
                            }`}
                        >
                            {localToast.type === "success" ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                                <XCircle className="w-3.5 h-3.5" />
                            )}
                            {localToast.message}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </>
    );
}
