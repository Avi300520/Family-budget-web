"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { safeNextPath } from "../../../lib/authGuard";

export default function ConsumeClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("חסר token");
      return;
    }
    const next = params.get("next");
    api
      .consumeMagicLink(token)
      .then((result) => {
        if (next) { router.replace(safeNextPath(next)); return; }
        router.replace(result.hasHousehold ? "/dashboard" : "/onboarding");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "שגיאה בכניסה"));
  }, [params, router]);

  return <div className="login-page">{error ? <div className="login-box status error">{error}</div> : <div className="login-box">מתחבר...</div>}</div>;
}
