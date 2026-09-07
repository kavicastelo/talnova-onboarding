# Talnova Onboarding

# 03 — Deployment Architecture

**Version:** 1.0.0

**Status:** Production Architecture

---

# Purpose

This document defines the official deployment architecture for the Talnova Onboarding platform.

It specifies how the application is deployed, hosted, monitored, secured, and scaled in production.

The architecture prioritizes:

* Low operational complexity
* High reliability
* Cloud-native services
* Cost efficiency
* Easy maintenance
* Future scalability

This document is the authoritative reference for infrastructure decisions.

---

# Deployment Philosophy

Talnova follows a **thin application server** architecture.

The EC2 instance is responsible only for:

* Running the Fastify application
* Serving the frontend
* Reverse proxy
* SSL termination
* Process management

Persistent services are fully managed.

The application server should remain disposable.

No persistent application data is stored locally.

---

# Production Infrastructure

```text
                    Users
                      │
                HTTPS (443)
                      │
               Cloudflare DNS
                      │
                AWS EC2 Ubuntu
                      │
                  Nginx
          ┌───────────┴───────────┐
          │                       │
   React Production Build     Fastify API
     (Static Assets)          (Node.js 22)
                                      │
                    ┌─────────────────┼──────────────────┐
                    │                 │                  │
             MongoDB Atlas     Cloudflare R2      Redis (Future)
```

---

# Infrastructure Components

## Compute

Provider

AWS EC2

Operating System

Ubuntu 24.04 LTS (preferred)

Responsibilities

* Nginx
* PM2
* Node.js
* Frontend assets
* Fastify application

The EC2 instance must not host:

* MongoDB
* Object storage
* Email server

---

## Database

Provider

MongoDB Atlas

Responsibilities

* Application data
* User accounts
* Organizations
* Learning content
* Analytics
* Metadata

Backups are managed by Atlas.

No MongoDB installation should exist on the EC2 server.

---

## Object Storage

Provider

Cloudflare R2

Stores

* Images
* Videos
* Audio
* PDFs
* Office documents
* Employee avatars
* Company logos
* Course thumbnails
* Certificates

Only metadata is stored in MongoDB.

---

## Reverse Proxy

Nginx

Responsibilities

* HTTPS
* SSL termination
* Compression
* Static asset serving
* Reverse proxy
* Security headers
* Request forwarding

Nginx must never contain business logic.

---

## Process Management

PM2

Responsibilities

* Start application
* Restart on failure
* Automatic startup
* Graceful reload
* Log management
* Memory monitoring

Applications must never run using:

```bash
node server.js
```

PM2 is mandatory.

---

# Network Architecture

```text
Internet
    │
HTTPS 443
    │
Cloudflare
    │
AWS Security Group
    │
Nginx
    │
localhost:3000
Fastify
    │
MongoDB Atlas
Cloudflare R2
```

The Fastify application must never be exposed directly to the internet.

Only Nginx should receive external requests.

---

# Port Allocation

Recommended production ports

| Service     | Port            |
| ----------- | --------------- |
| HTTP        | 80              |
| HTTPS       | 443             |
| Fastify API | 3000            |
| React Build | Served by Nginx |

Ports should remain configurable through environment variables.

---

# Suggested Server Layout

```text
/var/www/

    talnova-client/

        dist/

    talnova-api/

        current/

        releases/

        shared/

            .env

            logs/

            uploads-temp/
```

Application releases should be isolated from shared configuration.

---

# Environment Variables

Application configuration must be stored outside the source code.

Example

```env
NODE_ENV=production

PORT=3000

API_PREFIX=/api/v1

MONGODB_URI=

JWT_SECRET=

JWT_REFRESH_SECRET=

R2_ENDPOINT=

R2_BUCKET=

R2_ACCESS_KEY=

R2_SECRET_KEY=

R2_PUBLIC_URL=

CORS_ORIGIN=

LOG_LEVEL=info
```

Environment files must never be committed to Git.

---

# SSL Strategy

HTTPS is mandatory.

Certificates should be managed through:

* Let's Encrypt
* Certbot

or

Cloudflare Origin Certificates

All HTTP traffic must redirect to HTTPS.

TLS versions older than 1.2 should be disabled.

---

# File Upload Flow

```text
Browser

↓

Fastify

↓

Validate

↓

Temporary Memory

↓

Cloudflare R2

↓

MongoDB Metadata

↓

Response URL
```

Files must never be permanently stored on the EC2 filesystem.

Temporary files should be removed immediately after upload.

---

# Logging

Application logs

Managed by PM2

Production format

JSON

Development

Pretty console output

Log files should rotate automatically.

---

# Backup Strategy

## MongoDB

Handled by MongoDB Atlas.

## Cloudflare R2

Versioning should be enabled when available.

## EC2

No application data requires backup.

Only:

* Environment files
* Nginx configuration
* PM2 configuration

should be backed up.

---

# Scaling Strategy

## Phase 1

Single EC2

Single PM2 process

Single Fastify instance

Suitable for:

* MVP
* Small organizations
* Early production

---

## Phase 2

Multiple PM2 cluster processes

Redis

Background workers

Improved monitoring

Suitable for:

* Hundreds of organizations

---

## Phase 3

Application Load Balancer

Multiple EC2 instances

Dedicated worker servers

Horizontal scaling

Suitable for:

* Enterprise deployments
* High availability

---

# Health Checks

Every deployment must expose

```text
GET /health
```

Returns application status.

---

```text
GET /ready
```

Returns readiness status.

---

```text
GET /live
```

Returns liveness status.

These endpoints should not require authentication.

---

# Deployment Pipeline

Deployment order

```text
Git Pull

↓

Install Dependencies

↓

Build

↓

Run Tests

↓

Type Check

↓

PM2 Reload

↓

Health Check

↓

Deployment Complete
```

Application restarts should use zero-downtime reload whenever possible.

---

# Monitoring

Minimum production monitoring

* PM2 process status
* CPU usage
* Memory usage
* Disk usage
* Nginx logs
* Fastify logs
* Application health endpoint

Future monitoring

* Uptime monitoring
* Error tracking
* Performance dashboards
* Request tracing
* Alerting

---

# Security Considerations

The EC2 instance should expose only:

* Port 80
* Port 443

SSH should be restricted to trusted IP addresses.

Fastify should listen only on localhost.

Database access should be limited to the EC2 instance through MongoDB Atlas network rules.

Cloudflare R2 credentials must never be exposed to the client.

---

# Disaster Recovery

If the EC2 instance fails:

1. Provision a new Ubuntu server.
2. Install Node.js, PM2, and Nginx.
3. Restore environment configuration.
4. Deploy the latest application release.
5. Reconnect to MongoDB Atlas.
6. Reconnect to Cloudflare R2.
7. Validate health endpoints.

Because all persistent data resides in managed cloud services, recovery should be rapid and require no local data restoration.

---

# Future Infrastructure Roadmap

The deployment architecture is intentionally designed to evolve without major refactoring.

Planned future enhancements include:

* Redis for caching and job queues.
* Dedicated worker processes for background tasks.
* Blue/Green deployments.
* CI/CD automation.
* Containerized deployments (Docker).
* Multi-instance scaling behind an AWS Application Load Balancer.
* Centralized log aggregation and observability.
* Automated infrastructure provisioning with Infrastructure as Code.

These improvements can be introduced incrementally while preserving the same application architecture and deployment model defined in this document.
