import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST ?? 'mailpit',
    port: Number(process.env.MAIL_PORT ?? 1025),
    auth: process.env.MAIL_USER
      ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD }
      : undefined,
  });
  async send(to: string, subject: string, url: string): Promise<void> {
    await this.transporter
      .sendMail({
        from: process.env.EMAIL_FROM ?? 'Smart Library <no-reply@smart-library.test>',
        to,
        subject,
        text: `${subject}: ${url}`,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Email delivery failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        throw error;
      });
  }
}
