"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const refreshIntervalMs = 5 * 60 * 1000;

export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [router]);

  return null;
}
