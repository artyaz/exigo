import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import { VERSION as LOCAL_VERSION } from "./convex/health.ts";
import fs from "fs";
import path from "path";

// Simple manual env loader
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, "utf8");
    content.split("\n").forEach(line => {
        const [key, ...value] = line.split("=");
        if (key && value) {
            process.env[key.trim()] = value.join("=").trim().replace(/^["']|["']$/g, '');
        }
    });
}

async function verifySync() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
        console.error("❌ NEXT_PUBLIC_CONVEX_URL is not set in .env.local");
        process.exit(1);
    }

    const client = new ConvexHttpClient(url);
    
    try {
        console.log(`Checking sync status for ${url}...`);
        const status = await client.query(api.health.getStatus);
        
        if (status.version === LOCAL_VERSION) {
            console.log(`✅ SYNCED: Remote version matches local (${status.version})`);
        } else {
            console.error(`❌ OUT OF SYNC!`);
            console.error(`   Local Version:  ${LOCAL_VERSION}`);
            console.error(`   Remote Version: ${status.version}`);
            console.error(`\nFix: Ensure 'npx convex dev' is running and has finished syncing.`);
            process.exit(1);
        }
    } catch (err) {
        console.error("❌ FAILED to connect to Convex backend. Is the URL correct?");
        console.error(err);
        process.exit(1);
    }
}

verifySync();
