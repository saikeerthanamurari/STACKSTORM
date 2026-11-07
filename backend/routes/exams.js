
const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const questions = [
  {
    id: 1,
    question: "Which language is used to query relational databases?",
    options: ["HTML", "SQL", "CSS", "Python"],
    answer: "SQL"
  },
  {
    id: 2,
    question: "What does DBMS stand for?",
    options: [
      "Database Management System",
      "Data Backup Management Software",
      "Digital Base Management System",
      "Database Machine Software"
    ],
    answer: "Database Management System"
  },
  {
    id: 3,
    question: "Which key uniquely identifies a row?",
    options: ["Foreign Key", "Primary Key", "Candidate Key", "Composite Key"],
    answer: "Primary Key"
  },
  {
    id: 4,
    question: "Which SQL command retrieves data?",
    options: ["INSERT", "UPDATE", "SELECT", "DELETE"],
    answer: "SELECT"
  },
  {
    id: 5,
    question: "Which normal form removes partial dependencies?",
    options: ["1NF", "2NF", "3NF", "BCNF"],
    answer: "2NF"
  }
];

const attempts = new Map();

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Login required"
    });
  }

  try {
    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET ||
        "development_secret_change_before_deployment"
    );

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired login"
    });
  }
}

// Start DBMS examination
router.post("/dbms/start", authenticate, (req, res) => {
  const attemptId = `${req.user.id}-${Date.now()}`;

  const expiresAt = Date.now() + 10 * 60 * 1000;

  attempts.set(attemptId, {
    userId: req.user.id,
    expiresAt,
    submitted: false
  });

  res.json({
    attemptId,
    title: "Database Management Systems",
    duration: 10,
    expiresAt,
    questions: questions.map(({ answer, ...question }) => question)
  });
});

// Submit DBMS examination
router.post("/dbms/submit", authenticate, (req, res) => {
  const { attemptId, answers } = req.body;

  const attempt = attempts.get(attemptId);

  if (!attempt || attempt.userId !== req.user.id) {
    return res.status(400).json({
      message: "Invalid examination attempt"
    });
  }

  if (attempt.submitted) {
    return res.status(400).json({
      message: "Exam already submitted"
    });
  }

  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return res.status(400).json({
      message: "Invalid answers"
    });
  }

  let score = 0;

  questions.forEach((question) => {
    if (answers[question.id] === question.answer) {
      score++;
    }
  });

  attempt.submitted = true;

  res.json({
    message: "Examination submitted successfully",
    totalQuestions: questions.length,
    correctAnswers: score,
    score,
    percentage: Math.round((score / questions.length) * 100)
  });
});

module.exports = router;
