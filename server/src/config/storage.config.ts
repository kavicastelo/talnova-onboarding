import { storageConfig } from "./index.js";

/**
 * Immutable allowlist of approved safe file extensions
 */
export const SAFE_EXTENSIONS = {
  documents: ["pdf", "docx", "xlsx", "pptx", "csv", "txt"] as const,
  images: ["png", "jpg", "jpeg", "webp"] as const, // svg strictly excluded
  videos: ["mp4", "webm", "mov"] as const,
  audio: ["mp3", "wav", "m4a"] as const,
} as const;

export const ALL_SAFE_EXTENSIONS = new Set<string>([
  ...SAFE_EXTENSIONS.documents,
  ...SAFE_EXTENSIONS.images,
  ...SAFE_EXTENSIONS.videos,
  ...SAFE_EXTENSIONS.audio,
]);

/**
 * Blacklist of prohibited executable, script, and dangerous extensions
 */
export const DANGEROUS_EXTENSIONS = new Set<string>([
  "exe", "sh", "bat", "js", "vbs", "php", "py", "html", "htm",
  "cmd", "msi", "scr", "pif", "com", "jar", "apk", "bin", "cgi",
  "pl", "ps1", "vbe", "wsf", "wsh", "svg"
]);

/**
 * Allowlist of valid MIME types corresponding to safe file extensions
 */
export const ALLOWED_MIME_TYPES = new Set<string>([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/csv",
  // Images (excluding svg)
  "image/png",
  "image/jpeg",
  "image/webp",
  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // Audio
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/webm",
]);

/**
 * Presigned URL TTL clamped to 5 minutes (300 seconds)
 */
export const PRESIGNED_URL_TTL_SECONDS = 300;

/**
 * Validates a filename against dangerous extensions, double extensions, and the safe allowlist.
 */
export function validateFileName(fileName: string): { isValid: boolean; error?: string; extension: string } {
  if (!fileName || typeof fileName !== "string") {
    return { isValid: false, error: "File name is required", extension: "" };
  }

  const cleanName = fileName.trim().toLowerCase();

  // Check for path traversal or null byte injection
  if (/[\0\r\n\t]/.test(cleanName) || cleanName.includes("/") || cleanName.includes("\\")) {
    return { isValid: false, error: "File name contains invalid path traversal characters", extension: "" };
  }

  const parts = cleanName.split(".");
  if (parts.length < 2) {
    return { isValid: false, error: "File name must include a valid extension", extension: "" };
  }

  const finalExtension = parts[parts.length - 1];

  // 1. Strictly reject executable and script extensions
  if (DANGEROUS_EXTENSIONS.has(finalExtension)) {
    return {
      isValid: false,
      error: `Files with executable or script extension (.${finalExtension}) are strictly prohibited`,
      extension: finalExtension,
    };
  }

  // 2. Reject double extensions (e.g. document.pdf.exe, invoice.docx.pdf, test.exe.jpg)
  if (parts.length > 2) {
    const intermediateExtensions = parts.slice(1, -1);
    for (const part of intermediateExtensions) {
      if (ALL_SAFE_EXTENSIONS.has(part) || DANGEROUS_EXTENSIONS.has(part)) {
        return {
          isValid: false,
          error: `Double extensions are prohibited for security reasons (detected .${part}.${finalExtension})`,
          extension: finalExtension,
        };
      }
    }
  }

  // 3. Immutable allowlist verification
  if (!ALL_SAFE_EXTENSIONS.has(finalExtension)) {
    return {
      isValid: false,
      error: `File extension .${finalExtension} is not permitted. Only approved documents, images, video, and audio formats are allowed.`,
      extension: finalExtension,
    };
  }

  return { isValid: true, extension: finalExtension };
}

export { storageConfig };
export default storageConfig;
