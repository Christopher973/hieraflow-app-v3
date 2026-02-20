import { useCallback, useEffect, useRef, useState } from "react";

interface UseImageUploadProps {
  onUpload?: (url: string) => void;
  onFileSelect?: (file: File | null) => void;
  initialPreviewUrl?: string | null;
  maxSizeBytes?: number;
  allowedMimeTypes?: readonly string[];
}

const DEFAULT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;

const isBlobUrl = (value: string | null) => Boolean(value?.startsWith("blob:"));

export function useImageUpload({
  onUpload,
  onFileSelect,
  initialPreviewUrl = null,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  allowedMimeTypes = DEFAULT_ALLOWED_MIME_TYPES,
}: UseImageUploadProps = {}) {
  const previewRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialPreviewUrl,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setPreviewFromSource = useCallback((url: string | null) => {
    if (previewRef.current && isBlobUrl(previewRef.current)) {
      URL.revokeObjectURL(previewRef.current);
    }

    previewRef.current = isBlobUrl(url) ? url : null;
    setPreviewUrl(url);
  }, []);

  const handleThumbnailClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearSelection = useCallback(() => {
    setFile(null);
    setFileName(null);
    setError(null);
    onFileSelect?.(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onFileSelect]);

  const setInitialPreview = useCallback(
    (url: string | null) => {
      clearSelection();
      setPreviewFromSource(url);
    },
    [clearSelection, setPreviewFromSource],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      if (file.size > maxSizeBytes) {
        setError(
          `L'image ne doit pas dépasser ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`,
        );
        return;
      }

      if (!allowedMimeTypes.includes(file.type)) {
        setError("Format d'image non supporté (jpeg, png, webp, gif).");
        return;
      }

      setError(null);
      setFileName(file.name);
      setFile(file);
      onFileSelect?.(file);

      const url = URL.createObjectURL(file);
      setPreviewFromSource(url);
      onUpload?.(url);
    },
    [
      allowedMimeTypes,
      maxSizeBytes,
      onFileSelect,
      onUpload,
      setPreviewFromSource,
    ],
  );

  const handleRemove = useCallback(() => {
    clearSelection();
    setPreviewFromSource(null);
  }, [clearSelection, setPreviewFromSource]);

  const reset = useCallback(
    (url: string | null = null) => {
      clearSelection();
      setPreviewFromSource(url);
    },
    [clearSelection, setPreviewFromSource],
  );

  useEffect(() => {
    return () => {
      if (previewRef.current && isBlobUrl(previewRef.current)) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  return {
    previewUrl,
    fileName,
    file,
    error,
    fileInputRef,
    handleThumbnailClick,
    handleFileChange,
    handleRemove,
    setInitialPreview,
    reset,
  };
}
