import { Sequelize } from 'sequelize';

const sequelize = new Sequelize(
  process.env.POSTGRES_DB || 'budget_db',
  process.env.POSTGRES_USER || 'ilay',
  process.env.POSTGRES_PASSWORD || '123',
  {
    host: 'localhost',
    dialect: 'postgres',
    port: 5432,
    logging: false
  }
);

export default sequelize;