const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const Student = require("../models/Student");
const PendingRegistration = require("../models/PendingRegistration");
const sendOtpEmail = require("../utils/sendOtpEmail");

const router = express.Router();

// STEP 1: SEND OTP FOR STUDENT REGISTRATION
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Please fill in all fields"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters"
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const existingStudent = await Student.findOne({
      email: cleanEmail
    });

    if (existingStudent) {
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    await PendingRegistration.deleteOne({ email: cleanEmail });

    await PendingRegistration.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      otpHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    try {
      await sendOtpEmail(cleanEmail, otp);
    } catch (emailError) {
      await PendingRegistration.deleteOne({ email: cleanEmail });
      throw emailError;
    }

    res.status(200).json({
      message: "OTP sent successfully. Please check your email."
    });

  } catch (error) {
    console.error("Registration error:", error.message);
    res.status(500).json({
      message: "Unable to send OTP. Please try again."
    });
  }
});

// STEP 2: VERIFY OTP AND CREATE STUDENT ACCOUNT
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required"
      });
    }

    if (!/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        message: "Please enter a valid 6-digit OTP"
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const pending = await PendingRegistration.findOne({
      email: cleanEmail
    });

    if (!pending) {
      return res.status(400).json({
        message: "No pending registration found. Please register again."
      });
    }

    if (pending.expiresAt.getTime() < Date.now()) {
      await PendingRegistration.deleteOne({ email: cleanEmail });
      return res.status(400).json({
        message: "OTP expired. Please register again."
      });
    }

    if (pending.attempts >= 5) {
      await PendingRegistration.deleteOne({ email: cleanEmail });
      return res.status(429).json({
        message: "Too many attempts. Please register again."
      });
    }

    pending.attempts += 1;
    await pending.save();

    const isValidOtp = await bcrypt.compare(
      String(otp),
      pending.otpHash
    );

    if (!isValidOtp) {
      return res.status(400).json({
        message: "Incorrect OTP. Please try again."
      });
    }

    const existingStudent = await Student.findOne({
      email: cleanEmail
    });

    if (existingStudent) {
      await PendingRegistration.deleteOne({ email: cleanEmail });
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    const student = await Student.create({
      name: pending.name,
      email: pending.email,
      password: pending.password,
      role: "student"
    });

    await PendingRegistration.deleteOne({ email: cleanEmail });

    res.status(201).json({
      message: "Email verified and student registered successfully",
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        role: student.role
      }
    });

  } catch (error) {
    console.error("OTP verification error:", error.message);
    res.status(500).json({
      message: "OTP verification failed"
    });
  }
});

// STUDENT / ADMIN LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const student = await Student.findOne({
      email: email.toLowerCase().trim()
    });

    if (!student) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      student.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      {
        id: student._id,
        role: student.role
      },
      process.env.JWT_SECRET || "development_secret_change_before_deployment",
      {
        expiresIn: "1d"
      }
    );

    res.json({
      message: "Login successful",
      token,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        role: student.role
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Login failed"
    });
  }
});

module.exports = router;