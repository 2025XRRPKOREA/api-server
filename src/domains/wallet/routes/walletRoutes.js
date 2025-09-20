const express = require('express')
const { authMiddleware } = require('../../../shared/middleware/auth')
const User = require('../../user/models/User')
const userWalletService = require('../services/walletService')
const userIOUService = require('../../iou/services/userIOUService')
const adminDomainService = require('../../domain/services/domainService')
const { Client, Wallet } = require('xrpl');
const ExchangeRate = require('../../swap/models/ExchangeRate')

const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: 지갑 관리 (XRP 및 IOU)
 */

// === 기본 지갑 기능 ===

/**
 * @swagger
 * /api/wallet/balance:
 *   get:
 *     summary: XRP 잔액 조회
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 성공적으로 XRP 잔액을 조회함
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 address: 
 *                   type: string
 *                 balance: 
 *                   type: string
 *                 balanceXRP:
 *                   type: string
 *       '404':
 *         description: 사용자를 찾을 수 없음
 *       '500':
 *         description: 서버 오류
 */
router.get('/balance', authMiddleware, async (req, res) => {
  const client = new Client("wss://s.devnet.rippletest.net:51233");
  
  try {
    await client.connect();

    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    const response = {};
    response['address'] = user.wallet.address;
    const xrp = await client.getXrpBalance(user.wallet.address)
    response['XRP'] = xrp;
    const line = await client.request({ command: "account_lines", account: user.wallet.address })

    for (let i = 0; i < line.result.lines.length; i++) {
      const lineItem = line.result.lines[i];
      const latestRecord = await ExchangeRate.findOne({ quoteCurrency: lineItem['currency'] })
        .sort({ createdAt: -1 }) 
        .exec();
      if(latestRecord){  
        response[lineItem['currency']] = lineItem['balance'] * latestRecord.rate;
      }
    }

    return res.json(response)
  } catch (error) {
    console.error('Error fetching balance:', error)
    return res.status(500).json({ error: 'Failed to fetch balance' }) 
  } finally {
    await client.disconnect();
  }
})

/**
 * @swagger
 * /api/wallet/account:
 *   get:
 *     summary: XRP 계정 정보 조회
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 성공적으로 계정 정보를 조회함
 *       '404':
 *         description: 사용자를 찾을 수 없음
 *       '500':
 *         description: 서버 오류
 */
router.get('/account', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const result = await userWalletService.getAccountInfo(user.wallet.address)

    if (result.success && result.accountInfo) {
      res.json({
        address: user.wallet.address,
        activated: true,
        balance: result.accountInfo.Balance,
        balanceXRP: (parseInt(result.accountInfo.Balance) / 1000000).toFixed(6),
        sequence: result.accountInfo.Sequence,
        ownerCount: result.accountInfo.OwnerCount,
        previousTxnID: result.accountInfo.PreviousTxnID
      })
    } else {
      res.json({
        address: user.wallet.address,
        activated: false,
        message: 'Account not yet activated on XRPL network'
      })
    }

  } catch (error) {
    console.error('Error fetching account info:', error)
    res.status(500).json({ error: 'Failed to fetch account information' })
  }
})

/**
 * @swagger
 * /api/wallet/validate-address:
 *   post:
 *     summary: XRP 주소 유효성 검증
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *                 description: 검증할 XRP 주소
 *     responses:
 *       '200':
 *         description: 유효성 검증 결과
 *       '400':
 *         description: 주소 누락
 */
router.post('/validate-address', (req, res) => {
  try {
    const { address } = req.body

    if (!address) {
      return res.status(400).json({ error: 'Address is required' })
    }

    const result = userWalletService.validateAddress(address)
    res.json(result)

  } catch (error) {
    console.error('Error validating address:', error)
    res.status(500).json({ error: 'Failed to validate address' })
  }
})

// === KRW IOU 기능 ===

/**
 * @swagger
 * /api/wallet/krw/create-trustline:
 *   post:
 *     summary: KRW IOU Trust Line 생성
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limitAmount:
 *                 type: string
 *                 description: 설정할 Trust Line 한도 (기본값 1,000,000)
 *                 default: "1000000"
 *     responses:
 *       '200':
 *         description: Trust Line 생성 성공 또는 이미 존재함
 *       '400':
 *         description: 지갑 시드 없음
 *       '404':
 *         description: 사용자를 찾을 수 없음
 */
router.post('/krw/create-trustline', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { limitAmount = "1000000" } = req.body

    if (!user.wallet.seed) {
      return res.status(400).json({ error: 'User wallet seed not available' })
    }

    // 사용자를 자동으로 화이트리스트에 추가 (자동 승인이 활성화된 경우)
    try {
      await adminDomainService.autoAddUserToWhitelist(req.userId)
    } catch (autoAddError) {
      console.log('Auto-add to whitelist failed (may not be enabled):', autoAddError.message)
    }

    const result = await userWalletService.createKRWTrustLine(user.wallet.seed, limitAmount)
    res.json(result)

  } catch (error) {
    console.error('Error creating KRW trust line:', error)
    res.status(500).json({ error: 'Failed to create KRW trust line' })
  }
})

/**
 * @swagger
 * /api/wallet/krw/balance:
 *   get:
 *     summary: KRW IOU 잔액 조회
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 성공적으로 KRW IOU 잔액을 조회함
 *       '404':
 *         description: 사용자를 찾을 수 없음
 */
router.get('/krw/balance', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const result = await userWalletService.getKRWBalance(user.wallet.address)
    res.json(result)

  } catch (error) {
    console.error('Error fetching KRW balance:', error)
    res.status(500).json({ error: 'Failed to fetch KRW balance' })
  }
})

/**
 * @swagger
 * /api/wallet/trustlines:
 *   get:
 *     summary: 모든 Trust Line 조회
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 성공적으로 모든 Trust Line을 조회함
 *       '404':
 *         description: 사용자를 찾을 수 없음
 */
router.get('/trustlines', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const result = await userWalletService.getAllTrustLines(user.wallet.address)
    res.json(result)

  } catch (error) {
    console.error('Error fetching trust lines:', error)
    res.status(500).json({ error: 'Failed to fetch trust lines' })
  }
})

/**
 * @swagger
 * /api/wallet/summary:
 *   get:
 *     summary: 지갑 요약 정보 조회 (XRP 및 IOU 잔액 포함)
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 성공적으로 지갑 요약 정보를 조회함
 *       '404':
 *         description: 사용자를 찾을 수 없음
 */
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const result = await userWalletService.getWalletSummary(user.wallet.address)
    res.json(result)

  } catch (error) {
    console.error('Error fetching wallet summary:', error)
    res.status(500).json({ error: 'Failed to fetch wallet summary' })
  }
})

/**
 * @swagger
 * /api/wallet/krw/check-permission:
 *   get:
 *     summary: KRW IOU Trust Line 권한 확인
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 성공적으로 권한 상태를 조회함
 *       '404':
 *         description: 사용자를 찾을 수 없음
 */
router.get('/krw/check-permission', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const result = await userWalletService.checkTrustLinePermission(user.wallet.address)
    res.json(result)

  } catch (error) {
    console.error('Error checking permission:', error)
    res.status(500).json({ error: 'Failed to check permission' })
  }
})

/**
 * @swagger
 * /api/wallet/krw/can-trade:
 *   get:
 *     summary: KRW IOU 거래 가능 여부 확인
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 성공적으로 거래 가능 여부를 조회함
 *       '404':
 *         description: 사용자를 찾을 수 없음
 */
router.get('/krw/can-trade', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const result = await userIOUService.canTradeIOU(user.wallet.address)
    res.json(result)

  } catch (error) {
    console.error('Error checking trade capability:', error)
    res.status(500).json({ error: 'Failed to check trade capability' })
  }
})

module.exports = router
