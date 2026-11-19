import { LegalDocument, legalMetadata } from "@/components/legal/legal-document";

export const metadata = legalMetadata("cookies");

export default function CookiesPage() {
  return <LegalDocument slug="cookies" />;
}
