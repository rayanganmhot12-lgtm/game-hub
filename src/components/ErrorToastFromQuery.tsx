"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useToast } from "@/context/ToastContext";

export default function ErrorToastFromQuery({ messages }: { messages: Record<string, string> }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const error = searchParams.get("error");

  useEffect(() => {
    if (!error || !messages[error]) return;
    showToast(messages[error], "error");
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return null;
}
