"use client";

import DepartmentsTable from "@/src/components/admin/departments-table";
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
import { Spinner } from "@/src/components/ui/spinner";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDepartments } from "@/src/hooks/use-departments";
import { showErrorToast } from "@/src/lib/show-error-toast";
import { emitAdminDataRefresh } from "@/src/lib/admin-data-refresh";
import { CirclePlus } from "lucide-react";

const departmentFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom ne doit pas dépasser 120 caractères."),
});

type FormValues = z.infer<typeof departmentFormSchema>;

export default function DepartmentsAdminPage() {
  const [open, setOpen] = useState(false);
  const { createDepartment, error } = useDepartments();

  const form = useForm<FormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: { name: "" } as FormValues,
  });

  const onSubmit = async (data: FormValues) => {
    const ok = await createDepartment({ name: data.name });
    if (ok) {
      emitAdminDataRefresh("departments");
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
            Gestion des Départements
          </h2>
        </CardTitle>

        <CardDescription>
          Visualiez, créer, modifier ou encore supprimer les Départements de
          l'organisation.
        </CardDescription>

        <CardAction>
          <Button onClick={() => setOpen(true)}>
            <CirclePlus />
            Créer un département
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <DepartmentsTable />
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="hidden md:block">Créer un département</span>
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
