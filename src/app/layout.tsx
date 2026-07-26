import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

export const metadata: Metadata = {
  title: "Exigo",
  description: "AI-powered study spaces for precise, focused learning.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

import ConvexClientProvider from "./ConvexClientProvider";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en" className={`${geist.variable} ${geistMono.variable} dark antialiased tracking-tight`}>
        <body className="bg-black text-white min-h-screen">
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
