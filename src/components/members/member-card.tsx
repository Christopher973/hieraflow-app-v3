"use client";

import React from "react";
import {
  BriefcaseBusiness,
  Building2,
  Calendar,
  CalendarOff,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Badge } from "../ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getNameFallback } from "@/src/lib/utils";
import type {
  Department,
  Member,
  MemberCardType,
  Position,
  Sector,
} from "@/src/types/member";

type MemberCardProps = {
  member: Member;
  position: Position;
  sector: Sector;
  department: Department;
  type: MemberCardType;
};

const getFooterLabel = (type: MemberCardType) => {
  switch (type) {
    case "newMembers":
      return "À rejoint le";
    case "jobMobility":
      return "Mobilité depuis le";
    case "trombinoscope":
      return "Employé depuis le";
    default:
      return "À rejoint le";
  }
};

export default function MemberCard({
  member,
  position,
  sector,
  department,
  type,
}: MemberCardProps) {
  const router = useRouter();

  const goToDetails = () => {
    router.push(`/collaborator/${member.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToDetails();
    }
  };

  const startDateLabel = getFooterLabel(type);
  const displayedDateRaw =
    type === "jobMobility"
      ? (position.lastMobility ?? member.startDate)
      : member.startDate;
  const displayedDate = new Date(displayedDateRaw);
  const formattedStartDate = Number.isNaN(displayedDate.getTime())
    ? "Date non renseignée"
    : displayedDate.toLocaleDateString("fr-FR");
  const fullName = `${member.firstname} ${member.lastname}`.trim();
  const avatarFallback = getNameFallback(fullName);

  const endDateRaw = member.endDate;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;
  const formattedEndDate =
    endDate && !Number.isNaN(endDate.getTime())
      ? endDate.toLocaleDateString("fr-FR")
      : null;

  return (
    <Card
      onClick={goToDetails}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      className="cursor-pointer"
    >
      <CardHeader>
        <CardTitle>{`${member.firstname} ${member.lastname}`}</CardTitle>
        {member.isReferentRH ? (
          <CardAction>
            <Badge>Référent RH</Badge>
          </CardAction>
        ) : null}
        <CardDescription className="truncate" title={position.name}>
          {position.name}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Avatar */}
        <div className="flex justify-center">
          <Avatar className="h-38 w-38 shrink-0 overflow-hidden rounded-full">
            <AvatarImage
              className="h-full w-full object-cover object-center"
              src={
                member.avatarUrl && member.avatarUrl.trim()
                  ? member.avatarUrl
                  : undefined
              }
            />
            <AvatarFallback>{avatarFallback}</AvatarFallback>
          </Avatar>
        </div>

        {/* Info */}
        <ul className="mt-4">
          <li className="flex items-center gap-2 text-muted-foreground">
            <MapPin size={20} />
            <span>
              {member.locationName && member.locationName.trim()
                ? member.locationName
                : "Localisation non renseignée"}
            </span>
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <Building2 size={20} /> <span>{department.name}</span>
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <BriefcaseBusiness size={20} /> <span>{sector.name}</span>
          </li>
          <li className="flex items-center gap-2 text-primary min-w-0">
            <Mail size={20} />
            <Link
              href={`mailto:${member.professionalEmail}`}
              className="truncate"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate" title={member.professionalEmail}>
                {member.professionalEmail}
              </span>
            </Link>
          </li>
          <li className="flex items-center gap-2 text-primary min-w-0">
            {member.phone ? (
              <>
                <Phone size={20} />
                <Link
                  href={`tel:${member.phone}`}
                  className="truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="truncate" title={member.phone}>
                    {member.phone}
                  </span>
                </Link>
              </>
            ) : (
              <>
                <Phone className="text-muted-foreground" size={20} />

                <span
                  className="truncate text-muted-foreground"
                  title={member.phone}
                >
                  Téléphone non renseigné
                </span>
              </>
            )}
          </li>
        </ul>
      </CardContent>

      <CardFooter>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center text-muted-foreground">
            <Calendar size={20} />
            <span>{`${startDateLabel} ${formattedStartDate}`}</span>
          </div>

          {formattedEndDate ? (
            <div className="flex gap-2 items-center text-muted-foreground">
              <CalendarOff size={20} />
              <span>{`Fin de contrat prévue le ${formattedEndDate}`}</span>
            </div>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}
