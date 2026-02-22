import 'dotenv/config';

import 'dotenv/config';

if (!process.env.CLERK_SECRET_KEY) {
    console.error("Error: CLERK_SECRET_KEY is missing from environment variables.");
    process.exit(1);
}

try {
    const response = await fetch("https://api.clerk.com/v1/me/billing/checkouts", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            user_id: process.env.TEST_USER_ID || "user_placeholder",
            plan_id: process.env.TEST_PLAN_ID || "plan_placeholder",
        })
    });

    if (!response.ok) {
        let errBody = "Failed to parse error response";
        try { errBody = await response.text(); } catch (e) { }
        console.error(`HTTP error! status: ${response.status}, body: ${errBody}`);
        process.exit(1);
    }

    const data = await response.json();
    console.log(response.status);
    console.log(data);
} catch (error) {
    console.error("Network or parsing error:", error);
    process.exit(1);
}
