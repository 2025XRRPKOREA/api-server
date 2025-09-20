const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'XRP IOU Server API',
      version: '1.0.0',
      description: 'XRP 지갑 관리 및 KRW IOU 거래 시스템 API 문서',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/domains/**/routes/*.js'], // API 스펙이 명시된 파일 경로
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
