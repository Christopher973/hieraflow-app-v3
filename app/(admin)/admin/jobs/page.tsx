"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import JobsTable from "@/src/components/admin/jobs-table";
import CleanTagInput from "@/src/components/ui/clean-tag-input";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Label } from "@/src/components/ui/field";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Spinner } from "@/src/components/ui/spinner";
import { useCollaborators } from "@/src/hooks/use-collaborators";
import { useDepartments } from "@/src/hooks/use-departments";
import { usePositions } from "@/src/hooks/use-positions";
import { useSectors } from "@/src/hooks/use-sectors";
import type { PositionType } from "@/src/types/position";
import { emitAdminDataRefresh } from "@/src/lib/admin-data-refresh";
import { showErrorToast } from "@/src/lib/show-error-toast";
import { CirclePlus } from "lucide-react";

const CREATE_POSITION_TYPES = [
  "DIRECTEUR",
  "ASSISTANT",
  "COLLABORATEUR",
] as const;

const POSITION_PRIORITY_VALUES = ["primary", "secondary"] as const;

type CreatePositionType = (typeof CREATE_POSITION_TYPES)[number];

const createPositionFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Le nom du poste est obligatoire.")
      .max(100, "Le nom du poste ne doit pas dépasser 100 caractères."),
    type: z.enum(CREATE_POSITION_TYPES, {
      message: "Le type de poste est obligatoire.",
    }),
    departmentId: z.string().min(1, "Le département est obligatoire."),
    sectorId: z.string().default(""),
    parentPositionId: z.string().default("none"),
    assignedCollaboratorId: z.string().default("none"),
    isPrimary: z.enum(POSITION_PRIORITY_VALUES).default("secondary"),
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
        message: "Le service=  est obligatoire.",
      });
    }
  });

type CreatePositionFormInput = z.input<typeof createPositionFormSchema>;
type CreatePositionFormValues = z.output<typeof createPositionFormSchema>;

const positionTypeLabels: Record<CreatePositionType, string> = {
  DIRECTEUR: "Directeur de département",
  ASSISTANT: "Assistant",
  COLLABORATEUR: "Collaborateur",
};

export default function JobsAdminPage() {
  const [open, setOpen] = useState(false);
  const [selectedPositionType, setSelectedPositionType] =
    useState<CreatePositionType>("COLLABORATEUR");

  const { createPosition, error: positionsError } = usePositions();
  const { updateCollaborator, error: collaboratorsError } = useCollaborators();
  const { items: departments } = useDepartments({ page: 1, pageSize: 50 });
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const { items: sectors } = useSectors({
    page: 1,
    pageSize: 50,
    departmentId: selectedDepartmentId
      ? Number(selectedDepartmentId)
      : undefined,
  });
  const { items: positions } = usePositions({ page: 1, pageSize: 100 });
  const { items: collaborators } = useCollaborators({
    page: 1,
    pageSize: 50,
  });

  const availableParentPositions = useMemo(() => positions, [positions]);

  const form = useForm<
    CreatePositionFormInput,
    unknown,
    CreatePositionFormValues
  >({
    resolver: zodResolver(createPositionFormSchema),
    defaultValues: {
      name: "",
      type: "COLLABORATEUR",
      departmentId: "",
      sectorId: "",
      parentPositionId: "none",
      assignedCollaboratorId: "none",
      isPrimary: "secondary",
      jobDetails: [],
    },
  });

  const watchedSectorId = form.watch("sectorId");

  const isDepartmentDirector = selectedPositionType === "DIRECTEUR";

  const onSubmit = async (data: CreatePositionFormValues) => {
    const created = await createPosition({
      name: data.name,
      type: data.type as PositionType,
      isPrimary: data.isPrimary === "primary",
      departmentId: Number(data.departmentId),
      sectorId: data.type === "DIRECTEUR" ? null : Number(data.sectorId),
      parentPositionId:
        data.parentPositionId === "none" ? null : Number(data.parentPositionId),
      jobDetails: data.jobDetails.length ? data.jobDetails : null,
    });

    if (!created.success || !created.data) {
      showErrorToast({
        title: "Création impossible",
        description: created.error ?? "Impossible de créer le poste.",
      });
      return;
    }

    if (data.assignedCollaboratorId !== "none") {
      const assigned = await updateCollaborator(
        Number(data.assignedCollaboratorId),
        {
          positionId: created.data.id,
        },
      );

      if (!assigned) {
        showErrorToast({
          title: "Assignation partielle",
          description:
            "Le poste a été créé mais l'assignation du collaborateur a échoué.",
        });
      }
    }

    emitAdminDataRefresh("positions");
    emitAdminDataRefresh("collaborators");
    setOpen(false);
    setSelectedDepartmentId("");
    setSelectedPositionType("COLLABORATEUR");
    form.reset();
  };

  useEffect(() => {
    if (!positionsError) return;

    showErrorToast({
      title: "Chargement impossible",
      description: positionsError,
    });
  }, [positionsError]);

  useEffect(() => {
    if (!collaboratorsError) return;

    showErrorToast({
      title: "Chargement impossible",
      description: collaboratorsError,
    });
  }, [collaboratorsError]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-primary">
            Gestion des Postes
          </h2>
        </CardTitle>

        <CardDescription>
          <p className="text-lg">
            Visualisez, créez, modifiez ou supprimez les postes des
            collaborateurs de l'organisation.
          </p>
        </CardDescription>

        <CardAction>
          <Button onClick={() => setOpen(true)}>
            <CirclePlus />
            <span className="hidden md:block">Créer un poste</span>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <JobsTable />
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setSelectedPositionType("COLLABORATEUR");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un poste</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        setSelectedPositionType(value as CreatePositionType);
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
                        {CREATE_POSITION_TYPES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {positionTypeLabels[option]}
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
                        setSelectedDepartmentId(value);
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
                <Label>Sevice</Label>
                <Controller
                  control={form.control}
                  name="sectorId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedDepartmentId || isDepartmentDirector}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            isDepartmentDirector
                              ? "Non applicable pour un directeur"
                              : selectedDepartmentId
                                ? "Sélectionner un service"
                                : "Sélectionnez d'abord un département"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map((sector) => (
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

              <div className="space-y-2">
                <Label>Nature du poste</Label>
                <Controller
                  control={form.control}
                  name="isPrimary"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner la nature du poste" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Poste principal</SelectItem>
                        <SelectItem value="secondary">
                          Poste secondaire
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Poste parent (optionnel)</Label>
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
                      <SelectValue placeholder="Aucun poste parent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {availableParentPositions
                        .filter((position) => {
                          const sameSector =
                            String(position.sectorId ?? "") === watchedSectorId;
                          const isDeptDirector =
                            position.sectorId === null &&
                            selectedDepartmentId &&
                            position.departmentId ===
                              Number(selectedDepartmentId);
                          return sameSector || isDeptDirector;
                        })
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
                    helperText="Jusqu'à 10 détails. Entrée pour ajouter, Backspace pour retirer le dernier."
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
                <Button variant="outline" type="button">
                  Annuler
                </Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Spinner className="mr-2" />
                    Création en cours...
                  </>
                ) : (
                  "Créer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
