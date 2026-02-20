"use client";

import { useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  XIcon,
} from "lucide-react";
import { z } from "zod";
import { changeEmail, changePassword, updateUser } from "@/src/lib/auth-client";
import { toast } from "sonner";
import { Spinner } from "../ui/spinner";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import SignOutButton from "./sign-out-button";

interface MyAccountFormProps {
  defaultName?: string;
  defaultEmail?: string;
}

const passwordRegex = {
  uppercase: /[A-Z]/,
  number: /[0-9]/,
  special: /[^A-Za-z0-9]/,
};

const myAccountSchema = z
  .object({
    fullName: z.string().trim().min(1, "Le nom complet est requis"),
    email: z
      .string()
      .trim()
      .min(1, "L'adresse email est requise")
      .email("L'adresse email n'est pas valide"),
    newPassword: z.string().optional(),
    currentPassword: z.string().optional(),
    confirmNewPassword: z.string().optional(),
  })
  .superRefine((values, context) => {
    const hasNewPassword = Boolean(values.newPassword?.trim());

    if (!hasNewPassword) {
      return;
    }

    const newPassword = values.newPassword ?? "";

    if (newPassword.length < 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "Le mot de passe doit contenir au moins 8 caractères",
      });
    }

    if (!passwordRegex.uppercase.test(newPassword)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "Le mot de passe doit contenir au moins une majuscule",
      });
    }

    if (!passwordRegex.number.test(newPassword)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "Le mot de passe doit contenir au moins un chiffre",
      });
    }

    if (!passwordRegex.special.test(newPassword)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "Le mot de passe doit contenir au moins un caractère spécial",
      });
    }

    if (!values.currentPassword?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentPassword"],
        message:
          "Le mot de passe actuel est requis si vous définissez un nouveau mot de passe",
      });
    }

    if (!values.confirmNewPassword?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmNewPassword"],
        message:
          "La confirmation du nouveau mot de passe est requise si vous définissez un nouveau mot de passe",
      });
      return;
    }

    if (values.confirmNewPassword !== newPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmNewPassword"],
        message: "La confirmation ne correspond pas au nouveau mot de passe",
      });
    }
  });

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-primary/70 focus-within:bg-primary/10">
    {children}
  </div>
);

type FormErrors = {
  fullName?: string;
  email?: string;
  newPassword?: string;
  currentPassword?: string;
  confirmNewPassword?: string;
};

export default function MyAccountForm({
  defaultName,
  defaultEmail,
}: MyAccountFormProps) {
  const router = useRouter();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const isPasswordChangeEnabled = newPasswordValue.trim().length > 0;

  const getFormFieldErrors = (
    form: HTMLFormElement,
    override?: { field: string; value: string },
  ): FormErrors => {
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries()) as Record<
      string,
      string
    >;

    if (override) {
      values[override.field] = override.value;
    }

    const result = myAccountSchema.safeParse(values);

    if (result.success) {
      return {};
    }

    const fieldErrors = result.error.flatten().fieldErrors;

    return {
      fullName: fieldErrors.fullName?.[0],
      email: fieldErrors.email?.[0],
      newPassword: fieldErrors.newPassword?.[0],
      currentPassword: fieldErrors.currentPassword?.[0],
      confirmNewPassword: fieldErrors.confirmNewPassword?.[0],
    };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries()) as Record<
      string,
      string
    >;
    const result = myAccountSchema.safeParse(values);

    if (!result.success) {
      setErrors(getFormFieldErrors(form));
      return;
    }

    setErrors({});

    const parsed = result.data;
    const fullName = parsed.fullName.trim();
    const email = parsed.email.trim();
    const hasNewPassword = Boolean(parsed.newPassword?.trim());

    const normalizedDefaultName = (defaultName ?? "").trim();
    const normalizedDefaultEmail = (defaultEmail ?? "").trim().toLowerCase();

    const shouldUpdateName = fullName !== normalizedDefaultName;
    const shouldChangeEmail = email.toLowerCase() !== normalizedDefaultEmail;
    const shouldChangePassword = hasNewPassword;

    if (!shouldUpdateName && !shouldChangeEmail && !shouldChangePassword) {
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
                  Impossible de mettre à jour votre profil
                </p>
                <p className="text-sm text-muted-foreground">
                  Il semble que vous n'ayez apporté aucune mise à jour à votre
                  profil. Veuillez mettre à jour les champs avant de soumettre.
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

    setIsSubmitting(true);

    try {
      let updatedName = false;
      let emailChanged = false;
      let passwordChanged = false;

      const hasApiError = (result: unknown) => {
        if (!result || typeof result !== "object") {
          return false;
        }

        return (
          "error" in result && Boolean((result as { error?: unknown }).error)
        );
      };

      if (shouldUpdateName) {
        try {
          const response = await updateUser({ name: fullName });
          if (hasApiError(response)) {
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
                        Impossible de mettre à jour votre nom
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Une erreur innatendue est survenue lors de la mise à
                        jour du nom. Veuillez réessayer.
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
          } else {
            updatedName = true;
          }
        } catch (err) {
          console.error("Erreur updateUser:", err);

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
                      Impossible de mettre à jour votre nom
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Une erreur innatendue est survenue lors de la mise à jour
                      du nom. Veuillez réessayer.
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
        }
      }

      if (shouldChangeEmail) {
        try {
          const response = await changeEmail({
            newEmail: email,
            callbackURL: "/my-account",
          });
          if (hasApiError(response)) {
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
                        Impossible de mettre à jour votre adresse email
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Une erreur innatendue est survenue lors de la mise à
                        jour du nom. Veuillez réessayer.
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
          } else {
            emailChanged = true;
          }
        } catch (err) {
          console.error("Erreur changeEmail:", err);

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
                      Impossible de mettre à jour votre adresse email
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Une erreur innatendue est survenue lors de la mise à jour
                      du nom. Veuillez réessayer.
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
        }
      }

      if (shouldChangePassword) {
        try {
          const response = await changePassword({
            currentPassword: parsed.currentPassword ?? "",
            newPassword: parsed.newPassword ?? "",
            revokeOtherSessions: false,
          });
          if (hasApiError(response)) {
            setErrors((previous) => ({
              ...previous,
              currentPassword:
                "Le mot de passe actuel est incorrect. Vérifiez-le et réessayez.",
            }));

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
                        Impossible de mettre à jour votre mot de passe
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Vous avez saisi un mot de passe actuel incorrect.
                        Veuillez vérifier votre mot de passe actuel et
                        réessayer.
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
          } else {
            passwordChanged = true;
          }
        } catch (err) {
          console.error("Erreur changePassword:", err);
          // Indiquer l'erreur sur le champ currentPassword et afficher un toast
          setErrors((previous) => ({
            ...previous,
            currentPassword:
              "Le mot de passe actuel est incorrect. Vérifiez-le et réessayez.",
          }));
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
                      Impossible de mettre à jour votre mot de passe
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Vous avez saisi un mot de passe actuel incorrect. Veuillez
                      vérifier votre mot de passe actuel et réessayer.
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
        }
      }

      // Afficher les toasts de succès pour les autres changements
      if (emailChanged) {
        toast.custom((t) => (
          <div className="w-full rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 px-4 py-3 text-foreground shadow-lg sm:w-var(--width)">
            <div className="flex gap-2">
              <div className="flex grow gap-3">
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-green-500"
                  size={16}
                />
                <div className="flex grow flex-col gap-1">
                  <p className="text-sm font-medium">
                    Mise à jour du profil réussie
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Votre profil a été mis à jour avec succès. Un email de
                    confirmation a été envoyé à votre nouvelle adresse email.
                    Veuillez vérifier votre boîte de réception et suivre les
                    instructions pour confirmer le changement d'adresse email.
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
      } else if (updatedName || (!shouldChangePassword && !shouldChangeEmail)) {
        // Show generic success if name updated or nothing else required
        toast.custom((t) => (
          <div className="w-full rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 px-4 py-3 text-foreground shadow-lg sm:w-var(--width)">
            <div className="flex gap-2">
              <div className="flex grow gap-3">
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-green-500"
                  size={16}
                />
                <div className="flex grow flex-col gap-1">
                  <p className="text-sm font-medium">
                    Mise à jour du profil réussie
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Votre profil a été mis à jour avec succès.
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
      }

      // Clear password fields only if password change succeeded
      const newPasswordInput = form.elements.namedItem(
        "newPassword",
      ) as HTMLInputElement | null;
      const currentPasswordInput = form.elements.namedItem(
        "currentPassword",
      ) as HTMLInputElement | null;
      const confirmNewPasswordInput = form.elements.namedItem(
        "confirmNewPassword",
      ) as HTMLInputElement | null;

      if (passwordChanged) {
        if (newPasswordInput) newPasswordInput.value = "";
        if (currentPasswordInput) currentPasswordInput.value = "";
        if (confirmNewPasswordInput) confirmNewPasswordInput.value = "";
        setNewPasswordValue("");
      }

      // Refresh if name or email changed
      if (updatedName || emailChanged) {
        router.refresh();
      }

      console.log("My Account submitted:", {
        fullName,
        email,
        passwordChanged,
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du compte:", error);

      toast.custom((t) => (
        <div className="w-full rounded-md border border-secondary bg-secondary dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-foreground shadow-lg sm:w-var(--width)">
          <div className="flex gap-2">
            <div className="flex grow gap-3">
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-secondary"
                size={16}
              />
              <div className="flex grow flex-col gap-1">
                <p className="text-sm font-medium">
                  Impossible de mettre à jour votre profil
                </p>
                <p className="text-sm text-muted-foreground">
                  Une erreur innatendue est survenue lors de la mise à jour de
                  votre profil. Veuillez réessayer.
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Nom complet
          </label>
          <GlassInputWrapper>
            <input
              id="fullName"
              name="fullName"
              type="text"
              defaultValue={defaultName ?? ""}
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
            <p className="mt-2 text-sm text-destructive">{errors.fullName}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Adresse email
          </label>
          <GlassInputWrapper>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={defaultEmail ?? ""}
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
            <p className="mt-2 text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div>
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
                  const nextValue = event.target.value;
                  setNewPasswordValue(nextValue);

                  if (!nextValue.trim()) {
                    setErrors((previousErrors) => ({
                      ...previousErrors,
                      newPassword: undefined,
                      currentPassword: undefined,
                      confirmNewPassword: undefined,
                    }));
                    return;
                  }

                  if (
                    !errors.newPassword &&
                    !errors.currentPassword &&
                    !errors.confirmNewPassword
                  ) {
                    return;
                  }

                  const form = event.currentTarget.form;
                  if (!form) {
                    return;
                  }

                  const fieldErrors = getFormFieldErrors(form, {
                    field: "newPassword",
                    value: nextValue,
                  });

                  setErrors((previousErrors) => ({
                    ...previousErrors,
                    newPassword: fieldErrors.newPassword,
                    currentPassword: fieldErrors.currentPassword,
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

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Mot de passe actuel
          </label>
          <GlassInputWrapper>
            <div className="relative">
              <input
                id="currentPassword"
                name="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Entrer votre mot de passe actuel"
                disabled={!isPasswordChangeEnabled}
                aria-invalid={Boolean(errors.currentPassword)}
                onChange={(event) => {
                  if (!errors.currentPassword) {
                    return;
                  }

                  const form = event.currentTarget.form;
                  if (!form) {
                    return;
                  }

                  const fieldErrors = getFormFieldErrors(form, {
                    field: "currentPassword",
                    value: event.target.value,
                  });

                  setErrors((previousErrors) => ({
                    ...previousErrors,
                    currentPassword: fieldErrors.currentPassword,
                  }));
                }}
                className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                disabled={!isPasswordChangeEnabled}
                className="absolute inset-y-0 right-3 flex items-center"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                ) : (
                  <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                )}
              </button>
            </div>
          </GlassInputWrapper>
          {errors.currentPassword && (
            <p className="mt-2 text-sm text-destructive">
              {errors.currentPassword}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Confirmation du nouveau mot de passe
          </label>
          <GlassInputWrapper>
            <div className="relative">
              <input
                id="confirmNewPassword"
                name="confirmNewPassword"
                type={showConfirmNewPassword ? "text" : "password"}
                placeholder="Confirmer votre nouveau mot de passe"
                disabled={!isPasswordChangeEnabled}
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
                className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() =>
                  setShowConfirmNewPassword(!showConfirmNewPassword)
                }
                disabled={!isPasswordChangeEnabled}
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
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2">
              <Spinner />
              Enregistrement en cours...
            </div>
          ) : (
            "Enregistrer les modifications"
          )}
        </button>
      </form>

      <SignOutButton />
    </div>
  );
}
