/**
 * Available block types inside a kiosk step.
 */
export const KIOSK_BLOCK_TYPES = [
  "image",
  "illustration",
  "animation",
  "video",
  "audio",
  "icon",
  "text"
] as const;

/**
 * Supported video aspect ratios for kiosk layout configurations.
 */
export const KIOSK_VIDEO_ASPECT_RATIOS = ["landscape", "portrait"] as const;

/**
 * Available touch target sizing for icons.
 */
export const KIOSK_ICON_SIZES = ["small", "medium", "large", "oversized"] as const;

/**
 * Color semantic themes for warning and indicator icons.
 */
export const KIOSK_ICON_THEMES = ["mandatory", "warning", "danger", "info"] as const;

/**
 * Permitted text block sizes, keeping text small for accessibility limits.
 */
export const KIOSK_TEXT_SIZES = ["small", "medium", "large"] as const;

/**
 * Maximum content blocks per individual slide.
 */
export const MAX_BLOCKS_PER_STEP = 10;

/**
 * Maximum media asset size in megabytes allowed for upload.
 */
export const MAX_MEDIA_SIZE_MB = 50;
