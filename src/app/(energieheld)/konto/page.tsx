import { redirect } from "next/navigation";
import { getPortalAccount } from "@/lib/portal-account-server";
export const metadata={robots:{index:false,follow:false}};
export default async function AccountPage(){const account=await getPortalAccount();redirect(account.access==="admin"?"/admin":"/angebot-anfragen");}
