// The HTML for the emails send-email sends: the same look as the sign-in email
// (supabase/templates/magic_link.html), which Supabase Auth sends from its own copy. Change
// both together.
//
// Email clients ignore most modern CSS, so this is a table layout with inline styles and hex
// colours (the app's oklch variables don't work here).

export interface EmailContent {
  /** Shown next to the subject in the inbox. */
  preview: string;
  heading: string;
  paragraphs: string[];
  button: { label: string; url: string };
  /** Small print under a line at the bottom. */
  footer: string;
}

const DISPLAY_FONT = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
const TEXT_FONT = "'Segoe UI', Helvetica, Arial, sans-serif";

export function html(content: EmailContent, siteUrl: string): string {
  const paragraphs = content.paragraphs
    .map(
      (paragraph) => `
            <tr>
              <td style="padding: 12px 32px 0 32px; font-family: ${TEXT_FONT}; font-size: 16px; line-height: 1.5; color: #21123f;">
                ${escape(paragraph)}
              </td>
            </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escape(content.heading)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f3f1eb;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: #f3f1eb;">
      ${escape(content.preview)}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background-color: #f3f1eb;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"
            style="width: 100%; max-width: 480px; background-color: #ffffff; border-radius: 24px;">
            <tr>
              <td style="padding: 36px 32px 8px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right: 12px;">
                      <img src="${escape(siteUrl)}/email/logo-v1.png" width="60" height="60" alt=""
                        style="display: block; width: 60px; height: 60px; border: 0;" />
                    </td>
                    <td style="font-family: ${DISPLAY_FONT}; font-size: 15px; font-weight: 800; letter-spacing: 2.2px; text-transform: uppercase; color: #3b176f;">
                      Kitchen Table
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 20px 32px 0 32px; font-family: ${DISPLAY_FONT}; font-size: 26px; line-height: 1.2; font-weight: 700; color: #3b176f;">
                ${escape(content.heading)}
              </td>
            </tr>${paragraphs}

            <tr>
              <td style="padding: 28px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#3b176f" style="border-radius: 99px; background-color: #3b176f;">
                      <a href="${escape(content.button.url)}"
                        style="display: inline-block; padding: 16px 40px; font-family: ${TEXT_FONT}; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 99px;">${escape(content.button.label)}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 28px 32px 0 32px; font-family: ${TEXT_FONT}; font-size: 13px; line-height: 1.5; color: #5f5175;">
                Button not working? Copy this link into your browser:<br />
                <span style="word-break: break-all; color: #6c3ab2;">${escape(content.button.url)}</span>
              </td>
            </tr>

            <tr>
              <td style="padding: 28px 32px 36px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-top: 1px solid #e6e3db; padding-top: 20px; font-family: ${TEXT_FONT}; font-size: 13px; line-height: 1.5; color: #5f5175;">
                      ${escape(content.footer)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/** The plain-text part, for clients that don't show HTML. */
export function text(content: EmailContent): string {
  return [
    content.heading,
    ...content.paragraphs,
    `${content.button.label}: ${content.button.url}`,
    content.footer,
  ].join('\n\n') + '\n';
}

function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
