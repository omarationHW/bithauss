import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  BrcService,
  RejectDocumentDto,
  RejectExpedienteDto,
  OcrCorrectionDto,
  CertificateTrackingDto,
  IssueNotarialCertificateDto,
  IssueBrcDto,
} from './brc.service';

@Controller('brc')
export class BrcController {
  constructor(private readonly brcService: BrcService) {}

  @Roles('NOTARIO', 'ADMIN', 'OPERADOR_BRC')
  @Patch('documents/:id/approve')
  approveDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.brcService.approveDocument(id, userId);
  }

  @Roles('NOTARIO', 'ADMIN', 'OPERADOR_BRC')
  @Patch('documents/:id/reject')
  rejectDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RejectDocumentDto,
  ) {
    return this.brcService.rejectDocument(id, userId, dto);
  }

  @Roles('NOTARIO', 'ADMIN', 'OPERADOR_BRC')
  @Patch('documents/:id/ocr-correction')
  updateOcrCorrection(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: OcrCorrectionDto,
  ) {
    return this.brcService.updateOcrCorrection(id, userId, dto);
  }

  /** Certificates the notary collects from RPP / Predial / Agua / otros. */
  @Roles('NOTARIO', 'ADMIN', 'OPERADOR_BRC')
  @Patch('documents/:id/certificate-tracking')
  updateCertificateTracking(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CertificateTrackingDto,
  ) {
    return this.brcService.updateCertificateTracking(id, userId, dto);
  }

  /**
   * Step A — the NOTARY uploads the Certificado Notarial. The service further
   * restricts this to the notary actually assigned to the expediente.
   */
  @Roles('NOTARIO', 'ADMIN')
  @Post('expedientes/:id/notarial-certificate')
  issueNotarialCertificate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: IssueNotarialCertificateDto,
  ) {
    return this.brcService.issueNotarialCertificate(id, userId, dto);
  }

  /**
   * Step B — BITHAUSS issues the BRC from that certificate. Deliberately NOT
   * open to NOTARIO: the platform grants the seal, not the reviewing party.
   */
  @Roles('ADMIN', 'OPERADOR_BRC')
  @Post('expedientes/:id/issue-brc')
  issueBrc(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: IssueBrcDto,
  ) {
    return this.brcService.issueBrc(id, userId, dto);
  }

  @Roles('NOTARIO', 'ADMIN', 'OPERADOR_BRC')
  @Patch('expedientes/:id/reject')
  rejectExpediente(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RejectExpedienteDto,
  ) {
    return this.brcService.rejectExpediente(id, userId, dto);
  }
}
