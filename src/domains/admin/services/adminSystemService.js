const XRPLService = require('../../../shared/services/xrplService');
const SystemConfig = require('../models/Admin'); // Admin.js 파일이지만, 내부는 SystemConfig 모델
const User = require('../../user/models/User');
const xrpl = require('xrpl');

class AdminSystemService {

    constructor() {
        this.adminWallet = null;
        this.systemConfig = null;
        this.initialized = false;
    }

    /**
     * 시스템 초기화:
     * 1. SystemConfig 문서가 존재하는지 확인하고 없으면 생성합니다.
     * 2. 'admin' 역할을 가진 User가 존재하는지 확인하고 없으면 생성합니다.
     * 3. SystemConfig에서 관리자 지갑을 로드합니다.
     */
    async initializeSystem() {
        if (this.initialized) {
            return;
        }

        const client = await XRPLService.connectClient();

        try {
            // 1. 시스템 설정(SystemConfig) 초기화
            this.systemConfig = await SystemConfig.findOne({ configKey: 'main' });

            if (this.systemConfig && this.systemConfig.adminWallet && this.systemConfig.adminWallet.seed) {
                // 설정이 존재하면, 해당 지갑 복원
                this.adminWallet = xrpl.Wallet.fromSeed(this.systemConfig.adminWallet.seed);
                console.log(`Admin wallet restored from SystemConfig: ${this.adminWallet.address}`);
            } else {
                // 설정 또는 지갑이 없으면, 새로 생성
                console.log("Initializing new SystemConfig and admin wallet...");
                const fundResult = await client.fundWallet();
                this.adminWallet = fundResult.wallet;
                console.log(`New admin wallet funded: ${this.adminWallet.address}`);

                const walletData = {
                    address: this.adminWallet.address,
                    seed: this.adminWallet.seed,
                    publicKey: this.adminWallet.publicKey,
                    privateKey: this.adminWallet.privateKey
                };

                // findOneAndUpdate와 upsert 옵션으로 단일 설정 문서를 생성하거나 업데이트
                this.systemConfig = await SystemConfig.findOneAndUpdate(
                    { configKey: 'main' },
                    { $set: { adminWallet: walletData } },
                    { new: true, upsert: true }
                );
                console.log("SystemConfig document created/updated.");
            }

            // 2. 관리자 유저(Admin User) 초기화
            let adminUser = await User.findOne({ role: 'admin' });
            if (!adminUser) {
                console.log("Creating new admin user (admin/123123)...");
                adminUser = new User({
                    email: 'admin', // 로그인 ID로 'admin' 사용
                    password: '123123',
                    role: 'admin',
                    // User 스키마에 wallet 필드가 필수이므로, 시스템 지갑 주소를 넣어줌
                    wallet: {
                        address: this.adminWallet.address,
                        seed: 's***************************', // 보안상 저장 안함
                        publicKey: this.adminWallet.publicKey,
                        privateKey: 'p***************************' // 보안상 저장 안함
                    }
                });
                await adminUser.save();
                console.log("Admin user created successfully in Users collection.");
            }

            this.initialized = true;
            console.log("System initialized successfully.");

        } catch (error) {
            console.error('Error initializing system:', error);
            throw error;
        } finally {
            await client.disconnect();
        }
    }

    /**
     * XRPL에 Domain 설정
     */
    async setDomainOnXRPL(domainName = 'krw-iou.local') {
        if (!this.adminWallet) {
            throw new Error('System not initialized');
        }

        const client = await XRPLService.connectClient();

        try {
            const domainHex = Buffer.from(domainName, 'ascii').toString('hex').toUpperCase();

            const domainTx = {
                TransactionType: "AccountSet",
                Account: this.adminWallet.address,
                Domain: domainHex,
                SetFlag: 2, // asfRequireAuth
            };

            const result = await XRPLService.submitAndWait(client, this.adminWallet, domainTx);

            if (result.success) {
                console.log('Domain set on XRPL successfully');
                // SystemConfig에 도메인 정보 업데이트
                this.systemConfig.domain.name = domainName;
                this.systemConfig.domain.verified = true;
                await this.systemConfig.save();
                return { success: true, txHash: result.txHash };
            } else {
                throw new Error(`Domain setting failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Error setting domain on XRPL:', error);
            return { success: false, error: error.message };
        } finally {
            await client.disconnect();
        }
    }

    getAdminWallet() {
        return this.adminWallet;
    }

    getAdminAddress() {
        return this.adminWallet ? this.adminWallet.address : null;
    }
    
    getSystemConfig() {
        return this.systemConfig;
    }

    /**
     * 어드민 권한 확인
     */
    async verifyAdminPermissions(userId) {
        if (!userId) return false;
        try {
            const user = await User.findById(userId);
            return user && user.role === 'admin';
        } catch (error) {
            console.error("Error verifying admin permissions:", error);
            return false;
        }
    }
}

const adminSystemService = new AdminSystemService();
module.exports = adminSystemService;
