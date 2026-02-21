"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

export function LatestPost() {
  const [latestPost] = api.post.getLatest.useSuspenseQuery();

  const utils = api.useUtils();
  const [name, setName] = useState("");
  const createPost = api.post.create.useMutation({
    onSuccess: async () => {
      await utils.post.invalidate();
      setName("");
    },
  });

  return (
    <div className="w-full max-w-xs glass-card p-6 rounded-2xl m-4">
      <div className="mb-4">
        {latestPost ? (
          <p className="truncate text-primary text-sm">
            Most recent: <span className="text-secondary">{latestPost.name}</span>
          </p>
        ) : (
          <p className="text-secondary text-sm">You have no posts yet.</p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createPost.mutate({ name });
        }}
        className="flex flex-col gap-3"
      >
        <div className="relative group">
          <input
            type="text"
            placeholder="New post..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact placeholder:text-neutral-600 text-sm"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-600 text-xs font-mono">
            ↵
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-white text-black font-medium px-4 py-2.5 rounded-xl spring-interact disabled:opacity-50 text-sm hover:opacity-90"
          disabled={createPost.isPending}
        >
          {createPost.isPending ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
