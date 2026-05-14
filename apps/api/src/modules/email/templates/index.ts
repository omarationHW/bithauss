import { wrapEmail } from './_base';

const APP_URL = process.env.FRONTEND_URL?.split(',')[0]?.trim() ?? 'https://bithauss-web.azurewebsites.net';

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

/* -------------------- Signup welcome -------------------- */
export function welcomeEmail(opts: { firstName: string }): EmailMessage {
  const title = `Bienvenido a BitHauss, ${opts.firstName}`;
  const body = `
    <p>Gracias por crear tu cuenta en BitHauss — la primera plataforma de bienes raíces certificados en México.</p>
    <p>Desde tu panel puedes publicar propiedades, recibir leads de compradores verificados, solicitar certificación BRC y dar seguimiento a expedientes notariales.</p>
    <p>Si tienes preguntas, responde este correo y te leemos.</p>
  `;
  return {
    subject: `Bienvenido a BitHauss, ${opts.firstName}`,
    html: wrapEmail({
      title,
      preheader: 'Tu cuenta está lista. Empieza a usar la plataforma.',
      body,
      ctaLabel: 'Ir al panel',
      ctaUrl: `${APP_URL}/dashboard`,
    }),
    text: `Hola ${opts.firstName},\n\nTu cuenta de BitHauss está lista.\n\nIr al panel: ${APP_URL}/dashboard\n\n— Equipo BitHauss`,
  };
}

/* -------------------- BRC document rejected -------------------- */
export function brcDocumentRejectedEmail(opts: {
  firstName: string;
  documentName: string;
  reason: string;
  ownerInstruction?: string;
  expedienteId: string;
}): EmailMessage {
  const title = `Documento rechazado: ${opts.documentName}`;
  const body = `
    <p>Hola ${opts.firstName},</p>
    <p>El notario revisó tu expediente BRC y rechazó el documento <strong>${escapeHtml(opts.documentName)}</strong>.</p>
    <p><strong>Motivo:</strong> ${escapeHtml(opts.reason)}</p>
    ${
      opts.ownerInstruction
        ? `<p style="margin-top:12px;padding:12px;background:#fff7ed;border-left:3px solid #f59e0b;border-radius:6px;"><strong>Instrucción:</strong> ${escapeHtml(opts.ownerInstruction)}</p>`
        : ''
    }
    <p>Sube la corrección desde tu expediente para continuar el proceso de certificación.</p>
  `;
  return {
    subject: `[BitHauss BRC] Documento rechazado — ${opts.documentName}`,
    html: wrapEmail({
      title,
      preheader: `Rechazo: ${opts.reason}`,
      body,
      ctaLabel: 'Ver expediente',
      ctaUrl: `${APP_URL}/dashboard/expedientes/${opts.expedienteId}`,
    }),
    text: `Hola ${opts.firstName},\n\nEl notario rechazó el documento "${opts.documentName}".\n\nMotivo: ${opts.reason}\n${opts.ownerInstruction ? `Instrucción: ${opts.ownerInstruction}\n` : ''}\nVer expediente: ${APP_URL}/dashboard/expedientes/${opts.expedienteId}`,
  };
}

/* -------------------- BRC certified -------------------- */
export function brcCertificateEmail(opts: {
  firstName: string;
  certificateNumber: string;
  certificateId: string;
  propertyTitle: string;
}): EmailMessage {
  const title = `¡Tu propiedad fue certificada!`;
  const body = `
    <p>Hola ${opts.firstName},</p>
    <p>Excelentes noticias: el notario emitió el <strong>certificado BRC</strong> para tu propiedad <em>${escapeHtml(opts.propertyTitle)}</em>.</p>
    <p style="margin:20px 0;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;font-size:13px;">
      <strong>Número de certificado:</strong> ${escapeHtml(opts.certificateNumber)}
    </p>
    <p>Ya puedes compartirlo con compradores interesados — un certificado BRC acelera la decisión de compra y reduce la incertidumbre legal.</p>
  `;
  return {
    subject: `[BitHauss BRC] Certificado emitido — ${opts.certificateNumber}`,
    html: wrapEmail({
      title,
      preheader: 'Tu certificado BRC ya está disponible.',
      body,
      ctaLabel: 'Ver certificado',
      ctaUrl: `${APP_URL}/certificado/${opts.certificateId}`,
    }),
    text: `Hola ${opts.firstName},\n\nTu propiedad "${opts.propertyTitle}" recibió el certificado BRC ${opts.certificateNumber}.\n\nVer certificado: ${APP_URL}/certificado/${opts.certificateId}`,
  };
}

/* -------------------- BRC expediente rejected -------------------- */
export function brcExpedienteRejectedEmail(opts: {
  firstName: string;
  reason?: string;
  expedienteId: string;
}): EmailMessage {
  const title = 'Solicitud BRC rechazada';
  const body = `
    <p>Hola ${opts.firstName},</p>
    <p>Tu solicitud de certificación BRC fue rechazada por el notario.</p>
    ${
      opts.reason
        ? `<p style="margin-top:12px;padding:12px;background:#fef2f2;border-left:3px solid #ef4444;border-radius:6px;"><strong>Motivo:</strong> ${escapeHtml(opts.reason)}</p>`
        : ''
    }
    <p>Puedes iniciar una nueva solicitud cuando hayas resuelto las observaciones.</p>
  `;
  return {
    subject: '[BitHauss BRC] Solicitud rechazada',
    html: wrapEmail({
      title,
      preheader: 'Tu solicitud BRC fue rechazada.',
      body,
      ctaLabel: 'Ver detalle',
      ctaUrl: `${APP_URL}/dashboard/expedientes/${opts.expedienteId}`,
    }),
    text: `Hola ${opts.firstName},\n\nTu solicitud BRC fue rechazada.${opts.reason ? `\n\nMotivo: ${opts.reason}` : ''}\n\nVer expediente: ${APP_URL}/dashboard/expedientes/${opts.expedienteId}`,
  };
}

/* -------------------- Lead recibido -------------------- */
export function leadReceivedEmail(opts: {
  firstName: string;
  leadName: string;
  propertyTitle: string;
  propertyId: string;
}): EmailMessage {
  const title = `Nuevo lead para ${opts.propertyTitle}`;
  const body = `
    <p>Hola ${opts.firstName},</p>
    <p><strong>${escapeHtml(opts.leadName)}</strong> está interesado en tu propiedad <em>${escapeHtml(opts.propertyTitle)}</em>.</p>
    <p>Responde rápido — las primeras 24 horas son las más críticas para cerrar.</p>
  `;
  return {
    subject: `[BitHauss] Nuevo lead: ${opts.leadName}`,
    html: wrapEmail({
      title,
      preheader: `${opts.leadName} pregunta por tu propiedad.`,
      body,
      ctaLabel: 'Ver lead',
      ctaUrl: `${APP_URL}/dashboard/leads`,
    }),
    text: `Hola ${opts.firstName},\n\n${opts.leadName} está interesado en "${opts.propertyTitle}".\n\nVer leads: ${APP_URL}/dashboard/leads`,
  };
}

/* -------------------- Util -------------------- */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
