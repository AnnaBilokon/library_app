import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Stats" };

export default function StatsPage() {
  return <ComingSoon title="Stats" text="Charts of what and how much you read arrive in Phase 3." />;
}
