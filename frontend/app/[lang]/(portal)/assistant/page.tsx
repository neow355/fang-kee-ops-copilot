import { AssistantPanel } from "@/components/feature-panels";
import { localizedMetadata } from "@/lib/localized-metadata";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  return localizedMetadata((await params).lang, (d) => d.nav.assistant);
}

export default function AssistantPage() {
  return <AssistantPanel />;
}
