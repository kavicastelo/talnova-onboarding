# Kiosk Domain Chunk 11: Internationalization & Localization

## 1. Domain Scope

This domain covers multi-language support, Right-to-Left (RTL) layout switching, translation governance, localized audio narration, and locale-aware formatting.

---

## 2. Multi-Language Selection Flow

1. The terminal header displays a prominent Language Selector dropdown/modal with native language names (e.g., English, Español, Français, Deutsch, العربية, हिन्दी, 日本語).
2. Tapping a language instantly switches:
   - UI chrome and navigation labels (via `react-i18next`).
   - Journey title, description, and step instructions (resolved from `step.blocks[].settings.translations[lang]`).
   - Audio narration track to the corresponding language audio upload ID.
   - Text layout direction (`dir="ltr"` or `dir="rtl"`).

---

## 3. Right-to-Left (RTL) Layout Engine

For languages such as Arabic (`ar`), Hebrew (`he`), and Urdu (`ur`):
- Dynamic `dir="rtl"` applied to document body or player container.
- Horizontal layout inversion: "Next" button moves to left side; "Back" button moves to right side.
- Media elements and icons flip orientation where appropriate (e.g., progress arrows).

---

## 4. Translation Governance & Fallbacks

- If a journey does not provide translations for a selected language, the player gracefully falls back to the journey's default language (e.g., English).
- A subtle notification appears: *"Audio and instructions are displaying in the default language (English) as translation is unavailable for this briefing."*
- `KioskBuilder` highlights missing translation fields with amber warning badges before publishing.
