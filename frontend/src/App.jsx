
import { useState, useEffect, useRef } from "react";
import "./App.css";

const API_URL = "http://localhost:5001/api/auth";
const EXAM_API_URL = "http://localhost:5001/api/exams";

const exams = [
  {
    id: 1,
    name: "Database Management Systems",
    code: "DBMS-101",
    date: "Today",
    duration: "10 minutes",
    questions: 5,
    status: "Available",
    subject: "Database Management Systems",
    instructions: [
      "Read each question carefully before answering.",
      "The examination duration is 10 minutes.",
      "There are 5 questions in this examination.",
      "Submit your answers before the examination ends.",
      "Do not refresh or close the examination window during an attempt."
    ]
  },
  {
    id: 2,
    name: "Computer Networks",
    code: "CN-102",
    date: "Tomorrow",
    duration: "45 minutes",
    questions: 25,
    status: "Upcoming",
    subject: "Computer Networks",
    instructions: [
      "Read all questions carefully.",
      "The examination duration is 45 minutes.",
      "There are 25 questions in this examination.",
      "Submit your answers before the examination ends."
    ]
  },
  {
    id: 3,
    name: "Software Engineering",
    code: "SE-103",
    date: "November 10, 2026",
    duration: "60 minutes",
    questions: 30,
    status: "Upcoming",
    subject: "Software Engineering",
    instructions: [
      "Read all questions carefully.",
      "The examination duration is 60 minutes.",
      "There are 30 questions in this examination.",
      "Submit your answers before the examination ends."
    ]
  }
];

function App() {
  const [role, setRole] = useState("Student");
  const [loggedIn, setLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [activePage, setActivePage] = useState("Overview");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedExam, setSelectedExam] = useState(null);
  const [notice, setNotice] = useState("");

  // Examination states
  const [examData, setExamData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [examResult, setExamResult] = useState(null);
  const [examLoading, setExamLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);
  const answersRef = useRef(answers);
  const submitExamRef = useRef(null);

  answersRef.current = answers;

  // Login and registration
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isRegistering ? "/register" : "/login";

      const body = isRegistering
        ? { name, email, password }
        : { email, password };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      if (isRegistering) {
        setError("Registration successful! You can now sign in.");
        setIsRegistering(false);
        setRole("Student");
        setName("");
        setPassword("");
        return;
      }

      if (data.student.role !== role.toLowerCase()) {
        throw new Error(`This account is not registered as ${role}.`);
      }

      sessionStorage.setItem("stackstormToken", data.token);

      setCurrentUser(data.student);
      setLoggedIn(true);
      setActivePage("Overview");
      setPassword("");
      setSelectedExam(null);
      setExamData(null);
      setExamResult(null);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  // Logout
  function handleLogout() {
    sessionStorage.removeItem("stackstormToken");

    setLoggedIn(false);
    setCurrentUser(null);
    setEmail("");
    setPassword("");
    setError("");
    setIsRegistering(false);
    setSelectedExam(null);
    setExamData(null);
    setExamResult(null);
    setAnswers({});
    setActivePage("Overview");
    setNotice("");
  }

  // Open examination details
  function openExam(exam) {
    if (exam.status !== "Available") {
      setNotice("This examination is not available yet.");
      return;
    }

    setSelectedExam(exam);
    setActivePage("My Exams");
    setNotice("");
    setExamData(null);
    setExamResult(null);
  }

  // Start examination
  async function startExam() {
    setExamLoading(true);
    setNotice("");

    try {
      const token = sessionStorage.getItem("stackstormToken");

      const response = await fetch(`${EXAM_API_URL}/dbms/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to start examination.");
      }

      submittingRef.current = false;

      setExamData(data);
      setAnswers({});
      setCurrentQuestion(0);
      setExamResult(null);

      setTimeLeft(
        Math.max(
          0,
          Math.ceil((data.expiresAt - Date.now()) / 1000)
        )
      );
    } catch (err) {
      setNotice(err.message);
    } finally {
      setExamLoading(false);
    }
  }

  // Submit examination
  async function submitExam(isAuto = false) {
    if (!examData || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const token = sessionStorage.getItem("stackstormToken");

      const response = await fetch(`${EXAM_API_URL}/dbms/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          attemptId: examData.attemptId,
          answers: answersRef.current
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Examination submission failed.");
      }

      setExamResult(data);
      setExamData(null);
      setSelectedExam(null);
      setActivePage("My Results");

      setNotice(
        isAuto
          ? "Time expired. Your answers were submitted automatically."
          : "Your examination was submitted successfully."
      );
    } catch (err) {
      submittingRef.current = false;
      setNotice(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  submitExamRef.current = submitExam;

  // Countdown timer and automatic submission
  useEffect(() => {
    if (!examData || examResult) {
      return;
    }

    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((examData.expiresAt - Date.now()) / 1000)
      );

      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(timer);
        submitExamRef.current?.(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [examData, examResult]);

  // Navigation
  function goToPage(page) {
    if (examData) {
      setNotice("Please submit your active examination before navigating away.");
      return;
    }

    setActivePage(page);
    setSelectedExam(null);
    setNotice("");
  }

  // Login screen
  if (!loggedIn) {
    return (
      <main className="login-page">
        <section className="login-brand">
          <div className="brand-logo">S</div>
          <span className="brand-name">STACKSTORM</span>

          <div className="brand-content">
            <span className="eyebrow">
              SMART EXAMINATION PLATFORM
            </span>

            <h1>
              Examinations.
              <br />
              Made <span>Smarter.</span>
            </h1>

            <p>
              A modern, secure and reliable platform for online
              examinations. Learn, attempt and achieve more.
            </p>

            <div className="brand-stats">
              <div>
                <strong>Secure</strong>
                <small>Exam environment</small>
              </div>

              <div>
                <strong>Smart</strong>
                <small>Result management</small>
              </div>

              <div>
                <strong>Simple</strong>
                <small>Easy experience</small>
              </div>
            </div>
          </div>

          <p className="brand-footer">
            © 2026 Stackstorm. All rights reserved.
          </p>
        </section>

        <section className="login-form-section">
          <div className="login-card">
            <div className="mobile-brand">STACKSTORM</div>

            <span className="eyebrow">
              {isRegistering ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}
            </span>

            <h2>
              {isRegistering
                ? "Create a student account"
                : "Sign in to your account"}
            </h2>

            <p className="muted">
              {isRegistering
                ? "Enter your details to register."
                : "Enter your details to access your dashboard."}
            </p>

            {!isRegistering && (
              <div className="role-switch">
                {["Student", "Admin"].map((item) => (
                  <button
                    key={item}
                    className={role === item ? "role-active" : ""}
                    onClick={() => {
                      setRole(item);
                      setError("");
                    }}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {isRegistering && (
                <>
                  <label>Full name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </>
              )}

              <label>Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />

              {error && (
                <p
                  role="alert"
                  style={{
                    color: "#ff7777",
                    marginTop: "12px"
                  }}
                >
                  {error}
                </p>
              )}

              <div className="form-options">
                {!isRegistering && (
                  <>
                    <label className="remember">
                      <input type="checkbox" />
                      Remember me
                    </label>

                    <span>Secure login</span>
                  </>
                )}
              </div>

              <button
                className="primary-button"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : isRegistering
                    ? "Create account →"
                    : `Sign in as ${role} →`}
              </button>
            </form>

            <p className="login-note">
              {isRegistering
                ? "Already registered? "
                : "New student? "}

              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError("");
                  setPassword("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#a99aff",
                  cursor: "pointer",
                  font: "inherit"
                }}
              >
                {isRegistering
                  ? "Sign in"
                  : "Create an account"}
              </button>
            </p>
          </div>
        </section>
      </main>
    );
  }

  const navigationItems =
    role === "Student"
      ? ["Overview", "My Exams", "My Results"]
      : ["Overview", "Manage Exams", "Questions", "Students", "Results"];

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  // Dashboard
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo small-logo">S</div>
          <span>STACKSTORM</span>
        </div>

        <p className="nav-heading">WORKSPACE</p>

        {navigationItems.map((item) => (
          <button
            key={item}
            className={`nav-item ${
              activePage === item ? "nav-active" : ""
            }`}
            onClick={() => goToPage(item)}
          >
            <span>
              {({
                Overview: "⌂",
                "My Exams": "▣",
                "My Results": "▤",
                "Manage Exams": "▣",
                Questions: "?",
                Students: "♙",
                Results: "▤"
              })[item]}
            </span>

            {item}
          </button>
        ))}

        <button className="logout-button" onClick={handleLogout}>
          ↪ Sign out
        </button>
      </aside>

      <main className="dashboard">
        <header className="topbar">
          <div>
            <span className="muted">Workspace /</span>{" "}
            {activePage}
          </div>

          <div className="profile">
            <div className="avatar">
              {currentUser?.name?.[0] || role[0]}
            </div>

            <div>
              <strong>{currentUser?.name || role}</strong>
              <small>
                {role === "Admin"
                  ? "Administrator"
                  : "Student account"}
              </small>
            </div>
          </div>
        </header>

        <section className="dashboard-content">
          <span className="eyebrow">YOUR WORKSPACE</span>

          <h1>
            {activePage === "Overview"
              ? `Welcome to Stackstorm, ${currentUser?.name || role}!`
              : examData
                ? examData.title
                : selectedExam
                  ? selectedExam.name
                  : activePage}
          </h1>

          <p className="muted">
            {examData
              ? "Answer all questions before the timer expires."
              : selectedExam
                ? "Examination details and instructions."
                : "Here is your examination activity at a glance."}
          </p>

          {notice && (
            <p
              role="status"
              style={{
                color: "#ffcc80",
                marginTop: "15px"
              }}
            >
              {notice}
            </p>
          )}

          {/* Actual examination screen */}
          {examData && activePage === "My Exams" ? (
            <div
              style={{
                marginTop: "30px",
                padding: "28px",
                background: "#151e33",
                border: "1px solid #2b3854",
                borderRadius: "14px",
                maxWidth: "850px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "15px",
                  flexWrap: "wrap"
                }}
              >
                <h2>{examData.title}</h2>

                <strong
                  style={{
                    color: timeLeft < 60 ? "#ff7777" : "#a99aff",
                    fontSize: "20px"
                  }}
                >
                  Time: {formatTime(timeLeft)}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  margin: "25px 0"
                }}
              >
                <strong>
                  Question {currentQuestion + 1} of{" "}
                  {examData.questions.length}
                </strong>

                <span className="muted">
                  {Object.keys(answers).length} answered
                </span>
              </div>

              <div
                style={{
                  height: "7px",
                  background: "#293650",
                  borderRadius: "10px",
                  marginBottom: "25px"
                }}
              >
                <div
                  style={{
                    height: "7px",
                    width: `${
                      ((currentQuestion + 1) /
                        examData.questions.length) *
                      100
                    }%`,
                    background: "#a99aff",
                    borderRadius: "10px",
                    transition: "width 0.3s"
                  }}
                />
              </div>

              <h3>
                {examData.questions[currentQuestion].question}
              </h3>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  marginTop: "25px"
                }}
              >
                {examData.questions[currentQuestion].options.map(
                  (option, index) => (
                    <button
                      key={option}
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        setAnswers((previous) => ({
                          ...previous,
                          [examData.questions[currentQuestion].id]: option
                        }))
                      }
                      style={{
                        padding: "15px",
                        textAlign: "left",
                        borderRadius: "9px",
                        border:
                          answers[
                            examData.questions[currentQuestion].id
                          ] === option
                            ? "2px solid #a99aff"
                            : "1px solid #394966",
                        background:
                          answers[
                            examData.questions[currentQuestion].id
                          ] === option
                            ? "#302b50"
                            : "#202c43",
                        color: "white",
                        cursor: "pointer",
                        fontSize: "15px"
                      }}
                    >
                      {String.fromCharCode(65 + index)}. {option}
                    </button>
                  )
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "30px",
                  flexWrap: "wrap"
                }}
              >
                <button
                  className="exam-action"
                  type="button"
                  disabled={currentQuestion === 0 || submitting}
                  onClick={() =>
                    setCurrentQuestion((q) => q - 1)
                  }
                >
                  ← Previous
                </button>

                {currentQuestion < examData.questions.length - 1 ? (
                  <button
                    className="primary-button"
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      setCurrentQuestion((q) => q + 1)
                    }
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    type="button"
                    disabled={submitting}
                    onClick={() => submitExam(false)}
                  >
                    {submitting ? "Submitting..." : "Submit Examination"}
                  </button>
                )}
              </div>
            </div>
          ) : selectedExam && activePage === "My Exams" ? (
            // Examination details
            <div
              className="exam-details-panel"
              style={{
                marginTop: "30px",
                padding: "28px",
                background: "#151e33",
                border: "1px solid #2b3854",
                borderRadius: "14px",
                maxWidth: "850px"
              }}
            >
              <h2>{selectedExam.name}</h2>

              <p className="muted">
                Examination code: {selectedExam.code}
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "35px",
                  margin: "25px 0"
                }}
              >
                <div>
                  <strong>{selectedExam.duration}</strong>
                  <p className="muted">Duration</p>
                </div>

                <div>
                  <strong>{selectedExam.questions}</strong>
                  <p className="muted">Total questions</p>
                </div>

                <div>
                  <strong>{selectedExam.date}</strong>
                  <p className="muted">Exam date</p>
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid #2b3854",
                  paddingTop: "20px"
                }}
              >
                <h3>Examination Instructions</h3>

                <ol
                  style={{
                    lineHeight: "2.1",
                    paddingLeft: "22px"
                  }}
                >
                  {selectedExam.instructions.map(
                    (instruction, index) => (
                      <li key={index}>{instruction}</li>
                    )
                  )}
                </ol>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginTop: "25px"
                }}
              >
                <button
                  className="exam-action"
                  onClick={() => {
                    setSelectedExam(null);
                    setNotice("");
                  }}
                >
                  ← Back to My Exams
                </button>

                <button
                  className="primary-button"
                  onClick={startExam}
                  disabled={examLoading}
                >
                  {examLoading ? "Starting..." : "Start Exam →"}
                </button>
              </div>
            </div>
          ) : activePage === "My Results" ? (
            // Results screen
            <div
              style={{
                marginTop: "30px",
                padding: "25px",
                background: "#151e33",
                border: "1px solid #2b3854",
                borderRadius: "14px",
                maxWidth: "850px"
              }}
            >
              <h2>My Results</h2>

              {examResult ? (
                <>
                  <h3 style={{ marginTop: "20px" }}>
                    Database Management Systems
                  </h3>

                  <p style={{ marginTop: "15px" }}>
                    Correct answers: {examResult.correctAnswers} /{" "}
                    {examResult.totalQuestions}
                  </p>

                  <h1
                    style={{
                      color: "#a99aff",
                      marginTop: "15px"
                    }}
                  >
                    {examResult.percentage}%
                  </h1>

                  <p className="muted">
                    Your examination score
                  </p>

                  <p style={{ marginTop: "15px" }}>
                    {examResult.message}
                  </p>
                </>
              ) : (
                <p className="muted" style={{ marginTop: "15px" }}>
                  No examination results available yet.
                </p>
              )}
            </div>
          ) : (
            <>
              {(activePage === "Overview" ||
                activePage === "My Exams") && (
                <>
                  {activePage === "Overview" && (
                    <div className="stats-grid">
                      {(role === "Student"
                        ? [
                            ["03", "Available exams", "Upcoming assessments"],
                            ["12", "Exams completed", "Your exam history"],
                            ["85%", "Average score", "Overall performance"]
                          ]
                        : [
                            ["24", "Total students", "Registered accounts"],
                            ["08", "Total exams", "Created assessments"],
                            ["156", "Submissions", "Student attempts"]
                          ]
                      ).map(([number, label, description]) => (
                        <div className="stat-card" key={label}>
                          <span className="stat-icon">✦</span>
                          <h2>{number}</h2>
                          <strong>{label}</strong>
                          <p>{description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="section-heading">
                    <div>
                      <h2>
                        {activePage === "My Exams"
                          ? "All examinations"
                          : role === "Student"
                            ? "Examination schedule"
                            : "Recent examinations"}
                      </h2>

                      <p className="muted">
                        Stay updated with your assessments.
                      </p>
                    </div>
                  </div>

                  <div className="exam-list">
                    {exams.map((exam) => (
                      <div className="exam-card" key={exam.id}>
                        <div className="exam-icon">▤</div>

                        <div className="exam-info">
                          <strong>{exam.name}</strong>

                          <p>
                            {exam.code} · {exam.questions} questions ·{" "}
                            {exam.duration}
                          </p>
                        </div>

                        <span
                          className={`status ${
                            exam.status === "Available"
                              ? "available"
                              : "upcoming"
                          }`}
                        >
                          {exam.status}
                        </span>

                        <button
                          className="exam-action"
                          onClick={() => openExam(exam)}
                        >
                          {exam.status === "Available"
                            ? "View exam →"
                            : "View details →"}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activePage !== "Overview" &&
                activePage !== "My Exams" &&
                activePage !== "My Results" && (
                  <div style={{ marginTop: "30px" }}>
                    <p className="muted">
                      The {activePage} module will be developed next.
                    </p>
                  </div>
                )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
