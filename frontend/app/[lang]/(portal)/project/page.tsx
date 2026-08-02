import { ProjectPage } from "@/components/project-page";
import { localizedMetadata } from "@/lib/localized-metadata";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  return localizedMetadata((await params).lang, (d) => d.nav.project);
}

export default function Page() {
  return <ProjectPage />;
}
