"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

// useSearchParams must sit inside a Suspense boundary (Next 15 static-prerender rule).
function LoginNotice() {
  const error = useSearchParams().get("error");
  if (!error) return null;
  return (
    <div className="panel status error" style={{ marginTop: 12 }}>
      This Google account is not authorized for admin access. Sign in with an allow-listed account, or
      contact the owner to be added.
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="main" style={{ maxWidth: 420, margin: "12vh auto", textAlign: "center" }}>
      <h1 className="page-title">Admin · Household 360</h1>
      <p className="muted">Authorized admins only. Sign in with your Google account.</p>
      <Suspense>
        <LoginNotice />
      </Suspense>
      <button
        className="button"
        style={{ marginTop: 20, minWidth: 220 }}
        onClick={() => signIn("google", { callbackUrl: "/" })}
      >
        Sign in with Google
      </button>
    </main>
  );
}
