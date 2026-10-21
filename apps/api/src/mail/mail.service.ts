import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

// Logs must not carry personal data: keep only enough to recognise the domain.
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain ?? ''}`;
}

export type Mail = { to: string; subject: string; text: string };

// Without SMTP_URL, mails are logged instead of sent: the demo works without a
// mail provider (docs/billing.md, Payment reminders).
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const smtpUrl = config.get<string | null>('smtpUrl');
    this.transport = smtpUrl ? createTransport(smtpUrl) : null;
    this.from = config.getOrThrow<string>('mailFrom');
  }

  async send(mail: Mail): Promise<'sent' | 'logged'> {
    if (!this.transport) {
      this.logger.log(
        `[mail not sent, no SMTP_URL] to=${maskEmail(mail.to)} subject="${mail.subject}"`,
      );
      return 'logged';
    }
    await this.transport.sendMail({ from: this.from, ...mail });
    return 'sent';
  }
}
