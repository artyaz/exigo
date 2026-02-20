import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

import { LatestPost } from "~/app/_components/post";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });

  void api.post.getLatest.prefetch();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">

        {/* Auth Header */}
        <div className="absolute top-6 right-8 flex items-center gap-4">
          <SignedOut>
            <div className="bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-xl font-medium">
              <SignInButton forceRedirectUrl="/spaces" />
            </div>
          </SignedOut>
          <SignedIn>
            <div className="bg-neutral-900/50 backdrop-blur border border-neutral-800 p-2 rounded-full shadow-xl">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: "w-10 h-10 border-2 border-emerald-500/50"
                  }
                }}
              />
            </div>
          </SignedIn>
        </div>

        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Create <span className="text-[hsl(280,100%,70%)]">T3</span> App
          </h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20"
              href="https://create.t3.gg/en/usage/first-steps"
              target="_blank"
            >
              <h3 className="text-2xl font-bold">First Steps →</h3>
              <div className="text-lg">
                Just the basics - Everything you need to know to set up your
                database and authentication.
              </div>
            </Link>
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20"
              href="https://create.t3.gg/en/introduction"
              target="_blank"
            >
              <h3 className="text-2xl font-bold">Documentation →</h3>
              <div className="text-lg">
                Learn more about Create T3 App, the libraries it uses, and how
                to deploy it.
              </div>
            </Link>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl text-white">
              {hello ? hello.greeting : "Loading tRPC query..."}
            </p>
          </div>

          <div className="mt-8 border-t border-white/20 pt-8 w-full max-w-xl flex justify-center">
            <Link href="/spaces" className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-neutral-950 font-bold px-8 py-4 rounded-2xl text-xl hover:scale-105 transition-transform">
              Open Knowledge App ✨
            </Link>
          </div>

          <LatestPost />
        </div>
      </main>
    </HydrateClient>
  );
}
