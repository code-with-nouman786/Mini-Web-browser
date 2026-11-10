import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Person } from "../people/person.schema";
import { Site } from "../sites/site.schema";
import { Visit } from "../visits/visit.schema";
import { buildSeedRecords } from "./seed-data";

@Injectable()
export class SeedService {
  constructor(
    @InjectModel(Person.name) private readonly people: Model<Person>,
    @InjectModel(Site.name) private readonly sites: Model<Site>,
    @InjectModel(Visit.name) private readonly visits: Model<Visit>,
  ) {}

  async seed(): Promise<{ people: number; sites: number; visits: number }> {
    const records = buildSeedRecords();
    await Promise.all([
      this.people.init(),
      this.sites.init(),
      this.visits.init(),
    ]);

    await this.people.bulkWrite(
      records.people.map(({ _id, ...person }) => ({
        updateOne: { filter: { _id }, update: { $set: person }, upsert: true },
      })),
      { ordered: true },
    );
    await this.sites.bulkWrite(
      records.sites.map(({ _id, ...site }) => ({
        updateOne: { filter: { _id }, update: { $set: site }, upsert: true },
      })),
      { ordered: true },
    );
    await this.visits.bulkWrite(
      records.visits.map(({ _id, site, ...visit }) => ({
        updateOne: {
          filter: { _id },
          update: {
            $set: { ...visit, ...(site ? { site } : {}) },
            ...(!site ? { $unset: { site: 1 } } : {}),
          },
          upsert: true,
        },
      })),
      { ordered: true },
    );

    return {
      people: records.people.length,
      sites: records.sites.length,
      visits: records.visits.length,
    };
  }
}
