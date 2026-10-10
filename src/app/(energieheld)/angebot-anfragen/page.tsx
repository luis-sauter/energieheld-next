import { randomUUID } from "node:crypto";
import { CampaignForm } from "@/components/advertising/campaign-form";
import { emptyOfferCampaign } from "@/lib/offer-requests";
import { pageMetadata } from "@/lib/seo";
import styles from "@/components/advertising/advertising.module.css";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({title:"Angebot anfragen",description:"Stellen Sie Ihre unverbindliche Angebotsanfrage mit Kontaktdaten und optionalen Werbeplatz- und Zeitraumwünschen.",path:"/angebot-anfragen"});
export default function OfferRequestPage(){const key=randomUUID();return <main id="hauptinhalt" className={"container "+styles.page}><h1>Angebot anfragen</h1><p className={styles.intro}>Wir beraten Gastgeber und Reiseanbieter persönlich. Platzierung und Zeitraum können Sie offen lassen. Es entsteht keine verbindliche Buchung.</p><div className={styles.card}><CampaignForm campaign={emptyOfferCampaign(key)} categoryIds={[]} publicRequestKey={key}/></div></main>;}
