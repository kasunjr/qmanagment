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

async function sendCode(email: string, code: string, purpose: "login" | "signup" | "email-change"): Promise<void> {
  const username = process.env.GMAIL_USER;
  if (!username) {
    throw new Error("GMAIL_USER must be configured to send email.");
  }

  const content = {
    login: {
      subject: "Your MyTurn sign-in code",
      heading: "Confirm it&apos;s you.",
      description: "One quick check before you return to your workspace. Enter this code on the MyTurn sign-in page.",
      codeLabel: "YOUR SIGN-IN CODE",
      eyebrow: "WELCOME BACK",
      preheader: "Complete your MyTurn sign-in.",
      textTitle: "Confirm your MyTurn sign-in",
      instruction: "Enter this code on the MyTurn sign-in page to continue.",
    },
    signup: {
      subject: "Verify your MyTurn email",
      heading: "Verify your email.",
      description: "You&apos;re one step closer to your first queue. Enter this code on the MyTurn signup page to verify your email.",
      codeLabel: "YOUR EMAIL VERIFICATION CODE",
      eyebrow: "A SIMPLE START",
      preheader: "Verify your email to get started with MyTurn.",
      textTitle: "Verify your MyTurn email",
      instruction: "Enter this code on the MyTurn signup page to verify your email.",
    },
    "email-change": {
      subject: "Confirm your new MyTurn email",
      heading: "Verify your new email.",
      description: "One quick check to confirm your new email address. Enter this code in your MyTurn profile settings. Your current sign-in email stays the same until verification is complete.",
      codeLabel: "YOUR EMAIL VERIFICATION CODE",
      eyebrow: "ACCOUNT EMAIL UPDATE",
      preheader: "Confirm the new email address for your MyTurn account.",
      textTitle: "Verify your new MyTurn email",
      instruction: "Enter this code in your MyTurn profile settings to confirm your new email address. Your current sign-in email stays the same until verification is complete.",
    },
  }[purpose];
  const safeCode = code.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]!));

  await createTransporter().sendMail({
    from: process.env.GMAIL_FROM || username,
    to: email,
    subject: content.subject,
    text: [
      content.textTitle,
      "",
      `${purpose === "login" ? "Your sign-in code" : "Your email verification code"}: ${code}`,
      "This code expires in 10 minutes.",
      "",
      content.instruction,
      "Keep this code private. Only enter it on the MyTurn page where you requested it.",
      "",
      "If you did not request this code, you can ignore this email.",
      "The MyTurn team",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${content.subject}</title>
</head>
<body bgcolor="#f3f8f4" style="margin:0;padding:0;background-color:#f3f8f4;color:#243c32;font-family:'Trebuchet MS',Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f3f8f4;" aria-hidden="true">${content.preheader} Your code expires in 10 minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f8f4" style="width:100%;background-color:#f3f8f4;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #d5e5db;border-radius:22px;border-collapse:separate;table-layout:fixed;">
        <tr><td style="padding:26px 28px;border-bottom:1px solid #e2ece5;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td bgcolor="#00a66a" style="padding:3px 7px 5px;background-color:#00a66a;border-radius:7px;color:#ffffff;font-size:27px;font-weight:bold;line-height:31px;">My</td>
            <td style="padding-left:6px;color:#243c32;font-size:27px;font-weight:bold;line-height:31px;">Turn</td>
          </tr></table>
        </td></tr>
        <tr><td bgcolor="#eaf8e5" style="padding:28px;background-color:#eaf8e5;background-image:linear-gradient(115deg,#f3ffdf,#d9f6e8 65%,#e0f4fc);">
          <p style="margin:0 0 12px;color:#087a3c;font-size:11px;font-weight:bold;line-height:18px;">${content.eyebrow}</p>
          <h1 style="margin:0;color:#243c32;font-size:30px;font-weight:bold;line-height:38px;">${content.heading}</h1>
          <p style="margin:14px 0 24px;color:#435e4d;font-size:15px;line-height:25px;">${content.description}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;background-color:#ffffff;border:1px solid #b9ddc7;border-radius:16px;">
            <tr><td align="center" style="padding:22px 12px 18px;">
              <p style="margin:0 0 10px;color:#55715f;font-size:10px;font-weight:bold;line-height:18px;">${content.codeLabel}</p>
              <p style="margin:0;color:#087a3c;font-family:Consolas,'Courier New',monospace;font-size:36px;font-weight:bold;line-height:48px;letter-spacing:0;white-space:nowrap;">${safeCode}</p>
            </td></tr>
            <tr><td align="center" bgcolor="#f5faf6" style="padding:12px;border-top:2px dashed #c0dbc9;background-color:#f5faf6;border-radius:0 0 16px 16px;">
              <p style="margin:0;color:#496452;font-size:12px;line-height:21px;">Valid for <strong style="color:#087a3c;">10 minutes</strong></p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <p style="margin:0 0 10px;color:#243c32;font-size:16px;font-weight:bold;line-height:24px;">Keep this code private.</p>
          <p style="margin:0;color:#59646b;font-size:14px;line-height:24px;">Only enter it on the MyTurn page where you requested it. If you did not request this code, you can ignore this email.</p>
        </td></tr>
        <tr><td bgcolor="#f8fbf8" style="padding:20px 28px;background-color:#f8fbf8;border-top:1px solid #e2ece5;border-radius:0 0 22px 22px;">
          <p style="margin:0;color:#365447;font-size:14px;font-weight:bold;line-height:23px;">A better turn for everyone.</p>
          <p style="margin:4px 0 0;color:#59646b;font-size:12px;line-height:21px;">The MyTurn team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  await sendCode(email, code, "login");
}

export async function sendSignupVerificationCode(email: string, code: string): Promise<void> {
  await sendCode(email, code, "signup");
}

export async function sendEmailChangeVerificationCode(email: string, code: string): Promise<void> {
  await sendCode(email, code, "email-change");
}

export async function sendWelcomeEmail(email: string): Promise<void> {
  const username = process.env.GMAIL_USER;
  if (!username) {
    throw new Error("GMAIL_USER must be configured to send email.");
  }

  let workspaceUrl: string | null = null;
  if (process.env.APP_URL) {
    try {
      const url = new URL("/admin", process.env.APP_URL);
      if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) {
        workspaceUrl = url.href;
      }
    } catch {}
  }

  const steps = [
    { title: "Add your branch", description: "Give your branch a name and a code." },
    { title: "Set up your queue", description: "Add a service and assign the person at your counter." },
    { title: "Share your link or QR code", description: "Let customers join, then call the next ticket." },
  ];
  const action = workspaceUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#087a3c" style="background-color:#087a3c;background-image:linear-gradient(115deg,#17823a,#04633e);border-radius:12px;"><a href="${workspaceUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="display:block;padding:16px 24px;color:#ffffff;font-family:'Trebuchet MS',Arial,sans-serif;font-size:16px;font-weight:bold;line-height:24px;text-decoration:none;">Open your workspace &rarr;</a></td></tr></table><p style="margin:14px 0 0;color:#59646b;font-size:12px;line-height:20px;text-align:center;">Sign in with the account you just verified.</p>`
    : `<p style="margin:0;color:#365447;font-size:15px;line-height:25px;">Sign in to your MyTurn account to set up your first queue.</p>`;

  await createTransporter().sendMail({
    from: process.env.GMAIL_FROM || username,
    to: email,
    subject: "Welcome to MyTurn - your workspace is ready",
    text: [
      "Welcome to MyTurn!",
      "Your email has been verified and your workspace is ready to use.",
      "Small setup. A smoother day.",
      "",
      ...steps.map((step, index) => `${index + 1}. ${step.title}: ${step.description}`),
      "",
      "New accounts start on the free Basic plan. Usage limits apply.",
      workspaceUrl ? `Open your workspace: ${workspaceUrl}` : "Sign in to your MyTurn account to get started.",
      "",
      "A better turn for everyone.",
      "The MyTurn team",
      "",
      "This email confirms your MyTurn account setup. If you did not create this account, do not sign in or share your verification codes.",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Welcome to MyTurn</title>
</head>
<body bgcolor="#f3f8f4" style="margin:0;padding:0;background-color:#f3f8f4;color:#243c32;font-family:'Trebuchet MS',Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f3f8f4;" aria-hidden="true">Your email is verified. Set up your first queue in a few simple steps.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f8f4" style="width:100%;background-color:#f3f8f4;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #d5e5db;border-radius:22px;border-collapse:separate;table-layout:fixed;">
        <tr><td style="padding:26px 28px;border-bottom:1px solid #e2ece5;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td bgcolor="#00a66a" style="padding:3px 7px 5px;background-color:#00a66a;border-radius:7px;color:#ffffff;font-size:27px;font-weight:bold;line-height:31px;">My</td>
            <td style="padding-left:6px;color:#243c32;font-size:27px;font-weight:bold;line-height:31px;">Turn</td>
          </tr></table>
        </td></tr>
        <tr><td bgcolor="#eaf8e5" style="padding:30px 28px;background-color:#eaf8e5;background-image:linear-gradient(115deg,#f3ffdf,#d9f6e8 65%,#e0f4fc);">
          <p style="margin:0 0 12px;color:#087a3c;font-size:11px;font-weight:bold;line-height:18px;">A LITTLE LESS WAITING.</p>
          <h1 style="margin:0;color:#243c32;font-size:32px;font-weight:bold;line-height:40px;">Welcome to MyTurn.</h1>
          <p style="margin:14px 0 24px;color:#435e4d;font-size:16px;line-height:26px;">Your email is verified and your workspace is ready. Let&apos;s make your next day a little more organized.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;background-color:#ffffff;border:1px solid #b9ddc7;border-radius:16px;">
            <tr><td style="padding:22px 22px 17px;">
              <p style="margin:0 0 7px;color:#55715f;font-size:10px;font-weight:bold;line-height:18px;">YOUR WORKSPACE</p>
              <p style="margin:0;color:#087a3c;font-size:34px;font-weight:bold;line-height:42px;">Ready.</p>
            </td></tr>
            <tr><td style="padding:14px 22px;border-top:2px dashed #c0dbc9;">
              <p style="margin:0;color:#365e45;font-size:13px;line-height:22px;"><strong style="color:#087a3c;">Email verified</strong> &nbsp;&middot;&nbsp; Your next chapter starts here.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 28px 12px;">
          <h2 style="margin:0 0 22px;color:#243c32;font-size:23px;font-weight:bold;line-height:31px;">Three steps. Then you&apos;re serving.</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
            ${steps.map((step, index) => `<tr><td width="48" valign="top" style="width:48px;padding:0 12px 22px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="32" height="32" align="center" bgcolor="${["#d8f3c1", "#ffe6b4", "#ffd9df"][index]}" style="width:32px;height:32px;border-radius:11px;color:#365447;font-size:12px;font-weight:bold;line-height:32px;">0${index + 1}</td></tr></table></td><td valign="top" style="padding:0 0 22px;"><h3 style="margin:0 0 5px;color:#243c32;font-size:16px;font-weight:bold;line-height:23px;">${step.title}</h3><p style="margin:0;color:#59646b;font-size:14px;line-height:23px;">${step.description}</p></td></tr>`).join("")}
          </table>
        </td></tr>
        <tr><td style="padding:0 28px 28px;">
          <p style="margin:0 0 20px;padding:14px 16px;background-color:#f2f8f3;border:1px solid #e0ece3;border-radius:11px;color:#496452;font-size:13px;line-height:22px;"><strong>Start small. Grow at your pace.</strong><br>New accounts start on the free Basic plan. Usage limits apply.</p>
          ${action}
        </td></tr>
        <tr><td bgcolor="#f8fbf8" style="padding:22px 28px;background-color:#f8fbf8;border-top:1px solid #e2ece5;border-radius:0 0 22px 22px;">
          <p style="margin:0;color:#365447;font-size:15px;font-weight:bold;line-height:24px;">A better turn for everyone.</p>
          <p style="margin:4px 0 0;color:#59646b;font-size:13px;line-height:22px;">The MyTurn team</p>
          <p style="margin:16px 0 0;color:#697c6f;font-size:11px;line-height:19px;">This email confirms your MyTurn account setup. If you did not create this account, do not sign in or share your verification codes.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
