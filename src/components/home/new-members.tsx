import MemberCard from "../members/member-card";
import type { ResolvedMember } from "@/src/types/member";
import { fetchLatestMembers } from "@/src/lib/members";
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

export default async function NewMembers() {
  const cards: ResolvedMember[] = await fetchLatestMembers(10, "desc");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-primary">
            Bienvenue aux nouveaux collaborateurs
          </h2>
        </CardTitle>
        <CardDescription>
          <p className="text-lg">
            L'équipe s'agrandit ! Retrouvez ici le positionnement hiérarchique
            et le rôle stratégique des nouveaux collaborateurs au sein de
            l'organisation.
          </p>
        </CardDescription>
      </CardHeader>

      <CardContent>
        {cards.length === 0 ? (
          <>
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>Aucune nouvelle arrivée</EmptyTitle>
                <EmptyDescription>
                  Il semble qu'aucun nouveau collaborateur ne soit arrivé
                  récemment. Revenez bientôt pour découvrir les nouveaux talents
                  qui ont rejoint l'organisation.
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
                      type="newMembers"
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
