import { Illustration, NotFound } from "@/src/components/ui/not-found";

export default function NotFoundPage() {
  return (
    <div className="relative flex flex-col w-full justify-center min-h-svh bg-background p-6 md:p-10">
      <div className="relative max-w-5xl mx-auto w-full">
        <Illustration className="absolute inset-0 w-full h-[50vh] opacity-[0.04] dark:opacity-[0.03] text-foreground" />
        <NotFound
          title="Page non trouvée"
          description="Oups... Il semblerait que la page que vous cherchez n'existe pas ou a été supprimée."
        />
      </div>
    </div>
  );
}
