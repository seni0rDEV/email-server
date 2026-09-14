const express = require("express");
const cors = require("cors");
const emailjs = require("@emailjs/nodejs");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ─── EmailJS Configuration ─────────────────────────────────────
// Non-secret IDs — safe to keep in code.
const EMAILJS_SERVICE_ID = "service_gayry4q";
const EMAILJS_TEMPLATE_ID = "template_eny93jq";
const EMAILJS_PUBLIC_KEY = "q1TI3q0wDVqojcO_k";

// SECRET — injected by Vercel at runtime from the environment.
// Never hardcode this. Set it in:
//   Vercel → Project → Settings → Environment Variables
//   Key: EMAILJS_PRIVATE_KEY
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

if (!EMAILJS_PRIVATE_KEY) {
  console.warn(
    "⚠️  EMAILJS_PRIVATE_KEY is not set. /api/send-invite will fail with 403.",
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
    serviceId: EMAILJS_SERVICE_ID,
    templateId: EMAILJS_TEMPLATE_ID,
    publicKey: EMAILJS_PUBLIC_KEY ? "✅ Set" : "❌ Not set",
    privateKey: EMAILJS_PRIVATE_KEY ? "✅ Set" : "❌ Not set",
  });
});

// ─── Send invitation ────────────────────────────────────────────

app.post("/api/send-invite", async (req, res) => {
  console.log("📧 /api/send-invite called");
  console.log("📧 Request body:", req.body);

  try {
    const { toEmail, toName, spaceName, inviterName, role, inviteLink } =
      req.body;

    // Validate required fields
    if (!toEmail || !spaceName || !inviteLink) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        error:
          "Missing required fields: toEmail, spaceName, and inviteLink are required",
      });
    }

    // Fail fast if the private key was never configured.
    if (!EMAILJS_PRIVATE_KEY) {
      console.log("❌ EMAILJS_PRIVATE_KEY is not set");
      return res.status(500).json({
        error: "Server misconfigured: EMAILJS_PRIVATE_KEY is missing",
      });
    }

    const templateParams = {
      to_email: toEmail,
      to_name: toName || toEmail.split("@")[0],
      space_name: spaceName,
      inviter_name: inviterName || "A user",
      role: role || "member",
      invite_link: inviteLink,
      app_name: "AI Workspace",
      year: new Date().getFullYear().toString(),
    };

    console.log("📧 Template params:", templateParams);

    const result = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      {
        publicKey: EMAILJS_PUBLIC_KEY,
        privateKey: EMAILJS_PRIVATE_KEY, // ← the fix
      },
    );

    console.log("✅ Email sent successfully:", result);
    res.json({ success: true, messageId: result.messageId || null });
  } catch (error) {
    console.error("❌ Detailed error:", {
      message: error.message,
      status: error.status || error.response?.status,
      text: error.text || error.response?.text,
      response: error.response?.data || error.response || "No response data",
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to send invitation email",
      details: error.message,
      status: error.status || error.response?.status || null,
      text: error.text || error.response?.text || null,
    });
  }
});

// ─── Resend invitation ──────────────────────────────────────────

app.post("/api/resend-invite", async (req, res) => {
  console.log("📧 /api/resend-invite called");

  try {
    const { toEmail, toName, spaceName, inviterName, role, inviteLink } =
      req.body;

    if (!EMAILJS_PRIVATE_KEY) {
      return res.status(500).json({
        error: "Server misconfigured: EMAILJS_PRIVATE_KEY is missing",
      });
    }

    const templateParams = {
      to_email: toEmail,
      to_name: toName || toEmail.split("@")[0],
      space_name: spaceName,
      inviter_name: inviterName || "A user",
      role: role || "member",
      invite_link: inviteLink,
      app_name: "AI Workspace",
      year: new Date().getFullYear().toString(),
    };

    const result = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      {
        publicKey: EMAILJS_PUBLIC_KEY,
        privateKey: EMAILJS_PRIVATE_KEY,
      },
    );

    console.log(`✅ Resent email to ${toEmail}`);
    res.json({ success: true, messageId: result.messageId || null });
  } catch (error) {
    console.error("❌ Error resending email:", error);
    res.status(500).json({
      error: "Failed to resend email",
      details: error.message,
    });
  }
});

// ─── Export for Vercel ──────────────────────────────────────────

module.exports = app;
