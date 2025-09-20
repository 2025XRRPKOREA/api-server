import ExchangeRate from '../models/ExchangeRate.js'
import SwapFeeConfig from '../models/SwapFeeConfig.js'

class AdminExchangeRateService {

    /**
     * 기본 환율 초기화 (4,197 KRW = 1 XRP)
     */
    async initializeDefaultRates() {
        try {
            console.log('Initializing default exchange rates...')

            // XRP/KRW 환율이 이미 있는지 확인
            const existingRate = await ExchangeRate.getCurrentRate('XRP', 'KRW')

            if (!existingRate) {
                // 기본 XRP/KRW 환율 생성 (4,197 KRW = 1 XRP)
                const defaultRate = new ExchangeRate({
                    baseCurrency: 'XRP',
                    quoteCurrency: 'KRW',
                    rate: 4197,
                    spread: 0.001, // 0.1% 스프레드
                    source: 'SYSTEM',
                    sourceMetadata: {
                        provider: 'SYSTEM_INIT',
                        lastUpdated: new Date(),
                        confidence: 1.0
                    },
                    createdBy: 'system_init'
                })

                await defaultRate.save()
                console.log('Default XRP/KRW exchange rate created: 1 XRP = 4,197 KRW')
            } else {
                console.log('XRP/KRW exchange rate already exists')
            }

            // 기본 스왑 수수료 설정 초기화
            await this.initializeDefaultSwapFees()

            return { success: true, message: 'Default rates initialized' }

        } catch (error) {
            console.error('Error initializing default rates:', error)
            return { success: false, error: error.message }
        }
    }

    /**
     * 기본 스왑 수수료 설정 초기화
     */
    async initializeDefaultSwapFees() {
        try {
            const swapTypes = ['XRP_TO_KRW', 'KRW_TO_XRP', 'IOU_TRANSFER']

            for (const swapType of swapTypes) {
                const existingConfig = await SwapFeeConfig.getCurrentFeeConfig(swapType)

                if (!existingConfig) {
                    const defaultFeeConfig = new SwapFeeConfig({
                        swapType: swapType,
                        feeType: 'PERCENTAGE',
                        baseFee: 0.003, // 0.3%
                        minFee: 0,
                        maxFee: null,
                        description: `Default ${swapType} swap fee`,
                        createdBy: 'system_init'
                    })

                    await defaultFeeConfig.save()
                    console.log(`Default swap fee config created for ${swapType}: 0.3%`)
                }
            }

        } catch (error) {
            console.error('Error initializing default swap fees:', error)
            throw error
        }
    }

    /**
     * XRP/KRW 환율 업데이트
     */
    async updateXRPKRWRate(newRate, spread = 0.001, source = 'MANUAL', sourceMetadata = {}) {
        try {
            // 기존 활성 환율 비활성화
            await ExchangeRate.updateMany(
                {
                    baseCurrency: 'XRP',
                    quoteCurrency: 'KRW',
                    isActive: true
                },
                { isActive: false }
            )

            // 새 환율 생성
            const exchangeRate = new ExchangeRate({
                baseCurrency: 'XRP',
                quoteCurrency: 'KRW',
                rate: newRate,
                spread: spread,
                source: source,
                sourceMetadata: {
                    ...sourceMetadata,
                    lastUpdated: new Date()
                },
                createdBy: 'admin_update'
            })

            await exchangeRate.save()

            console.log(`XRP/KRW exchange rate updated: 1 XRP = ${newRate} KRW`)

            return {
                success: true,
                message: 'Exchange rate updated successfully',
                rate: exchangeRate
            }

        } catch (error) {
            console.error('Error updating XRP/KRW rate:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 현재 XRP/KRW 환율 조회
     */
    async getCurrentXRPKRWRate() {
        try {
            const rate = await ExchangeRate.getCurrentRate('XRP', 'KRW')

            if (rate) {
                return {
                    success: true,
                    rate: rate.rate,
                    bidRate: rate.bidRate,
                    askRate: rate.askRate,
                    spread: rate.spread,
                    source: rate.source,
                    lastUpdated: rate.updatedAt
                }
            } else {
                return {
                    success: false,
                    error: 'No active XRP/KRW exchange rate found'
                }
            }

        } catch (error) {
            console.error('Error getting current XRP/KRW rate:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 스왑을 위한 환율 계산
     */
    async calculateSwapRate(amount, fromCurrency, toCurrency, includeSpread = true) {
        try {
            const rate = await ExchangeRate.getCurrentRate(fromCurrency, toCurrency)

            if (!rate) {
                throw new Error(`No exchange rate found for ${fromCurrency}/${toCurrency}`)
            }

            let exchangeRate
            let direction

            if (fromCurrency.toUpperCase() === rate.baseCurrency) {
                direction = 'base_to_quote'
                exchangeRate = includeSpread ? rate.bidRate : rate.rate
            } else {
                direction = 'quote_to_base'
                exchangeRate = includeSpread ? rate.askRate : rate.rate
            }

            const convertedAmount = direction === 'base_to_quote'
                ? amount * exchangeRate
                : amount / exchangeRate

            return {
                success: true,
                originalAmount: amount,
                originalCurrency: fromCurrency,
                convertedAmount: convertedAmount,
                convertedCurrency: toCurrency,
                exchangeRate: exchangeRate,
                direction: direction,
                spreadApplied: includeSpread,
                rateInfo: {
                    baseRate: rate.rate,
                    bidRate: rate.bidRate,
                    askRate: rate.askRate,
                    spread: rate.spread
                }
            }

        } catch (error) {
            console.error('Error calculating swap rate:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 여러 통화쌍의 환율을 한번에 업데이트
     */
    async batchUpdateRates(rateUpdates, createdBy = 'admin_batch') {
        try {
            const results = []

            for (const update of rateUpdates) {
                const { baseCurrency, quoteCurrency, rate, spread, source, sourceMetadata } = update

                try {
                    // 기존 활성 환율 비활성화
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
                        spread: spread || 0.001,
                        source: source || 'BATCH_UPDATE',
                        sourceMetadata: sourceMetadata || {},
                        createdBy: createdBy
                    })

                    await exchangeRate.save()

                    results.push({
                        success: true,
                        currencyPair: `${baseCurrency}/${quoteCurrency}`,
                        rate: rate,
                        rateId: exchangeRate._id
                    })

                } catch (error) {
                    results.push({
                        success: false,
                        currencyPair: `${baseCurrency}/${quoteCurrency}`,
                        error: error.message
                    })
                }
            }

            const successCount = results.filter(r => r.success).length
            const failureCount = results.length - successCount

            return {
                success: true,
                batchResults: {
                    total: results.length,
                    success: successCount,
                    failures: failureCount,
                    results: results
                }
            }

        } catch (error) {
            console.error('Error in batch rate update:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 환율 히스토리 조회
     */
    async getRateHistory(baseCurrency, quoteCurrency, limit = 50) {
        try {
            const rates = await ExchangeRate.find({
                baseCurrency: baseCurrency.toUpperCase(),
                quoteCurrency: quoteCurrency.toUpperCase()
            })
            .sort({ createdAt: -1 })
            .limit(limit)

            return {
                success: true,
                currencyPair: `${baseCurrency}/${quoteCurrency}`,
                history: rates
            }

        } catch (error) {
            console.error('Error getting rate history:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 환율 통계 조회
     */
    async getRateStatistics(baseCurrency, quoteCurrency, period = '24h') {
        try {
            const periodMap = {
                '1h': 1 * 60 * 60 * 1000,
                '24h': 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000,
                '30d': 30 * 24 * 60 * 60 * 1000
            }

            const periodMs = periodMap[period] || periodMap['24h']
            const startDate = new Date(Date.now() - periodMs)

            const stats = await ExchangeRate.aggregate([
                {
                    $match: {
                        baseCurrency: baseCurrency.toUpperCase(),
                        quoteCurrency: quoteCurrency.toUpperCase(),
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        avgRate: { $avg: '$rate' },
                        minRate: { $min: '$rate' },
                        maxRate: { $max: '$rate' },
                        firstRate: { $first: '$rate' },
                        lastRate: { $last: '$rate' }
                    }
                }
            ])

            const result = stats[0] || {
                count: 0,
                avgRate: 0,
                minRate: 0,
                maxRate: 0,
                firstRate: 0,
                lastRate: 0
            }

            return {
                success: true,
                currencyPair: `${baseCurrency}/${quoteCurrency}`,
                period: period,
                statistics: {
                    ...result,
                    change: result.lastRate - result.firstRate,
                    changePercent: result.firstRate > 0 ?
                        ((result.lastRate - result.firstRate) / result.firstRate) * 100 : 0
                }
            }

        } catch (error) {
            console.error('Error getting rate statistics:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }
}

export default new AdminExchangeRateService()