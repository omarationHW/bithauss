import { Controller, Get, Put, Post, Delete, Body } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ProfilesService,
  CreateProfileDto,
  UpdateProfileDto,
} from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  /**
   * GET /api/v1/profiles/me
   * Returns the authenticated user's profile.
   */
  @Get('me')
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.profilesService.getProfileById(userId);
  }

  /**
   * PUT /api/v1/profiles/me
   * Updates the authenticated user's profile.
   */
  @Put('me')
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.updateProfile(userId, dto);
  }

  /**
   * POST /api/v1/profiles
   * Creates a new profile. Marked @Public() because the user
   * has just signed up and may not have a profile yet.
   * The caller must provide the user's ID in the body.
   */
  @Public()
  @Post()
  async createProfile(@Body() dto: CreateProfileDto) {
    return this.profilesService.createProfile(dto);
  }

  /**
   * DELETE /api/v1/profiles/me
   * Permanently deletes the authenticated user's account and all associated data.
   */
  @Delete('me')
  async deleteMyAccount(@CurrentUser('id') userId: string) {
    return this.profilesService.deleteAccount(userId);
  }
}
