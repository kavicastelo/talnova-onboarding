import React, { useState, useRef } from 'react';
import { Upload, Link2, Check, AlertCircle, Loader2, X, Play, Music, Image as ImageIcon, Sparkles } from 'lucide-react';
import { uploadService } from '../../../../services/upload.service';

export interface MediaAssetPickerProps {
  mediaType: 'image' | 'video' | 'audio';
  currentUploadId?: string;
  currentEmbedUrl?: string;
  onAssetChange: (asset: { uploadId?: string; embedUrl?: string; fileName?: string }) => void;
  languageCode?: string;
  label?: string;
  helperText?: string;
}

/**
 * Normalizes cloud and third-party media URLs (YouTube, Google Drive, Dropbox, Vimeo, Loom)
 * into direct embeddable streams or player frame links.
 */
export function normalizeCloudMediaUrl(
  rawUrl: string,
  mediaType: 'image' | 'video' | 'audio'
): { embedUrl: string; provider: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { embedUrl: '', provider: 'none' };

  // 1. YouTube (watch?v=, youtu.be/, shorts/, embed/)
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`,
      provider: 'youtube'
    };
  }

  // 2. Google Drive (drive.google.com/file/d/FILE_ID/view)
  const gdriveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (gdriveMatch && gdriveMatch[1]) {
    const fileId = gdriveMatch[1];
    if (mediaType === 'video' || mediaType === 'audio') {
      return {
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        provider: 'google-drive'
      };
    } else {
      return {
        embedUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
        provider: 'google-drive'
      };
    }
  }

  // 3. Dropbox (dropbox.com/s/..., dl=0 -> raw=1 for streamable direct content)
  if (trimmed.includes('dropbox.com')) {
    let normalized = trimmed.replace(/\?dl=0/g, '?raw=1').replace(/&dl=0/g, '&raw=1');
    if (!normalized.includes('raw=1')) {
      normalized += (normalized.includes('?') ? '&' : '?') + 'raw=1';
    }
    return {
      embedUrl: normalized,
      provider: 'dropbox'
    };
  }

  // 4. Vimeo (vimeo.com/VIDEO_ID)
  const vimeoMatch = trimmed.match(
    /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/i
  );
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}?dnt=1`,
      provider: 'vimeo'
    };
  }

  // 5. Loom (loom.com/share/ID -> loom.com/embed/ID)
  const loomMatch = trimmed.match(/loom\.com\/share\/([a-zA-Z0-9_-]+)/i);
  if (loomMatch && loomMatch[1]) {
    return {
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
      provider: 'loom'
    };
  }

  return {
    embedUrl: trimmed,
    provider: 'direct'
  };
}

export const MediaAssetPicker: React.FC<MediaAssetPickerProps> = ({
  mediaType,
  currentUploadId,
  currentEmbedUrl,
  onAssetChange,
  languageCode = 'en',
  label,
  helperText
}) => {
  const [activeMode, setActiveMode] = useState<'upload' | 'cloud' | 'url'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cloudInput, setCloudInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMediaUrl = currentEmbedUrl || (currentUploadId ? `/api/v1/kiosk/uploads/${currentUploadId}` : '');

  const acceptMime =
    mediaType === 'image'
      ? 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif'
      : mediaType === 'video'
        ? 'video/mp4,video/webm,video/quicktime'
        : 'audio/mpeg,audio/wav,audio/aac,audio/ogg,audio/m4a';

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      const result = await uploadService.uploadFile(file, 'public', (percent) => {
        setUploadProgress(percent);
      });
      onAssetChange({
        uploadId: result.uploadId,
        embedUrl: result.url,
        fileName: file.name
      });
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload media file. Ensure it is under 100MB.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleApplyCloudUrl = () => {
    if (!cloudInput.trim()) return;
    const { embedUrl } = normalizeCloudMediaUrl(cloudInput, mediaType);
    onAssetChange({
      embedUrl,
      uploadId: undefined,
      fileName: cloudInput.trim().split('/').pop() || 'Cloud Media'
    });
    setCloudInput('');
  };

  const handleClearAsset = () => {
    onAssetChange({
      uploadId: undefined,
      embedUrl: undefined,
      fileName: undefined
    });
  };

  const isEmbedIframe =
    activeMediaUrl.includes('youtube') ||
    activeMediaUrl.includes('drive.google.com') ||
    activeMediaUrl.includes('vimeo.com') ||
    activeMediaUrl.includes('loom.com');

  return (
    <div className="space-y-3 rounded-xl border border-slate-900 bg-slate-950/70 p-3.5 text-xs text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="font-bold text-slate-300 flex items-center space-x-1.5 uppercase text-[10px] tracking-wider">
            {mediaType === 'image' && <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />}
            {mediaType === 'video' && <Play className="w-3.5 h-3.5 text-blue-400" />}
            {mediaType === 'audio' && <Music className="w-3.5 h-3.5 text-purple-400" />}
            <span>{label || `${mediaType.toUpperCase()} Asset (${languageCode.toUpperCase()})`}</span>
          </label>
          {helperText && <p className="text-[10px] text-slate-500 mt-0.5">{helperText}</p>}
        </div>
        {activeMediaUrl && (
          <button
            type="button"
            onClick={handleClearAsset}
            className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center space-x-1 transition"
          >
            <X className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 text-[10px] font-semibold">
        <button
          type="button"
          onClick={() => setActiveMode('upload')}
          className={`py-1 rounded text-center transition flex items-center justify-center space-x-1 ${
            activeMode === 'upload' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-3 h-3" />
          <span>Upload File</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('cloud')}
          className={`py-1 rounded text-center transition flex items-center justify-center space-x-1 ${
            activeMode === 'cloud' ? 'bg-slate-800 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>Cloud Link</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('url')}
          className={`py-1 rounded text-center transition flex items-center justify-center space-x-1 ${
            activeMode === 'url' ? 'bg-slate-800 text-slate-200 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Link2 className="w-3 h-3" />
          <span>Direct URL</span>
        </button>
      </div>

      {/* MODE 1: Local File Drag & Drop Upload */}
      {activeMode === 'upload' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition flex flex-col items-center justify-center space-y-2 ${
            isDragOver
              ? 'border-emerald-500 bg-emerald-950/20'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptMime}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          {isUploading ? (
            <div className="space-y-2 py-2 flex flex-col items-center">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs text-slate-300 font-semibold">Uploading to Cloud Storage... {uploadProgress}%</span>
              <div className="w-48 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="p-2.5 rounded-full bg-slate-800/80 text-emerald-400 border border-slate-700">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-300">
                  Click to browse or drag & drop {mediaType}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Direct upload to Cloudflare R2 / S3 storage (max 100MB)
                </p>
              </div>
            </>
          )}

          {uploadError && (
            <p className="text-[10px] text-rose-400 flex items-center space-x-1 mt-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{uploadError}</span>
            </p>
          )}
        </div>
      )}

      {/* MODE 2: Cloud Sharable Link Importer */}
      {activeMode === 'cloud' && (
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5">
            <input
              type="text"
              value={cloudInput}
              onChange={(e) => setCloudInput(e.target.value)}
              placeholder="Paste YouTube, Google Drive, Dropbox, Vimeo, or Loom link..."
              className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleApplyCloudUrl}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shrink-0"
            >
              Import
            </button>
          </div>
          <div className="flex flex-wrap gap-1 text-[9px] text-slate-400">
            <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-rose-400">YouTube</span>
            <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-emerald-400">Google Drive</span>
            <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-blue-400">Dropbox</span>
            <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-cyan-400">Vimeo</span>
            <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-purple-400">Loom</span>
          </div>
        </div>
      )}

      {/* MODE 3: Direct Storage / CDN URL */}
      {activeMode === 'url' && (
        <div className="space-y-1.5">
          <input
            type="text"
            value={currentEmbedUrl || ''}
            onChange={(e) => {
              onAssetChange({
                embedUrl: e.target.value,
                uploadId: currentUploadId
              });
            }}
            placeholder={`https://cdn.example.com/asset-${languageCode}.${mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'mp3'}`}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      )}

      {/* Active Media Live Preview */}
      {activeMediaUrl && (
        <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="font-mono truncate max-w-[240px]">
              {currentUploadId ? `ID: ${currentUploadId}` : activeMediaUrl}
            </span>
            <span className="font-semibold text-emerald-400 flex items-center space-x-1">
              <Check className="w-3 h-3" />
              <span>Loaded</span>
            </span>
          </div>

          <div className="rounded-lg overflow-hidden border border-slate-800 bg-black flex items-center justify-center max-h-40">
            {mediaType === 'image' && (
              <img
                src={activeMediaUrl}
                alt="Asset preview"
                className="max-h-40 w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            )}
            {mediaType === 'video' && (
              isEmbedIframe ? (
                <iframe
                  src={activeMediaUrl}
                  title="Video preview"
                  className="w-full h-36 border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={activeMediaUrl}
                  controls
                  className="max-h-40 w-full"
                />
              )
            )}
            {mediaType === 'audio' && (
              <div className="p-3 w-full">
                <audio src={activeMediaUrl} controls className="w-full h-8" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
