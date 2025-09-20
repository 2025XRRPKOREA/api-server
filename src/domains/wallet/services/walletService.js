import XRPLService from '../../../shared/services/xrplService.js';
import ValidationService from '../../../shared/services/validationService.js';
import adminDomainService from '../../domain/services/domainService.js';
import adminSystemService from '../../admin/services/adminSystemService.js';
import * as xrpl from 'xrpl';

// KRW IOU 설정
const KRW_CURRENCY = "KRW"

class UserWalletService {

    /**
     * 사용자의 XRP 잔액 조회
     */
    async getXRPBalance(userAddress) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        const client = await XRPLService.connectClient()

        try {
            const result = await XRPLService.getXRPBalance(client, userAddress)
            return result
        } catch (error) {
            return { success: false, error: error.message }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 사용자의 계정 정보 조회
     */
    async getAccountInfo(userAddress) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        const client = await XRPLService.connectClient()

        try {
            const result = await XRPLService.getAccountInfo(client, userAddress)
            return result
        } catch (error) {
            return { success: false, error: error.message }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 사용자의 KRW IOU 잔액 조회
     */
    async getKRWBalance(userAddress) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        const adminAddress = adminSystemService.getAdminAddress()
        if (!adminAddress) {
            return { success: false, error: 'Admin not initialized' }
        }

        const client = await XRPLService.connectClient()

        try {
            const linesResult = await XRPLService.getAccountLines(client, userAddress)

            if (linesResult.success) {
                const krwLine = linesResult.lines.find(line =>
                    line.currency === KRW_CURRENCY && line.account === adminAddress
                )

                return {
                    success: true,
                    balance: krwLine ? parseFloat(krwLine.balance) : 0,
                    currency: KRW_CURRENCY,
                    issuer: adminAddress
                }
            } else {
                throw new Error('Failed to get account lines')
            }

        } catch (error) {
            console.error('Error getting KRW balance:', error)
            return {
                success: false,
                error: error.message,
                balance: 0
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * Trust Line 생성 (Permissioned Domain 검증 포함)
     */
    async createKRWTrustLine(userSeed, limitAmount = "1000000") {
        if (!ValidationService.isValidSeed(userSeed)) {
            return { success: false, error: 'Invalid user seed' }
        }

        if (!ValidationService.isValidTrustLineLimit(limitAmount)) {
            return { success: false, error: 'Invalid trust line limit amount' }
        }

        const adminAddress = adminSystemService.getAdminAddress()
        if (!adminAddress) {
            return { success: false, error: 'Admin not initialized' }
        }

        const client = await XRPLService.connectClient()

        try {
            const userWallet = xrpl.Wallet.fromSeed(userSeed)

            // Permissioned Domain 권한 확인
            const permission = await adminDomainService.checkTrustLinePermission(userWallet.address)

            if (!permission.allowed) {
                return {
                    success: false,
                    error: `Trust line not permitted: ${permission.reason}`,
                    permissionDetails: permission
                }
            }

            const trustSet = {
                TransactionType: "TrustSet",
                Account: userWallet.address,
                LimitAmount: {
                    currency: KRW_CURRENCY,
                    issuer: adminAddress,
                    value: limitAmount
                }
            }

            const result = await XRPLService.submitAndWait(client, userWallet, trustSet)

            if (result.success) {
                console.log(`Trust line created for ${userWallet.address}`)

                // 성공시 사용자 정보 기록 (선택사항)
                if (permission.domain) {
                    console.log(`Trust line approved by domain: ${permission.domain}`)
                }

                return {
                    success: true,
                    userAddress: userWallet.address,
                    txHash: result.txHash,
                    permissionDetails: permission,
                    limitAmount: limitAmount,
                    currency: KRW_CURRENCY,
                    issuer: adminAddress
                }
            } else {
                throw new Error(`Trust line creation failed: ${result.error}`)
            }

        } catch (error) {
            console.error('Error creating trust line:', error)
            return {
                success: false,
                error: error.message
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 사용자의 모든 Trust Line 조회
     */
    async getAllTrustLines(userAddress) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        const client = await XRPLService.connectClient()

        try {
            const linesResult = await XRPLService.getAccountLines(client, userAddress)

            if (linesResult.success) {
                return {
                    success: true,
                    trustLines: linesResult.lines,
                    count: linesResult.lines.length
                }
            } else {
                throw new Error('Failed to get trust lines')
            }

        } catch (error) {
            console.error('Error getting trust lines:', error)
            return {
                success: false,
                error: error.message,
                trustLines: []
            }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 사용자 지갑 주소 유효성 검증
     */
    validateAddress(address) {
        return {
            isValid: ValidationService.isValidXRPAddress(address),
            address: address
        }
    }

    /**
     * 사용자의 계정 활성화 상태 확인
     */
    async isAccountActivated(userAddress) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        const accountInfo = await this.getAccountInfo(userAddress)

        return {
            success: true,
            isActivated: accountInfo.success && accountInfo.accountInfo !== null,
            accountInfo: accountInfo.accountInfo
        }
    }

    /**
     * Trust Line 권한 확인
     */
    async checkTrustLinePermission(userAddress) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        try {
            const permission = await adminDomainService.checkTrustLinePermission(userAddress)
            return {
                success: true,
                permission: permission
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 사용자 지갑 요약 정보
     */
    async getWalletSummary(userAddress) {
        if (!ValidationService.isValidXRPAddress(userAddress)) {
            return { success: false, error: 'Invalid user address' }
        }

        try {
            const [xrpBalance, krwBalance, accountInfo, trustLines] = await Promise.all([
                this.getXRPBalance(userAddress),
                this.getKRWBalance(userAddress),
                this.getAccountInfo(userAddress),
                this.getAllTrustLines(userAddress)
            ])

            return {
                success: true,
                address: userAddress,
                xrpBalance: xrpBalance.success ? xrpBalance.balance : 0,
                krwBalance: krwBalance.success ? krwBalance.balance : 0,
                isActivated: accountInfo.success && accountInfo.accountInfo !== null,
                trustLineCount: trustLines.success ? trustLines.count : 0,
                accountInfo: accountInfo.success ? accountInfo.accountInfo : null,
                networkInfo: XRPLService.getNetworkInfo()
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    }
}

export default new UserWalletService();