
import type { ReactNode } from "react";

/**
 * Extracts and formats error messages consistently from caught API Exceptions.
 *
 * @param err The unknown error object caught in a try/catch block
 * @returns A formatted string message or undefined if parsing falls back
 */
export function formatErrorMessage(err: unknown): string | undefined {
    if (typeof err === "object" && err !== null) {
        const e = err as { errors?: { message?: string }[] };
        if (e.errors?.[0]?.message) return e.errors[0].message;
    }
    return err instanceof Error ? err.message : undefined;
}

/**
 * Shared layout component wrapper for Auth pages featuring dynamic ambient backgrounds.
 *
 * @param props Contains child elements, layout title, and generic subtitle
 * @returns JSX Element container with styles
 */
export function AuthLayout({ children, title, subtitle }: { children: ReactNode, title: ReactNode, subtitle: ReactNode }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-6 relative overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-neutral-900/60 backdrop-blur-2xl border border-neutral-800 p-8 rounded-3xl shadow-2xl">
                    <div className="text-center mb-8 space-y-2">
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">{title}</h1>
                        <p className="text-neutral-400 text-sm">{subtitle}</p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}

/**
 * Unified styled Google Single Sign-on OAuth button component.
 *
 * @param props Includes lambda onClick handler and optional label text
 * @returns JSX Button element styled as Google OAuth Action
 */
export function GoogleAuthButton({ onClick, text = "Continue with Google" }: { onClick: () => void, text?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center justify-center gap-3 bg-white text-neutral-950 px-4 py-3.5 rounded-2xl font-semibold hover:bg-neutral-200 transition-all active:scale-[0.98]"
        >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {text}
        </button>
    );
}

/**
 * Semantic divider for auth methods explicitly separating OAuth and email paths.
 *
 * @param props Contains string text injected over the visual horizontal break.
 * @returns Extracted visual divider markup.
 */
export function AuthDivider({ text }: { text: string }) {
    return (
        <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="bg-neutral-900 px-4 text-neutral-500">{text}</span>
            </div>
        </div>
    );
}
