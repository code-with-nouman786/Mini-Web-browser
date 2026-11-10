import { IsMongoId } from "class-validator";

export class PersonIdDto {
  @IsMongoId()
  personId!: string;
}
