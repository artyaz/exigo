import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

/**
 * Dedicated callback page invoked by Clerk after completing external OAuth.
 * Intercepts the hash payload and performs active session assignment behind
 * a customized processing UI.
 *
 * @returns RedirectCallback component injected in hidden wrapper
 */
export default function SSOCallback() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center gap-6">
                <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
                <p className="text-neutral-400 font-medium animate-pulse">Completing authentication...</p>
                <div className="hidden">
                    <AuthenticateWithRedirectCallback redirectUrl={process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ?? "/spaces"} />
                </div>
            </div>
        </div>
    );
}
