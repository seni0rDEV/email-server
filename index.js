const express = require("express");
const cors = require("cors");
const path = require("path"); // Added to handle file paths

const app = express();

app.use(cors());
app.use(express.json());

// ─── Resend Configuration ───────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM || "notifications@dandori.online";
const FROM_NAME = "AI Workspace";

if (!RESEND_API_KEY) {
  console.warn("⚠️  RESEND_API_KEY is not set. /api/send-invite will fail.");
}

// ─── Serve the Invite HTML Page ─────────────────────────────────
// This tells Express to send your invite.html file when the user clicks the email link
app.get("/invite", (req, res) => {
  res.sendFile(path.join(__dirname, "invite.html"));
});

// ─── Debug endpoints ────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Email server is running!" });
});

app.get("/api/test-config", (req, res) => {
  res.json({
    provider: "resend",
    apiKey: RESEND_API_KEY ? "✅ Set" : "❌ Not set",
    from: FROM_EMAIL,
  });
});

// ─── Shared email builder ───────────────────────────────────────

function buildInviteEmail({
  toName,
  spaceName,
  inviterName,
  role,
  inviteToken,
}) {
  const safeName = toName || "there";
  const safeInviter = inviterName || "A user";
  const safeRole = role || "member";
  const year = new Date().getFullYear();

  // Points to the /invite route we just created above
  const inviteLink = `https://dandori.online/invite?token=${inviteToken}`;

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">You're invited to ${spaceName}</h2>
      <p>Hi ${safeName},</p>
      <p><b>${safeInviter}</b> invited you to join <b>${spaceName}</b> as a <b>${safeRole}</b>.</p>
      <p style="margin:28px 0">
        <a href="${inviteLink}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">
          Accept invite
        </a>
      </p>
      <p style="color:#888;font-size:12px">— AI Workspace, ${year}</p>
    </div>`;

  const text = `Hi ${safeName},\n\n${safeInviter} invited you to join "${spaceName}" as a ${safeRole}.\n\nAccept the invite: ${inviteLink}\n\n— AI Workspace, ${year}`;

  return { html, text };
}

// ─── Resend send ───────────────────────────────────────────────

async function sendInviteEmail(payload) {
  const { toEmail, toName, spaceName, inviterName, role, inviteToken } =
    payload;

  if (!toEmail || !spaceName || !inviteToken) {
    const err = new Error(
      "Missing required fields: toEmail, spaceName, and inviteToken are required",
    );
    err.statusCode = 400;
    throw err;
  }

  if (!RESEND_API_KEY) {
    const err = new Error("Server misconfigured: RESEND_API_KEY is missing");
    err.statusCode = 500;
    throw err;
  }

  const { html, text } = buildInviteEmail({
    toName,
    spaceName,
    inviterName,
    role,
    inviteToken,
  });
  const authHeader = `Bearer ${RESEND_API_KEY}`;
  const fromString = `${FROM_NAME} <${FROM_EMAIL}>`;

  const body = {
    from: fromString,
    to: [toEmail],
    subject: `${inviterName || "Someone"} invited you to ${spaceName}`,
    html: html,
    text: text,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(
      data?.message || `Resend API error (HTTP ${response.status})`,
    );
    err.statusCode = response.status;
    err.details = data;
    throw err;
  }

  return data;
}

// ─── Send invitation ────────────────────────────────────────────

app.post("/api/send-invite", async (req, res) => {
  try {
    const data = await sendInviteEmail(req.body);
    res.json({ success: true, messageId: data?.id || null });
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(error.statusCode || 500).json({
      error: "Failed to send invitation email",
      details: error.message,
    });
  }
});

// ─── Resend invitation ──────────────────────────────────────────

app.post("/api/resend-invite", async (req, res) => {
  try {
    const data = await sendInviteEmail(req.body);
    res.json({ success: true, messageId: data?.id || null });
  } catch (error) {
    console.error("❌ Error resending email:", error);
    res.status(error.statusCode || 500).json({
      error: "Failed to resend email",
      details: error.message,
    });
  }
});

module.exports = app;
