import { z } from "zod";
import { RepeatingInvoice, Schedule } from "xero-node";
import { createXeroRepeatingInvoice } from "../../handlers/create-xero-repeating-invoice.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import {
  invoiceLineAmountTypeNames,
  toInvoiceLineAmountTypes,
} from "../../helpers/to-invoice-line-amount-types.js";

const trackingSchema = z.object({
  name: z.string().describe("The name of the tracking category. Can be obtained from the list-tracking-categories tool"),
  option: z.string().describe("The name of the tracking option. Can be obtained from the list-tracking-categories tool"),
  trackingCategoryID: z.string().describe("The ID of the tracking category. \
    Can be obtained from the list-tracking-categories tool"),
});

const lineItemSchema = z.object({
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The price per unit of the line item"),
  accountCode: z.string().describe("The account code of the line item - can be obtained from the list-accounts tool"),
  taxType: z.string().describe("The tax type of the line item - can be obtained from the list-tax-rates tool"),
  itemCode: z.string().describe("The item code of the line item - can be obtained from the list-items tool").optional(),
  tracking: z.array(trackingSchema).describe("Up to 2 tracking categories and options can be added to the line item. \
    Only use if prompted by the user.").optional(),
});

const CreateRepeatingInvoiceTool = CreateXeroTool(
  "create-repeating-invoice",
  "Create a repeating invoice template in Xero, so an invoice is generated on a \
schedule rather than one at a time. Use list-repeating-invoices first to check the \
customer does not already have one.\
 The template is created as DRAFT unless the user explicitly asks for AUTHORISED. \
A DRAFT template does not issue invoices on its own, so the user must approve it in \
Xero before it starts billing.",
  {
    contactId: z.string().describe("The ID of the contact to bill. \
      Can be obtained from the list-contacts tool."),
    lineItems: z.array(lineItemSchema),
    period: z.number().describe("How many units between invoices, e.g. 3 with MONTHLY for quarterly."),
    unit: z.enum(["WEEKLY", "MONTHLY"]).describe("The unit the period counts in."),
    startDate: z.string().describe("The date the first invoice is generated (YYYY-MM-DD format)."),
    endDate: z.string().optional().describe("Optional date the schedule stops (YYYY-MM-DD format). \
      Left off, it repeats until someone stops it."),
    dueDate: z
      .number()
      .optional()
      .describe("Optional number used with dueDateType, e.g. 15 with DAYSAFTERINVOICEDATE \
        means due fifteen days after the invoice date."),
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
      .describe("Optional payment terms, used together with dueDate."),
    reference: z.string().optional().describe("A reference shown on each generated invoice."),
    lineAmountTypes: z
      .enum(invoiceLineAmountTypeNames)
      .optional()
      .describe(
        "Optional line amount types (EXCLUSIVE, INCLUSIVE, NO_TAX). Xero treats unit \
amounts as tax exclusive when this is omitted, so pass INCLUSIVE when the amounts \
supplied already include tax.",
      ),
    brandingThemeId: z
      .string()
      .optional()
      .describe("Optional branding theme ID, from the list-branding-themes tool."),
    status: z
      .enum(["DRAFT", "AUTHORISED"])
      .optional()
      .describe(
        "Defaults to DRAFT, which does not bill anyone until a person approves the \
template in Xero. Only pass AUTHORISED when the user has explicitly asked for the \
template to start billing on its own.",
      ),
  },
  async ({
    contactId,
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
    const result = await createXeroRepeatingInvoice(
      contactId,
      lineItems,
      {
        period,
        unit:
          unit === "WEEKLY" ? Schedule.UnitEnum.WEEKLY : Schedule.UnitEnum.MONTHLY,
        startDate,
        endDate,
        dueDate,
        dueDateType: dueDateType
          ? Schedule.DueDateTypeEnum[dueDateType]
          : undefined,
      },
      status === "AUTHORISED"
        ? RepeatingInvoice.StatusEnum.AUTHORISED
        : RepeatingInvoice.StatusEnum.DRAFT,
      reference,
      toInvoiceLineAmountTypes(lineAmountTypes),
      brandingThemeId,
    );

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating repeating invoice: ${result.error}`,
          },
        ],
      };
    }

    const repeatingInvoice = result.result;
    const schedule = repeatingInvoice?.schedule;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Repeating invoice created successfully:",
            `ID: ${repeatingInvoice?.repeatingInvoiceID}`,
            `Contact: ${repeatingInvoice?.contact?.name}`,
            repeatingInvoice?.reference
              ? `Reference: ${repeatingInvoice.reference}`
              : null,
            schedule?.period && schedule?.unit
              ? `Repeats: every ${schedule.period} ${schedule.unit}`
              : null,
            schedule?.nextScheduledDate
              ? `Next invoice: ${schedule.nextScheduledDate}`
              : null,
            schedule?.endDate ? `Ends: ${schedule.endDate}` : null,
            `Line amount types: ${repeatingInvoice?.lineAmountTypes}`,
            `Total: ${repeatingInvoice?.total}`,
            `Status: ${repeatingInvoice?.status}`,
            repeatingInvoice?.status === RepeatingInvoice.StatusEnum.DRAFT
              ? "This template is a draft, so it will not bill anyone until it is approved in Xero."
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateRepeatingInvoiceTool;
