// Main entry point for the backend API

import express from 'express';
import 'dotenv/config'; // Loads environment variables from .env
import sequelize from './db.js'; // Sequelize DB connection
import { logRequest, handleError } from './utils/index.js'; // Middleware for logging and error handling
import categoriesRouter from './routes/categories.js';
import transactionsRouter from './routes/transactions.js';
import usersRouter from './routes/users.js';
import analyticsRouter from './routes/analytics.js';
import './models/associations.js'; // Sets up model relationships
import { optionalAuth } from "./middleware/auth.js"; // Middleware for optional authentication
import recurringRouter from "./routes/recurring.js";
import authRouter from "./routes/auth.js";
import exportRouter from "./routes/export.js";
import insightsRouter from "./routes/insights.js";
import aiRouter from "./routes/ai.js";
import cors from "cors"; // Enables CORS for cross-origin requests
import { startRecurringJob } from "./jobs/recurringJob.js"; // Starts scheduled recurring transaction job

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// User routes (no auth required)
app.use('/api/users', usersRouter);

// Optional authentication for all following routes
app.use(optionalAuth);

// Log every request
app.use(logRequest);

// Enable CORS for all routes
app.use(cors());

// API routes
app.use("/api/Auth", authRouter);
app.use("/api/Recurring", recurringRouter);
app.use("/api/Export", exportRouter);
app.use("/api/Insights", insightsRouter);
app.use("/api/AI", aiRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/analytics', analyticsRouter);

// Error handler middleware (last)
app.use(handleError);

// Start the server and sync the database
async function start() {
  try {
    await sequelize.authenticate(); // Test DB connection

    // DB sync mode: force (drop & recreate), alter (migrate), or none (safe)
    const mode = (process.env.DB_SYNC || 'none').toLowerCase();
    if (mode === 'force') {
      await sequelize.sync({ force: true });
      console.log('[db] synced with FORCE (dropped & recreated tables)');
    } else if (mode === 'alter') {
      await sequelize.sync({ alter: true });
      console.log('[db] synced with ALTER');
    } else {
      await sequelize.sync();
      console.log('[db] synced (safe)');
    }

    // Start HTTP server
    app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
    // Start recurring transaction job (runs daily)
    startRecurringJob();
  } catch (err) {
    console.error('DB init failed:', err);
    process.exit(1); // Exit if DB connection fails
  }
}

start(); // Run the startup function