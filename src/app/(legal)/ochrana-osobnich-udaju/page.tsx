import { LegalDocument, legalMetadata } from "@/components/legal/legal-document";

export const metadata = legalMetadata("ochrana-osobnich-udaju");

export default function OchranaOsobnichUdajuPage() {
  return <LegalDocument slug="ochrana-osobnich-udaju" />;
}
