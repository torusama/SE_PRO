import { Module } from '@nestjs/common';
import { DeceasedController } from './deceased.controller';
import { DeceasedAdminController } from './deceased-admin.controller';
import { FamilyController } from './family.controller';
import { DeceasedService } from './deceased.service';
import { DeceasedAccessService } from './deceased-access.service';
import { DeceasedVerificationService } from './deceased-verification.service';
import { DeceasedMapService } from './deceased-map.service';
import { FamilyService } from './family.service';
import { FamilyInvitationService } from './family-invitation.service';
import { FamilyLifecycleService } from './family-lifecycle.service';
import { ResourcePermissionService } from './resource-permission.service';

@Module({
  controllers: [DeceasedController, DeceasedAdminController, FamilyController],
  providers: [
    DeceasedService,
    DeceasedAccessService,
    DeceasedVerificationService,
    DeceasedMapService,
    FamilyService,
    FamilyInvitationService,
    FamilyLifecycleService,
    ResourcePermissionService,
  ],
  exports: [DeceasedAccessService],
})
export class DeceasedModule {}
