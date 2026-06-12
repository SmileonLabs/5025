import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import { getStripeSync } from "./stripeClient";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Stripe initialization.");
  }

  // Creates/updates the Stripe sync tables (idempotent, safe on every boot).
  await runMigrations({ databaseUrl });

  const stripeSync = await getStripeSync();

  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (domain) {
    const result = await stripeSync.findOrCreateManagedWebhook(
      `https://${domain}/api/stripe/webhook`,
    );
    logger.info(
      { url: result?.url ?? "configured" },
      "Stripe webhook configured",
    );
  } else {
    logger.warn("REPLIT_DOMAINS not set; skipping managed webhook setup");
  }

  // Fire-and-forget so a slow backfill never blocks server startup.
  stripeSync
    .syncBackfill()
    .then(() => logger.info("Stripe data synced"))
    .catch((err) => logger.error({ err }, "Stripe syncBackfill failed"));
}

async function main(): Promise<void> {
  if (process.env["ENABLE_STRIPE_SYNC"] === "true") {
    try {
      await initStripe();
    } catch (err) {
      logger.error(
        { err },
        "Stripe initialization failed; continuing without Stripe sync",
      );
    }
  } else {
    logger.info("Stripe sync disabled; using Toss Payments top-up flow");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void main();
