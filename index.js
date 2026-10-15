const express = require("express");
const cors = require("cors");

const app = express();



app.use(cors());
app.use(express.json());

// ─── Mailjet Configuration ──────────────────────────────────────
// SECRET — injected by Vercel at runtime from environment variables.
// Set these in:
//   Vercel → Project → Settings → Environment Variables
//   MAILJET_API_KEY      (the "API Key" from Mailjet)
//   MAILJET_SECRET_KEY   (the "Secret Key" from Mailjet)
//   MAILJET_FROM         (optional, defaults to your verified Gmail)
const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

// Must exactly match the verified sender address in Mailjet.
const FROM_EMAIL = process.env.MAILJET_FROM || "lioneldestiny111@gmail.com";
const FROM_NAME = "AI Workspace";

if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
  console.warn(
    "⚠️  MAILJET_API_KEY or MAILJET_SECRET_KEY is not set. /api/send-invite will fail.",
  );
}

// ─── Debug endpoints ────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  console.log("✅ Health check called");
  res.json({ status: "ok", message: "Email server is running!" });
});

app.get("/api/test-config", (req, res) => {
  console.log("✅ Test config called");
  res.json({
    provider: "mailjet",
    apiKey: MAILJET_API_KEY ? "✅ Set" : "❌ Not set",
    secretKey: MAILJET_SECRET_KEY ? "✅ Set" : "❌ Not set",
    from: FROM_EMAIL,
  });
});

// ─── Shared email builder (unchanged) ───────────────────────────

function buildInviteEmail({
  toName,
  spaceName,
  inviterName,
  role,
  inviteLink,
}) {
  const safeName = toName || "there";
  const safeInviter = inviterName || "A user";
  const safeRole = role || "member";
  const year = new Date().getFullYear();

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">You're invited to ${spaceName}</h2>
      <p>Hi ${safeName},</p>
      <p>
        <b>${safeInviter}</b> invited you to join <b>${spaceName}</b>
        as a <b>${safeRole}</b>.
      </p>
      <p style="margin:28px 0">
        <a href="${inviteLink}"
           style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">
          Accept invite
        </a>
      </p>
      <p style="color:#888;font-size:12px">— AI Workspace, ${year}</p>
    </div>`;

  const text =
    `Hi ${safeName},\n\n` +
    `${safeInviter} invited you to join "${spaceName}" as a ${safeRole}.\n\n` +
    `Accept the invite: ${inviteLink}\n\n` +
    `— AI Workspace, ${year}`;

  return { html, text };
}

// ─── Mailjet send ───────────────────────────────────────────────

async function sendInviteEmail(payload) {
  const { toEmail, toName, spaceName, inviterName, role, inviteLink } = payload;

  if (!toEmail || !spaceName || !inviteLink) {
    const err = new Error(
      "Missing required fields: toEmail, spaceName, and inviteLink are required",
    );
    err.statusCode = 400;
    throw err;
  }

  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
    const err = new Error(
      "Server misconfigured: MAILJET_API_KEY / MAILJET_SECRET_KEY is missing",
    );
    err.statusCode = 500;
    throw err;
  }

  const { html, text } = buildInviteEmail({
    toName,
    spaceName,
    inviterName,
    role,
    inviteLink,
  });

  // Mailjet uses Basic Auth: base64(apiKey:secretKey)
  const authHeader =
    "Basic " +
    Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString("base64");

  const body = {
    Messages: [
      {
        From: {
          Email: FROM_EMAIL,
          Name: FROM_NAME,
        },
        To: [
          {
            Email: toEmail,
            Name: toName || toEmail.split("@")[0],
          },
        ],
        Subject: `${inviterName || "Someone"} invited you to ${spaceName}`,
        HTMLPart: html,
        TextPart: text,
      },
    ],
  };

  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(
      data?.Messages?.[0]?.Errors?.[0]?.ErrorMessage ||
        data?.ErrorMessage ||
        `Mailjet API error (HTTP ${response.status})`,
    );
    err.statusCode = response.status;
    err.details = data;
    throw err;
  }

  // Mailjet returns 200 even when individual messages fail — check per-message.
  const msgStatus = data?.Messages?.[0]?.Status;
  if (msgStatus && msgStatus !== "success") {
    const err = new Error(
      data?.Messages?.[0]?.Errors?.[0]?.ErrorMessage ||
        "Mailjet rejected the message",
    );
    err.statusCode = 400;
    err.details = data;
    throw err;
  }

  return data?.Messages?.[0] || data;
}

// ─── Send invitation ────────────────────────────────────────────

app.post("/api/send-invite", async (req, res) => {
  console.log("📧 /api/send-invite called");
  console.log("📧 Request body:", req.body);

  try {
    const data = await sendInviteEmail(req.body);
    console.log("✅ Email sent successfully:", data);
    res.json({ success: true, messageId: data?.To?.[0]?.MessageID || null });
  } catch (error) {
    console.error("❌ Detailed error:", {
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      stack: error.stack,
    });

    res.status(error.statusCode || 500).json({
      error: "Failed to send invitation email",
      details: error.message,
      status: error.statusCode || null,
    });
  }
});

// ─── Resend invitation ──────────────────────────────────────────

app.post("/api/resend-invite", async (req, res) => {
  console.log("📧 /api/resend-invite called");

  try {
    const data = await sendInviteEmail(req.body);
    console.log(`✅ Resent email to ${req.body.toEmail}`);
    res.json({ success: true, messageId: data?.To?.[0]?.MessageID || null });
  } catch (error) {
    console.error("❌ Error resending email:", error);
    res.status(error.statusCode || 500).json({
      error: "Failed to resend email",
      details: error.message,
    });
  }
});

module.exports = app;
