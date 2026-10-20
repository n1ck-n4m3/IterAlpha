export interface AdminIdentity {userId:string|null;email:string|null}
export interface AdminConfiguration {ITERALPHA_ADMIN_USER_ID?:string;ITERALPHA_ADMIN_EMAIL?:string}

export function isSiteAdmin(identity:AdminIdentity,configuration:AdminConfiguration):boolean{
  if(!identity.userId||!identity.email)return false;
  const idMatch=!!configuration.ITERALPHA_ADMIN_USER_ID&&identity.userId===configuration.ITERALPHA_ADMIN_USER_ID;
  const emailMatch=!!configuration.ITERALPHA_ADMIN_EMAIL&&identity.email.trim().toLowerCase()===configuration.ITERALPHA_ADMIN_EMAIL.trim().toLowerCase();
  return idMatch||emailMatch;
}
