import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

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
        <div className="min-h-screen flex items-center justify-center bg-black p-6">
            <div className="w-full max-w-md">
                <div className="glass-card p-8 rounded-2xl">
                    <div className="text-center mb-8 space-y-2">
                        <h1 className="text-2xl font-medium tracking-tight text-primary">{title}</h1>
                        <p className="text-secondary text-sm">{subtitle}</p>
                    </div>
                    {children}
                    <div id="clerk-captcha" className="mt-2" />
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
            className="w-full flex items-center justify-center gap-3 bg-neutral-900 border border-white/10 text-white px-4 py-3 rounded-xl font-medium hover:bg-neutral-800 spring-interact text-sm"
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
                <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
                <span className="bg-neutral-950 px-4 text-secondary uppercase tracking-widest">{text}</span>
            </div>
        </div>
    );
}

/**
 * Unified error alert display for authentication forms.
 *
 * @param props Contains the error message to display
 * @returns JSX Element alert
 */
export function AuthErrorAlert({ error }: { error: string }) {
    if (!error) return null;
    return (
        <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-red-500 text-sm flex items-center justify-center">
            {error}
        </div>
    );
}

/**
 * Standardized input field with embedded icon for authentication forms.
 *
 * @param props Standard input properties including icon and optional extra classes
 * @returns Stylized JSX Input Element
 */
export function AuthInput({
    type,
    placeholder,
    value,
    onChange,
    icon: Icon,
    className = "",
    maxLength,
    inputMode,
    id,
    "aria-label": ariaLabel,
}: {
    type: string;
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    icon: React.ElementType;
    className?: string;
    maxLength?: number;
    inputMode?: "text" | "numeric" | "tel" | "search" | "email" | "url" | "none" | "decimal";
    id?: string;
    "aria-label"?: string;
}) {
    return (
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-white transition-colors">
                <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <input
                id={id}
                type={type}
                placeholder={placeholder}
                aria-label={ariaLabel ?? placeholder}
                value={value}
                onChange={onChange}
                required
                maxLength={maxLength}
                inputMode={inputMode}
                className={`w-full bg-neutral-950 border border-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 focus-ring spring-interact placeholder:text-neutral-600 text-sm ${className}`}
            />
        </div>
    );
}

/**
 * Primary submission button for auth forms with loading state.
 *
 * @param props Component properties including loading flag and dynamic children
 * @returns Enhanced animated submit button 
 */
export function AuthSubmitButton({ isLoading, children }: { isLoading: boolean, children: ReactNode }) {
    return (
        <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-white text-black px-4 py-2.5 rounded-xl font-medium spring-interact disabled:opacity-50 disabled:pointer-events-none text-sm hover:opacity-90 transition-opacity"
        >
            {isLoading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span className="sr-only">{children}</span>
                </>
            ) : children}
        </button>
    );
}
