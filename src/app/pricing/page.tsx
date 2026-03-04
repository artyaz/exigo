"use client";

import Link from "next/link";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useState } from "react";
import { slugToTier } from "../../../shared/planConfig";

type BillingPeriod = "month" | "annual";

type PlanCard = {
    slug: string;
    name: string;
    basePrice: number;
    accessLevel: number;
    perks: Array<{ text: string; link?: string }>;
    annualSlug?: string;
    annualPrice?: number;
    isFree: boolean;
};

type PrivateMetadata = {
    plan?: string;
    expiresAt?: number;
    paddleSubscriptionId?: string;
};

function usePrivateMetadata(): PrivateMetadata {
    const { user } = useUser();
    if (!user) return {};
    const metadata = (user as unknown as { privateMetadata?: unknown }).privateMetadata;
    if (!metadata || typeof metadata !== "object") return {};

    const meta = metadata as Record<string, unknown>;
    return {
        plan: typeof meta.plan === "string" ? meta.plan : undefined,
        expiresAt: typeof meta.expiresAt === "number" ? meta.expiresAt : undefined,
        paddleSubscriptionId: typeof meta.paddleSubscriptionId === "string"
            ? meta.paddleSubscriptionId
            : undefined,
    };
}

function groupPlans(
    rawPlans: Array<{
        name: string;
        slug: string;
        accessLevel: number;
        perks: Array<{ text: string; link?: string }>;
        basePrice: number;
    }>,
): PlanCard[] {
    const grouped = new Map<string, PlanCard>();

    // Always include free plan
    grouped.set("free", {
        slug: "free",
        name: "Free",
        basePrice: 0,
        accessLevel: 0,
        perks: [
            { text: "3 spaces" },
            { text: "20 knowledge pieces / space" },
            { text: "10 AI tests / month" },
        ],
        isFree: true,
    });

    for (const plan of rawPlans) {
        if (plan.slug === "free") continue;

        const tier = slugToTier(plan.slug);
        const isAnnual = plan.slug.includes("annual");

        const existing = grouped.get(tier);
        if (existing && isAnnual) {
            existing.annualSlug = plan.slug;
            existing.annualPrice = plan.basePrice;
        } else if (!existing && !isAnnual) {
            grouped.set(tier, {
                slug: plan.slug,
                name: plan.name,
                basePrice: plan.basePrice,
                accessLevel: plan.accessLevel,
                perks: plan.perks,
                isFree: false,
            });
        } else if (!existing && isAnnual) {
            // Only annual variant exists
            grouped.set(tier, {
                slug: plan.slug,
                name: plan.name,
                basePrice: plan.basePrice,
                accessLevel: plan.accessLevel,
                perks: plan.perks,
                annualSlug: plan.slug,
                annualPrice: plan.basePrice,
                isFree: false,
            });
        }
    }

    return Array.from(grouped.values()).sort(
        (a, b) => a.accessLevel - b.accessLevel,
    );
}

function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}

function getDisplayValues(plan: PlanCard, period: BillingPeriod) {
    if (plan.isFree) {
        return { price: "$0", periodLabel: undefined, billingNote: undefined, checkoutSlug: undefined };
    }

    if (period === "annual" && plan.annualSlug && plan.annualPrice) {
        const monthly = plan.annualPrice / 12;
        return {
            price: formatPrice(Math.round(monthly)),
            periodLabel: "/month",
            billingNote: "Billed annually",
            checkoutSlug: plan.annualSlug,
        };
    }

    return {
        price: formatPrice(plan.basePrice),
        periodLabel: "/month",
        billingNote: "Billed monthly",
        checkoutSlug: plan.slug,
    };
}

function handleCheckout(planSlug: string) {
    const query = new URLSearchParams({ planSlug }).toString();
    window.location.href = `/checkout?${query}`;
}

function PricingCards({
    plans,
    billingCycle,
    currentPlanSlug,
    isAuthenticated,
}: {
    plans: PlanCard[];
    billingCycle: BillingPeriod;
    currentPlanSlug?: string;
    isAuthenticated: boolean;
}) {
    const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

    const currentTier = slugToTier(currentPlanSlug);

    return (
        <section className="mx-auto grid w-full max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
            {plans.map((plan) => {
                const displayed = getDisplayValues(plan, billingCycle);
                const planTier = slugToTier(plan.slug);
                const isCurrent = planTier === currentTier;

                return (
                    <article
                        key={plan.slug}
                        className="group relative flex min-h-[390px] flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.8)] md:p-6"
                    >
                        <div
                            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                            style={{
                                background:
                                    "radial-gradient(500px circle at 50% -5%, rgba(255,255,255,0.08), transparent 45%)",
                            }}
                        />
                        <div className="relative flex min-h-[145px] flex-col gap-2">
                            <h2 className="text-xl font-semibold tracking-tight">
                                {plan.name}
                            </h2>
                            <div className="flex items-baseline gap-1.5 pt-1">
                                <span className="text-4xl font-semibold tracking-tight">
                                    {displayed.price}
                                </span>
                                {displayed.periodLabel && (
                                    <span className="text-sm text-white/50">
                                        {displayed.periodLabel}
                                    </span>
                                )}
                            </div>
                            {displayed.billingNote && (
                                <p className="text-xs text-white/40">
                                    {displayed.billingNote}
                                </p>
                            )}
                        </div>
                        <div className="relative mt-4 border-t border-white/10" />
                        <ul className="relative mt-4 flex-1 space-y-2.5 text-sm text-white/75">
                            {plan.perks.map((perk) => (
                                <li
                                    key={perk.text}
                                    className="flex items-start gap-2"
                                >
                                    <Check className="mt-[1px] h-4 w-4 shrink-0 text-white/55" />
                                    {perk.link ? (
                                        <Link
                                            href={perk.link}
                                            className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white/40"
                                        >
                                            {perk.text}
                                        </Link>
                                    ) : (
                                        <span>{perk.text}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                        <div className="relative mt-auto pt-5">
                            {!isAuthenticated ? (
                                <Link
                                    href="/sign-in"
                                    className="flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-neutral-200 spring-interact"
                                >
                                    Sign in to subscribe
                                </Link>
                            ) : isCurrent ? (
                                <button
                                    disabled
                                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/50"
                                >
                                    Current plan
                                </button>
                            ) : plan.isFree ? (
                                <button
                                    disabled
                                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/40"
                                >
                                    Default
                                </button>
                            ) : displayed.checkoutSlug ? (
                                <button
                                    onClick={() => {
                                        const slug = displayed.checkoutSlug;
                                        if (!slug) return;
                                        setLoadingSlug(slug);
                                        handleCheckout(slug);
                                    }}
                                    disabled={loadingSlug !== null}
                                    className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-neutral-200 spring-interact disabled:opacity-50"
                                >
                                    {loadingSlug === displayed.checkoutSlug ? (
                                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                                    ) : (
                                        "Switch to this plan"
                                    )}
                                </button>
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
    );
}

export default function PricingPage() {
    const { isLoaded } = useUser();
    const [billingCycle, setBillingCycle] = useState<BillingPeriod>("month");
    const [paddlePrices, setPaddlePrices] = useState<Record<string, number>>({});

    const rawPlans = useQuery(api.plans.list) ?? [];
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const res = await fetch("/api/plans/prices");
                if (!res.ok) return;
                const data = (await res.json()) as { prices?: Record<string, number> };
                if (!cancelled && data.prices) {
                    setPaddlePrices(data.prices);
                }
            } catch {
                // Keep DB fallback prices if Paddle fetch fails.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const plans = groupPlans(
        rawPlans.map((plan) => ({
            ...plan,
            basePrice: paddlePrices[plan.slug] ?? plan.basePrice,
        })),
    );
    const meta = usePrivateMetadata();

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
        );
    }

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
                            <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                                Pricing
                            </p>
                            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                                Simple pricing, built in.
                            </h1>
                            <p className="mx-auto max-w-2xl text-sm text-white/60 md:text-base">
                                Review plans publicly, then sign in to subscribe.
                            </p>
                            <BillingToggle value={billingCycle} onChange={setBillingCycle} />
                        </header>

                        <PricingCards
                            plans={plans}
                            billingCycle={billingCycle}
                            isAuthenticated={false}
                        />
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
                        </div>

                        <header className="space-y-3 text-center">
                            <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                                Billing
                            </p>
                            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                                Simple pricing, built in.
                            </h1>
                            <p className="mx-auto max-w-2xl text-sm text-white/60 md:text-base">
                                Pick a plan, check out, and manage your
                                subscription without leaving Exigo.
                            </p>
                            <BillingToggle value={billingCycle} onChange={setBillingCycle} />
                        </header>

                        <PricingCards
                            plans={plans}
                            billingCycle={billingCycle}
                            currentPlanSlug={meta.plan}
                            isAuthenticated={true}
                        />
                    </div>
                </div>
            </SignedIn>
        </>
    );
}

function BillingToggle({
    value,
    onChange,
}: {
    value: BillingPeriod;
    onChange: (v: BillingPeriod) => void;
}) {
    return (
        <div className="mx-auto flex w-fit items-center rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
                onClick={() => onChange("month")}
                className={`rounded-lg px-4 py-1.5 text-sm spring-interact ${value === "month" ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
            >
                Monthly
            </button>
            <button
                onClick={() => onChange("annual")}
                className={`rounded-lg px-4 py-1.5 text-sm spring-interact ${value === "annual" ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
            >
                Yearly
            </button>
        </div>
    );
}
