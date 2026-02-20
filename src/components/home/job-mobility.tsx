import MemberCard from "../members/member-card";
import type { ResolvedMember } from "@/src/types/member";
import { fetchLatestMobilityMembers } from "@/src/lib/members";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "../ui/empty";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../ui/carousel";

export default async function JobMobility() {
  const cards: ResolvedMember[] = await fetchLatestMobilityMembers(10, "desc");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-primary">
            Évolutions & Mobilités internes
          </h2>
        </CardTitle>
        <CardDescription>
          Suivez l'évolution des talents et identifiez les nouvelles prises de
          responsabilités pour garantir l'agilité et la lisibilité de
          l'organisation.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {cards.length === 0 ? (
          <>
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>Aucune mobilité récente</EmptyTitle>
                <EmptyDescription>
                  Il semble qu'aucune mobilité ou évolution interne n'ait eu
                  lieu récemment. Revenez bientôt pour découvrir les nouvelles
                  mobilités et évolutions au sein de l'organisation.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent />
            </Empty>
          </>
        ) : (
          <>
            <Carousel opts={{ align: "start" }}>
              <CarouselContent>
                {cards.map((card) => (
                  <CarouselItem
                    key={card.member.id}
                    className="md:basis-1/2 lg:basis-1/4"
                  >
                    <MemberCard
                      member={card.member}
                      position={card.position}
                      sector={card.sector}
                      department={card.department}
                      type="jobMobility"
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </>
        )}
      </CardContent>
    </Card>
  );
}
