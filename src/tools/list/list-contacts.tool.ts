import { listXeroContacts } from "../../handlers/list-xero-contacts.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { z } from "zod";

const ListContactsTool = CreateXeroTool(
  "list-contacts",
  "List all contacts in Xero. This includes Suppliers and Customers.",
  {
    page: z.number().optional().describe("Optional page number to retrieve for pagination. \
      If not provided, the first page will be returned. If 100 contacts are returned, \
      call this tool again with the next page number."),
    searchTerm: z.string().optional().describe("Search parameter that performs a case-insensitive text search across the Name, FirstName, LastName, ContactNumber and EmailAddress fields"),
    includeDetails: z
      .boolean()
      .optional()
      .describe(
        "Set true to return the full contact records. Xero's default summary \
view leaves out phones and addresses, so a contact can look as though it has no \
phone number when it does. Slower, so use it when those fields matter.",
      ),
  },
  async (params) => {
    const { page, searchTerm, includeDetails } = params;
    const response = await listXeroContacts(page, searchTerm, includeDetails);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing contacts: ${response.error}`,
          },
        ],
      };
    }

    const contacts = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${contacts?.length || 0} contacts${page ? ` (page ${page})` : ''}:`,
        },
        ...(contacts?.map((contact) => ({
          type: "text" as const,
          text: [
            `Contact: ${contact.name}`,
            `ID: ${contact.contactID}`,
            contact.firstName ? `First Name: ${contact.firstName}` : null,
            contact.lastName ? `Last Name: ${contact.lastName}` : null,
            contact.emailAddress
              ? `Email: ${contact.emailAddress}`
              : "No email",
            ...(contact.phones ?? [])
              .filter((phone) => phone.phoneNumber)
              .map(
                (phone) =>
                  `Phone (${phone.phoneType}): ${[
                    phone.phoneAreaCode,
                    phone.phoneNumber,
                  ]
                    .filter(Boolean)
                    .join(" ")}`,
              ),
            contact.accountsReceivableTaxType
              ? `AR Tax Type: ${contact.accountsReceivableTaxType}`
              : null,
            contact.accountsPayableTaxType
              ? `AP Tax Type: ${contact.accountsPayableTaxType}`
              : null,
            `Type: ${
              [
                contact.isCustomer ? "Customer" : null,
                contact.isSupplier ? "Supplier" : null,
              ]
                .filter(Boolean)
                .join(", ") || "Unknown"
            }`,
            contact.defaultCurrency
              ? `Default Currency: ${contact.defaultCurrency}`
              : null,
            contact.updatedDateUTC
              ? `Last Updated: ${contact.updatedDateUTC}`
              : null,
            `Status: ${contact.contactStatus || "Unknown"}`,
            contact.contactGroups?.length
              ? `Groups: ${contact.contactGroups.map((g) => g.name).join(", ")}`
              : null,
            contact.hasAttachments ? "Has Attachments: Yes" : null,
            contact.hasValidationErrors ? "Has Validation Errors: Yes" : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListContactsTool;
