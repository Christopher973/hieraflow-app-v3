import UsersTable from "@/src/components/admin/users-table";
import { getUser } from "@/src/lib/auth-server";
import { listUsersForAdmin } from "@/src/lib/admin/users";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

import { z } from "zod";

const usersSearchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(["all", "admin", "user"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

type UsersAdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function UsersAdminPage({
  searchParams,
}: UsersAdminPageProps) {
  const params = await searchParams;
  const parsedParams = usersSearchParamsSchema.safeParse({
    q: getFirstValue(params.q),
    role: getFirstValue(params.role),
    page: getFirstValue(params.page),
  });

  const data = await listUsersForAdmin({
    q: parsedParams.success ? parsedParams.data.q : undefined,
    role: parsedParams.success ? (parsedParams.data.role ?? "all") : "all",
    page: parsedParams.success ? (parsedParams.data.page ?? 1) : 1,
    pageSize: 10,
  });

  const currentUser = await getUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-primary">
            Gestion des utilisateurs
          </h2>
        </CardTitle>

        <CardDescription>
          <p className="text-lg">
            Visualiez et gérer les utilisateurs de l'application, leurs rôles et
            permissions.
          </p>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <UsersTable
          users={data.users}
          total={data.total}
          page={data.page}
          totalPages={data.totalPages}
          searchValue={data.searchValue}
          roleFilter={data.roleFilter}
          currentUserId={currentUser?.id ?? ""}
        />
      </CardContent>
    </Card>
  );
}
