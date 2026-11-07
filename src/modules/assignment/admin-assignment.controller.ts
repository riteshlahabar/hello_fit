import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import {
  AllowAudience,
  CurrentUser,
  RequirePermissions,
} from '../../common/decorators/auth.decorators';
import { AssignmentService } from './assignment.service';

export class AdminAssignDto {
  @IsUUID()
  instructorId!: string;

  /** Mandatory: every admin override is auditable (spec 10.1). */
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;

  /** Assign over a clash; recorded on the assignment and in the audit trail. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

/** Operations: the assignment queue and manual allocation (spec 5.4). */
@Controller('admin')
@AllowAudience('admin')
export class AdminAssignmentController {
  constructor(private readonly assignment: AssignmentService) {}

  @RequirePermissions('bookings:view')
  @Get('assignment-queue')
  async queue() {
    const sessions = await this.assignment.listAssignmentQueue();
    return { data: sessions, meta: { count: sessions.length } };
  }

  /** Who could take this session, with scores and rejection reasons. */
  @RequirePermissions('bookings:view')
  @Get('sessions/:id/candidates')
  async candidates(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.assignment.candidatesFor(id) };
  }

  @RequirePermissions('bookings:edit')
  @Post('sessions/:id/assign')
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminAssignDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    const assignment = await this.assignment.adminAssign({
      sessionId: id,
      instructorId: dto.instructorId,
      adminUserId,
      reason: dto.reason,
      force: dto.force,
    });

    return { data: assignment, message: 'Teacher assigned' };
  }

  /** Re-run the automatic match, e.g. after a decline. */
  @RequirePermissions('bookings:edit')
  @Post('sessions/:id/auto-assign')
  async autoAssign(@Param('id', ParseUUIDPipe) id: string) {
    const offer = await this.assignment.offerNextCandidate(id);

    return {
      data: offer,
      message: offer
        ? 'Offer sent to the best match'
        : 'No eligible teacher found — session stays in the queue',
    };
  }
}
