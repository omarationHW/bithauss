import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  PropertiesService,
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyFilters,
} from './properties.service';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  /**
   * POST /api/v1/properties
   * Create a new property listing.
   * Only brokers, agencies, and sellers may create properties.
   */
  @Roles('broker', 'inmobiliaria', 'vendedor')
  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.propertiesService.create(userId, dto);
  }

  /**
   * GET /api/v1/properties
   * List all published properties with optional filters.
   * Public endpoint — no authentication required.
   */
  @Public()
  @Get()
  async findAll(@Query() filters: PropertyFilters) {
    return this.propertiesService.findAll({
      ...filters,
      status: 'PUBLICADO',
    });
  }

  /**
   * GET /api/v1/properties/mine
   * List the current user's own properties.
   */
  @Get('mine')
  async findMine(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
  ) {
    return this.propertiesService.findByOwner(userId, status);
  }

  /**
   * GET /api/v1/properties/:id
   * Get a single property by ID. Public endpoint.
   * Increments the view counter.
   */
  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    // Fire-and-forget: don't await the view count increment
    this.propertiesService.incrementViewCount(id);
    return this.propertiesService.findById(id);
  }

  /**
   * PUT /api/v1/properties/:id
   * Update a property. Only the owner may update.
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, userId, dto);
  }

  /**
   * DELETE /api/v1/properties/:id
   * Soft-delete a property. Only the owner may delete.
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.propertiesService.delete(id, userId);
  }

  /**
   * PATCH /api/v1/properties/:id/publish
   * Publish a property. Only the owner may publish.
   */
  @Patch(':id/publish')
  async publish(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.propertiesService.publish(id, userId);
  }

  /**
   * PATCH /api/v1/properties/:id/pause
   * Pause a property. Only the owner may pause.
   */
  @Patch(':id/pause')
  async pause(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.propertiesService.pause(id, userId);
  }
}
