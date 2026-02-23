"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  SearchIcon,
  Upload,
  X,
  XIcon,
  Check,
} from "lucide-react";

import { useCollaborators } from "@/src/hooks/use-collaborators";
import {
  deleteCollaboratorAvatarAction,
  uploadCollaboratorAvatarAction,
} from "@/src/actions/admin/collaborator-avatar";
import { useImageUpload } from "@/src/hooks/use-image-upload";
import { useDepartments } from "@/src/hooks/use-departments";
import { useLocations } from "@/src/hooks/use-locations";
import { usePositions } from "@/src/hooks/use-positions";
import { useSectors } from "@/src/hooks/use-sectors";
import type { CollaboratorDto } from "@/src/types/collaborator";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Badge } from "@/src/components/ui/badge";
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
import { PhoneInput } from "@/src/components/ui/phone-input";
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
import { getNameFallback } from "@/src/lib/utils";

const genderOptions = ["HOMME", "FEMME", "AUTRE"] as const;

const genderLabels: Record<(typeof genderOptions)[number], string> = {
  HOMME: "Homme",
  FEMME: "Femme",
  AUTRE: "Autre",
};

const editCollaboratorSchema = z
  .object({
    serviceCode: z.string().trim().min(1, "Le matricule est obligatoire."),
    firstname: z.string().trim().min(1, "Le prénom est obligatoire."),
    lastname: z.string().trim().min(1, "Le nom est obligatoire."),
    professionalEmail: z
      .string()
      .trim()
      .email("L'email professionnel est invalide."),
    phone: z.string().trim().optional().nullable(),
    birthday: z.string().optional().default(""),
    startDate: z
      .string()
      .min(1, "La date d'entrée est obligatoire.")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La date d'entrée est invalide."),
    endDate: z.string().optional().default(""),
    gender: z.enum(genderOptions),
    isReferentRH: z.enum(["true", "false"]).default("false"),
    locationId: z.string().min(1, "La localisation est obligatoire."),
  })
  .superRefine((value, context) => {
    if (!value.endDate) return;

    const startDate = new Date(value.startDate);
    const endDate = new Date(value.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La date de fin est invalide.",
        path: ["endDate"],
      });
      return;
    }

    if (endDate < startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "La date de fin ne peut pas être antérieure à la date d'entrée.",
        path: ["endDate"],
      });
    }
  });

type EditCollaboratorValues = z.infer<typeof editCollaboratorSchema>;
type EditCollaboratorInput = z.input<typeof editCollaboratorSchema>;

export default function CollaboratorsTable() {
  const [searchValue, setSearchValue] = useState("");
  const [genderFilter, setGenderFilter] = useState<
    "all" | (typeof genderOptions)[number]
  >("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [rhFilter, setRhFilter] = useState<"all" | "true" | "false">("all");
  const [page, setPage] = useState(1);

  // Colonnes optionnelles affichables
  const optionalFieldOptions = [
    { key: "serviceCode", label: "Matricule" },
    { key: "birthday", label: "Date de naissance" },
    { key: "startDate", label: "Date d'entrée" },
    { key: "endDate", label: "Date de sortie prévue" },
    { key: "phone", label: "Numéro de téléphone" },
    { key: "gender", label: "Genre" },
    { key: "positionsCount", label: "Nombre de poste" },
  ] as const;

  const [visibleOptionalFields, setVisibleOptionalFields] = useState<string[]>(
    [],
  );

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "-";
    try {
      const datePart = String(value).slice(0, 10); // YYYY-MM-DD
      const [year, month, day] = datePart.split("-");
      if (year && month && day) return `${day}/${month}/${year}`;
    } catch {}
    // Fallback
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("fr-FR");
  };

  const toggleOptionalField = (key: string) => {
    setVisibleOptionalFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const [editDialog, setEditDialog] = useState<CollaboratorDto | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteDialog, setConfirmDeleteDialog] =
    useState<CollaboratorDto | null>(null);
  const [shouldDeleteAvatar, setShouldDeleteAvatar] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

  const query = useMemo(
    () => ({
      q: searchValue.trim() || undefined,
      gender: genderFilter === "all" ? undefined : genderFilter,
      locationId: locationFilter === "all" ? undefined : Number(locationFilter),
      departmentId:
        departmentFilter === "all" ? undefined : Number(departmentFilter),
      sectorId: sectorFilter === "all" ? undefined : Number(sectorFilter),
      positionId: positionFilter === "all" ? undefined : Number(positionFilter),
      isReferentRH: rhFilter === "all" ? undefined : rhFilter === "true",
      page,
      pageSize: 10,
    }),
    [
      searchValue,
      genderFilter,
      locationFilter,
      departmentFilter,
      sectorFilter,
      positionFilter,
      rhFilter,
      page,
    ],
  );

  const {
    items,
    loading,
    error,
    pagination,
    refresh,
    updateCollaborator,
    deleteCollaborator,
  } = useCollaborators(query);

  const { items: locations } = useLocations({ page: 1, pageSize: 50 });
  const { items: departments } = useDepartments({ page: 1, pageSize: 50 });
  const { items: sectors } = useSectors({
    page: 1,
    pageSize: 50,
    departmentId:
      departmentFilter === "all" ? undefined : Number(departmentFilter),
  });
  const { items: positions } = usePositions({
    page: 1,
    pageSize: 100,
    sectorId: sectorFilter === "all" ? undefined : Number(sectorFilter),
  });

  const form = useForm<EditCollaboratorInput, unknown, EditCollaboratorValues>({
    resolver: zodResolver(editCollaboratorSchema),
    defaultValues: {
      serviceCode: "",
      firstname: "",
      lastname: "",
      professionalEmail: "",
      phone: "",
      birthday: "",
      startDate: "",
      endDate: "",
      gender: "AUTRE",
      isReferentRH: "false",
      locationId: "",
    },
  });

  const {
    file: editAvatarFile,
    previewUrl: editAvatarPreviewUrl,
    fileName: editAvatarFileName,
    error: editAvatarError,
    fileInputRef: editAvatarFileInputRef,
    handleThumbnailClick: handleEditAvatarThumbnailClick,
    handleFileChange: handleEditAvatarFileChange,
    handleRemove: handleEditAvatarRemove,
    setInitialPreview: setEditAvatarInitialPreview,
    reset: resetEditAvatarUpload,
  } = useImageUpload({
    onFileSelect: (file) => {
      if (file) {
        setShouldDeleteAvatar(false);
      }
    },
  });

  const [watchedFirstname, watchedLastname] = useWatch({
    control: form.control,
    name: ["firstname", "lastname"],
  });

  const collaboratorFullName =
    `${watchedFirstname ?? ""} ${watchedLastname ?? ""}`.trim();
  const avatarFallback = getNameFallback(
    collaboratorFullName || "Collaborateur",
  );

  const openEditDialog = (collaborator: CollaboratorDto) => {
    form.reset({
      serviceCode: collaborator.serviceCode,
      firstname: collaborator.firstname,
      lastname: collaborator.lastname,
      professionalEmail: collaborator.professionalEmail,
      phone: collaborator.phone ?? "",
      birthday: collaborator.birthday ? collaborator.birthday.slice(0, 10) : "",
      startDate: collaborator.startDate
        ? collaborator.startDate.slice(0, 10)
        : "",
      endDate: collaborator.endDate ? collaborator.endDate.slice(0, 10) : "",
      gender: collaborator.gender,
      isReferentRH: collaborator.isReferentRH ? "true" : "false",
      locationId: collaborator.locationId
        ? String(collaborator.locationId)
        : "",
    });

    setShouldDeleteAvatar(false);
    setEditAvatarInitialPreview(collaborator.avatarUrl ?? null);
    setEditDialog(collaborator);
  };

  const onSubmitEdit = async (data: EditCollaboratorValues) => {
    if (!editDialog) return;

    const patch: {
      serviceCode?: string;
      firstname?: string;
      lastname?: string;
      professionalEmail?: string;
      phone?: string | null;
      birthday?: string | null;
      startDate?: string;
      endDate?: string | null;
      gender?: "HOMME" | "FEMME" | "AUTRE";
      isReferentRH?: boolean;
      locationId?: number | null;
    } = {};

    const normalizedPhone = data.phone?.trim() ? data.phone.trim() : null;
    const currentPhone = editDialog.phone ?? null;

    const normalizedBirthday = data.birthday || null;
    const currentBirthday = editDialog.birthday
      ? editDialog.birthday.slice(0, 10)
      : null;

    const normalizedEndDate = data.endDate || null;
    const currentEndDate = editDialog.endDate
      ? editDialog.endDate.slice(0, 10)
      : null;

    const currentStartDate = editDialog.startDate
      ? editDialog.startDate.slice(0, 10)
      : "";

    const normalizedLocationId = Number(data.locationId);
    const currentLocationId = editDialog.locationId ?? null;

    if (data.serviceCode !== editDialog.serviceCode) {
      patch.serviceCode = data.serviceCode;
    }

    if (data.firstname !== editDialog.firstname) {
      patch.firstname = data.firstname;
    }

    if (data.lastname !== editDialog.lastname) {
      patch.lastname = data.lastname;
    }

    if (data.professionalEmail !== editDialog.professionalEmail) {
      patch.professionalEmail = data.professionalEmail;
    }

    if (normalizedPhone !== currentPhone) {
      patch.phone = normalizedPhone;
    }

    if (normalizedBirthday !== currentBirthday) {
      patch.birthday = normalizedBirthday;
    }

    if (data.startDate !== currentStartDate) {
      patch.startDate = data.startDate;
    }

    if (normalizedEndDate !== currentEndDate) {
      patch.endDate = normalizedEndDate;
    }

    if (data.gender !== editDialog.gender) {
      patch.gender = data.gender;
    }

    if ((data.isReferentRH === "true") !== editDialog.isReferentRH) {
      patch.isReferentRH = data.isReferentRH === "true";
    }

    if (normalizedLocationId !== currentLocationId) {
      patch.locationId = normalizedLocationId;
    }

    const hasProfileChanges = Object.keys(patch).length > 0;

    if (!hasProfileChanges && !editAvatarFile && !shouldDeleteAvatar) {
      setEditDialog(null);
      return;
    }

    const ok = hasProfileChanges
      ? await updateCollaborator(editDialog.id, patch)
      : true;

    if (!ok) {
      showErrorToast({
        title: "Mise à jour impossible",
        description: "Impossible de mettre à jour le collaborateur.",
      });
      return;
    }

    if (editAvatarFile) {
      setIsAvatarUploading(true);
      const avatarFormData = new FormData();
      avatarFormData.set("collaboratorId", String(editDialog.id));
      avatarFormData.set("file", editAvatarFile);

      try {
        const uploadResult =
          await uploadCollaboratorAvatarAction(avatarFormData);

        if (uploadResult.errors && uploadResult.errors.length > 0) {
          showErrorToast({
            title: "Mise à jour partielle",
            description:
              uploadResult.errors[0]?.detail ??
              "Le téléversement de l'avatar a échoué.",
          });
        }
      } catch {
        showErrorToast({
          title: "Mise à jour partielle",
          description:
            "Une erreur inattendue est survenue pendant le téléversement de l'avatar.",
        });
      } finally {
        setIsAvatarUploading(false);
      }
    }

    if (shouldDeleteAvatar) {
      const avatarDeleteFormData = new FormData();
      avatarDeleteFormData.set("collaboratorId", String(editDialog.id));

      const deleteResult =
        await deleteCollaboratorAvatarAction(avatarDeleteFormData);

      if (deleteResult.errors && deleteResult.errors.length > 0) {
        showErrorToast({
          title: "Mise à jour partielle",
          description:
            deleteResult.errors[0]?.detail ??
            "La suppression de l'avatar a échoué.",
        });
      }
    }

    emitAdminDataRefresh("collaborators");
    setShouldDeleteAvatar(false);
    resetEditAvatarUpload(null);
    setEditDialog(null);
  };

  const onDelete = async (id: number) => {
    setDeletingId(id);
    const ok = await deleteCollaborator(id);

    if (!ok) {
      showErrorToast({
        title: "Suppression impossible",
        description: "Impossible de supprimer le collaborateur.",
      });
      setDeletingId(null);
      return;
    }

    emitAdminDataRefresh("collaborators");
    setDeletingId(null);
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
      if (!isAdminEntityRefreshEvent(event, "collaborators")) return;
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
      <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
        <SearchField
          className="w-full md:col-span-2"
          value={searchValue}
          onChange={(value) => {
            setSearchValue(value);
            setPage(1);
          }}
        >
          <div className="relative flex h-10 w-full items-center overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-sm">
            <SearchIcon aria-hidden className="size-4 text-muted-foreground" />
            <SearchFieldInput placeholder="Rechercher un collaborateur" />
            <SearchFieldClear>
              <XIcon aria-hidden className="size-4" />
            </SearchFieldClear>
          </div>
        </SearchField>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Colonnes</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Afficher les colonnes</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {optionalFieldOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.key}
                onClick={() => toggleOptionalField(opt.key)}
              >
                {visibleOptionalFields.includes(opt.key) ? (
                  <Check className="size-4 mr-2" />
                ) : (
                  <span className="w-4 mr-2" />
                )}
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select
          value={genderFilter}
          onValueChange={(value) => {
            setGenderFilter(value as "all" | (typeof genderOptions)[number]);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filtrer par genre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les genres</SelectItem>
            {genderOptions.map((gender) => (
              <SelectItem key={gender} value={gender}>
                {genderLabels[gender]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(value) => {
            setLocationFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filtrer par localisation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les localisations</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={String(location.id)}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(value) => {
            setDepartmentFilter(value);
            setSectorFilter("all");
            setPositionFilter("all");
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
          value={sectorFilter}
          onValueChange={(value) => {
            setSectorFilter(value);
            setPositionFilter("all");
            setPage(1);
          }}
          disabled={departmentFilter === "all"}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                departmentFilter === "all"
                  ? "Sélectionnez d'abord un département"
                  : "Filtrer par service"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les services</SelectItem>
            {sectors.map((sector) => (
              <SelectItem key={sector.id} value={String(sector.id)}>
                {sector.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={positionFilter}
          onValueChange={(value) => {
            setPositionFilter(value);
            setPage(1);
          }}
          disabled={sectorFilter === "all"}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                sectorFilter === "all"
                  ? "Sélectionnez d'abord un service"
                  : "Filtrer par poste"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les postes</SelectItem>
            {positions.map((position) => (
              <SelectItem key={position.id} value={String(position.id)}>
                {position.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(value) => {
            setRhFilter(value as "all" | "true" | "false");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filtrer par référent RH" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="true">Référent RH</SelectItem>
            <SelectItem value="false">Non référent RH</SelectItem>
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
            <EmptyTitle>Aucun collaborateur</EmptyTitle>
            <EmptyDescription>
              Ajoutez un premier collaborateur ou ajustez vos filtres.
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
                  <TableHead>Avatar</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Localisation</TableHead>
                  <TableHead>Poste principal</TableHead>
                  <TableHead>Référent RH</TableHead>
                  {visibleOptionalFields.map((key) => {
                    const opt = optionalFieldOptions.find((o) => o.key === key);
                    return <TableHead key={key}>{opt?.label ?? key}</TableHead>;
                  })}
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((collaborator) => (
                  <TableRow key={collaborator.id}>
                    <TableCell>
                      <Avatar>
                        {collaborator.avatarUrl ? (
                          <AvatarImage src={collaborator.avatarUrl} />
                        ) : (
                          <AvatarFallback>
                            {getNameFallback(
                              `${collaborator.firstname} ${collaborator.lastname}`,
                            )}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    </TableCell>

                    <TableCell>
                      {collaborator.firstname} {collaborator.lastname}
                    </TableCell>

                    <TableCell>{collaborator.professionalEmail}</TableCell>

                    <TableCell>{collaborator.locationName ?? "-"}</TableCell>

                    <TableCell>
                      {collaborator.positionName ?? "Aucun"}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          collaborator.isReferentRH ? "default" : "secondary"
                        }
                      >
                        {collaborator.isReferentRH ? "Oui" : "Non"}
                      </Badge>
                    </TableCell>

                    {visibleOptionalFields.map((key) => {
                      switch (key) {
                        case "serviceCode":
                          return (
                            <TableCell key={key}>
                              {collaborator.serviceCode}
                            </TableCell>
                          );
                        case "birthday":
                          return (
                            <TableCell key={key}>
                              {formatDate(collaborator.birthday)}
                            </TableCell>
                          );
                        case "startDate":
                          return (
                            <TableCell key={key}>
                              {formatDate(collaborator.startDate)}
                            </TableCell>
                          );
                        case "endDate":
                          return (
                            <TableCell key={key}>
                              {formatDate(collaborator.endDate)}
                            </TableCell>
                          );
                        case "phone":
                          return (
                            <TableCell key={key}>
                              {collaborator.phone ?? "-"}
                            </TableCell>
                          );
                        case "gender":
                          return (
                            <TableCell key={key}>
                              {collaborator.gender ?? "-"}
                            </TableCell>
                          );
                        case "positionsCount":
                          // Approximation: list endpoint exposes only primary positionId
                          return (
                            <TableCell key={key}>
                              {collaborator.positionId ? 1 : 0}
                            </TableCell>
                          );
                        default:
                          return <TableCell key={key}>-</TableCell>;
                      }
                    })}

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
                            onClick={() => openEditDialog(collaborator)}
                          >
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirmDeleteDialog(collaborator)}
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
            setShouldDeleteAvatar(false);
            resetEditAvatarUpload(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le collaborateur</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(onSubmitEdit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Matricule</Label>
                <Input className="w-full" {...form.register("serviceCode")} />
                {form.formState.errors.serviceCode && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.serviceCode.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Email professionnel</Label>
                <Input
                  type="email"
                  className="w-full"
                  {...form.register("professionalEmail")}
                />
                {form.formState.errors.professionalEmail && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.professionalEmail.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input className="w-full" {...form.register("firstname")} />
                {form.formState.errors.firstname && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.firstname.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Nom</Label>
                <Input className="w-full" {...form.register("lastname")} />
                {form.formState.errors.lastname && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.lastname.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Téléphone</Label>
                <Controller
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <PhoneInput
                      className="border rounded-md"
                      value={field.value ?? ""}
                      defaultCountry="FR"
                      onChange={(_, formattedValue) =>
                        field.onChange(formattedValue)
                      }
                    />
                  )}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Avatar (optionnel)</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage
                      className="h-full w-full object-cover object-center"
                      src={editAvatarPreviewUrl ?? undefined}
                    />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>

                  <div className="flex flex-col gap-2">
                    <Input
                      ref={editAvatarFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleEditAvatarFileChange}
                    />

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleEditAvatarThumbnailClick}
                      >
                        <Upload className="mr-2 size-4" />
                        Choisir une image
                      </Button>

                      {(editAvatarPreviewUrl || editAvatarFileName) && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            handleEditAvatarRemove();
                            if (editDialog?.avatarUrl) {
                              setShouldDeleteAvatar(true);
                            }
                          }}
                        >
                          <X className="mr-2 size-4" />
                          Retirer
                        </Button>
                      )}
                    </div>

                    {editAvatarFileName && (
                      <p className="text-sm text-muted-foreground">
                        {editAvatarFileName}
                      </p>
                    )}

                    {editAvatarError && (
                      <p className="text-sm text-destructive">
                        {editAvatarError}
                      </p>
                    )}

                    {shouldDeleteAvatar && (
                      <p className="text-sm text-muted-foreground">
                        L'avatar actuel sera supprimé à l'enregistrement.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Date de naissance</Label>
                <Input
                  type="date"
                  className="w-full"
                  {...form.register("birthday")}
                />
                {form.formState.errors.birthday && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.birthday.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Date d'entrée</Label>
                <Input
                  type="date"
                  className="w-full"
                  {...form.register("startDate")}
                />
                {form.formState.errors.startDate && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.startDate.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  className="w-full"
                  {...form.register("endDate")}
                />
                {form.formState.errors.endDate && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.endDate.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Genre</Label>
                <Controller
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {genderOptions.map((gender) => (
                          <SelectItem key={gender} value={gender}>
                            {genderLabels[gender]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Référent RH</Label>
                <Controller
                  control={form.control}
                  name="isReferentRH"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Non</SelectItem>
                        <SelectItem value="true">Oui</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Localisation</Label>
                <Controller
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner une localisation" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem
                            key={location.id}
                            value={String(location.id)}
                          >
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.locationId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.locationId.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || isAvatarUploading}
              >
                {form.formState.isSubmitting || isAvatarUploading ? (
                  <>
                    <Spinner className="mr-2" />
                    {isAvatarUploading
                      ? "Téléversement de l'avatar..."
                      : "Modification en cours..."}
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
            collaborateur{" "}
            <strong>
              {confirmDeleteDialog?.firstname} {confirmDeleteDialog?.lastname}
            </strong>{" "}
            ?
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
