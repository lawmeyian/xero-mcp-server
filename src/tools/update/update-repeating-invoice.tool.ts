import { z } from "zod";
import { RepeatingInvoice, Schedule } from "xero-node";
import { updateXeroRepeatingInvoice } from "../../handlers/update-xero-repeating-invoice.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import {
  invoiceLineAmountTypeNames,
  toInvoiceLineAmountTypes,
} from "../../helpers/to-invoice-line-amount-types.js";

const trackingSchema = z.object({
  name: z.string(),
  option: z.string(),
  trackingCategoryID: z.string(),
});

const lineItemSchema = z.object({
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The price per unit of the line item"),
  accountCode: z.string().describe("The account code - can be obtained from the list-accounts tool"),
  taxType: z.string().describe("The tax type - can be obtained from the list-tax-rates tool"),
  itemCode: z.string().optional(),
  tracking: z.array(trackingSchema).optional(),
});

const UpdateRepeatingInvoiceTool = CreateXeroTool(
  "update-repeating-invoice",
  "Update a repeating invoice template in Xero. Only the fields supplied are changed; \
everything else is carried forward. Use list-repeating-invoices first to find the ID and to \
see what the template holds now.\
 Leave lineItems out unless the amounts are actually changing: Xero returns line items with \
their unit amounts already reduced to tax exclusive values, so re-sending what was read back \
from an INCLUSIVE template strips the tax a second time. When the amounts ARE changing, type \
the tax inclusive amounts the customer should see.\
 The result reports the template before and after, so the change can be checked. If Xero ever \
answers with a different template ID - meaning it created a second template rather than changing \
this one - the new template is deleted immediately and the call reports an error, because a live \
duplicate bills the customer twice.",
  {
    repeatingInvoiceId: z.string().describe("The ID of the repeating invoice to update, from \
      the list-repeating-invoices tool."),
    lineItems: z
      .array(lineItemSchema)
      .optional()
      .describe(
        "Only when the amounts or descriptions change. All line items must be given, because \
they replace the template's current ones.",
      ),
    period: z.number().optional().describe("How many units between invoices, e.g. 3 with MONTHLY for quarterly."),
    unit: z.enum(["WEEKLY", "MONTHLY"]).optional().describe("The unit the period counts in."),
    startDate: z.string().optional().describe("New start date (YYYY-MM-DD). Changing this moves \
      the next invoice, so only set it deliberately."),
    endDate: z.string().optional().describe("Date the schedule stops (YYYY-MM-DD)."),
    dueDate: z.number().optional().describe("Number used with dueDateType, e.g. 15."),
    dueDateType: z
      .enum([
        "DAYSAFTERBILLDATE",
        "DAYSAFTERBILLMONTH",
        "DAYSAFTERINVOICEDATE",
        "DAYSAFTERINVOICEMONTH",
        "OFCURRENTMONTH",
        "OFFOLLOWINGMONTH",
      ])
      .optional()
      .describe("Payment terms, used with dueDate. Xero rejects DAYSAFTERINVOICEDATE on a sales \
        template - use DAYSAFTERBILLDATE, where the bill date is the invoice date."),
    reference: z.string().optional().describe("The reference shown on each generated invoice."),
    lineAmountTypes: z
      .enum(invoiceLineAmountTypeNames)
      .optional()
      .describe("EXCLUSIVE, INCLUSIVE or NO_TAX. Left off, the template keeps its current setting."),
    brandingThemeId: z
      .string()
      .optional()
      .describe("Branding theme ID, from the list-branding-themes tool."),
    status: z
      .enum(["DRAFT", "AUTHORISED"])
      .optional()
      .describe(
        "Left off, the template keeps its current status. Only pass AUTHORISED when the user \
has explicitly asked for the template to start billing on its own.",
      ),
  },
  async ({
    repeatingInvoiceId,
    lineItems,
    period,
    unit,
    startDate,
    endDate,
    dueDate,
    dueDateType,
    reference,
    lineAmountTypes,
    brandingThemeId,
    status,
  }) => {
    const scheduleChanged =
      period !== undefined ||
      unit !== undefined ||
      startDate !== undefined ||
      endDate !== undefined ||
      dueDate !== undefined ||
      dueDateType !== undefined;

    const result = await updateXeroRepeatingInvoice(repeatingInvoiceId, {
      lineItems,
      reference,
      lineAmountTypes: toInvoiceLineAmountTypes(lineAmountTypes),
      brandingThemeId,
      status:
        status === "AUTHORISED"
          ? RepeatingInvoice.StatusEnum.AUTHORISED
          : status === "DRAFT"
            ? RepeatingInvoice.StatusEnum.DRAFT
            : undefined,
      schedule: scheduleChanged
        ? {
            period,
            unit:
              unit === undefined
                ? undefined
                : unit === "WEEKLY"
                  ? Schedule.UnitEnum.WEEKLY
                  : Schedule.UnitEnum.MONTHLY,
            startDate,
            endDate,
            dueDate,
            dueDateType: dueDateType
              ? Schedule.DueDateTypeEnum[dueDateType]
              : undefined,
          }
        : undefined,
    });

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating repeating invoice: ${result.error}`,
          },
        ],
      };
    }

    const { before, after } = result.result;

    const describe = (r: typeof before) =>
      [
        `  Total: ${r.total}`,
        `  Line amount types: ${r.lineAmountTypes}`,
        `  Reference: ${r.reference ?? "(none)"}`,
        r.schedule?.period && r.schedule?.unit
          ? `  Repeats: every ${r.schedule.period} ${r.schedule.unit}`
          : null,
        r.schedule?.nextScheduledDate
          ? `  Next invoice: ${r.schedule.nextScheduledDate}`
          : null,
        r.schedule?.endDate ? `  Ends: ${r.schedule.endDate}` : null,
        `  Branding theme ID: ${r.brandingThemeID ?? "(organisation default)"}`,
        `  Status: ${r.status}`,
      ]
        .filter(Boolean)
        .join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Repeating invoice updated:",
            `ID: ${after.repeatingInvoiceID}`,
            `Contact: ${after.contact?.name}`,
            "",
            "Before:",
            describe(before),
            "",
            "After:",
            describe(after),
            "",
            before.total !== after.total
              ? `The total changed from ${before.total} to ${after.total}. Check that this was intended.`
              : "The total did not change.",
          ].join("\n"),
        },
      ],
    };
  },
);

export default UpdateRepeatingInvoiceTool;
