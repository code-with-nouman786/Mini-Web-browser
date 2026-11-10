import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { AddressDto } from "../common/address.dto";
import { CreateSiteDto } from "./create-site.dto";
import { SitesService } from "./sites.service";

@Controller("sites")
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get(":address")
  getByAddress(@Param() params: AddressDto) {
    return this.sites.getByAddress(params.address);
  }

  @Post()
  create(@Body() dto: CreateSiteDto) {
    return this.sites.create(dto);
  }
}
