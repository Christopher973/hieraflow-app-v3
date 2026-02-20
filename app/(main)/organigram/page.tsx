"use client";

import dynamic from "next/dynamic";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

const Organigram = dynamic(
  () => import("@/src/components/organigram/organigram"),
  {
    ssr: false,
  },
);

export default function OrganigramPage() {
  return (
    <div className="h-screen">
      <Card className="h-full">
        <CardHeader>
          <CardTitle>
            <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-primary">
              Organigramme hiérarchique
            </h2>
          </CardTitle>
          <CardAction></CardAction>
          <CardDescription>
            Visualisez et exportez en PDF ou PNG les hiérarchies de
            l'organisation par département et service. Cliquez sur un membre
            pour voir et exporter ses détails.
          </CardDescription>
        </CardHeader>

        <CardContent className="h-full overflow-hidden">
          <Organigram />
        </CardContent>
      </Card>
    </div>
  );
}
