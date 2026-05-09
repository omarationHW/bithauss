import { Controller, Get, Put, Post, Delete, Body } from '@nestjs/common';
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
   * Creates the authenticated user's profile. Forces id = caller's id
   * to prevent pre-creating profiles for other UUIDs.
   */
  @Post()
  async createProfile(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string,
    @Body() dto: CreateProfileDto,
  ) {
    return this.profilesService.createProfile({
      ...dto,
      id: userId,
      email: dto.email ?? userEmail,
    });
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
