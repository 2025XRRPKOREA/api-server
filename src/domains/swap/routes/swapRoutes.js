import express from 'express'
import { authMiddleware } from '../../../shared/middleware/auth.js'
import User from '../../user/models/User.js'
import userIOUService from '../../iou/services/userIOUService.js'
import exchangeRateService from '../services/exchangeRateService.js'

const router = express.Router()

// === 스왑 기능 ===

// XRP → KRW 스왑
router.post('/xrp-to-krw', authMiddleware, async (req, res) => {
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
router.post('/krw-to-xrp', authMiddleware, async (req, res) => {
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
router.post('/calculate-fee', async (req, res) => {
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

// 현재 환율 조회
router.get('/exchange-rate', async (req, res) => {
  try {
    const result = await exchangeRateService.getCurrentXRPKRWRate()
    res.json(result)

  } catch (error) {
    console.error('Error getting exchange rate:', error)
    res.status(500).json({ error: 'Failed to get exchange rate' })
  }
})

export default router