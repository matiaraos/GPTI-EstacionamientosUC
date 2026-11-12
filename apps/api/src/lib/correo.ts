import nodemailer from "nodemailer";

export type Correo = { para: string; asunto: string; texto: string };

/** Canal de correo. En desarrollo apunta a Mailpit; en pruebas se reemplaza por uno en memoria. */
export type Mailer = { enviar: (correo: Correo) => Promise<void> };

/** SMTP (por ejemplo `smtp://127.0.0.1:1025` para Mailpit) o, sin URL, un registro en consola. */
export function crearMailer(smtpUrl: string | null, remitente: string): Mailer {
  if (!smtpUrl) {
    return {
      async enviar({ para, asunto, texto }) {
        console.log(`[correo sin SMTP] Para: ${para}\nAsunto: ${asunto}\n\n${texto}\n`);
      },
    };
  }
  const transporte = nodemailer.createTransport(smtpUrl);
  return {
    async enviar({ para, asunto, texto }) {
      await transporte.sendMail({ from: remitente, to: para, subject: asunto, text: texto });
    },
  };
}
