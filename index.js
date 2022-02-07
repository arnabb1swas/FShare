require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");
const PORT = process.env.PORT || 5000;

//Public Folder
app.use(express.static(__dirname + "/public/"));

//Parser
app.use(express.json());

//Template Engine
app.set("views", path.join(__dirname, "/views"));
app.set("view engine", "ejs");

// Database Connection
const MDB = require("./config/db");
MDB();

//Cors
const corsOptions = {
  origin: process.env.ALLOWED_CLIENTS,
};
app.use(cors(corsOptions));

//Routes
app.use("/api/files", require("./routes/files"));
app.use("/files", require("./routes/show"));
app.use("/files/download", require("./routes/download"));

app.get("/", (req, res) => {
  return res.render("index", { msg: "Working" });
});

//PORT Assigning
app.listen(PORT, (req, res) => {
  console.log(`Server Running On ${PORT}`);
});
