import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapi } from '../openapi.js';

// Mounted at /api/docs: Swagger UI at /api/docs, the raw spec at /api/docs/openapi.json
const router = Router();
router.get('/openapi.json', (_req, res) => res.json(openapi));
router.use('/', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Sweety API docs', swaggerOptions: { persistAuthorization: false } }));

export default router;
