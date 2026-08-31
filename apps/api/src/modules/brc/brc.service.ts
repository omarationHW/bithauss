import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  Length,
  IsObject,
  IsIn,
  IsISO8601,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { SupabaseConfigService } from '../../config/supabase.config';
import {
  areRequiredDocumentsValidated,
  missingRequiredDocuments,
  type DocumentRequirementRow,
  type PropertyForBrc,
} from './required-documents';
import {
  CERTIFICATE_NUMBER_PATTERN,
  MAX_NUMBER_ATTEMPTS,
  UNIQUE_VIOLATION,
  certificateNumberPrefix,
  nextCertificateNumber,
} from './certificate-number';

/* ------------------------------------------------------------------ */
/*  DTOs                                                               */
/* ------------------------------------------------------------------ */

export class RejectDocumentDto {
  @IsString() @Length(3, 1000) reason!: string;
  @IsOptional() @IsString() @Length(0, 1000) owner_instruction?: string;
}

export class RejectExpedienteDto {
  @IsOptional() @IsString() @Length(0, 5000) reason?: string;
}

export class OcrCorrectionDto {
  @IsObject() corrected_data!: Record<string, unknown>;
}

/**
 * Step A — the notary's own certificate. It carries no folio: it is not the
 * BRC and must never look like one.
 */
export class IssueNotarialCertificateDto {
  @IsString() @Length(3, 2048) file_url!: string;
  @IsString() @Length(1, 255) file_name!: string;
  @IsOptional() @IsInt() @Min(1) @Max(50 * 1024 * 1024) file_size?: number;
  @IsOptional() @IsString() @Length(0, 128) mime_type?: string;
  @IsOptional() @IsString() @Length(0, 5000) observations?: string;
}

/**
 * Step B — BitHauss issues the BRC. The folio is NOT accepted from the
 * client: it is derived server-side (see certificate-number.ts).
 */
export class IssueBrcDto {
  @IsOptional() @IsString() @Length(0, 2048) pdf_url?: string;
  @IsOptional() @IsString() @Length(0, 2048) qr_code_url?: string;
  @IsOptional() @IsString() @Length(0, 5000) observations?: string;
}

/** The "certificados recabados por notaría" block of the expediente table. */
export class CertificateTrackingDto {
  @IsOptional() @IsISO8601() cert_requested_at?: string | null;
  @IsOptional() @IsISO8601() cert_received_at?: string | null;
  @IsOptional()
  @IsIn(['FAVORABLE', 'DESFAVORABLE', 'SIN_RESULTADO'])
  cert_result?: string | null;
  @IsOptional() @IsString() @Length(0, 2000) cert_requirement?: string | null;
  @IsOptional() @IsString() @Length(0, 5000) notary_legal_opinion?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Roles that act on behalf of BitHauss. A NOTARIO is never one of them. */
/**
 * Payment states that unlock the BRC issuance. EXENTO covers dossiers waived
 * by BitHauss (and every dossier that predates online payment — see migration
 * 034), so the gate never retroactively blocks work already in flight.
 */
const PAID_PAYMENT_STATUSES = ['PAGADO', 'EXENTO'];

const BRC_ISSUER_ROLES = ['ADMIN', 'OPERADOR_BRC'];

/** Matches `exp: "90d"` in the certificate's signable payload. */
const CERTIFICATE_VALIDITY_DAYS = 90;

const PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://bithauss.com';

/** Whether a catalogue row is required for this property. */
function isRequiredRow(
  row: DocumentRequirementRow,
  property: PropertyForBrc,
): boolean {
  return missingRequiredDocuments([{ ...row, status: null }], property).length > 0;
}

/* ------------------------------------------------------------------ */

@Injectable()
export class BrcService {
  private readonly logger = new Logger(BrcService.name);

  constructor(private readonly supabaseConfig: SupabaseConfigService) {}

  /** Returns the expediente row or throws if the caller has no access. */
  private async assertNotaryOnExpediente(expedienteId: string, userId: string) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data, error } = await supabase
      .from('brc_expedientes')
      .select('id, requested_by, assigned_notary_id, assigned_operator_id, status, property_id')
      .eq('id', expedienteId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Expediente no encontrado');
    if (
      data.assigned_notary_id !== userId &&
      data.assigned_operator_id !== userId
    ) {
      // Also allow ADMIN — caller's role is enforced at the guard level too.
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (!profile || profile.role !== 'ADMIN') {
        throw new ForbiddenException('No estás asignado a este expediente');
      }
    }
    return data;
  }

  /**
   * Stricter than the above: issuing the Certificado Notarial is an act of
   * the assigned NOTARY. An operator sitting on the expediente cannot sign in
   * their place; an admin can, to unblock a stuck file.
   */
  private async assertAssignedNotary(expedienteId: string, userId: string) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data, error } = await supabase
      .from('brc_expedientes')
      .select('id, requested_by, assigned_notary_id, assigned_operator_id, status, property_id')
      .eq('id', expedienteId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Expediente no encontrado');

    if (data.assigned_notary_id !== userId) {
      const role = await this.getRole(userId);
      if (role !== 'ADMIN') {
        throw new ForbiddenException(
          'Sólo el notario asignado puede emitir el Certificado Notarial',
        );
      }
    }
    return data;
  }

  private async getRole(userId: string): Promise<string | null> {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    return (data?.role as string | undefined) ?? null;
  }

  /**
   * Name to freeze on the document as its "dictaminador". The UI used to show
   * whoever was logged in, which silently rewrote history for every other
   * viewer of the expediente.
   */
  private async getDisplayName(userId: string): Promise<string | null> {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return null;
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
    return name.length > 0 ? name : null;
  }

  private async insertNotification(
    recipientId: string,
    title: string,
    body: string,
    link: string,
    metadata: Record<string, unknown> = {},
  ) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { error } = await supabase.from('notifications').insert({
      recipient_id: recipientId,
      type: 'BRC_ESTADO_CAMBIO',
      title,
      body,
      link,
      metadata,
    });
    if (error) {
      this.logger.warn(`Failed to insert notification for ${recipientId}: ${error.message}`);
    }
  }

  /** Tells BitHauss there is something waiting to be issued. */
  private async notifyBrcIssuers(
    title: string,
    body: string,
    link: string,
    metadata: Record<string, unknown> = {},
  ) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data: issuers } = await supabase
      .from('profiles')
      .select('id')
      .in('role', BRC_ISSUER_ROLES);
    // Notifications are best-effort: an unexpected shape must not abort an
    // otherwise successful issuance.
    const recipients = Array.isArray(issuers) ? (issuers as { id: string }[]) : [];
    for (const issuer of recipients) {
      await this.insertNotification(issuer.id, title, body, link, metadata);
    }
  }

  /* ----- Approve a single BRC document ----- */
  async approveDocument(documentId: string, userId: string) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data: doc } = await supabase
      .from('brc_documents')
      .select('id, expediente_id, document_type_id, brc_document_types(name)')
      .eq('id', documentId)
      .maybeSingle();
    if (!doc) throw new NotFoundException('Documento no encontrado');

    const expediente = await this.assertNotaryOnExpediente(doc.expediente_id, userId);
    const reviewerName = await this.getDisplayName(userId);

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('brc_documents')
      .update({
        status: 'VALIDADO',
        rejection_reason: null,
        owner_instruction: null,
        reviewed_by: userId,
        reviewer_name: reviewerName,
        reviewed_at: now,
      })
      .eq('id', documentId);
    if (error) throw new BadRequestException(error.message);

    await supabase.from('brc_expediente_logs').insert({
      expediente_id: doc.expediente_id,
      action: 'DOCUMENTO_VALIDADO',
      performed_by: userId,
      metadata: { document_id: documentId },
    });

    return { id: documentId, status: 'VALIDADO', reviewed_at: now, reviewer_name: reviewerName, expediente_id: doc.expediente_id, requester_id: expediente.requested_by };
  }

  /* ----- Reject a single BRC document ----- */
  async rejectDocument(documentId: string, userId: string, dto: RejectDocumentDto) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data: doc } = await supabase
      .from('brc_documents')
      .select('id, expediente_id, document_type_id, brc_document_types(name)')
      .eq('id', documentId)
      .maybeSingle();
    if (!doc) throw new NotFoundException('Documento no encontrado');

    const expediente = await this.assertNotaryOnExpediente(doc.expediente_id, userId);
    const reviewerName = await this.getDisplayName(userId);

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('brc_documents')
      .update({
        status: 'RECHAZADO',
        rejection_reason: dto.reason,
        owner_instruction: dto.owner_instruction ?? null,
        reviewed_by: userId,
        reviewer_name: reviewerName,
        reviewed_at: now,
      })
      .eq('id', documentId);
    if (error) throw new BadRequestException(error.message);

    await supabase.from('brc_expediente_logs').insert({
      expediente_id: doc.expediente_id,
      action: 'DOCUMENTO_RECHAZADO',
      performed_by: userId,
      metadata: { document_id: documentId, reason: dto.reason },
    });

    // Move the expediente to "documentación pendiente": the ball is now in the
    // owner's court. Without this it kept reading "En revisión" while actually
    // waiting on them, and nothing in the UI said so.
    if (expediente.status !== 'DOCUMENTACION_PENDIENTE') {
      await supabase
        .from('brc_expedientes')
        .update({ status: 'DOCUMENTACION_PENDIENTE' })
        .eq('id', doc.expediente_id);
      await supabase
        .from('properties')
        .update({ brc_status: 'DOCUMENTACION_PENDIENTE' })
        .eq('id', expediente.property_id);
    }

    const docName = (doc.brc_document_types as { name?: string } | null)?.name ?? 'Documento';
    await this.insertNotification(
      expediente.requested_by,
      `Documento rechazado: ${docName}`,
      dto.owner_instruction ?? dto.reason,
      `/dashboard/expedientes/${doc.expediente_id}`,
      { document_id: documentId, expediente_id: doc.expediente_id },
    );

    return { id: documentId, status: 'RECHAZADO', reviewed_at: now, reviewer_name: reviewerName };
  }

  /* ----- Correct OCR-extracted data for a single document ----- */
  async updateOcrCorrection(documentId: string, userId: string, dto: OcrCorrectionDto) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data: doc } = await supabase
      .from('brc_documents')
      .select('id, expediente_id')
      .eq('id', documentId)
      .maybeSingle();
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.assertNotaryOnExpediente(doc.expediente_id, userId);

    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('brc_documents')
      .update({
        ocr_corrected_data: dto.corrected_data,
        ocr_reviewed_by: userId,
        ocr_reviewed_at: now,
      })
      .eq('id', documentId)
      .select('*')
      .single();
    if (error || !updated) throw new BadRequestException(error?.message ?? 'Error al guardar la corrección OCR');

    await supabase.from('brc_expediente_logs').insert({
      expediente_id: doc.expediente_id,
      action: 'OCR_CORREGIDO',
      performed_by: userId,
      metadata: { document_id: documentId },
    });

    return updated;
  }

  /* ----- Certificates the notary collects from third parties ----- */
  /**
   * The green block of the expediente table (RPP / Predial / Agua / otros).
   * Only the fields present in the payload are written, so recording a
   * reception date does not wipe a legal opinion typed earlier.
   */
  async updateCertificateTracking(
    documentId: string,
    userId: string,
    dto: CertificateTrackingDto,
  ) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data: doc } = await supabase
      .from('brc_documents')
      .select('id, expediente_id, cert_requested_at')
      .eq('id', documentId)
      .maybeSingle();
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.assertNotaryOnExpediente(doc.expediente_id, userId);

    const patch: Record<string, unknown> = {};
    if ('cert_requested_at' in dto) patch.cert_requested_at = dto.cert_requested_at ?? null;
    if ('cert_received_at' in dto) patch.cert_received_at = dto.cert_received_at ?? null;
    if ('cert_result' in dto) patch.cert_result = dto.cert_result ?? null;
    if ('cert_requirement' in dto) patch.cert_requirement = dto.cert_requirement ?? null;
    if ('notary_legal_opinion' in dto) {
      patch.notary_legal_opinion = dto.notary_legal_opinion ?? null;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No hay cambios que guardar');
    }

    // Whoever first records the request is the one who made it.
    if (patch.cert_requested_at && !doc.cert_requested_at) {
      patch.cert_requested_by = userId;
    }

    const { data: updated, error } = await supabase
      .from('brc_documents')
      .update(patch)
      .eq('id', documentId)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    await supabase.from('brc_expediente_logs').insert({
      expediente_id: doc.expediente_id,
      action: 'CERTIFICADO_RECABADO_ACTUALIZADO',
      performed_by: userId,
      metadata: { document_id: documentId, ...patch },
    });

    return updated ?? { id: documentId, ...patch };
  }

  /* ------------------------------------------------------------------ */
  /*  Step A — the NOTARY issues the Certificado Notarial               */
  /* ------------------------------------------------------------------ */

  /**
   * Builds one requirement row per catalogue entry, carrying the status of the
   * most recent upload, plus the property the rules depend on.
   */
  private async loadRequirementRows(
    expedienteId: string,
    propertyId: string,
  ): Promise<{
    rows: (DocumentRequirementRow & { reviewed_by: string | null })[];
    property: PropertyForBrc;
  }> {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data: types } = await supabase
      .from('brc_document_types')
      .select('id, name, is_required');

    const { data: docs } = await supabase
      .from('brc_documents')
      .select('id, document_type_id, status, reviewed_by, created_at')
      .eq('expediente_id', expedienteId);

    const { data: property } = await supabase
      .from('properties')
      .select('type, operation')
      .eq('id', propertyId)
      .maybeSingle();

    const latestByType = new Map<
      string,
      { status: string; reviewed_by: string | null; created_at: string }
    >();
    for (const doc of (docs ?? []) as {
      document_type_id: string;
      status: string;
      reviewed_by: string | null;
      created_at: string;
    }[]) {
      const current = latestByType.get(doc.document_type_id);
      if (!current || (doc.created_at ?? '') > (current.created_at ?? '')) {
        latestByType.set(doc.document_type_id, doc);
      }
    }

    const rows = ((types ?? []) as {
      id: string;
      name: string;
      is_required: boolean;
    }[]).map((type) => ({
      name: type.name,
      is_required: !!type.is_required,
      status: latestByType.get(type.id)?.status ?? null,
      reviewed_by: latestByType.get(type.id)?.reviewed_by ?? null,
    }));

    return {
      rows,
      property: {
        type: (property?.type as string | null) ?? null,
        operation: (property?.operation as string | null) ?? null,
      },
    };
  }

  /**
   * Rejects the issuance when a required document carries no reviewer, or a
   * reviewer who is neither the assigned notary nor BitHauss staff.
   */
  private async assertReviewedByStaff(
    rows: (DocumentRequirementRow & { reviewed_by: string | null })[],
    property: PropertyForBrc,
    assignedNotaryId: string | null,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getAdminClient();

    const required = rows.filter((row) => isRequiredRow(row, property));

    const unreviewed = required.filter((row) => !row.reviewed_by);
    if (unreviewed.length > 0) {
      throw new BadRequestException(
        `Estos documentos figuran como validados pero nadie los dictaminó: ${unreviewed
          .map((r) => r.name)
          .join(', ')}`,
      );
    }

    const foreignReviewers = [
      ...new Set(
        required
          .map((row) => row.reviewed_by as string)
          .filter((id) => id !== assignedNotaryId),
      ),
    ];
    if (foreignReviewers.length === 0) return;

    const { data: reviewers } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', foreignReviewers);

    const staffIds = new Set(
      (Array.isArray(reviewers) ? (reviewers as { id: string; role: string }[]) : [])
        .filter((p) => BRC_ISSUER_ROLES.includes(p.role))
        .map((p) => p.id),
    );

    const impostors = required.filter(
      (row) =>
        row.reviewed_by !== assignedNotaryId && !staffIds.has(row.reviewed_by as string),
    );
    if (impostors.length > 0) {
      throw new BadRequestException(
        `Estos documentos fueron marcados como validados por alguien ajeno a la notaría: ${impostors
          .map((r) => r.name)
          .join(', ')}`,
      );
    }
  }

  /**
   * The notary states the expediente is sound and uploads the Certificado
   * Notarial. This is NOT the BRC: BitHauss issues that from this document
   * (see `issueBrc`), which is why the expediente lands on
   * PENDIENTE_EMISION_BRC rather than CERTIFICADO.
   */
  async issueNotarialCertificate(
    expedienteId: string,
    userId: string,
    dto: IssueNotarialCertificateDto,
  ) {
    const supabase = this.supabaseConfig.getAdminClient();
    const expediente = await this.assertAssignedNotary(expedienteId, userId);

    if (expediente.status === 'CERTIFICADO' || expediente.status === 'RECHAZADO') {
      throw new BadRequestException('El expediente ya está cerrado');
    }

    const { rows, property } = await this.loadRequirementRows(
      expedienteId,
      expediente.property_id,
    );
    if (!areRequiredDocumentsValidated(rows, property)) {
      const missing = missingRequiredDocuments(rows, property);
      throw new BadRequestException(
        missing.length > 0
          ? `Faltan documentos obligatorios por validar: ${missing.join(', ')}`
          : 'El expediente no tiene documentos obligatorios configurados',
      );
    }

    // SECURITY (auditoría BH-05): `status = 'VALIDADO'` is not proof that
    // anybody reviewed anything — before migration 024 the applicant could
    // write that status straight from the browser. Require that each required
    // document was actually ruled on by the notary assigned to the expediente
    // (or by BitHauss staff, who can also approve).
    await this.assertReviewedByStaff(rows, property, expediente.assigned_notary_id);

    const now = new Date().toISOString();

    // A re-issued certificate supersedes the previous one instead of deleting
    // it: the partial unique index only allows one live row per expediente,
    // and the superseded version stays in the record.
    await supabase
      .from('brc_notarial_certificates')
      .update({ superseded_at: now })
      .eq('expediente_id', expedienteId)
      .is('superseded_at', null);

    const { data: cert, error: certError } = await supabase
      .from('brc_notarial_certificates')
      .insert({
        expediente_id: expedienteId,
        notary_id: userId,
        file_url: dto.file_url,
        file_name: dto.file_name,
        file_size: dto.file_size ?? null,
        mime_type: dto.mime_type ?? null,
        observations: dto.observations ?? null,
        issued_at: now,
      })
      .select('id')
      .single();
    if (certError || !cert) {
      throw new BadRequestException(
        certError?.message ?? 'Error al registrar el Certificado Notarial',
      );
    }

    await supabase
      .from('brc_expedientes')
      .update({ status: 'PENDIENTE_EMISION_BRC' })
      .eq('id', expedienteId);
    await supabase
      .from('properties')
      .update({ brc_status: 'PENDIENTE_EMISION_BRC' })
      .eq('id', expediente.property_id);

    await supabase.from('brc_validations').insert({
      expediente_id: expedienteId,
      property_id: expediente.property_id,
      notary_id: userId,
      is_approved: true,
      validation_type: 'CERTIFICADO_NOTARIAL',
      result: 'APROBADO',
      observations: dto.observations ?? null,
    });

    await supabase.from('brc_expediente_logs').insert({
      expediente_id: expedienteId,
      action: 'CERTIFICADO_NOTARIAL_EMITIDO',
      performed_by: userId,
      old_status: expediente.status,
      new_status: 'PENDIENTE_EMISION_BRC',
      metadata: { notarial_certificate_id: cert.id, file_name: dto.file_name },
    });

    await this.insertNotification(
      expediente.requested_by,
      'Certificado Notarial emitido',
      'La notaría validó tu expediente. BitHauss emitirá tu Certificado BRC a partir de él.',
      `/dashboard/expedientes/${expedienteId}`,
      { expediente_id: expedienteId, notarial_certificate_id: cert.id },
    );

    await this.notifyBrcIssuers(
      'Expediente listo para emitir BRC',
      'Un notario emitió el Certificado Notarial. Ya puedes emitir el BRC.',
      `/admin/brc`,
      { expediente_id: expedienteId, notarial_certificate_id: cert.id },
    );

    return {
      notarial_certificate_id: cert.id,
      expediente_id: expedienteId,
      status: 'PENDIENTE_EMISION_BRC',
      issued_at: now,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Step B — BITHAUSS issues the BRC                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Derives the next folio and inserts the certificate, retrying when a
   * concurrent issuance takes the number first. The folio is never accepted
   * from the client.
   */
  /**
   * Reserves the next folio.
   *
   * Preferred path is the Postgres function `next_brc_certificate_number()`
   * (migration 024), which draws from a sequence: `nextval` is atomic, so two
   * concurrent issuances can never receive the same number even before the
   * unique index gets a say. The max()+1 derivation is only a fallback for a
   * database where the function has not been applied yet — it can race, which
   * is exactly what the retry in the caller absorbs.
   */
  private async reserveCertificateNumber(year: number): Promise<string> {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase.rpc('next_brc_certificate_number');
    if (!error && typeof data === 'string' && CERTIFICATE_NUMBER_PATTERN.test(data)) {
      return data;
    }
    this.logger.warn(
      `next_brc_certificate_number() unavailable (${
        (error as { message?: string } | null)?.message ?? 'unexpected result'
      }); falling back to derived numbering`,
    );

    const { data: existing } = await supabase
      .from('brc_certificates')
      .select('certificate_number')
      .like('certificate_number', `${certificateNumberPrefix(year)}%`);

    return nextCertificateNumber(
      ((existing ?? []) as { certificate_number: string }[]).map(
        (row) => row.certificate_number,
      ),
      year,
    );
  }

  private async insertCertificateWithNumber(payload: {
    expediente_id: string;
    property_id: string;
    issued_by: string;
    pdf_url: string | null;
    qr_code_url: string | null;
    observations: string | null;
    notarial_certificate_id: string | null;
    issued_at: string;
    expires_at: string;
  }): Promise<{ id: string; certificate_number: string }> {
    const supabase = this.supabaseConfig.getAdminClient();
    const year = new Date(payload.issued_at).getFullYear();

    let lastError: { message?: string; code?: string } | null = null;

    for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
      const certificateNumber = await this.reserveCertificateNumber(year);

      const { data, error } = await supabase
        .from('brc_certificates')
        .insert({ ...payload, certificate_number: certificateNumber })
        .select('id')
        .single();

      if (!error && data) {
        return { id: data.id as string, certificate_number: certificateNumber };
      }

      lastError = error as { message?: string; code?: string } | null;
      if (lastError?.code !== UNIQUE_VIOLATION) break;
      this.logger.warn(
        `Certificate number ${certificateNumber} was taken concurrently; retrying`,
      );
    }

    throw new ConflictException(
      lastError?.message ?? 'No se pudo asignar un número de certificado único',
    );
  }

  /**
   * BitHauss issues the BRC on the strength of the Certificado Notarial, and
   * only BitHauss: a NOTARIO is refused here even on their own expediente.
   * This is the call that stamps the listing (`properties.brc_status`).
   */
  async issueBrc(expedienteId: string, userId: string, dto: IssueBrcDto) {
    const supabase = this.supabaseConfig.getAdminClient();

    const role = await this.getRole(userId);
    if (!role || !BRC_ISSUER_ROLES.includes(role)) {
      throw new ForbiddenException(
        'Sólo BitHauss (admin u operador BRC) puede emitir el Certificado BRC',
      );
    }

    const { data: expediente } = await supabase
      .from('brc_expedientes')
      .select(
        'id, requested_by, assigned_notary_id, status, property_id, payment_status',
      )
      .eq('id', expedienteId)
      .maybeSingle();
    if (!expediente) throw new NotFoundException('Expediente no encontrado');

    if (expediente.status === 'CERTIFICADO') {
      throw new BadRequestException('El expediente ya tiene un BRC emitido');
    }
    if (expediente.status !== 'PENDIENTE_EMISION_BRC') {
      throw new BadRequestException(
        'El expediente no cuenta con un Certificado Notarial vigente',
      );
    }

    // The payment gate belongs here and not earlier in the flow: the notary's
    // review is work that may legitimately be under way while the charge is
    // still settling (OXXO/SPEI vouchers take days), but issuing the BRC is the
    // act that creates the value we charge for. `payment_status` was being
    // written by the Stripe webhook and read by nobody, which made the whole
    // BRC price list decorative — a dossier could reach CERTIFICADO unpaid.
    const paymentStatus = expediente.payment_status ?? 'PENDIENTE';
    if (!PAID_PAYMENT_STATUSES.includes(paymentStatus)) {
      throw new BadRequestException(
        'El expediente no tiene acreditado el pago de la certificación BRC',
      );
    }

    const { data: notarial } = await supabase
      .from('brc_notarial_certificates')
      .select('id, file_url, observations')
      .eq('expediente_id', expedienteId)
      .is('superseded_at', null)
      .maybeSingle();
    if (!notarial) {
      throw new BadRequestException(
        'No existe un Certificado Notarial vigente para este expediente',
      );
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setDate(expiresAt.getDate() + CERTIFICATE_VALIDITY_DAYS);

    const cert = await this.insertCertificateWithNumber({
      expediente_id: expedienteId,
      property_id: expediente.property_id,
      issued_by: userId,
      pdf_url: dto.pdf_url ?? null,
      qr_code_url: dto.qr_code_url ?? null,
      observations: dto.observations ?? notarial.observations ?? null,
      notarial_certificate_id: notarial.id,
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    // The public verification URL is only knowable once the row exists.
    if (!dto.qr_code_url) {
      await supabase
        .from('brc_certificates')
        .update({ qr_code_url: `${PUBLIC_APP_URL}/verify/${cert.id}` })
        .eq('id', cert.id);
    }

    await supabase
      .from('brc_expedientes')
      .update({ status: 'CERTIFICADO' })
      .eq('id', expedienteId);

    // This is what turns the seal on in the listing.
    await supabase
      .from('properties')
      .update({ brc_status: 'CERTIFICADO', brc_certificate_id: cert.id })
      .eq('id', expediente.property_id);

    await supabase.from('brc_expediente_logs').insert({
      expediente_id: expedienteId,
      action: 'CERTIFICADO_EMITIDO',
      performed_by: userId,
      old_status: 'PENDIENTE_EMISION_BRC',
      new_status: 'CERTIFICADO',
      metadata: {
        certificate_number: cert.certificate_number,
        certificate_id: cert.id,
        notarial_certificate_id: notarial.id,
      },
    });

    await this.insertNotification(
      expediente.requested_by,
      '¡Tu propiedad fue certificada!',
      `Certificado BRC ${cert.certificate_number} emitido por BitHauss. Ya puedes compartirlo.`,
      `/certificado/${cert.id}`,
      {
        expediente_id: expedienteId,
        certificate_id: cert.id,
        certificate_number: cert.certificate_number,
      },
    );

    return {
      certificate_id: cert.id,
      certificate_number: cert.certificate_number,
      expediente_id: expedienteId,
      status: 'CERTIFICADO',
    };
  }

  /* ----- Reject an expediente outright ----- */
  async rejectExpediente(expedienteId: string, userId: string, dto: RejectExpedienteDto) {
    const supabase = this.supabaseConfig.getAdminClient();
    const expediente = await this.assertNotaryOnExpediente(expedienteId, userId);

    await supabase.from('brc_expedientes').update({ status: 'RECHAZADO' }).eq('id', expedienteId);
    await supabase
      .from('properties')
      .update({ brc_status: 'RECHAZADO' })
      .eq('id', expediente.property_id);

    await supabase.from('brc_expediente_logs').insert({
      expediente_id: expedienteId,
      action: 'EXPEDIENTE_RECHAZADO',
      performed_by: userId,
      new_status: 'RECHAZADO',
      metadata: dto.reason ? { reason: dto.reason } : {},
    });

    await this.insertNotification(
      expediente.requested_by,
      'Solicitud BRC rechazada',
      dto.reason ?? 'Tu solicitud de certificación BRC fue rechazada.',
      `/dashboard/expedientes/${expedienteId}`,
      { expediente_id: expedienteId },
    );

    return { id: expedienteId, status: 'RECHAZADO' };
  }
}
