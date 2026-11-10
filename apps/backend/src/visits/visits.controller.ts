import { Body, Controller, Post } from "@nestjs/common";
import { CreateVisitDto } from "./create-visit.dto";
import { VisitsService } from "./visits.service";

@Controller("visits")
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Post()
  create(@Body() dto: CreateVisitDto) {
    return this.visits.create(dto);
  }
}
