"use client";

import { CircleX, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/src/components/ui/button";

type ShowErrorToastArgs = {
  title?: string;
  description: string;
};

export function showErrorToast({
  title = "Opération impossible",
  description,
}: ShowErrorToastArgs) {
  toast.custom((t) => (
    <div className="w-full rounded-md border border-red-200 bg-red-50 px-4 py-3 text-foreground shadow-lg dark:border-red-800 dark:bg-red-950/20 sm:w-var(--width)">
      <div className="flex gap-2">
        <div className="flex grow gap-3">
          <CircleX
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-red-500"
            size={16}
          />
          <div className="flex grow flex-col gap-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          aria-label="Close banner"
          className="group -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-transparent"
          onClick={() => toast.dismiss(t)}
          variant="ghost"
        >
          <XIcon
            aria-hidden="true"
            className="opacity-60 transition-opacity group-hover:opacity-100"
            size={16}
          />
        </Button>
      </div>
    </div>
  ));
}
