"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { Spinner } from "../ui/spinner";

// --- HELPER COMPONENTS (ICONS) ---

const GoogleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 48 48"
  >
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z"
    />
    <path
      fill="#FF3D00"
      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z"
    />
  </svg>
);

interface SignInFormProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  onSignIn?: (data: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) => void;
  onGoogleSignIn?: () => void;
  loading?: boolean;
}

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L'adresse email est requise")
    .email("L'adresse email n'est pas valide"),
  password: z.string().min(1, "Le mot de passe est requis"),
  rememberMe: z
    .preprocess((value) => value === "true", z.boolean())
    .default(false),
});

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-primary/70 focus-within:bg-primary/10">
    {children}
  </div>
);

// --- MAIN COMPONENT ---

export const SignInForm: React.FC<SignInFormProps> = ({
  title = (
    <span className="font-light text-foreground tracking-tighter">
      Connexion
    </span>
  ),
  description = "Pour accéder à l'application, veuillez vous connecter avec vos identifiants.",
  heroImageSrc,
  onSignIn,
  onGoogleSignIn,
  loading = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const getFieldError = (
    field: "email" | "password",
    value: string,
  ): string | undefined => {
    const result = signInSchema.shape[field].safeParse(value);
    if (result.success) {
      return undefined;
    }

    return result.error.issues[0]?.message;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    const result = signInSchema.safeParse(values);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    setErrors({});
    const parsed = result.data as {
      email: string;
      password: string;
      rememberMe?: boolean;
    };

    onSignIn?.({
      email: parsed.email,
      password: parsed.password,
      rememberMe: parsed.rememberMe,
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

                      setErrors((previousErrors) => ({
                        ...previousErrors,
                        email: getFieldError("email", event.target.value),
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
                        if (!errors.password) {
                          return;
                        }

                        setErrors((previousErrors) => ({
                          ...previousErrors,
                          password: getFieldError(
                            "password",
                            event.target.value,
                          ),
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

              <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="hidden" name="rememberMe" value="false" />
                  <input
                    type="checkbox"
                    name="rememberMe"
                    value="true"
                    defaultChecked={false}
                    className="custom-checkbox"
                  />
                  <span className="text-foreground/90">Se souvenir de moi</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="hover:underline text-primary transition-colors"
                >
                  Mot de passe oublié
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner />
                    Connexion en cours...
                  </div>
                ) : (
                  "Se connecter"
                )}
              </button>
            </form>

            <div className="animate-element animate-delay-700 relative flex items-center justify-center">
              <span className="w-full border-t border-border"></span>
              <span className="px-4 text-sm text-muted-foreground bg-background absolute">
                Ou continuer avec
              </span>
            </div>

            <button
              onClick={onGoogleSignIn}
              className="animate-element animate-delay-800 w-full flex items-center justify-center gap-3 border border-border rounded-2xl py-4 hover:bg-secondary transition-colors"
            >
              <GoogleIcon />
              Continuer avec Google
            </button>

            <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
              Pas encore inscrit?{" "}
              <Link
                href="/sign-up"
                className="text-primary hover:underline transition-colors"
              >
                Créer un compte
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
