import type { Mailer, OutgoingMail } from "../domain/ports";

/** Cloudflare Email Service, the EMAIL binding. Under `wrangler dev` it is
    simulated: the message lands under .wrangler/tmp/email/ instead. */
export class CloudflareMailer implements Mailer {
  constructor(private binding: SendEmail) {}

  async send(mail: OutgoingMail) {
    await this.binding.send({
      to: mail.to,
      from: mail.fromName ? { email: mail.from, name: mail.fromName } : mail.from,
      subject: mail.subject,
      text: mail.text,
    });
  }
}
