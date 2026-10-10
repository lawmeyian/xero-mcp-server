import { listXeroBrandingThemes } from "../../handlers/list-xero-branding-themes.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListBrandingThemesTool = CreateXeroTool(
  "list-branding-themes",
  "Lists the branding themes set up in Xero. Use this to find the branding theme ID \
to pass to create-invoice or update-invoice, since a theme decides which details \
(such as bank account details) appear on the invoice the customer receives.",
  {},
  async () => {
    const response = await listXeroBrandingThemes();

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing branding themes: ${response.error}`,
          },
        ],
      };
    }

    const brandingThemes = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${brandingThemes?.length || 0} branding themes:`,
        },
        ...(brandingThemes?.map((theme) => ({
          type: "text" as const,
          text: [
            `Name: ${theme.name || "Unnamed"}`,
            `ID: ${theme.brandingThemeID}`,
            theme.sortOrder !== undefined ? `Sort order: ${theme.sortOrder}` : null,
            theme.createdDateUTC ? `Created: ${theme.createdDateUTC}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListBrandingThemesTool;
