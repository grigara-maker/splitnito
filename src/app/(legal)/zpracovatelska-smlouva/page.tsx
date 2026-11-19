import { LegalDocument, legalMetadata } from "@/components/legal/legal-document";

export const metadata = legalMetadata("zpracovatelska-smlouva");

export default function ZpracovatelskaSmlouvaPage() {
  return <LegalDocument slug="zpracovatelska-smlouva" />;
}
