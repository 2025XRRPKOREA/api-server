const XRPLService = require('../../../shared/services/xrplService')
const Admin = require('../models/Admin')
const xrpl = require('xrpl')

class AdminSystemService {

    constructor() {
        this.adminWallet = null
        this.adminDbRecord = null
        this.initialized = false
    }

    /**
     * 어드민 시스템 초기화 (admin/123123으로 고정)
     */
    async initializeAdmin() {
        if (this.initialized && this.adminWallet) {
            return this.adminWallet
        }

        const client = await XRPLService.connectClient()

        try {
            // DB에서 기존 어드민 계정 확인
            this.adminDbRecord = await Admin.findOne({ username: 'admin' })

            if (this.adminDbRecord) {
                // 기존 어드민 계정이 있으면 복원
                this.adminWallet = xrpl.Wallet.fromSeed(this.adminDbRecord.wallet.seed)
                console.log(`Admin wallet restored from DB: ${this.adminWallet.address}`)

                // 계정 잔액 확인
                const balanceResult = await XRPLService.getXRPBalance(client, this.adminWallet.address)
                if (balanceResult.success) {
                    console.log(`Admin XRP balance: ${balanceResult.balance} XRP`)
                } else {
                    console.log('Admin account not yet funded on network')
                }
            } else {
                // 새 어드민 계정 생성
                console.log("Creating new admin account (admin/123123)...")
                const fundResult = await client.fundWallet()
                this.adminWallet = fundResult.wallet

                // DB에 어드민 계정 저장
                this.adminDbRecord = new Admin({
                    username: 'admin',
                    password: '123123',
                    wallet: {
                        address: this.adminWallet.address,
                        seed: this.adminWallet.seed,
                        publicKey: this.adminWallet.publicKey,
                        privateKey: this.adminWallet.privateKey
                    }
                })

                await this.adminDbRecord.save()
                console.log(`New admin created: ${this.adminWallet.address}`)
                console.log(`Admin credentials: admin/123123`)
            }

            this.initialized = true

        } catch (error) {
            console.error('Error initializing admin:', error)
            throw error
        } finally {
            await client.disconnect()
        }

        return this.adminWallet
    }

    /**
     * XRPL에 Domain 설정
     */
    async setDomainOnXRPL(domainName = 'krw-iou.local') {
        if (!this.adminWallet) {
            throw new Error('Admin not initialized')
        }

        const client = await XRPLService.connectClient()

        try {
            // Domain을 hex로 변환
            const domainHex = Buffer.from(domainName, 'ascii').toString('hex').toUpperCase()

            const domainTx = {
                TransactionType: "AccountSet",
                Account: this.adminWallet.address,
                Domain: domainHex,
                // RequireAuth 플래그 설정 (Trust Line 승인 필요)
                SetFlag: 2, // asfRequireAuth
            }

            const result = await XRPLService.submitAndWait(client, this.adminWallet, domainTx)

            if (result.success) {
                console.log('Domain set on XRPL successfully')

                // DB에 domain 설정 업데이트
                if (this.adminDbRecord) {
                    this.adminDbRecord.domain.name = domainName
                    this.adminDbRecord.domain.verified = true
                    await this.adminDbRecord.save()
                }

                return { success: true, txHash: result.txHash }
            } else {
                throw new Error(`Domain setting failed: ${result.error}`)
            }
        } catch (error) {
            console.error('Error setting domain on XRPL:', error)
            return { success: false, error: error.message }
        } finally {
            await client.disconnect()
        }
    }

    /**
     * 어드민 지갑 정보 반환
     */
    getAdminWallet() {
        return this.adminWallet
    }

    /**
     * 어드민 DB 레코드 반환
     */
    getAdminDbRecord() {
        return this.adminDbRecord
    }

    /**
     * 어드민 주소 반환
     */
    getAdminAddress() {
        return this.adminWallet ? this.adminWallet.address : null
    }

    /**
     * 시스템 상태 조회
     */
    async getSystemStatus() {
        const status = {
            adminInitialized: this.initialized,
            adminAddress: this.getAdminAddress(),
            networkInfo: XRPLService.getNetworkInfo(),
            timestamp: new Date().toISOString()
        }

        if (this.adminWallet) {
            const client = await XRPLService.connectClient()
            try {
                const balanceResult = await XRPLService.getXRPBalance(client, this.adminWallet.address)
                status.adminBalance = balanceResult.success ? balanceResult.balance : 'Unknown'

                const accountResult = await XRPLService.getAccountInfo(client, this.adminWallet.address)
                status.adminAccountInfo = accountResult.success ? accountResult.accountInfo : null
            } catch (error) {
                status.error = error.message
            } finally {
                await client.disconnect()
            }
        }

        return status
    }

    /**
     * 어드민 권한 확인
     */
    async verifyAdminPermissions(userId) {
        try {
            const admin = await Admin.findById(userId)
            return admin && admin.role === 'admin'
        } catch (error) {
            return false
        }
    }
}

// 싱글톤 인스턴스
const adminSystemService = new AdminSystemService()

module.exports = adminSystemService