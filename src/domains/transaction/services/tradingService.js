const XRPLService = require('../shared/xrplService')
const ValidationService = require('../shared/validationService')
const adminSystemService = require('../admin/adminSystemService')
const xrpl = require('xrpl')

// KRW IOU 설정
const KRW_CURRENCY = "KRW"

class UserTradingService {

    /**
     * 오더북 조회
     */
    async getOrderBook(baseCurrency = "XRP", counterCurrency = KRW_CURRENCY, limit = 20) {
        const client = await XRPLService.connectClient()

        try {
            const adminAddress = adminSystemService.getAdminAddress()
            if (!adminAddress && counterCurrency === KRW_CURRENCY) {
                return { success: false, error: 'Admin not initialized' }
            }

            // TakerGets (기본 통화)
            const takerGets = baseCurrency === "XRP" ? "XRP" : {
                currency: baseCurrency,
                issuer: adminAddress
            }

            // TakerPays (상대 통화)
            const takerPays = counterCurrency === "XRP" ? "XRP" : {
                currency: counterCurrency,
                issuer: adminAddress
            }

            const orderbookResult = await XRPLService.getOrderBook(client, takerGets, takerPays, limit)

            if (orderbookResult.success) {
                return {
                    success: true,
                    orderbook: {
                        baseCurrency,
                        counterCurrency,
                        offers: orderbookResult.offers,
                        count: orderbookResult.offers.length
                    }
                }
            } else {
                throw new Error('Failed to get orderbook')
            }

        } catch (error) {
            console.error('Error getting order book:', error)
            return {
                success: false,
                error: error.message
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 오퍼 생성 (유저간 거래용)
     */
    async createOffer(userSeed, takerGets, takerPays, expiration = null) {
        if (!ValidationService.isValidSeed(userSeed)) {
            return { success: false, error: 'Invalid user seed' }
        }

        const validationResult = ValidationService.validateOfferParams(takerGets, takerPays)
        if (!validationResult.isValid) {
            return {
                success: false,
                error: 'Invalid offer parameters',
                details: validationResult.errors
            }
        }

        const client = await XRPLService.connectClient()

        try {
            const userWallet = xrpl.Wallet.fromSeed(userSeed)

            const offer = {
                TransactionType: "OfferCreate",
                Account: userWallet.address,
                TakerGets: takerGets,
                TakerPays: takerPays
            }

            // 만료 시간 설정 (선택사항)
            if (expiration) {
                offer.Expiration = expiration
            }

            const result = await XRPLService.submitAndWait(client, userWallet, offer)

            if (result.success) {
                console.log(`Offer created by ${userWallet.address}`)

                return {
                    success: true,
                    txHash: result.txHash,
                    offer: {
                        account: userWallet.address,
                        takerGets: takerGets,
                        takerPays: takerPays,
                        expiration: expiration
                    }
                }
            } else {
                throw new Error(`Offer creation failed: ${result.error}`)
            }

        } catch (error) {
            console.error('Error creating offer:', error)
            return {
                success: false,
                error: error.message
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 사용자의 활성 오퍼 조회
     */
    async getUserOffers(userAddress, limit = 20) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        const client = await XRPLService.connectClient()

        try {
            const response = await client.request({
                command: "account_offers",
                account: userAddress,
                ledger_index: "validated",
                limit: limit
            })

            if (response.result && response.result.offers) {
                return {
                    success: true,
                    offers: response.result.offers,
                    count: response.result.offers.length
                }
            } else {
                return {
                    success: true,
                    offers: [],
                    count: 0
                }
            }

        } catch (error) {
            console.error('Error getting user offers:', error)
            return {
                success: false,
                error: error.message,
                offers: []
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 오퍼 취소
     */
    async cancelOffer(userSeed, offerSequence) {
        if (!ValidationService.isValidSeed(userSeed)) {
            return { success: false, error: 'Invalid user seed' }
        }

        if (!Number.isInteger(offerSequence) || offerSequence <= 0) {
            return { success: false, error: 'Invalid offer sequence' }
        }

        const client = await XRPLService.connectClient()

        try {
            const userWallet = xrpl.Wallet.fromSeed(userSeed)

            const cancelOffer = {
                TransactionType: "OfferCancel",
                Account: userWallet.address,
                OfferSequence: offerSequence
            }

            const result = await XRPLService.submitAndWait(client, userWallet, cancelOffer)

            if (result.success) {
                console.log(`Offer cancelled by ${userWallet.address}, sequence: ${offerSequence}`)

                return {
                    success: true,
                    txHash: result.txHash,
                    cancelledOffer: {
                        account: userWallet.address,
                        sequence: offerSequence
                    }
                }
            } else {
                throw new Error(`Offer cancellation failed: ${result.error}`)
            }

        } catch (error) {
            console.error('Error cancelling offer:', error)
            return {
                success: false,
                error: error.message
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 시장 가격 조회 (최근 거래 기준)
     */
    async getMarketPrice(baseCurrency = "XRP", counterCurrency = KRW_CURRENCY) {
        try {
            const orderbookResult = await this.getOrderBook(baseCurrency, counterCurrency, 5)

            if (orderbookResult.success && orderbookResult.orderbook.offers.length > 0) {
                const bestOffer = orderbookResult.orderbook.offers[0]

                // 가격 계산 (TakerPays / TakerGets)
                let price = 0
                if (typeof bestOffer.TakerPays === 'string' && typeof bestOffer.TakerGets === 'string') {
                    // XRP to XRP (불가능하지만 안전장치)
                    price = parseFloat(bestOffer.TakerPays) / parseFloat(bestOffer.TakerGets)
                } else if (typeof bestOffer.TakerPays === 'object' && typeof bestOffer.TakerGets === 'string') {
                    // XRP to IOU
                    price = parseFloat(bestOffer.TakerPays.value) / (parseFloat(bestOffer.TakerGets) / 1000000)
                } else if (typeof bestOffer.TakerPays === 'string' && typeof bestOffer.TakerGets === 'object') {
                    // IOU to XRP
                    price = (parseFloat(bestOffer.TakerPays) / 1000000) / parseFloat(bestOffer.TakerGets.value)
                } else if (typeof bestOffer.TakerPays === 'object' && typeof bestOffer.TakerGets === 'object') {
                    // IOU to IOU
                    price = parseFloat(bestOffer.TakerPays.value) / parseFloat(bestOffer.TakerGets.value)
                }

                return {
                    success: true,
                    marketPrice: {
                        baseCurrency,
                        counterCurrency,
                        price: price,
                        bestOffer: bestOffer,
                        timestamp: new Date().toISOString()
                    }
                }
            } else {
                return {
                    success: false,
                    error: 'No offers available for price calculation'
                }
            }

        } catch (error) {
            console.error('Error getting market price:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 거래 가능한 통화 쌍 목록
     */
    getTradingPairs() {
        const adminAddress = adminSystemService.getAdminAddress()

        return {
            success: true,
            tradingPairs: [
                {
                    base: "XRP",
                    counter: KRW_CURRENCY,
                    counterIssuer: adminAddress,
                    active: !!adminAddress
                }
                // 추후 다른 IOU 추가 가능
            ]
        }
    }

    /**
     * 거래 통계 조회
     */
    async getTradingStats(userAddress, period = '24h') {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        try {
            // 사용자의 최근 거래 내역 조회
            const client = await XRPLService.connectClient()

            const response = await client.request({
                command: "account_tx",
                account: userAddress,
                ledger_index_min: -1,
                ledger_index_max: -1,
                limit: 100
            })

            await client.disconnect()

            if (response.result && response.result.transactions) {
                const now = new Date()
                const periodMs = period === '24h' ? 24 * 60 * 60 * 1000 :
                                period === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                                24 * 60 * 60 * 1000

                const cutoffTime = new Date(now.getTime() - periodMs)

                // 오퍼 관련 트랜잭션 필터링
                const offerTransactions = response.result.transactions.filter(tx => {
                    const txData = tx.tx
                    const txDate = new Date((txData.date + 946684800) * 1000) // Ripple epoch to Unix epoch

                    return txDate >= cutoffTime &&
                           (txData.TransactionType === 'OfferCreate' ||
                            txData.TransactionType === 'OfferCancel')
                })

                const createdOffers = offerTransactions.filter(tx => tx.tx.TransactionType === 'OfferCreate')
                const cancelledOffers = offerTransactions.filter(tx => tx.tx.TransactionType === 'OfferCancel')

                return {
                    success: true,
                    stats: {
                        period: period,
                        offersCreated: createdOffers.length,
                        offersCancelled: cancelledOffers.length,
                        totalActivity: offerTransactions.length,
                        timeRange: {
                            from: cutoffTime.toISOString(),
                            to: now.toISOString()
                        }
                    }
                }
            } else {
                return {
                    success: true,
                    stats: {
                        period: period,
                        offersCreated: 0,
                        offersCancelled: 0,
                        totalActivity: 0
                    }
                }
            }

        } catch (error) {
            console.error('Error getting trading stats:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }
}

module.exports = new UserTradingService()