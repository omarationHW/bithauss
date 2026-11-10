import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { MAX_MESSAGE_CHARS, MAX_REQUEST_MESSAGES } from './assistant.constants';
import type { PropertySearchHit } from '../properties/property-search.types';

export const CHAT_ROLES = ['user', 'assistant'] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export class ChatMessageDto {
  @IsString()
  @IsIn(CHAT_ROLES as unknown as string[])
  role!: ChatRole;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MESSAGE_CHARS)
  content!: string;
}

export class ChatRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REQUEST_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}

export interface ChatResponse {
  reply: string;
  /** Hits of the last search run in this turn — the UI renders them as cards. */
  properties: PropertySearchHit[];
  relaxed: boolean;
}

export interface TranscribeResponse {
  text: string;
}
