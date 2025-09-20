const XRPLService = require('./xrplService')

class ValidationService {

    /**
     * 이메일 유효성 검증
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    /**
     * 패스워드 유효성 검증
     */
    static isValidPassword(password) {
        return typeof password === 'string' && password.length >= 6
    }

    /**
     * XRP 주소 유효성 검증
     */
    static isValidXRPAddress(address) {
        return XRPLService.isValidAddress(address)
    }

    /**
     * 금액 유효성 검증
     */
    static isValidAmount(amount) {
        const num = parseFloat(amount)
        return !isNaN(num) && num > 0 && num <= 100000000 // 1억 이하
    }

    /**
     * 시드 유효성 검증
     */
    static isValidSeed(seed) {
        return typeof seed === 'string' && seed.length > 20
    }

    /**
     * JWT 토큰 유효성 검증
     */
    static isValidJWT(token) {
        return typeof token === 'string' && token.split('.').length === 3
    }

    /**
     * 도메인 이름 유효성 검증
     */
    static isValidDomainName(domain) {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/
        return domainRegex.test(domain)
    }

    /**
     * KYC 상태 유효성 검증
     */
    static isValidKYCStatus(status) {
        return ['pending', 'verified', 'rejected'].includes(status)
    }

    /**
     * 통화 코드 유효성 검증
     */
    static isValidCurrencyCode(currency) {
        return XRPLService.isValidCurrency(currency)
    }

    /**
     * 페이지네이션 매개변수 검증
     */
    static validatePagination(page, limit) {
        const pageNum = parseInt(page) || 1
        const limitNum = parseInt(limit) || 20

        return {
            page: Math.max(1, pageNum),
            limit: Math.min(Math.max(1, limitNum), 100) // 최대 100개
        }
    }

    /**
     * Trust Line limit amount 검증
     */
    static isValidTrustLineLimit(limit) {
        const num = parseFloat(limit)
        return !isNaN(num) && num > 0 && num <= 1000000000 // 10억 이하
    }

    /**
     * 요청 본문 필수 필드 검증
     */
    static validateRequiredFields(body, requiredFields) {
        const missing = []

        for (const field of requiredFields) {
            if (!body[field]) {
                missing.push(field)
            }
        }

        return {
            isValid: missing.length === 0,
            missingFields: missing
        }
    }

    /**
     * IOU 거래 매개변수 검증
     */
    static validateIOUTransaction(amount, currency, issuer) {
        const errors = []

        if (!this.isValidAmount(amount)) {
            errors.push('Invalid amount')
        }

        if (!this.isValidCurrencyCode(currency)) {
            errors.push('Invalid currency code')
        }

        if (!this.isValidXRPAddress(issuer)) {
            errors.push('Invalid issuer address')
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        }
    }

    /**
     * 오퍼 생성 매개변수 검증
     */
    static validateOfferParams(takerGets, takerPays) {
        const errors = []

        // TakerGets 검증
        if (typeof takerGets === 'string') {
            // XRP인 경우
            if (!this.isValidAmount(takerGets)) {
                errors.push('Invalid TakerGets amount')
            }
        } else if (typeof takerGets === 'object') {
            // IOU인 경우
            if (!this.validateIOUTransaction(takerGets.value, takerGets.currency, takerGets.issuer).isValid) {
                errors.push('Invalid TakerGets IOU parameters')
            }
        } else {
            errors.push('Invalid TakerGets format')
        }

        // TakerPays 검증 (동일한 로직)
        if (typeof takerPays === 'string') {
            if (!this.isValidAmount(takerPays)) {
                errors.push('Invalid TakerPays amount')
            }
        } else if (typeof takerPays === 'object') {
            if (!this.validateIOUTransaction(takerPays.value, takerPays.currency, takerPays.issuer).isValid) {
                errors.push('Invalid TakerPays IOU parameters')
            }
        } else {
            errors.push('Invalid TakerPays format')
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        }
    }
}

module.exports = ValidationService