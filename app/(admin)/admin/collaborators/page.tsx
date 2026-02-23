"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CirclePlus, Upload, X } from "lucide-react";

import CollaboratorsTable from "@/src/components/admin/collaborators-table";
import { uploadCollaboratorAvatarAction } from "@/src/actions/admin/collaborator-avatar";
import { useCollaborators } from "@/src/hooks/use-collaborators";
import { useImageUpload } from "@/src/hooks/use-image-upload";
import { useLocations } from "@/src/hooks/use-locations";
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
import { PhoneInput } from "@/src/components/ui/phone-input";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Spinner } from "@/src/components/ui/spinner";
import { emitAdminDataRefresh } from "@/src/lib/admin-data-refresh";
import { showErrorToast } from "@/src/lib/show-error-toast";
import { getNameFallback } from "@/src/lib/utils";

const collaboratorCreateFormSchema = z
  .object({
    serviceCode: z
      .string()
      .trim()
      .min(1, "Le matricule est obligatoire.")
      .max(50, "Le matricule ne doit pas dépasser 50 caractères."),
    firstname: z
      .string()
      .trim()
      .min(1, "Le prénom est obligatoire.")
      .max(100, "Le prénom ne doit pas dépasser 100 caractères."),
    lastname: z
      .string()
      .trim()
      .min(1, "Le nom est obligatoire.")
      .max(100, "Le nom ne doit pas dépasser 100 caractères."),
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
    gender: z.enum(["HOMME", "FEMME", "AUTRE"]),
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

type CollaboratorCreateFormInput = z.input<typeof collaboratorCreateFormSchema>;
type CollaboratorCreateFormValues = z.output<
  typeof collaboratorCreateFormSchema
>;

const genderLabels: Record<"HOMME" | "FEMME" | "AUTRE", string> = {
  HOMME: "Homme",
  FEMME: "Femme",
  AUTRE: "Autre",
};

export default function CollaboratorsAdminPage() {
  const [open, setOpen] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

  const { createCollaborator, error } = useCollaborators();
  const { items: locations } = useLocations({ page: 1, pageSize: 50 });

  const form = useForm<
    CollaboratorCreateFormInput,
    unknown,
    CollaboratorCreateFormValues
  >({
    resolver: zodResolver(collaboratorCreateFormSchema),
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

  const createAvatarUpload = useImageUpload();

  const collaboratorFullName =
    `${form.watch("firstname") ?? ""} ${form.watch("lastname") ?? ""}`.trim();
  const avatarFallback = getNameFallback(
    collaboratorFullName || "Collaborateur",
  );

  const onSubmit = async (data: CollaboratorCreateFormValues) => {
    const collaborator = await createCollaborator({
      serviceCode: data.serviceCode,
      firstname: data.firstname,
      lastname: data.lastname,
      professionalEmail: data.professionalEmail,
      phone: data.phone?.trim() ? data.phone.trim() : null,
      birthday: data.birthday || null,
      startDate: data.startDate,
      endDate: data.endDate || null,
      gender: data.gender,
      isReferentRH: data.isReferentRH === "true",
      locationId: Number(data.locationId),
      positionId: null,
      positionIds: [],
      primaryPositionId: null,
      avatarUrl: null,
      status: "ACTIF",
    });

    if (!collaborator) {
      showErrorToast({
        title: "Création impossible",
        description: "Impossible de créer le collaborateur.",
      });
      return;
    }

    if (createAvatarUpload.file) {
      setIsAvatarUploading(true);
      const avatarFormData = new FormData();
      avatarFormData.set("collaboratorId", String(collaborator.id));
      avatarFormData.set("file", createAvatarUpload.file);

      try {
        const uploadResult =
          await uploadCollaboratorAvatarAction(avatarFormData);

        if (uploadResult.errors && uploadResult.errors.length > 0) {
          showErrorToast({
            title: "Collaborateur créé, avatar non téléversé",
            description:
              uploadResult.errors[0]?.detail ??
              "Le téléversement de l'avatar a échoué.",
          });
        }
      } catch {
        showErrorToast({
          title: "Collaborateur créé, avatar non téléversé",
          description:
            "Une erreur inattendue est survenue pendant le téléversement de l'avatar.",
        });
      } finally {
        setIsAvatarUploading(false);
      }
    }

    emitAdminDataRefresh("collaborators");
    setOpen(false);
    createAvatarUpload.reset(null);
    form.reset();
  };

  useEffect(() => {
    if (!error) return;

    showErrorToast({
      title: "Création impossible",
      description: error,
    });
  }, [error]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-primary">
            Gestion des collaborateurs
          </h2>
        </CardTitle>

        <CardDescription>
          <p className="text-lg">
            Visualisez, créez, modifiez ou supprimez les collaborateurs de
            l'organisation.
          </p>
        </CardDescription>

        <CardAction>
          <Button onClick={() => setOpen(true)}>
            <CirclePlus />
            <span className="hidden md:block">Créer un collaborateur</span>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <CollaboratorsTable />
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);

          if (!value) {
            createAvatarUpload.reset(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un collaborateur</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      src={createAvatarUpload.previewUrl ?? undefined}
                    />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>

                  <div className="flex flex-col gap-2">
                    <Input
                      ref={createAvatarUpload.fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={createAvatarUpload.handleFileChange}
                    />

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={createAvatarUpload.handleThumbnailClick}
                      >
                        <Upload className="mr-2 size-4" />
                        Choisir une image
                      </Button>

                      {(createAvatarUpload.previewUrl ||
                        createAvatarUpload.fileName) && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={createAvatarUpload.handleRemove}
                        >
                          <X className="mr-2 size-4" />
                          Retirer
                        </Button>
                      )}
                    </div>

                    {createAvatarUpload.fileName && (
                      <p className="text-sm text-muted-foreground">
                        {createAvatarUpload.fileName}
                      </p>
                    )}

                    {createAvatarUpload.error && (
                      <p className="text-sm text-destructive">
                        {createAvatarUpload.error}
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
                        <SelectItem value="HOMME">
                          {genderLabels.HOMME}
                        </SelectItem>
                        <SelectItem value="FEMME">
                          {genderLabels.FEMME}
                        </SelectItem>
                        <SelectItem value="AUTRE">
                          {genderLabels.AUTRE}
                        </SelectItem>
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
                <Button variant="outline" type="button">
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
                      : "Création en cours..."}
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
