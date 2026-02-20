import { Header } from "@/src/components/ui/header-1";
import { getUser } from "@/src/lib/auth-server";
import { redirect } from "next/navigation";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const isAdmin = user.role?.toLowerCase() === "admin";

  return (
    <>
      <Header isAdmin={isAdmin} />

      <main className="mx-auto min-h-screen w-full px-4 py-4">{children}</main>
    </>
  );
}
