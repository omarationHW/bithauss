import { IsUUID } from 'class-validator';

/**
 * Body of `POST /payments/brc/checkout`.
 *
 * SECURITY: the expediente id is the ONLY thing the client may send. There is
 * deliberately no `amount`, `total` or `discount` field — the price is
 * recomputed server-side from the property value and the caller's membership.
 * The global ValidationPipe runs with `whitelist` + `forbidNonWhitelisted`,
 * so a request that tries to smuggle an amount is rejected with a 400 instead
 * of being silently ignored.
 */
export class CreateBrcCheckoutDto {
  @IsUUID('4', { message: 'expediente_id inválido' })
  expediente_id!: string;
}
