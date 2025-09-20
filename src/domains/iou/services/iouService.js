import XRPLService from '../../../shared/services/xrplService.js'
import ValidationService from '../../../shared/services/validationService.js'
import adminSystemService from '../../admin/services/adminSystemService.js'
import SwapFeeConfig from '../../swap/models/SwapFeeConfig.js'
import ExchangeRate from '../../swap/models/ExchangeRate.js'

// KRW IOU 설정
const KRW_CURRENCY = "KRW"
const SWAP_FEE_RATE = 0.003 // 0.3%

class AdminIOUService {

    /**
     * 스왑 수수료 계산 (동적 수수료 설정 사용)
     */
    async calculateSwapFee(swapType, swapAmount) {
        try {
            // 현재 활성 수수료 설정 조회
            const feeConfig = await SwapFeeConfig.getCurrentFeeConfig(swapType)

            if (feeConfig) {
                return feeConfig.calculateFee(swapAmount)
            } else {
                // 기본 수수료 사용
                const fee = swapAmount * SWAP_FEE_RATE
                return {
                    grossAmount: swapAmount,
                    fee: fee,
                    netAmount: swapAmount - fee,
                    feeRate: SWAP_FEE_RATE,
                    feeType: 'PERCENTAGE',
                    configId: null
                }
            }
        } catch (error) {
            console.error('Error calculating swap fee:', error)
            // 에러 시 기본 수수료 사용
            const fee = swapAmount * SWAP_FEE_RATE
            return {
                grossAmount: swapAmount,
                fee: fee,
                netAmount: swapAmount - fee,
                feeRate: SWAP_FEE_RATE,
                feeType: 'PERCENTAGE',
                configId: null
            }
        }
    }

    /**
     * KRW IOU 발행 (어드민이 사용자에게 KRW 토큰 발행)
     */
    async issueKRW(userAddress, amount) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        if (!ValidationService.isValidAmount(amount)) {
            return { success: false, error: 'Invalid amount' }
        }

        const adminWallet = adminSystemService.getAdminWallet()
        if (!adminWallet) {
            return { success: false, error: 'Admin not initialized' }
        }

        const client = await XRPLService.connectClient()

        try {
            console.log(`Issuing ${amount} KRW to ${userAddress}`)

            const payment = {
                TransactionType: "Payment",
                Account: adminWallet.address,
                Amount: {
                    currency: KRW_CURRENCY,
                    value: amount.toString(),
                    issuer: adminWallet.address
                },
                Destination: userAddress
            }

            const result = await XRPLService.submitAndWait(client, adminWallet, payment)

            if (result.success) {
                console.log(`Successfully issued ${amount} KRW to ${userAddress}`)
                return {
                    success: true,
                    txHash: result.txHash,
                    amount: amount,
                    currency: KRW_CURRENCY,
                    recipient: userAddress
                }
            } else {
                throw new Error(`Transaction failed: ${result.error}`)
            }

        } catch (error) {
            console.error('Error issuing KRW:', error)
            return {
                success: false,
                error: error.message
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 외부 스왑에서 받은 금액을 처리하고 유저에게 KRW 발행
     */
    async processSwapAndIssueKRW(userAddress, swapAmount, swapDetails = {}) {
        try {
            console.log(`Processing swap for user ${userAddress}, amount: ${swapAmount}`)

            if (!ValidationService.isValidXRPAddress(userAddress)) {
                return { success: false, error: 'Invalid user address' }
            }

            if (!ValidationService.isValidAmount(swapAmount)) {
                return { success: false, error: 'Invalid swap amount' }
            }

            // 1. 스왑 수수료 계산
            const feeCalculation = await this.calculateSwapFee('XRP_TO_KRW', swapAmount)

            console.log('Fee calculation:', {
                grossAmount: feeCalculation.grossAmount,
                fee: feeCalculation.fee,
                netAmount: feeCalculation.netAmount,
                feeRate: `${feeCalculation.feeRate * 100}%`
            })

            // 2. 수수료를 제외한 금액으로 KRW IOU 발행
            const issueResult = await this.issueKRW(userAddress, feeCalculation.netAmount)

            if (issueResult.success) {
                // 3. 처리 결과 로그
                console.log('Swap processing completed:', {
                    user: userAddress,
                    originalAmount: swapAmount,
                    fee: feeCalculation.fee,
                    issuedAmount: feeCalculation.netAmount,
                    txHash: issueResult.txHash
                })

                return {
                    success: true,
                    user: userAddress,
                    swapAmount: swapAmount,
                    fee: feeCalculation.fee,
                    issuedAmount: feeCalculation.netAmount,
                    txHash: issueResult.txHash,
                    swapDetails: swapDetails
                }
            } else {
                throw new Error(`Failed to issue KRW: ${issueResult.error}`)
            }

        } catch (error) {
            console.error('Error processing swap:', error)
            return {
                success: false,
                error: error.message,
                user: userAddress,
                swapAmount: swapAmount
            }
        }
    }

    /**
     * XRP -> IOU 스왑 처리 (어드민이 XRP를 받고 IOU 발행)
     */
    async processXRPToIOUSwap(userAddress, xrpAmount) {
        try {
            console.log(`Processing XRP to IOU swap for ${userAddress}, amount: ${xrpAmount}`)

            // 수수료 계산
            const feeCalculation = await this.calculateSwapFee('XRP_TO_KRW', xrpAmount)

            // KRW IOU 발행 (수수료 제외)
            const issueResult = await this.issueKRW(userAddress, feeCalculation.netAmount)

            if (issueResult.success) {
                return {
                    success: true,
                    xrpAmount: xrpAmount,
                    fee: feeCalculation.fee,
                    krwIssued: feeCalculation.netAmount,
                    txHash: issueResult.txHash
                }
            } else {
                throw new Error(`Failed to issue KRW: ${issueResult.error}`)
            }

        } catch (error) {
            console.error('Error in XRP to IOU swap:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * IOU -> XRP 스왑 처리 (어드민이 IOU를 받고 XRP 전송)
     */
    async processIOUToXRPSwap(userWallet, iouAmount) {
        const adminWallet = adminSystemService.getAdminWallet()
        if (!adminWallet) {
            return { success: false, error: 'Admin not initialized' }
        }

        const client = await XRPLService.connectClient()

        try {
            console.log(`Processing IOU to XRP swap for ${userWallet.address}, amount: ${iouAmount}`)

            // 1. 사용자가 IOU를 어드민에게 전송
            const returnPayment = {
                TransactionType: "Payment",
                Account: userWallet.address,
                Amount: {
                    currency: KRW_CURRENCY,
                    value: iouAmount.toString(),
                    issuer: adminWallet.address
                },
                Destination: adminWallet.address
            }

            const returnResult = await XRPLService.submitAndWait(client, userWallet, returnPayment)

            if (returnResult.success) {
                // 2. 수수료 계산
                const feeCalculation = await this.calculateSwapFee('KRW_TO_XRP', iouAmount)

                // 3. 어드민이 XRP를 사용자에게 전송 (수수료 제외)
                const xrpPayment = {
                    TransactionType: "Payment",
                    Account: adminWallet.address,
                    Amount: (feeCalculation.netAmount * 1000000).toString(), // XRP drops
                    Destination: userWallet.address
                }

                const xrpResult = await XRPLService.submitAndWait(client, adminWallet, xrpPayment)

                if (xrpResult.success) {
                    return {
                        success: true,
                        iouReturned: iouAmount,
                        fee: feeCalculation.fee,
                        xrpReceived: feeCalculation.netAmount,
                        returnTxHash: returnResult.txHash,
                        xrpTxHash: xrpResult.txHash
                    }
                } else {
                    throw new Error(`XRP payment failed: ${xrpResult.error}`)
                }
            } else {
                throw new Error(`IOU return failed: ${returnResult.error}`)
            }

        } catch (error) {
            console.error('Error in IOU to XRP swap:', error)
            return {
                success: false,
                error: error.message
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 발행된 IOU 총량 조회
     */
    async getTotalIssuedAmount() {
        const adminWallet = adminSystemService.getAdminWallet()
        if (!adminWallet) {
            return { success: false, error: 'Admin not initialized' }
        }

        const client = await XRPLService.connectClient()

        try {
            const linesResult = await XRPLService.getAccountLines(client, adminWallet.address)

            if (linesResult.success) {
                let totalIssued = 0

                linesResult.lines.forEach(line => {
                    if (line.currency === KRW_CURRENCY) {
                        // 음수 값은 발행된 IOU를 의미
                        totalIssued += Math.abs(parseFloat(line.balance))
                    }
                })

                return {
                    success: true,
                    totalIssued: totalIssued,
                    currency: KRW_CURRENCY
                }
            } else {
                throw new Error('Failed to get account lines')
            }

        } catch (error) {
            console.error('Error getting total issued amount:', error)
            return {
                success: false,
                error: error.message
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 환율 정보 조회
     */
    async getCurrentExchangeRate(baseCurrency = 'XRP', quoteCurrency = 'KRW') {
        try {
            const rate = await ExchangeRate.getCurrentRate(baseCurrency, quoteCurrency)

            if (rate) {
                return {
                    success: true,
                    rate: rate.rate,
                    bidRate: rate.bidRate,
                    askRate: rate.askRate,
                    spread: rate.spread,
                    lastUpdated: rate.updatedAt
                }
            } else {
                return {
                    success: false,
                    error: 'No exchange rate found'
                }
            }
        } catch (error) {
            console.error('Error getting exchange rate:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * XRP 금액을 KRW로 변환
     */
    async convertXRPToKRW(xrpAmount) {
        try {
            const rateInfo = await this.getCurrentExchangeRate('XRP', 'KRW')

            if (rateInfo.success) {
                return {
                    success: true,
                    xrpAmount: xrpAmount,
                    krwAmount: xrpAmount * rateInfo.rate,
                    rate: rateInfo.rate
                }
            } else {
                throw new Error('Exchange rate not available')
            }
        } catch (error) {
            console.error('Error converting XRP to KRW:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * KRW 금액을 XRP로 변환
     */
    async convertKRWToXRP(krwAmount) {
        try {
            const rateInfo = await this.getCurrentExchangeRate('XRP', 'KRW')

            if (rateInfo.success) {
                return {
                    success: true,
                    krwAmount: krwAmount,
                    xrpAmount: krwAmount / rateInfo.rate,
                    rate: rateInfo.rate
                }
            } else {
                throw new Error('Exchange rate not available')
            }
        } catch (error) {
            console.error('Error converting KRW to XRP:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 설정 정보 반환
     */
    getSettings() {
        return {
            currency: KRW_CURRENCY,
            feeRate: SWAP_FEE_RATE,
            feePercentage: `${SWAP_FEE_RATE * 100}%`,
            adminAddress: adminSystemService.getAdminAddress()
        }
    }
}

export default new AdminIOUService()