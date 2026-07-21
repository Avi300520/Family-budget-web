import { Suspense } from "react";
import ConsumeClient from "./ConsumeClient";

export default function ConsumePage() {
  return (
    // BATCH-GI D5: the fallback is a fully rendered STATE - and the one a
    // magic-link user actually lands on - so it carries an <h1> like every other
    // state (mirrors /join's sr-only fallback heading). Zero pixels change.
    <Suspense
      fallback={
        <div className="login-page">
          <main id="main">
            <h1 className="sr-only">כניסה ל-Pingtally</h1>
            <span role="status">טוען...</span>
          </main>
        </div>
      }
    >
      <ConsumeClient />
    </Suspense>
  );
}
