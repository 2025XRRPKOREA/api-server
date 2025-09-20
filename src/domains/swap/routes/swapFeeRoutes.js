const express = require('express')
const { authMiddleware } = require('../../../shared/middleware/auth')
const adminSystemService = require('../../admin/services/adminSystemService')
const SwapFeeConfig = require('../models/SwapFeeConfig')

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

// === 스왑 수수료 설정 관리 ===

// 모든 수수료 설정 조회
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

// 특정 수수료 설정 조회
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

// 현재 활성 수수료 설정 조회
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

// 수수료 설정 생성
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

    // 필수 필드 검증
    if (!swapType || !feeType || baseFee === undefined) {
      return res.status(400).json({ error: 'swapType, feeType, and baseFee are required' })
    }

    // 스왑 타입 검증
    if (!['XRP_TO_KRW', 'KRW_TO_XRP', 'IOU_TRANSFER'].includes(swapType)) {
      return res.status(400).json({ error: 'Invalid swap type' })
    }

    // 수수료 타입 검증
    if (!['PERCENTAGE', 'FIXED', 'TIERED'].includes(feeType)) {
      return res.status(400).json({ error: 'Invalid fee type' })
    }

    // TIERED 타입인 경우 tieredRates 필수
    if (feeType === 'TIERED' && (!tieredRates || !Array.isArray(tieredRates) || tieredRates.length === 0)) {
      return res.status(400).json({ error: 'tieredRates is required for TIERED fee type' })
    }

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

// 수수료 설정 업데이트
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

    // 업데이트 가능한 필드들
    if (feeType !== undefined) {
      if (!['PERCENTAGE', 'FIXED', 'TIERED'].includes(feeType)) {
        return res.status(400).json({ error: 'Invalid fee type' })
      }
      config.feeType = feeType
    }

    if (baseFee !== undefined) config.baseFee = baseFee
    if (minFee !== undefined) config.minFee = minFee
    if (maxFee !== undefined) config.maxFee = maxFee
    if (tieredRates !== undefined) config.tieredRates = tieredRates
    if (effectiveFrom !== undefined) config.effectiveFrom = new Date(effectiveFrom)
    if (effectiveTo !== undefined) config.effectiveTo = effectiveTo ? new Date(effectiveTo) : null
    if (description !== undefined) config.description = description
    if (isActive !== undefined) config.isActive = isActive

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

// 수수료 설정 비활성화
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

// === 수수료 계산 및 시뮬레이션 ===

// 수수료 계산 시뮬레이션
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

// === 대량 관리 기능 ===

// 대량 수수료 설정 생성
router.post('/batch-create', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { configs } = req.body

    if (!Array.isArray(configs) || configs.length === 0) {
      return res.status(400).json({ error: 'Configs array is required' })
    }

    if (configs.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 configs per batch' })
    }

    const results = []

    for (const configData of configs) {
      try {
        const config = new SwapFeeConfig({
          ...configData,
          createdBy: `admin_${req.userId}_batch`,
          effectiveFrom: configData.effectiveFrom ? new Date(configData.effectiveFrom) : new Date(),
          effectiveTo: configData.effectiveTo ? new Date(configData.effectiveTo) : null
        })

        await config.save()

        results.push({
          success: true,
          swapType: configData.swapType,
          configId: config._id
        })

      } catch (error) {
        results.push({
          success: false,
          swapType: configData.swapType,
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
    console.error('Error in batch create:', error)
    res.status(500).json({ error: 'Failed to process batch create' })
  }
})

// === 통계 ===

// 수수료 설정 통계
router.get('/stats', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const stats = await SwapFeeConfig.aggregate([
      {
        $group: {
          _id: {
            swapType: '$swapType',
            isActive: '$isActive'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.swapType',
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
          total: { $sum: '$count' }
        }
      }
    ])

    res.json({
      success: true,
      stats: stats
    })

  } catch (error) {
    console.error('Error getting swap fee stats:', error)
    res.status(500).json({ error: 'Failed to get swap fee stats' })
  }
})

module.exports = router