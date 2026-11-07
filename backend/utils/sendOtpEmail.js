const sendOtpEmail = async (email, otp) => {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender: {
        name: "STACKSTORM",
        email: process.env.BREVO_SENDER_EMAIL
      },
      to: [{ email }],
      subject: "STACKSTORM Email Verification",
      htmlContent: `
        <h2>STACKSTORM Email Verification</h2>
        <p>Your verification code is:</p>
        <h1>${otp}</h1>
        <p>This code expires in 5 minutes.</p>
      `
    })
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error("Email sending failed:", errorDetails);
    throw new Error("Unable to send verification email.");
  }

  return true;
};

module.exports = sendOtpEmail;