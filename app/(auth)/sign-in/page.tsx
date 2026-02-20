"use client";

import { SignInForm } from "@/src/components/auth/sign-in-form";
import { Button } from "@/src/components/ui/button";
import { signIn } from "@/src/lib/auth-client";
import { CircleX, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function SignInPage() {
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleSignIn(data: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) {
    setLoading(true);

    await signIn.email(
      {
        email: data.email,
        password: data.password,
        rememberMe: !!data.rememberMe,
      },
      {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
        onError: (error) => {
          console.error("Sign In error:", error);

          // Si les identifiants sont incorrects
          if (error.error.code === "BANNED_USER") {
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
                        Connexion impossible
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Votre compte a été désactivé. Si vous pensez qu'il
                        s'agit d'une erreur, veuillez contacter le support.
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

          // Si le compte n'est pas vérifié
          if (error.error.status === 403) {
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
                        Connexion impossible
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Votre compte n'a pas encore été vérifié. Veuillez
                        vérifier votre adresse e-mail avant de vous connecter.
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

          // Si les identifiants sont incorrects
          if (error.error.status === 401) {
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
                        Connexion impossible
                      </p>
                      <p className="text-sm text-muted-foreground">
                        L'adresse e-mail ou le mot de passe saisie est
                        incorrect. Veuillez réessayer.
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
                    <p className="text-sm font-medium">Connexion impossible</p>
                    <p className="text-sm text-muted-foreground">
                      Une erreur inattendue s'est produite lors de la connexion.
                      Veuillez réessayer ultérieurement.
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

  async function handleGoogleSignIn() {
    await signIn.social(
      {
        provider: "google",
        callbackURL: "/dashboard",
      },
      {
        onSuccess: () => {
          router.push("/dashboard");
          router.refresh();
        },
        onError: (error) => {
          console.error("Sign In error:", error);

          // Si les identifiants sont incorrects
          if (error.error.code === "BANNED_USER") {
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
                        Échec de la connexion
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Votre compte a été désactivé. Si vous pensez qu'il
                        s'agit d'une erreur, veuillez contacter le support.
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

          // Si le compte n'est pas vérifié
          if (error.error.status === 403) {
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
                        Échec de la connexion
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Votre compte n'a pas encore été vérifié. Veuillez
                        vérifier votre adresse e-mail avant de vous connecter.
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

          // Si les identifiants sont incorrects
          if (error.error.status === 401) {
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
                        Échec de la connexion
                      </p>
                      <p className="text-sm text-muted-foreground">
                        L'adresse e-mail ou le mot de passe saisie est
                        incorrect. Veuillez réessayer.
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
                    <p className="text-sm font-medium">Erreur de connexion</p>
                    <p className="text-sm text-muted-foreground">
                      Une erreur s'est produite lors de la connexion. Veuillez
                      réessayer ultérieurement.
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
  }

  return (
    <div className="bg-background text-foreground">
      <SignInForm
        heroImageSrc="/images/signIn-pictogram.png"
        onSignIn={handleSignIn}
        onGoogleSignIn={handleGoogleSignIn}
        loading={loading}
      />
    </div>
  );
}
