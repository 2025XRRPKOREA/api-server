const express = require('express')
const { authMiddleware } = require('../../../shared/middleware/auth')
const adminSystemService = require('../../admin/services/adminSystemService')
const ExchangeRate = require('../models/ExchangeRate')

const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: Admin-Exchange-Rate
 *   description: 환율 설정 관리 (관리자 전용)
 */

// 어드민 권한 확인 미들웨어
const adminAuthMiddleware = async (req, res, next) => {
  try {
    const isAdmin = await adminSystemService.verifyAdminPermissions(req.userId)
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' })
    }
    next()
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify admin permissions' })
  }
}

// === 환율 관리 ===

/**
 * @swagger
 * /api/admin/exchange-rate/rates:
 *   get:
 *     summary: 모든 환율 설정 조회
 *     tags: [Admin-Exchange-Rate]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: baseCurrency, schema: { type: string } }
 *       - { in: query, name: quoteCurrency, schema: { type: string } }
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *     responses:
 *       '200':
 *         description: 환율 설정 목록 조회 성공
 */
router.get('/rates', authMiddleware, adminAuthMiddleware, async (req, res) => {
  // ... (logic)
})

/**
 * @swagger
 * /api/admin/exchange-rate/current/{baseCurrency}/{quoteCurrency}:
 *   get:
 *     summary: 특정 통화쌍의 현재 활성 환율 조회
 *     tags: [Admin-Exchange-Rate]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - { in: path, name: baseCurrency, required: true, schema: { type: string } }
 *       - { in: path, name: quoteCurrency, required: true, schema: { type: string } }
 *     responses:
 *       '200':
 *         description: 현재 환율 조회 성공
 *       '404':
 *         description: 활성 환율을 찾을 수 없음
 */
router.get('/current/:baseCurrency/:quoteCurrency', authMiddleware, adminAuthMiddleware, async (req, res) => {
  // ... (logic)
})

/**
 * @swagger
 * /api/admin/exchange-rate/rates:
 *   post:
 *     summary: 새 환율 생성 (기존 활성 환율은 비활성화됨)
 *     tags: [Admin-Exchange-Rate]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExchangeRate'
 *     responses:
 *       '200':
 *         description: 환율 생성 성공
 */
router.post('/rates', authMiddleware, adminAuthMiddleware, async (req, res) => {
  // ... (logic)
})

/**
 * @swagger
 * /api/admin/exchange-rate/rates/{id}:
 *   put:
 *     summary: 환율 정보 업데이트
 *     tags: [Admin-Exchange-Rate]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExchangeRate'
 *     responses:
 *       '200':
 *         description: 환율 업데이트 성공
 *       '404':
 *         description: 환율을 찾을 수 없음
 */
router.put('/rates/:id', authMiddleware, adminAuthMiddleware, async (req, res) => {
  // ... (logic)
})

/**
 * @swagger
 * /api/admin/exchange-rate/rates/{id}/deactivate:
 *   post:
 *     summary: 환율 비활성화
 *     tags: [Admin-Exchange-Rate]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       '200':
 *         description: 환율 비활성화 성공
 *       '404':
 *         description: 환율을 찾을 수 없음
 */
router.post('/rates/:id/deactivate', authMiddleware, adminAuthMiddleware, async (req, res) => {
  // ... (logic)
})

/**
 * @swagger
 * /api/admin/exchange-rate/convert:
 *   post:
 *     summary: 환율 계산 시뮬레이션
 *     tags: [Admin-Exchange-Rate]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number }
 *               fromCurrency: { type: string }
 *               toCurrency: { type: string }
 *               rateId: { type: string, description: "(선택) 특정 환율 ID로 계산, 없으면 현재 활성 환율 사용" }
 *     responses:
 *       '200':
 *         description: 계산 성공
 *       '404':
 *         description: 환율을 찾을 수 없음
 */
router.post('/convert', authMiddleware, adminAuthMiddleware, async (req, res) => {
  // ... (logic)
})

/**
 * @swagger
 * /api/admin/exchange-rate/batch-update:
 *   post:
 *     summary: 대량 환율 설정
 *     tags: [Admin-Exchange-Rate]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rates:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/ExchangeRate' }
 *     responses:
 *       '200':
 *         description: 대량 처리 결과
 */
router.post('/batch-update', authMiddleware, adminAuthMiddleware, async (req, res) => {
  // ... (logic)
})

/**
 * @swagger
 * /api/admin/exchange-rate/stats:
 *   get:
 *     summary: 환율 통계 조회
 *     tags: [Admin-Exchange-Rate]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       '200':
 *         description: 통계 조회 성공
 */
router.get('/stats', authMiddleware, adminAuthMiddleware, async (req, res) => {
  // ... (logic)
})

module.exports = router

/**
 * @swagger
 * components:
 *   schemas:
 *     ExchangeRate:
 *       type: object
 *       properties:
 *         baseCurrency: { type: string, example: "XRP" }
 *         quoteCurrency: { type: string, example: "KRW" }
 *         rate: { type: number, example: 500.5 }
 *         spread: { type: number, example: 0.001 }
 *         source: { type: string, example: "MANUAL" }
 *         validFrom: { type: string, format: date-time }
 *         validTo: { type: string, format: date-time }
 *         isActive: { type: boolean, default: true }
 */
