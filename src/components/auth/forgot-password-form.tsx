"use client";

import React, { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Spinner } from "../ui/spinner";

interface ForgotPasswordFormProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  onForgotPassword?: (data: { email: string }) => void;
  loading?: boolean;
}

const forgotPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "L'adresse email est requise")
      .email("L'adresse email n'est pas valide"),
    confirmEmail: z
      .string()
      .trim()
      .min(1, "La confirmation de l'adresse email est requise")
      .email("L'adresse email de confirmation n'est pas valide"),
  })
  .refine((values) => values.email === values.confirmEmail, {
    path: ["confirmEmail"],
    message: "Les adresses email ne correspondent pas",
  });

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-primary/70 focus-within:bg-primary/10">
    {children}
  </div>
);

// --- MAIN COMPONENT ---

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  title = (
    <span className="font-light text-foreground tracking-tighter">
      Mot de passe oublié
    </span>
  ),
  description = "Pour réinitialiser votre mot de passe, veuillez entrer votre adresse email et suivre les instructions envoyées à votre boîte de réception.",
  heroImageSrc,
  onForgotPassword,
  loading = false,
}) => {
  const [errors, setErrors] = useState<{
    email?: string;
    confirmEmail?: string;
  }>({});

  const getFormFieldErrors = (
    form: HTMLFormElement,
    override?: { field: string; value: string },
  ) => {
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries()) as Record<
      string,
      string
    >;

    if (override) {
      values[override.field] = override.value;
    }

    const result = forgotPasswordSchema.safeParse(values);

    if (result.success) {
      return {};
    }

    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      email: fieldErrors.email?.[0],
      confirmEmail: fieldErrors.confirmEmail?.[0],
    };
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    const result = forgotPasswordSchema.safeParse(values);

    if (!result.success) {
      setErrors(getFormFieldErrors(event.currentTarget));
      return;
    }

    setErrors({});
    const parsed = result.data as { email: string; confirmEmail: string };
    onForgotPassword?.({ email: parsed.email });
  };

  return (
    <div className="h-dvh flex flex-col md:flex-row font-geist w-dvw">
      {/* Left column: sign-in form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight">
              {title}
            </h1>
            <p className="animate-element animate-delay-200 text-muted-foreground">
              {description}
            </p>

            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div className="animate-element animate-delay-300">
                <label className="text-sm font-medium text-muted-foreground">
                  Adresse email
                </label>
                <GlassInputWrapper>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Entrer votre adresse email"
                    aria-invalid={Boolean(errors.email)}
                    onChange={(event) => {
                      if (!errors.email && !errors.confirmEmail) {
                        return;
                      }

                      const form = event.currentTarget.form;
                      if (!form) {
                        return;
                      }

                      const fieldErrors = getFormFieldErrors(form, {
                        field: "email",
                        value: event.target.value,
                      });

                      setErrors((previousErrors) => ({
                        ...previousErrors,
                        email: fieldErrors.email,
                        confirmEmail: fieldErrors.confirmEmail,
                      }));
                    }}
                    className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none"
                  />
                </GlassInputWrapper>
                {errors.email && (
                  <p className="mt-2 text-sm text-destructive">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium text-muted-foreground">
                  Confirmer l'adresse email
                </label>
                <GlassInputWrapper>
                  <input
                    id="confirmEmail"
                    name="confirmEmail"
                    type="email"
                    placeholder="Confirmer votre adresse email"
                    aria-invalid={Boolean(errors.confirmEmail)}
                    onChange={(event) => {
                      if (!errors.confirmEmail) {
                        return;
                      }

                      const form = event.currentTarget.form;
                      if (!form) {
                        return;
                      }

                      const fieldErrors = getFormFieldErrors(form, {
                        field: "confirmEmail",
                        value: event.target.value,
                      });

                      setErrors((previousErrors) => ({
                        ...previousErrors,
                        confirmEmail: fieldErrors.confirmEmail,
                      }));
                    }}
                    className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none"
                  />
                </GlassInputWrapper>
                {errors.confirmEmail && (
                  <p className="mt-2 text-sm text-destructive">
                    {errors.confirmEmail}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner />
                    Envoi en cours
                  </div>
                ) : (
                  "Envoyer le lien de réinitialisation"
                )}
              </button>
            </form>

            <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
              Mot de passe retrouvé ?{" "}
              <Link
                href="/sign-in"
                className="text-primary hover:underline transition-colors"
              >
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Right column: hero image + testimonials */}
      {heroImageSrc && (
        <section className="hidden md:block flex-1 relative p-4">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          ></div>
        </section>
      )}
    </div>
  );
};
