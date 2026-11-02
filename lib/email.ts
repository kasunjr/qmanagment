import nodemailer from "nodemailer";

function createTransporter() {
  const username = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!username || !appPassword) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be configured to send email.");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: username, pass: appPassword },
  });
}

async function sendCode(email: string, code: string, subject: string, message: string): Promise<void> {
  const username = process.env.GMAIL_USER;
  if (!username) {
    throw new Error("GMAIL_USER must be configured to send email.");
  }

  await createTransporter().sendMail({
    from: process.env.GMAIL_FROM || username,
    to: email,
    subject,
    text: `${message} ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>${message}</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
  });
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  await sendCode(email, code, "Your Queue Management login code", "Your login verification code is:");
}

export async function sendSignupVerificationCode(email: string, code: string): Promise<void> {
  await sendCode(email, code, "Verify your Queue Management email", "Your email verification code is:");
}

export async function sendWelcomeEmail(email: string): Promise<void> {
  const username = process.env.GMAIL_USER;
  if (!username) {
    throw new Error("GMAIL_USER must be configured to send email.");
  }

  await createTransporter().sendMail({
    from: process.env.GMAIL_FROM || username,
    to: email,
    subject: "Welcome to Queue Management",
    text: "Welcome to Queue Management! Your email has been verified and your account is ready to use.",
    html: "<p>Welcome to Queue Management!</p><p>Your email has been verified and your account is ready to use.</p>",
  });
}
