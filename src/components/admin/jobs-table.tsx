"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  SearchIcon,
  XIcon,
} from "lucide-react";

import CleanTagInput from "@/src/components/ui/clean-tag-input";
import { useCollaborators } from "@/src/hooks/use-collaborators";
import { useDepartments } from "@/src/hooks/use-departments";
import { usePositions } from "@/src/hooks/use-positions";
import { useSectors } from "@/src/hooks/use-sectors";
import type { PositionDto, PositionType } from "@/src/types/position";
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
import { Label } from "@/src/components/ui/field";
import { Input } from "@/src/components/ui/input";
import {
  SearchField,
  SearchFieldClear,
  SearchFieldInput,
} from "@/src/components/ui/searchfield";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Spinner } from "@/src/components/ui/spinner";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/src/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  ADMIN_DATA_REFRESH_EVENT,
  emitAdminDataRefresh,
  isAdminEntityRefreshEvent,
} from "@/src/lib/admin-data-refresh";
import { showErrorToast } from "@/src/lib/show-error-toast";

const FORM_POSITION_TYPES = [
  "DIRECTEUR",
  "ASSISTANT",
  "COLLABORATEUR",
] as const;

const positionTypeLabels: Record<PositionType, string> = {
  DIRECTEUR: "Directeur",
  SOUS_DIRECTEUR: "Sous-directeur",
  CHEF_SERVICE: "Chef de service",
  RESPONSABLE: "Responsable",
  COLLABORATEUR: "Collaborateur",
  ASSISTANT: "Assistant",
};

const editPositionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Le nom du poste est obligatoire.")
      .max(100, "Le nom du poste ne doit pas dépasser 100 caractères."),
    type: z.enum(FORM_POSITION_TYPES, {
      message: "Le type de poste est obligatoire.",
    }),
    departmentId: z.string().min(1, "Le département est obligatoire."),
    sectorId: z.string().default(""),
    parentPositionId: z.string().default("none"),
    assignedCollaboratorId: z.string().default("none"),
    jobDetails: z
      .array(z.string().trim().min(1, "Un détail ne peut pas être vide."))
      .max(10, "Vous pouvez renseigner au maximum 10 détails.")
      .default([]),
  })
  .superRefine((values, ctx) => {
    if (values.type !== "DIRECTEUR" && values.sectorId.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sectorId"],
        message: "Le secteur est obligatoire.",
      });
    }
  });

type EditPositionValues = z.infer<typeof editPositionSchema>;
type EditPositionInput = z.input<typeof editPositionSchema>;

export default function JobsTable() {
  const [searchValue, setSearchValue] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [vacantOnlyFilter, setVacantOnlyFilter] = useState<
    "all" | "true" | "false"
  >("all");
  const [page, setPage] = useState(1);

  const [editDialog, setEditDialog] = useState<PositionDto | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteDialog, setConfirmDeleteDialog] =
    useState<PositionDto | null>(null);
  const [selectedPositionType, setSelectedPositionType] =
    useState<(typeof FORM_POSITION_TYPES)[number]>("COLLABORATEUR");

  const query = useMemo(
    () => ({
      q: searchValue.trim() || undefined,
      departmentId:
        departmentFilter === "all" ? undefined : Number(departmentFilter),
      sectorId: sectorFilter === "all" ? undefined : Number(sectorFilter),
      vacantOnly:
        vacantOnlyFilter === "all" ? undefined : vacantOnlyFilter === "true",
      page,
      pageSize: 10,
    }),
    [searchValue, departmentFilter, sectorFilter, vacantOnlyFilter, page],
  );

  const {
    items,
    loading,
    error,
    refresh,
    pagination,
    updatePosition,
    deletePosition,
  } = usePositions(query);

  const { updateCollaborator } = useCollaborators();
  const { items: departments } = useDepartments({ page: 1, pageSize: 50 });
  const { items: sectors } = useSectors({
    departmentId:
      departmentFilter === "all" ? undefined : Number(departmentFilter),
    page: 1,
    pageSize: 50,
  });
  const { items: allPositions } = usePositions({ page: 1, pageSize: 100 });
  const { items: collaborators } = useCollaborators({
    page: 1,
    pageSize: 50,
  });

  const [editDepartmentId, setEditDepartmentId] = useState<string>("");
  const { items: editSectors } = useSectors({
    page: 1,
    pageSize: 50,
    departmentId: editDepartmentId ? Number(editDepartmentId) : undefined,
  });

  const form = useForm<EditPositionInput, unknown, EditPositionValues>({
    resolver: zodResolver(editPositionSchema),
    defaultValues: {
      name: "",
      type: "COLLABORATEUR",
      departmentId: "",
      sectorId: "",
      parentPositionId: "none",
      assignedCollaboratorId: "none",
      jobDetails: [],
    },
  });

  const watchedSectorId = form.watch("sectorId");

  const isDepartmentDirector = selectedPositionType === "DIRECTEUR";

  const openEditDialog = (position: PositionDto) => {
    const relatedDepartment = departments.find(
      (department) => department.name === position.departmentName,
    );
    const departmentId = relatedDepartment ? String(relatedDepartment.id) : "";

    setEditDepartmentId(departmentId);

    const assigned = collaborators.find(
      (collaborator) => collaborator.positionId === position.id,
    );

    form.reset({
      name: position.name,
      type: (() => {
        const resolvedType =
          position.type === "DIRECTEUR" ||
          position.type === "ASSISTANT" ||
          position.type === "COLLABORATEUR"
            ? position.type
            : "COLLABORATEUR";
        setSelectedPositionType(resolvedType);
        return resolvedType;
      })(),
      departmentId,
      sectorId: position.sectorId ? String(position.sectorId) : "",
      parentPositionId:
        position.parentPositionId === null
          ? "none"
          : String(position.parentPositionId),
      assignedCollaboratorId: assigned ? String(assigned.id) : "none",
      jobDetails: position.jobDetails ?? [],
    });

    setEditDialog(position);
  };

  const onSubmitEdit = async (data: EditPositionValues) => {
    if (!editDialog) return;

    const result = await updatePosition(editDialog.id, {
      name: data.name,
      type: data.type as PositionType,
      departmentId: Number(data.departmentId),
      sectorId: data.type === "DIRECTEUR" ? null : Number(data.sectorId),
      parentPositionId:
        data.parentPositionId === "none" ? null : Number(data.parentPositionId),
      isPrimary: false,
      jobDetails: data.jobDetails.length ? data.jobDetails : null,
    });

    if (!result.success) {
      showErrorToast({
        title: "Mise à jour impossible",
        description: result.error ?? "Impossible de mettre à jour le poste.",
      });
      return;
    }

    if (data.assignedCollaboratorId !== "none") {
      const assigned = await updateCollaborator(
        Number(data.assignedCollaboratorId),
        {
          positionId: editDialog.id,
        },
      );

      if (!assigned) {
        showErrorToast({
          title: "Assignation partielle",
          description:
            "Le poste a été mis à jour mais l'assignation du collaborateur a échoué.",
        });
      }
    }

    emitAdminDataRefresh("positions");
    emitAdminDataRefresh("collaborators");
    setEditDialog(null);
  };

  const onDelete = async (id: number) => {
    setDeletingId(id);

    const result = await deletePosition(id);

    if (!result.success) {
      showErrorToast({
        title: "Suppression impossible",
        description: result.error ?? "Impossible de supprimer le poste.",
      });
      setDeletingId(null);
      return;
    }

    emitAdminDataRefresh("positions");
    setDeletingId(null);
    setConfirmDeleteDialog(null);
  };

  useEffect(() => {
    if (!error) return;

    showErrorToast({
      title: "Chargement impossible",
      description: error,
    });
  }, [error]);

  useEffect(() => {
    const onRefresh = (event: Event) => {
      if (!isAdminEntityRefreshEvent(event, "positions")) return;
      void refresh();
    };

    window.addEventListener(ADMIN_DATA_REFRESH_EVENT, onRefresh);

    return () => {
      window.removeEventListener(ADMIN_DATA_REFRESH_EVENT, onRefresh);
    };
  }, [refresh]);

  const totalPages = pagination?.totalPages ?? 1;
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <SearchField
          className="w-full"
          value={searchValue}
          onChange={(value) => {
            setSearchValue(value);
            setPage(1);
          }}
        >
          <div className="relative flex h-10 w-full items-center overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-sm">
            <SearchIcon aria-hidden className="size-4 text-muted-foreground" />
            <SearchFieldInput placeholder="Rechercher un poste" />
            <SearchFieldClear>
              <XIcon aria-hidden className="size-4" />
            </SearchFieldClear>
          </div>
        </SearchField>

        <Select
          onValueChange={(value) => {
            setDepartmentFilter(value);
            setSectorFilter("all");
            setPage(1);
          }}
        >
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

        <Select
          onValueChange={(value) => {
            setSectorFilter(value);
            setPage(1);
          }}
          disabled={departmentFilter === "all"}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                departmentFilter === "all"
                  ? "Sélectionnez d'abord un département"
                  : "Filtrer par secteur"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les secteurs</SelectItem>
            {sectors.map((sector) => (
              <SelectItem key={sector.id} value={String(sector.id)}>
                {sector.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(value) => {
            setVacantOnlyFilter(value as "all" | "true" | "false");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filtrer par poste vacant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="true">Uniquement vacants</SelectItem>
            <SelectItem value="false">Uniquement occupés</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
            <EmptyTitle>Aucun poste</EmptyTitle>
            <EmptyDescription>
              Ajoutez un premier poste ou ajustez vos filtres.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">
            {items.length} poste
            {items.length > 1 ? "s" : ""} au total
          </p>

          <div className="overflow-hidden rounded-md border mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Secteur</TableHead>
                  <TableHead>Occupant</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell>{position.name}</TableCell>
                    <TableCell>{positionTypeLabels[position.type]}</TableCell>
                    <TableCell>{position.departmentName}</TableCell>
                    <TableCell>
                      {position.sectorName || "Tous les secteurs"}
                    </TableCell>
                    <TableCell>{position.memberName ?? "Vacant"}</TableCell>
                    <TableCell>
                      {new Date(position.createdAt).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
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
                            onClick={() => openEditDialog(position)}
                          >
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirmDeleteDialog(position)}
                          >
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {page} / {totalPages}
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => current - 1)}
            disabled={!canGoPrevious}
          >
            <ArrowLeft />
            <span className="hidden md:block">Précédent</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => current + 1)}
            disabled={!canGoNext}
          >
            <span className="hidden md:block">Suivant</span>
            <ArrowRight />
          </Button>
        </div>
      </div>

      <Dialog
        open={editDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialog(null);
            setEditDepartmentId("");
            setSelectedPositionType("COLLABORATEUR");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le poste</DialogTitle>
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type de poste</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedPositionType(
                          value as (typeof FORM_POSITION_TYPES)[number],
                        );
                        if (value === "DIRECTEUR") {
                          form.setValue("sectorId", "");
                          form.setValue("parentPositionId", "none");
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner un type" />
                      </SelectTrigger>
                      <SelectContent>
                        {FORM_POSITION_TYPES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option === "DIRECTEUR"
                              ? "Directeur de département"
                              : positionTypeLabels[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Département</Label>
                <Controller
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setEditDepartmentId(value);
                        form.setValue("sectorId", "");
                      }}
                    >
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

              <div className="space-y-2">
                <Label>Secteur</Label>
                <Controller
                  control={form.control}
                  name="sectorId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!editDepartmentId || isDepartmentDirector}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            isDepartmentDirector
                              ? "Non applicable pour un directeur"
                              : editDepartmentId
                                ? "Sélectionner un secteur"
                                : "Sélectionnez d'abord un département"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {editSectors.map((sector) => (
                          <SelectItem key={sector.id} value={String(sector.id)}>
                            {sector.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.sectorId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.sectorId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Collaborateur assigné</Label>
                <Controller
                  control={form.control}
                  name="assignedCollaboratorId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Aucun" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {collaborators.map((collaborator) => (
                          <SelectItem
                            key={collaborator.id}
                            value={String(collaborator.id)}
                          >
                            {collaborator.firstname} {collaborator.lastname}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Poste parent</Label>
              <Controller
                control={form.control}
                name="parentPositionId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={
                      isDepartmentDirector ||
                      !watchedSectorId ||
                      watchedSectorId === ""
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {allPositions
                        .filter(
                          (position) =>
                            position.id !== editDialog?.id &&
                            String(position.sectorId ?? "") === watchedSectorId,
                        )
                        .map((position) => (
                          <SelectItem
                            key={position.id}
                            value={String(position.id)}
                          >
                            {position.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Controller
                control={form.control}
                name="jobDetails"
                render={({ field }) => (
                  <CleanTagInput
                    value={field.value}
                    onChange={field.onChange}
                    maxTags={10}
                    label="Détails du poste"
                  />
                )}
              />
              {form.formState.errors.jobDetails && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.jobDetails.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
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
            poste <strong>{confirmDeleteDialog?.name}</strong> ?
          </p>

          <div className="flex items-center justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" disabled={deletingId !== null}>
                Annuler
              </Button>
            </DialogClose>

            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmDeleteDialog) return;
                void onDelete(confirmDeleteDialog.id);
              }}
              disabled={deletingId !== null}
            >
              {deletingId !== null ? (
                <>
                  <Spinner className="mr-2" /> Suppression...
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
