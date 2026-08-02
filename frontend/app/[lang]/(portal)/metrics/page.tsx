import { MetricsPanel } from "@/components/feature-panels";
import { localizedMetadata } from "@/lib/localized-metadata";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  return localizedMetadata((await params).lang, (d) => d.nav.metrics);
}

export default function MetricsPage() {
  return <MetricsPanel />;
}
