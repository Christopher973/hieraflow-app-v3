"use client";

import { ForgotPasswordForm } from "@/src/components/auth/forgot-password-form";
import { Button } from "@/src/components/ui/button";
import { requestPasswordReset } from "@/src/lib/auth-client";
import { CircleX, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleForgotPassword = async (data: { email: string }) => {
    setLoading(true);

    await requestPasswordReset(
      {
        email: data.email,
        redirectTo: "/reset-password",
      },
      {
        onSuccess: () => {
          router.push("forgot-password/success");
          router.refresh();
        },
        onError: (error) => {
          console.error("Error:", error);

          // Message d'erreur
          toast.custom((t) => (
            <div className="w-full rounded-md border bg-background px-4 py-3 text-foreground shadow-lg sm:w-var(--width)">
              <div className="flex gap-2">
                <div className="flex grow gap-3">
                  <CircleX
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-red-500"
                    size={16}
                  />
                  <div className="flex grow justify-between gap-12">
                    <p className="text-sm">
                      Un problème est survenu lors de l'envoi de l'email,
                      veuillez réesayer
                    </p>
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

          setLoading(false);
        },
      },
    );
  };

  return (
    <div className="bg-background text-foreground">
      <ForgotPasswordForm
        heroImageSrc="/images/forgotPassword-pictogram.png"
        onForgotPassword={handleForgotPassword}
        loading={loading}
      />
    </div>
  );
}
