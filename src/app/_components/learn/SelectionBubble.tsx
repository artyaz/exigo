"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Loader2, X } from "lucide-react";

export interface SelectionBubbleProps {
    position: { top: number; left: number };
    quote: string;
    initialChars: string;
    onSubmit: (question: string) => void;
    onClose: () => void;
    isSubmitting: boolean;
}

const BOUNCE_SPRING = {
    type: "spring" as const,
    stiffness: 380,
    damping: 22,
    mass: 0.8,
};

export function SelectionBubble({
    position,
    quote,
    initialChars,
    onSubmit,
    onClose,
    isSubmitting,
}: SelectionBubbleProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.value = initialChars;
            inputRef.current.focus();
            inputRef.current.setSelectionRange(initialChars.length, initialChars.length);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        const value = inputRef.current?.value.trim();
        if (!value || isSubmitting) return;
        onSubmit(value);
    };

    return (
        <motion.div
            className="absolute z-50"
            style={{
                top: position.top + 6,
                left: Math.max(24, Math.min(position.left, 640)),
                transform: "translateX(-50%)",
            }}
            initial={{ scale: 0.3, opacity: 0, y: -16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: -8 }}
            transition={BOUNCE_SPRING}
        >
            <div 
                className="absolute z-10 -top-[5px] left-1/2 -translate-x-1/2 w-[11px] h-[11px] rotate-45 border-t border-l border-[rgba(255,255,255,0.08)]"
                style={{ backgroundColor: "#171717", borderBottom: "none", borderRight: "none" }}
            />

            <form
                onSubmit={handleSubmit}
                className="relative z-0 bg-neutral-900 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-xl p-2 flex flex-col gap-2 min-w-[320px] max-w-[420px]"
                style={{ backgroundColor: "#171717" }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Quote preview */}
                <div className="flex items-start gap-2 px-1.5 pt-0.5">
                    <p className="text-[11px] text-white/35 italic line-clamp-1 leading-relaxed flex-1">
                        &ldquo;{quote}&rdquo;
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white/20 hover:text-white/60 transition-colors shrink-0"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Input */}
                <div className="relative flex items-center bg-black/40 rounded-lg border border-white/[0.05] focus-within:border-white/[0.15] transition-colors">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="What does this mean?"
                        className="flex-1 bg-transparent text-sm text-white focus:outline-none px-3 py-2 placeholder:text-white/20"
                        disabled={isSubmitting}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                e.preventDefault();
                                onClose();
                            }
                        }}
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="shrink-0 w-7 h-7 rounded-md bg-white/[0.08] text-white/60 flex items-center justify-center hover:bg-white/[0.12] hover:text-white/80 disabled:opacity-30 transition-all mr-1"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <ArrowUp className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>
            </form>
        </motion.div>
    );
}
