import { z } from "zod";
import { ObjectIdSchema, LanguageCodeSchema } from "./common.schema.js";
import {
  KIOSK_VIDEO_ASPECT_RATIOS,
  KIOSK_ICON_SIZES,
  KIOSK_ICON_THEMES,
  KIOSK_TEXT_SIZES
} from "../constants/index.js";

/**
 * Media reference mapping for a single locale translation.
 */
export const LocalizedMediaReferenceSchema = z
  .object({
    uploadId: ObjectIdSchema.optional(),
    textValue: z.string().max(1000).optional(),
    audioUploadId: ObjectIdSchema.optional(),
    embedUrl: z.string().url().optional()
  })
  .strict()
  .describe("Localized asset and subtitle references");

/**
 * Shared base properties for all kiosk content block schemas.
 */
export const BaseKioskBlockSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
  mediaReferences: z.record(LanguageCodeSchema, LocalizedMediaReferenceSchema)
});

/**
 * Image block schema.
 */
export const ImageBlockSchema = BaseKioskBlockSchema.extend({
  type: z.literal("image"),
  settings: z
    .object({
      zoomable: z.boolean(),
      contrastMode: z.boolean().optional()
    })
    .strict()
})
  .strict()
  .describe("Image content block configuration");

/**
 * Illustration block schema.
 */
export const IllustrationBlockSchema = BaseKioskBlockSchema.extend({
  type: z.literal("illustration"),
  settings: z
    .object({
      contrastMode: z.boolean().optional()
    })
    .strict()
})
  .strict()
  .describe("Sleek vector/illustration display parameters");

/**
 * Lottie / vector animation block schema.
 */
export const AnimationBlockSchema = BaseKioskBlockSchema.extend({
  type: z.literal("animation"),
  settings: z
    .object({
      autoplay: z.boolean(),
      loop: z.boolean()
    })
    .strict()
})
  .strict()
  .describe("Vector Lottie/json animation block parameters");

/**
 * Video block schema.
 */
export const VideoBlockSchema = BaseKioskBlockSchema.extend({
  type: z.literal("video"),
  settings: z
    .object({
      autoplay: z.boolean(),
      loop: z.boolean(),
      aspect: z.enum(KIOSK_VIDEO_ASPECT_RATIOS)
    })
    .strict()
})
  .strict()
  .describe("Video player block parameter schema");

/**
 * Audio only narration block schema.
 */
export const AudioBlockSchema = BaseKioskBlockSchema.extend({
  type: z.literal("audio"),
  settings: z
    .object({
      autoplay: z.boolean(),
      loop: z.boolean(),
      controls: z.boolean()
    })
    .strict()
})
  .strict()
  .describe("Audio media block properties");

/**
 * Safety and warning icons.
 */
export const IconBlockSchema = BaseKioskBlockSchema.extend({
  type: z.literal("icon"),
  settings: z
    .object({
      iconName: z.string().min(1),
      size: z.enum(KIOSK_ICON_SIZES),
      theme: z.enum(KIOSK_ICON_THEMES)
    })
    .strict()
})
  .strict()
  .describe("Safety warning icon block layout parameters");

/**
 * Rich textual descriptors.
 */
export const TextBlockSchema = BaseKioskBlockSchema.extend({
  type: z.literal("text"),
  settings: z
    .object({
      size: z.enum(KIOSK_TEXT_SIZES),
      contrastMode: z.boolean().optional()
    })
    .strict()
})
  .strict()
  .describe("Dynamic text layout parameters");

/**
 * Discriminated union validator for all kiosk block types.
 */
export const KioskBlockSchema = z
  .discriminatedUnion("type", [
    ImageBlockSchema,
    IllustrationBlockSchema,
    AnimationBlockSchema,
    VideoBlockSchema,
    AudioBlockSchema,
    IconBlockSchema,
    TextBlockSchema
  ])
  .describe("Polymorphic kiosk content block validator");
