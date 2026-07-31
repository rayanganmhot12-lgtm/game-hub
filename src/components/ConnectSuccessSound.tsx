"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSound } from "@/context/SoundContext";
import { useToast } from "@/context/ToastContext";

export default function ConnectSuccessSound() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { playSuccess } = useSound();
  const { showToast } = useToast();
  const connected = searchParams.get("connected");

  useEffect(() => {
    if (!connected) return;
    playSuccess();
    showToast(`${connected === "steam" ? "Steam" : connected} connected!`, "success");
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return null;
}
