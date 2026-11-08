import { createTransport } from "nodemailer";

export type Mail = { to: string; subject: string; text: string };
export type Mailer = { send(mail: Mail): Promise<void> };

/** Sends email through SMTP. Without SMTP, Curved sends no email. */
export function createSmtpMailer(smtpUrl: string, from: string): Mailer {
  const transport = createTransport(smtpUrl);
  return {
    async send(mail) {
      await transport.sendMail({ from, ...mail });
    },
  };
}
