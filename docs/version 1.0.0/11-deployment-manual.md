# Talnova Onboarding SaaS Platform - Production Deployment Manual

This guide describes how to provision, run, and scale the Talnova Onboarding system in a production-grade enterprise environment.

---

## 1. Environment Configurations

All application configuration is driven by standard environment variables. You must supply these variables inside the running process or via a secure `.env` file in the application directory.

### Backend Configurations (`server/.env`)

```ini
# Core Server Configuration
PORT=8080
HOST=0.0.0.0
NODE_ENV=production
APP_URL=https://app.talnova.com

# Database Connection (MongoDB Atlas)
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/Talnova-Onboarding?retryWrites=true&w=majority

# JWT Token Secret Keys (Use high-entropy cryptographically strong strings)
JWT_SECRET=super-secret-high-entropy-jwt-signing-key-minimum-32-chars

# Cloudflare R2 / AWS S3 Compatible Media Storage
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET=talnova-production-media
R2_ACCESS_KEY_ID=r2-access-key-id-placeholder
R2_SECRET_ACCESS_KEY=r2-secret-access-key-placeholder
R2_PUBLIC_URL=https://media.talnova.com

# Production SMTP Mail Client Configuration
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@mg.talnova.com
SMTP_PASS=smtp-password-placeholder
EMAIL_FROM=Talnova Onboarding <no-reply@talnova.com>
```

---

## 2. Server Clustering and Scaling via PM2

To take advantage of multi-core servers, run the backend using **PM2** in `cluster_mode`. The system includes a pre-configured `ecosystem.config.cjs` to handle process monitoring, memory monitoring, and CPU core utilization.

### Launching the Cluster

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Compile the TypeScript codebase:
   ```bash
   npm run build
   ```

3. Launch the PM2 application cluster:
   ```bash
   pm2 start ecosystem.config.cjs --env production
   ```

### Process Management Commands

* **List status of all instances:**
  ```bash
  pm2 status
  ```
* **Real-time CPU and Memory usage dashboard:**
  ```bash
  pm2 monit
  ```
* **Zero-downtime reload (for rolling updates):**
  ```bash
  pm2 reload all
  ```
* **View consolidated cluster logs:**
  ```bash
  pm2 logs
  ```

---

## 3. High Availability & Security Infrastructure

### Global Rate Limiting
The Fastify server is backed by `@fastify/rate-limit`. 
* **Policy:** Under normal operating conditions, any single client IP address is restricted to **100 requests per minute**.
* **Handling:** Exceeding this limit returns a `429 Too Many Requests` status code with a JSON payload:
  ```json
  {
    "success": false,
    "message": "Too many requests.",
    "error": {
      "code": "RATE_LIMIT_EXCEEDED"
    }
  }
  ```

### Payloads and Headers Compression
Responses matching dynamic assets (HTML, JSON, CSS, JS) are compressed using Brotli or Gzip dynamically via `@fastify/compress` to reduce load times and network egress.

---

## 4. Tenant Suspension Lifecycle

If a tenant organization is suspended by a Super Admin:
1. All active JWT sessions associated with that organization are immediately rejected by the global `authenticate` hook with a `403 Forbidden` response.
2. New login attempts or refresh token rotations for users belonging to that organization are blocked.
3. Access is only restored when the organization status is updated back to `Active` via the database or Super Admin panel.

---

## 5. API Reference & Swagger Documentation

The platform comes equipped with dynamic OpenAPI v3 documentation powered by `@fastify/swagger` and `@fastify/swagger-ui`.

* **Endpoint UI:** `/documentation`
* **Accessing Locally:** Start the dev server and visit `http://localhost:8080/documentation`
* **JSON Schema Spec:** Visit `/documentation/json` for the raw OpenAPI definition to import into Postman, Insomnia, or other API clients.

