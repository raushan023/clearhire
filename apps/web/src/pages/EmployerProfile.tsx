import { ContactDetails } from "../components/ContactDetails";
import { PageHeader } from "../components/ui";
export function EmployerProfilePage() {
  return (
    <>
      <PageHeader
        title="Your account"
        description="Manage your personal contact details. Manage company information in Companies."
      />
      <ContactDetails />
    </>
  );
}
