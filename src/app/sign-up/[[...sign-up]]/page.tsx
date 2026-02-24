"use client";

import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, ArrowRight, KeyRound } from "lucide-react";
import { AuthLayout, AuthDivider, GoogleAuthButton, AuthInput, AuthSubmitButton, AuthErrorAlert, formatErrorMessage } from "~/app/_components/auth-ui";

/**
 * Complete replacement for Clerk's standard SignUp UI.
 * Handles the two-state authentication flow involving password creation
 * and a 6-digit email verification token system.
 *
 * @returns Custom React Sign Up Component
 */
export default function SignUpPage() {
    const { isLoaded, signUp, setActive } = useSignUp();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [pendingVerification, setPendingVerification] = useState(false);

    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleSignUp = async () => {
        if (!isLoaded) return;
        try {
            await signUp.authenticateWithRedirect({
                strategy: "oauth_google",
                redirectUrl: "/sso-callback",
                redirectUrlComplete: "/spaces",
                continueSignUp: true,
            });
        } catch (err: unknown) {
            setError(formatErrorMessage(err) ?? "An error occurred during Google Sign Up");
        }
    };

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;

        setIsLoading(true);
        setError("");

        try {
            await signUp.create({
                emailAddress: email,
                password,
            });

            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
            setPendingVerification(true);
        } catch (err: unknown) {
            setError(formatErrorMessage(err) ?? "Invalid input");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;

        setIsLoading(true);
        setError("");

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({ code });

            if (completeSignUp.status === "complete") {
                await setActive({ session: completeSignUp.createdSessionId });
                router.push("/spaces");
            } else {
                setError("Verification incomplete. Please try again.");
            }
        } catch (err: unknown) {
            setError(formatErrorMessage(err) ?? "Invalid verification code");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout
            title={pendingVerification ? "Check your email" : "Create an Account"}
            subtitle={pendingVerification
                ? "We've sent a verification code to your email."
                : "Sign up to start learning with Exigo."}
        >
            {!pendingVerification ? (
                <div className="space-y-6">
                    <GoogleAuthButton onClick={handleGoogleSignUp} />
                    <AuthDivider text="or sign up with email" />

                    <form onSubmit={handleEmailSignUp} className="space-y-4">
                        <AuthErrorAlert error={error} />

                        <div className="space-y-4">
                            <AuthInput
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={Mail}
                            />
                            <AuthInput
                                type="password"
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                icon={Lock}
                            />
                        </div>
                        <AuthSubmitButton isLoading={isLoading}>
                            Sign Up
                            <ArrowRight className="h-5 w-5" />
                        </AuthSubmitButton>
                    </form>
                </div>
            ) : (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                    <AuthErrorAlert error={error} />

                    <AuthInput
                        type="text"
                        placeholder="Enter verification code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        icon={KeyRound}
                        className="tracking-widest"
                        maxLength={6}
                        inputMode="numeric"
                    />

                    <AuthSubmitButton isLoading={isLoading}>
                        Verify Email
                    </AuthSubmitButton>

                    <button
                        type="button"
                        onClick={() => {
                            setPendingVerification(false);
                            setCode("");
                            setError("");
                        }}
                        className="w-full text-neutral-400 text-sm hover:text-white transition-colors py-2"
                    >
                        Back to sign up
                    </button>
                </form>
            )}

            {!pendingVerification && (
                <div className="mt-8 text-center text-sm text-neutral-400">
                    Already have an account?{" "}
                    <Link href="/sign-in" className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors">
                        Sign in
                    </Link>
                </div>
            )}
        </AuthLayout>
    );
}
