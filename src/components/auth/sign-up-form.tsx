"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { Spinner } from "../ui/spinner";

interface SignUpFormProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  onSignUp?: (data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => void;
  loading?: boolean;
}

const signUpSchema = z
  .object({
    fullName: z.string().trim().min(1, "Le nom complet est requis"),
    email: z
      .string()
      .trim()
      .min(1, "L'adresse email est requise")
      .email("L'adresse email n'est pas valide"),
    password: z
      .string()
      .min(1, "Le mot de passe est requis")
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
      .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
      .regex(
        /[^A-Za-z0-9]/,
        "Le mot de passe doit contenir au moins un caractère spécial",
      ),
    confirmPassword: z
      .string()
      .min(1, "La confirmation du mot de passe est requise"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas",
  });

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-primary/70 focus-within:bg-primary/10">
    {children}
  </div>
);

// --- MAIN COMPONENT ---

export const SignUpForm: React.FC<SignUpFormProps> = ({
  title = (
    <span className="font-light text-foreground tracking-tighter">
      S'inscrire
    </span>
  ),
  description = "Pour accéder à l'application, veuillez vous inscrire avec vos identifiants.",
  heroImageSrc,
  onSignUp,
  loading = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
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

    const result = signUpSchema.safeParse(values);

    if (result.success) {
      return {};
    }

    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      fullName: fieldErrors.fullName?.[0],
      email: fieldErrors.email?.[0],
      password: fieldErrors.password?.[0],
      confirmPassword: fieldErrors.confirmPassword?.[0],
    };
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    const result = signUpSchema.safeParse(values);

    if (!result.success) {
      setErrors(getFormFieldErrors(event.currentTarget));
      return;
    }

    setErrors({});
    const parsed = result.data as {
      fullName: string;
      email: string;
      password: string;
      confirmPassword: string;
    };

    onSignUp?.({
      name: parsed.fullName,
      email: parsed.email,
      password: parsed.password,
      confirmPassword: parsed.confirmPassword,
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
                  Nom complet
                </label>
                <GlassInputWrapper>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Entrer votre nom complet"
                    aria-invalid={Boolean(errors.fullName)}
                    onChange={(event) => {
                      if (!errors.fullName) {
                        return;
                      }

                      const form = event.currentTarget.form;
                      if (!form) {
                        return;
                      }

                      const fieldErrors = getFormFieldErrors(form, {
                        field: "fullName",
                        value: event.target.value,
                      });

                      setErrors((previousErrors) => ({
                        ...previousErrors,
                        fullName: fieldErrors.fullName,
                      }));
                    }}
                    className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none"
                  />
                </GlassInputWrapper>
                {errors.fullName && (
                  <p className="mt-2 text-sm text-destructive">
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div className="animate-element animate-delay-350">
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
                      if (!errors.email) {
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
                  Mot de passe
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Entrer votre mot de passe"
                      aria-invalid={Boolean(errors.password)}
                      onChange={(event) => {
                        if (!errors.password && !errors.confirmPassword) {
                          return;
                        }

                        const form = event.currentTarget.form;
                        if (!form) {
                          return;
                        }

                        const fieldErrors = getFormFieldErrors(form, {
                          field: "password",
                          value: event.target.value,
                        });

                        setErrors((previousErrors) => ({
                          ...previousErrors,
                          password: fieldErrors.password,
                          confirmPassword: fieldErrors.confirmPassword,
                        }));
                      }}
                      className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                      ) : (
                        <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
                {errors.password && (
                  <p className="mt-2 text-sm text-destructive">
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="animate-element animate-delay-500">
                <label className="text-sm font-medium text-muted-foreground">
                  Confirmer le mot de passe
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirmer votre mot de passe"
                      aria-invalid={Boolean(errors.confirmPassword)}
                      onChange={(event) => {
                        if (!errors.confirmPassword) {
                          return;
                        }

                        const form = event.currentTarget.form;
                        if (!form) {
                          return;
                        }

                        const fieldErrors = getFormFieldErrors(form, {
                          field: "confirmPassword",
                          value: event.target.value,
                        });

                        setErrors((previousErrors) => ({
                          ...previousErrors,
                          confirmPassword: fieldErrors.confirmPassword,
                        }));
                      }}
                      className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                      ) : (
                        <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
                {errors.confirmPassword && (
                  <p className="mt-2 text-sm text-destructive">
                    {errors.confirmPassword}
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
                    Inscription en cours...
                  </div>
                ) : (
                  "S'inscrire"
                )}
              </button>
            </form>

            <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
              Déjà inscrit?{" "}
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
