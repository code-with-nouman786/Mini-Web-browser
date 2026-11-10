import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types, type HydratedDocument } from "mongoose";
import { normalizeAddress } from "../common/normalize-address";
import { Person } from "../people/person.schema";

export type SiteDocument = HydratedDocument<Site>;

@Schema({ versionKey: false })
export class Site {
  @Prop({ required: true, unique: true, set: normalizeAddress })
  address!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true })
  html!: string;

  // Text may be empty for an HTML document with no textual content.
  @Prop({ default: "" })
  plainText!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Person.name, required: true })
  author!: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  publishedAt!: Date;
}

export const SiteSchema = SchemaFactory.createForClass(Site);
SiteSchema.index(
  { title: "text", plainText: "text" },
  {
    name: "site_content_text",
    weights: { title: 5, plainText: 1 },
    default_language: "none",
  },
);
