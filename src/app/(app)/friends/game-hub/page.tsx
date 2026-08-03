import { redirect } from "next/navigation";

// This page's whole content was four cards linking to Dashboard, Library,
// Achievements and Connections — it existed because opening Friends replaced
// the app's navigation column with one that didn't list them. One column lists
// them everywhere now, so the page has no job. It stays as a redirect rather
// than a 404 for anyone who bookmarked it.
export default function GameHubRedirect() {
  redirect("/dashboard");
}
