import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { normalizeAddress } from "../common/normalize-address";
import { PeopleService } from "../people/people.service";
import { SitesService } from "../sites/sites.service";
import { CreateVisitDto } from "./create-visit.dto";
import { Visit, VisitStatus } from "./visit.schema";

@Injectable()
export class VisitsService {
  constructor(
    @InjectModel(Visit.name) private readonly visits: Model<Visit>,
    private readonly people: PeopleService,
    private readonly sites: SitesService,
  ) {}

  async create(dto: CreateVisitDto) {
    await this.people.assertExists(dto.person);
    const address = normalizeAddress(dto.address);
    const site = await this.sites.findByAddress(address);

    return this.visits.create({
      person: dto.person,
      address,
      ...(site ? { site: site._id } : {}),
      source: dto.source,
      status: site ? VisitStatus.Shown : VisitStatus.NotFound,
    });
  }

  async historyForPerson(personId: string) {
    await this.people.assertExists(personId);
    return this.visits
      .find({ person: personId })
      .sort({ visitedAt: -1, _id: -1 })
      .lean()
      .exec();
  }
}
