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
  CertifyExpedienteDto,
  RejectExpedienteDto,
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

  @Roles('NOTARIO', 'ADMIN')
  @Post('expedientes/:id/certify')
  certifyExpediente(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CertifyExpedienteDto,
  ) {
    return this.brcService.certifyExpediente(id, userId, dto);
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
