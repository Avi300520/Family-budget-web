import type { Metadata } from "next";

// /join is a per-invite, token-bearing page — never meant to be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
