# BudgetWise

**BudgetWise** is a full-stack budget management app.  
Track your income and expenses, set monthly budgets, import bank statements, and view analytics with clean dashboards.

## Features
- User authentication (JWT)
- Manage categories (Income / Expense)
- Record transactions with notes
- Import transactions from Excel/CSV bank statements
- Define monthly budgets per category
- Dashboard with monthly summaries & category breakdowns
- View recent transactions and delete them
- Recurring transactions support
- AI-powered parsing and insights (OpenAI integration)
- Export monthly transactions to Excel
- Built with **Node.js + PostgreSQL + React (Vite, TypeScript, Tailwind)**

## Tech Stack
- **Backend**: Node.js (Express), Sequelize ORM, JWT Authentication
- **Database**: PostgreSQL (Docker)
- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Infra**: Docker Compose, GitHub Actions (CI/CD)
- **AI**: OpenAI GPT (optional, for parsing and insights)

## Run locally

```bash
# Start DB
cd infra
docker compose up -d

# Run API
cd api/budgetwise-js-api
npm install
node src/index.js

# Run Web
cd budgetwise-web
npm install
npm run dev