"use client";

import Link from "next/link";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { SignedIn, SignedOut, useAuth, useUser } from "@clerk/nextjs";
import { CheckoutButton, SubscriptionDetailsButton, usePlans, useSubscription } from "@clerk/nextjs/experimental";
import { useState } from "react";

type PlanKey = "free" | "basic" | "pro" | "educator";
type BillingPeriod = "month" | "annual";

type PlanCard = {
    id?: string;
    hintKey: PlanKey;
    name: string;
    monthlyPrice: string;
    annualMonthlyPrice?: string;
    monthlyAmount: number;
    annualMonthlyAmount?: number;
    annualAvailable: boolean;
    description: string;
    features: PlanFeature[];
    isFree: boolean;
};

type PlanFeature = {
    name: string;
    slug?: string;
    fromClerk?: boolean;
};

type ClerkMoney = {
    amount: number;
    amountFormatted: string;
    currencySymbol: string;
};

type ClerkFeature = {
    name: string;
    slug?: string;
};

type ClerkPlanLite = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    fee: ClerkMoney;
    annualFee: ClerkMoney | null;
    annualMonthlyFee: ClerkMoney | null;
    hasBaseFee: boolean;
    isDefault: boolean;
    publiclyVisible: boolean;
    forPayerType: string;
    features: ClerkFeature[];
};

const PLAN_IDS = {
    basic: process.env.NEXT_PUBLIC_CLERK_PLAN_BASIC_ID ?? "basic_tests",
    pro: process.env.NEXT_PUBLIC_CLERK_PLAN_PRO_ID ?? "pro_scholar",
    educator: process.env.NEXT_PUBLIC_CLERK_PLAN_EDUCATOR_ID ?? "educator",
} as const;

function getCurrentTier(has: ReturnType<typeof useAuth>["has"]): PlanKey {
    if (has?.({ feature: "unlimited_ai_tests" })) return "educator";
    if (has?.({ feature: "pro_tests" })) return "pro";
    if (has?.({ feature: "basic_tests" })) return "basic";
    return "free";
}

function toDisplayAmount(money: ClerkMoney | null | undefined): string {
    if (!money) return "$0";
    return `${money.currencySymbol}${money.amountFormatted}`;
}

function inferTierFromPlan(plan: Pick<ClerkPlanLite, "name" | "slug" | "isDefault" | "hasBaseFee" | "fee">): PlanKey {
    if (plan.isDefault || !plan.hasBaseFee || plan.fee.amount === 0) return "free";

    const token = `${plan.name} ${plan.slug}`.toLowerCase();
    if (/educator|teacher/.test(token)) return "educator";
    if (/pro|scholar|premium|plus/.test(token)) return "pro";
    if (/basic|starter/.test(token)) return "basic";

    return "pro";
}

function defaultDescriptionForTier(tier: PlanKey): string {
    switch (tier) {
        case "basic":
            return "Enough for focused solo study.";
        case "pro":
            return "High-volume study with room to grow.";
        case "educator":
            return "Top limits for heavy usage.";
        default:
            return "Start small with strict limits.";
    }
}

function toPlanFeatures(featureNames: string[]): PlanFeature[] {
    return featureNames.map((name) => ({ name }));
}

function defaultFeaturesForTier(tier: PlanKey): PlanFeature[] {
    switch (tier) {
        case "basic":
            return toPlanFeatures(["3 spaces", "50 knowledge pieces / space", "10 AI tests / month"]);
        case "pro":
            return toPlanFeatures(["Unlimited spaces", "200 knowledge pieces / space", "100 AI tests / month"]);
        case "educator":
            return toPlanFeatures(["Unlimited spaces", "Unlimited knowledge pieces", "300 AI tests / month"]);
        default:
            return toPlanFeatures(["3 spaces", "20 knowledge pieces / space", "10 AI tests / month"]);
    }
}

function isKnowledgeNodesFeature(feature: PlanFeature): boolean {
    if (!feature.fromClerk) return false;
    const token = `${feature.slug ?? ""} ${feature.name}`.toLowerCase();
    return (
        token.includes("knowledge node") ||
        token.includes("knowledge-node") ||
        token.includes("knowledge_node") ||
        token.includes("knowledge_nodes")
    );
}

function toPlanCard(plan: ClerkPlanLite): PlanCard {
    const isFree = !plan.hasBaseFee || plan.fee.amount === 0;
    const hintKey = inferTierFromPlan(plan);
    const annualAvailable = Boolean(plan.annualFee && plan.annualMonthlyFee && plan.annualMonthlyFee.amount > 0);

    const features = plan.features
        .map((feature) => ({
            name: feature.name?.trim(),
            slug: feature.slug,
            fromClerk: true,
        }))
        .filter((feature) => Boolean(feature.name)) as PlanFeature[];

    return {
        id: plan.id,
        hintKey,
        name: plan.name,
        monthlyPrice: toDisplayAmount(plan.fee),
        annualMonthlyPrice: annualAvailable ? toDisplayAmount(plan.annualMonthlyFee) : undefined,
        monthlyAmount: plan.fee.amount,
        annualMonthlyAmount: annualAvailable ? (plan.annualMonthlyFee?.amount ?? undefined) : undefined,
        annualAvailable,
        description: plan.description?.trim() ?? defaultDescriptionForTier(hintKey),
        features: features.length > 0 ? features : defaultFeaturesForTier(hintKey),
        isFree,
    };
}

const fallbackPlans: PlanCard[] = [
    {
        id: undefined,
        hintKey: "free",
        name: "Free",
        monthlyPrice: "$0",
        monthlyAmount: 0,
        annualAvailable: false,
        description: "Start small with strict limits.",
        features: toPlanFeatures(["3 spaces", "20 knowledge pieces / space", "10 AI tests / month"]),
        isFree: true,
    },
    {
        id: PLAN_IDS.basic,
        hintKey: "basic",
        name: "Starter",
        monthlyPrice: "$2.00",
        annualMonthlyPrice: "$1.50",
        monthlyAmount: 200,
        annualMonthlyAmount: 150,
        annualAvailable: true,
        description: "Enough for focused solo study.",
        features: toPlanFeatures(["3 spaces", "50 knowledge pieces / space", "10 AI tests / month"]),
        isFree: false,
    },
    {
        id: PLAN_IDS.pro,
        hintKey: "pro",
        name: "Pro Scholar",
        monthlyPrice: "$9.00",
        annualMonthlyPrice: "$7.50",
        monthlyAmount: 900,
        annualMonthlyAmount: 750,
        annualAvailable: true,
        description: "High-volume study with room to grow.",
        features: toPlanFeatures(["Unlimited spaces", "200 knowledge pieces / space", "100 AI tests / month"]),
        isFree: false,
    },
    {
        id: PLAN_IDS.educator,
        hintKey: "educator",
        name: "Educator",
        monthlyPrice: "$19.00",
        annualMonthlyPrice: "$16.00",
        monthlyAmount: 1900,
        annualMonthlyAmount: 1600,
        annualAvailable: true,
        description: "Top limits for heavy usage.",
        features: toPlanFeatures(["Unlimited spaces", "Unlimited knowledge pieces", "300 AI tests / month"]),
        isFree: false,
    },
];

function getDisplayedPlanValues(plan: PlanCard, billingCycle: BillingPeriod) {
    if (plan.isFree) {
        return {
            price: plan.monthlyPrice,
            periodLabel: undefined as string | undefined,
            billingNote: undefined as string | undefined,
            checkoutPeriod: undefined as BillingPeriod | undefined,
        };
    }

    if (billingCycle === "annual" && plan.annualAvailable && plan.annualMonthlyPrice) {
        return {
            price: plan.annualMonthlyPrice,
            periodLabel: "/month",
            billingNote: "Billed annually",
            checkoutPeriod: "annual" as BillingPeriod,
        };
    }

    return {
        price: plan.monthlyPrice,
        periodLabel: "/month",
        billingNote: "Billed monthly",
        checkoutPeriod: "month" as BillingPeriod,
    };
}

export default function PricingPage() {
    const { isLoaded } = useUser();
    const { has } = useAuth();
    const [billingCycle, setBillingCycle] = useState<BillingPeriod>("month");

    const plansQuery = usePlans({ for: "user", pageSize: 30 });
    const subscriptionQuery = useSubscription({ for: "user" });

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
        );
    }

    const currentTier = getCurrentTier(has);

    const dynamicPlans = (plansQuery.data ?? [])
        .filter((plan) => {
            const p = plan as unknown as ClerkPlanLite;
            return p.forPayerType === "user" && p.publiclyVisible;
        })
        .map((plan) => toPlanCard(plan as unknown as ClerkPlanLite))
        .sort((a, b) => a.monthlyAmount - b.monthlyAmount);

    const plans = dynamicPlans.length > 0 ? dynamicPlans : fallbackPlans;

    const currentPlanIds = new Set(
        (subscriptionQuery.data?.subscriptionItems ?? []).map((item) => item.plan.id)
    );

    const showPlansLoading = plansQuery.isLoading && dynamicPlans.length === 0;

    return (
        <>
            <SignedOut>
                <div className="min-h-screen bg-black text-white px-5 py-10 md:px-10 md:py-12">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:24px_24px]" />
                    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10">
                        <div className="flex items-center justify-between">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white spring-interact"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Link>
                            <Link
                                href="/sign-in"
                                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 spring-interact"
                            >
                                Sign in
                            </Link>
                        </div>

                        <header className="space-y-3 text-center">
                            <p className="text-xs uppercase tracking-[0.22em] text-white/45">Pricing</p>
                            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Simple pricing, built in.</h1>
                            <p className="mx-auto max-w-2xl text-sm text-white/60 md:text-base">
                                Review plans publicly, then sign in to subscribe.
                            </p>
                            <div className="mx-auto flex w-fit items-center rounded-xl border border-white/10 bg-white/[0.03] p-1">
                                <button
                                    onClick={() => setBillingCycle("month")}
                                    className={`rounded-lg px-4 py-1.5 text-sm spring-interact ${billingCycle === "month" ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setBillingCycle("annual")}
                                    className={`rounded-lg px-4 py-1.5 text-sm spring-interact ${billingCycle === "annual" ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
                                >
                                    Yearly
                                </button>
                            </div>
                        </header>

                        <section className="mx-auto grid w-full max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
                            {fallbackPlans.map((plan) => {
                                const displayed = getDisplayedPlanValues(plan, billingCycle);
                                return (
                                    <article
                                        key={`public-${plan.hintKey}`}
                                        className="group relative flex min-h-[390px] flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.8)] md:p-6"
                                    >
                                        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ background: "radial-gradient(500px circle at 50% -5%, rgba(255,255,255,0.08), transparent 45%)" }} />
                                        <div className="relative flex min-h-[145px] flex-col gap-2">
                                            <h2 className="text-xl font-semibold tracking-tight">{plan.name}</h2>
                                            <p className="min-h-[66px] text-sm leading-relaxed text-white/60">{plan.description}</p>
                                            <div className="flex items-baseline gap-1.5 pt-1">
                                                <span className="text-4xl font-semibold tracking-tight">{displayed.price}</span>
                                                {displayed.periodLabel && <span className="text-sm text-white/50">{displayed.periodLabel}</span>}
                                            </div>
                                            {displayed.billingNote && (
                                                <p className="text-xs text-white/40">{displayed.billingNote}</p>
                                            )}
                                        </div>
                                        <div className="relative mt-4 border-t border-white/10" />
                                        <ul className="relative mt-4 flex-1 space-y-2.5 text-sm text-white/75">
                                            {plan.features.map((feature) => (
                                                <li key={feature.slug ?? feature.name} className="flex items-start gap-2">
                                                    <Check className="mt-[1px] h-4 w-4 shrink-0 text-white/55" />
                                                    <span>{feature.name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="relative mt-auto pt-5">
                                            <Link
                                                href="/sign-in"
                                                className="flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-neutral-200 spring-interact"
                                            >
                                                Sign in to subscribe
                                            </Link>
                                        </div>
                                    </article>
                                );
                            })}
                        </section>
                    </div>
                </div>
            </SignedOut>

            <SignedIn>
                <div className="min-h-screen bg-black text-white px-5 py-10 md:px-10 md:py-12">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:24px_24px]" />

                    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10">
                        <div className="flex items-center justify-between">
                            <Link
                                href="/spaces"
                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white spring-interact"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Link>

                            <SubscriptionDetailsButton>
                                <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white spring-interact">
                                    Manage subscription
                                    <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-white/45">⌘ M</span>
                                </button>
                            </SubscriptionDetailsButton>
                        </div>

                        <header className="space-y-3 text-center">
                            <p className="text-xs uppercase tracking-[0.22em] text-white/45">Billing</p>
                            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Simple pricing, built in.</h1>
                            <p className="mx-auto max-w-2xl text-sm text-white/60 md:text-base">
                                Pick a plan, check out, and manage your subscription without leaving Exigo.
                            </p>
                            <div className="mx-auto flex w-fit items-center rounded-xl border border-white/10 bg-white/[0.03] p-1">
                                <button
                                    onClick={() => setBillingCycle("month")}
                                    className={`rounded-lg px-4 py-1.5 text-sm spring-interact ${billingCycle === "month" ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setBillingCycle("annual")}
                                    className={`rounded-lg px-4 py-1.5 text-sm spring-interact ${billingCycle === "annual" ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
                                >
                                    Yearly
                                </button>
                            </div>
                            <p className="text-xs text-white/40">Annual discounts are shown where available.</p>
                        </header>

                        {plansQuery.error && dynamicPlans.length === 0 && (
                            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/60">
                                Could not fetch plans from Clerk right now. Showing fallback pricing.
                            </div>
                        )}

                        {showPlansLoading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                            </div>
                        ) : (
                            <section className="mx-auto grid w-full max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
                                {plans.map((plan) => {
                                    const isCurrentById = plan.id ? currentPlanIds.has(plan.id) : false;
                                    const isCurrentByHint = currentPlanIds.size === 0 && plan.hintKey === currentTier;
                                    const isCurrent = isCurrentById || isCurrentByHint;
                                    const displayed = getDisplayedPlanValues(plan, billingCycle);

                                    return (
                                        <article
                                            key={plan.id ?? `fallback-${plan.hintKey}-${plan.name}`}
                                            className="group relative flex min-h-[390px] flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.8)] md:p-6"
                                        >
                                            <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ background: "radial-gradient(500px circle at 50% -5%, rgba(255,255,255,0.08), transparent 45%)" }} />

                                            <div className="relative flex min-h-[145px] flex-col gap-2">
                                                <h2 className="text-xl font-semibold tracking-tight">{plan.name}</h2>
                                                <p className="min-h-[66px] text-sm leading-relaxed text-white/60">{plan.description}</p>
                                                <div className="flex items-baseline gap-1.5 pt-1">
                                                    <span className="text-4xl font-semibold tracking-tight">{displayed.price}</span>
                                                    {displayed.periodLabel && <span className="text-sm text-white/50">{displayed.periodLabel}</span>}
                                                </div>
                                                {displayed.billingNote && (
                                                    <p className="text-xs text-white/40">{displayed.billingNote}</p>
                                                )}
                                            </div>

                                            <div className="relative mt-4 border-t border-white/10" />

                                            <ul className="relative mt-4 flex-1 space-y-2.5 text-sm text-white/75">
                                                {plan.features.map((feature) => (
                                                    <li key={feature.slug ?? feature.name} className="flex items-start gap-2">
                                                        <Check className="mt-[1px] h-4 w-4 shrink-0 text-white/55" />
                                                        {isKnowledgeNodesFeature(feature) ? (
                                                            <Link
                                                                href="/knowledge-nodes"
                                                                className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white/40"
                                                            >
                                                                {feature.name}
                                                            </Link>
                                                        ) : (
                                                            <span>{feature.name}</span>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>

                                            <div className="relative mt-auto pt-5">
                                                {isCurrent ? (
                                                    <button
                                                        disabled
                                                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/50"
                                                    >
                                                        Current plan
                                                    </button>
                                                ) : plan.isFree ? (
                                                    <SubscriptionDetailsButton>
                                                        <button className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] spring-interact">
                                                            Manage in subscription
                                                        </button>
                                                    </SubscriptionDetailsButton>
                                                ) : plan.id ? (
                                                    <CheckoutButton
                                                        planId={plan.id}
                                                        planPeriod={displayed.checkoutPeriod}
                                                        newSubscriptionRedirectUrl="/pricing"
                                                    >
                                                        <button className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-neutral-200 spring-interact">
                                                            Switch to this plan
                                                        </button>
                                                    </CheckoutButton>
                                                ) : (
                                                    <button
                                                        disabled
                                                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/40"
                                                    >
                                                        Plan not configured
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </section>
                        )}
                    </div>
                </div>
            </SignedIn>
        </>
    );
}
