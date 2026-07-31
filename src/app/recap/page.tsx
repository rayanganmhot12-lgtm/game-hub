import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { computeRecap } from "@/lib/recap";
import RecapSlideshow from "@/components/RecapSlideshow";

export default async function RecapPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const recap = await computeRecap(user.id);

  return <RecapSlideshow recap={recap} />;
}
