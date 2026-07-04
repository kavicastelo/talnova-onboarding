import { BlockId, LanguageCode, UploadId } from "./common.types.js";
import {
  KIOSK_BLOCK_TYPES,
  KIOSK_VIDEO_ASPECT_RATIOS,
  KIOSK_ICON_SIZES,
  KIOSK_ICON_THEMES,
  KIOSK_TEXT_SIZES
} from "../constants/block.constants.js";

export type KioskBlockType = typeof KIOSK_BLOCK_TYPES[number];

export interface LocalizedMediaReference {
  readonly uploadId?: UploadId;
  readonly textValue?: string; // Fallback text / subtitles / captions
  readonly audioUploadId?: UploadId; // Optional language-specific audio narration
  readonly embedUrl?: string; // Optional external resource embed URL
}

export interface BaseKioskBlock {
  readonly id: BlockId;
  readonly type: KioskBlockType;
  readonly order: number;
  readonly mediaReferences: Readonly<Record<LanguageCode, LocalizedMediaReference>>;
}

export interface ImageBlock extends BaseKioskBlock {
  readonly type: "image";
  readonly settings: {
    readonly zoomable: boolean;
    readonly contrastMode?: boolean;
  };
}

export interface IllustrationBlock extends BaseKioskBlock {
  readonly type: "illustration";
  readonly settings: {
    readonly contrastMode?: boolean;
  };
}

export interface AnimationBlock extends BaseKioskBlock {
  readonly type: "animation";
  readonly settings: {
    readonly autoplay: boolean;
    readonly loop: boolean;
  };
}

export interface VideoBlock extends BaseKioskBlock {
  readonly type: "video";
  readonly settings: {
    readonly autoplay: boolean;
    readonly loop: boolean;
    readonly aspect: typeof KIOSK_VIDEO_ASPECT_RATIOS[number];
  };
}

export interface AudioBlock extends BaseKioskBlock {
  readonly type: "audio";
  readonly settings: {
    readonly autoplay: boolean;
    readonly loop: boolean;
    readonly controls: boolean;
  };
}

export interface IconBlock extends BaseKioskBlock {
  readonly type: "icon";
  readonly settings: {
    readonly iconName: string; // Safety icon identifier (e.g. "wear_glasses", "warning_voltage")
    readonly size: typeof KIOSK_ICON_SIZES[number];
    readonly theme: typeof KIOSK_ICON_THEMES[number];
  };
}

export interface TextBlock extends BaseKioskBlock {
  readonly type: "text";
  readonly settings: {
    readonly size: typeof KIOSK_TEXT_SIZES[number];
    readonly contrastMode?: boolean;
  };
}

export type KioskBlock =
  | ImageBlock
  | IllustrationBlock
  | AnimationBlock
  | VideoBlock
  | AudioBlock
  | IconBlock
  | TextBlock;
