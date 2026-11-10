import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, type Types } from "mongoose";
import { Site } from "../sites/site.schema";
import { searchExcerpt } from "./search-excerpt";

interface SearchAuthor {
  _id: Types.ObjectId;
  name: string;
}

export interface SearchResult {
  address: string;
  title: string;
  excerpt: string;
  author: { _id: string; name: string } | null;
  publishedAt: string;
}

@Injectable()
export class SearchService {
  constructor(@InjectModel(Site.name) private readonly sites: Model<Site>) {}

  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const sites = await this.sites
      .find(
        { $text: { $search: query, $language: "none" } },
        {
          _id: 0,
          address: 1,
          title: 1,
          plainText: 1,
          author: 1,
          publishedAt: 1,
          score: { $meta: "textScore" },
        },
      )
      .sort({ score: { $meta: "textScore" }, address: 1 })
      .limit(50)
      .populate<{ author: SearchAuthor | null }>("author", "name")
      .lean()
      .exec();

    return sites.map((site) => ({
      address: site.address,
      title: site.title,
      excerpt: searchExcerpt(site.plainText, site.title, query),
      author: site.author
        ? { _id: site.author._id.toHexString(), name: site.author.name }
        : null,
      publishedAt: site.publishedAt.toISOString(),
    }));
  }
}
