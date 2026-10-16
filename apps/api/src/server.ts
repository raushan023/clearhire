import "dotenv/config";

import express from "express";
import cors from "cors";

import { pool } from "./config/database.js";
import authRoutes from "./modules/auth/auth.routes.js";
import companyRoutes from "./modules/company/company.routes.js";
import jobRoutes from "./modules/job/job.routes.js";
import skillRoutes from "./modules/skill/skill.routes.js";
import benefitRoutes from "./modules/benefit/benefit.routes.js";
import applicationRoutes from "./modules/application/application.routes.js";
import employerJobRoutes from "./modules/job/employer-job.routes.js";
import notificationRoutes from "./modules/notification/notification.routes.js";

const app = express();

const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/benefits", benefitRoutes);
app.use("/api", applicationRoutes);
app.use("/api/employer", employerJobRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        service: "clearhire-api",
    });
});

app.get("/health/db", async (_req, res) => {
    try {
        const result = await pool.query(
            "SELECT NOW() AS database_time"
        );

        res.status(200).json({
            status: "ok",
            database: "connected",
            databaseTime: result.rows[0].database_time,
        });
    } catch (error) {
        console.error("Database health check failed:", error);

        res.status(500).json({
            status: "error",
            database: "disconnected",
        });
    }
});

app.listen(PORT, () => {
    console.log(`ClearHire API running on http://localhost:${PORT}`);
});