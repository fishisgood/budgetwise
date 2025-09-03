# BudgetWise

**BudgetWise** is a full-stack budget management app.  
Track your income and expenses, set monthly budgets, and view analytics with clean dashboards.

## Features
- User authentication (JWT)
- Manage categories (Income / Expense)
- Record transactions with notes
- Define monthly budgets per category
- Dashboard with monthly summaries & category breakdowns
- Built with **ASP.NET Core 8 + PostgreSQL + React (Vite, TypeScript, Tailwind)**

## Tech Stack
- **Backend**: ASP.NET Core 8, Entity Framework Core, JWT Authentication
- **Database**: PostgreSQL (Docker)
- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Infra**: Docker Compose, GitHub Actions (CI/CD)

## Run locally
```bash
# Start DB
cd infra
docker compose up -d

# Run API
cd api/BudgetWise.Api
dotnet ef database update
dotnet run

# Run Web
cd web/budget-web
npm install
npm run dev
