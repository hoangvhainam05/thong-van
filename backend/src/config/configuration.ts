export default () => ({
  port: Number.parseInt(process.env.PORT || '8000', 10),
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number.parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'thongvan',
    password: process.env.DB_PASSWORD || 'thongvan',
    name: process.env.DB_DATABASE || 'thongvan',
  },
  warranty: { contact: process.env.WARRANTY_CONTACT || '' },
  shipping: {
    fee: Number.parseInt(process.env.SHIPPING_FEE || '150000', 10),
    freeFrom: Number.parseInt(process.env.FREE_SHIP_FROM || '5000000', 10),
  },
  payment: {
    bankName: process.env.BANK_NAME || '',
    accountName: process.env.BANK_ACCOUNT_NAME || '',
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || '',
    transferContentPrefix: process.env.BANK_TRANSFER_CONTENT_PREFIX || 'THONGVAN',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    productsFolder: process.env.CLOUDINARY_PRODUCTS_FOLDER || 'thong-van/products',
  },
  corsOrigins: process.env.CORS_ORIGINS === '*'
    ? true
    : (process.env.CORS_ORIGINS || 'http://localhost:3000')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
  optimization: {
    orsApiKey: process.env.ORS_API_KEY || '',
    dayStart: process.env.DELIVERY_DAY_START || '08:00',
    dayEnd: process.env.DELIVERY_DAY_END || '18:00',
    avgSpeedKmh: Number.parseFloat(process.env.AVG_SPEED_KMH || '30'),
    roadFactor: Number.parseFloat(process.env.ROAD_FACTOR || '1.35'),
    weightKm: Number.parseFloat(process.env.WEIGHT_KM || '1.0'),
    weightTime: Number.parseFloat(process.env.WEIGHT_TIME || '0.5'),
  },
});
