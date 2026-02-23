
"use client";

import { motion } from "framer-motion";
import { Check, X, ArrowRight, Zap, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useUser, useClerk, useAuth } from "@clerk/nextjs";

const plans = [
    {
        name: "Free",
        price: "$0",
        description: "The intellectual equivalent of a junk drawer. Good for starting out.",
        features: [
            { name: "3 Spaces", included: true },
            { name: "20 Knowledge Pieces / Space", included: true },
            { name: "Basic Storage", included: true },
            { name: "AI Testing", included: false },
        ],
        buttonText: "Current Plan",
        isActive: true,
        highlight: false,
    },
    {
        name: "Basic",
        price: "$2",
        period: "/mo",
        description: "For the serious-ish student. Just enough to actually start learning.",
        features: [
            { name: "3 Spaces", included: true },
            { name: "50 Knowledge Pieces / Space", included: true },
            { name: "10 AI Tests / month", included: true },
            { name: "Basic AI Feedback", included: true },
        ],
        buttonText: "Upgrade to Basic",
        isActive: false,
        highlight: true,
        href: "/upgrade?plan=basic"
    },
    {
        name: "Pro Scholar",
        price: "$9",
        period: "/mo",
        description: "Create an infinite amount of workspaces to hoard knowledge you will \"definitely read later.\"",
        features: [
            { name: "Unlimited Spaces", included: true },
            { name: "100 AI Tests / month", included: true },
            { name: "50 Deep Dive Study Notes", included: true },
            { name: "200 Knowledge Pieces / Space", included: true },
        ],
        buttonText: "Upgrade to Pro",
        isActive: false,
        highlight: false,
        href: "/upgrade?plan=pro"
    },
    {
        name: "Educator",
        price: "$19",
        period: "/mo",
        description: "Infinite workspaces. High priority and unlimited conversational context.",
        features: [
            { name: "Unlimited Spaces", included: true },
            { name: "300 AI Tests / month", included: true },
            { name: "150 Deep Dive Study Notes", included: true },
            { name: "Unlimited Conversational AI", included: true },
        ],
        buttonText: "Upgrade to Educator",
        isActive: false,
        highlight: false,
        href: "/upgrade?plan=educator"
    },
];

export default function PricingPage() {
    const { isLoaded } = useUser();
    const { has } = useAuth();
    const { openUserProfile } = useClerk();
    const [hoveredCard, setHoveredCard] = useState<number | null>(null);

    const isEducator = has ? has({ feature: "unlimited_ai_tests" }) : false;
    const isPro = has ? has({ feature: "pro_tests" }) : false;
    const isBasic = has ? has({ feature: "basic_tests" }) : false;
    const currentPlan = isEducator ? "Educator" : isPro ? "Pro Scholar" : isBasic ? "Basic" : "Free";


    // Keyboard shortcut for Pro upgrade (simulate press)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u") {
                e.preventDefault();
                // Trigger Pro upgrade modal
                openUserProfile();
            }
        };
        globalThis.addEventListener("keydown", handleKeyDown);
        return () => globalThis.removeEventListener("keydown", handleKeyDown);
    }, [openUserProfile]);

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-white/20 px-6 py-24 md:py-32 font-sans overflow-hidden">
            {/* Background grid for subtle depth */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none select-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                <header className="text-center space-y-4 mb-20 max-w-2xl mx-auto flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full border border-white/10 bg-white/5 text-xs font-medium tracking-wide"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        PRICING
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1, type: "spring", bounce: 0 }}
                        className="text-4xl md:text-5xl font-medium tracking-tight"
                    >
                        Scale your knowledge.
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15, type: "spring", bounce: 0 }}
                        className="text-white/60 text-lg tracking-tight"
                    >
                        Start for free, upgrade when your ambition demands it. No hidden fees.
                    </motion.p>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-start">

                    {plans.map((plan, i) => {
                        const isHovered = hoveredCard === i;
                        const isCurrentPlan = plan.name === currentPlan;

                        return (
                            <motion.div
                                key={plan.name}
                                onMouseEnter={() => setHoveredCard(i)}
                                onMouseLeave={() => setHoveredCard(null)}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: i * 0.1, type: "spring", bounce: 0 }}
                                className={`relative group h-full rounded-2xl border transition-all duration-300 flex flex-col ${plan.highlight
                                    ? "bg-white/5 border-white/20 shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)]"
                                    : "bg-black/50 border-white/10"
                                    }`}
                            >
                                {/* Spotlight Effect using radial gradient */}
                                <div
                                    className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    style={{
                                        background: isHovered
                                            ? "radial-gradient(400px circle at top center, rgba(255,255,255,0.06), transparent 40%)"
                                            : "none",
                                    }}
                                />

                                <div className="p-8 flex flex-col flex-1 relative z-10">
                                    <div className="mb-6">
                                        <h3 className="text-xl font-semibold tracking-tight">{plan.name}</h3>
                                        <p className="mt-4 text-sm text-white/50">Questions? We&apos;d love to chat.</p>
                                        <p className="mt-2 text-sm text-white/60 leading-relaxed min-h-[60px]">
                                            {plan.description}
                                        </p>
                                    </div>

                                    <div className="mb-8 flex items-baseline gap-1">
                                        <span className="text-4xl font-medium tracking-tighter">{plan.price}</span>
                                        {plan.period && <span className="text-sm font-medium text-white/50">{plan.period}</span>}
                                    </div>

                                    {isCurrentPlan ? (
                                        <button
                                            disabled
                                            className="w-full py-3 px-4 rounded-xl text-sm font-medium bg-white/5 text-white/40 cursor-not-allowed border border-white/5"
                                        >
                                            Current Plan
                                        </button>
                                    ) : (
                                        <div className="w-full">
                                            <motion.button
                                                onClick={() => openUserProfile()}
                                                whileTap={{ scale: 0.98 }}
                                                className={`w-full py-3 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${plan.highlight
                                                    ? "bg-white text-black hover:bg-neutral-200 shadow-sm"
                                                    : "bg-white/10 text-white hover:bg-white/15"
                                                    }`}
                                            >
                                                Manage via Profile
                                                {plan.highlight && (
                                                    <span className="hidden md:flex items-center text-[10px] text-black/50 ml-1 tracking-widest font-mono">
                                                        ⌘U
                                                    </span>
                                                )}
                                                <ArrowRight className="w-4 h-4" />
                                            </motion.button>
                                        </div>
                                    )}

                                    <div className="mt-8 pt-8 border-t border-white/10 flex-1">
                                        <p className="text-sm font-medium tracking-tight text-white mb-4">What&apos;s included</p>
                                        <ul className="space-y-4">
                                            {plan.features.map((feature) => (
                                                <li key={feature.name} className="flex gap-3 text-sm">
                                                    {feature.included ? (
                                                        <Check className="w-5 h-5 text-neutral-400 shrink-0" />
                                                    ) : (
                                                        <X className="w-5 h-5 text-neutral-700 shrink-0" />
                                                    )}
                                                    <span className={feature.included ? "text-white/80" : "text-white/40"}>
                                                        {feature.name}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
