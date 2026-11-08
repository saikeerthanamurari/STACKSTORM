const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Result = require("../models/Result");

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
    return res.status(401).json({ message: "Login required" });
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

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin access required"
    });
  }
  next();
}

function validateExam(data) {
  const { title, code, subject, duration, status, questions } = data;

  if (!title || !code || !subject || !Number.isFinite(Number(duration))) {
    return "Title, code, subject and valid duration are required";
  }

  if (Number(duration) < 1) {
    return "Duration must be at least one minute";
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return "Add at least one question";
  }

  for (const question of questions) {
    if (
      !question.question ||
      !Array.isArray(question.options) ||
      question.options.length < 2 ||
      !question.answer ||
      !question.options.includes(question.answer)
    ) {
      return "Every question needs text, at least two options and a correct answer from those options";
    }
  }

  if (
    status &&
    !["Available", "Upcoming", "Closed"].includes(status)
  ) {
    return "Invalid exam status";
  }

  return null;
}

// ADMIN: View all examinations
router.get("/admin/exams", authenticate, requireAdmin, async (req, res) => {
  try {
    const exams = await Exam.find().sort({ createdAt: -1 });
    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch examinations" });
  }
});

// ADMIN: Create an examination
router.post("/admin/exams", authenticate, requireAdmin, async (req, res) => {
  try {
    const validationError = validateExam(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const exam = await Exam.create({
      ...req.body,
      duration: Number(req.body.duration),
      code: req.body.code.trim().toUpperCase()
    });

    res.status(201).json({
      message: "Examination created successfully",
      exam
    });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000
        ? "Examination code already exists"
        : "Unable to create examination"
    });
  }
});

// ADMIN: Update an examination
router.put("/admin/exams/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid examination ID" });
    }

    const validationError = validateExam(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        duration: Number(req.body.duration),
        code: req.body.code.trim().toUpperCase()
      },
      { new: true, runValidators: true }
    );

    if (!exam) {
      return res.status(404).json({ message: "Examination not found" });
    }

    res.json({
      message: "Examination updated successfully",
      exam
    });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000
        ? "Examination code already exists"
        : "Unable to update examination"
    });
  }
});

// ADMIN: Delete an examination
router.delete("/admin/exams/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid examination ID" });
    }

    const exam = await Exam.findByIdAndDelete(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: "Examination not found" });
    }

    res.json({ message: "Examination deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Unable to delete examination" });
  }
});

// STUDENT: View available examinations without correct answers
router.get("/available", authenticate, async (req, res) => {
  try {
    const exams = await Exam.find({
      status: "Available"
    }).select("-questions.answer");

    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch available examinations" });
  }
});

// Existing DBMS examination: Start
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

// Existing DBMS examination: Submit
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
    return res.status(400).json({ message: "Invalid answers" });
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


function requireStudent(req, res, next) {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Student access required" });
  }
  next();
}

const dynamicAttempts = new Map();

// STUDENT: Start any available examination
router.post("/dynamic/:examId/start", authenticate, requireStudent, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.examId)) {
      return res.status(400).json({ message: "Invalid examination ID" });
    }

    const exam = await Exam.findById(req.params.examId);

    if (!exam || exam.status !== "Available") {
      return res.status(404).json({ message: "Examination is not available" });
    }

    if (!exam.questions.length) {
      return res.status(400).json({ message: "This examination has no questions" });
    }

    const attemptId = new mongoose.Types.ObjectId().toString();
    const expiresAt = Date.now() + exam.duration * 60 * 1000;

    dynamicAttempts.set(attemptId, {
      userId: req.user.id,
      examId: exam._id,
      questions: exam.questions.map(q => ({
        id: q._id.toString(),
        answer: q.answer
      })),
      expiresAt,
      submitted: false
    });

    res.json({
      attemptId,
      examId: exam._id,
      title: exam.title,
      subject: exam.subject,
      duration: exam.duration,
      expiresAt,
      questions: exam.questions.map(q => ({
        id: q._id.toString(),
        question: q.question,
        options: q.options
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to start examination" });
  }
});

// STUDENT: Submit a dynamic examination
router.post("/dynamic/submit", authenticate, requireStudent, async (req, res) => {
  try {
    const { attemptId, answers } = req.body;
    const attempt = dynamicAttempts.get(attemptId);

    if (!attempt || attempt.userId !== req.user.id) {
      return res.status(400).json({ message: "Invalid examination attempt" });
    }

    if (attempt.submitted) {
      return res.status(400).json({ message: "Exam already submitted" });
    }

    if (Date.now() > attempt.expiresAt) {
      attempt.submitted = true;
      return res.status(410).json({ message: "Examination time has expired" });
    }

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return res.status(400).json({ message: "Invalid answers" });
    }

    let correctAnswers = 0;

    for (const question of attempt.questions) {
      if (answers[question.id] === question.answer) {
        correctAnswers++;
      }
    }

    const totalQuestions = attempt.questions.length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);

    const result = await Result.create({
      student: req.user.id,
      exam: attempt.examId,
      totalQuestions,
      correctAnswers,
      score: correctAnswers,
      percentage
    });

    attempt.submitted = true;

    res.json({
      message: "Examination submitted successfully",
      totalQuestions,
      correctAnswers,
      score: correctAnswers,
      percentage,
      resultId: result._id
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to submit examination" });
  }
});

// STUDENT: View personal examination results
router.get("/my-results", authenticate, requireStudent, async (req, res) => {
  try {
    const results = await Result.find({ student: req.user.id })
      .populate("exam", "title subject code duration")
      .sort({ submittedAt: -1 });

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch results" });
  }
});

module.exports = router;
