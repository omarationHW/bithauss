/**
 * Shared HTML wrapper for all BitHauss transactional emails.
 * Inline styles for maximum compatibility with email clients.
 */
export function wrapEmail({
  title,
  preheader,
  body,
  ctaLabel,
  ctaUrl,
  footer = 'Recibiste este correo porque tienes una cuenta en BitHauss.',
}: {
  title: string;
  preheader?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;">
${
  preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>`
    : ''
}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f8fa;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:32px 32px 16px 32px;background:linear-gradient(135deg,hsl(221 83% 53%),hsl(160 84% 39%));text-align:left;">
            <div style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:-0.01em;">BitHauss</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${title}</h1>
            <div style="font-size:15px;line-height:1.6;color:#374151;">${body}</div>
            ${
              ctaLabel && ctaUrl
                ? `<div style="margin:24px 0 8px;">
                     <a href="${ctaUrl}"
                        style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,hsl(221 83% 53%),hsl(160 84% 39%));color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">
                       ${ctaLabel}
                     </a>
                   </div>`
                : ''
            }
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5;">
            ${footer}
            <br /><br />
            <a href="https://bithauss.com" style="color:#3b82f6;text-decoration:none;">bithauss.com</a>
            &nbsp;·&nbsp;
            <span style="color:#9ca3af;">© ${new Date().getFullYear()} BitHauss</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
