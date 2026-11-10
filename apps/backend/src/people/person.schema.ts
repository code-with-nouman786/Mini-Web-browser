import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export type PersonDocument = HydratedDocument<Person>;

@Schema({ versionKey: false })
export class Person {
  @Prop({ required: true, trim: true })
  name!: string;
}

export const PersonSchema = SchemaFactory.createForClass(Person);
PersonSchema.index({ name: 1, _id: 1 });
