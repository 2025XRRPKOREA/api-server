const express = require('express')
const { authMiddleware } = require('../../../shared/middleware/auth')
const adminIOUService = require('../services/iouService')
const adminSystemService = require('../../admin/services/adminSystemService')
const WalletService = require('../../wallet/services/legacyWalletService');
const { Client, Wallet } = require('xrpl');

const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: Admin-IOU
 *   description: IOU 발행 및 관리 (관리자 전용)
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

// === IOU 발행 관리 ===

/**
 * @swagger
 * /api/admin/iou/issue:
 *   post:
 *     summary: KRW IOU 직접 발행
 *     tags: [Admin-IOU]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userAddress, amount]
 *             properties:
 *               userAddress:
 *                 type: string
 *                 description: IOU를 받을 사용자 주소
 *               amount:
 *                 type: number
 *                 description: 발행할 IOU 수량
 *     responses:
 *       '200':
 *         description: IOU 발행 성공
 *       '403':
 *         description: 관리자 권한 없음
 */

router.post('/trust', authMiddleware, adminAuthMiddleware, async (req, res) => {
  const client = new Client("wss://s.devnet.rippletest.net:51233");
  
  try {
    await client.connect();

    const { iou, userSeed } = req.body;
    if (!iou || !userSeed) {
      return res.status(400).json({ error: 'bad request' })
    }

    const user = Wallet.fromSeed(userSeed);

    const tx = {
      TransactionType: "TrustSet",
      Account: user.address,
      LimitAmount: {
        currency: iou,
        issuer: 'rf359mcn9kH4Wvq625QhSLN59upejWe3E1',
        value: "99999999",
      }
    };
    const prepared = await client.autofill(tx);
    const signed = user.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    console.log(JSON.stringify(result, null, 2));
    return res.status(200).json({success: true});
  } catch (error) {
    console.error('trust error', error)
    return res.status(500).json({ error: 'trust error' })
  } finally {
    await client.disconnect();
  }
})

router.post('/issue', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { userAddress, amount } = req.body

    if (!userAddress || !amount) {
      return res.status(400).json({ error: 'User address and amount are required' })
    }

    const result = await adminIOUService.issueKRW(userAddress, amount)
    res.json(result)

  } catch (error) {
    console.error('Error issuing KRW:', error)
    res.status(500).json({ error: 'Failed to issue KRW' })
  }
})

/**
 * @swagger
 * /api/admin/iou/process-swap:
 *   post:
 *     summary: 외부 스왑 처리 후 IOU 발행
 *     tags: [Admin-IOU]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userAddress, swapAmount]
 *             properties:
 *               userAddress:
 *                 type: string
 *               swapAmount:
 *                 type: number
 *               swapDetails:
 *                 type: object
 *     responses:
 *       '200':
 *         description: 스왑 처리 및 IOU 발행 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.post('/process-swap', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { userAddress, swapAmount, swapDetails = {} } = req.body

    if (!userAddress || !swapAmount) {
      return res.status(400).json({ error: 'User address and swap amount are required' })
    }

    const result = await adminIOUService.processSwapAndIssueKRW(
      userAddress,
      swapAmount,
      {
        ...swapDetails,
        processedBy: req.userId,
        timestamp: new Date().toISOString()
      }
    )
    res.json(result)

  } catch (error) {
    console.error('Error processing swap:', error)
    res.status(500).json({ error: 'Failed to process swap' })
  }
})

// === 발행 통계 및 관리 ===

/**
 * @swagger
 * /api/admin/iou/total-issued:
 *   get:
 *     summary: 총 발행된 IOU 수량 조회
 *     tags: [Admin-IOU]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 총 발행량 조회 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.get('/total-issued', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const result = await adminIOUService.getTotalIssuedAmount()
    res.json(result)

  } catch (error) {
    console.error('Error getting total issued amount:', error)
    res.status(500).json({ error: 'Failed to get total issued amount' })
  }
})

/**
 * @swagger
 * /api/admin/iou/settings:
 *   get:
 *     summary: IOU 설정 정보 조회
 *     tags: [Admin-IOU]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 설정 정보 조회 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.get('/settings', authMiddleware, adminAuthMiddleware, (req, res) => {
  try {
    const settings = adminIOUService.getSettings()
    res.json({
      success: true,
      settings: settings
    })

  } catch (error) {
    console.error('Error getting IOU settings:', error)
    res.status(500).json({ error: 'Failed to get IOU settings' })
  }
})

/**
 * @swagger
 * /api/admin/iou/calculate-fee:
 *   post:
 *     summary: 수수료 계산 (관리자용)
 *     tags: [Admin-IOU]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       '200':
 *         description: 수수료 계산 성공
 *       '403':
 *         description: 관리자 권한 없음
 */
router.post('/calculate-fee', authMiddleware, adminAuthMiddleware, (req, res) => {
  try {
    const { amount } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' })
    }

    const calculation = adminIOUService.calculateSwapFee(amount)
    res.json({
      success: true,
      calculation: calculation
    })

  } catch (error) {
    console.error('Error calculating fee:', error)
    res.status(500).json({ error: 'Failed to calculate fee' })
  }
})

// === 대량 처리 기능 ===

/**
 * @swagger
 * /api/admin/iou/batch-issue:
 *   post:
 *     summary: 대량 IOU 발행
 *     tags: [Admin-IOU]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transactions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userAddress: { type: string }
 *                     amount: { type: number }
 *     responses:
 *       '200':
 *         description: 대량 발행 처리 결과
 *       '403':
 *         description: 관리자 권한 없음
 */
router.post('/batch-issue', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { transactions } = req.body

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Transactions array is required' })
    }

    if (transactions.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 transactions per batch' })
    }

    const results = []

    for (const tx of transactions) {
      if (!tx.userAddress || !tx.amount) {
        results.push({
          userAddress: tx.userAddress,
          success: false,
          error: 'Missing userAddress or amount'
        })
        continue
      }

      const result = await adminIOUService.issueKRW(tx.userAddress, tx.amount)
      results.push({
        userAddress: tx.userAddress,
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
    console.error('Error in batch issue:', error)
    res.status(500).json({ error: 'Failed to process batch issue' })
  }
})

/**
 * @swagger
 * /api/admin/iou/batch-process-swap:
 *   post:
 *     summary: 대량 스왑 처리
 *     tags: [Admin-IOU]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               swaps:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userAddress: { type: string }
 *                     swapAmount: { type: number }
 *                     swapDetails: { type: object }
 *     responses:
 *       '200':
 *         description: 대량 스왑 처리 결과
 *       '403':
 *         description: 관리자 권한 없음
 */
router.post('/batch-process-swap', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { swaps } = req.body

    if (!Array.isArray(swaps) || swaps.length === 0) {
      return res.status(400).json({ error: 'Swaps array is required' })
    }

    if (swaps.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 swaps per batch' })
    }

    const results = []

    for (const swap of swaps) {
      if (!swap.userAddress || !swap.swapAmount) {
        results.push({
          userAddress: swap.userAddress,
          success: false,
          error: 'Missing userAddress or swapAmount'
        })
        continue
      }

      const result = await adminIOUService.processSwapAndIssueKRW(
        swap.userAddress,
        swap.swapAmount,
        {
          ...swap.swapDetails,
          batchProcessed: true,
          processedBy: req.userId,
          timestamp: new Date().toISOString()
        }
      )
      results.push({
        userAddress: swap.userAddress,
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
    console.error('Error in batch swap processing:', error)
    res.status(500).json({ error: 'Failed to process batch swaps' })
  }
})

module.exports = router
