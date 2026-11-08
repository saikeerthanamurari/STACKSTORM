const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: (options) => options.length >= 2,
      message: "At least two options are required"
    }
  },
  answer: {
    type: String,
    required: true
  }
});

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    duration: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: ["Available", "Upcoming", "Closed"],
      default: "Upcoming"
    },
    questions: [questionSchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Exam", examSchema);
