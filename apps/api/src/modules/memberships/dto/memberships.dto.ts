import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

import type {
  MembershipPeriodKey,
  MembershipTierKey,
} from '@bithauss/config';

export const SELLABLE_TIERS = [
  'START',
  'GROW',
  'BLUE',
  'GOLD',
  'BLACK',
  'PLATINO',
] as const;

export const CONTRACT_PERIODS = [
  'TRIMESTRAL',
  'SEMESTRAL',
  'ANUAL',
  'ANUAL_ANTICIPADO',
] as const;

export const PAYMENT_MODES = ['UNICO', 'DOMICILIADO'] as const;

/** A1/A3/A4 — contract a membership. */
export class ContractMembershipDto {
  @IsIn(SELLABLE_TIERS as unknown as string[])
  tier!: MembershipTierKey;

  @IsIn(CONTRACT_PERIODS as unknown as string[])
  period!: MembershipPeriodKey;

  @IsOptional()
  @IsIn(PAYMENT_MODES as unknown as string[])
  payment_mode?: 'UNICO' | 'DOMICILIADO';

  @IsOptional() @IsUUID() company_id?: string | null;

  @IsOptional() @IsString() @Length(1, 120) payment_method?: string;
}

/** A2 — start the 7-day trial. A card on file is mandatory. */
export class StartTrialDto {
  @IsIn(SELLABLE_TIERS as unknown as string[])
  tier!: MembershipTierKey;

  @IsIn(CONTRACT_PERIODS as unknown as string[])
  period!: MembershipPeriodKey;

  /** Gateway token of the registered card. Without it the trial is refused. */
  @IsString() @Length(1, 200) payment_method_id!: string;

  @IsOptional() @IsUUID() company_id?: string | null;
}

/** A6 — upgrade. Downgrades are rejected by the service, not modelled here. */
export class UpgradeMembershipDto {
  @IsUUID() subscription_id!: string;

  @IsIn(SELLABLE_TIERS as unknown as string[])
  target_tier!: MembershipTierKey;

  @IsIn(CONTRACT_PERIODS as unknown as string[])
  target_period!: MembershipPeriodKey;
}

/** A6 — stack an extra membership onto an existing PLATINO subscription. */
export class StackMembershipDto {
  @IsUUID() parent_subscription_id!: string;

  @IsIn(SELLABLE_TIERS as unknown as string[])
  tier!: MembershipTierKey;

  @IsIn(CONTRACT_PERIODS as unknown as string[])
  period!: MembershipPeriodKey;
}

/** A5 — first actor records the payment. */
export class RecordPaymentDto {
  @IsUUID() subscription_id!: string;

  @Min(1) amount!: number;

  @IsOptional() @IsString() @Length(1, 60) payment_method?: string;

  @IsOptional() @IsString() @Length(1, 200) stripe_payment_intent_id?: string;

  @IsOptional() @IsInt() @Min(1) instalment_number?: number;
}

/**
 * A5 — second actor confirms. `confirm` must be sent explicitly: an accidental
 * or replayed request must never be able to grant access on its own.
 */
export class ConfirmPaymentDto {
  @IsUUID() subscription_id!: string;

  @IsOptional() @IsUUID() payment_id?: string;

  @IsBoolean() confirm!: boolean;

  @IsOptional() @IsString() @Length(0, 500) notes?: string;
}

/** A5 — step 1 of cancelling for non-payment / rule breach. */
export class RequestCancellationDto {
  @IsUUID() subscription_id!: string;

  @IsString() @Length(5, 500) reason!: string;
}

/** A5 — step 2: a different admin authorises the cancellation. */
export class ConfirmCancellationDto {
  @IsUUID() subscription_id!: string;

  @IsBoolean() confirm!: boolean;
}

export class ConsumeLegalTicketDto {
  @IsUUID() subscription_id!: string;

  @IsString() @Length(10, 2000) subject!: string;
}

export class CreateCrmSeatDto {
  @IsUUID() subscription_id!: string;

  @IsString() @Length(3, 200) email!: string;

  @IsOptional() @IsString() @Length(1, 200) full_name?: string;
}
