const express = require('express')
const { authMiddleware } = require('../../../shared/middleware/auth')
const adminDomainService = require('../services/domainService')
const adminSystemService = require('../../admin/services/adminSystemService')

const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: Admin-Domain
 *   description: Permissioned Domain 관리 (관리자 전용)
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

// === Domain 설정 관리 ===

/**
 * @swagger
 * /api/admin/domain/settings:
 *   get:
 *     summary: Domain 설정 조회
 *     tags: [Admin-Domain]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       '200':
 *         description: Domain 설정 조회 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.get('/settings', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const result = await adminDomainService.getDomainSettings()
    res.json(result)

  } catch (error) {
    console.error('Error getting domain settings:', error)
    res.status(500).json({ error: 'Failed to get domain settings' })
  }
})

/**
 * @swagger
 * /api/admin/domain/settings:
 *   put:
 *     summary: Domain 설정 업데이트
 *     tags: [Admin-Domain]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               autoWhitelist: { type: boolean }
 *               domainType: { type: string, enum: ['whitelist', 'blacklist', 'open'] }
 *     responses:
 *       '200':
 *         description: Domain 설정 업데이트 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.put('/settings', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const settings = req.body

    const result = await adminDomainService.updateDomainSettings(settings)
    res.json(result)

  } catch (error) {
    console.error('Error updating domain settings:', error)
    res.status(500).json({ error: 'Failed to update domain settings' })
  }
})

// === 화이트리스트 관리 ===

/**
 * @swagger
 * /api/admin/domain/whitelist/add:
 *   post:
 *     summary: 화이트리스트에 사용자 추가
 *     tags: [Admin-Domain]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userAddress]
 *             properties:
 *               userAddress: { type: string }
 *               email: { type: string }
 *     responses:
 *       '200':
 *         description: 화이트리스트 추가 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.post('/whitelist/add', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { userAddress, email } = req.body

    if (!userAddress) {
      return res.status(400).json({ error: 'User address is required' })
    }

    const result = await adminDomainService.addToWhitelist(
      userAddress,
      email,
      `admin_${req.userId}`
    )
    res.json(result)

  } catch (error) {
    console.error('Error adding to whitelist:', error)
    res.status(500).json({ error: 'Failed to add to whitelist' })
  }
})

/**
 * @swagger
 * /api/admin/domain/whitelist:
 *   get:
 *     summary: 화이트리스트 목록 조회
 *     tags: [Admin-Domain]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       '200':
 *         description: 화이트리스트 조회 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.get('/whitelist', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query

    const result = await adminDomainService.getAllowedAccounts(
      parseInt(page),
      parseInt(limit)
    )
    res.json(result)

  } catch (error) {
    console.error('Error getting allowed accounts:', error)
    res.status(500).json({ error: 'Failed to get allowed accounts' })
  }
})

// === 블랙리스트 관리 ===

/**
 * @swagger
 * /api/admin/domain/blacklist/add:
 *   post:
 *     summary: 블랙리스트에 사용자 추가
 *     tags: [Admin-Domain]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userAddress]
 *             properties:
 *               userAddress: { type: string }
 *               reason: { type: string }
 *     responses:
 *       '200':
 *         description: 블랙리스트 추가 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.post('/blacklist/add', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { userAddress, reason } = req.body

    if (!userAddress) {
      return res.status(400).json({ error: 'User address is required' })
    }

    const result = await adminDomainService.addToBlacklist(
      userAddress,
      reason || 'Administrative action',
      `admin_${req.userId}`
    )
    res.json(result)

  } catch (error) {
    console.error('Error adding to blacklist:', error)
    res.status(500).json({ error: 'Failed to add to blacklist' })
  }
})

/**
 * @swagger
 * /api/admin/domain/blacklist:
 *   get:
 *     summary: 블랙리스트 목록 조회
 *     tags: [Admin-Domain]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       '200':
 *         description: 블랙리스트 조회 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.get('/blacklist', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query

    const result = await adminDomainService.getBlockedAccounts(
      parseInt(page),
      parseInt(limit)
    )
    res.json(result)

  } catch (error) {
    console.error('Error getting blocked accounts:', error)
    res.status(500).json({ error: 'Failed to get blocked accounts' })
  }
})

// === KYC 관리 ===

/**
 * @swagger
 * /api/admin/domain/kyc/update:
 *   post:
 *     summary: 사용자의 KYC 상태 업데이트
 *     tags: [Admin-Domain]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userAddress, status]
 *             properties:
 *               userAddress: { type: string }
 *               status: { type: string, enum: ['pending', 'verified', 'rejected'] }
 *     responses:
 *       '200':
 *         description: KYC 상태 업데이트 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.post('/kyc/update', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { userAddress, status } = req.body

    if (!userAddress || !status) {
      return res.status(400).json({ error: 'User address and status are required' })
    }

    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid KYC status' })
    }

    const result = await adminDomainService.updateKYCStatus(userAddress, status)
    res.json(result)

  } catch (error) {
    console.error('Error updating KYC status:', error)
    res.status(500).json({ error: 'Failed to update KYC status' })
  }
})

// === 권한 확인 ===

/**
 * @swagger
 * /api/admin/domain/check-permission:
 *   post:
 *     summary: 특정 사용자의 Trust Line 권한 확인
 *     tags: [Admin-Domain]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userAddress]
 *             properties:
 *               userAddress: { type: string }
 *     responses:
 *       '200':
 *         description: 권한 확인 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.post('/check-permission', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { userAddress } = req.body

    if (!userAddress) {
      return res.status(400).json({ error: 'User address is required' })
    }

    const result = await adminDomainService.checkTrustLinePermission(userAddress)
    res.json({
      success: true,
      permission: result
    })

  } catch (error) {
    console.error('Error checking permission:', error)
    res.status(500).json({ error: 'Failed to check permission' })
  }
})

// === 대량 관리 기능 ===

/**
 * @swagger
 * /api/admin/domain/whitelist/batch-add:
 *   post:
 *     summary: 대량 화이트리스트 추가
 *     tags: [Admin-Domain]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               users:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userAddress: { type: string }
 *                     email: { type: string }
 *     responses:
 *       '200':
 *         description: 대량 처리 결과
 *       '403':
 *         description: 관리자 권한 없음
 */
router.post('/whitelist/batch-add', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { users } = req.body

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'Users array is required' })
    }

    if (users.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 users per batch' })
    }

    const results = []

    for (const user of users) {
      if (!user.userAddress) {
        results.push({
          userAddress: user.userAddress,
          success: false,
          error: 'Missing userAddress'
        })
        continue
      }

      const result = await adminDomainService.addToWhitelist(
        user.userAddress,
        user.email,
        `admin_${req.userId}_batch`
      )
      results.push({
        userAddress: user.userAddress,
        ...result
      })
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    res.json({
      success: true,
      batchResults: {
        total: results.length,
        success: successCount,
        failures: failureCount,
        results: results
      }
    })

  } catch (error) {
    console.error('Error in batch whitelist add:', error)
    res.status(500).json({ error: 'Failed to process batch whitelist addition' })
  }
})

/**
 * @swagger
 * /api/admin/domain/kyc/batch-update:
 *   post:
 *     summary: 대량 KYC 상태 업데이트
 *     tags: [Admin-Domain]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userAddress: { type: string }
 *                     status: { type: string, enum: ['pending', 'verified', 'rejected'] }
 *     responses:
 *       '200':
 *         description: 대량 처리 결과
 *       '403':
 *         description: 관리자 권한 없음
 */
router.post('/kyc/batch-update', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { updates } = req.body

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Updates array is required' })
    }

    if (updates.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 updates per batch' })
    }

    const results = []

    for (const update of updates) {
      if (!update.userAddress || !update.status) {
        results.push({
          userAddress: update.userAddress,
          success: false,
          error: 'Missing userAddress or status'
        })
        continue
      }

      if (!['pending', 'verified', 'rejected'].includes(update.status)) {
        results.push({
          userAddress: update.userAddress,
          success: false,
          error: 'Invalid KYC status'
        })
        continue
      }

      const result = await adminDomainService.updateKYCStatus(update.userAddress, update.status)
      results.push({
        userAddress: update.userAddress,
        ...result
      })
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    res.json({
      success: true,
      batchResults: {
        total: results.length,
        success: successCount,
        failures: failureCount,
        results: results
      }
    })

  } catch (error) {
    console.error('Error in batch KYC update:', error)
    res.status(500).json({ error: 'Failed to process batch KYC updates' })
  }
})

// === Domain 통계 ===

/**
 * @swagger
 * /api/admin/domain/stats:
 *   get:
 *     summary: Domain 통계 정보 조회
 *     tags: [Admin-Domain]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       '200':
 *         description: 통계 조회 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.get('/stats', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const [domainSettings, allowedAccounts, blockedAccounts] = await Promise.all([
      adminDomainService.getDomainSettings(),
      adminDomainService.getAllowedAccounts(1, 1), // 총 개수만 확인
      adminDomainService.getBlockedAccounts(1, 1)   // 총 개수만 확인
    ])

    res.json({
      success: true,
      stats: {
        domainActive: domainSettings.success,
        domainType: domainSettings.success ? domainSettings.domainType : null,
        totalAllowedAccounts: allowedAccounts.success ? allowedAccounts.total : 0,
        totalBlockedAccounts: blockedAccounts.success ? blockedAccounts.total : 0,
        settings: domainSettings.success ? domainSettings.settings : null
      }
    })

  } catch (error) {
    console.error('Error getting domain stats:', error)
    res.status(500).json({ error: 'Failed to get domain stats' })
  }
})

module.exports = router
