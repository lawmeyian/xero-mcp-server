import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoice, LineAmountTypes, LineItemTracking } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

async function createInvoice(
  contactId: string,
  lineItems: InvoiceLineItem[],
  type: Invoice.TypeEnum,
  reference: string | undefined,
  date: string | undefined,
  lineAmountTypes: LineAmountTypes | undefined,
  dueDate: string | undefined,
  brandingThemeId: string | undefined,
): Promise<Invoice | undefined> {
  await xeroClient.authenticate();

  const invoice: Invoice = {
    type: type,
    contact: {
      contactID: contactId,
    },
    lineItems: lineItems,
    date: date || new Date().toISOString().split("T")[0], // Use provided date or today's date
    dueDate:
      dueDate ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // Use the supplied due date, or 30 days from now
    // Left off when not supplied, so Xero applies its own default (Exclusive)
    ...(lineAmountTypes ? { lineAmountTypes } : {}),
    // Left off when not supplied, so Xero applies the organisation's default theme
    ...(brandingThemeId ? { brandingThemeID: brandingThemeId } : {}),
    ...(type === Invoice.TypeEnum.ACCPAY
      ? { invoiceNumber: reference }
      : { reference: reference }),
    status: Invoice.StatusEnum.DRAFT,
  };

  const response = await xeroClient.accountingApi.createInvoices(
    xeroClient.tenantId,
    {
      invoices: [invoice],
    }, // invoices
    true, //summarizeErrors
    undefined, //unitdp
    undefined, //idempotencyKey
    getClientHeaders(),
  );
  const createdInvoice = response.body.invoices?.[0];
  return createdInvoice;
}

/**
 * Create a new invoice in Xero
 */
export async function createXeroInvoice(
  contactId: string,
  lineItems: InvoiceLineItem[],
  type: Invoice.TypeEnum = Invoice.TypeEnum.ACCREC,
  reference?: string,
  date?: string,
  lineAmountTypes?: LineAmountTypes,
  dueDate?: string,
  brandingThemeId?: string,
): Promise<XeroClientResponse<Invoice>> {
  try {
    const createdInvoice = await createInvoice(
      contactId,
      lineItems,
      type,
      reference,
      date,
      lineAmountTypes,
      dueDate,
      brandingThemeId,
    );

    if (!createdInvoice) {
      throw new Error("Invoice creation failed.");
    }

    return {
      result: createdInvoice,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
