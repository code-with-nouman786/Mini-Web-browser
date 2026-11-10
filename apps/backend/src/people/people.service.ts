import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Person } from "./person.schema";

@Injectable()
export class PeopleService {
  constructor(
    @InjectModel(Person.name) private readonly people: Model<Person>,
  ) {}

  findAll() {
    return this.people.find().sort({ name: 1, _id: 1 }).lean().exec();
  }

  async assertExists(personId: string): Promise<void> {
    const person = await this.people.exists({ _id: personId }).exec();
    if (!person) {
      throw new NotFoundException("Person not found");
    }
  }
}
