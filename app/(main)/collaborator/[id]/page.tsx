"use client";

import MemberCard from "@/src/components/members/member-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/src/components/ui/accordion";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
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
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/src/components/ui/empty";
import { Spinner } from "@/src/components/ui/spinner";
import { useCollaborator } from "@/src/hooks/use-collaborator";
import { getNameFallback } from "@/src/lib/utils";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  Group,
  ListCollapse,
  Mail,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function CollaboratorPage() {
  const router = useRouter();
  const params = useParams<{ id: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const memberId = Number(rawId);
  const isInvalidId = !Number.isInteger(memberId) || memberId <= 0;
  const { collaborator, loading } = useCollaborator(
    isInvalidId ? null : memberId,
  );
  const canDisplayMember = !isInvalidId && !loading && collaborator !== null;

  const occupiedPositions = collaborator?.positions ?? [];
  const primaryPosition = occupiedPositions.find(
    (position) => position.isPrimary,
  );

  // position cible pour la navigation vers l'organigramme :
  // - le poste principal si présent
  // - sinon le premier poste secondaire (non principal)
  const targetPosition =
    primaryPosition ?? occupiedPositions.find((p) => !p.isPrimary) ?? null;

  const manager = collaborator?.position?.parentPosition?.member ?? null;
  const teamMembers =
    collaborator?.position?.childPositions
      .map((childPosition) => ({
        position: childPosition,
        member: childPosition.member,
      }))
      .filter(
        (
          item,
        ): item is {
          position: typeof item.position;
          member: NonNullable<typeof item.member>;
        } => item.member !== null,
      ) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-primary">
            Fiche de détail du collaborateur
          </h2>
        </CardTitle>
        <CardDescription>
          Visualisez les informations détaillées du collaborateur, incluant le
          poste qu'il occupe et son équipe.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading && !isInvalidId ? (
          <Empty className="border border-dashed ">
            <EmptyHeader>
              <EmptyTitle>
                <div className="flex items-center gap-2">
                  <Spinner /> Chargement en cours
                </div>
              </EmptyTitle>
              <EmptyDescription>
                Les informations du collaborateur sont en cours de chargement,
                veuillez patienter quelques instants.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : canDisplayMember ? (
          <div>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft /> Retour
            </Button>

            <div className="flex flex-col md:flex-row gap-2 w-full mt-2">
              {/* Informations sur le collaborateurs */}
              <div className="w-full md:w-xl">
                <MemberCard
                  member={{
                    id: collaborator.id,
                    serviceCode: collaborator.serviceCode,
                    firstname: collaborator.firstname,
                    lastname: collaborator.lastname,
                    gender: collaborator.gender,
                    avatarUrl: collaborator.avatarUrl,
                    professionalEmail: collaborator.professionalEmail,
                    phone: collaborator.phone ?? "",
                    startDate: collaborator.startDate,
                    endDate: collaborator.endDate,
                    locationName: collaborator.locationName ?? "",
                    status: collaborator.status,
                    isReferentRH: collaborator.isReferentRH,
                    positionId: collaborator.positionId ?? 0,
                  }}
                  position={{
                    id: collaborator.position?.id ?? 0,
                    name: collaborator.position?.name ?? "Poste non assigné",
                    type: collaborator.position?.type ?? "COLLABORATEUR",
                    sectorId: collaborator.position?.sectorId ?? 0,
                    parentPositionId:
                      collaborator.position?.parentPosition?.id ?? null,
                  }}
                  sector={{
                    id: collaborator.position?.sectorId ?? 0,
                    name:
                      collaborator.position?.sectorName ??
                      "Secteur non renseigné",
                    departmentId: collaborator.position?.departmentId ?? 0,
                  }}
                  department={{
                    id: collaborator.position?.departmentId ?? 0,
                    name:
                      collaborator.position?.departmentName ??
                      "Département non renseigné",
                  }}
                  type="trombinoscope"
                />

                {targetPosition ? (
                  <div className="flex gap-2 w-full mt-2">
                    {targetPosition.departmentId ? (
                      <Link
                        href={`/organigram?departmentId=${targetPosition.departmentId}`}
                        className="w-full"
                      >
                        <Button className="w-full">Voir le département</Button>
                      </Link>
                    ) : null}

                    {targetPosition.sectorId ? (
                      <Link
                        href={`/organigram?sectorIds=${targetPosition.sectorId}`}
                        className="w-full"
                      >
                        <Button className="w-full" variant="secondary">
                          Voir le service
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col w-full gap-2">
                {/* Informations sur les postes */}
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                          Informations sur les postes occupés
                        </h3>
                      </CardTitle>
                      <CardDescription>
                        Découvez les détails des postes occupés par le
                        collaborateur.
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      {occupiedPositions.length > 0 ? (
                        <Accordion
                          type="multiple"
                          defaultValue={
                            primaryPosition
                              ? [`position-${primaryPosition.id}`]
                              : []
                          }
                          className="rounded-lg border"
                        >
                          {occupiedPositions.map((position) => (
                            <AccordionItem
                              key={position.id}
                              value={`position-${position.id}`}
                              className="border-b px-4 last:border-b-0"
                            >
                              <AccordionTrigger>
                                <div className="flex flex-col md:flex-row justify-between w-full gap-2">
                                  <p className="truncate" title={position.name}>
                                    {position.name}
                                  </p>
                                  {position.isPrimary ? (
                                    <Badge>Poste principal</Badge>
                                  ) : (
                                    <Badge variant="secondary">
                                      Poste secondaire
                                    </Badge>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <ul className="text-muted-foreground">
                                  <li className="flex items-center gap-2">
                                    <Building2 size={18} />{" "}
                                    {position.departmentName}
                                  </li>
                                  <li className="flex items-center gap-2">
                                    <Group size={18} />
                                    {position.sectorName}
                                  </li>
                                  <li>
                                    <div className="flex items-center gap-2">
                                      <ListCollapse size={18} />
                                      <span>Détails du poste : </span>
                                    </div>

                                    <ul className="mt-2 list-disc pl-6 space-y-1">
                                      {position.jobDetails ? (
                                        <>
                                          {(() => {
                                            const details = position.jobDetails;
                                            if (typeof details === "string") {
                                              return <li>{details}</li>;
                                            }

                                            if (Array.isArray(details)) {
                                              return details.map(
                                                (item: string, idx: number) => (
                                                  <li key={idx}>
                                                    {String(item)}
                                                  </li>
                                                ),
                                              );
                                            }

                                            if (
                                              details &&
                                              typeof details === "object"
                                            ) {
                                              return Object.entries(
                                                details,
                                              ).map(([k, v]) => (
                                                <li key={k}>
                                                  <span className="font-medium">
                                                    {k}:
                                                  </span>{" "}
                                                  {String(v)}
                                                </li>
                                              ));
                                            }

                                            return <li>{String(details)}</li>;
                                          })()}
                                        </>
                                      ) : (
                                        <div className="border border-dotted rounded-md p-4">
                                          Aucun détails renseigné
                                        </div>
                                      )}
                                    </ul>
                                  </li>

                                  {/* <li className="flex items-start gap-2">
                                    <ListCollapse size={18} />
                                    <div>
                                      <div className="font-medium">
                                        Détails du poste :
                                      </div>
                                      {(() => {
                                        const details =
                                          position.jobDetails as any;
                                        if (!details) {
                                          return (
                                            <div className="text-sm text-muted-foreground ml-4">
                                              Aucun détail
                                            </div>
                                          );
                                        }

                                        try {
                                          const parsed =
                                            typeof details === "string"
                                              ? JSON.parse(details)
                                              : details;

                                          if (Array.isArray(parsed)) {
                                            return (
                                              <ul className="text-sm text-muted-foreground ml-4">
                                                {parsed.map(
                                                  (item: any, idx: number) => (
                                                    <li key={idx}>
                                                      {String(item)}
                                                    </li>
                                                  ),
                                                )}
                                              </ul>
                                            );
                                          }

                                          if (
                                            parsed &&
                                            typeof parsed === "object"
                                          ) {
                                            return (
                                              <ul className="text-sm text-muted-foreground ml-4">
                                                {Object.entries(parsed).map(
                                                  ([k, v]) => (
                                                    <li key={k}>
                                                      <span className="font-medium">
                                                        {k}:
                                                      </span>{" "}
                                                      {String(v)}
                                                    </li>
                                                  ),
                                                )}
                                              </ul>
                                            );
                                          }

                                          return (
                                            <div className="text-sm text-muted-foreground ml-4">
                                              {String(parsed)}
                                            </div>
                                          );
                                        } catch (err) {
                                          return (
                                            <div className="text-sm text-muted-foreground ml-4">
                                              {String(details)}
                                            </div>
                                          );
                                        }
                                      })()}
                                    </div>
                                  </li> */}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      ) : (
                        <Empty className="border border-dashed">
                          <EmptyHeader>
                            <EmptyTitle>Aucun poste occupé</EmptyTitle>
                            <EmptyDescription>
                              Il semble que ce collaborateur n'occupe
                              actuellement aucun poste.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Informations sur l'équipe */}
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                          Informations sur l'équipe
                        </h3>
                      </CardTitle>
                      <CardDescription>
                        Découvez l'équipe du collaborateur, incluant son manager
                        et les membres de son équipe.
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <Accordion
                        type="single"
                        collapsible
                        defaultValue="parentPosition"
                      >
                        <AccordionItem value="parentPosition">
                          <AccordionTrigger>
                            Afficher les managers
                          </AccordionTrigger>

                          <AccordionContent>
                            {manager ? (
                              <div className="flex flex-col gap-2">
                                <div
                                  className="flex gap-4 hover:bg-secondary/30 p-4 rounded-lg cursor-pointer"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => router.push(`./${manager.id}`)}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      router.push(`./${manager.id}`);
                                    }
                                  }}
                                >
                                  <Avatar className="w-18 h-18">
                                    <AvatarImage
                                      src={
                                        manager.avatarUrl &&
                                        manager.avatarUrl.trim()
                                          ? manager.avatarUrl
                                          : undefined
                                      }
                                    />
                                    <AvatarFallback>
                                      {getNameFallback(
                                        `${manager.firstname} ${manager.lastname}`,
                                      )}
                                    </AvatarFallback>
                                  </Avatar>

                                  <ul>
                                    <li>
                                      <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
                                        {manager.firstname} {manager.lastname}
                                      </h4>
                                      <Badge>Référent RH</Badge>
                                    </li>
                                    <li>
                                      <Link
                                        href={`mailto:${manager.professionalEmail}`}
                                        className="flex items-center gap-2 text-primary"
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                      >
                                        <Mail size={16} />{" "}
                                        {manager.professionalEmail}
                                      </Link>
                                    </li>

                                    {manager.phone ? (
                                      <li>
                                        <Link
                                          href={`tel:${manager.phone}`}
                                          className="flex items-center gap-2 text-primary"
                                          onClick={(event) =>
                                            event.stopPropagation()
                                          }
                                        >
                                          <Phone size={16} /> {manager.phone}
                                        </Link>
                                      </li>
                                    ) : null}

                                    <li className="flex items-center gap-2">
                                      <BriefcaseBusiness size={16} />
                                      {collaborator.position?.parentPosition
                                        ?.name ?? "Poste non renseigné"}
                                    </li>

                                    <li className="flex items-center gap-2">
                                      <Building2 size={16} />
                                      {collaborator.position?.parentPosition
                                        ?.departmentName ??
                                        "Département non renseigné"}
                                    </li>
                                  </ul>
                                </div>
                              </div>
                            ) : (
                              <Empty className="border border-dashed">
                                <EmptyHeader>
                                  <EmptyTitle>Aucun manager</EmptyTitle>
                                  <EmptyDescription>
                                    Il semble que ce collaborateur n'ait aucun
                                    manager.
                                  </EmptyDescription>
                                </EmptyHeader>
                              </Empty>
                            )}
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="childPositions">
                          <AccordionTrigger>Afficher l'équipe</AccordionTrigger>
                          <AccordionContent>
                            {teamMembers.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {teamMembers.map(({ position, member }) => (
                                  <div
                                    key={position.id}
                                    className="flex gap-4 hover:bg-secondary/30 p-4 rounded-lg cursor-pointer"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() =>
                                      router.push(`./${member.id}`)
                                    }
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === "Enter" ||
                                        event.key === " "
                                      ) {
                                        event.preventDefault();
                                        router.push(`./${member.id}`);
                                      }
                                    }}
                                  >
                                    <Avatar className="w-18 h-18">
                                      <AvatarImage
                                        src={
                                          member.avatarUrl &&
                                          member.avatarUrl.trim()
                                            ? member.avatarUrl
                                            : undefined
                                        }
                                      />
                                      <AvatarFallback>
                                        {getNameFallback(
                                          `${member.firstname} ${member.lastname}`,
                                        )}
                                      </AvatarFallback>
                                    </Avatar>

                                    <ul>
                                      <li>
                                        <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
                                          {member.firstname} {member.lastname}
                                        </h4>
                                      </li>
                                      <li>
                                        <Link
                                          href={`mailto:${member.professionalEmail}`}
                                          className="flex items-center gap-2 text-primary w-20"
                                          onClick={(event) =>
                                            event.stopPropagation()
                                          }
                                        >
                                          <Mail size={16} />{" "}
                                          {member.professionalEmail}
                                        </Link>
                                      </li>

                                      {member.phone ? (
                                        <li>
                                          <Link
                                            href={`tel:${member.phone}`}
                                            className="flex items-center gap-2 text-primary"
                                            onClick={(event) =>
                                              event.stopPropagation()
                                            }
                                          >
                                            <Phone size={16} /> {member.phone}
                                          </Link>
                                        </li>
                                      ) : null}

                                      <li className="flex items-center gap-2">
                                        <BriefcaseBusiness size={16} />{" "}
                                        {position.name}
                                      </li>

                                      <li className="flex items-center gap-2">
                                        <Building2 size={16} />{" "}
                                        {position.departmentName}
                                      </li>
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <Empty className="border border-dashed">
                                <EmptyHeader>
                                  <EmptyTitle>
                                    Aucun membre dans l'équipe
                                  </EmptyTitle>
                                  <EmptyDescription>
                                    Il semble que ce collaborateur n'ait aucun
                                    membre d'équipe.
                                  </EmptyDescription>
                                </EmptyHeader>
                              </Empty>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Empty className="border border-dashed ">
            <EmptyHeader>
              <EmptyTitle>Chargement impossible</EmptyTitle>
              <EmptyDescription>
                Les informations du collaborateur ne peuvent pas être chargées.
                Veuillez retourner à la liste des collaborateurs et sélectionner
                un collaborateur valide. Si le problème persiste, n'hésitez pas
                à contacter le support pour obtenir de l'aide.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-col md:flex-row items-center gap-2">
                <Link href="/trombinoscope">
                  <Button variant="outline" className="w-full">
                    Retour à la liste des collaborateurs
                  </Button>
                </Link>
                <Link href="/contact" className="w-full">
                  <Button variant="outline" className="w-full">
                    Contacter le support
                  </Button>
                </Link>
              </div>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
