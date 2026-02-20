import { Button } from "@/src/components/ui/button";
import { MoveRight, PhoneCall } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ForgotPasswordErrorPage() {
  return (
    <div className="w-full">
      <div className="container mx-auto ">
        <div className="flex gap-8 py-20 lg:py-40 items-center justify-center flex-col px-4">
          <div className="flex gap-4 flex-col">
            <Image
              width={100}
              height={100}
              alt="Logo"
              src="/images/logo.jpeg"
              className="mx-auto my-10"
            />
            <h1 className="text-3xl md:text-4xl max-w-2xl tracking-tighter text-center font-regular">
              Une erreur est survenue lors de l'envoi de l'email de
              réinitialisation de mot de passe
            </h1>
            <p className="text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground max-w-2xl text-center">
              Il semble qu'il y ait eu un problème lors de la tentative d'envoi
              de l'email. Veuillez réessayer plus tard ou contacter le support
              si le problème persiste. Nous nous excusons pour la gêne
              occasionnée.
            </p>
          </div>

          <div className="flex flex-row gap-3">
            <Link href="/contact">
              <Button size="lg" className="gap-4" variant="outline">
                Contacter le support <PhoneCall className="w-4 h-4" />
              </Button>
            </Link>

            <Link href="/sign-in">
              <Button size="lg" className="gap-4">
                Se connecter ici <MoveRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
