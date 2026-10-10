import { randomUUID } from "node:crypto";
import { OfferRequestForm } from "@/components/advertising/offer-request-form";
import { pageMetadata } from "@/lib/seo";
import styles from "@/components/auth/auth.module.css";
export const metadata=pageMetadata({title:"Unverbindlich Angebot anfragen",description:"Ihr Unternehmen auf DAS Reiseportal präsentieren: persönlich beraten lassen, ohne Registrierung und ohne verpflichtende Werbeauswahl.",path:"/angebot-anfragen"});
export default function OfferRequestPage(){return <main id="hauptinhalt" className={"container "+styles.page}><h1>Unverbindlich Angebot anfragen</h1><p>Sie möchten Ihr Unternehmen auf DAS Reiseportal präsentieren? Erzählen Sie uns kurz von Ihrem Unternehmen. Wir beraten Sie persönlich zu den passenden Möglichkeiten.</p><section className={styles.card}><OfferRequestForm requestKey={randomUUID()}/></section></main>;}
