require("dotenv").config();
const mongoose = require("mongoose");

function connectDB() {
  // Database Connection
  mongoose
    .connect(process.env.DB_CONNECTION, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log("Database Connected!");
    })
    .catch((err) => {
      console.log("Database Connection Failed!");
    });
}

module.exports = connectDB;
