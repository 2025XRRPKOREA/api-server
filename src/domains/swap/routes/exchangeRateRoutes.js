const express = require('express')
const { authMiddleware } = require('../../../shared/middleware/auth')
const adminSystemService = require('../../admin/services/adminSystemService')
const ExchangeRate = require('../models/ExchangeRate')

const router = express.Router()

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

// 모든 환율 설정 조회
router.get('/rates', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, baseCurrency, quoteCurrency, isActive } = req.query

    const filter = {}
    if (baseCurrency) filter.baseCurrency = baseCurrency.toUpperCase()
    if (quoteCurrency) filter.quoteCurrency = quoteCurrency.toUpperCase()
    if (isActive !== undefined) filter.isActive = isActive === 'true'

    const rates = await ExchangeRate.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))

    const total = await ExchangeRate.countDocuments(filter)

    res.json({
      success: true,
      rates: rates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })

  } catch (error) {
    console.error('Error getting exchange rates:', error)
    res.status(500).json({ error: 'Failed to get exchange rates' })
  }
})

// 특정 통화쌍의 현재 환율 조회
router.get('/current/:baseCurrency/:quoteCurrency', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { baseCurrency, quoteCurrency } = req.params

    const rate = await ExchangeRate.getCurrentRate(baseCurrency, quoteCurrency)

    if (!rate) {
      return res.status(404).json({ error: 'No active exchange rate found for this currency pair' })
    }

    res.json({
      success: true,
      rate: rate
    })

  } catch (error) {
    console.error('Error getting current exchange rate:', error)
    res.status(500).json({ error: 'Failed to get current exchange rate' })
  }
})

// 환율 생성/업데이트
router.post('/rates', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const {
      baseCurrency,
      quoteCurrency,
      rate,
      spread,
      source = 'MANUAL',
      sourceMetadata,
      validFrom,
      validTo
    } = req.body

    // 필수 필드 검증
    if (!baseCurrency || !quoteCurrency || !rate) {
      return res.status(400).json({ error: 'baseCurrency, quoteCurrency, and rate are required' })
    }

    if (rate <= 0) {
      return res.status(400).json({ error: 'Rate must be greater than 0' })
    }

    // 기존 활성 환율 비활성화 (새로운 환율로 대체)
    await ExchangeRate.updateMany(
      {
        baseCurrency: baseCurrency.toUpperCase(),
        quoteCurrency: quoteCurrency.toUpperCase(),
        isActive: true
      },
      { isActive: false }
    )

    // 새 환율 생성
    const exchangeRate = new ExchangeRate({
      baseCurrency: baseCurrency.toUpperCase(),
      quoteCurrency: quoteCurrency.toUpperCase(),
      rate: rate,
      spread: spread || 0.001, // 기본 0.1% 스프레드
      source: source,
      sourceMetadata: sourceMetadata || {},
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validTo: validTo ? new Date(validTo) : null,
      createdBy: `admin_${req.userId}`
    })

    await exchangeRate.save()

    res.json({
      success: true,
      message: 'Exchange rate created successfully',
      rate: exchangeRate
    })

  } catch (error) {
    console.error('Error creating exchange rate:', error)
    res.status(500).json({ error: 'Failed to create exchange rate' })
  }
})

// 환율 업데이트
router.put('/rates/:id', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const {
      rate,
      spread,
      source,
      sourceMetadata,
      validFrom,
      validTo,
      isActive
    } = req.body

    const exchangeRate = await ExchangeRate.findById(req.params.id)
    if (!exchangeRate) {
      return res.status(404).json({ error: 'Exchange rate not found' })
    }

    // 업데이트 가능한 필드들
    if (rate !== undefined) {
      if (rate <= 0) {
        return res.status(400).json({ error: 'Rate must be greater than 0' })
      }
      exchangeRate.rate = rate
    }

    if (spread !== undefined) exchangeRate.spread = spread
    if (source !== undefined) exchangeRate.source = source
    if (sourceMetadata !== undefined) exchangeRate.sourceMetadata = sourceMetadata
    if (validFrom !== undefined) exchangeRate.validFrom = new Date(validFrom)
    if (validTo !== undefined) exchangeRate.validTo = validTo ? new Date(validTo) : null
    if (isActive !== undefined) exchangeRate.isActive = isActive

    await exchangeRate.save()

    res.json({
      success: true,
      message: 'Exchange rate updated successfully',
      rate: exchangeRate
    })

  } catch (error) {
    console.error('Error updating exchange rate:', error)
    res.status(500).json({ error: 'Failed to update exchange rate' })
  }
})

// 환율 비활성화
router.post('/rates/:id/deactivate', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const exchangeRate = await ExchangeRate.findById(req.params.id)
    if (!exchangeRate) {
      return res.status(404).json({ error: 'Exchange rate not found' })
    }

    exchangeRate.isActive = false
    await exchangeRate.save()

    res.json({
      success: true,
      message: 'Exchange rate deactivated successfully'
    })

  } catch (error) {
    console.error('Error deactivating exchange rate:', error)
    res.status(500).json({ error: 'Failed to deactivate exchange rate' })
  }
})

// === 환율 계산 및 변환 ===

// 환율 계산 시뮬레이션
router.post('/convert', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency, rateId } = req.body

    if (!amount || !fromCurrency || !toCurrency || amount <= 0) {
      return res.status(400).json({ error: 'amount, fromCurrency, and toCurrency are required' })
    }

    let exchangeRate
    if (rateId) {
      exchangeRate = await ExchangeRate.findById(rateId)
    } else {
      exchangeRate = await ExchangeRate.getCurrentRate(fromCurrency, toCurrency)
    }

    if (!exchangeRate) {
      return res.status(404).json({ error: 'No exchange rate found for this currency pair' })
    }

    let conversion
    if (fromCurrency.toUpperCase() === exchangeRate.baseCurrency) {
      conversion = exchangeRate.convertAmount(amount, 'base_to_quote')
    } else {
      conversion = exchangeRate.convertAmount(amount, 'quote_to_base')
    }

    res.json({
      success: true,
      conversion: conversion,
      rate: {
        id: exchangeRate._id,
        baseCurrency: exchangeRate.baseCurrency,
        quoteCurrency: exchangeRate.quoteCurrency,
        rate: exchangeRate.rate,
        spread: exchangeRate.spread
      }
    })

  } catch (error) {
    console.error('Error converting currency:', error)
    res.status(500).json({ error: 'Failed to convert currency' })
  }
})

// === 대량 관리 기능 ===

// 대량 환율 설정
router.post('/batch-update', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { rates } = req.body

    if (!Array.isArray(rates) || rates.length === 0) {
      return res.status(400).json({ error: 'Rates array is required' })
    }

    if (rates.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 rates per batch' })
    }

    const results = []

    for (const rateData of rates) {
      try {
        // 기존 활성 환율 비활성화
        await ExchangeRate.updateMany(
          {
            baseCurrency: rateData.baseCurrency.toUpperCase(),
            quoteCurrency: rateData.quoteCurrency.toUpperCase(),
            isActive: true
          },
          { isActive: false }
        )

        // 새 환율 생성
        const exchangeRate = new ExchangeRate({
          ...rateData,
          baseCurrency: rateData.baseCurrency.toUpperCase(),
          quoteCurrency: rateData.quoteCurrency.toUpperCase(),
          createdBy: `admin_${req.userId}_batch`,
          validFrom: rateData.validFrom ? new Date(rateData.validFrom) : new Date(),
          validTo: rateData.validTo ? new Date(rateData.validTo) : null
        })

        await exchangeRate.save()

        results.push({
          success: true,
          currencyPair: `${rateData.baseCurrency}/${rateData.quoteCurrency}`,
          rateId: exchangeRate._id,
          rate: exchangeRate.rate
        })

      } catch (error) {
        results.push({
          success: false,
          currencyPair: `${rateData.baseCurrency}/${rateData.quoteCurrency}`,
          error: error.message
        })
      }
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
    console.error('Error in batch update:', error)
    res.status(500).json({ error: 'Failed to process batch update' })
  }
})

// === 통계 ===

// 환율 통계
router.get('/stats', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const stats = await ExchangeRate.aggregate([
      {
        $group: {
          _id: {
            baseCurrency: '$baseCurrency',
            quoteCurrency: '$quoteCurrency',
            isActive: '$isActive'
          },
          count: { $sum: 1 },
          avgRate: { $avg: '$rate' },
          minRate: { $min: '$rate' },
          maxRate: { $max: '$rate' }
        }
      },
      {
        $group: {
          _id: {
            baseCurrency: '$_id.baseCurrency',
            quoteCurrency: '$_id.quoteCurrency'
          },
          active: {
            $sum: {
              $cond: ['$_id.isActive', '$count', 0]
            }
          },
          inactive: {
            $sum: {
              $cond: ['$_id.isActive', 0, '$count']
            }
          },
          total: { $sum: '$count' },
          currentRate: {
            $first: {
              $cond: ['$_id.isActive', '$avgRate', null]
            }
          }
        }
      }
    ])

    res.json({
      success: true,
      stats: stats
    })

  } catch (error) {
    console.error('Error getting exchange rate stats:', error)
    res.status(500).json({ error: 'Failed to get exchange rate stats' })
  }
})

module.exports = router