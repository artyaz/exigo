import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const SECTIONS = [
    { id: "terms-of-service", title: "Terms of Service" },
    { id: "privacy-policy", title: "Privacy Policy" },
    { id: "refund-policy", title: "Refund Policy" },
];

export default function TermsPage() {
    return (
        <div className="relative min-h-screen bg-black px-6 py-12 text-white md:px-10">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />

            <div className="relative mx-auto max-w-4xl space-y-8">
                <header className="space-y-4 rounded-2xl border border-white/10 bg-neutral-950/60 p-6 shadow-[0_2px_14px_-6px_rgba(0,0,0,0.9)] backdrop-blur-sm md:p-8">
                    <Link
                        href="/"
                        className="group inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60 transition-colors hover:text-white spring-interact"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back
                    </Link>
                    <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Legal</p>
                        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Terms of Service, Privacy, and Refund Policy</h1>
                        <p className="max-w-3xl text-sm text-white/60 md:text-base">
                            Effective date: March 1, 2026. These terms form a legally binding agreement between you and Exigo when you access or use our services.
                        </p>
                    </div>
                    <nav className="grid gap-2 pt-1 sm:grid-cols-3">
                        {SECTIONS.map((section) => (
                            <a
                                key={section.id}
                                href={`#${section.id}`}
                                className="group relative rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/70 transition-colors hover:text-white spring-interact"
                            >
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                                    style={{ background: "radial-gradient(220px circle at 50% 0%, rgba(255,255,255,0.12), transparent 55%)" }}
                                />
                                <span className="relative">{section.title}</span>
                            </a>
                        ))}
                    </nav>
                </header>

                <section id="terms-of-service" className="space-y-4 rounded-2xl border border-white/10 bg-neutral-950/55 p-6 shadow-[0_2px_14px_-6px_rgba(0,0,0,0.9)] backdrop-blur-sm md:p-8">
                    <h2 className="text-2xl font-semibold tracking-tight">1. Terms of Service</h2>
                    <div className="space-y-4 text-sm leading-relaxed text-white/60 md:text-[15px]">
                        <p>
                            By accessing Exigo, you represent that you have legal capacity to enter into this agreement and will comply with applicable laws.
                            If you use Exigo for an organization, you confirm you are authorized to bind that organization.
                        </p>
                        <p>
                            You are responsible for safeguarding account credentials and all activities under your account. You may not reverse engineer,
                            abuse, or interfere with Exigo, or attempt unauthorized access to any system or data.
                        </p>
                        <p>
                            We may update, suspend, or discontinue any feature at any time for security, legal, or operational reasons. We may suspend
                            or terminate accounts for fraud, abuse, policy violations, or non-payment.
                        </p>
                        <p>
                            Exigo is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the maximum extent permitted by law, Exigo disclaims
                            implied warranties, including merchantability, fitness for a particular purpose, and non-infringement.
                        </p>
                        <p>
                            To the maximum extent permitted by law, Exigo and its affiliates are not liable for indirect, incidental, special, consequential,
                            or punitive damages, or any loss of profits, data, or goodwill arising from use of the service.
                        </p>
                    </div>
                </section>

                <section id="privacy-policy" className="space-y-4 rounded-2xl border border-white/10 bg-neutral-950/55 p-6 shadow-[0_2px_14px_-6px_rgba(0,0,0,0.9)] backdrop-blur-sm md:p-8">
                    <h2 className="text-2xl font-semibold tracking-tight">2. Privacy Policy</h2>
                    <div className="space-y-4 text-sm leading-relaxed text-white/60 md:text-[15px]">
                        <p>
                            We collect account data (such as email and authentication identifiers), usage data (such as interactions, diagnostics, and logs),
                            and billing metadata needed to deliver and secure the service.
                        </p>
                        <p>We use data to:</p>
                        <ul className="list-disc space-y-2 pl-6">
                            <li>Provide and improve Exigo features and reliability.</li>
                            <li>Authenticate users, prevent abuse, and maintain security.</li>
                            <li>Process subscriptions, invoices, and related support requests.</li>
                            <li>Comply with legal obligations and enforce these terms.</li>
                        </ul>
                        <p>
                            We share data only with trusted processors required to operate Exigo (for example, hosting, authentication, analytics, and billing providers),
                            under contractual safeguards. We do not sell personal information.
                        </p>
                        <p>
                            You may request access, correction, or deletion of personal data, subject to legal and security retention requirements. Contact us using
                            the details below for privacy requests.
                        </p>
                    </div>
                </section>

                <section id="refund-policy" className="space-y-4 rounded-2xl border border-white/10 bg-neutral-950/55 p-6 shadow-[0_2px_14px_-6px_rgba(0,0,0,0.9)] backdrop-blur-sm md:p-8">
                    <h2 className="text-2xl font-semibold tracking-tight">3. Refund Policy</h2>
                    <div className="space-y-4 text-sm leading-relaxed text-white/60 md:text-[15px]">
                        <p>
                            Subscription charges are billed in advance and are generally non-refundable once a billing cycle starts. You can cancel at any time,
                            and cancellation takes effect at the end of your current paid period unless required otherwise by law.
                        </p>
                        <p>
                            If you believe you were charged in error, contact support within 7 days of the transaction with your account email and payment details.
                            We review refund requests in good faith and may issue full or partial refunds at our sole discretion or where legally required.
                        </p>
                        <p>
                            Chargebacks or payment disputes may result in temporary account suspension while the matter is investigated.
                        </p>
                    </div>
                </section>

                <footer className="rounded-2xl border border-white/10 bg-neutral-950/55 p-6 text-sm text-white/60 shadow-[0_2px_14px_-6px_rgba(0,0,0,0.9)] backdrop-blur-sm md:p-8">
                    <p>
                        Questions or legal requests:{" "}
                        <a href="mailto:contact@chmyl.com" className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/40">
                            contact@chmyl.com
                        </a>
                    </p>
                </footer>
            </div>
        </div>
    );
}
