import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CriteriaScoreDto {
  @IsString()
  @MaxLength(120)
  slug!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}

export class SubmitReviewDto {
  @IsUUID()
  sessionId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  /** Quick tags the app offers, e.g. "punctual", "calm space". */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  /** Object keys in the review bucket, uploaded separately. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsBoolean()
  recommendAgain?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CriteriaScoreDto)
  criteria?: CriteriaScoreDto[];

  /**
   * Teacher-to-customer only. Never shown to the customer, and other teachers
   * see only the resulting trust band (spec 4.3).
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  confidentialNote?: string;
}

export class EditReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  recommendAgain?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  confidentialNote?: string;
}

export class ReportReviewDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class ReplyReviewDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  text!: string;
}

export class ModerateReviewDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
