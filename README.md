# Exigo

**AI-powered study platform that actually knows what you don't know.**

<!-- TODO: Add hero screenshot -->
<!-- ![Exigo Hero](screenshots/hero.png) -->

Exigo is a smart learning tool that generates tests from your own study materials, evaluates your answers with AI, and builds a dynamic map of your knowledge gaps—so every session is focused on what matters most. Think of it as Anki meets an AI tutor that refuses to let you coast.

---

## Features

### Spaces

Organize your study life into Spaces—each one is a self-contained topic area (e.g., "Biology 101", "JavaScript Fundamentals"). Upload your knowledge pieces (notes, docs, whatever you've got), and Exigo turns them into structured, testable content.

<img width="932" height="775" alt="image" src="https://github.com/user-attachments/assets/98a86cac-d31e-4b5c-b93b-706d86bea096" />


### AI Test Generation

Generate multiple-choice or written-answer tests directly from your uploaded material. Exigo uses **Google Gemini** to craft questions that target the substance of your notes—not just surface-level keywords. Each question is streamed in real-time via Server-Sent Events, so you see progress as it happens.

<img width="1040" height="842" alt="image" src="https://github.com/user-attachments/assets/0c913844-35eb-4822-90fc-dc67bf27cdbd" />


### Smart Answer Validation

- **Multiple choice**: Instant, deterministic grading.
- **Written answers**: AI-powered evaluation with nuanced feedback. The AI compares your answer against the ideal response and tells you _why_ you were right or wrong—not just that you were.

<img width="625" height="352" alt="image" src="https://github.com/user-attachments/assets/95c6eccc-ac8e-47c7-95f6-8f32c1b15aac" />


### AI Tutor Chat

Stuck on a question? Open a conversation with the built-in AI tutor. It has full context of the question, your answer, and the source material. If a concept still feels confusing, hit the **"Feels Hard"** button—Exigo will log it as a knowledge gap and weigh it more heavily in future tests.

<img width="1912" height="987" alt="image" src="https://github.com/user-attachments/assets/cbd8fefb-de3d-4706-b4c7-8efad7585ec6" />


### Knowledge Nodes (Pro)

This is where Exigo gets interesting. Behind the scenes, it builds a semantic graph of your weak spots:

- **Active Struggles** — Concepts you got wrong on tests. Automatically tracked.
- **Feels Hard** — Topics you manually flagged during AI tutor conversations.
- **Advanced Improvements** — Harder edge-case concepts auto-generated when you score well (80%+).

Each node has a **resolution score** that ticks up as you prove mastery. Hit 90% and the node resolves—your knowledge gap is officially closed. Future tests dynamically pull from active nodes so you're always drilling the right stuff.

<img width="698" height="562" alt="image" src="https://github.com/user-attachments/assets/167a2c18-c5f7-4c4d-9491-d3d430a23e59" />

### Deep Dive Notes (Pro)

Go deeper on any test question with AI-generated study notes. Monthly limits scale with your plan, because even AI has bills to pay.

### Subscription & Billing

Plans are managed through Clerk's built-in billing—no Stripe integration headaches. Pick a tier, check out, and manage everything without leaving the app.

| | Free | Starter | Pro Scholar | Educator |
|---|---|---|---|---|
| Spaces | 3 | 3 | Unlimited | Unlimited |
| Knowledge Pieces / Space | 20 | 50 | 200 | Unlimited |
| AI Tests / Month | 10 | 10 | 100 | 300 |
| Knowledge Nodes | — | — | ✓ | ✓ |
| Deep Dive Notes / Month | — | — | 50 | 150 |
| AI Written Feedback | — | — | — | ✓ |

<img width="1248" height="845" alt="image" src="https://github.com/user-attachments/assets/b6ea5efa-5a3c-4d23-b1d1-da2fc19a8608" />


---

## Tech Stack

This is a [T3 Stack](https://create.t3.gg/) project, extended with real-time backend capabilities and AI integrations.

| Layer | Tech |
|---|---|
| **Framework** | [Next.js 15](https://nextjs.org) (App Router, Turbopack) |
| **Language** | TypeScript |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com) |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) |
| **Auth** | [Clerk](https://clerk.com) (with subscription billing) |
| **Real-time DB** | [Convex](https://convex.dev) |
| **SQL DB** | SQLite via [Prisma](https://prisma.io) |
| **API Layer** | [tRPC](https://trpc.io) + Next.js Route Handlers |
| **AI** | [Google Gemini](https://ai.google.dev/) (with model fallback) |
| **Testing** | [Vitest](https://vitest.dev) + V8 coverage |
| **CI/CD** | GitHub Actions + SonarCloud |
| **Hosting** | [Vercel](https://vercel.com) |

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **npm** 11+
- A [Convex](https://convex.dev) account (free tier works)
- A [Clerk](https://clerk.com) account (runs in keyless dev mode locally)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

### Installation

```bash
# Clone the repo
git clone https://github.com/artyaz/exigo.git
cd exigo

# Install dependencies
npm install

# Copy the example env file and fill in your keys
cp .env.example .env
```

### Environment Variables

Fill in your `.env` file:

```env
# Prisma (SQLite — works out of the box)
DATABASE_URL="file:./dev.db"

# Convex (auto-generated when you run `npx convex dev`)
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# AI
GOOGLE_GEMINI_API_KEY=your_key_here

# Clerk (optional in dev — keyless mode works without these)
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
# CLERK_SECRET_KEY=
```

### Running Locally

```bash
# Start the Convex dev server (in a separate terminal)
npx convex dev

# Start the Next.js dev server with Turbopack
npm run dev
```

The app will be running at [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
├── convex/              # Convex backend — schema, mutations, queries, actions
│   ├── schema.ts        # Database schema (spaces, tests, questions, knowledge nodes, etc.)
│   ├── tests.ts         # Test creation and management logic
│   ├── questions.ts     # Question CRUD and feedback
│   ├── knowledgeNodes.ts    # Knowledge gap tracking + AI improvement generation
│   ├── knowledgePieces.ts   # Study material management
│   ├── deepDives.ts     # Deep dive note generation and limits
│   ├── subscriptionService.ts  # Plan tier resolution and limit enforcement
│   └── planLimits.ts    # Plan detection from Clerk identity
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── spaces/      # Space listing + individual space view
│   │   ├── tests/       # Test listing + test-taking interface
│   │   ├── pricing/     # Dynamic pricing page (pulls from Clerk)
│   │   ├── knowledge-nodes/  # Knowledge Nodes explainer page
│   │   └── api/         # Route handlers (test generation, validation, chat, etc.)
│   ├── lib/             # Shared utilities
│   ├── server/          # Server-side tRPC setup
│   ├── trpc/            # tRPC client config
│   └── styles/          # Global CSS
├── shared/              # Shared config between frontend + Convex backend
│   └── planConfig.ts    # Plan tiers, limits, and constants
├── prisma/              # Prisma schema + SQLite DB
└── .github/workflows/   # CI pipeline
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run check` | Lint + type check |
| `npm run test` | Run tests with Vitest |
| `npm run test:coverage` | Tests with V8 coverage report |
| `npm run test:watch` | Watch mode for tests |
| `npm run test:ui` | Vitest UI |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format:write` | Format with Prettier |
| `npm run db:studio` | Open Prisma Studio |

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs automatically on pushes to `main` and on PRs:

1. **Install dependencies** — `npm ci` with Prisma generation
2. **Code quality** — `next lint` + `tsc --noEmit`
3. **Tests** — Vitest with V8 coverage
4. **SonarCloud analysis** — Code quality and coverage reporting

### Setting Up SonarCloud

1. Go to **Settings → Secrets and variables → Actions** in your GitHub repo.
2. Add a secret named `SONAR_TOKEN` with your SonarCloud project token.

---

## Deployment

Exigo is built for [Vercel](https://vercel.com):

1. Link your GitHub repo to a Vercel project.
2. Copy all keys from `.env.example` into Vercel's **Environment Variables** settings.
3. Pushes to `main` trigger production deploys. PRs get preview URLs automatically.

> Make sure `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `GOOGLE_GEMINI_API_KEY`, and your Clerk keys are all set in Vercel.

---

## License

Copyright © 2026 Artem Chmylenko. All rights reserved. See [LICENSE](./LICENSE) for details.
