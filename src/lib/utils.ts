import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getNameFallback(name?: string | null) {
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return "??";
  }

  return trimmedName.slice(0, 2).toUpperCase();
}
