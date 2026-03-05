"use client";

import * as React from "react";
import { ChartNetwork, Contact, House, SquareTerminal } from "lucide-react";

import { NavMain } from "@/src/components/ui/nav-main";
import { NavProjects } from "@/src/components/ui/nav-projects";
import { NavSecondary } from "@/src/components/ui/nav-secondary";
import { NavUser } from "@/src/components/ui/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/src/components/ui/sidebar";
import Image from "next/image";

const data = {
  user: {
    name: "Christopher Marie-Angélique",
    email: "christopher.marieangelique.pro@gmail.com",
  },
  navMain: [
    {
      title: "Administration",
      url: "#",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "Utilisateurs",
          url: "/admin/users",
        },
        {
          title: "Localisations",
          url: "/admin/locations",
        },
        {
          title: "Départements",
          url: "/admin/departments",
        },
        {
          title: "Services",
          url: "/admin/sectors",
        },
        {
          title: "Collaborateurs",
          url: "/admin/collaborators",
        },
        {
          title: "Postes",
          url: "/admin/jobs",
        },

        {
          title: "Import des données",
          url: "/admin/import",
        },
      ],
    },
  ],
  navSecondary: [],
  projects: [
    {
      name: "Accueil",
      url: "/",
      icon: House,
    },
    {
      name: "Organigramme",
      url: "/organigram",
      icon: ChartNetwork,
    },
    {
      name: "Trombinoscope",
      url: "/trombinoscope",
      icon: Contact,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-center">
            <Image
              src="/images/logo.jpeg"
              alt="Hieraflow"
              width={100}
              height={100}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
