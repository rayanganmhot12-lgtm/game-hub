import StorePricesPanel from "@/components/StorePricesPanel";
import { getPricedCatalog } from "@/lib/storePricesServer";

export default function ModerationPricesPage() {
  // Admin-gated by the Moderation layout, which redirects anyone else away
  // before this renders.
  return <StorePricesPanel catalog={getPricedCatalog()} />;
}
