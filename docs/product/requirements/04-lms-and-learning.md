# Requirement Specification 04 — LMS & Learning Engine

> **Capability Namespace:** `lms_learning`  
> **Requirement Standard:** IEEE 830 / ISO 29148 Standard Specification Language  
> **Target Application:** Talnova Onboarding Platform

---

## 1. Functional Requirements

### REQ-LMS-001: Course & Module Authoring
* **Description:** The system shall enable administrators to build reusable courses composed of ordered modules and lessons.
* **Specification:**
  * Courses shall support metadata attributes: `title`, `description`, `estimatedMinutes`, `isPublished`.
  * Modules and lessons shall maintain explicit `orderIndex` properties for linear or gated consumption.

### REQ-LMS-002: Lesson Delivery & Content Block Streaming
* **Description:** The system shall deliver lessons composed of rich text, video, audio, and PDF content blocks.
* **Specification:**
  * Mandatory video content blocks shall require at least 90% view duration completion before marking the lesson as completed.
  * Lesson progress state shall be saved continuously for resume capabilities across devices.

### REQ-LMS-003: Assessment & Quiz Evaluation
* **Description:** The system shall administer quizzes and evaluate passing thresholds.
* **Specification:**
  * Quizzes shall require a configurable score (default: 80%) to pass.
  * The system shall enforce `maxAttempts` limits and record quiz attempt metrics for manager oversight.
