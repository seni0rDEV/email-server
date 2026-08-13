const express = require("express");
const cors = require("cors");
const emailjs = require("@emailjs/nodejs");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// EmailJS Configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || "service_gayry4q";
const EMAILJS_TEMPLATE_ID =
  process.env.EMAILJS_TEMPLATE_ID || "template_eny93jq";
const EMAILJS_PUBLIC_KEY =
  process.env.EMAILJS_PUBLIC_KEY || "412HK1g0tTHkggdGI";

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Email server is running!" });
});

// Send invitation email
app.post("/api/send-invite", async (req, res) => {
  try {
    const { toEmail, toName, spaceName, inviterName, role, inviteLink } =
      req.body;

    // Validate required fields
    if (!toEmail || !spaceName || !inviteLink) {
      return res.status(400).json({
        error:
          "Missing required fields: toEmail, spaceName, and inviteLink are required",
      });
    }

    // Send email using EmailJS
    const result = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_email: toEmail,
        to_name: toName || toEmail.split("@")[0],
        space_name: spaceName,
        inviter_name: inviterName || "A user",
        role: role || "member",
        invite_link: inviteLink,
        app_name: "AI Workspace",
        year: new Date().getFullYear().toString(),
      },
      {
        publicKey: EMAILJS_PUBLIC_KEY,
      },
    );

    console.log(`✅ Email sent to ${toEmail} for space ${spaceName}`);
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error("❌ Error sending email:", error);
    res.status(500).json({
      error: "Failed to send invitation email",
      details: error.message,
    });
  }
});

// Resend invitation email
app.post("/api/resend-invite", async (req, res) => {
  try {
    const { toEmail, toName, spaceName, inviterName, role, inviteLink } =
      req.body;

    const result = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_email: toEmail,
        to_name: toName || toEmail.split("@")[0],
        space_name: spaceName,
        inviter_name: inviterName || "A user",
        role: role || "member",
        invite_link: inviteLink,
        app_name: "AI Workspace",
        year: new Date().getFullYear().toString(),
      },
      {
        publicKey: EMAILJS_PUBLIC_KEY,
      },
    );

    console.log(`✅ Resent email to ${toEmail}`);
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error("❌ Error resending email:", error);
    res.status(500).json({
      error: "Failed to resend email",
      details: error.message,
    });
  }
});

// Export for Vercel
module.exports = app;
