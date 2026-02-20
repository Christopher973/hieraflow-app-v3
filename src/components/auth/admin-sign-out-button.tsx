"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/src/lib/auth-client";
import { Spinner } from "../ui/spinner";

export default function AdminSignOutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loading = isSubmitting;

  const handleSignOut = async () => {
    if (loading) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signOut();
      router.push("/sign-in");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleSignOut}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void handleSignOut();
        }
      }}
      aria-disabled={loading}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <Spinner />
          Déconnexion en cours...
        </div>
      ) : (
        "Se déconnecter"
      )}
    </div>
  );
}
