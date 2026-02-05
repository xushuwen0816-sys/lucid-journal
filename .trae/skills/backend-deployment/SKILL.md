---
name: "backend-deployment"
description: "Expert guidance on deploying Node.js/Prisma/Postgres apps to Serverless platforms (Railway/Vercel). Invoke when deploying backend, troubleshooting DB connections, or handling serverless timeouts."
---

# Backend Deployment Expert (Railway + Supabase + Prisma)

This skill encapsulates the hard-earned lessons from deploying a Node.js/Express + Prisma + Supabase stack to Railway.

## 1. Database Connection (The "Hanging" Issue)

**Context:** Serverless environments (Railway, Vercel) + Prisma + Supabase.

*   **Problem:** Connection hangs indefinitely, timeouts, no error logs.
*   **Cause:** Supabase Transaction Pooler (Port 6543) is often incompatible with Prisma in serverless environments due to prepared statements handling.
*   **Solution (Golden Rule):**
    *   **Always use the Session Pooler (Port 5432).**
    *   **Use the Pooler Domain** (e.g., `aws-0-ap-southeast-1.pooler.supabase.com`), NOT the direct DB domain.
    *   **IPv4 Compatibility:** Railway only supports IPv4. Supabase Direct Connection is IPv6-only. The Pooler Domain bridges this gap.

**Connection String Format:**
```
postgresql://[user]:[password]@[region].pooler.supabase.com:5432/postgres
```
*Do NOT use `?pgbouncer=true` if using port 5432 Session mode.*

## 2. Deployment Lifecycle & 502 Errors

**Context:** Railway "Start Command" vs "Build Command".

*   **Problem:** 502 Bad Gateway / Application failed to respond.
*   **Cause:** Putting `prisma db push` or `prisma migrate deploy` in the `Start Command` (e.g., `npm start`).
    *   Railway expects the app to bind the port immediately.
    *   Database operations take time.
    *   Railway assumes the app is stuck and kills it.
*   **Solution:**
    *   **Separate Concerns:** Move DB operations to the **Build Command**.
    *   **Railway Build Command:** `npm install && npm run build && npx prisma db push --accept-data-loss`
    *   **Railway Start Command:** `npm start` (Purely starts the server).
    *   **Procfile:** Create a `Procfile` (`web: npm start`) to strictly enforce the start behavior.

## 3. Prisma & Migrations

*   **Development:** Use `prisma migrate dev` to create history.
*   **Rapid Prototyping / Initial Deploy:** Use `prisma db push`.
    *   It's faster.
    *   It bypasses migration history conflicts (`P3019` error).
    *   Use `--accept-data-loss` if you are okay with resetting data during early dev.
*   **Production:** Eventually move to `prisma migrate deploy`, but ensure migration history is consistent.

## 4. Network & Security

*   **Port Binding:** Always bind to `0.0.0.0`, not `localhost`.
    ```typescript
    app.listen(PORT, '0.0.0.0', () => ...);
    ```
*   **CORS:** In production, ensure CORS headers match the frontend domain.
    *   For debugging: `origin: '*'` is acceptable temporarily.
*   **Health Check:** ALWAYS implement a `/health` endpoint.
    ```typescript
    app.get('/health', (req, res) => res.json({status: 'ok'}));
    ```
    This is the first thing to check when "it's not working".

## 5. Debugging Checklist

1.  **Check Logs:** Railway -> Deployments -> View Logs.
2.  **Verify Commit:** Is the latest code actually running? (Check Commit SHA).
3.  **Frontend Error UI:** Don't just say "Failed". Show `err.message` AND the `request.url` in the UI.
    *   Helps distinguish between "Wrong URL" (404) and "Server Error" (500).
