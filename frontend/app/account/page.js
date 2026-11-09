"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { homeFor } from "@/lib/rbac";
import { Loading } from "@/components/ui";

export default function AccountIndexPage() {
  const { ready, user, state } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?next=/account");
      return;
    }
    if (user.role === "CUSTOMER" || user.permissions?.includes("order.track_own")) {
      router.replace("/account/orders");
    } else {
      router.replace(homeFor(state?.roleMatrix, user.role));
    }
  }, [ready, user, state?.roleMatrix, router]);

  return <Loading />;
}
