import { Suspense } from "react";
import ConsumeClient from "./ConsumeClient";

export default function ConsumePage() {
  return (
    <Suspense fallback={<div className="login-page"><main id="main"><span role="status">טוען...</span></main></div>}>
      <ConsumeClient />
    </Suspense>
  );
}
