import { Phone } from "xero-node";

/**
 * Tool-facing names for a contact's phone types.
 *
 * DEFAULT is the one Xero shows on an invoice's contact panel and uses on the
 * invoice itself, so a number stored only as MOBILE looks missing to anyone
 * reading the invoice.
 */
export const phoneTypeNames = ["DEFAULT", "MOBILE", "DDI", "FAX"] as const;

export type PhoneTypeName = (typeof phoneTypeNames)[number];

export function toPhoneType(name: PhoneTypeName | undefined): Phone.PhoneTypeEnum {
  switch (name) {
    case "MOBILE":
      return Phone.PhoneTypeEnum.MOBILE;
    case "DDI":
      return Phone.PhoneTypeEnum.DDI;
    case "FAX":
      return Phone.PhoneTypeEnum.FAX;
    case "DEFAULT":
    default:
      return Phone.PhoneTypeEnum.DEFAULT;
  }
}
