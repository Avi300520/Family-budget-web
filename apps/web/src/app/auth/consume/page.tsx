import { Suspense } from "react";
import ConsumeClient from "./ConsumeClient";

export default function ConsumePage() {
  return (
    <Suspense fallback={<div className="login-page">טוען...</div>}>
      <ConsumeClient />
    </Suspense>
  );
}
