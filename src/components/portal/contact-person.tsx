import Image from "next/image";
import type { Listing } from "@/types/portal";

export function ContactPerson({ contact }: { contact: Listing["contact"] }) {
  const name = contact.person?.trim();
  if (!name && !contact.personImage) return null;
  return <section aria-label="Ansprechpartner" className="profile-contact-person">
    <h3>Ansprechpartner</h3>
    {contact.personImage && <Image src={contact.personImage.src} alt={name ? `Ansprechpartner: ${name}` : "Ansprechpartner"} width={96} height={96} unoptimized style={{ objectFit: "cover", borderRadius: "50%" }} />}
    {name && <p>{name}</p>}
  </section>;
}
