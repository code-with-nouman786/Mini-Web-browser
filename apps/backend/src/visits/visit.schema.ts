import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types, type HydratedDocument } from "mongoose";
import { normalizeAddress } from "../common/normalize-address";
import { Person } from "../people/person.schema";
import { Site } from "../sites/site.schema";

export enum NavigationSource {
  Typed = "typed",
  Link = "link",
  Search = "search",
  History = "history",
}

export enum VisitStatus {
  Shown = "shown",
  NotFound = "not_found",
}

export type VisitDocument = HydratedDocument<Visit>;

@Schema({ versionKey: false })
export class Visit {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Person.name, required: true })
  person!: Types.ObjectId;

  @Prop({ required: true, set: normalizeAddress })
  address!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Site.name })
  site?: Types.ObjectId;

  @Prop({ type: String, required: true, enum: NavigationSource })
  source!: NavigationSource;

  @Prop({ type: String, required: true, enum: VisitStatus })
  status!: VisitStatus;

  @Prop({ type: Date, required: true, default: Date.now })
  visitedAt!: Date;
}

export const VisitSchema = SchemaFactory.createForClass(Visit);
VisitSchema.index({ person: 1, visitedAt: -1, _id: -1 });
