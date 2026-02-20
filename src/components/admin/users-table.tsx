"use client";
"use no memo";

import { useState, useTransition } from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Ban,
  CircleCheck,
  CircleX,
  MoreHorizontal,
  SearchIcon,
  UserCog,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  disableUserAction,
  setUserRoleAction,
} from "@/src/actions/admin/users";
import { AdminUserListItem } from "@/src/lib/admin/users";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { FieldGroup, Label } from "@/src/components/ui/field";
import {
  SearchField,
  SearchFieldClear,
  SearchFieldInput,
} from "@/src/components/ui/searchfield";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Spinner } from "@/src/components/ui/spinner";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/src/components/ui/empty";

type UsersTableProps = {
  users: AdminUserListItem[];
  total: number;
  page: number;
  totalPages: number;
  searchValue: string;
  roleFilter: "all" | "admin" | "user";
  currentUserId: string;
};

const roleFormSchema = z.object({
  role: z.enum(["admin", "user"], {
    message: "Veuillez sélectionner un rôle.",
  }),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

const columns: ColumnDef<AdminUserListItem>[] = [
  {
    accessorKey: "fullName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Nom complet
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <span>{row.getValue("fullName")}</span>,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Email
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="lowercase">{row.getValue("email")}</span>
    ),
  },
  {
    accessorKey: "role",
    header: "Rôle",
    cell: ({ row }) => {
      const role = row.getValue("role") as AdminUserListItem["role"];
      return (
        <Badge variant={role === "admin" ? "default" : "secondary"}>
          {role === "admin" ? "Administrateur" : "Utilisateur"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "isDisabled",
    header: "Statut",
    cell: ({ row }) => {
      const isDisabled = row.getValue("isDisabled") as boolean;
      return (
        <Badge variant={isDisabled ? "destructive" : "outline"}>
          {isDisabled ? "Désactivé" : "Actif"}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: () => null,
    enableHiding: false,
    enableSorting: false,
  },
];

export default function UsersTable({
  users,
  total,
  page,
  totalPages,
  searchValue,
  roleFilter,
  currentUserId,
}: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchInput, setSearchInput] = useState(searchValue);
  const [disableDialogUser, setDisableDialogUser] =
    useState<AdminUserListItem | null>(null);
  const [roleDialogUser, setRoleDialogUser] =
    useState<AdminUserListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { role: "user" },
  });

  const updateQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value.length === 0) {
        params.delete(key);
        return;
      }

      params.set(key, value);
    });

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const openDisableDialog = (user: AdminUserListItem) => {
    if (user.id === currentUserId) {
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
                <p className="text-sm font-medium">Mise à jour impossible</p>
                <p className="text-sm text-muted-foreground">
                  Vous ne pouvez pas vous désactiver vous-même.
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

    setDisableDialogUser(user);
  };

  const openRoleDialog = (user: AdminUserListItem) => {
    if (user.id === currentUserId) {
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
                <p className="text-sm font-medium">Mise à jour impossible</p>
                <p className="text-sm text-muted-foreground">
                  Vous ne pouvez pas modifier votre propre rôle.
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

    form.reset({ role: user.role });
    setRoleDialogUser(user);
  };

  const onConfirmDisable = () => {
    if (!disableDialogUser) {
      return;
    }

    if (disableDialogUser.id === currentUserId) {
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
                <p className="text-sm font-medium">Mise à jour impossible</p>
                <p className="text-sm text-muted-foreground">
                  Vous ne pouvez pas vous désactiver vous-même.
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

    startTransition(async () => {
      const result = await disableUserAction({ userId: disableDialogUser.id });

      if (!result.success) {
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
                  <p className="text-sm font-medium">Mise à jour impossible</p>
                  <p className="text-sm text-muted-foreground">
                    Une erreur innatendue s'est produite lors de la
                    désactivation de l'utilisateur. Veuillez réessayer
                    ultérieurement.
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
                <p className="text-sm font-medium">Mise à jour réussie</p>
                <p className="text-sm text-muted-foreground">
                  L'utilisateur a été désactivé avec succès.
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
      setDisableDialogUser(null);
      router.refresh();
    });
  };

  const onSubmitRole = (data: RoleFormValues) => {
    if (!roleDialogUser) {
      return;
    }

    if (roleDialogUser.id === currentUserId) {
      toast.custom((t) => (
        <div className="w-full rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-foreground shadow-lg sm:w-var(--width)">
          <div className="flex gap-2">
            <div className="flex grow gap-3">
              <CircleCheck
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-red-500"
                size={16}
              />
              <div className="flex grow flex-col gap-1">
                <p className="text-sm font-medium">Mise à jour impossible</p>
                <p className="text-sm text-muted-foreground">
                  Vous ne pouvez pas modifier votre propre rôle.
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

    startTransition(async () => {
      const result = await setUserRoleAction({
        userId: roleDialogUser.id,
        role: data.role,
      });

      if (!result.success) {
        toast.custom((t) => (
          <div className="w-full rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-foreground shadow-lg sm:w-var(--width)">
            <div className="flex gap-2">
              <div className="flex grow gap-3">
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-red-500"
                  size={16}
                />
                <div className="flex grow flex-col gap-1">
                  <p className="text-sm font-medium">Mise à jour impossible</p>
                  <p className="text-sm text-muted-foreground">
                    Une erreur innatendue s'est produite lors de la mise à jour
                    du rôlede l'utilisateur. Veuillez réessayer ultérieurement.
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
                <p className="text-sm font-medium">Mise à jour réussie</p>
                <p className="text-sm text-muted-foreground">
                  Le rôle de l'utilisateur a été mis à jour avec succès.
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
      setRoleDialogUser(null);
      router.refresh();
    });
  };

  const columnsWithActions: ColumnDef<AdminUserListItem>[] = columns.map(
    (column) => {
      if (column.id !== "actions") {
        return column;
      }

      return {
        ...column,
        cell: ({ row }) => {
          const user = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <span className="sr-only">Ouvrir le menu</span>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={user.id === currentUserId}
                  onClick={() => openDisableDialog(user)}
                >
                  <Ban className="size-4" />
                  Désactiver
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={user.id === currentUserId}
                  onClick={() => openRoleDialog(user)}
                >
                  <UserCog className="size-4" />
                  Modifier le rôle
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      };
    },
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: users,
    columns: columnsWithActions,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            updateQuery({
              q: searchInput.trim() || null,
              page: "1",
            });
          }}
        >
          <SearchField
            className="w-full md:w-70"
            value={searchInput}
            onChange={(value) => setSearchInput(value)}
          >
            <FieldGroup>
              <SearchIcon
                aria-hidden
                className="size-4 text-muted-foreground"
              />
              <SearchFieldInput placeholder="Rechercher par nom ou email" />
              <SearchFieldClear>
                <XIcon aria-hidden className="size-4" />
              </SearchFieldClear>
            </FieldGroup>
          </SearchField>

          {/* submit button removed — search is applied on Enter or onChange */}
        </form>

        <Select
          value={roleFilter}
          onValueChange={(value) => {
            updateQuery({
              role: value === "all" ? null : value,
              page: "1",
            });
          }}
        >
          <SelectTrigger className="w-full max-w-full md:max-w-48">
            <SelectValue placeholder="Filtrer par rôle" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Rôle</SelectLabel>
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="admin">Administrateur</SelectItem>
              <SelectItem value="user">Utilisateur</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {total} utilisateur{total !== 1 ? "s" : ""} au total
      </p>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnsWithActions.length}
                  className="h-24 text-center"
                >
                  <Empty className="border border-dashed">
                    <EmptyHeader>
                      <EmptyTitle>Aucun résultat</EmptyTitle>
                      <EmptyDescription>
                        Il n'existe aucun utilisateur correspondant à votre
                        recherche ou à vos filtres. Essayez de modifier vos
                        critères de recherche pour trouver ce que vous cherchez.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {page} / {totalPages}
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateQuery({ page: String(page - 1) })}
            disabled={!canGoPrevious}
          >
            <ArrowLeft />
            <span className="hidden md:block">Précédent</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => updateQuery({ page: String(page + 1) })}
            disabled={!canGoNext}
          >
            <span className="hidden md:block">Suivant</span> <ArrowRight />
          </Button>
        </div>
      </div>

      <Dialog
        open={disableDialogUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDisableDialogUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la désactivation</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir désactiver le compte de{" "}
              <strong>{disableDialogUser?.fullName}</strong> ?
              L&apos;utilisateur ne pourra plus se connecter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>
                Annuler
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={onConfirmDisable}
              disabled={isPending}
            >
              {isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-4" />
                  Désactivation...
                </span>
              ) : (
                "Désactiver"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={roleDialogUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRoleDialogUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Changez le rôle de <strong>{roleDialogUser?.fullName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(onSubmitRole)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(value: string) =>
                  form.setValue("role", value as RoleFormValues["role"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Rôles disponibles</SelectLabel>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="user">Utilisateur</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {form.formState.errors.role && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.role.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button" disabled={isPending}>
                  Annuler
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="size-4" />
                    Enregistrement...
                  </span>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
