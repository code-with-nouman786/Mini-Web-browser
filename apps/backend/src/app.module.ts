import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AppController } from "./app.controller";
import { PeopleModule } from "./people/people.module";
import { SitesModule } from "./sites/sites.module";
import { VisitsModule } from "./visits/visits.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>("MONGODB_URI"),
        autoIndex: true,
      }),
    }),
    PeopleModule,
    SitesModule,
    VisitsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
