import { UploadFile } from "@/src/components/admin/upload-file";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/src/components/ui/empty";
import { Cloud } from "lucide-react";

export default function ImportAdminPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-primary">
            Import des données RH
          </h2>
        </CardTitle>

        <CardDescription>
          Visualiez, créer, modifier ou encore supprimer les Postes des
          collaborateurs de l'organisation.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Cloud />
            </EmptyMedia>
            <EmptyTitle>Importer les données</EmptyTitle>
            {/* <EmptyDescription>
              Sélectionnez un fichier CSV pour importer les données RH de
              l'organisation.
            </EmptyDescription> */}
          </EmptyHeader>
          <EmptyContent>
            <UploadFile />
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
}
