import { LegalDocument, legalMetadata } from "@/components/legal/legal-document";

export const metadata = legalMetadata("podminky");

export default function PodminkyPage() {
  return <LegalDocument slug="podminky" />;
}
