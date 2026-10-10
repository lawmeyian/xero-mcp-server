import { z } from "zod";
import { listXeroRepeatingInvoices } from "../../handlers/list-xero-repeating-invoices.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListRepeatingInvoicesTool = CreateXeroTool(
  "list-repeating-invoices",
  "Lists the repeating invoice templates in Xero. Each one shows the contact, the \
schedule it repeats on, the amounts and the branding theme. Use this to check what \
a customer is already being billed before setting up or changing a repeating invoice.",
  {
    where: z
      .string()
      .optional()
      .describe(
        'Optional Xero filter, for example Contact.Name=="Konnekt Pty Ltd" or \
Status=="AUTHORISED".',
      ),
  },
  async ({ where }) => {
    const response = await listXeroRepeatingInvoices(where);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing repeating invoices: ${response.error}`,
          },
        ],
      };
    }

    const repeatingInvoices = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${repeatingInvoices?.length || 0} repeating invoices:`,
        },
        ...(repeatingInvoices?.map((repeatingInvoice) => {
          const schedule = repeatingInvoice.schedule;
          const repeat =
            schedule?.period && schedule?.unit
              ? `Every ${schedule.period} ${schedule.unit}`
              : null;

          return {
            type: "text" as const,
            text: [
              `Contact: ${repeatingInvoice.contact?.name || "Unknown"}`,
              `ID: ${repeatingInvoice.repeatingInvoiceID}`,
              repeatingInvoice.reference
                ? `Reference: ${repeatingInvoice.reference}`
                : null,
              repeat,
              schedule?.nextScheduledDate
                ? `Next invoice: ${schedule.nextScheduledDate}`
                : null,
              schedule?.endDate ? `Ends: ${schedule.endDate}` : null,
              `Total: ${repeatingInvoice.total}`,
              `Line amount types: ${repeatingInvoice.lineAmountTypes}`,
              `Status: ${repeatingInvoice.status}`,
              repeatingInvoice.brandingThemeID
                ? `Branding theme ID: ${repeatingInvoice.brandingThemeID}`
                : null,
            ]
              .filter(Boolean)
              .join("\n"),
          };
        }) || []),
      ],
    };
  },
);

export default ListRepeatingInvoicesTool;
