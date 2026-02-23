# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## CI/CD and Quality Gates

This project uses [GitHub Actions](https://github.com/features/actions) for continuous integration and [SonarQube/SonarCloud](https://sonarcloud.io/) for code quality analysis.

Our CI workflow (`.github/workflows/ci.yml`) automatically runs on pushes to `main` and on pull requests. It performs:
1. **Dependency Installation**
2. **Type Checking & Linting** (`npm run check`)
3. **SonarQube Code Analysis**

### Setting up SonarQube
In order for the SonarQube GitHub action to work, you must add a secret to your GitHub repository:
1. Go to your repository **Settings > Secrets and variables > Actions**.
2. Add a new repository secret named `SONAR_TOKEN`.
3. Set the value to the token provided by your SonarQube/SonarCloud project dashboard.
*(Note: Additionally, you may need a `sonar-project.properties` file in the root if you aren't configuring the project settings directly via the SonarCloud UI).*

---

## Deployment (Vercel)

This project is optimized and configured to be hosted natively on [Vercel](https://vercel.com). Deploying is seamless:

1. Create a Vercel project and link it to your GitHub repository.
2. Vercel will automatically configure the build commands for a Next.js application.
3. Every push to `main` will automatically trigger a **Production Deployment**.
4. Every Pull Request will automatically generate a unique **Preview Deployment** link so you can preview changes before merging them.

> **Environment Variables**: Make sure to copy all the required keys from `.env.example` into your Vercel Project's Settings -> Environment Variables. This includes your database connection URLs (`DATABASE_URL`), `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, and `GOOGLE_GEMINI_API_KEY`.

---

## License

This project is exclusively owned by the author. All rights reserved. No part of this software may be used, copied, or distributed without the express written permission of the author. See the [LICENSE](./LICENSE) file for more details.
