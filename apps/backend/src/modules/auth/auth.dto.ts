import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
export class RegisterDto {
  @IsString() @MinLength(2) fullName!: string;
  @IsEmail() email!: string;
  @IsString() @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/) password!: string;
  @IsOptional() @IsString() phone?: string;
}
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
export class TokenDto {
  @IsString() token!: string;
}
export class ForgotPasswordDto {
  @IsEmail() email!: string;
}
export class ResetPasswordDto extends TokenDto {
  @IsString() @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/) password!: string;
}
export class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/) newPassword!: string;
  @IsString() newPasswordConfirmation!: string;
}
