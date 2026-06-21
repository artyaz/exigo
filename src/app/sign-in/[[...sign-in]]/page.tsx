"use client";

import { useSignIn, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { AuthLayout, AuthDivider, GoogleAuthButton, AuthInput, AuthSubmitButton, AuthErrorAlert, formatErrorMessage } from "~/app/_components/auth-ui";
import { LegalCornerLink } from "~/app/_components/legal-ui";

/**
 * Complete replacement for Clerk's standard SignIn UI.
 * Connects directly to `@clerk/nextjs` headless hooks to perform
 * Email password checking or Google OAuth redirection.
 *
 * @returns Custom React Sign In Component
 */
export default function SignInPage() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const { isSignedIn } = useUser();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isSignedIn) {
            router.replace("/spaces");
        }
    }, [isSignedIn, router]);

    const handleGoogleSignIn = async () => {
        if (!isLoaded) return;
        try {
            await signIn.authenticateWithRedirect({
                strategy: "oauth_google",
                redirectUrl: "/sso-callback",
                redirectUrlComplete: "/spaces",
                continueSignIn: true,
            });
        } catch (err: unknown) {
            setError(formatErrorMessage(err) ?? "An error occurred during Google Sign In");
        }
    };

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;

        setIsLoading(true);
        setError("");

        try {
            const result = await signIn.create({
                identifier: email,
                password,
            });

            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                router.push("/spaces");
            } else {
                setError("Additional verification required. This MVP only supports standard sign in.");
            }
        } catch (err: unknown) {
            setError(formatErrorMessage(err) ?? "Invalid credentials");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <AuthLayout
                title="Welcome Back"
                subtitle="Sign in to your account to continue"
            >
                <div className="space-y-6">
                    <GoogleAuthButton onClick={handleGoogleSignIn} />
                    <AuthDivider text="or continue with email" />

                    <form onSubmit={handleEmailSignIn} className="space-y-4">
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
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                icon={Lock}
                            />
                        </div>
                        <AuthSubmitButton isLoading={isLoading}>
                            Sign In
                            <ArrowRight className="h-5 w-5" />
                        </AuthSubmitButton>
                    </form>
                </div>

                <div className="mt-8 text-center text-sm text-neutral-400">
                    Don&apos;t have an account?{" "}
                    <Link href="/sign-up" className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors">
                        Sign up
                    </Link>
                </div>
            </AuthLayout>
            <LegalCornerLink />
        </>
    );
}
