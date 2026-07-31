import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LandingHero from "@/components/LandingHero";
import ErrorToastFromQuery from "@/components/ErrorToastFromQuery";

const ERROR_MESSAGES: Record<string, string> = {
  must_sign_in: "Please sign in first before connecting a platform.",
};

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16">
      <Suspense fallback={null}>
        <ErrorToastFromQuery messages={ERROR_MESSAGES} />
      </Suspense>
      <LandingHero />
    </div>
  );
}
