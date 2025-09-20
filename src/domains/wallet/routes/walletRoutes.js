const express = require('express')
const { authMiddleware } = require('../../../shared/middleware/auth')
const User = require('../../user/models/User')
const userWalletService = require('../services/walletService')
const userIOUService = require('../../iou/services/userIOUService')
const adminDomainService = require('../../domain/services/domainService')

const router = express.Router()

// === 기본 지갑 기능 ===

// XRP 잔액 조회
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const result = await userWalletService.getXRPBalance(user.wallet.address)

    if (result.success) {
      res.json({
        address: user.wallet.address,
        balance: result.balance,
        balanceXRP: (parseInt(result.balance) / 1000000).toFixed(6) // Convert drops to XRP
      })
    } else {
      res.status(500).json({ error: result.error })
    }

  } catch (error) {
    console.error('Error fetching balance:', error)
    res.status(500).json({ error: 'Failed to fetch balance' })
  }
})

// 계정 정보 조회
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

// XRP 주소 유효성 검증
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

// KRW Trust Line 생성
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

// KRW 잔액 조회
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

// 모든 Trust Line 조회
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

// 지갑 요약 정보
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

// Trust Line 권한 확인
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

// IOU 거래 가능 여부 확인
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