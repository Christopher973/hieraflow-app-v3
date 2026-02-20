"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { Spinner } from "../ui/spinner";

interface ResetPasswordFormProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  onResetPassword?: (data: {
    password: string;
    confirmPassword: string;
  }) => void;
  loading?: boolean;
}

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(1, "Le nouveau mot de passe est requis")
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
      .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
      .regex(
        /[^A-Za-z0-9]/,
        "Le mot de passe doit contenir au moins un caractère spécial",
      ),
    confirmNewPassword: z
      .string()
      .min(1, "La confirmation du mot de passe est requise"),
  })
  .refine((values) => values.newPassword === values.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "Les mots de passe ne correspondent pas",
  });

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-primary/70 focus-within:bg-primary/10">
    {children}
  </div>
);

// --- MAIN COMPONENT ---

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  title = (
    <span className="font-light text-foreground tracking-tighter">
      Réinitialisation du mot de passe
    </span>
  ),
  description = "Pour réinitialiser votre mot de passe, veuillez entrer un nouveau mot de passe et le confirmer.",
  heroImageSrc,
  onResetPassword,
  loading = false,
}) => {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [errors, setErrors] = useState<{
    newPassword?: string;
    confirmNewPassword?: string;
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

    const result = resetPasswordSchema.safeParse(values);

    if (result.success) {
      return {};
    }

    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      newPassword: fieldErrors.newPassword?.[0],
      confirmNewPassword: fieldErrors.confirmNewPassword?.[0],
    };
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    const result = resetPasswordSchema.safeParse(values);

    if (!result.success) {
      setErrors(getFormFieldErrors(event.currentTarget));
      return;
    }

    setErrors({});
    const parsed = result.data as {
      newPassword: string;
      confirmNewPassword: string;
    };

    onResetPassword?.({
      password: parsed.newPassword,
      confirmPassword: parsed.confirmNewPassword,
    });
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
                  Nouveau mot de passe
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      id="newPassword"
                      name="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Entrer votre nouveau mot de passe"
                      aria-invalid={Boolean(errors.newPassword)}
                      onChange={(event) => {
                        if (!errors.newPassword && !errors.confirmNewPassword) {
                          return;
                        }

                        const form = event.currentTarget.form;
                        if (!form) {
                          return;
                        }

                        const fieldErrors = getFormFieldErrors(form, {
                          field: "newPassword",
                          value: event.target.value,
                        });

                        setErrors((previousErrors) => ({
                          ...previousErrors,
                          newPassword: fieldErrors.newPassword,
                          confirmNewPassword: fieldErrors.confirmNewPassword,
                        }));
                      }}
                      className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                      ) : (
                        <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
                {errors.newPassword && (
                  <p className="mt-2 text-sm text-destructive">
                    {errors.newPassword}
                  </p>
                )}
              </div>

              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium text-muted-foreground">
                  Confirmer le nouveau mot de passe
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      id="confirmNewPassword"
                      name="confirmNewPassword"
                      type={showConfirmNewPassword ? "text" : "password"}
                      placeholder="Confirmer votre nouveau mot de passe"
                      aria-invalid={Boolean(errors.confirmNewPassword)}
                      onChange={(event) => {
                        if (!errors.confirmNewPassword) {
                          return;
                        }

                        const form = event.currentTarget.form;
                        if (!form) {
                          return;
                        }

                        const fieldErrors = getFormFieldErrors(form, {
                          field: "confirmNewPassword",
                          value: event.target.value,
                        });

                        setErrors((previousErrors) => ({
                          ...previousErrors,
                          confirmNewPassword: fieldErrors.confirmNewPassword,
                        }));
                      }}
                      className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmNewPassword(!showConfirmNewPassword)
                      }
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      {showConfirmNewPassword ? (
                        <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                      ) : (
                        <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
                {errors.confirmNewPassword && (
                  <p className="mt-2 text-sm text-destructive">
                    {errors.confirmNewPassword}
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
                    Réinitialisation en cours...
                  </div>
                ) : (
                  "Réinitialiser le mot de passe"
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
