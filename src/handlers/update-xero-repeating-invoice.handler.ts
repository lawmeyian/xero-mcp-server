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

export interface RepeatingInvoiceScheduleChange {
  period?: number;
  unit?: Schedule.UnitEnum;
  startDate?: string;
  endDate?: string;
  dueDate?: number;
  dueDateType?: Schedule.DueDateTypeEnum;
}

export interface UpdatedRepeatingInvoice {
  before: RepeatingInvoice;
  after: RepeatingInvoice;
}

async function getRepeatingInvoice(
  repeatingInvoiceId: string,
): Promise<RepeatingInvoice | undefined> {
  const response = await xeroClient.accountingApi.getRepeatingInvoices(
    xeroClient.tenantId,
    `RepeatingInvoiceID==Guid("${repeatingInvoiceId}")`, // where
    undefined, // order
    getClientHeaders(), // options
  );

  return response.body.repeatingInvoices?.[0];
}

/** Delete a template outright. Only used to clean up a duplicate we caused. */
async function deleteRepeatingInvoice(repeatingInvoiceId: string) {
  await xeroClient.accountingApi.createRepeatingInvoices(
    xeroClient.tenantId,
    {
      repeatingInvoices: [
        {
          repeatingInvoiceID: repeatingInvoiceId,
          status: RepeatingInvoice.StatusEnum.DELETED,
        },
      ],
    },
    true, // summarizeErrors
    undefined, // idempotencyKey
    getClientHeaders(), // options
  );
}

/**
 * Update a repeating invoice template in Xero.
 *
 * Xero exposes THREE routes for repeating invoices and only one of them updates:
 *
 *   PUT  /RepeatingInvoices              (createRepeatingInvoices)
 *     Answers "Repeating invoice status must be set to DELETED". Delete only.
 *
 *   POST /RepeatingInvoices              (updateOrCreateRepeatingInvoices)
 *     Carrying the template's own RepeatingInvoiceID in the BODY does NOT update
 *     it - tested against a live Konnekt template on 10 Oct 2026, it created a
 *     SECOND template, approved and billing, alongside the original. Never use
 *     this to change a template.
 *
 *   POST /RepeatingInvoices/{RepeatingInvoiceID}   (updateRepeatingInvoice)
 *     The ID is in the URL, so Xero cannot read the call as "create new". This
 *     is the one that updates, and the one used here.
 *
 * Only the fields the caller supplies are sent. Line items are left out unless
 * the caller supplies them, because Xero hands them back with their unit amounts
 * already reduced to tax exclusive values, and re-POSTing those against an
 * INCLUSIVE template strips the tax a second time.
 *
 * Because the duplicate above was created on real customer data, this checks the
 * ID that comes back. If Xero returns a DIFFERENT template ID, the call created
 * something instead of updating it, so the new template is deleted immediately
 * and the caller is told the update failed.
 */
export async function updateXeroRepeatingInvoice(
  repeatingInvoiceId: string,
  changes: {
    lineItems?: RepeatingInvoiceLineItem[];
    schedule?: RepeatingInvoiceScheduleChange;
    reference?: string;
    lineAmountTypes?: LineAmountTypes;
    brandingThemeId?: string;
    status?: RepeatingInvoice.StatusEnum;
  },
): Promise<XeroClientResponse<UpdatedRepeatingInvoice>> {
  try {
    await xeroClient.authenticate();

    const before = await getRepeatingInvoice(repeatingInvoiceId);

    if (!before) {
      return {
        result: null,
        isError: true,
        error: `No repeating invoice found with ID ${repeatingInvoiceId}.`,
      };
    }

    // Only the schedule fields actually supplied are changed; the rest of the
    // schedule is carried forward from the template as it stands, because Xero
    // replaces the whole schedule object.
    const schedule: Schedule | undefined = changes.schedule
      ? {
          ...before.schedule,
          ...Object.fromEntries(
            Object.entries(changes.schedule).filter(
              ([, value]) => value !== undefined,
            ),
          ),
        }
      : undefined;

    const payload: RepeatingInvoice = {
      repeatingInvoiceID: repeatingInvoiceId,
      ...(changes.reference !== undefined
        ? { reference: changes.reference }
        : {}),
      ...(changes.lineAmountTypes
        ? { lineAmountTypes: changes.lineAmountTypes }
        : {}),
      ...(changes.brandingThemeId
        ? { brandingThemeID: changes.brandingThemeId }
        : {}),
      ...(changes.status ? { status: changes.status } : {}),
      ...(changes.lineItems ? { lineItems: changes.lineItems } : {}),
      ...(schedule ? { schedule } : {}),
    };

    const response = await xeroClient.accountingApi.updateRepeatingInvoice(
      xeroClient.tenantId,
      repeatingInvoiceId, // repeatingInvoiceID, in the URL
      { repeatingInvoices: [payload] }, // repeatingInvoices
      undefined, // idempotencyKey
      getClientHeaders(), // options
    );

    const returned = response.body.repeatingInvoices?.[0];

    if (!returned) {
      return {
        result: null,
        isError: true,
        error: "Xero accepted the request but returned no repeating invoice.",
      };
    }

    const returnedId = returned.repeatingInvoiceID;

    // The safety net. If Xero made a new template rather than changing this one,
    // undo it at once: a live duplicate bills the customer twice.
    if (returnedId && returnedId.toLowerCase() !== repeatingInvoiceId.toLowerCase()) {
      let cleanup: string;
      try {
        await deleteRepeatingInvoice(returnedId);
        cleanup = `The duplicate (${returnedId}) was deleted straight away.`;
      } catch (deleteError) {
        cleanup =
          `The duplicate (${returnedId}) could NOT be deleted automatically - ` +
          `delete it in Xero now, before it bills anyone: ${formatError(deleteError)}`;
      }

      return {
        result: null,
        isError: true,
        error:
          "Xero created a SECOND repeating invoice instead of updating this one. " +
          `Asked it to change ${repeatingInvoiceId}, got back ${returnedId}. ` +
          `${cleanup} The original template was not changed. Edit it in Xero ` +
          "instead: Business > Invoices > Repeating.",
      };
    }

    const after = (await getRepeatingInvoice(repeatingInvoiceId)) ?? returned;

    return {
      result: { before, after },
      isError: false,
      error: null,
    };
  } catch (error) {
    const message = formatError(error);

    /* Xero's repeating invoice endpoint supports create and delete, not modify.
       Every update route answers this, including POST /RepeatingInvoices/{ID},
       and it answers it even when the current status is passed explicitly, so it
       is refusing the change itself rather than complaining about a field.
       Tested against a live Konnekt template on 10 Oct 2026. Xero's web screens
       can edit a template because they use Xero's own internal endpoint. */
    if (message.includes("status must be set to DELETED")) {
      const existing = await getRepeatingInvoice(repeatingInvoiceId).catch(
        () => undefined,
      );

      const describe = existing
        ? [
            `Contact: ${existing.contact?.name}`,
            `Reference: ${existing.reference ?? "(none)"}`,
            existing.schedule?.period && existing.schedule?.unit
              ? `repeats every ${existing.schedule.period} ${existing.schedule.unit}`
              : null,
            existing.schedule?.nextScheduledDate
              ? `next invoice ${existing.schedule.nextScheduledDate}`
              : null,
            `total ${existing.total}`,
            `status ${existing.status}`,
          ]
            .filter(Boolean)
            .join("; ")
        : "could not be read back";

      return {
        result: null,
        isError: true,
        error:
          "Xero's API cannot change an existing repeating invoice. Its " +
          "repeating invoice endpoint only creates and deletes - every update " +
          "route answers \"status must be set to DELETED\". Edit it in Xero " +
          "instead: Business > Invoices > Repeating, open the template, change " +
          "it, and Save. The email template (Basic - Automatic vs Basic - " +
          "Invoiced) can only be set there too. Nothing was changed. " +
          `The template as it stands - ${describe}.`,
      };
    }

    return {
      result: null,
      isError: true,
      error: message,
    };
  }
}
