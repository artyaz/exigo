import { SignIn } from "@clerk/nextjs";
import { CLERK_APPEARANCE, AUTH_WRAPPER_CLASSNAME } from "~/lib/clerk-shared";

export default function SignInPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-6 relative overflow-hidden">

            {/* Playful Ambient Background Effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                <div className="text-center mb-8 space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                        Welcome back to Exigo
                    </h1>
                    <p className="text-neutral-400">Sign in to manage spaces and knowledge.</p>
                </div>

                <div className={AUTH_WRAPPER_CLASSNAME}>
                    <SignIn
                        routing="hash"
                        appearance={CLERK_APPEARANCE}
                    />
                </div>
            </div>
        </div>
    );
}
