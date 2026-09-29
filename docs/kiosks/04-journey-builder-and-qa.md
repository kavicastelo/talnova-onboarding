# Kiosk Domain Chunk 04: Journey Builder & Quality Assurance

## 1. Domain Scope

This domain defines the administrative authoring environment (`KioskBuilder`), step types, interaction engines, content blocks, journey validation linter, and device simulation QA tools.

---

## 2. Step Types & Progression Engines

| Step Type | Description | Mandatory Interaction |
| :--- | :--- | :--- |
| `info_step` | General informational announcement with rich text and diagrams. | Tap "Next" or timer progression. |
| `image_step` | High-resolution visual guide, safety flowchart, or architectural map. | Pinch/zoom or tap to continue. |
| `video_step` | Video tutorial or safety demonstration reel. | Must watch to completion (or 90% threshold) before unlock. |
| `audio_step` | Spoken audio briefing with synchronized waveform visualizer. | Must listen to completion before progression. |
| `warning_step` | High-contrast visual hazard warning (OSHA Danger/Caution format). | 3-second mandatory dwell countdown before button unlocks. |
| `emergency_step` | Emergency evacuation, spill drill, or incident protocol. | Distinctive flashing border, high-priority audio alarm chime. |
| `interactive_confirmation` | Critical policy agreement requiring deliberate confirmation. | Touch and hold button for 3 seconds (`holdDurationMs: 3000`). |
| `ppe_checklist` | Physical Personal Protective Equipment verification. | Multi-select checkboxes for all mandatory gear (Hard hat, goggles, boots). |
| `knowledge_quiz` | Embedded comprehension gate. | Multiple choice questions; must achieve passing percentage (e.g., 80%). |
| `supervisor_gate` | Witness signing step. | Requires supervisor witness PIN or badge scan to unlock. |
| `completion` | Final exit screen; triggers certificate generation & privacy reset. | Displays completion badge and auto-resets after 10 seconds. |

---

## 3. Pre-Publish Validation Linter

Before a journey can transition from `draft` to `published`, the server executes automated structural validation:

1. **Step Count**: Must contain at least 1 content step and exactly 1 terminal completion step.
2. **Media Integrity**: Every image, video, and audio reference must resolve to a valid S3 upload object that exists and is accessible.
3. **Localization Completeness**: If a journey declares support for `['en', 'es', 'fr']`, every step title and primary text block must provide non-empty translations for all declared languages.
4. **Passing Thresholds**: If a quiz step exists, passing score must be between 50% and 100%.
5. **Supervisor Configuration**: If `supervisor_witness_required` is enabled, the organization must have at least one active user holding a manager or supervisor role.

---

## 4. Journey Simulation & Hardware Emulation

The builder provides an interactive simulation panel allowing authors to test journeys before publishing:
- **Aspect Ratio Emulators**: Test in 16:9 Landscape (standard terminal), 9:16 Portrait (vertical totem), and 4:3 Tablet.
- **Touch Simulation**: Emulate single-touch, multi-touch hold, and swipe gestures using mouse events.
- **Audio/Language Switching**: Live toggle between declared languages to verify text wrapping and audio narration alignment.
