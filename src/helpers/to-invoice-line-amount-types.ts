import { LineAmountTypes } from "xero-node";

/**
 * Tool-facing names for an invoice's line amount types.
 *
 * These follow the same vocabulary as the quote and manual journal tools, which
 * is why NO_TAX is spelled with an underscore here while the value Xero expects
 * is NoTax. Invoices use the LineAmountTypes enum, not the QuoteLineAmountTypes
 * enum used by quotes, and the two do not share the same values.
 */
export const invoiceLineAmountTypeNames = [
  "EXCLUSIVE",
  "INCLUSIVE",
  "NO_TAX",
] as const;

export type InvoiceLineAmountTypeName =
  (typeof invoiceLineAmountTypeNames)[number];

export function toInvoiceLineAmountTypes(
  name: InvoiceLineAmountTypeName | undefined,
): LineAmountTypes | undefined {
  switch (name) {
    case "EXCLUSIVE":
      return LineAmountTypes.Exclusive;
    case "INCLUSIVE":
      return LineAmountTypes.Inclusive;
    case "NO_TAX":
      return LineAmountTypes.NoTax;
    default:
      return undefined;
  }
}
