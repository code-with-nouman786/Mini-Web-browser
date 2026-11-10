import { Transform, type TransformFnParams } from "class-transformer";
import { IsString, Matches, MaxLength } from "class-validator";

const word = "[\\p{L}\\p{N}]+(?:['’-][\\p{L}\\p{N}]+)*";
const queryPattern = new RegExp(`^(?:${word}(?: ${word})*)?$`, "u");

export class SearchQueryDto {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : value,
  )
  @IsString()
  @MaxLength(200)
  @Matches(queryPattern, {
    message:
      "q must contain words separated by spaces; search operators are not supported",
  })
  q: string = "";
}
