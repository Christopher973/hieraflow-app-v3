"use client";

import { SignUpForm } from "@/src/components/auth/sign-up-form";
import { Button } from "@/src/components/ui/button";
import { signUp } from "@/src/lib/auth-client";
import { CircleX, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleSignUp(data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) {
    setLoading(true);

    await signUp.email(
      {
        name: data.name,
        email: data.email,
        password: data.password,
        callbackURL: "/verify-email/success",
      },
      {
        onSuccess: () => {
          router.push("/verify-email");
          router.refresh();
        },
        onError: (error) => {
          console.error("Sign Up error:", error);

          if (error.error.status === 422) {
            toast.custom((t) => (
              <div className="w-full rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-foreground shadow-lg sm:w-var(--width)">
                <div className="flex gap-2">
                  <div className="flex grow gap-3">
                    <CircleX
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-red-500"
                      size={16}
                    />
                    <div className="flex grow flex-col gap-1">
                      <p className="text-sm font-medium">
                        Inscription impossible
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Un compte avec cette adresse email existe déjà. Veuillez
                        utiliser une autre adresse email ou vous connecter si
                        vous avez déjà un compte.
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
            return;
          }
          // Message d'erreur général pour toutes les autres erreurs
          toast.custom((t) => (
            <div className="w-full rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-foreground shadow-lg sm:w-var(--width)">
              <div className="flex gap-2">
                <div className="flex grow gap-3">
                  <CircleX
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-red-500"
                    size={16}
                  />
                  <div className="flex grow flex-col gap-1">
                    <p className="text-sm font-medium">
                      Inscription impossible
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Une erreur innatendue s'est produite lors de votre
                      inscription. Veuillez réessayer plus tard ou contacter le
                      support si le problème persiste.
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
        },
      },
    );

    setLoading(false);
  }

  return (
    <div className="bg-background text-foreground">
      <SignUpForm
        heroImageSrc="/images/signUp-pictogram.png"
        onSignUp={handleSignUp}
        loading={loading}
      />
    </div>
  );
}
