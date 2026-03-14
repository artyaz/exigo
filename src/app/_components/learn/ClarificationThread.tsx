"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2, ArrowUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface ClarificationMessage {
    role: "user" | "teacher" | "system";
    content: string;
}

export interface ClarificationThreadProps {
    quote: string;
    messages: ClarificationMessage[];
    /** Currently streaming text — rendered as a live AI bubble */
    streamingText?: string;
    onReply: (question: string) => void;
    isLoading?: boolean;
    isExpanded?: boolean;
    onToggleExpanded?: () => void;
}

const THREAD_SPRING = {
    type: "spring" as const,
    stiffness: 350,
    damping: 26,
    mass: 0.9,
};

export function ClarificationThread({
    quote,
    messages,
    streamingText,
    onReply,
    isLoading,
    isExpanded = true,
    onToggleExpanded,
}: ClarificationThreadProps) {
    const [replyText, setReplyText] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || isLoading) return;
        const text = replyText;
        setReplyText("");
        onReply(text);
    };

    const isWaitingForFirstToken = isLoading && (!streamingText || streamingText.length === 0);
    const isStreaming = isLoading && !!streamingText && streamingText.length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={THREAD_SPRING}
            className="my-4 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        >
            {/* Accordion header */}
            <button
                onClick={() => onToggleExpanded?.()}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-1 h-4 rounded-full bg-emerald-500/40 shrink-0" />
                    <div className="text-left min-w-0">
                        <p className="text-[11px] font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.12em] text-white/30">
                            Clarification
                        </p>
                        <p className="text-xs text-white/40 truncate max-w-md">
                            &ldquo;{quote}&rdquo;
                        </p>
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown className="w-3.5 h-3.5 text-white/25" />
                </motion.div>
            </button>

            {/* Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="border-t border-white/[0.04]"
                    >
                        <div className="p-4 flex flex-col gap-4">
                            {/* Existing messages */}
                            {messages.map((msg, i) => {
                                const isUser = msg.role === "user";
                                // Teacher messages must NOT animate in (no opacity:0→1)
                                // because they replace the live streaming bubble.
                                // Animating them in causes a visible flash/blink.
                                return isUser ? (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05, ...THREAD_SPRING }}
                                        className="flex gap-2.5 justify-end"
                                    >
                                        <div className="rounded-xl text-sm leading-relaxed max-w-[85%] bg-white/[0.06] border border-white/[0.08] text-white/80 px-3.5 py-2.5">
                                            {msg.content}
                                        </div>
                                        <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-[10px] text-white/50">You</span>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div key={i} className="flex gap-2.5">
                                        <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-[10px] text-white/50">AI</span>
                                        </div>
                                        <div className="text-white/70 text-sm leading-relaxed max-w-[85%]">
                                            <div className="clarification-markdown">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Waiting for first token — "Thinking" spinner */}
                            {isWaitingForFirstToken && (
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={THREAD_SPRING}
                                    className="flex gap-2.5"
                                >
                                    <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                                        <span className="text-[10px] text-white/50">AI</span>
                                    </div>
                                    <div className="flex items-center gap-2 py-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white/25" />
                                        <span className="text-[11px] text-white/25 font-[family-name:var(--font-geist-mono)] uppercase tracking-widest">
                                            Thinking
                                        </span>
                                    </div>
                                </motion.div>
                            )}

                            {/* Live streaming bubble — renders token-by-token */}
                            {isStreaming && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={THREAD_SPRING}
                                    className="flex gap-2.5"
                                >
                                    <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-[10px] text-white/50">AI</span>
                                    </div>
                                    <div className="text-white/70 max-w-[85%]">
                                        <div className="clarification-markdown">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {streamingText}
                                            </ReactMarkdown>
                                        </div>
                                        <span className="inline-block w-[2px] h-[14px] bg-emerald-400/60 animate-pulse ml-0.5 align-text-bottom" />
                                    </div>
                                </motion.div>
                            )}

                            <div ref={bottomRef} />

                            {/* Reply input — hidden while loading */}
                            {!isLoading && messages.length > 0 && (
                                <form onSubmit={handleSubmit} className="flex gap-2 mt-1">
                                    <textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Ask a follow-up..."
                                        rows={1}
                                        disabled={isLoading}
                                        className="flex-1 bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.15] transition-colors resize-none"
                                        onInput={(e) => {
                                            const el = e.currentTarget;
                                            el.style.height = "auto";
                                            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSubmit(e);
                                            }
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!replyText.trim() || isLoading}
                                        className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] text-white/50 flex items-center justify-center hover:bg-white/[0.1] hover:text-white/70 disabled:opacity-30 transition-all self-end"
                                    >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
