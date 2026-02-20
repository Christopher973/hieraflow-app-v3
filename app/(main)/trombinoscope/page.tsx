"use client";

import { useCallback, useMemo, useState } from "react";
import MemberCard from "@/src/components/members/member-card";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import type { ResolvedMember } from "@/src/types/member";
import { Check, SearchIcon, XIcon } from "lucide-react";
import {
  SearchField,
  SearchFieldClear,
  SearchFieldInput,
} from "@/src/components/ui/searchfield";
import { FieldGroup } from "@/src/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useCollaborators } from "@/src/hooks/use-collaborators";
import { useLocations } from "@/src/hooks/use-locations";
import { useDepartments } from "@/src/hooks/use-departments";
import { useSectors } from "@/src/hooks/use-sectors";
import { Spinner } from "@/src/components/ui/spinner";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/src/components/ui/empty";

const PAGE_SIZE = 8;
const OPTIONS_PAGE_SIZE = 50;

type ReferentRhFilter = "include" | "exclude" | "only";

export default function TrombinoscopePage() {
  const [, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [locationFilter, setLocationFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [referentRhFilter, setReferentRhFilter] =
    useState<ReferentRhFilter>("include");

  const { items: locationItems } = useLocations({
    page: 1,
    pageSize: OPTIONS_PAGE_SIZE,
  });
  const { items: departmentItems } = useDepartments({
    page: 1,
    pageSize: OPTIONS_PAGE_SIZE,
  });

  const selectedDepartmentId =
    departmentFilter === "all" ? undefined : Number(departmentFilter);

  const { items: sectorItems } = useSectors({
    page: 1,
    pageSize: OPTIONS_PAGE_SIZE,
    departmentId: selectedDepartmentId,
  });

  const hasLocations = locationItems.length > 0;
  const hasDepartments = departmentItems.length > 0;
  const hasSectors = sectorItems.length > 0;

  const selectedLocationId =
    locationFilter === "all" ? undefined : Number(locationFilter);
  const selectedSectorId =
    sectorFilter === "all" ? undefined : Number(sectorFilter);

  const referentRhValue =
    referentRhFilter === "include"
      ? undefined
      : referentRhFilter === "exclude"
        ? false
        : true;

  const {
    items: collaborators,
    loading,
    error,
    pagination,
    loadMore,
  } = useCollaborators({
    q: appliedSearch || undefined,
    locationId: selectedLocationId,
    departmentId: selectedDepartmentId,
    sectorId: selectedSectorId,
    isReferentRH: referentRhValue,
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const cards: ResolvedMember[] = useMemo(
    () =>
      collaborators.map((collaborator) => ({
        member: {
          id: collaborator.id,
          serviceCode: collaborator.serviceCode,
          firstname: collaborator.firstname,
          lastname: collaborator.lastname,
          gender: collaborator.gender,
          avatarUrl: collaborator.avatarUrl,
          locationName: collaborator.locationName ?? "",
          professionalEmail: collaborator.professionalEmail,
          phone: collaborator.phone ?? "",
          startDate: collaborator.startDate,
          endDate: collaborator.endDate,
          status: collaborator.status,
          isReferentRH: collaborator.isReferentRH,
          positionId: collaborator.positionId ?? 0,
        },
        position: {
          id: collaborator.positionId ?? 0,
          name: collaborator.positionName ?? "Poste non assigné",
          type: "COLLABORATEUR",
          sectorId: collaborator.sectorId ?? 0,
          parentPositionId: null,
        },
        sector: {
          id: collaborator.sectorId ?? 0,
          name: collaborator.sectorName ?? "Secteur non assigné",
          departmentId: collaborator.departmentId ?? 0,
        },
        department: {
          id: collaborator.departmentId ?? 0,
          name: collaborator.departmentName ?? "Département non assigné",
        },
      })),
    [collaborators],
  );

  const totalItems = pagination?.totalItems ?? 0;
  const canLoadMore = cards.length < totalItems;
  const isLoadingMore = loadingMore;
  const trimmedSearch = searchInput.trim();
  const showSubmitButton = trimmedSearch.length > 0;
  const isSearchSubmitting =
    loading && appliedSearch === trimmedSearch && trimmedSearch.length > 0;
  const showCardSkeletons = loading && !isLoadingMore;

  const resetPagination = useCallback(() => {
    setVisibleCount(PAGE_SIZE);
  }, []);

  const applySearch = useCallback(
    (value: string) => {
      setAppliedSearch(value.trim());
      resetPagination();
    },
    [resetPagination],
  );

  const handleLoadMore = useCallback(async () => {
    if (!canLoadMore || loading) return;

    setLoadingMore(true);
    try {
      const ok = await loadMore();
      if (ok) {
        setVisibleCount((current) =>
          Math.min(current + PAGE_SIZE, OPTIONS_PAGE_SIZE),
        );
      }
    } finally {
      setLoadingMore(false);
    }
  }, [canLoadMore, loading, loadMore]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-primary">
            Trombinoscope interactif
          </h2>
        </CardTitle>

        <CardDescription>
          Découvrez les visages de l'organisation à travers du trombinoscope
          interactif.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* FILTRES */}
        <div className="flex flex-col md:flex-row gap-2">
          {/* Barre de recherche */}
          <SearchField
            className="w-full"
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={applySearch}
          >
            <FieldGroup>
              <SearchIcon
                aria-hidden
                className="size-4 text-muted-foreground"
              />
              <SearchFieldInput placeholder="Saisir une recherche..." />
              <SearchFieldClear>
                <XIcon aria-hidden className="size-4" />
              </SearchFieldClear>
            </FieldGroup>
          </SearchField>

          {showSubmitButton ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => applySearch(searchInput)}
              disabled={isSearchSubmitting}
            >
              {isSearchSubmitting ? <Spinner className="size-4" /> : <Check />}
            </Button>
          ) : null}

          {/* Par localisation */}
          <Select
            onValueChange={(value) => {
              setLocationFilter(value);
              resetPagination();
            }}
            disabled={!hasLocations}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtre par localisation" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Localisation</SelectLabel>
                <SelectItem value="all">Toutes les localisations</SelectItem>
                {locationItems.map((location) => (
                  <SelectItem key={location.id} value={String(location.id)}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Par département */}
          <Select
            onValueChange={(value) => {
              setDepartmentFilter(value);
              setSectorFilter("all");
              resetPagination();
            }}
            disabled={!hasDepartments}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtre par département" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Département</SelectLabel>
                <SelectItem value="all">Tous les départements</SelectItem>
                {departmentItems.map((department) => (
                  <SelectItem key={department.id} value={String(department.id)}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Par secteurs */}
          <Select
            onValueChange={(value) => {
              setSectorFilter(value);
              resetPagination();
            }}
            disabled={departmentFilter === "all" || !hasSectors}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtre par secteur" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Secteur</SelectLabel>
                <SelectItem value="all">Tous les secteurs</SelectItem>
                {sectorItems.map((sector) => (
                  <SelectItem key={sector.id} value={String(sector.id)}>
                    {sector.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Par référent RH */}
          <Select
            onValueChange={(value: ReferentRhFilter) => {
              setReferentRhFilter(value);
              resetPagination();
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtre par référent RH" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Choisir une option</SelectLabel>
                <SelectItem value="include">
                  Inclure les référents RH
                </SelectItem>
                <SelectItem value="exclude">
                  Exclure les référents RH
                </SelectItem>
                <SelectItem value="only">
                  Uniquement les référents RH
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Bouton de réinitialisation des filtres */}
          <Button
            variant="outline"
            onClick={() => {
              setLocationFilter("all");
              setDepartmentFilter("all");
              setSectorFilter("all");
              setReferentRhFilter("include");
              setSearchInput("");
              applySearch("");
            }}
          >
            Réinitialiser les filtres
          </Button>
        </div>

        {/* Nombre de collaborateurs affichés */}
        {showCardSkeletons ? (
          <>
            <Skeleton className="mt-4 h-6 w-62.5 " />
          </>
        ) : (
          <p className="mt-4 text-muted-foreground">
            Affichage de {cards.length} membre(s) sur {totalItems}
          </p>
        )}

        {error ? (
          <p className="mt-2 text-sm text-destructive">
            Une erreur innatendue est survenue lors du chargement des
            collaborateurs, veuillez réessayer plus tard.
          </p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {showCardSkeletons
            ? Array.from({ length: PAGE_SIZE }).map((_, index) => (
                <Card key={`member-skeleton-${index}`}>
                  <CardHeader>
                    <CardTitle>
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-2/6" />
                        <Skeleton className="h-4 w-5/6" />
                      </div>
                    </CardTitle>
                    <CardAction></CardAction>
                    <CardDescription>
                      <Skeleton className="h-24 w-24 rounded-full mx-auto" />
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-4/6" />
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Skeleton className="h-4 w-5/6" />
                  </CardFooter>
                </Card>
              ))
            : cards.map((card) => (
                <MemberCard
                  key={card.member.id}
                  member={card.member}
                  position={card.position}
                  sector={card.sector}
                  department={card.department}
                  type="trombinoscope"
                />
              ))}
        </div>

        {!loading && cards.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyTitle>Aucun collaborateur trouvé</EmptyTitle>
              <EmptyDescription>
                Il semble qu'aucun collaborateur ne corresponde à vos critères
                de recherche. Essayez d'ajuster les filtres ou la recherche pour
                trouver des collaborateurs.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
      </CardContent>

      <CardFooter className="flex justify-center">
        {canLoadMore && (
          <Button onClick={handleLoadMore} disabled={loading || !canLoadMore}>
            {isLoadingMore && loading ? (
              <>
                <Spinner /> Chargement en cours...
              </>
            ) : (
              "Charger plus de collaborateurs"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
