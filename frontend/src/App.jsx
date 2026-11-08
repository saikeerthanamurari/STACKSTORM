import { useState, useEffect, useRef } from "react";
import "./App.css";

const API_URL = "http://localhost:5001/api/auth";
const EXAM_API_URL = "http://localhost:5001/api/exams";

const legacyExams = [
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
      "Submit your answers before the examination ends.",
      "Do not refresh or close the examination window during an attempt."
    ]
  }
];

const emptyQuestion = () => ({
  question: "",
  options: ["", "", "", ""],
  answer: ""
});

function App() {
  const [role, setRole] = useState("Student");
  const [loggedIn, setLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [activePage, setActivePage] = useState("Overview");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const [exams, setExams] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [adminForm, setAdminForm] = useState({
    title: "",
    code: "",
    subject: "",
    duration: 30,
    status: "Available"
  });
  const [adminQuestions, setAdminQuestions] = useState([emptyQuestion()]);

  const [selectedExam, setSelectedExam] = useState(null);
  const [examData, setExamData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [examResult, setExamResult] = useState(null);
  const [examLoading, setExamLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [myResults, setMyResults] = useState([]);
  const [adminResults, setAdminResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);


  const submittingRef = useRef(false);
  const answersRef = useRef(answers);
  const submitExamRef = useRef(null);
  answersRef.current = answers;

  const token = () => sessionStorage.getItem("stackstormToken");
  const authHeaders = () => ({ Authorization: `Bearer ${token()}` });

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let endpoint;
      let body;

      if (isRegistering && !otpSent) {
        endpoint = "/register";
        body = { name, email, password };
      } else if (isRegistering && otpSent) {
        endpoint = "/verify-otp";
        body = { email, otp };
      } else {
        endpoint = "/login";
        body = { email, password };
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Something went wrong.");

      if (isRegistering && !otpSent) {
        setOtpSent(true);
        setError(data.message || "Verification code sent to your email.");
        return;
      }

      if (isRegistering && otpSent) {
        setError("Email verified successfully! You can now sign in.");
        setIsRegistering(false);
        setOtpSent(false);
        setOtp("");
        setRole("Student");
        setName("");
        setPassword("");
        return;
      }

      if (data.student?.role !== role.toLowerCase()) {
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
      setNotice("");
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("stackstormToken");
    setLoggedIn(false);
    setCurrentUser(null);
    setEmail("");
    setPassword("");
    setError("");
    setIsRegistering(false);
    setOtp("");
    setOtpSent(false);
    setSelectedExam(null);
    setExamData(null);
    setExamResult(null);
    setAnswers({});
    setActivePage("Overview");
    setNotice("");
    setExams([]);
    setMyResults([]);
  }

  async function loadExams() {
    setAdminLoading(true);
    setAdminMessage("");
    try {
      const endpoint = role === "Admin" ? "/admin/exams" : "/available";
      const response = await fetch(`${EXAM_API_URL}${endpoint}`, {
        headers: authHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load exams.");
      setExams(Array.isArray(data) ? data : data.exams || []);
    } catch (err) {
      setAdminMessage(err.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function loadMyResults() {
    try {
      const response = await fetch(`${EXAM_API_URL}/my-results`, {
        headers: authHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load results.");
      setMyResults(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setNotice(err.message);
    }
  }

  useEffect(() => {
    if (!loggedIn) return;
    if (
      (role === "Admin" && activePage === "Manage Exams") ||
      (role === "Student" && activePage === "My Exams")
    ) {
      loadExams();
    }
    if (role === "Student" && activePage === "My Results") {
      loadMyResults();
    }
    if (role === "Admin" && activePage === "Results") {
      loadAdminResults();
    }
  }, [loggedIn, role, activePage]);

  async function loadAdminResults() {
    setResultsLoading(true);
    try {
      const response = await fetch(`${EXAM_API_URL}/admin/results`, {
        headers: authHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load results.");
      setAdminResults(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setResultsLoading(false);
    }
  }

  function updateAdminQuestion(index, field, value) {
    setAdminQuestions((previous) =>
      previous.map((question, i) =>
        i === index ? { ...question, [field]: value } : question
      )
    );
  }

  function updateQuestionOption(questionIndex, optionIndex, value) {
    setAdminQuestions((previous) =>
      previous.map((question, i) =>
        i === questionIndex
          ? {
              ...question,
              options: question.options.map((option, j) =>
                j === optionIndex ? value : option
              )
            }
          : question
      )
    );
  }

  async function createAdminExam(e) {
    e.preventDefault();
    setAdminSaving(true);
    setAdminMessage("");

    const questions = adminQuestions.map((question) => ({
      question: question.question.trim(),
      options: question.options.map((option) => option.trim()).filter(Boolean),
      answer: question.answer.trim()
    }));

    try {
      const response = await fetch(`${EXAM_API_URL}/admin/exams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders()
        },
        body: JSON.stringify({
          ...adminForm,
          duration: Number(adminForm.duration),
          code: adminForm.code.trim().toUpperCase(),
          questions
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not create exam.");

      setAdminMessage("Examination created successfully.");
      setAdminForm({
        title: "",
        code: "",
        subject: "",
        duration: 30,
        status: "Available"
      });
      setAdminQuestions([emptyQuestion()]);
      await loadExams();
    } catch (err) {
      setAdminMessage(err.message);
    } finally {
      setAdminSaving(false);
    }
  }

  async function deleteAdminExam(id) {
    if (!window.confirm("Delete this examination? This action cannot be undone.")) return;
    setAdminMessage("");
    try {
      const response = await fetch(`${EXAM_API_URL}/admin/exams/${id}`, {
        method: "DELETE",
        headers: authHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not delete exam.");
      setAdminMessage("Examination deleted.");
      await loadExams();
    } catch (err) {
      setAdminMessage(err.message);
    }
  }

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

  async function startExam() {
    if (!selectedExam) return;
    setExamLoading(true);
    setNotice("");
    try {
      const isDynamic = Boolean(selectedExam._id);
      const endpoint = isDynamic
        ? `${EXAM_API_URL}/dynamic/${selectedExam._id}/start`
        : `${EXAM_API_URL}/dbms/start`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: authHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to start examination.");

      submittingRef.current = false;
      const normalizedQuestions = (data.questions || []).map((question) => ({
        ...question,
        id: question.id || question._id
      }));
      setExamData({
        ...data,
        title: data.title || selectedExam.title || selectedExam.name,
        questions: normalizedQuestions,
        mode: isDynamic ? "dynamic" : "legacy"
      });
      setAnswers({});
      setCurrentQuestion(0);
      setExamResult(null);
      setTimeLeft(Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000)));
    } catch (err) {
      setNotice(err.message);
    } finally {
      setExamLoading(false);
    }
  }

  async function submitExam(isAuto = false) {
    if (!examData || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const endpoint = examData.mode === "dynamic"
        ? `${EXAM_API_URL}/dynamic/submit`
        : `${EXAM_API_URL}/dbms/submit`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders()
        },
        body: JSON.stringify({
          attemptId: examData.attemptId,
          answers: answersRef.current
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Examination submission failed.");

      setExamResult(data);
      setExamData(null);
      setSelectedExam(null);
      setActivePage("My Results");
      setNotice(
        isAuto
          ? "Time expired. Your answers were submitted automatically."
          : "Your examination was submitted successfully."
      );
      if (role === "Student") loadMyResults();
    } catch (err) {
      submittingRef.current = false;
      setNotice(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  submitExamRef.current = submitExam;

  useEffect(() => {
    if (!examData || examResult) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((examData.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        submitExamRef.current?.(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [examData, examResult]);

  function goToPage(page) {
    if (examData) {
      setNotice("Please submit your active examination before navigating away.");
      return;
    }
    setActivePage(page);
    setSelectedExam(null);
    setNotice("");
    setAdminMessage("");
  }

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const navigationItems = role === "Student"
    ? ["Overview", "My Exams", "My Results"]
    : ["Overview", "Manage Exams", "Questions", "Students", "Results"];

  if (!loggedIn) {
    return (
      <main className="login-page">
        <section className="login-brand">
          <div className="brand-logo">S</div>
          <span className="brand-name">STACKSTORM</span>
          <div className="brand-content">
            <span className="eyebrow">SMART EXAMINATION PLATFORM</span>
            <h1>Examinations.<br />Made <span>Smarter.</span></h1>
            <p>A modern, secure and reliable platform for online examinations. Learn, attempt and achieve more.</p>
            <div className="brand-stats">
              <div><strong>Secure</strong><small>Exam environment</small></div>
              <div><strong>Smart</strong><small>Result management</small></div>
              <div><strong>Simple</strong><small>Easy experience</small></div>
            </div>
          </div>
          <p className="brand-footer">© 2026 Stackstorm. All rights reserved.</p>
        </section>

        <section className="login-form-section">
          <div className="login-card">
            <div className="mobile-brand">STACKSTORM</div>
            <span className="eyebrow">
              {isRegistering ? (otpSent ? "EMAIL VERIFICATION" : "CREATE YOUR ACCOUNT") : "WELCOME BACK"}
            </span>
            <h2>
              {isRegistering ? (otpSent ? "Verify your email" : "Create a student account") : "Sign in to your account"}
            </h2>
            <p className="muted">
              {isRegistering
                ? otpSent
                  ? "Enter the 6-digit verification code sent to your email."
                  : "Enter your details to register."
                : "Enter your details to access your dashboard."}
            </p>

            {!isRegistering && (
              <div className="role-switch">
                {["Student", "Admin"].map((item) => (
                  <button key={item} className={role === item ? "role-active" : ""} onClick={() => { setRole(item); setError(""); }} type="button">
                    {item}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {isRegistering && !otpSent && (
                <>
                  <label>Full name</label>
                  <input type="text" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} required />
                </>
              )}
              <label>Email address</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={isRegistering && otpSent} required />

              {isRegistering && otpSent ? (
                <>
                  <label>Verification code</label>
                  <input type="text" placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required />
                </>
              ) : (
                <>
                  <label>Password</label>
                  <input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                </>
              )}

              {error && <p role="alert" style={{ color: isRegistering && otpSent ? "#a99aff" : "#ff7777", marginTop: 12 }}>{error}</p>}
              <div className="form-options">
                {!isRegistering && (
                  <>
                    <label className="remember"><input type="checkbox" />Remember me</label>
                    <span>Secure login</span>
                  </>
                )}
              </div>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? "Please wait..." : isRegistering ? (otpSent ? "Verify OTP →" : "Send verification code →") : `Sign in as ${role} →`}
              </button>
            </form>

            <p className="login-note">
              {isRegistering ? "Already registered? " : "New student? "}
              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(""); setPassword(""); setOtp(""); setOtpSent(false); setName(""); }} style={{ background: "none", border: "none", color: "#a99aff", cursor: "pointer", font: "inherit" }}>
                {isRegistering ? "Sign in" : "Create an account"}
              </button>
            </p>
            {isRegistering && otpSent && (
              <button type="button" onClick={() => { setOtp(""); setOtpSent(false); setError(""); }} style={{ background: "none", border: "none", color: "#a99aff", cursor: "pointer", font: "inherit", marginTop: 12 }}>
                ← Back to registration
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-logo small-logo">S</div><span>STACKSTORM</span></div>
        <p className="nav-heading">WORKSPACE</p>
        {navigationItems.map((item) => (
          <button key={item} className={`nav-item ${activePage === item ? "nav-active" : ""}`} onClick={() => goToPage(item)}>
            <span>{({ Overview: "⌂", "My Exams": "▣", "My Results": "▤", "Manage Exams": "▣", Questions: "?", Students: "♙", Results: "▤" })[item]}</span>
            {item}
          </button>
        ))}
        <button className="logout-button" onClick={handleLogout}>↪ Sign out</button>
      </aside>

      <main className="dashboard">
        <header className="topbar">
          <div><span className="muted">Workspace /</span> {activePage}</div>
          <div className="profile">
            <div className="avatar">{currentUser?.name?.[0] || role[0]}</div>
            <div><strong>{currentUser?.name || role}</strong><small>{role === "Admin" ? "Administrator" : "Student account"}</small></div>
          </div>
        </header>

        <section className="dashboard-content">
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>{examData ? examData.title : selectedExam ? (selectedExam.title || selectedExam.name) : activePage === "Overview" ? `Welcome to Stackstorm, ${currentUser?.name || role}!` : activePage}</h1>
          <p className="muted">
            {examData ? "Answer all questions before the timer expires." : selectedExam ? "Examination details and instructions." : activePage === "Manage Exams" ? "Create, view and manage examinations." : "Here is your examination activity at a glance."}
          </p>

          {notice && <p role="status" style={{ color: "#ffcc80", marginTop: 15 }}>{notice}</p>}
          {adminMessage && <p role="status" style={{ color: "#a99aff", marginTop: 15 }}>{adminMessage}</p>}

          {examData && activePage === "My Exams" ? (
            <div style={{ marginTop: 30, padding: 28, background: "#151e33", border: "1px solid #2b3854", borderRadius: 14, maxWidth: 850 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 15, flexWrap: "wrap" }}>
                <h2>{examData.title}</h2>
                <strong style={{ color: timeLeft < 60 ? "#ff7777" : "#a99aff", fontSize: 20 }}>Time: {formatTime(timeLeft)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", margin: "25px 0" }}>
                <strong>Question {currentQuestion + 1} of {examData.questions.length}</strong>
                <span className="muted">{Object.keys(answers).length} answered</span>
              </div>
              <div style={{ height: 7, background: "#293650", borderRadius: 10, marginBottom: 25 }}>
                <div style={{ height: 7, width: `${((currentQuestion + 1) / examData.questions.length) * 100}%`, background: "#a99aff", borderRadius: 10 }} />
              </div>
              <h3>{examData.questions[currentQuestion]?.question}</h3>
              <div style={{ display: "grid", gap: 12, marginTop: 25 }}>
                {examData.questions[currentQuestion]?.options.map((option, index) => {
                  const questionId = examData.questions[currentQuestion].id;
                  return (
                    <button key={`${questionId}-${index}`} type="button" disabled={submitting} onClick={() => setAnswers((previous) => ({ ...previous, [questionId]: option }))} style={{ padding: 15, textAlign: "left", borderRadius: 9, border: answers[questionId] === option ? "2px solid #a99aff" : "1px solid #394966", background: answers[questionId] === option ? "#302b50" : "#202c43", color: "white", cursor: "pointer", fontSize: 15 }}>
                      {String.fromCharCode(65 + index)}. {option}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
                <button className="exam-action" type="button" disabled={currentQuestion === 0 || submitting} onClick={() => setCurrentQuestion((q) => q - 1)}>← Previous</button>
                {currentQuestion < examData.questions.length - 1 ? (
                  <button className="primary-button" type="button" disabled={submitting} onClick={() => setCurrentQuestion((q) => q + 1)}>Next →</button>
                ) : (
                  <button className="primary-button" type="button" disabled={submitting} onClick={() => submitExam(false)}>{submitting ? "Submitting..." : "Submit Examination"}</button>
                )}
              </div>
            </div>
          ) : selectedExam && activePage === "My Exams" ? (
            <div style={{ marginTop: 30, padding: 28, background: "#151e33", border: "1px solid #2b3854", borderRadius: 14, maxWidth: 850 }}>
              <h2>{selectedExam.title || selectedExam.name}</h2>
              <p className="muted">Examination code: {selectedExam.code}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 35, margin: "25px 0" }}>
                <div><strong>{selectedExam.duration} {typeof selectedExam.duration === "number" ? "minutes" : ""}</strong><p className="muted">Duration</p></div>
                <div><strong>{selectedExam.questions?.length ?? selectedExam.questionCount ?? selectedExam.questions}</strong><p className="muted">Total questions</p></div>
                <div><strong>{selectedExam.status}</strong><p className="muted">Status</p></div>
              </div>
              <div style={{ borderTop: "1px solid #2b3854", paddingTop: 20 }}>
                <h3>Examination Instructions</h3>
                <ol style={{ lineHeight: 2.1, paddingLeft: 22 }}>
                  <li>Read each question carefully.</li>
                  <li>You have {selectedExam.duration} minutes to complete the examination.</li>
                  <li>Submit your answers before the timer expires.</li>
                </ol>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 25, flexWrap: "wrap" }}>
                <button className="exam-action" onClick={() => { setSelectedExam(null); setNotice(""); }}>← Back to My Exams</button>
                <button className="primary-button" onClick={startExam} disabled={examLoading}>{examLoading ? "Starting..." : "Start Exam →"}</button>
              </div>
            </div>
          ) : activePage === "Manage Exams" && role === "Admin" ? (
            <div style={{ display: "grid", gap: 25, marginTop: 30, maxWidth: 1000 }}>
              <form onSubmit={createAdminExam} style={{ padding: 25, background: "#151e33", border: "1px solid #2b3854", borderRadius: 14 }}>
                <h2>Create a new examination</h2>
                <p className="muted">Enter exam details and add multiple-choice questions.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 15, marginTop: 20 }}>
                  <label>Exam title<input required value={adminForm.title} onChange={(e) => setAdminForm({ ...adminForm, title: e.target.value })} placeholder="e.g. Computer Networks" /></label>
                  <label>Exam code<input required value={adminForm.code} onChange={(e) => setAdminForm({ ...adminForm, code: e.target.value.toUpperCase() })} placeholder="e.g. CN-102" /></label>
                  <label>Subject<input required value={adminForm.subject} onChange={(e) => setAdminForm({ ...adminForm, subject: e.target.value })} placeholder="Subject name" /></label>
                  <label>Duration (minutes)<input required type="number" min="1" value={adminForm.duration} onChange={(e) => setAdminForm({ ...adminForm, duration: e.target.value })} /></label>
                  <label>Status<select value={adminForm.status} onChange={(e) => setAdminForm({ ...adminForm, status: e.target.value })}><option>Available</option><option>Upcoming</option><option>Closed</option></select></label>
                </div>

                <div style={{ marginTop: 25 }}>
                  <h3>Questions</h3>
                  {adminQuestions.map((question, questionIndex) => (
                    <div key={questionIndex} style={{ marginTop: 18, padding: 18, border: "1px solid #394966", borderRadius: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <strong>Question {questionIndex + 1}</strong>
                        {adminQuestions.length > 1 && <button type="button" className="exam-action" onClick={() => setAdminQuestions((previous) => previous.filter((_, i) => i !== questionIndex))}>Remove</button>}
                      </div>
                      <label style={{ display: "block", marginTop: 12 }}>Question text<textarea required rows="2" value={question.question} onChange={(e) => updateAdminQuestion(questionIndex, "question", e.target.value)} placeholder="Enter the question" /></label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12 }}>
                        {question.options.map((option, optionIndex) => (
                          <label key={optionIndex}>Option {String.fromCharCode(65 + optionIndex)}<input required value={option} onChange={(e) => updateQuestionOption(questionIndex, optionIndex, e.target.value)} placeholder={`Enter option ${String.fromCharCode(65 + optionIndex)}`} /></label>
                        ))}
                      </div>
                      <label style={{ display: "block", marginTop: 12 }}>Correct answer<select required value={question.answer} onChange={(e) => updateAdminQuestion(questionIndex, "answer", e.target.value)}><option value="">Choose the correct option</option>{question.options.filter((option) => option.trim()).map((option, index) => <option key={`${index}-${option}`} value={option}>{String.fromCharCode(65 + index)}. {option}</option>)}</select></label>
                    </div>
                  ))}
                  <button type="button" className="exam-action" style={{ marginTop: 15 }} onClick={() => setAdminQuestions((previous) => [...previous, emptyQuestion()])}>+ Add another question</button>
                </div>
                <button className="primary-button" type="submit" disabled={adminSaving} style={{ marginTop: 22 }}>{adminSaving ? "Creating..." : "Create Examination →"}</button>
              </form>

              <div style={{ padding: 25, background: "#151e33", border: "1px solid #2b3854", borderRadius: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div><h2>Existing examinations</h2><p className="muted">Exams saved in the database.</p></div>
                  <button className="exam-action" type="button" onClick={loadExams}>Refresh</button>
                </div>
                {adminLoading ? <p className="muted">Loading examinations...</p> : exams.length === 0 ? <p className="muted">No examinations created yet.</p> : (
                  <div className="exam-list">
                    {exams.map((exam) => (
                      <div className="exam-card" key={exam._id}>
                        <div className="exam-icon">▤</div>
                        <div className="exam-info">
                          <strong>{exam.title}</strong>
                          <p>{exam.code} · {exam.subject} · {exam.duration} minutes · {exam.questions?.length || 0} questions</p>
                        </div>
                        <span className={`status ${exam.status === "Available" ? "available" : "upcoming"}`}>{exam.status}</span>
                        <button type="button" className="exam-action" onClick={() => deleteAdminExam(exam._id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activePage === "My Results" && role === "Student" ? (
            <div style={{ marginTop: 30, padding: 25, background: "#151e33", border: "1px solid #2b3854", borderRadius: 14, maxWidth: 900 }}>
              <h2>My Results</h2>
              {examResult && (
                <div style={{ marginTop: 20 }}>
                  <h3>Latest examination result</h3>
                  <p>Correct answers: {examResult.correctAnswers} / {examResult.totalQuestions}</p>
                  <h1 style={{ color: "#a99aff", marginTop: 12 }}>{examResult.percentage}%</h1>
                  <p className="muted">{examResult.message || "Your examination score"}</p>
                </div>
              )}
              {myResults.length > 0 ? myResults.map((result) => (
                <div key={result._id} className="exam-card" style={{ marginTop: 15 }}>
                  <div className="exam-info">
                    <strong>{result.exam?.title || "Examination"}</strong>
                    <p>{result.correctAnswers} / {result.totalQuestions} correct · {result.percentage}%</p>
                  </div>
                </div>
              )) : !examResult ? <p className="muted" style={{ marginTop: 15 }}>No examination results available yet.</p> : null}
            </div>
          ) : activePage === "My Exams" && role === "Student" ? (
            <div style={{ marginTop: 30 }}>
              <div className="section-heading"><div><h2>Available examinations</h2><p className="muted">Choose an examination to view its details.</p></div><button className="exam-action" onClick={loadExams}>Refresh</button></div>
              {adminLoading ? <p className="muted">Loading examinations...</p> : (
                <div className="exam-list">
                  {exams.map((exam) => (
                    <div className="exam-card" key={exam._id || exam.id}>
                      <div className="exam-icon">▤</div>
                      <div className="exam-info"><strong>{exam.title || exam.name}</strong><p>{exam.code} · {exam.questions?.length || exam.questions} questions · {exam.duration} minutes</p></div>
                      <span className={`status ${exam.status === "Available" ? "available" : "upcoming"}`}>{exam.status}</span>
                      <button className="exam-action" onClick={() => openExam(exam)}>{exam.status === "Available" ? "View exam →" : "View details →"}</button>
                    </div>
                  ))}
                  {exams.length === 0 && <p className="muted">No examinations are available yet.</p>}
                </div>
              )}
            </div>
          ) : activePage === "Results" && role === "Admin" ? (
            <div style={{ marginTop: 30, padding: 25, background: "#151e33", border: "1px solid #2b3854", borderRadius: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>Student Examination Results</h2>
                <button className="exam-action" onClick={loadAdminResults}>Refresh</button>
              </div>
              {resultsLoading ? <p>Loading results...</p> :
                adminResults.length === 0 ? <p>No examination submissions found.</p> : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", minWidth: 700 }}>
                      <thead>
                        <tr>
                          {["Student", "Email", "Exam", "Correct", "Score", "Percentage", "Submitted"].map(x => <th key={x} style={{ padding: 12 }}>{x}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {adminResults.map(result => (
                          <tr key={result._id}>
                            <td style={{ padding: 12 }}>{result.student?.name || "Unknown"}</td>
                            <td style={{ padding: 12 }}>{result.student?.email || "—"}</td>
                            <td style={{ padding: 12 }}>{result.exam?.title || "Deleted exam"}</td>
                            <td style={{ padding: 12 }}>{result.correctAnswers}/{result.totalQuestions}</td>
                            <td style={{ padding: 12 }}>{result.score}</td>
                            <td style={{ padding: 12 }}>{result.percentage}%</td>
                            <td style={{ padding: 12 }}>{new Date(result.submittedAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          ) : activePage === "Overview" ? (
            <>
              <div className="stats-grid">
                {(role === "Student"
                  ? [["03", "Available exams", "Upcoming assessments"], ["12", "Exams completed", "Your exam history"], ["85%", "Average score", "Overall performance"]]
                  : [[String(exams.length).padStart(2, "0"), "Total exams", "Created assessments"], ["Admin", "Workspace", "Manage examinations"], ["Active", "Platform", "Online examination system"]]
                ).map(([number, label, description]) => (
                  <div className="stat-card" key={label}><span className="stat-icon">✦</span><h2>{number}</h2><strong>{label}</strong><p>{description}</p></div>
                ))}
              </div>
              {role === "Student" && <button className="primary-button" onClick={() => goToPage("My Exams")}>Browse examinations →</button>}
              {role === "Admin" && <button className="primary-button" onClick={() => goToPage("Manage Exams")}>Manage examinations →</button>}
            </>
          ) : (
            <div style={{ marginTop: 30, padding: 25, background: "#151e33", border: "1px solid #2b3854", borderRadius: 14 }}>
              <h2>{activePage}</h2>
              <p className="muted">This section will be connected after the examination management workflow is complete.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
