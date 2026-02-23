"use client";

import { useEffect, useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, MoreHorizontal } from "lucide-react";

import { useSectors } from "@/src/hooks/use-sectors";
import { useDepartments } from "@/src/hooks/use-departments";
import type { SectorDto } from "@/src/types/sector";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { Spinner } from "@/src/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/src/components/ui/empty";
import { showErrorToast } from "@/src/lib/show-error-toast";
import {
  ADMIN_DATA_REFRESH_EVENT,
  emitAdminDataRefresh,
  isAdminEntityRefreshEvent,
} from "@/src/lib/admin-data-refresh";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SectorRow = SectorDto;

// ---------------------------------------------------------------------------
// Colonnes TanStack Table
// ---------------------------------------------------------------------------

const columns: ColumnDef<SectorRow>[] = [
  {
    accessorKey: "name",
    header: "Nom",
    cell: ({ row }) => <span>{row.getValue("name")}</span>,
  },
  {
    accessorKey: "departmentName",
    header: "Département",
    cell: ({ row }) => <span>{row.getValue("departmentName")}</span>,
  },
  {
    accessorKey: "positionsCount",
    header: "Postes",
    cell: ({ row }) => <span>{row.getValue("positionsCount")}</span>,
  },
  {
    accessorKey: "createdAt",
    header: "Créé le",
    cell: ({ row }) => (
      <span>
        {new Date(row.getValue("createdAt") as string).toLocaleDateString(
          "fr-FR",
        )}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: () => null,
    enableHiding: false,
    enableSorting: false,
  },
];

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function SectorsTable() {
  // ----- Etats de TanStack Table -----
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [searchValue, setSearchValue] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const { items, loading, error, refresh, updateSector, deleteSector } =
    useSectors({
      q: searchValue,
      departmentId:
        departmentFilter === "all" ? undefined : Number(departmentFilter),
    });
  const { items: departments } = useDepartments({ page: 1, pageSize: 50 });

  // ----- Etats des dialogues (par ligne) -----
  const [editDialog, setEditDialog] = useState<SectorRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteDialog, setConfirmDeleteDialog] =
    useState<SectorRow | null>(null);

  // ----- Formulaire react-hook-form pour l'edition -----
  const form = useForm<{ name: string; departmentId: string }>({
    resolver: zodResolver(
      z.object({
        name: z
          .string()
          .trim()
          .min(2, "Le nom doit contenir au moins 2 caractères.")
          .max(120, "Le nom ne doit pas dépasser 120 caractères."),
        departmentId: z.string().min(1, "Le département est obligatoire."),
      }),
    ),
    defaultValues: { name: "", departmentId: "" },
  });

  const openEditDialog = (s: SectorRow) => {
    form.reset({ name: s.name, departmentId: String(s.departmentId) });
    setEditDialog(s);
  };

  const onSubmitEdit = async (data: { name: string; departmentId: string }) => {
    if (!editDialog) return;

    const departmentId = Number(data.departmentId);

    if (!Number.isFinite(departmentId)) {
      showErrorToast({
        title: "Mise à jour impossible",
        description: "Le département sélectionné est invalide.",
      });
      return;
    }

    const ok = await updateSector(editDialog.id, {
      name: data.name,
      departmentId,
    });
    if (ok) {
      emitAdminDataRefresh("sectors");
      setEditDialog(null);
    }
  };

  const onConfirmDelete = async (s: SectorRow) => {
    setIsDeleting(true);
    const ok = await deleteSector(s.id);
    if (ok) {
      emitAdminDataRefresh("sectors");
    }
    setIsDeleting(false);
    setConfirmDeleteDialog(null);
  };

  useEffect(() => {
    if (!error) return;
    showErrorToast({
      title: "Opération impossible",
      description: error,
    });
  }, [error]);

  useEffect(() => {
    const onRefresh = (event: Event) => {
      if (!isAdminEntityRefreshEvent(event, "sectors")) return;
      void refresh();
    };

    window.addEventListener(ADMIN_DATA_REFRESH_EVENT, onRefresh);

    return () => {
      window.removeEventListener(ADMIN_DATA_REFRESH_EVENT, onRefresh);
    };
  }, [refresh]);

  // ----- Surcharger la colonne "actions" avec les vrais handlers -----
  const columnsWithActions: ColumnDef<SectorRow>[] = columns.map((col) => {
    if (col.id !== "actions") return col;
    return {
      ...col,
      cell: ({ row }) => {
        const s = row.original;
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
              <DropdownMenuItem onClick={() => openEditDialog(s)}>
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfirmDeleteDialog(s)}>
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    };
  });

  // ----- Instance TanStack Table -----
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns: columnsWithActions,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* ---- Barre de filtres ---- */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <form
          className="flex items-center gap-2 w-full"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <SearchField
            className="w-full"
            value={searchValue}
            onChange={(value) => setSearchValue(value)}
          >
            <FieldGroup>
              <SearchIcon
                aria-hidden
                className="size-4 text-muted-foreground"
              />
              <SearchFieldInput placeholder="Rechercher un service" />
              <SearchFieldClear>
                <XIcon aria-hidden className="size-4" />
              </SearchFieldClear>
            </FieldGroup>
          </SearchField>
          {/* submit/clear button removed — search is applied on Enter or onChange */}
        </form>

        <Select onValueChange={(value) => setDepartmentFilter(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filtrer par département" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les départements</SelectItem>
            {departments.map((department) => (
              <SelectItem key={department.id} value={String(department.id)}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ---- Table / Etats ---- */}
      {loading ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>
              <div className="flex items-center gap-2">
                <Spinner /> Chargement en cours...
              </div>
            </EmptyTitle>
            <EmptyDescription>
              Les localisastions sont en train de charger, merci de patienter...
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : items.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Aucun service</EmptyTitle>
            <EmptyDescription>
              Ajoutez un premier service pour commencer.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} département
            {table.getFilteredRowModel().rows.length > 1 ? "s" : ""} au total
          </p>

          <div className="overflow-hidden rounded-md border mt-2">
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
                {table.getRowModel().rows?.length ? (
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
                      Aucun resultat.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ---- Pagination ---- */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} /{" "}
          {table.getPageCount()}
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ArrowLeft />
            <span className="hidden md:block">Précédent</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="hidden md:block">Suivant</span>
            <ArrowRight />
          </Button>
        </div>
      </div>

      {/* ---- Edition modal ---- */}
      <Dialog
        open={editDialog !== null}
        onOpenChange={(open) => {
          if (!open) setEditDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le service</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(onSubmitEdit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input className="w-full" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Département</Label>
              <Controller
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner un département" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((department) => (
                        <SelectItem
                          key={department.id}
                          value={String(department.id)}
                        >
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.departmentId && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.departmentId.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Annuler
                </Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Spinner className="mr-2" />
                    Modification en cours...
                  </>
                ) : (
                  "Modifier"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Confirmation suppression ---- */}
      <Dialog
        open={confirmDeleteDialog !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Cette action est irréversible. Voulez-vous vraiment supprimer le
            service <strong>{confirmDeleteDialog?.name}</strong> ?
          </p>

          <div className="flex items-center justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" disabled={isDeleting}>
                Annuler
              </Button>
            </DialogClose>

            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmDeleteDialog) return;
                void onConfirmDelete(confirmDeleteDialog);
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Spinner className="mr-2" /> Suppression en cours...
                </>
              ) : (
                "Confirmer"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
