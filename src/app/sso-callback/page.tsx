"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export default function SSOCallback() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center gap-6">
                <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
                <p className="text-neutral-400 font-medium animate-pulse">Completing authentication...</p>

                <AuthenticateWithRedirectCallback
                    signInUrl="/sign-in"
                    signUpUrl="/sign-up"
                    signInForceRedirectUrl="/spaces"
                    signInFallbackRedirectUrl="/spaces"
                    signUpForceRedirectUrl="/spaces"
                    signUpFallbackRedirectUrl="/spaces"
                    continueSignUpUrl="/sign-up"
                    verifyEmailAddressUrl="/sign-up"
                    verifyPhoneNumberUrl="/sign-up"
                    firstFactorUrl="/sign-in"
                    secondFactorUrl="/sign-in"
                    resetPasswordUrl="/sign-in"
                    redirectUrl="/spaces"
                />
            </div>
        </div>
    );
}
