import { ConvexHttpClient } from "convex/browser";
import { internal } from "./convex/_generated/api.js";
import fs from "fs";
import path from "path";

// Simple manual env loader
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, "utf8");
    content.split("
").forEach(line => {
        const [key, ...value] = line.split("=");
        if (key && value) {
            process.env[key.trim()] = value.join("=").trim().replace(/^["']|["']$/g, '');
        }
    });
}

async function testBackendLimits() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    // For internal mutations via HTTP, we need the deployment key
    const deployKey = process.env.CONVEX_DEPLOY_KEY;

    if (!url || !deployKey) {
        console.error("❌ Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_DEPLOY_KEY in .env.local");
        console.log("Tip: Run 'npx convex dev' once to ensure local environment is set up.");
        process.exit(1);
    }

    const client = new ConvexHttpClient(url);
    const testUserId = `test_bot_${Date.now()}`;

    console.log(`🚀 Starting backend integration test for user: ${testUserId}`);

    try {
        // 1. Create 3 spaces (allowed on free)
        console.log("   - Creating 3 allowed spaces...");
        for (let i = 1; i <= 3; i++) {
            await client.mutation(internal.testUtils.createSpaceWithMockIdentity, {
                name: `Space ${i}`,
                userId: testUserId,
                mockTier: "free"
            });
        }
        console.log("   ✅ Created 3 spaces successfully.");

        // 2. Try to create the 4th space (should be blocked)
        console.log("   - Attempting to create 4th space (should fail)...");
        try {
            await client.mutation(internal.testUtils.createSpaceWithMockIdentity, {
                name: "Exploit Space",
                userId: testUserId,
                mockTier: "free"
            });
            console.error("   ❌ EXPLOIT SUCCESSFUL! The backend allowed a 4th space on Free plan.");
            process.exit(1);
        } catch (err) {
            if (err.message.includes("Limit reached")) {
                console.log("   ✅ BLOCKED: Backend correctly rejected the 4th space.");
            } else {
                throw err;
            }
        }

        console.log("
✨ Integration Test Passed: Limits are strictly enforced in the cloud.");
    } catch (err) {
        console.error("   ❌ TEST FAILED with error:");
        console.error(err);
        process.exit(1);
    }
}

testBackendLimits();
