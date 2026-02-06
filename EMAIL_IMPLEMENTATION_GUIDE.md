# Email Service Implementation Guide: From SMTP to Resend API

This document summarizes the challenges faced and the optimal solutions discovered while implementing email functionality on a Railway-deployed application. It serves as a guide for future projects to avoid common pitfalls.

## 🏆 Best Practice Solution (TL;DR)

**Do not use SMTP (Nodemailer) for production apps on modern PaaS (Railway, Vercel, AWS Lambda).**
Instead, **use an HTTP-based Email API** like Resend, SendGrid, or Postmark.

### Recommended Stack
- **Provider:** [Resend](https://resend.com) (Modern, developer-friendly, high deliverability).
- **Transport:** HTTP API (via `resend` SDK), NOT SMTP.
- **Verification:** Always verify your domain immediately.
- **Flow:** `App -> HTTP Request -> Resend API -> Email Network`.

---

## 🕳️ Pitfalls & Challenges (The "Why")

### 1. The "IPv6" Trap
- **Symptom:** `Error: connect ENETUNREACH 240d:c040:0:40::23:465`
- **Cause:** Many cloud environments (Railway, AWS) have complex IPv6 networking stacks. Node.js may prefer IPv6 resolution for domains like `smtp.qq.com`, but the route to the mail server might be broken or blocked.
- **Failed Fixes:** Forcing IPv4 via `dns.setDefaultResultOrder('ipv4first')` or manually resolving IPs often fails because the issue is frequently at the infrastructure/firewall level, not just DNS.

### 2. The "Cloud Firewall" Block
- **Symptom:** `Error: Connection timeout` (ETIMEDOUT) on ports 465/587.
- **Cause:** To prevent spam, many cloud providers (Railway, DigitalOcean, EC2, Vercel) **block outbound traffic on standard SMTP ports (25, 465, 587)** by default.
- **Reality Check:** No amount of code changes (increasing timeouts, switching ports) can bypass a firewall block. You *must* use a different protocol (HTTP).

### 3. The "Rate Limit" Crash
- **Symptom:** `429 Too Many Requests` when processing a backlog.
- **Cause:** Triggering email sends in a tight loop (e.g., `for (const letter of letters) await send()`) can overwhelm API rate limits (Resend Free Tier: 2 req/sec).
- **Fix:** Always implement throttling/delays between batch sends.

---

## 🛠️ Implementation Checklist (Future Projects)

### Phase 1: Setup
1.  **Register Domain:** Buy a domain (e.g., `myapp.com`).
2.  **Setup Resend:**
    *   Create account -> Add Domain (`email.myapp.com`).
    *   Add DNS records (MX, TXT, CNAME) to your DNS provider.
    *   Wait for verification (usually minutes).
3.  **Get API Key:** Generate a key in Resend dashboard.

### Phase 2: Code (Node.js/TypeScript)
Do not use `nodemailer` for API-based sending. Use the native SDK.

```typescript
import { Resend } from 'resend';

// 1. Initialize inside the function to ensure env vars are loaded
export const sendEmail = async (to: string, subject: string, html: string) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  // 2. Use a Verified Sender Identity
  // Format: "Name <anything@your-verified-domain.com>"
  const from = 'My App <noreply@email.myapp.com>';

  try {
    await resend.emails.send({
      from,
      to, // Can be any email once domain is verified
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('Email failed:', error);
    return false;
  }
}
```

### Phase 3: Infrastructure (Railway/Env)
1.  **Environment Variables:**
    *   `RESEND_API_KEY`: `re_123456...`
    *   `EMAIL_FROM`: `My App <noreply@email.myapp.com>`
2.  **Debugging:**
    *   Create a "Connectivity Check" endpoint (like we did with `/api/debug/env-check`) to verify env vars are loaded correctly in production.

### Phase 4: Batch Processing (Scheduler)
If sending multiple emails (e.g., cron job):
```typescript
for (const user of users) {
  await sendEmail(user.email, ...);
  // 3. Crucial: Add delay to respect rate limits
  await new Promise(r => setTimeout(r, 1000)); 
}
```

---

## 🐛 Debugging Toolkit (What Saved Us)

1.  **Connectivity Checker:** A simple endpoint that resolves DNS and tries to open a socket to the target host. It definitively proves if the network is blocked.
2.  **Force Trigger:** A manual endpoint (`/api/debug/force-send`) to bypass cron schedules and test immediately.
3.  **Backlog Clearer:** An endpoint to bulk-update status to "sent" to clear stuck queues without actually sending (saving API quota and time).

By following this guide, you will skip days of "Connection Timeout" debugging and go straight to a working email solution.
