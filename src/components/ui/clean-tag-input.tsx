"use client";

import { useMemo, useRef, useState, KeyboardEvent } from "react";
import { Label } from "@/src/components/ui/label";
import { cn } from "@/src/lib/utils";
import { X } from "lucide-react";

type CleanTagInputProps = {
  value?: string[];
  onChange?: (nextValues: string[]) => void;
  maxTags?: number;
  label?: string;
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
};

export default function CleanTagInput({
  value,
  onChange,
  maxTags = 10,
  label = "Détails du poste",
  placeholder = "Tapez puis appuyez sur Entrée",
  helperText = "Ajoutez jusqu'à 10 détails. Entrée pour ajouter, Backspace pour retirer le dernier.",
  disabled = false,
  className,
}: CleanTagInputProps) {
  const [internalTags, setInternalTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = useMemo<string[]>(() => {
    if (value) {
      return value;
    }

    return internalTags;
  }, [internalTags, value]);

  const syncTags = (nextValues: string[]) => {
    if (!value) {
      setInternalTags(nextValues);
    }

    onChange?.(nextValues);
  };

  const addTag = (text: string) => {
    const nextText = text.trim();

    if (!nextText || disabled) return;
    if (tags.length >= maxTags) return;
    if (tags.includes(nextText)) return;

    syncTags([...tags, nextText]);
    setInputValue("");
  };

  const removeTag = (text: string) => {
    if (disabled) return;

    syncTags(tags.filter((tag) => tag !== text));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "Enter") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && tags.length) {
      e.preventDefault();
      syncTags(tags.slice(0, -1));
    }
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      <Label className="text-sm font-normal text-black dark:text-white">
        {label}
      </Label>

      <div
        className={cn(
          "flex flex-wrap items-center gap-2 px-2 py-2 border rounded-lg focus-within:ring-2 focus-within:ring-black/30 dark:focus-within:ring-white/30",
          "border-gray-200 dark:border-gray-800 bg-transparent",
        )}
      >
        {tags.map((tag) => (
          <div
            key={tag}
            className="flex items-center gap-1 bg-transparent border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-1 text-sm text-black dark:text-white transition-colors hover:bg-black/10 dark:hover:bg-white/10"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white rounded-full p-0.5 transition-colors focus:outline-none"
              type="button"
              disabled={disabled}
            >
              <X className="w-3 h-3 ml-1" />
            </button>
          </div>
        ))}

        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 min-w-20 h-8 bg-transparent outline-none text-black dark:text-white text-sm px-2"
          disabled={disabled || tags.length >= maxTags}
        />
      </div>

      <p className="text-xs text-black/50 dark:text-white/50">{helperText}</p>
    </div>
  );
}
