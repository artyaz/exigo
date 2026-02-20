import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-6 relative overflow-hidden">

            {/* Playful Ambient Background Effects */}
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                <div className="text-center mb-8 space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                        Join Exigo
                    </h1>
                    <p className="text-neutral-400">Create an account to start testing your knowledge.</p>
                </div>

                <div className="flex justify-center [&_.cl-card]:bg-neutral-900/80 [&_.cl-card]:backdrop-blur-xl [&_.cl-card]:border [&_.cl-card]:border-neutral-800 [&_.cl-card]:shadow-2xl [&_.cl-headerTitle]:text-neutral-50 [&_.cl-headerSubtitle]:text-neutral-400 [&_.cl-socialButtonsBlockButton]:bg-neutral-950 [&_.cl-socialButtonsBlockButton]:border-neutral-800 [&_.cl-socialButtonsBlockButtonText]:text-neutral-50 [&_.cl-socialButtonsBlockButton]:hover:bg-neutral-800 [&_.cl-dividerLine]:bg-neutral-800 [&_.cl-dividerText]:text-neutral-500 [&_.cl-formFieldLabel]:text-neutral-300 [&_.cl-formFieldInput]:bg-neutral-950 [&_.cl-formFieldInput]:border-neutral-800 [&_.cl-formFieldInput]:text-neutral-50 [&_.cl-formButtonPrimary]:bg-emerald-500 [&_.cl-formButtonPrimary]:hover:bg-emerald-400 [&_.cl-formButtonPrimary]:text-neutral-950 [&_.cl-footerActionText]:text-neutral-400 [&_.cl-footerActionLink]:text-emerald-500 [&_.cl-footerActionLink]:hover:text-emerald-400 [&_.cl-identityPreviewText]:text-neutral-300 [&_.cl-identityPreviewEditButtonIcon]:text-emerald-500">
                    <SignUp
                        routing="hash"
                        appearance={{
                            elements: {
                                card: "rounded-3xl",
                                formButtonPrimary: "font-semibold shadow-emerald-500/20 shadow-lg transition-transform hover:scale-[1.02]",
                                socialButtonsBlockButton: "transition-transform hover:scale-[1.02] shadow-sm",
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
