import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PeopleModule } from "../people/people.module";
import { SitesModule } from "../sites/sites.module";
import { PeopleHistoryController } from "./people-history.controller";
import { Visit, VisitSchema } from "./visit.schema";
import { VisitsController } from "./visits.controller";
import { VisitsService } from "./visits.service";

@Module({
  imports: [
    PeopleModule,
    SitesModule,
    MongooseModule.forFeature([{ name: Visit.name, schema: VisitSchema }]),
  ],
  controllers: [VisitsController, PeopleHistoryController],
  providers: [VisitsService],
})
export class VisitsModule {}
