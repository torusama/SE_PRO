export const envConfig = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? 'change_this_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  contractSellerName: process.env.CONTRACT_SELLER_NAME ?? 'ĐƠN VỊ QUẢN LÝ NGHĨA TRANG',
  contractSellerTaxCode: process.env.CONTRACT_SELLER_TAX_CODE ?? '',
  contractSellerAddress: process.env.CONTRACT_SELLER_ADDRESS ?? '',
  contractSellerRepresentative: process.env.CONTRACT_SELLER_REPRESENTATIVE ?? '',
  contractSellerTitle: process.env.CONTRACT_SELLER_TITLE ?? '',
});
