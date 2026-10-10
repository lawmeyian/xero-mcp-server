import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import {
  LineAmountTypes,
  LineItemTracking,
  RepeatingInvoice,
  Schedule,
} from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface RepeatingInvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

export interface RepeatingInvoiceSchedule {
  period: number;
  unit: Schedule.UnitEnum;
  startDate: string;
  endDate?: string;
  dueDate?: number;
  dueDateType?: Schedule.DueDateTypeEnum;
}

async function createRepeatingInvoice(
  contactId: string,
  lineItems: RepeatingInvoiceLineItem[],
  schedule: RepeatingInvoiceSchedule,
  status: RepeatingInvoice.StatusEnum,
  reference: string | undefined,
  lineAmountTypes: LineAmountTypes | undefined,
  brandingThemeId: string | undefined,
  approvedForSending: boolean | undefined,
): Promise<RepeatingInvoice | undefined> {
  await xeroClient.authenticate();

  const repeatingInvoice: RepeatingInvoice = {
    type: RepeatingInvoice.TypeEnum.ACCREC,
    contact: { contactID: contactId },
    lineItems: lineItems,
    schedule: schedule,
    status: status,
    reference: reference,
    // Both left off when not supplied, so Xero applies its own defaults
    ...(lineAmountTypes ? { lineAmountTypes } : {}),
    ...(brandingThemeId ? { brandingThemeID: brandingThemeId } : {}),
    // "Approve for Sending" in Xero: the invoice is emailed when it generates.
    // Which email template it uses (Basic - Automatic for a customer paying by
    // card, Basic - Invoiced for one who is not) is NOT in the API, so that
    // still has to be picked in Xero.
    ...(approvedForSending
      ? { approvedForSending: true, markAsSent: true, includePDF: true }
      : {}),
  };

  const response = await xeroClient.accountingApi.createRepeatingInvoices(
    xeroClient.tenantId,
    { repeatingInvoices: [repeatingInvoice] }, // repeatingInvoices
    true, // summarizeErrors
    undefined, // idempotencyKey
    getClientHeaders(), // options
  );

  return response.body.repeatingInvoices?.[0];
}

/**
 * Create a repeating invoice template in Xero
 */
export async function createXeroRepeatingInvoice(
  contactId: string,
  lineItems: RepeatingInvoiceLineItem[],
  schedule: RepeatingInvoiceSchedule,
  status: RepeatingInvoice.StatusEnum = RepeatingInvoice.StatusEnum.DRAFT,
  reference?: string,
  lineAmountTypes?: LineAmountTypes,
  brandingThemeId?: string,
  approvedForSending?: boolean,
): Promise<XeroClientResponse<RepeatingInvoice>> {
  try {
    const created = await createRepeatingInvoice(
      contactId,
      lineItems,
      schedule,
      status,
      reference,
      lineAmountTypes,
      brandingThemeId,
      approvedForSending,
    );

    if (!created) {
      throw new Error("Repeating invoice creation failed.");
    }

    return {
      result: created,
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
