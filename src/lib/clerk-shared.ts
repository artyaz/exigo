import { dark } from "@clerk/themes";

export const CLERK_APPEARANCE = {
    baseTheme: dark,
    variables: {
        colorPrimary: '#10b981', // emerald-500
        colorBackground: '#0a0a0a', // neutral-950
        colorInputBackground: '#171717', // neutral-900
        colorInputText: '#fafafa', // neutral-50
        colorText: '#fafafa',
        colorTextSecondary: '#a3a3a3', // neutral-400
        borderRadius: '1.5rem',
    },
    elements: {
        card: "border border-neutral-800 shadow-2xl backdrop-blur-xl bg-neutral-900/80",
        formButtonPrimary: "font-semibold shadow-emerald-500/20 shadow-lg transition-transform hover:scale-[1.02]",
        socialButtonsBlockButton: "transition-transform hover:scale-[1.02] shadow-sm border-neutral-800 bg-neutral-950 hover:bg-neutral-800",
        footerActionLink: "text-emerald-500 hover:text-emerald-400",
    }
};

export const AUTH_WRAPPER_CLASSNAME = "flex justify-center w-full";

export const USER_BUTTON_APPEARANCE = {
    baseTheme: dark,
    elements: {
        userButtonAvatarBox: "w-10 h-10 border-2 border-emerald-500/50"
    }
};
