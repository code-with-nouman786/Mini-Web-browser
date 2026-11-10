import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PeopleModule } from "../people/people.module";
import { Site, SiteSchema } from "./site.schema";
import { SitesController } from "./sites.controller";
import { SitesService } from "./sites.service";

@Module({
  imports: [
    PeopleModule,
    MongooseModule.forFeature([{ name: Site.name, schema: SiteSchema }]),
  ],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
