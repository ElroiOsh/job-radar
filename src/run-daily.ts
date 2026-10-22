import "dotenv/config";
import { runScan } from "./scan.js";
import { sendEmail } from "./email.js";

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const { result, profile, payload } = await runScan({
    skipFetch: args.has("--skip-fetch"),
    demo: args.has("--demo"),
  });

  console.log(`Dashboard rebuilt (${payload.totalCount} jobs, ${payload.newCount} newly seen)`);

  // Email is opt-in now — the live dashboard is the daily workflow
  if (args.has("--email")) {
    await sendEmail(result, profile);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
