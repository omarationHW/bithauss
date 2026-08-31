import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MembershipsService } from './memberships.service';
import {
  ConfirmCancellationDto,
  ConfirmPaymentDto,
  ConsumeLegalTicketDto,
  ContractMembershipDto,
  CreateCrmSeatDto,
  RecordPaymentDto,
  RequestCancellationDto,
  StackMembershipDto,
  StartTrialDto,
  UpgradeMembershipDto,
} from './dto/memberships.dto';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  // ── Catálogo ────────────────────────────────────────────────

  /**
   * GET /api/v1/memberships/catalog
   * Public: the landing page prices come from here.
   */
  @Public()
  @Get('catalog')
  getCatalog() {
    return this.memberships.getCatalog();
  }

  // ── Cliente ─────────────────────────────────────────────────

  /** GET /api/v1/memberships/me — membresía, entitlements y consumo. */
  @Get('me')
  getMyMembership(@CurrentUser('id') userId: string) {
    return this.memberships.getMyMembership(userId);
  }

  /** POST /api/v1/memberships/contract — A1/A3/A4. Queda PENDIENTE_PAGO. */
  @Post('contract')
  contract(
    @CurrentUser('id') userId: string,
    @Body() dto: ContractMembershipDto,
  ) {
    return this.memberships.contract(userId, dto);
  }

  /** POST /api/v1/memberships/trial — A2, requiere tarjeta registrada. */
  @Post('trial')
  startTrial(@CurrentUser('id') userId: string, @Body() dto: StartTrialDto) {
    return this.memberships.startTrial(userId, dto);
  }

  /** POST /api/v1/memberships/upgrade — A6. El downgrade se rechaza. */
  @Post('upgrade')
  upgrade(
    @CurrentUser('id') userId: string,
    @Body() dto: UpgradeMembershipDto,
  ) {
    return this.memberships.upgrade(userId, dto);
  }

  /** POST /api/v1/memberships/stack — A6, sólo sobre una PLATINO vigente. */
  @Post('stack')
  stack(@CurrentUser('id') userId: string, @Body() dto: StackMembershipDto) {
    return this.memberships.stack(userId, dto);
  }

  /** POST /api/v1/memberships/crm-seats — alta de cuenta CRM con límite. */
  @Post('crm-seats')
  createCrmSeat(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCrmSeatDto,
  ) {
    return this.memberships.createCrmSeat(userId, dto);
  }

  /** POST /api/v1/memberships/legal-tickets/consume */
  @Post('legal-tickets/consume')
  consumeLegalTicket(
    @CurrentUser('id') userId: string,
    @Body() dto: ConsumeLegalTicketDto,
  ) {
    return this.memberships.consumeLegalTicket(userId, dto);
  }

  /**
   * GET /api/v1/memberships/can-publish/:profileId
   * Server-side gate used before persisting a PUBLICADO property. Returns 403
   * with the reason when the quota is spent.
   */
  @Roles('ADMIN')
  @Get('can-publish/:profileId')
  async canPublish(@Param('profileId', new ParseUUIDPipe()) profileId: string) {
    await this.memberships.assertCanPublishProperty(profileId);
    return { allowed: true };
  }

  // ── Administración (A5) ─────────────────────────────────────

  /** POST /api/v1/memberships/payments — paso 1 de la doble verificación. */
  @Roles('ADMIN')
  @Post('payments')
  recordPayment(
    @CurrentUser('id') adminId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.memberships.recordPayment(adminId, dto);
  }

  /**
   * POST /api/v1/memberships/payments/confirm — paso 2. Debe ejecutarlo un
   * administrador DISTINTO al que registró el pago.
   */
  @Roles('ADMIN')
  @Post('payments/confirm')
  confirmPayment(
    @CurrentUser('id') adminId: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.memberships.confirmPayment(adminId, dto);
  }

  /** POST /api/v1/memberships/cancellations/request — paso 1. */
  @Roles('ADMIN')
  @Post('cancellations/request')
  requestCancellation(
    @CurrentUser('id') adminId: string,
    @Body() dto: RequestCancellationDto,
  ) {
    return this.memberships.requestCancellation(adminId, dto);
  }

  /** POST /api/v1/memberships/cancellations/confirm — paso 2, otro admin. */
  @Roles('ADMIN')
  @Post('cancellations/confirm')
  confirmCancellation(
    @CurrentUser('id') adminId: string,
    @Body() dto: ConfirmCancellationDto,
  ) {
    return this.memberships.confirmCancellation(adminId, dto);
  }

  /** GET /api/v1/memberships/reports/daily — A5. */
  @Roles('ADMIN')
  @Get('reports/daily')
  getDailyStatusReport() {
    return this.memberships.getDailyStatusReport();
  }
}
