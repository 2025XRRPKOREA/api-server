import * as xrpl from 'xrpl';

// 네트워크 설정 (개발용 - testnet 사용)
const NETWORK = "wss://s.altnet.rippletest.net:51233/"

class XRPLService {

    /**
     * XRPL 클라이언트 연결
     */
    static async connectClient() {
        const client = new xrpl.Client(NETWORK)
        await client.connect()
        return client
    }

    /**
     * 트랜잭션 제출 및 대기
     */
    static async submitAndWait(client, wallet, transaction) {
        try {
            const prepared = await client.autofill(transaction)
            const signed = wallet.sign(prepared)
            const result = await client.submitAndWait(signed.tx_blob)

            return {
                success: result.result.meta.TransactionResult === "tesSUCCESS",
                result: result.result,
                txHash: result.result.hash,
                error: result.result.meta.TransactionResult !== "tesSUCCESS"
                    ? result.result.meta.TransactionResult
                    : null
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                result: null,
                txHash: null
            }
        }
    }

    /**
     * 계정 잔액 조회
     */
    static async getXRPBalance(client, address) {
        try {
            const balance = await client.getXrpBalance(address)
            return { success: true, balance }
        } catch (error) {
            return { success: false, error: error.message, balance: 0 }
        }
    }

    /**
     * 계정 정보 조회
     */
    static async getAccountInfo(client, address) {
        try {
            const response = await client.request({
                command: "account_info",
                account: address,
                ledger_index: "validated"
            })
            return { success: true, accountInfo: response.result.account_data }
        } catch (error) {
            return { success: false, error: error.message, accountInfo: null }
        }
    }

    /**
     * Trust Line 조회
     */
    static async getAccountLines(client, address) {
        try {
            const response = await client.request({
                command: "account_lines",
                account: address,
                ledger_index: "validated"
            })
            return { success: true, lines: response.result.lines }
        } catch (error) {
            return { success: false, error: error.message, lines: [] }
        }
    }

    /**
     * 오더북 조회
     */
    static async getOrderBook(client, takerGets, takerPays, limit = 20) {
        try {
            const response = await client.request({
                command: "book_offers",
                taker_gets: takerGets,
                taker_pays: takerPays,
                limit: limit
            })
            return { success: true, offers: response.result.offers }
        } catch (error) {
            return { success: false, error: error.message, offers: [] }
        }
    }

    /**
     * 네트워크 정보
     */
    static getNetworkInfo() {
        return {
            network: NETWORK,
            isTestnet: true,
            networkName: "XRP Testnet"
        }
    }

    /**
     * 주소 유효성 검증
     */
    static isValidAddress(address) {
        try {
            return xrpl.isValidAddress(address)
        } catch (error) {
            return false
        }
    }

    /**
     * Currency 형식 검증
     */
    static isValidCurrency(currency) {
        try {
            return typeof currency === 'string' && currency.length === 3
        } catch (error) {
            return false
        }
    }
}

export default XRPLService;