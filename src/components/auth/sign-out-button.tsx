"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/src/lib/auth-client";
import { Spinner } from "../ui/spinner";

export default function SignOutButton() {
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
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="mt-2 w-full rounded-2xl bg-secondary py-4 font-medium text-secondary-foreground hover:bg-secondary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <Spinner />
          Déconnexion en cours...
        </div>
      ) : (
        "Se déconnecter"
      )}
    </button>
  );
}
