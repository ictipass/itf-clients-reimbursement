"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { acknowledgeTrainingFeedbackViewed } from "@/app/(dashboard)/training-feedback-viewed-action";

export function EmployerFeedbackViewed({
  target,
  targetId,
}: {
  target: "request" | "monitoring";
  targetId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let started = false;

    function acknowledgeWhenVisible() {
      if (started || document.visibilityState !== "visible") {
        return;
      }

      started = true;
      void acknowledgeTrainingFeedbackViewed(target, targetId)
        .then((acknowledged) => {
          if (acknowledged) router.refresh();
        })
        .catch(() => {
          started = false;
        });
    }

    acknowledgeWhenVisible();
    document.addEventListener("visibilitychange", acknowledgeWhenVisible);
    return () => document.removeEventListener("visibilitychange", acknowledgeWhenVisible);
  }, [router, target, targetId]);

  return null;
}
