// src/models/associations.js
import User from "./User.js";
import Category from "./Category.js";
import Transaction from "./Transaction.js";
import RecurringTransaction from "./RecurringTransaction.js";

// 👇 כאן עושים את כל ה־associations

// User → Category
User.hasMany(Category, { foreignKey: "userId", onDelete: "CASCADE" });
Category.belongsTo(User, { foreignKey: "userId" });

// User → Transaction
User.hasMany(Transaction, { foreignKey: "userId", onDelete: "CASCADE" });
Transaction.belongsTo(User, { foreignKey: "userId" });

// Category → Transaction
Category.hasMany(Transaction, { foreignKey: "categoryId", onDelete: "CASCADE" });
Transaction.belongsTo(Category, { foreignKey: "categoryId" });

// User → RecurringTransaction
User.hasMany(RecurringTransaction, { foreignKey: "userId", onDelete: "CASCADE" });
RecurringTransaction.belongsTo(User, { foreignKey: "userId" });

// Category → RecurringTransaction
Category.hasMany(RecurringTransaction, { foreignKey: "categoryId", onDelete: "CASCADE" });
RecurringTransaction.belongsTo(Category, { foreignKey: "categoryId" });

// export כל המודלים
export { User, Category, Transaction, RecurringTransaction };
