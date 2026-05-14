import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  Length,
  IsUUID,
} from 'class-validator';
import { SupabaseConfigService } from '../../config/supabase.config';

export class RejectDocumentDto {
  @IsString() @Length(3, 1000) reason!: string;
  @IsOptional() @IsString() @Length(0, 1000) owner_instruction?: string;
}

export class CertifyExpedienteDto {
  @IsString() @Length(3, 64) certificate_number!: string;
  @IsOptional() @IsString() @Length(0, 5000) observations?: string;
  @IsOptional() @IsString() pdf_url?: string;
}

export class RejectExpedienteDto {
  @IsOptional() @IsString() @Length(0, 5000) reason?: string;
}

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

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('brc_documents')
      .update({
        status: 'VALIDADO',
        rejection_reason: null,
        owner_instruction: null,
        reviewed_by: userId,
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

    return { id: documentId, status: 'VALIDADO', reviewed_at: now, expediente_id: doc.expediente_id, requester_id: expediente.requested_by };
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

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('brc_documents')
      .update({
        status: 'RECHAZADO',
        rejection_reason: dto.reason,
        owner_instruction: dto.owner_instruction ?? null,
        reviewed_by: userId,
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

    const docName = (doc.brc_document_types as { name?: string } | null)?.name ?? 'Documento';
    await this.insertNotification(
      expediente.requested_by,
      `Documento rechazado: ${docName}`,
      dto.owner_instruction ?? dto.reason,
      `/dashboard/expedientes/${doc.expediente_id}`,
      { document_id: documentId, expediente_id: doc.expediente_id },
    );

    return { id: documentId, status: 'RECHAZADO', reviewed_at: now };
  }

  /* ----- Certify an expediente ----- */
  async certifyExpediente(expedienteId: string, userId: string, dto: CertifyExpedienteDto) {
    const supabase = this.supabaseConfig.getAdminClient();
    const expediente = await this.assertNotaryOnExpediente(expedienteId, userId);

    // Verify all required documents are VALIDADO/APROBADO
    const { data: docs } = await supabase
      .from('brc_documents')
      .select('id, status, brc_document_types(is_required)')
      .eq('expediente_id', expedienteId);

    const required = (docs ?? []).filter(
      (d) => (d.brc_document_types as { is_required?: boolean } | null)?.is_required,
    );
    if (required.length === 0 || required.some((d) => d.status !== 'VALIDADO' && d.status !== 'APROBADO')) {
      throw new BadRequestException('Todos los documentos requeridos deben estar validados antes de certificar');
    }

    // 1. Insert certificate
    const { data: cert, error: certError } = await supabase
      .from('brc_certificates')
      .insert({
        certificate_number: dto.certificate_number,
        expediente_id: expedienteId,
        property_id: expediente.property_id,
        issued_by: userId,
        pdf_url: dto.pdf_url ?? null,
        observations: dto.observations ?? null,
      })
      .select('id')
      .single();
    if (certError || !cert) throw new BadRequestException(certError?.message ?? 'Error al crear certificado');

    // 2. Update expediente
    await supabase.from('brc_expedientes').update({ status: 'CERTIFICADO' }).eq('id', expedienteId);

    // 3. Update property
    await supabase
      .from('properties')
      .update({ brc_status: 'CERTIFICADO', brc_certificate_id: cert.id })
      .eq('id', expediente.property_id);

    // 4. Insert validation record
    await supabase.from('brc_validations').insert({
      expediente_id: expedienteId,
      property_id: expediente.property_id,
      validated_by: userId,
      validation_type: 'CERTIFICACION',
      result: 'APROBADO',
      notes: dto.observations ?? null,
    });

    // 5. Log
    await supabase.from('brc_expediente_logs').insert({
      expediente_id: expedienteId,
      action: 'CERTIFICADO_EMITIDO',
      performed_by: userId,
      new_status: 'CERTIFICADO',
      metadata: { certificate_number: dto.certificate_number },
    });

    // 6. Notify requester
    await this.insertNotification(
      expediente.requested_by,
      '¡Tu propiedad fue certificada!',
      `Certificado BRC ${dto.certificate_number} emitido. Ya puedes compartirlo.`,
      `/certificado/${cert.id}`,
      { expediente_id: expedienteId, certificate_id: cert.id, certificate_number: dto.certificate_number },
    );

    return { certificate_id: cert.id, certificate_number: dto.certificate_number };
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
