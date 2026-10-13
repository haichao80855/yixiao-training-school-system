export class UpdateCompanyDto {
  name?: string;
  stockCode?: string;
  legalPerson?: string;
  phone?: string;
  validUntil?: string;
  logoUrl?: string;
  faviconUrl?: string;
  reportLogoUrl?: string;
  status?: string;
}

export class TransferAdminDto {
  targetUserId: string;
  password: string;
}
