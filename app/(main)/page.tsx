import JobMobility from "@/src/components/home/job-mobility";
import NewMembers from "@/src/components/home/new-members";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-2">
      <NewMembers />
      <JobMobility />
    </div>
  );
}
