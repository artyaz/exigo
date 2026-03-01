import Link from "next/link";

export function LegalCornerLink() {
    return (
        <div className="fixed bottom-4 left-4 z-40">
            <Link
                href="/terms"
                className="group relative inline-flex items-center rounded-md border border-white/10 bg-neutral-950/70 px-2.5 py-1 text-[11px] font-medium tracking-tight text-white/60 backdrop-blur-sm transition-colors hover:text-white spring-interact"
            >
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-md opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    style={{ background: "radial-gradient(260px circle at 10% 100%, rgba(255,255,255,0.12), transparent 55%)" }}
                />
                <span className="relative">Terms • Privacy • Refunds</span>
            </Link>
        </div>
    );
}

export function SignUpConsentNote() {
    return (
        <p className="text-center text-xs leading-relaxed text-white/60">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/40">
                Terms of Service
            </Link>
            ,{" "}
            <Link href="/terms#privacy-policy" className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/40">
                Privacy Policy
            </Link>
            , and{" "}
            <Link href="/terms#refund-policy" className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/40">
                Refund Policy
            </Link>
            .
        </p>
    );
}
