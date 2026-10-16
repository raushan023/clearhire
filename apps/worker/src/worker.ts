import "dotenv/config";

import { Queue, Worker } from "bullmq";

import { redisConnection } from "./config/redis.js";
import { pool } from "./config/database.js";
import {
    closeExpiredApplications,
} from "./jobs/close-expired-applications.job.js";

import {
    markMissedDecisionDeadlines,
} from "./jobs/mark-missed-decision-deadlines.job.js";

import {
    createFeedbackReminders,
} from "./jobs/create-feedback-reminders.job.js";

import { createFeedbackEscalations } from "./jobs/create-feedback-escalations.job.js";

const QUEUE_NAME = "clearhire-job-lifecycle";

const platformTimezone =
    process.env.PLATFORM_TIMEZONE ?? "Asia/Kolkata";

const queue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
});

async function setupSchedulers() {
    await queue.upsertJobScheduler(
        "close-expired-applications",
        {
            pattern: "0 5 0 * * *",
            tz: platformTimezone,
        },
        {
            name: "close-expired-applications",
            data: {},
        }
    );

    console.log(
        `Application deadline scheduler configured for 00:05 (${platformTimezone})`
    );

    await queue.upsertJobScheduler(
        "mark-missed-decision-deadlines",
        {
            pattern: "0 10 0 * * *",
            tz: platformTimezone,
        },
        {
            name: "mark-missed-decision-deadlines",
            data: {},
        }
    );

    console.log(
        `Missed decision deadline scheduler configured for 00:10 (${platformTimezone})`
    );

    await queue.upsertJobScheduler(
        "create-feedback-reminders",
        {
            pattern: "0 15 0 * * *",
            tz: platformTimezone,
        },
        {
            name: "create-feedback-reminders",
            data: {},
        }
    );

    await queue.upsertJobScheduler(
        "create-feedback-escalations",
        {
            pattern: "0 20 0 * * *",
            tz: platformTimezone,
        },
        {
            name: "create-feedback-escalations",
            data: {},
        }
    );
}

const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
        switch (job.name) {
            case "close-expired-applications": {
                const result =
                    await closeExpiredApplications();

                console.log(
                    `Automatically closed ${result.closedCount} job(s)`
                );

                return result;
            }

            case "mark-missed-decision-deadlines": {
                const result =
                    await markMissedDecisionDeadlines();

                console.log(
                    `Marked ${result.missedCount} job(s) as having missed decision deadlines`
                );

                return result;
            }

            case "create-feedback-reminders": {
                const result =
                    await createFeedbackReminders();

                console.log(
                    `Created ${result.createdCount} feedback reminder(s)`
                );

                return result;
            }

            case "create-feedback-escalations": {
                const result =
                    await createFeedbackEscalations();

                console.log(
                    `Created feedback escalations(s)`
                );

                return result;
            }

            default:
                throw new Error(
                    `Unknown job: ${job.name}`
                );
        }
    },
    {
        connection: redisConnection,
    }
);

worker.on("completed", (job) => {
    console.log(
        `Job ${job.name} completed successfully`
    );
});

worker.on("failed", (job, error) => {
    console.error(
        `Job ${job?.name ?? "unknown"} failed:`,
        error
    );
});

async function shutdown() {
    console.log("Shutting down worker...");

    await worker.close();
    await queue.close();

    await redisConnection.quit();
    await pool.end();

    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

setupSchedulers().catch((error) => {
    console.error(
        "Failed to configure job scheduler:",
        error
    );

    process.exit(1);
});

console.log("ClearHire worker started");