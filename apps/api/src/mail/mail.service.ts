import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

// Logs must not carry personal data: keep only enough to recognise the domain.
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain ?? ''}`;
}

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
};

const SIGNATURE = [
  '',
  '',
  '--',
  'Shobukan Hombu Dojo',
  '255, avenue Daumesnil, 75012 Paris',
  '01 43 07 05 65 · info@shobukan-dojo.com',
  'https://www.shobukan-dojo.com',
].join('\n');

export type Mail = { to: string; subject: string; text: string };

// Without SMTP_HOST, mails are logged instead of sent: the demo works without a
// mail provider (docs/billing.md, Payment reminders).
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;
  private readonly replyTo: string;

  constructor(config: ConfigService) {
    const smtp = config.get<SmtpConfig | null>('smtp');
    this.transport = smtp
      ? createTransport({
          host: smtp.host,
          port: smtp.port,
          // 465 is implicit TLS; 587 is submission, where STARTTLS is required
          // so credentials never travel in clear.
          secure: smtp.port === 465,
          requireTLS: smtp.port !== 465,
          auth: { user: smtp.user, pass: smtp.password },
        })
      : null;
    this.from = config.getOrThrow<string>('mailFrom');
    this.replyTo = config.getOrThrow<string>('mailReplyTo');
  }

  async send(mail: Mail): Promise<'sent' | 'logged'> {
    if (!this.transport) {
      this.logger.log(
        `[mail not sent, no SMTP_HOST] to=${maskEmail(mail.to)} subject="${mail.subject}"`,
      );
      return 'logged';
    }
    await this.transport.sendMail({
      from: this.from,
      replyTo: this.replyTo,
      ...mail,
      text: `${mail.text}${SIGNATURE}`,
    });
    return 'sent';
  }
}
