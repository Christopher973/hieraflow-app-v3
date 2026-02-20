"use client";

import SectorsTable from "@/src/components/admin/sectors-table";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
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
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSectors } from "@/src/hooks/use-sectors";
import { useDepartments } from "@/src/hooks/use-departments";
import { showErrorToast } from "@/src/lib/show-error-toast";
import { emitAdminDataRefresh } from "@/src/lib/admin-data-refresh";
import { CirclePlus } from "lucide-react";

const sectorFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom ne doit pas dépasser 120 caractères."),
  departmentId: z.string().min(1, "Le département est obligatoire."),
});

type SectorFormInput = z.input<typeof sectorFormSchema>;
type SectorFormValues = z.output<typeof sectorFormSchema>;

export default function SectorsAdminPage() {
  const [open, setOpen] = useState(false);
  const { createSector, error } = useSectors();
  const { items: departments } = useDepartments({ page: 1, pageSize: 50 });

  const form = useForm<SectorFormInput, unknown, SectorFormValues>({
    resolver: zodResolver(sectorFormSchema),
    defaultValues: { name: "", departmentId: "" },
  });

  const onSubmit = async (data: SectorFormValues) => {
    const ok = await createSector({
      name: data.name,
      departmentId: Number(data.departmentId),
    });
    if (ok) {
      emitAdminDataRefresh("sectors");
      setOpen(false);
      form.reset();
    }
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
            Gestion des secteurs
          </h2>
        </CardTitle>

        <CardDescription>
          Visualiez, créer, modifier ou encore supprimer les secteurs des
          départements de l'organisation.
        </CardDescription>

        <CardAction>
          <Button onClick={() => setOpen(true)}>
            <CirclePlus />
            Créer un secteur
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <SectorsTable />
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="hidden md:block">Créer un secteur</span>
            </DialogTitle>
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

            <div className="space-y-2">
              <Label>Département</Label>
              <Controller
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <Select
                    value={
                      typeof field.value === "string"
                        ? field.value
                        : field.value
                          ? String(field.value)
                          : ""
                    }
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner un département" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
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
