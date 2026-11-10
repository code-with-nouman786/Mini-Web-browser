import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AppModule } from "../app.module";
import { Person, PersonSchema } from "../people/person.schema";
import { Site, SiteSchema } from "../sites/site.schema";
import { Visit, VisitSchema } from "../visits/visit.schema";
import { SeedService } from "./seed.service";

@Module({
  imports: [
    AppModule,
    MongooseModule.forFeature([
      { name: Person.name, schema: PersonSchema },
      { name: Site.name, schema: SiteSchema },
      { name: Visit.name, schema: VisitSchema },
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
