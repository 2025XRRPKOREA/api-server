const express = require('express')
const { authMiddleware } = require('../../../shared/middleware/auth')
const User = require('../../user/models/User')
const userIOUService = require('../../iou/services/userIOUService')
const userTradingService = require('../services/tradingService')

const router = express.Router()

// === IOU 스왑 기능 ===

// XRP → KRW 스왑
router.post('/swap/xrp-to-krw', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { xrpAmount } = req.body

    if (!xrpAmount || xrpAmount <= 0) {
      return res.status(400).json({ error: 'Valid XRP amount is required' })
    }

    const result = await userIOUService.requestXRPToIOUSwap(user.wallet.address, xrpAmount)
    res.json(result)

  } catch (error) {
    console.error('Error swapping XRP to KRW:', error)
    res.status(500).json({ error: 'Failed to swap XRP to KRW' })
  }
})

// KRW → XRP 스왑
router.post('/swap/krw-to-xrp', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { iouAmount } = req.body

    if (!iouAmount || iouAmount <= 0) {
      return res.status(400).json({ error: 'Valid IOU amount is required' })
    }

    if (!user.wallet.seed) {
      return res.status(400).json({ error: 'User wallet seed not available' })
    }

    const result = await userIOUService.requestIOUToXRPSwap(user.wallet.seed, iouAmount)
    res.json(result)

  } catch (error) {
    console.error('Error swapping KRW to XRP:', error)
    res.status(500).json({ error: 'Failed to swap KRW to XRP' })
  }
})

// 스왑 수수료 계산 (미리보기) - 동적 수수료 적용
router.post('/swap/calculate-fee', async (req, res) => {
  try {
    const { swapType, amount } = req.body

    if (!swapType || !amount || amount <= 0) {
      return res.status(400).json({ error: 'swapType and valid amount are required' })
    }

    if (!['XRP_TO_KRW', 'KRW_TO_XRP', 'IOU_TRANSFER'].includes(swapType)) {
      return res.status(400).json({ error: 'Invalid swap type' })
    }

    const result = await userIOUService.calculateSwapPreview(swapType, amount)
    res.json(result)

  } catch (error) {
    console.error('Error calculating fee:', error)
    res.status(500).json({ error: 'Failed to calculate fee' })
  }
})

// === 환율 정보 조회 ===

// XRP를 KRW로 환산
router.post('/convert/xrp-to-krw', async (req, res) => {
  try {
    const { xrpAmount } = req.body

    if (!xrpAmount || xrpAmount <= 0) {
      return res.status(400).json({ error: 'Valid XRP amount is required' })
    }

    const result = await userIOUService.convertXRPToKRW(xrpAmount)
    res.json(result)

  } catch (error) {
    console.error('Error converting XRP to KRW:', error)
    res.status(500).json({ error: 'Failed to convert XRP to KRW' })
  }
})

// KRW를 XRP로 환산
router.post('/convert/krw-to-xrp', async (req, res) => {
  try {
    const { krwAmount } = req.body

    if (!krwAmount || krwAmount <= 0) {
      return res.status(400).json({ error: 'Valid KRW amount is required' })
    }

    const result = await userIOUService.convertKRWToXRP(krwAmount)
    res.json(result)

  } catch (error) {
    console.error('Error converting KRW to XRP:', error)
    res.status(500).json({ error: 'Failed to convert KRW to XRP' })
  }
})

// === IOU 전송 기능 ===

// IOU 전송 (P2P)
router.post('/transfer', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { recipientAddress, amount, memo } = req.body

    if (!recipientAddress || !amount) {
      return res.status(400).json({ error: 'Recipient address and amount are required' })
    }

    if (!user.wallet.seed) {
      return res.status(400).json({ error: 'User wallet seed not available' })
    }

    const result = await userIOUService.transferIOU(
      user.wallet.seed,
      recipientAddress,
      amount,
      memo
    )
    res.json(result)

  } catch (error) {
    console.error('Error transferring IOU:', error)
    res.status(500).json({ error: 'Failed to transfer IOU' })
  }
})

// === 거래 기능 ===

// 오더북 조회
router.get('/orderbook', async (req, res) => {
  try {
    const { base = 'XRP', counter = 'KRW', limit = 20 } = req.query

    const result = await userTradingService.getOrderBook(base, counter, parseInt(limit))
    res.json(result)

  } catch (error) {
    console.error('Error getting order book:', error)
    res.status(500).json({ error: 'Failed to get order book' })
  }
})

// 오퍼 생성 (P2P 거래)
router.post('/offer/create', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { takerGets, takerPays, expiration } = req.body

    if (!takerGets || !takerPays) {
      return res.status(400).json({ error: 'TakerGets and TakerPays are required' })
    }

    if (!user.wallet.seed) {
      return res.status(400).json({ error: 'User wallet seed not available' })
    }

    const result = await userTradingService.createOffer(
      user.wallet.seed,
      takerGets,
      takerPays,
      expiration
    )
    res.json(result)

  } catch (error) {
    console.error('Error creating offer:', error)
    res.status(500).json({ error: 'Failed to create offer' })
  }
})

// 사용자의 활성 오퍼 조회
router.get('/offers', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { limit = 20 } = req.query

    const result = await userTradingService.getUserOffers(user.wallet.address, parseInt(limit))
    res.json(result)

  } catch (error) {
    console.error('Error getting user offers:', error)
    res.status(500).json({ error: 'Failed to get user offers' })
  }
})

// 오퍼 취소
router.post('/offer/cancel', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { offerSequence } = req.body

    if (!offerSequence) {
      return res.status(400).json({ error: 'Offer sequence is required' })
    }

    if (!user.wallet.seed) {
      return res.status(400).json({ error: 'User wallet seed not available' })
    }

    const result = await userTradingService.cancelOffer(user.wallet.seed, offerSequence)
    res.json(result)

  } catch (error) {
    console.error('Error cancelling offer:', error)
    res.status(500).json({ error: 'Failed to cancel offer' })
  }
})

// === 시장 정보 ===

// 시장 가격 조회
router.get('/market/price', async (req, res) => {
  try {
    const { base = 'XRP', counter = 'KRW' } = req.query

    const result = await userTradingService.getMarketPrice(base, counter)
    res.json(result)

  } catch (error) {
    console.error('Error getting market price:', error)
    res.status(500).json({ error: 'Failed to get market price' })
  }
})

// 거래 가능한 통화 쌍
router.get('/market/pairs', (req, res) => {
  try {
    const result = userTradingService.getTradingPairs()
    res.json(result)

  } catch (error) {
    console.error('Error getting trading pairs:', error)
    res.status(500).json({ error: 'Failed to get trading pairs' })
  }
})

// IOU 시장 정보
router.get('/market/info', async (req, res) => {
  try {
    const result = await userIOUService.getIOUMarketInfo()
    res.json(result)

  } catch (error) {
    console.error('Error getting market info:', error)
    res.status(500).json({ error: 'Failed to get market info' })
  }
})

// === 거래 내역 및 통계 ===

// IOU 거래 내역
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { limit = 10 } = req.query

    const result = await userIOUService.getIOUTransactionHistory(user.wallet.address, parseInt(limit))
    res.json(result)

  } catch (error) {
    console.error('Error getting transaction history:', error)
    res.status(500).json({ error: 'Failed to get transaction history' })
  }
})

// 거래 통계
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { period = '24h' } = req.query

    const result = await userTradingService.getTradingStats(user.wallet.address, period)
    res.json(result)

  } catch (error) {
    console.error('Error getting trading stats:', error)
    res.status(500).json({ error: 'Failed to get trading stats' })
  }
})

module.exports = router