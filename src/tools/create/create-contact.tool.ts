import { createXeroContact } from "../../handlers/create-xero-contact.handler.js";
import { z } from "zod";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { ensureError } from "../../helpers/ensure-error.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const CreateContactTool = CreateXeroTool(
  "create-contact",
  "Create a contact in Xero.\
  When a contact is created, a deep link to the contact in Xero is returned. \
  This deep link can be used to view the contact in Xero directly. \
  This link should be displayed to the user.",
  {
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    phoneType: z
      .enum(["DEFAULT", "MOBILE", "DDI", "FAX"])
      .optional()
      .describe(
        "Which phone the number is stored as. Defaults to DEFAULT, which is the \
one Xero shows on the invoice and on the contact panel. A number stored only as \
MOBILE looks missing to anyone reading the invoice.",
      ),
  },
  async ({ name, email, phone, phoneType }) => {
    try {
      const response = await createXeroContact(name, email, phone, phoneType);
      if (response.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating contact: ${response.error}`,
            },
          ],
        };
      }

      const contact = response.result;

      const deepLink = contact.contactID
        ? await getDeepLink(DeepLinkType.CONTACT, contact.contactID)
        : null;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Contact created: ${contact.name} (ID: ${contact.contactID})`,
              deepLink ? `Link to view: ${deepLink}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    } catch (error) {
      const err = ensureError(error);

      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating contact: ${err.message}`,
          },
        ],
      };
    }
  },
);

export default CreateContactTool;
