import { Controller, Get } from "@nestjs/common";
import { PeopleService } from "./people.service";

@Controller("people")
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  findAll() {
    return this.people.findAll();
  }
}
