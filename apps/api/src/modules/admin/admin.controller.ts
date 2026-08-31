import { Body, Controller, Param, Patch, ParseUUIDPipe } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AdminService,
  UpdateUserRoleDto,
  UpdateUserActiveDto,
  VerifyNotaryDto,
  AssignExpedienteDto,
} from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles('ADMIN')
  @Patch('users/:id/role')
  updateUserRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.adminService.updateUserRole(id, dto.role, actorId);
  }

  @Roles('ADMIN')
  @Patch('users/:id/active')
  updateUserActive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserActiveDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.adminService.updateUserActive(id, dto.is_active, actorId);
  }

  @Roles('ADMIN')
  @Patch('notaries/:profileId/verify')
  verifyNotary(
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Body() dto: VerifyNotaryDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.adminService.verifyNotary(profileId, dto.verified, actorId);
  }

  @Roles('ADMIN', 'OPERADOR_BRC')
  @Patch('expedientes/:id/assign')
  assignExpediente(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignExpedienteDto,
  ) {
    return this.adminService.assignExpediente(id, dto.notary_id, dto.operator_id);
  }
}
