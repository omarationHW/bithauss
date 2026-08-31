import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { StripeSignatureError } from './stripe.client';
import { CreateBrcCheckoutDto } from './dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Starts the BRC payment. Authenticated: the caller must own the expediente.
   * The body carries only the expediente id — see CreateBrcCheckoutDto for why.
   */
  @Post('brc/checkout')
  createBrcCheckout(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBrcCheckoutDto,
  ) {
    return this.paymentsService.createBrcCheckout(userId, dto);
  }

  /**
   * Stripe webhook. `@Public()` because Stripe cannot present a user JWT —
   * authentication here IS the signature check, which runs before the payload
   * is trusted for anything.
   *
   * REQUIRES the raw body. Wire it in `main.ts` with
   * `NestFactory.create(AppModule, { rawBody: true })`; without it Express has
   * already parsed and discarded the exact bytes Stripe signed and every
   * event would be rejected.
   */
  @Public()
  @Post('stripe/webhook')
  @HttpCode(200)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException(
        'Cuerpo sin procesar no disponible: habilita rawBody en main.ts',
      );
    }

    try {
      return await this.paymentsService.handleWebhook(rawBody, signature);
    } catch (err) {
      // A bad signature is a client error: answering 4xx tells Stripe not to
      // treat it as an outage, and never leaks why verification failed.
      if (err instanceof StripeSignatureError) {
        throw new BadRequestException('Firma de webhook inválida');
      }
      throw err;
    }
  }
}
