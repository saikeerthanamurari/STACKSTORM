
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./db");
const authRoutes = require("./routes/auth");
const examRoutes = require("./routes/exams");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Stackstorm Online Examination System API!",
    status: "Backend is running successfully"
  });
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Examination routes
app.use("/api/exams", examRoutes);

// Start server
const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Stackstorm backend running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
  }
};

startServer();
