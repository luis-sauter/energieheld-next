import type { AdminAccess } from "./admin-review";
export type PortalAccount={access:AdminAccess;hasCompany:boolean};
export function accountCta({access}:PortalAccount){return access==="admin"?{label:"Adminbereich",href:"/admin"}:{label:"Unverbindlich anfragen",href:"/angebot-anfragen"};}
export function safeAccountReturnPath(value:unknown,account:PortalAccount){return account.access==="admin" && typeof value==="string" && ["/admin","/admin/werbung"].includes(value)?value:null;}
export function accountLoginDestination(account:PortalAccount,next?:unknown){return safeAccountReturnPath(next,account)??(account.access==="admin"?"/admin":"/angebot-anfragen");}
