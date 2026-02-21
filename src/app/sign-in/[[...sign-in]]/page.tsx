"use client";

import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";

function formatErrorMessage(err: unknown): string | undefined {
    if (typeof err === "object" && err !== null) {
        const e = err as { errors?: { message?: string }[] };
        if (e.errors?.[0]?.message) return e.errors[0].message;
    }
    return err instanceof Error ? err.message : undefined;
}

export default function SignInPage() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        if (!isLoaded) return;
        try {
            await signIn.authenticateWithRedirect({
                strategy: "oauth_google",
                redirectUrl: "/sso-callback",
                redirectUrlComplete: "/spaces",
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
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-6 relative overflow-hidden">
            {/* Playful Ambient Background Effects */}
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-neutral-900/60 backdrop-blur-2xl border border-neutral-800 p-8 rounded-3xl shadow-2xl">
                    <div className="text-center mb-8 space-y-2">
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">
                            Welcome Back
                        </h1>
                        <p className="text-neutral-400 text-sm">Sign in to your account to continue</p>
                    </div>

                    <div className="space-y-6">
                        <button
                            onClick={handleGoogleSignIn}
                            className="w-full flex items-center justify-center gap-3 bg-white text-neutral-950 px-4 py-3.5 rounded-2xl font-semibold hover:bg-neutral-200 transition-all active:scale-[0.98]"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Continue with Google
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-neutral-800"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="bg-neutral-900 px-4 text-neutral-500">or continue with email</span>
                            </div>
                        </div>

                        <form onSubmit={handleEmailSignIn} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-neutral-600"
                                    />
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500">
                                        <Lock className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-neutral-600"
                                    />
                                </div>
                            </div>

                            <div id="clerk-captcha"></div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black px-4 py-3.5 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-emerald-500/20"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <div className="mt-8 text-center text-sm text-neutral-400">
                        Don&apos;t have an account?{" "}
                        <Link href="/sign-up" className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors">
                            Sign up
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
