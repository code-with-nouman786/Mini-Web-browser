import { Transform, type TransformFnParams } from "class-transformer";
import {
  IsISO8601,
  IsMongoId,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { AddressDto } from "../common/address.dto";

export class CreateSiteDto extends AddressDto {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsString()
  @IsNotEmpty()
  html!: string;

  @IsString()
  plainText!: string;

  @IsMongoId()
  author!: string;

  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsISO8601({ strict: true })
  publishedAt?: string;
}
