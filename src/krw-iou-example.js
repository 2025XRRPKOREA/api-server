const {
    initializeAdmin,
    issueKRW,
    calculateSwapFee,
    processSwapAndIssueKRW,
    getKRWBalance,
    createKRWTrustLine,
    ADMIN_WALLET,
    KRW_CURRENCY,
    SWAP_FEE_RATE
} = require('./services/krw-iou-system')

const xrpl = require('xrpl')

/**
 * 테스트용 사용자 계정 생성
 */
async function createTestUser() {
    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233/")
    await client.connect()

    try {
        const fundResult = await client.fundWallet()
        console.log(`Test user created: ${fundResult.wallet.address}`)
        console.log(`User seed: ${fundResult.wallet.seed}`)
        return fundResult.wallet
    } finally {
        await client.disconnect()
    }
}

/**
 * 전체 시스템 테스트 예제
 */
async function runExample() {
    console.log('=== KRW IOU System Example ===\n')

    try {
        // 1. 어드민 초기화
        console.log('1. Initializing admin account...')
        await initializeAdmin()
        console.log(`Admin address: ${ADMIN_WALLET().address}\n`)

        // 2. 테스트 사용자 생성
        console.log('2. Creating test user...')
        const testUser = await createTestUser()
        console.log('')

        // 3. 사용자가 KRW Trust Line 생성
        console.log('3. Creating KRW trust line for user...')
        const trustResult = await createKRWTrustLine(testUser.seed, "10000")
        if (!trustResult.success) {
            throw new Error(`Trust line creation failed: ${trustResult.error}`)
        }
        console.log('Trust line created successfully\n')

        // 4. 스왑 수수료 계산 예제
        console.log('4. Calculating swap fees...')
        const swapAmount = 1000  // 외부에서 받은 스왑 금액 (예: 1000 KRW 상당)
        const feeCalc = calculateSwapFee(swapAmount)
        console.log(`Original amount: ${feeCalc.grossAmount}`)
        console.log(`Fee (${SWAP_FEE_RATE * 100}%): ${feeCalc.fee}`)
        console.log(`Net amount: ${feeCalc.netAmount}\n`)

        // 5. 외부 스왑 처리 및 KRW 발행
        console.log('5. Processing external swap and issuing KRW...')
        const swapResult = await processSwapAndIssueKRW(
            testUser.address,
            swapAmount,
            {
                originalCurrency: 'USD',
                swapPlatform: 'ExternalDEX',
                timestamp: new Date().toISOString()
            }
        )

        if (swapResult.success) {
            console.log('Swap processed successfully!')
            console.log(`Transaction hash: ${swapResult.txHash}`)
            console.log(`Issued ${swapResult.issuedAmount} KRW to user\n`)
        } else {
            throw new Error(`Swap processing failed: ${swapResult.error}`)
        }

        // 6. 사용자 KRW 잔액 확인
        console.log('6. Checking user KRW balance...')
        const balance = await getKRWBalance(testUser.address)
        console.log(`User KRW balance: ${balance}\n`)

        // 7. 추가 KRW 직접 발행 예제
        console.log('7. Direct KRW issuance example...')
        const directIssueResult = await issueKRW(testUser.address, 500)
        if (directIssueResult.success) {
            console.log(`Additional 500 KRW issued. TX: ${directIssueResult.txHash}`)
        }

        // 8. 최종 잔액 확인
        console.log('\n8. Final balance check...')
        const finalBalance = await getKRWBalance(testUser.address)
        console.log(`Final user KRW balance: ${finalBalance}`)

        console.log('\n=== Example completed successfully ===')

    } catch (error) {
        console.error('Example failed:', error)
    }
}

/**
 * 다중 사용자 스왑 처리 예제
 */
async function runMultiUserExample() {
    console.log('\n=== Multi-User Swap Example ===\n')

    try {
        // 어드민 초기화
        await initializeAdmin()

        // 여러 사용자에 대한 스왑 처리
        const swapRequests = [
            { amount: 1500, userSeed: null },
            { amount: 2300, userSeed: null },
            { amount: 800, userSeed: null }
        ]

        for (let i = 0; i < swapRequests.length; i++) {
            console.log(`Processing swap for user ${i + 1}...`)

            // 사용자 생성
            const user = await createTestUser()
            swapRequests[i].userSeed = user.seed

            // Trust line 생성
            await createKRWTrustLine(user.seed)

            // 스왑 처리
            const result = await processSwapAndIssueKRW(
                user.address,
                swapRequests[i].amount,
                { userId: i + 1 }
            )

            if (result.success) {
                console.log(`User ${i + 1}: ${result.issuedAmount} KRW issued (fee: ${result.fee})`)
            } else {
                console.log(`User ${i + 1}: Failed - ${result.error}`)
            }
        }

        console.log('\n=== Multi-user example completed ===')

    } catch (error) {
        console.error('Multi-user example failed:', error)
    }
}

// 실행 함수
async function main() {
    const args = process.argv.slice(2)

    if (args.includes('--multi')) {
        await runMultiUserExample()
    } else {
        await runExample()
    }
}

// 스크립트 직접 실행시
if (require.main === module) {
    main().catch(console.error)
}

module.exports = {
    runExample,
    runMultiUserExample,
    createTestUser
}