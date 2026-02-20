import MyAccountForm from "@/src/components/auth/my-account-form";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { getUser } from "@/src/lib/auth-server";
import { getNameFallback } from "@/src/lib/utils";

export default async function MyAccountPage() {
  const user = await getUser();

  let role = "Utilisateur";

  if (user?.role === "admin") {
    role = "Administrateur";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-primary">
            Paramètres du compte
          </h2>
        </CardTitle>

        <CardDescription>
          Gérez et modifier les informations de votre compte.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <Avatar className="w-24 h-24">
            {user?.image && <AvatarImage src={user.image} />}
            <AvatarFallback>{getNameFallback(user?.name)}</AvatarFallback>
          </Avatar>

          <div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <p className="text-xl font-semibold">
                {user?.name ?? "Utilisateur"}
              </p>
              <Badge> {role}</Badge>
            </div>
            <p className="text-muted-foreground mt-2">{user?.email ?? ""}</p>
          </div>
        </div>

        <MyAccountForm defaultName={user?.name} defaultEmail={user?.email} />
      </CardContent>
    </Card>
  );
}
