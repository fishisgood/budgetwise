import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const RecurringTransaction = sequelize.define("RecurringTransaction", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  categoryId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL, allowNull: false },
  note: { type: DataTypes.STRING },
  cadence: { type: DataTypes.STRING, allowNull: false }, // e.g. 'monthly', 'weekly'
  interval: { type: DataTypes.INTEGER, defaultValue: 1 },
  dayOfMonth: { type: DataTypes.INTEGER },
  weekday: { type: DataTypes.INTEGER },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY },
  nextRunDate: { type: DataTypes.DATEONLY },
  isPaused: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
  tableName: "RecurringTransactions"
});

export default RecurringTransaction;
