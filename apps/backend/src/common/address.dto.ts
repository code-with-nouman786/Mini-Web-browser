import { Transform, type TransformFnParams } from "class-transformer";
import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";
import { normalizeAddress } from "./normalize-address";

export class AddressDto {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === "string" ? normalizeAddress(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @Matches(/^(?!.*:\/\/)\S+$/, {
    message: "address must not contain whitespace or an unsupported URL scheme",
  })
  address!: string;
}
