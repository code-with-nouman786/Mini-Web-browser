import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PeopleModule } from "../people/people.module";
import { Site, SiteSchema } from "../sites/site.schema";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  imports: [
    PeopleModule,
    MongooseModule.forFeature([{ name: Site.name, schema: SiteSchema }]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
