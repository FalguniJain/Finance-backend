import dotenv from 'dotenv';
dotenv.config();

const getEnv = (key, fallback) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) throw new Error('Missing env var: ' + key);
  return value;
};

export const config = {
  env: getEnv('NODE_ENV', 'development'),
  port: parseInt(getEnv('PORT', '3000'), 10),
  isDev: getEnv('NODE_ENV', 'development') === 'development',
  database: { url: getEnv('DATABASE_URL') },
  jwt: {
    secret: getEnv('JWT_SECRET', 'dev_secret_32chars_change_in_prod!'),
    expiresIn: getEnv('JWT_EXPIRES_IN', '15m'),
    refreshSecret: getEnv('JWT_REFRESH_SECRET', 'dev_refresh_32chars_change_prod!'),
    refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },
  rateLimit: {
    windowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(getEnv('RATE_LIMIT_MAX', '100'), 10),
  },
} as const;
