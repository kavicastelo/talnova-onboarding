# Talnova Onboarding

# 09 — File Storage & Media Management

**Version:** 1.0.0

**Status:** Production Architecture

---

# Purpose

This document defines the official file storage architecture for the Talnova Onboarding platform.

It specifies:

* File upload process
* Cloudflare R2 integration
* Storage structure
* Validation
* Security
* Access control
* Metadata management
* File lifecycle
* Future media processing

All uploaded files must follow this specification.

---

# Storage Philosophy

Talnova separates application data from binary files.

Application data is stored in MongoDB Atlas.

Binary files are stored in Cloudflare R2.

The backend stores only metadata and object references.

Binary content must never be stored inside MongoDB.

---

# Storage Provider

Official storage provider

Cloudflare R2

Responsibilities

* Images
* Videos
* Audio
* PDFs
* Microsoft Office documents
* Employee avatars
* Organization logos
* Course thumbnails
* Certificates
* Other learning materials

Future storage providers may be added through the Storage Service abstraction.

---

# Storage Architecture

```text
Browser

↓

Fastify Upload Endpoint

↓

Validation

↓

Storage Service

↓

Cloudflare R2

↓

MongoDB Metadata

↓

API Response
```

Only the shared Storage Service communicates with Cloudflare R2.

Business modules must never access R2 directly.

---

# Upload Workflow

Every upload follows this sequence.

```text
Client

↓

Authentication

↓

Authorization

↓

Multipart Validation

↓

File Validation

↓

Virus Scan (Future)

↓

Generate Object Key

↓

Upload to Cloudflare R2

↓

Store Metadata

↓

Return Upload Result
```

The upload is considered successful only after both R2 and MongoDB operations complete successfully.

---

# Supported File Types

Images

* JPEG
* PNG
* WebP
* SVG

Videos

* MP4
* WebM
* MOV

Audio

* MP3
* WAV
* OGG
* AAC

Documents

* PDF
* DOCX
* XLSX
* PPTX

Text

* TXT
* Markdown

Compressed

* ZIP (future import/export only)

Unsupported file types must be rejected.

---

# Maximum File Sizes

| Type     | Maximum Size |
| -------- | ------------ |
| Avatar   | 5 MB         |
| Logo     | 10 MB        |
| Image    | 20 MB        |
| PDF      | 50 MB        |
| Document | 50 MB        |
| Audio    | 100 MB       |
| Video    | 500 MB       |

These limits remain configurable through environment variables.

---

# Object Key Structure

Files are organized by organization and resource type.

Example

```text
organizations/

    {organizationId}/

        avatars/

        logos/

        journeys/

            {journeyId}/

                thumbnails/

                lessons/

                    {lessonId}/

                        video.mp4

                        handbook.pdf

                        audio.mp3
```

Object keys should never expose user email addresses or other sensitive information.

---

# File Metadata

MongoDB stores only metadata.

Example

```json
{
  "_id": "...",
  "organizationId": "...",
  "uploadedBy": "...",
  "resourceType": "lesson",
  "resourceId": "...",
  "fileName": "handbook.pdf",
  "objectKey": "...",
  "publicUrl": "...",
  "mimeType": "application/pdf",
  "size": 1257342,
  "checksum": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

The binary file is stored only in Cloudflare R2.

---

# Access Control

Every file belongs to an organization.

Access requires:

* Authentication
* Organization validation
* Resource permission validation

Users must never access files belonging to another organization.

---

# Public vs Private Files

Public files

* Company logos
* Public thumbnails

Private files

* Videos
* PDFs
* Audio
* Internal onboarding documents
* Certificates
* Employee uploads

Private objects should be accessed through signed URLs (future) or authenticated proxy endpoints.

---

# Upload Validation

Every upload validates:

* Authentication
* Authorization
* MIME type
* File extension
* File size
* Filename
* Duplicate detection (future)

Validation occurs before upload.

---

# File Naming

Original filenames are preserved only for display.

Storage object names use generated identifiers.

Example

```text
lesson-introduction.mp4
```

Stored as

```text
7fbbfa7b-96d1-43d4-a7fa-4e7e48cfc9d8.mp4
```

Generated names prevent collisions.

---

# Image Processing

Initial version

No automatic processing.

Future

* Resize
* Compression
* Thumbnail generation
* Format conversion

Processing should occur asynchronously.

---

# Video Processing

Initial version

Store original file only.

Future

* Multiple resolutions
* Streaming optimization
* Preview thumbnails
* Adaptive bitrate encoding

Video processing must never block uploads.

---

# Temporary Uploads

Uploads exist temporarily until successfully stored.

Temporary files must be deleted immediately after upload completion or failure.

No permanent uploads should remain on the EC2 filesystem.

---

# Deletion Strategy

Deleting a file requires:

1. Authorization
2. Delete object from Cloudflare R2
3. Delete metadata from MongoDB
4. Write audit log

Soft deletion may be introduced for selected resources.

---

# File Replacement

Replacing an existing file:

1. Upload new object
2. Update metadata
3. Delete previous object
4. Record audit event

This minimizes broken references.

---

# Download Strategy

Large files should be streamed.

The backend should avoid loading entire files into memory.

Streaming reduces memory usage and improves scalability.

---

# CDN Strategy

Cloudflare R2 public URLs may be served through a CDN.

Benefits

* Lower latency
* Reduced EC2 bandwidth
* Global distribution
* Improved performance

CDN configuration should remain transparent to application modules.

---

# Security Rules

Uploads must:

* Validate MIME type
* Validate file extension
* Validate maximum size
* Reject executable files
* Reject unsupported formats

Future enhancements

* Virus scanning
* Malware detection
* Content moderation

---

# Storage Service Responsibilities

The shared Storage Service is responsible for:

* Uploading files
* Downloading files
* Deleting files
* Generating object keys
* Metadata persistence
* Signed URL generation (future)
* Validation support

No feature module may communicate with Cloudflare R2 directly.

---

# Environment Variables

```env
R2_ENDPOINT=

R2_BUCKET=

R2_ACCESS_KEY=

R2_SECRET_KEY=

R2_PUBLIC_URL=

MAX_UPLOAD_SIZE=

UPLOAD_TEMP_DIRECTORY=
```

Secrets must never be committed to source control.

---

# Performance Guidelines

* Stream large uploads.
* Stream large downloads.
* Avoid loading entire files into memory.
* Upload directly to Cloudflare R2 after validation.
* Store metadata only after successful upload.
* Keep upload endpoints stateless.

---

# Backup Strategy

Cloudflare R2 is the source of truth for binary files.

MongoDB stores metadata only.

Object metadata and object storage must remain synchronized.

Regular verification jobs may be introduced in the future.

---

# Audit Logging

The following events should be recorded:

* Upload
* Download (future)
* Replacement
* Deletion
* Failed upload
* Permission denial

Audit logs should include:

* User ID
* Organization ID
* Resource ID
* File ID
* Timestamp
* IP Address
* Request ID

---

# Future Enhancements

Planned capabilities include:

* Signed download URLs
* Signed upload URLs
* Direct browser uploads
* Chunked uploads
* Resumable uploads
* Virus scanning
* Image optimization
* Video transcoding
* File versioning
* Storage quotas
* Lifecycle policies
* Multi-region replication

These enhancements should integrate through the Storage Service without changing business modules.

---

# AI Development Rules

AI coding agents contributing to file storage features must follow these rules:

* Use only the shared Storage Service for all file operations.
* Never interact with Cloudflare R2 directly from feature modules.
* Never store binary data in MongoDB.
* Always validate uploads before storage.
* Stream large files instead of buffering them entirely.
* Generate unique object keys for storage.
* Record metadata only after successful uploads.
* Enforce organization-level access control for every file.
* Keep storage implementation provider-agnostic through the Storage Service abstraction.

This document defines the canonical file storage and media management architecture for the Talnova Onboarding platform.
