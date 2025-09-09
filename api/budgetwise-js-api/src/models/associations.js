// Sets up all Sequelize model relationships

import User from "./User.js";
import Category from "./Category.js";
import Transaction from "./Transaction.js";
import RecurringTransaction from "./RecurringTransaction.js";

// User has many categories; category belongs to user
User.hasMany(Category, { foreignKey: "userId", onDelete: "CASCADE" });
Category.belongsTo(User, { foreignKey: "userId" });

// User has many transactions; transaction belongs to user
User.hasMany(Transaction, { foreignKey: "userId", onDelete: "CASCADE" });
Transaction.belongsTo(User, { foreignKey: "userId" });

// Category has many transactions; transaction belongs to category
Category.hasMany(Transaction, { foreignKey: "categoryId", onDelete: "CASCADE" });
Transaction.belongsTo(Category, { foreignKey: "categoryId" });

// User has many recurring transactions; recurring transaction belongs to user
User.hasMany(RecurringTransaction, { foreignKey: "userId", onDelete: "CASCADE" });
RecurringTransaction.belongsTo(User, { foreignKey: "userId" });

// Category has many recurring transactions; recurring transaction belongs to category
Category.hasMany(RecurringTransaction, { foreignKey: "categoryId", onDelete: "CASCADE" });
RecurringTransaction.belongsTo(Category, { foreignKey: "categoryId" });

// Export all models for use elsewhere
export { User, Category, Transaction, RecurringTransaction };