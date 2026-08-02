import Link from "next/link";
import { LayoutDashboard, Library, Trophy, Plug } from "lucide-react";

const cards = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Your stats and recently played games.",
    icon: LayoutDashboard,
  },
  {
    href: "/library",
    label: "Library",
    description: "Your full unified game collection.",
    icon: Library,
  },
  {
    href: "/achievements",
    label: "Achievements",
    description: "Track progress across every game.",
    icon: Trophy,
  },
  {
    href: "/connect",
    label: "Connections",
    description: "Manage linked platform accounts.",
    icon: Plug,
  },
];

export default function GameHubPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Game Hub</h1>
        <p className="text-sm text-muted">Quick links to your Steam library and connected accounts.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="panel panel-hover flex items-center gap-4 p-4">
            <div className="icon-badge h-11 w-11 shrink-0">
              <Icon size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="truncate text-xs text-muted">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
