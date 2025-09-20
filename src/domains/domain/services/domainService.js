import PermissionedDomain from '../models/PermissionedDomain.js';
import Admin from '../../admin/models/Admin.js';
import User from '../../user/models/User.js';
import ValidationService from '../../../shared/services/validationService.js';
import adminSystemService from '../../admin/services/adminSystemService.js';

class AdminDomainService {

    /**
     * Domain 생성/초기화
     */
    async initializeDomain(domainName = 'krw-iou.local') {
        try {
            const adminDbRecord = adminSystemService.getAdminDbRecord()
            if (!adminDbRecord) {
                throw new Error('Admin not initialized')
            }

            let domain = await PermissionedDomain.findOne({
                issuerId: adminDbRecord._id,
                domain: domainName
            })

            if (!domain) {
                domain = new PermissionedDomain({
                    domain: domainName,
                    issuerId: adminDbRecord._id,
                    issuerAddress: adminSystemService.getAdminAddress(),
                    domainType: 'whitelist',
                    status: 'active',
                    description: 'KRW IOU Permissioned Domain',
                    settings: {
                        requireKYC: false,
                        maxTrustLineAmount: "1000000",
                        autoApproval: true,
                        requireEmailVerification: false
                    }
                })

                await domain.save()
                console.log(`Permissioned domain created: ${domainName}`)
            }

            return domain
        } catch (error) {
            console.error('Error initializing domain:', error)
            throw error
        }
    }

    /**
     * 사용자가 Trust Line 생성 권한이 있는지 확인
     */
    async checkTrustLinePermission(userAddress) {
        try {
            if (!ValidationService.isValidXRPAddress(userAddress)) {
                return { allowed: false, reason: 'Invalid user address' }
            }

            const issuerAddress = adminSystemService.getAdminAddress()
            if (!issuerAddress) {
                return { allowed: false, reason: 'Admin not initialized' }
            }

            const domain = await PermissionedDomain.findOne({
                issuerAddress: issuerAddress,
                status: 'active'
            })

            if (!domain) {
                // Domain이 없으면 기본적으로 허용
                return { allowed: true, reason: 'No domain restrictions' }
            }

            const isAllowed = domain.isAccountAllowed(userAddress)

            return {
                allowed: isAllowed,
                domain: domain.domain,
                domainType: domain.domainType,
                reason: isAllowed ? 'Account is permitted' : 'Account not in whitelist or blocked'
            }
        } catch (error) {
            console.error('Error checking trust line permission:', error)
            return { allowed: false, reason: 'Permission check failed' }
        }
    }

    /**
     * 사용자를 화이트리스트에 추가
     */
    async addToWhitelist(userAddress, email, approvedBy = 'system') {
        try {
            if (!ValidationService.isValidXRPAddress(userAddress)) {
                return { success: false, error: 'Invalid user address' }
            }

            if (email && !ValidationService.isValidEmail(email)) {
                return { success: false, error: 'Invalid email address' }
            }

            const domain = await PermissionedDomain.findOne({
                status: 'active',
                domainType: { $in: ['whitelist', 'kyc_required'] }
            })

            if (!domain) {
                return { success: false, error: 'Active whitelist domain not found' }
            }

            domain.addToWhitelist(userAddress, email, approvedBy)
            await domain.save()

            return {
                success: true,
                message: 'User added to whitelist',
                domain: domain.domain
            }
        } catch (error) {
            console.error('Error adding to whitelist:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 사용자를 블랙리스트에 추가
     */
    async addToBlacklist(userAddress, reason, blockedBy = 'system') {
        try {
            if (!ValidationService.isValidXRPAddress(userAddress)) {
                return { success: false, error: 'Invalid user address' }
            }

            const domain = await PermissionedDomain.findOne({
                status: 'active'
            })

            if (!domain) {
                return { success: false, error: 'Active domain not found' }
            }

            domain.addToBlacklist(userAddress, reason, blockedBy)
            await domain.save()

            return {
                success: true,
                message: 'User added to blacklist',
                domain: domain.domain
            }
        } catch (error) {
            console.error('Error adding to blacklist:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * KYC 상태 업데이트
     */
    async updateKYCStatus(userAddress, status) {
        try {
            if (!ValidationService.isValidXRPAddress(userAddress)) {
                return { success: false, error: 'Invalid user address' }
            }

            if (!ValidationService.isValidKYCStatus(status)) {
                return { success: false, error: 'Invalid KYC status' }
            }

            const domain = await PermissionedDomain.findOne({
                status: 'active',
                'allowedAccounts.address': userAddress
            })

            if (!domain) {
                return { success: false, error: 'User not found in any domain' }
            }

            domain.updateKYCStatus(userAddress, status)
            await domain.save()

            return {
                success: true,
                message: `KYC status updated to ${status}`,
                domain: domain.domain
            }
        } catch (error) {
            console.error('Error updating KYC status:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 사용자 회원가입시 자동으로 화이트리스트에 추가
     */
    async autoAddUserToWhitelist(userId) {
        try {
            const user = await User.findById(userId)
            if (!user) {
                return { success: false, error: 'User not found' }
            }

            const domain = await PermissionedDomain.findOne({
                status: 'active',
                'settings.autoApproval': true
            })

            if (domain) {
                domain.addToWhitelist(user.wallet.address, user.email, 'auto_registration')
                await domain.save()

                console.log(`User ${user.email} auto-added to whitelist`)
                return { success: true, message: 'User auto-added to whitelist' }
            }

            return { success: false, error: 'Auto approval not enabled' }
        } catch (error) {
            console.error('Error auto-adding user to whitelist:', error)
            return { success: false, error: error.message }
        }
    }

    /**
     * Domain 설정 조회
     */
    async getDomainSettings() {
        try {
            const issuerAddress = adminSystemService.getAdminAddress()
            if (!issuerAddress) {
                return { success: false, error: 'Admin not initialized' }
            }

            const domain = await PermissionedDomain.findOne({
                issuerAddress: issuerAddress,
                status: 'active'
            })

            return domain ? {
                success: true,
                domain: domain.domain,
                domainType: domain.domainType,
                settings: domain.settings,
                allowedCount: domain.allowedAccounts.length,
                blockedCount: domain.blockedAccounts.length,
                status: domain.status,
                description: domain.description
            } : {
                success: false,
                error: 'Domain not found'
            }
        } catch (error) {
            console.error('Error getting domain settings:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 허용된 계정 목록 조회
     */
    async getAllowedAccounts(page = 1, limit = 20) {
        try {
            const { page: validPage, limit: validLimit } = ValidationService.validatePagination(page, limit)
            const issuerAddress = adminSystemService.getAdminAddress()

            if (!issuerAddress) {
                return { success: false, error: 'Admin not initialized' }
            }

            const domain = await PermissionedDomain.findOne({
                issuerAddress: issuerAddress,
                status: 'active'
            })

            if (!domain) {
                return { success: false, error: 'Domain not found' }
            }

            const startIndex = (validPage - 1) * validLimit
            const accounts = domain.allowedAccounts.slice(startIndex, startIndex + validLimit)

            return {
                success: true,
                accounts: accounts,
                total: domain.allowedAccounts.length,
                page: validPage,
                limit: validLimit,
                totalPages: Math.ceil(domain.allowedAccounts.length / validLimit)
            }
        } catch (error) {
            console.error('Error getting allowed accounts:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * 차단된 계정 목록 조회
     */
    async getBlockedAccounts(page = 1, limit = 20) {
        try {
            const { page: validPage, limit: validLimit } = ValidationService.validatePagination(page, limit)
            const issuerAddress = adminSystemService.getAdminAddress()

            if (!issuerAddress) {
                return { success: false, error: 'Admin not initialized' }
            }

            const domain = await PermissionedDomain.findOne({
                issuerAddress: issuerAddress,
                status: 'active'
            })

            if (!domain) {
                return { success: false, error: 'Domain not found' }
            }

            const startIndex = (validPage - 1) * validLimit
            const accounts = domain.blockedAccounts.slice(startIndex, startIndex + validLimit)

            return {
                success: true,
                accounts: accounts,
                total: domain.blockedAccounts.length,
                page: validPage,
                limit: validLimit,
                totalPages: Math.ceil(domain.blockedAccounts.length / validLimit)
            }
        } catch (error) {
            console.error('Error getting blocked accounts:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * Domain 설정 업데이트
     */
    async updateDomainSettings(newSettings) {
        try {
            const issuerAddress = adminSystemService.getAdminAddress()
            if (!issuerAddress) {
                return { success: false, error: 'Admin not initialized' }
            }

            const domain = await PermissionedDomain.findOne({
                issuerAddress: issuerAddress,
                status: 'active'
            })

            if (!domain) {
                return { success: false, error: 'Domain not found' }
            }

            // 설정 업데이트
            if (newSettings.requireKYC !== undefined) {
                domain.settings.requireKYC = newSettings.requireKYC
            }
            if (newSettings.maxTrustLineAmount !== undefined) {
                domain.settings.maxTrustLineAmount = newSettings.maxTrustLineAmount
            }
            if (newSettings.autoApproval !== undefined) {
                domain.settings.autoApproval = newSettings.autoApproval
            }
            if (newSettings.requireEmailVerification !== undefined) {
                domain.settings.requireEmailVerification = newSettings.requireEmailVerification
            }

            await domain.save()

            return {
                success: true,
                message: 'Domain settings updated',
                settings: domain.settings
            }
        } catch (error) {
            console.error('Error updating domain settings:', error)
            return {
                success: false,
                error: error.message
            }
        }
    }
}

export default new AdminDomainService();