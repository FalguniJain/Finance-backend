import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './env';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finance Dashboard API',
      version: '1.0.0',
      description: 'Finance Data Processing and Access Control Backend. Seed credentials - Admin: admin@finance.com / Admin@123 | Analyst: analyst@finance.com / Analyst@123 | Viewer: viewer@finance.com / Viewer@123',
    },
    servers: [{ url: 'http://localhost:' + config.port + '/api', description: 'Development' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
