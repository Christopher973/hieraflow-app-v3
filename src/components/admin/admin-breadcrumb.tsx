"use client";

import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/src/components/ui/breadcrumb";

const adminPageLabels: Record<string, string> = {
  "/admin/users": "Gestion des utilisateurs",
  "/admin/locations": "Gestion des localisations",
  "/admin/departments": "Gestion des départements",
  "/admin/sectors": "Gestion des secteurs",
  "/admin/jobs": "Gestion des postes",
  "/admin/collaborators": "Gestion des collaborateurs",
  "/admin/import": "Import des données RH",
};

function getCurrentAdminLabel(pathname: string): string | null {
  if (pathname in adminPageLabels) {
    return adminPageLabels[pathname];
  }

  return null;
}

export default function AdminBreadcrumb() {
  const pathname = usePathname();
  const currentLabel = getCurrentAdminLabel(pathname);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Accueil</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Administration</BreadcrumbPage>
        </BreadcrumbItem>
        {currentLabel ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
