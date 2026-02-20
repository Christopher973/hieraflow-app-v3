"use client";

import { ResetPasswordForm } from "@/src/components/auth/reset-password-form";
import { resetPassword } from "@/src/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const searchParams = useSearchParams();
  const token = searchParams?.get("token");

  const handleResetPassword = async (data: {
    password: string;
    confirmPassword: string;
  }) => {
    setLoading(true);

    await resetPassword(
      {
        newPassword: data.password,
        token: token || "",
      },
      {
        onSuccess: () => {
          router.push("reset-password/success");
          router.refresh();
        },
        onError: (error) => {
          console.error("Error:", error);

          if (error.error.code === "INVALID_TOKEN") {
            router.push("reset-password/error");
            router.refresh();
          }
        },
      },
    );
  };

  return (
    <div className="bg-background text-foreground">
      <ResetPasswordForm
        heroImageSrc="/images/resetPassword-pictogram.png"
        onResetPassword={handleResetPassword}
        loading={loading}
      />
    </div>
  );
}
