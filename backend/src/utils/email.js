const nodemailer = require("nodemailer");

const createTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("⚠️ SMTP settings are not configured in environment variables. Real emails will not be sent.");
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || "587", 10),
    secure: SMTP_PORT === "465",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const sendResetEmail = async (to, resetLink) => {
  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@greenmoney.io";

  if (!transporter) {
    console.log(`\n==================================================`);
    console.log(`[SMTP MOCK] Password reset request for: ${to}`);
    console.log(`[SMTP MOCK] Reset Link: ${resetLink}`);
    console.log(`==================================================\n`);
    return { mock: true, resetLink };
  }

  const mailOptions = {
    from: `"GreenMoney" <${from}>`,
    to,
    subject: "Reset your GreenMoney Password",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #FEF7FF;">
        <h2 style="color: #2E7D32; text-align: center;">Reset your Password</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password for your GreenMoney account. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2E7D32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>If the button doesn't work, copy and paste the following URL into your browser:</p>
        <p style="word-break: break-all; color: #49454F;">${resetLink}</p>
        <p>This link is valid for 15 minutes. If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin-top: 30px; margin-bottom: 20px;" />
        <p style="font-size: 12px; color: #7f7f7f; text-align: center;">GreenMoney Finance App</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendResetEmail };
