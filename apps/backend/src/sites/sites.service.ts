import {
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, mongo } from "mongoose";
import { normalizeAddress } from "../common/normalize-address";
import { PeopleService } from "../people/people.service";
import { CreateSiteDto } from "./create-site.dto";
import { Site } from "./site.schema";

@Injectable()
export class SitesService implements OnModuleInit {
  constructor(
    @InjectModel(Site.name) private readonly sites: Model<Site>,
    private readonly people: PeopleService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Await the unique address index before accepting requests, including races.
    await this.sites.init();
  }

  findByAddress(address: string) {
    return this.sites
      .findOne({ address: normalizeAddress(address) })
      .lean()
      .exec();
  }

  async getByAddress(address: string) {
    const site = await this.findByAddress(address);
    if (!site) {
      throw new NotFoundException("Site not found");
    }
    return site;
  }

  async create(dto: CreateSiteDto) {
    await this.people.assertExists(dto.author);

    try {
      return await this.sites.create({
        address: normalizeAddress(dto.address),
        title: dto.title,
        html: dto.html,
        plainText: dto.plainText,
        author: dto.author,
        ...(dto.publishedAt ? { publishedAt: new Date(dto.publishedAt) } : {}),
      });
    } catch (error: unknown) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        throw new ConflictException("A site with this address already exists");
      }
      throw error;
    }
  }
}
