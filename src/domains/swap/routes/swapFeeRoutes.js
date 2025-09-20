import express from 'express'
import { authMiddleware } from '../../../shared/middleware/auth.js'
import adminSystemService from '../../admin/services/adminSystemService.js'
import SwapFeeConfig from '../models/SwapFeeConfig.js'

const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: Admin-Swap-Config
 *   description: 동적 스왑 수수료 설정 관리 (관리자 전용)
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

// === 스왑 수수료 설정 관리 ===

/**
 * @swagger
 * /api/admin/swap-fee/configs:
 *   get:
 *     summary: 모든 수수료 설정 조회
 *     tags: [Admin-Swap-Config]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: swapType, schema: { type: string, enum: ['XRP_TO_KRW', 'KRW_TO_XRP', 'IOU_TRANSFER'] } }
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *     responses:
 *       '200':
 *         description: 수수료 설정 목록 조회 성공
 */
router.get('/configs', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, swapType, isActive } = req.query

    const filter = {}
    if (swapType) filter.swapType = swapType
    if (isActive !== undefined) filter.isActive = isActive === 'true'

    const configs = await SwapFeeConfig.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))

    const total = await SwapFeeConfig.countDocuments(filter)

    res.json({
      success: true,
      configs: configs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })

  } catch (error) {
    console.error('Error getting swap fee configs:', error)
    res.status(500).json({ error: 'Failed to get swap fee configs' })
  }
})

/**
 * @swagger
 * /api/admin/swap-fee/configs/{id}:
 *   get:
 *     summary: 특정 수수료 설정 조회
 *     tags: [Admin-Swap-Config]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       '200':
 *         description: 수수료 설정 조회 성공
 *       '404':
 *         description: 설정을 찾을 수 없음
 */
router.get('/configs/:id', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const config = await SwapFeeConfig.findById(req.params.id)

    if (!config) {
      return res.status(404).json({ error: 'Swap fee config not found' })
    }

    res.json({
      success: true,
      config: config
    })

  } catch (error) {
    console.error('Error getting swap fee config:', error)
    res.status(500).json({ error: 'Failed to get swap fee config' })
  }
})

/**
 * @swagger
 * /api/admin/swap-fee/current/{swapType}:
 *   get:
 *     summary: 현재 활성화된 수수료 설정 조회
 *     tags: [Admin-Swap-Config]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - { in: path, name: swapType, required: true, schema: { type: string, enum: ['XRP_TO_KRW', 'KRW_TO_XRP', 'IOU_TRANSFER'] } }
 *     responses:
 *       '200':
 *         description: 현재 활성 설정 조회 성공
 *       '404':
 *         description: 활성 설정을 찾을 수 없음
 */
router.get('/current/:swapType', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { swapType } = req.params

    if (!['XRP_TO_KRW', 'KRW_TO_XRP', 'IOU_TRANSFER'].includes(swapType)) {
      return res.status(400).json({ error: 'Invalid swap type' })
    }

    const config = await SwapFeeConfig.getCurrentFeeConfig(swapType)

    if (!config) {
      return res.status(404).json({ error: 'No active fee config found for this swap type' })
    }

    res.json({
      success: true,
      config: config
    })

  } catch (error) {
    console.error('Error getting current fee config:', error)
    res.status(500).json({ error: 'Failed to get current fee config' })
  }
})

/**
 * @swagger
 * /api/admin/swap-fee/configs:
 *   post:
 *     summary: 새 수수료 설정 생성
 *     tags: [Admin-Swap-Config]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SwapFeeConfig'
 *     responses:
 *       '200':
 *         description: 설정 생성 성공
 */
router.post('/configs', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const {
      swapType,
      feeType,
      baseFee,
      minFee,
      maxFee,
      tieredRates,
      effectiveFrom,
      effectiveTo,
      description
    } = req.body

    // ... (validation logic)

    const configData = {
      swapType,
      feeType,
      baseFee,
      minFee: minFee || 0,
      maxFee: maxFee || null,
      tieredRates: tieredRates || [],
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      description: description || '',
      createdBy: `admin_${req.userId}`
    }

    const config = new SwapFeeConfig(configData)
    await config.save()

    res.json({
      success: true,
      message: 'Swap fee config created successfully',
      config: config
    })

  } catch (error) {
    console.error('Error creating swap fee config:', error)
    res.status(500).json({ error: 'Failed to create swap fee config' })
  }
})

/**
 * @swagger
 * /api/admin/swap-fee/configs/{id}:
 *   put:
 *     summary: 수수료 설정 업데이트
 *     tags: [Admin-Swap-Config]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SwapFeeConfig'
 *     responses:
 *       '200':
 *         description: 설정 업데이트 성공
 *       '404':
 *         description: 설정을 찾을 수 없음
 */
router.put('/configs/:id', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const {
      feeType,
      baseFee,
      minFee,
      maxFee,
      tieredRates,
      effectiveFrom,
      effectiveTo,
      description,
      isActive
    } = req.body

    const config = await SwapFeeConfig.findById(req.params.id)
    if (!config) {
      return res.status(404).json({ error: 'Swap fee config not found' })
    }

    // ... (update logic)

    await config.save()

    res.json({
      success: true,
      message: 'Swap fee config updated successfully',
      config: config
    })

  } catch (error) {
    console.error('Error updating swap fee config:', error)
    res.status(500).json({ error: 'Failed to update swap fee config' })
  }
})

/**
 * @swagger
 * /api/admin/swap-fee/configs/{id}/deactivate:
 *   post:
 *     summary: 수수료 설정 비활성화
 *     tags: [Admin-Swap-Config]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       '200':
 *         description: 설정 비활성화 성공
 *       '404':
 *         description: 설정을 찾을 수 없음
 */
router.post('/configs/:id/deactivate', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const config = await SwapFeeConfig.findById(req.params.id)
    if (!config) {
      return res.status(404).json({ error: 'Swap fee config not found' })
    }

    config.isActive = false
    await config.save()

    res.json({
      success: true,
      message: 'Swap fee config deactivated successfully'
    })

  } catch (error) {
    console.error('Error deactivating swap fee config:', error)
    res.status(500).json({ error: 'Failed to deactivate swap fee config' })
  }
})

/**
 * @swagger
 * /api/admin/swap-fee/calculate:
 *   post:
 *     summary: 수수료 계산 시뮬레이션
 *     tags: [Admin-Swap-Config]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               swapType: { type: string, enum: ['XRP_TO_KRW', 'KRW_TO_XRP', 'IOU_TRANSFER'] }
 *               amount: { type: number }
 *               configId: { type: string, description: "(선택) 특정 설정 ID로 계산, 없으면 현재 활성 설정 사용" }
 *     responses:
 *       '200':
 *         description: 계산 성공
 *       '404':
 *         description: 설정을 찾을 수 없음
 */
router.post('/calculate', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { swapType, amount, configId } = req.body

    if (!swapType || !amount || amount <= 0) {
      return res.status(400).json({ error: 'swapType and valid amount are required' })
    }

    let config
    if (configId) {
      config = await SwapFeeConfig.findById(configId)
    } else {
      config = await SwapFeeConfig.getCurrentFeeConfig(swapType)
    }

    if (!config) {
      return res.status(404).json({ error: 'No fee config found' })
    }

    const calculation = config.calculateFee(amount)

    res.json({
      success: true,
      calculation: calculation,
      config: {
        id: config._id,
        swapType: config.swapType,
        feeType: config.feeType,
        baseFee: config.baseFee
      }
    })

  } catch (error) {
    console.error('Error calculating fee:', error)
    res.status(500).json({ error: 'Failed to calculate fee' })
  }
})

/**
 * @swagger
 * /api/admin/swap-fee/batch-create:
 *   post:
 *     summary: 대량 수수료 설정 생성
 *     tags: [Admin-Swap-Config]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               configs:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/SwapFeeConfig' }
 *     responses:
 *       '200':
 *         description: 대량 생성 처리 결과
 */
router.post('/batch-create', authMiddleware, adminAuthMiddleware, async (req, res) => {
  // ... (batch create logic)
})

/**
 * @swagger
 * /api/admin/swap-fee/stats:
 *   get:
 *     summary: 수수료 설정 통계 조회
 *     tags: [Admin-Swap-Config]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       '200':
 *         description: 통계 조회 성공
 */
router.get('/stats', authMiddleware, adminAuthMiddleware, async (req, res) => {
  // ... (stats aggregation logic)
})

export default router

/**
 * @swagger
 * components:
 *   schemas:
 *     SwapFeeConfig:
 *       type: object
 *       properties:
 *         swapType: { type: string, enum: ['XRP_TO_KRW', 'KRW_TO_XRP', 'IOU_TRANSFER'] }
 *         feeType: { type: string, enum: ['PERCENTAGE', 'FIXED', 'TIERED'] }
 *         baseFee: { type: number, description: "PERCENTAGE: 0.003 (0.3%), FIXED: 10 (10 KRW)" }
 *         minFee: { type: number }
 *         maxFee: { type: number }
 *         tieredRates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               threshold: { type: number }
 *               fee: { type: number }
 *         effectiveFrom: { type: string, format: date-time }
 *         effectiveTo: { type: string, format: date-time }
 *         isActive: { type: boolean, default: true }
 *         description: { type: string }
 */
