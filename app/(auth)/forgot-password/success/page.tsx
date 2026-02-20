import { Button } from "@/src/components/ui/button";
import { MoveRight, PhoneCall } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ForgotPasswordSuccessPage() {
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
              Email de réinitialisation du mot de passe envoyé avec succès
            </h1>
            <p className="text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground max-w-2xl text-center">
              Votre demande de réinitialisation de mot de passe a été
              enregistrée. Veuillez vérifier votre boîte de réception pour
              accéder au lien de réinitialisation. Si vous ne voyez pas l'email,
              pensez à vérifier votre dossier de spam ou contacter le support.
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
