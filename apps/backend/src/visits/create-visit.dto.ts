import { IsEnum, IsMongoId } from "class-validator";
import { AddressDto } from "../common/address.dto";
import { NavigationSource } from "./visit.schema";

export class CreateVisitDto extends AddressDto {
  @IsMongoId()
  person!: string;

  @IsEnum(NavigationSource)
  source!: NavigationSource;
}
