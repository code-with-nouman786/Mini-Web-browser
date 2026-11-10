import { Controller, Get, Param } from "@nestjs/common";
import { PersonIdDto } from "../common/person-id.dto";
import { VisitsService } from "./visits.service";

@Controller("people")
export class PeopleHistoryController {
  constructor(private readonly visits: VisitsService) {}

  @Get(":personId/history")
  history(@Param() params: PersonIdDto) {
    return this.visits.historyForPerson(params.personId);
  }
}
