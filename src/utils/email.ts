import nodemailer from "nodemailer";

function getTransporter(): nodemailer.Transporter {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
    throw new Error(
      "Email is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASS in the environment variables"
    );
  }

  const port = Number(EMAIL_PORT) || 587;

  // NOTE: rejectUnauthorized: false is needed in development environments
  // where a firewall, proxy, or antivirus injects its own TLS certificate
  // into the chain, causing "self-signed certificate in certificate chain".
  // In production on a clean server (Render, Railway, etc.) this doesn't
  // usually occur, but leaving it false does no harm.
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port,
    secure: port === 465, // true only for port 465 (SMTPS), not 587 (STARTTLS)
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    tls: {
      rejectUnauthorized: false, // allow self-signed certs in corporate/dev networks
    },
  });
}


function buildOtpHtml(code: string, ownerName: string): string {
      return `
      <!DOCTYPE html>
<html lang="en">
<head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify your Simxel account</title>
      </head>
            <body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">

                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 12px;">
                        <tr>
                              <td align="center">

                                    <table width="500" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:10px;border:1px solid #334155;">

                                    <!-- Header -->
                                    <tr>
                                          <td style="padding:24px 30px;border-bottom:1px solid #334155;">
                                          <strong style="font-size:20px;color:#e2e8f0;">SIM<span style="color: #3b82f6;">X</span>EL</strong>
                                          </td>
                                          </tr>

                                          <!-- Body -->
                                          <tr>
                                                <td style="padding:30px;color:#cbd5f5;">

                                                <p style="margin:0 0 16px;font-size:16px;color:#e2e8f0;">
                                                Hello ${ownerName || "there"},
                                                </p>

                                                <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#94a3b8;">
                                                We received a request to verify your email address for your Simxel account.
                                                Please enter the verification code below in the app to continue.
                                                </p>

                                                <!-- OTP box -->
                                                <div style="text-align:center;margin:26px 0;padding:16px;border:1px solid #334155;border-radius:8px;background:#0f172a;">
                                                <span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#3b82f6;font-family:monospace;">
                                                ${code}
                                                </span>
                                                </div>

                                                <p style="margin:0 0 10px;font-size:13px;color:#94a3b8;">
                                                This code will expire in about 15 minutes.
                                                </p>

                                                <p style="margin:0;font-size:13px;color:#64748b;">
                                                If you didn’t request this email, you can safely ignore it.
                                                </p>

                                          </td>
                                    </tr>

                                    <!-- Footer -->
                                    <tr>
                                          <td 
                                                style="padding:18px 30px;border-top:1px solid #334155;font-size:12px;color:#64748b;">
                                          © 2025 Simxel
                                          </td>
                                    </tr>

                                    </table>

                              </td>
                        </tr>
                  </table>

            </body>
      </html>
      `.trim()
}

// Send the 6 digit OTP to the given]
export async function sendOtpEmail(to:string,
      code: string,
      ownerName: string
): Promise<void> {
      const from = process.env.EMAIL_FROM || `"Simxel" <${process.env.EMAIL_USER}>`;

      await getTransporter().sendMail({
            from,
            to,
            subject: `${code} - Your Simxel verification code`,
            text: `Your Simxel verification code is:  ${code}\n\nIt expires in 15minutes. Do not share it.`,
            html: buildOtpHtml(code, ownerName)
      })


}