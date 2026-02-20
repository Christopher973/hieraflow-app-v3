"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { useFileInput } from "@/src/hooks/use-file-input";
import { cn } from "@/src/lib/utils";
import {
  Import,
  Loader2,
  MessageCircleQuestionMark,
  CheckCircle2Icon,
  XIcon,
  CircleX,
  CircleCheck,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/components/ui/alert-dialog";
import { parseAndValidateCsv } from "@/src/lib/import/parse-csv";
import type { ImportResult } from "@/src/lib/import/types";
import type {
  ImportJobPayload,
  ImportPersistPayload,
  ImportStartPayload,
} from "@/src/types/import";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { toast } from "sonner";
import type { ApiResponse } from "@/src/types/api";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
import { Progress } from "@/src/components/ui/progress";

type UploadStage = "idle" | "parsing" | "uploading" | "persisting" | "done";

const buildApiErrorMessage = (response: ApiResponse<unknown>) => {
  if (!response.errors || response.errors.length === 0) {
    return response.message ?? "Erreur inconnue pendant l'import.";
  }

  return (
    response.errors
      .map((error) => error.detail || error.code)
      .filter(Boolean)
      .join("\n") || "Erreur inconnue pendant l'import."
  );
};

const postImportWithProgress = (
  payload: unknown,
  onProgress: (percent: number) => void,
): Promise<{ data: ImportStartPayload | null; error: string | null }> => {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", "/api/import");
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "application/json");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;

      const percent = Math.min(
        100,
        Math.round((event.loaded / event.total) * 100),
      );

      onProgress(percent);
    };

    xhr.onerror = () => {
      resolve({
        data: null,
        error: "Impossible d'envoyer les données vers le serveur.",
      });
    };

    xhr.onload = () => {
      let parsed: ApiResponse<ImportStartPayload> | null = null;

      try {
        parsed = JSON.parse(
          xhr.responseText,
        ) as ApiResponse<ImportStartPayload>;
      } catch {
        resolve({
          data: null,
          error: "Réponse serveur non lisible.",
        });
        return;
      }

      if (xhr.status >= 400 || parsed.errors) {
        resolve({
          data: parsed.data,
          error: buildApiErrorMessage(parsed),
        });
        return;
      }

      resolve({
        data: parsed.data,
        error: null,
      });
    };

    xhr.send(
      JSON.stringify({
        payload,
      }),
    );
  });
};

export function UploadFile() {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const { fileName, file, error, fileInputRef, handleFileSelect, clearFile } =
    useFileInput({
      accept: ".csv",
      maxSize: 10,
    });

  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [serverPhaseMessage, setServerPhaseMessage] = useState<string>("");
  const hideProgressTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideProgressTimeoutRef.current !== null) {
        window.clearTimeout(hideProgressTimeoutRef.current);
      }
    };
  }, []);

  const pollImportJobStatus = async (jobId: string) => {
    while (true) {
      const response = await fetch(`/api/import/status/${jobId}`, {
        method: "GET",
        credentials: "include",
      });

      let payload: ApiResponse<ImportJobPayload>;

      try {
        payload = (await response.json()) as ApiResponse<ImportJobPayload>;
      } catch {
        return {
          data: null,
          error: "Réponse serveur non lisible.",
        };
      }

      if (!response.ok || payload.errors) {
        return {
          data: null,
          error: buildApiErrorMessage(payload),
        };
      }

      const job = payload.data?.job;

      if (!job) {
        return {
          data: null,
          error: "Réponse serveur incomplète pour le suivi du job.",
        };
      }

      setUploadStage(job.status === "completed" ? "done" : "persisting");
      setServerPhaseMessage(job.progress.message ?? "");
      setUploadProgress(Math.max(35, Math.min(100, job.progress.progress)));

      if (job.status === "completed") {
        return {
          data: { result: job.result as ImportPersistPayload["result"] },
          error: null,
        };
      }

      if (job.status === "failed") {
        return {
          data: null,
          error: job.error ?? "Le job d'import a échoué.",
        };
      }

      await new Promise((resolve) => window.setTimeout(resolve, 700));
    }
  };

  const handleFileUpload = async (csvFile: File) => {
    setIsProcessing(true);
    setImportResult(null);
    setUploadProgress(0);
    setUploadStage("parsing");
    setServerPhaseMessage("");

    if (hideProgressTimeoutRef.current !== null) {
      window.clearTimeout(hideProgressTimeoutRef.current);
      hideProgressTimeoutRef.current = null;
    }

    try {
      const result = await parseAndValidateCsv(csvFile);
      setImportResult(result);
      setUploadProgress(30);

      if (result.errors.length > 0) {
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
                  <p className="text-sm font-medium">
                    Impossible d'importer le fichier
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Des erreurs critiques ont été détectées dans le fichier CSV.
                    Veuillez les corriger et réessayer.
                  </p>
                  <div>
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => {
                        toast.dismiss(t);
                        setDetailsOpen(true);
                      }}
                    >
                      Voir détails
                    </Button>
                  </div>
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

      setUploadStage("uploading");

      const persistResult = await postImportWithProgress(
        result.payload,
        (percent) => {
          const mappedProgress = Math.round(percent * 0.35);
          setUploadProgress(Math.max(1, Math.min(35, mappedProgress)));
        },
      );

      if (persistResult.error) {
        toast.error("Échec de l'import", {
          description: persistResult.error,
        });
        return;
      }

      const jobId = persistResult.data?.jobId;

      if (!jobId) {
        toast.error("Échec de l'import", {
          description: "Le serveur n'a pas retourné d'identifiant de job.",
        });
        return;
      }

      setUploadStage("persisting");

      const jobResult = await pollImportJobStatus(jobId);

      if (jobResult.error) {
        toast.error("Échec de l'import", {
          description: jobResult.error,
        });
        return;
      }

      setUploadStage("done");
      setUploadProgress(100);
      setServerPhaseMessage("Import terminé.");

      setIsCompleted(true);

      router.refresh();

      if (!jobResult.data) {
        toast.error("Échec de l'import", {
          description: "Le serveur n'a retourné aucune donnée de résultat.",
        });
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
                <p className="text-sm font-medium">Import terminé</p>
                <p className="text-sm text-muted-foreground">
                  Les données RH récupérées du fichier CSV ont été importées
                  avec succès.
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

      hideProgressTimeoutRef.current = window.setTimeout(() => {
        setUploadStage("idle");
        setUploadProgress(0);
        setServerPhaseMessage("");
      }, 2500);
    } catch (err) {
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
                <p className="text-sm font-medium">
                  Erreur lors de l'importation du fichier
                </p>
                <p className="text-sm text-muted-foreground">
                  Une erreur innatendue est survenue lors du traitement du
                  fichier CSV. Veuillez réessayer en supprimant d'abord le
                  fichier ou contacter le support si le problème persiste.
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
      console.error("Erreur lors du parsing CSV :", err);
    } finally {
      setIsProcessing(false);

      if (!isCompleted) {
        setUploadStage("idle");
        setUploadProgress(0);
        setServerPhaseMessage("");
      }
    }
  };

  const handleReset = () => {
    clearFile();
    setImportResult(null);
    setUploadProgress(0);
    setUploadStage("idle");
    setServerPhaseMessage("");

    if (hideProgressTimeoutRef.current !== null) {
      window.clearTimeout(hideProgressTimeoutRef.current);
      hideProgressTimeoutRef.current = null;
    }
  };

  const stageLabel =
    uploadStage === "parsing"
      ? "Analyse du fichier"
      : uploadStage === "uploading"
        ? "Upload vers le serveur"
        : uploadStage === "persisting"
          ? "Persistance en base"
          : uploadStage === "done"
            ? "Terminé"
            : "En attente";

  return (
    <div className="space-y-4 w-full max-w-xl">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8",
          "hover:border-brand/50 transition-colors cursor-pointer",
          error && "border-red-500",
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        {fileName ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{fileName}</p>
            {/* Bouton de suppression */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              variant="ghost"
              size="sm"
            >
              Supprimer
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sélectionnez le fichier pour importer les données RH de
            l'organisation.
            <br />
            Format acceptés : CSV jusqu'à 10 Mo.
          </p>
        )}
      </div>

      <input
        type="file"
        accept=".csv"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
      />

      {/* ── Résumé de l'import ─────────────────────────────────────── */}

      {importResult?.errors.length === 0 && !isCompleted && (
        <Alert className="max-w-md text-start ">
          <CheckCircle2Icon />
          <AlertTitle>Données récupérées avec succès</AlertTitle>
          <AlertDescription>
            <ul className="list-disc">
              {/* Nombre de lignes imptortés */}
              <li>
                {importResult.summary.validRows} ligne
                {importResult.summary.validRows > 1 ? "s" : ""} valide
                {importResult.summary.validRows > 1 ? "s" : ""} sur{" "}
                {importResult.summary.totalRows}
              </li>

              {/* Nombre de doublons supprimés */}
              <li>
                {importResult.summary.duplicatesOverwritten} doublon
                {importResult.summary.duplicatesOverwritten > 1 ? "s" : ""}{" "}
                écrasé
                {importResult.summary.duplicatesOverwritten > 1 ? "s" : ""}
              </li>

              {/* Résumé des entités importées */}
              <li>
                Résumé des données récupérées :{" "}
                {importResult.summary.entities.locations} localisation
                {importResult.summary.entities.locations > 1 ? "s" : ""},{" "}
                {importResult.summary.entities.departments} département
                {importResult.summary.entities.departments > 1 ? "s" : ""},{" "}
                {importResult.summary.entities.sectors} secteur
                {importResult.summary.entities.sectors > 1 ? "s" : ""},{" "}
                {importResult.summary.entities.positions} poste
                {importResult.summary.entities.positions > 1 ? "s" : ""},{" "}
                {importResult.summary.entities.members} membre
                {importResult.summary.entities.members > 1 ? "s" : ""}
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-center gap-2">
        {file && (
          <Button
            onClick={() => handleFileUpload(file)}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <Import />}
            {isProcessing ? "Import en cours..." : "Importer le fichier"}
          </Button>
        )}
        {/* Bouton d'aide */}

        <AlertDialog>
          {/* Détails des erreurs du fichier importé */}
          <Sheet
            open={detailsOpen}
            onOpenChange={(open) => setDetailsOpen(open)}
          >
            <SheetContent className="overflow-scroll max-h-screen">
              <SheetHeader>
                <SheetTitle>
                  Détails des erreurs détectées dans le fichier importé
                </SheetTitle>
                <SheetDescription asChild>
                  <div className="space-y-2 text-sm text-muted-foreground ">
                    {importResult ? (
                      importResult.errors.length > 0 ? (
                        <div>
                          <ul className="list-disc pl-5 text-sm text-muted-foreground">
                            {importResult.errors.map((err, i) => (
                              <li key={i}>
                                <span className="font-medium">
                                  Ligne {err.line}
                                </span>
                                {err.field && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    ({err.field})
                                  </span>
                                )}{" "}
                                : {err.message}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 text-sm">
                            Merci de bien vouloir corriger les erreurs et
                            réimporter le fichier.
                          </div>
                        </div>
                      ) : (
                        <div>
                          Aucune erreur. Voir le résumé et la payload normalisée
                          dans la console.
                        </div>
                      )
                    ) : (
                      <div>Aucun détail disponible.</div>
                    )}
                  </div>
                </SheetDescription>
              </SheetHeader>
              <SheetFooter>
                <SheetClose asChild>
                  <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* Bouton d'aide */}
          <AlertDialogTrigger asChild>
            <Button variant="outline">
              <MessageCircleQuestionMark /> Besoin d'aide ?
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Voici les champs attendus dans le fichier
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <ul className="list-disc">
                    <li>
                      <span className="font-semibold">codeAssignation</span>{" "}
                      <span className="text-destructive">*</span> (chaîne de
                      caractères unique)
                    </li>

                    <li>
                      <span className="font-semibold">nom</span>{" "}
                      <span className="text-destructive">*</span> (chaîne de
                      caractères)
                    </li>

                    <li>
                      <span className="font-semibold">prenom</span>{" "}
                      <span className="text-destructive">*</span> (chaîne de
                      caractères)
                    </li>

                    <li>
                      <span className="font-semibold">dateNaissance</span>{" "}
                      (chaîne de caractères, format: "JJ/MM/AAAA")
                    </li>

                    <li>
                      <span className="font-semibold">genre</span> (chaîne de
                      caractères, valeurs possibles: "Homme", "Femme", "Autre")
                    </li>

                    <li>
                      <span className="font-semibold">urlImage</span> (chaîne de
                      caractères)
                    </li>

                    <li>
                      <span className="font-semibold">
                        emailProfessionnelle
                      </span>{" "}
                      <span className="text-destructive">*</span> (chaîne de
                      caractères unique)
                    </li>

                    <li>
                      <span className="font-semibold">telephone</span> (chaîne
                      de caractères)
                    </li>

                    <li>
                      <span className="font-semibold">dateDebut</span>{" "}
                      <span className="text-destructive">*</span> (chaîne de
                      caractères, format: "JJ/MM/AAAA")
                    </li>

                    <li>
                      <span className="font-semibold">dateFin</span> (chaîne de
                      caractères, format: "JJ/MM/AAAA")
                    </li>

                    <li>
                      <span className="font-semibold">referentRH</span> (chaîne
                      de caractères, valeurs possibles: "Oui", "Non")
                    </li>

                    <li>
                      <span className="font-semibold">localisation</span>{" "}
                      <span className="text-destructive">*</span> (chaîne de
                      caractères unique)
                    </li>

                    <li>
                      <span className="font-semibold">departement</span> (chaîne
                      de caractères unique)
                    </li>

                    <li>
                      <span className="font-semibold">secteur</span> (chaîne de
                      caractères)
                    </li>

                    <li>
                      <span className="font-semibold">poste</span> (chaîne de
                      caractères)
                    </li>

                    <li>
                      <span className="font-semibold">postePrincipale</span>{" "}
                      (chaîne de caractères, valeurs possibles: "Oui", "Non")
                    </li>

                    <li>
                      <span className="font-semibold">detailsPoste</span>
                      (chaîne de caractères séparée par |, ex:
                      "detail1|detail2|detail3")
                    </li>

                    <li>
                      <span className="font-semibold">posteResponsable</span>{" "}
                      (chaîne de caractères)
                    </li>

                    <li>
                      <span className="font-semibold">assistant</span> (chaîne
                      de caractères, valeurs possibles: "Oui", "Non")
                    </li>
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Fermer</AlertDialogCancel>
              <AlertDialogAction asChild>
                <a href="/import-sample.csv" download>
                  Récupérer le fichier d'exemple
                </a>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {(isProcessing || uploadStage === "done") && (
        <div className="w-full max-w-sm space-y-2">
          <label
            htmlFor="progress-upload"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <span>{serverPhaseMessage || stageLabel}</span>
            <span className="ml-auto">{uploadProgress}%</span>
          </label>
          <Progress value={uploadProgress} id="progress-upload" />
        </div>
      )}
    </div>
  );
}
