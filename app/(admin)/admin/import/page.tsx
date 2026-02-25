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
          <p className="text-lg">
            Visualiez, créer, modifier ou encore supprimer les Postes des
            collaborateurs de l'organisation.
          </p>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Cloud />
            </EmptyMedia>
            <EmptyTitle>Importer les données</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <UploadFile />
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
}
