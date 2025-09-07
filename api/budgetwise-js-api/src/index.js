import express from 'express';
import 'dotenv/config';
import sequelize from './db.js';
import { logRequest, handleError } from './utils/index.js';
import categoriesRouter from './routes/categories.js';
import transactionsRouter from './routes/transactions.js';
import usersRouter from './routes/users.js';
import analyticsRouter from './routes/analytics.js';
import './models/associations.js';
import { optionalAuth } from "./middleware/auth.js";
import recurringRouter from "./routes/recurring.js";
import authRouter from "./routes/auth.js";
import exportRouter from "./routes/export.js";
import insightsRouter from "./routes/insights.js";
import aiRouter from "./routes/ai.js";
import cors from "cors";
import { startRecurringJob } from "./jobs/recurringJob.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/users', usersRouter);
app.use(optionalAuth);
app.use(logRequest);
app.use(cors());
app.use("/api/Auth", authRouter);
app.use("/api/Recurring", recurringRouter);
app.use("/api/Export", exportRouter);
app.use("/api/Insights", insightsRouter);
app.use("/api/AI", aiRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/analytics', analyticsRouter);

app.use(handleError);

async function start() {
  try {
    await sequelize.authenticate();

    // שליטה דרך ENV: DB_SYNC=force | alter | none
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

    app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
    startRecurringJob();
  } catch (err) {
    console.error('DB init failed:', err);
    process.exit(1);
  }
}


start();
