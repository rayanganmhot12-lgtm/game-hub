"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Bookmark, Plus, X } from "lucide-react";

interface SavedView {
  id: string;
  name: string;
  q: string;
  platform: string;
  status: string;
  tag: string;
  sort: string;
}

const STORAGE_KEY = "gamehub:savedViews";

export default function SavedViews() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [views, setViews] = useState<SavedView[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setViews(JSON.parse(raw));
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  function persist(next: SavedView[]) {
    setViews(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function saveCurrentView() {
    if (!name.trim()) return;
    const view: SavedView = {
      id: crypto.randomUUID(),
      name: name.trim(),
      q: searchParams.get("q") ?? "",
      platform: searchParams.get("platform") ?? "",
      status: searchParams.get("status") ?? "",
      tag: searchParams.get("tag") ?? "",
      sort: searchParams.get("sort") ?? "",
    };
    persist([...views, view]);
    setName("");
    setNaming(false);
  }

  function applyView(view: SavedView) {
    const params = new URLSearchParams();
    if (view.q) params.set("q", view.q);
    if (view.platform) params.set("platform", view.platform);
    if (view.status) params.set("status", view.status);
    if (view.tag) params.set("tag", view.tag);
    if (view.sort) params.set("sort", view.sort);
    router.push(`${pathname}?${params.toString()}`);
  }

  function removeView(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    persist(views.filter((v) => v.id !== id));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((view) => (
        <button key={view.id} onClick={() => applyView(view)} className="btn-ghost !gap-1.5 !py-1 !text-xs">
          <Bookmark size={12} />
          {view.name}
          <X
            size={12}
            onClick={(e) => removeView(view.id, e)}
            className="ml-1 opacity-50 transition-opacity hover:opacity-100"
          />
        </button>
      ))}

      {naming ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCurrentView()}
            placeholder="View name…"
            className="input-field w-32 !py-1 !text-xs"
          />
          <button onClick={saveCurrentView} className="btn-ghost !px-2 !py-1 !text-xs">
            Save
          </button>
          <button onClick={() => setNaming(false)} className="btn-ghost !px-2 !py-1 !text-xs">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button onClick={() => setNaming(true)} className="btn-ghost !gap-1.5 !py-1 !text-xs">
          <Plus size={12} />
          Save current view
        </button>
      )}
    </div>
  );
}
