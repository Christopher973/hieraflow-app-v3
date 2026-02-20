import { useState, useRef } from "react";

interface UseFileInputOptions {
  accept?: string;
  maxSize?: number;
}

export function useFileInput({ accept, maxSize }: UseFileInputOptions) {
  const [fileName, setFileName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileSize, setFileSize] = useState<number>(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file: File | undefined) => {
    setError("");

    if (file) {
      if (maxSize && file.size > maxSize * 1024 * 1024) {
        setError(`File size must be less than ${maxSize}MB`);
        return;
      }

      if (accept) {
        const acceptList = accept
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

        const matches = acceptList.some((item) => {
          if (item.startsWith(".")) {
            return file.name.toLowerCase().endsWith(item.toLowerCase());
          }

          if (item.endsWith("/*")) {
            return file.type.startsWith(item.slice(0, -1));
          }

          return file.type === item;
        });

        if (!matches) {
          setError(`File type must be ${accept}`);
          return;
        }
      }

      setFileSize(file.size);
      setFileName(file.name);
      setFile(file);
    }
  };

  const clearFile = () => {
    setFileName("");
    setError("");
    setFileSize(0);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    fileName,
    file,
    error,
    fileInputRef,
    handleFileSelect,
    validateAndSetFile,
    clearFile,
    fileSize,
  };
}
