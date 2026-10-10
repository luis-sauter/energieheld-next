import { bannerOfferTarget } from "@/lib/banner-offer-link";
import { randomUUID } from "node:crypto";
import { CampaignForm } from "@/components/advertising/campaign-form";
import { emptyOfferCampaign } from "@/lib/offer-requests";
import { pageMetadata } from "@/lib/seo";
import styles from "@/components/advertising/advertising.module.css";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({title:"Angebot anfragen",description:"Stellen Sie Ihre unverbindliche Angebotsanfrage mit Kontaktdaten und optionalen Werbeplatz- und Zeitraumwünschen.",path:"/angebot-anfragen"});
export default async function OfferRequestPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) { const query=await searchParams ?? {},key=randomUUID(),campaign=emptyOfferCampaign(key); const target=bannerOfferTarget(typeof query.seite === "string" ? query.seite : "",typeof query.platz === "string" ? query.platz : ""); if(target) campaign.targets=[target]; return <main id="hauptinhalt" className={"container "+styles.page}><h1>Angebot anfragen</h1><p className={styles.intro}>Wir beraten Gastgeber und Reiseanbieter persönlich. Platzierung und Zeitraum können Sie offen lassen. Es entsteht keine verbindliche Buchung.</p><div className={styles.card}><CampaignForm campaign={campaign} categoryIds={[]} publicRequestKey={key}/></div></main>;}
