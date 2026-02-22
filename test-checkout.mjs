import 'dotenv/config';

async function test() {
  const response = await fetch("https://api.clerk.com/v1/beta/billing/checkout", {
      method: "POST",
      headers: {
          "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json"
      },
      body: JSON.stringify({
          user_id: "user_2stP4l8pE27I2iP8hD4C13c0Gvw", // Providing a realistically formatted ID
          plan_id: "cplan_3A25WQbKwNgJax7d85NpINyZpms",
      })
  });
  console.log(response.status);
  console.log(await response.json());
}
test();
