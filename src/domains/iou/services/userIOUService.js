const XRPLService = require('../../../shared/services/xrplService')
const ValidationService = require('../../../shared/services/validationService')
const adminIOUService = require('./iouService')
const adminSystemService = require('../../admin/services/adminSystemService')
const adminExchangeRateService = require('../../swap/services/exchangeRateService')
const SwapFeeConfig = require('../../swap/models/SwapFeeConfig')
const xrpl = require('xrpl')

// KRW IOU 설정
const KRW_CURRENCY = "KRW"

class UserIOUService {

    /**
     * XRP -> IOU 스왑 요청 (사용자가 XRP를 보내고 IOU를 받음)
     */
    async requestXRPToIOUSwap(userAddress, xrpAmount) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        if (!ValidationService.isValidAmount(xrpAmount)) {
            return { success: false, error: 'Invalid XRP amount' }
        }

        try {
            // 어드민 서비스를 통해 스왑 처리
            const result = await adminIOUService.processXRPToIOUSwap(userAddress, xrpAmount)

            if (result.success) {
                console.log(`XRP to IOU swap completed for ${userAddress}`)
            }

            return result
        } catch (error) {
            console.error('Error in XRP to IOU swap request:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * IOU -> XRP 스왑 요청 (사용자가 IOU를 보내고 XRP를 받음)
     */
    async requestIOUToXRPSwap(userSeed, iouAmount) {
        if (!ValidationService.isValidSeed(userSeed)) {
            return { success: false, error: 'Invalid user seed' }
        }

        if (!ValidationService.isValidAmount(iouAmount)) {
            return { success: false, error: 'Invalid IOU amount' }
        }

        try {
            const userWallet = xrpl.Wallet.fromSeed(userSeed)

            // 어드민 서비스를 통해 스왑 처리
            const result = await adminIOUService.processIOUToXRPSwap(userWallet, iouAmount)

            if (result.success) {
                console.log(`IOU to XRP swap completed for ${userWallet.address}`)
            }

            return result
        } catch (error) {
            console.error('Error in IOU to XRP swap request:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 다른 사용자에게 IOU 전송
     */
    async transferIOU(senderSeed, recipientAddress, amount, memo = null) {
        if (!ValidationService.isValidSeed(senderSeed)) {
            return { success: false, error: 'Invalid sender seed' }
        }

        if (!ValidationService.isValidXRPAddress(recipientAddress)) {
            return { success: false, error: 'Invalid recipient address' }
        }

        if (!ValidationService.isValidAmount(amount)) {
            return { success: false, error: 'Invalid amount' }
        }

        const adminAddress = adminSystemService.getAdminAddress()
        if (!adminAddress) {
            return { success: false, error: 'Admin not initialized' }
        }

        const client = await XRPLService.connectClient()

        try {
            const senderWallet = xrpl.Wallet.fromSeed(senderSeed)

            const payment = {
                TransactionType: "Payment",
                Account: senderWallet.address,
                Amount: {
                    currency: KRW_CURRENCY,
                    value: amount.toString(),
                    issuer: adminAddress
                },
                Destination: recipientAddress
            }

            // 메모 추가 (선택사항)
            if (memo) {
                payment.Memos = [{
                    Memo: {
                        MemoData: Buffer.from(memo, 'utf8').toString('hex')
                    }
                }]
            }

            const result = await XRPLService.submitAndWait(client, senderWallet, payment)

            if (result.success) {
                console.log(`IOU transfer completed: ${amount} ${KRW_CURRENCY} from ${senderWallet.address} to ${recipientAddress}`)

                return {
                    success: true,
                    txHash: result.txHash,
                    sender: senderWallet.address,
                    recipient: recipientAddress,
                    amount: amount,
                    currency: KRW_CURRENCY,
                    memo: memo
                }
            } else {
                throw new Error(`IOU transfer failed: ${result.error}`)
            }

        } catch (error) {
            console.error('Error transferring IOU:', error)
            return {
                success: false,
                error: error.message
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 스왑 수수료 미리보기 (동적 수수료 적용)
     */
    async calculateSwapPreview(swapType, amount) {
        if (!ValidationService.isValidAmount(amount)) {
            return { success: false, error: 'Invalid amount' }
        }

        try {
            const feeCalculation = await adminIOUService.calculateSwapFee(swapType, amount)

            // 환율 정보도 함께 제공
            let exchangeInfo = null
            if (swapType === 'XRP_TO_KRW' || swapType === 'KRW_TO_XRP') {
                const rateInfo = await adminExchangeRateService.getCurrentXRPKRWRate()
                if (rateInfo.success) {
                    exchangeInfo = {
                        rate: rateInfo.rate,
                        bidRate: rateInfo.bidRate,
                        askRate: rateInfo.askRate,
                        spread: rateInfo.spread
                    }
                }
            }

            return {
                success: true,
                preview: {
                    swapType: swapType,
                    inputAmount: amount,
                    fee: feeCalculation.fee,
                    outputAmount: feeCalculation.netAmount,
                    feeRate: feeCalculation.feeRate,
                    feeType: feeCalculation.feeType,
                    feePercentage: feeCalculation.feeRate ? `${feeCalculation.feeRate * 100}%` : null,
                    exchangeRate: exchangeInfo
                }
            }
        } catch (error) {
            console.error('Error calculating swap preview:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 사용자의 IOU 거래 내역 조회 (최근 트랜잭션)
     */
    async getIOUTransactionHistory(userAddress, limit = 10) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        const client = await XRPLService.connectClient()

        try {
            const response = await client.request({
                command: "account_tx",
                account: userAddress,
                ledger_index_min: -1,
                ledger_index_max: -1,
                limit: limit
            })

            if (response.result && response.result.transactions) {
                // IOU 관련 트랜잭션만 필터링
                const iouTransactions = response.result.transactions.filter(tx => {
                    const txData = tx.tx
                    return txData.TransactionType === 'Payment' &&
                           typeof txData.Amount === 'object' &&
                           txData.Amount.currency === KRW_CURRENCY
                })

                return {
                    success: true,
                    transactions: iouTransactions,
                    count: iouTransactions.length
                }
            } else {
                return {
                    success: true,
                    transactions: [],
                    count: 0
                }
            }

        } catch (error) {
            console.error('Error getting transaction history:', error)
            return {
                success: false,
                error: error.message,
                transactions: []
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * IOU 거래 가능 여부 확인
     */
    async canTradeIOU(userAddress) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        try {
            const adminAddress = adminSystemService.getAdminAddress()
            if (!adminAddress) {
                return { success: false, canTrade: false, reason: 'Admin not initialized' }
            }

            const client = await XRPLService.connectClient()

            try {
                // Trust Line 존재 여부 확인
                const linesResult = await XRPLService.getAccountLines(client, userAddress)

                if (linesResult.success) {
                    const krwTrustLine = linesResult.lines.find(line =>
                        line.currency === KRW_CURRENCY && line.account === adminAddress
                    )

                    const canTrade = !!krwTrustLine
                    const reason = canTrade ? 'Trust line exists' : 'No KRW trust line found'

                    return {
                        success: true,
                        canTrade: canTrade,
                        reason: reason,
                        trustLineLimit: krwTrustLine ? krwTrustLine.limit : null,
                        currentBalance: krwTrustLine ? parseFloat(krwTrustLine.balance) : 0
                    }
                } else {
                    return {
                        success: false,
                        canTrade: false,
                        reason: 'Failed to check trust lines'
                    }
                }
            } finally {
                await client.disconnect()
            }

        } catch (error) {
            console.error('Error checking IOU trade capability:', error)
            return {
                success: false,
                canTrade: false,
                reason: error.message
            }
        }
    }

    /**
     * IOU 시장 정보 조회 (동적 수수료 및 환율 포함)
     */
    async getIOUMarketInfo() {
        try {
            const settings = adminIOUService.getSettings()
            const adminAddress = adminSystemService.getAdminAddress()

            // 현재 활성 수수료 설정 조회
            const [xrpToKrwFee, krwToXrpFee, transferFee] = await Promise.all([
                SwapFeeConfig.getCurrentFeeConfig('XRP_TO_KRW'),
                SwapFeeConfig.getCurrentFeeConfig('KRW_TO_XRP'),
                SwapFeeConfig.getCurrentFeeConfig('IOU_TRANSFER')
            ])

            // 현재 환율 정보 조회
            const exchangeRateInfo = await adminExchangeRateService.getCurrentXRPKRWRate()

            return {
                success: true,
                marketInfo: {
                    currency: settings.currency,
                    issuer: adminAddress,
                    networkInfo: XRPLService.getNetworkInfo(),
                    issuanceActive: !!adminAddress,
                    exchangeRate: exchangeRateInfo.success ? {
                        rate: exchangeRateInfo.rate,
                        bidRate: exchangeRateInfo.bidRate,
                        askRate: exchangeRateInfo.askRate,
                        spread: exchangeRateInfo.spread,
                        lastUpdated: exchangeRateInfo.lastUpdated
                    } : null,
                    swapFees: {
                        xrpToKrw: xrpToKrwFee ? {
                            feeType: xrpToKrwFee.feeType,
                            baseFee: xrpToKrwFee.baseFee,
                            minFee: xrpToKrwFee.minFee,
                            maxFee: xrpToKrwFee.maxFee
                        } : { feeType: 'PERCENTAGE', baseFee: 0.003 },
                        krwToXrp: krwToXrpFee ? {
                            feeType: krwToXrpFee.feeType,
                            baseFee: krwToXrpFee.baseFee,
                            minFee: krwToXrpFee.minFee,
                            maxFee: krwToXrpFee.maxFee
                        } : { feeType: 'PERCENTAGE', baseFee: 0.003 },
                        transfer: transferFee ? {
                            feeType: transferFee.feeType,
                            baseFee: transferFee.baseFee,
                            minFee: transferFee.minFee,
                            maxFee: transferFee.maxFee
                        } : { feeType: 'PERCENTAGE', baseFee: 0.003 }
                    }
                }
            }
        } catch (error) {
            console.error('Error getting IOU market info:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * XRP 금액을 KRW로 환산 (실시간 환율 적용)
     */
    async convertXRPToKRW(xrpAmount) {
        try {
            if (!ValidationService.isValidAmount(xrpAmount)) {
                return { success: false, error: 'Invalid XRP amount' }
            }

            const conversion = await adminIOUService.convertXRPToKRW(xrpAmount)
            return conversion
        } catch (error) {
            console.error('Error converting XRP to KRW:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * KRW 금액을 XRP로 환산 (실시간 환율 적용)
     */
    async convertKRWToXRP(krwAmount) {
        try {
            if (!ValidationService.isValidAmount(krwAmount)) {
                return { success: false, error: 'Invalid KRW amount' }
            }

            const conversion = await adminIOUService.convertKRWToXRP(krwAmount)
            return conversion
        } catch (error) {
            console.error('Error converting KRW to XRP:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }
}

module.exports = new UserIOUService()