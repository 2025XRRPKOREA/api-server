import express from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.js';
import User from '../../user/models/User.js';
import userIOUService from '../../iou/services/userIOUService.js';
import userTradingService from '../services/tradingService.js';
import Transaction from '../models/Transaction.js';
import { v4 as uuidv4 } from 'uuid';
import { Client, Wallet } from 'xrpl';
import ExchangeRate from '../../swap/models/ExchangeRate.js';


const router = express.Router()

/**
 * @swagger
 * tags:
 *   - name: Swap
 *     description: XRP ↔ IOU 스왑
 *   - name: Transaction
 *     description: IOU 전송 및 P2P 거래
 *   - name: Market
 *     description: 시장 정보 및 거래 내역
 */

// === IOU 스왑 기능 ===

/**
 * @swagger
 * /api/transaction/swap/xrp-to-krw:
 *   post:
 *     summary: XRP를 KRW IOU로 스왑
 *     tags: [Swap]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [xrpAmount]
 *             properties:
 *               xrpAmount:
 *                 type: number
 *                 description: 스왑할 XRP 수량
 *     responses:
 *       '200':
 *         description: 스왑 요청 성공
 *       '400':
 *         description: 잘못된 요청
 */
router.post('/swap/xrp-to-krw', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { xrpAmount } = req.body

    if (!xrpAmount || xrpAmount <= 0) {
      return res.status(400).json({ error: 'Valid XRP amount is required' })
    }

    const result = await userIOUService.requestXRPToIOUSwap(user.wallet.address, xrpAmount)
    res.json(result)

  } catch (error) {
    console.error('Error swapping XRP to KRW:', error)
    res.status(500).json({ error: 'Failed to swap XRP to KRW' })
  }
})

/**
 * @swagger
 * /api/transaction/swap/krw-to-xrp:
 *   post:
 *     summary: KRW IOU를 XRP로 스왑
 *     tags: [Swap]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [iouAmount]
 *             properties:
 *               iouAmount:
 *                 type: number
 *                 description: 스왑할 KRW IOU 수량
 *     responses:
 *       '200':
 *         description: 스왑 요청 성공
 *       '400':
 *         description: 잘못된 요청
 */
router.post('/swap/krw-to-xrp', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { iouAmount } = req.body

    if (!iouAmount || iouAmount <= 0) {
      return res.status(400).json({ error: 'Valid IOU amount is required' })
    }

    if (!user.wallet.seed) {
      return res.status(400).json({ error: 'User wallet seed not available' })
    }

    const result = await userIOUService.requestIOUToXRPSwap(user.wallet.seed, iouAmount)
    res.json(result)

  } catch (error) {
    console.error('Error swapping KRW to XRP:', error)
    res.status(500).json({ error: 'Failed to swap KRW to XRP' })
  }
})

/**
 * @swagger
 * /api/transaction/swap/calculate-fee:
 *   post:
 *     summary: 스왑 수수료 미리보기 계산
 *     tags: [Swap]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [swapType, amount]
 *             properties:
 *               swapType:
 *                 type: string
 *                 enum: [XRP_TO_KRW, KRW_TO_XRP, IOU_TRANSFER]
 *                 description: 스왑 또는 전송 유형
 *               amount:
 *                 type: number
 *                 description: 계산할 수량
 *     responses:
 *       '200':
 *         description: 수수료 계산 결과
 *       '400':
 *         description: 잘못된 요청
 */
router.post('/swap/calculate-fee', async (req, res) => {
  try {
    const { swapType, amount } = req.body

    if (!swapType || !amount || amount <= 0) {
      return res.status(400).json({ error: 'swapType and valid amount are required' })
    }

    if (!['XRP_TO_KRW', 'KRW_TO_XRP', 'IOU_TRANSFER'].includes(swapType)) {
      return res.status(400).json({ error: 'Invalid swap type' })
    }

    const result = await userIOUService.calculateSwapPreview(swapType, amount)
    res.json(result)

  } catch (error) {
    console.error('Error calculating fee:', error)
    res.status(500).json({ error: 'Failed to calculate fee' })
  }
})


/**
 * @swagger
 * /api/transaction/convert/xrp-to-krw:
 *   post:
 *     summary: XRP를 KRW로 환산 (실시간 환율 기준)
 *     tags: [Market]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [xrpAmount]
 *             properties:
 *               xrpAmount:
 *                 type: number
 *     responses:
 *       '200':
 *         description: 환산 결과
 */
router.post('/convert/xrp-to-krw', async (req, res) => {
  try {
    const { xrpAmount } = req.body

    if (!xrpAmount || xrpAmount <= 0) {
      return res.status(400).json({ error: 'Valid XRP amount is required' })
    }

    const result = await userIOUService.convertXRPToKRW(xrpAmount)
    res.json(result)

  } catch (error) {
    console.error('Error converting XRP to KRW:', error)
    res.status(500).json({ error: 'Failed to convert XRP to KRW' })
  }
})

/**
 * @swagger
 * /api/transaction/convert/krw-to-xrp:
 *   post:
 *     summary: KRW를 XRP로 환산 (실시간 환율 기준)
 *     tags: [Market]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [krwAmount]
 *             properties:
 *               krwAmount:
 *                 type: number
 *     responses:
 *       '200':
 *         description: 환산 결과
 */
router.post('/convert/krw-to-xrp', async (req, res) => {
  try {
    const { krwAmount } = req.body

    if (!krwAmount || krwAmount <= 0) {
      return res.status(400).json({ error: 'Valid KRW amount is required' })
    }

    const result = await userIOUService.convertKRWToXRP(krwAmount)
    res.json(result)

  } catch (error) {
    console.error('Error converting KRW to XRP:', error)
    res.status(500).json({ error: 'Failed to convert KRW to XRP' })
  }
})

// === IOU 전송 기능 ===

/**
 * @swagger
 * /api/transaction/transfer:
 *   post:
 *     summary: KRW IOU P2P 전송
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipientAddress, amount]
 *             properties:
 *               recipientAddress:
 *                 type: string
 *                 description: 받는 사람 주소
 *               amount:
 *                 type: number
 *                 description: 보낼 IOU 수량
 *               memo:
 *                 type: string
 *                 description: (선택) 거래 메모
 *     responses:
 *       '200':
 *         description: 전송 성공
 */
router.post('/transfer', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { recipientAddress, amount, memo } = req.body

    if (!recipientAddress || !amount) {
      return res.status(400).json({ error: 'Recipient address and amount are required' })
    }

    if (!user.wallet.seed) {
      return res.status(400).json({ error: 'User wallet seed not available' })
    }

    const result = await userIOUService.transferIOU(
      user.wallet.seed,
      recipientAddress,
      amount,
      memo
    )
    res.json(result)

  } catch (error) {
    console.error('Error transferring IOU:', error)
    res.status(500).json({ error: 'Failed to transfer IOU' })
  }
})

// === 거래 기능 ===

/**
 * @swagger
 * /api/transaction/orderbook:
 *   get:
 *     summary: 오더북 조회
 *     tags: [Transaction]
 *     parameters:
 *       - in: query
 *         name: base
 *         schema:
 *           type: string
 *           default: 'XRP'
 *         description: 기준 통화
 *       - in: query
 *         name: counter
 *         schema:
 *           type: string
 *           default: 'KRW'
 *         description: 상대 통화
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 조회할 오더 수
 *     responses:
 *       '200':
 *         description: 오더북 조회 성공
 */
router.get('/orderbook', async (req, res) => {
  try {
    const { base = 'XRP', counter = 'KRW', limit = 20 } = req.query

    const result = await userTradingService.getOrderBook(base, counter, parseInt(limit))
    res.json(result)

  } catch (error) {
    console.error('Error getting order book:', error)
    res.status(500).json({ error: 'Failed to get order book' })
  }
})

/**
 * @swagger
 * /api/transaction/offer/create:
 *   post:
 *     summary: P2P 거래 오퍼 생성
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: TakerGets와 TakerPays 객체. XRP는 drops 단위(1 XRP = 1,000,000 drops)로 입력해야 합니다.
 *             example:
 *               takerGets: "1000000" # 1 XRP
 *               takerPays:
 *                 currency: "KRW"
 *                 issuer: "rPsmM6CemP2JVXnEmY6q5vP6kX2n2K2F3J" # Admin 주소
 *                 value: "500"
 *             properties:
 *               takerGets:
 *                 type: object
 *                 description: 받고자 하는 자산
 *               takerPays:
 *                 type: object
 *                 description: 지불하고자 하는 자산
 *               expiration:
 *                 type: number
 *                 description: (선택) 오퍼 만료 시간 (Unix time)
 *     responses:
 *       '200':
 *         description: 오퍼 생성 성공
 */
router.post('/offer/create', authMiddleware, async (req, res) => {
  const client = new Client("wss://s.devnet.rippletest.net:51233");

  try {
    await client.connect();
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { price, iou } = req.body

    if (!price || !iou) {
      return res.status(400).json({ error: 'bad request' })
    }

    const uuid = uuidv4();
    const transaction = new Transaction({
      price: price,
      iou: iou,
      receiverWallet: user.wallet,
      qrCode: uuid
    })
    await transaction.save()
    return res.status(200).json({qrCode: uuid});
  } catch (error) {
    console.error('Error creating offer:', error)
    return res.status(500).json({ error: 'Failed to create offer' })
  } finally {
    await client.disconnect();
  }
})

router.post('/offer/finish', authMiddleware, async (req, res) => {
  const client = new Client("wss://s.devnet.rippletest.net:51233");

  try {
    await client.connect();
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { uuid } = req.body

    if (!uuid) {
      return res.status(400).json({ error: 'bad request' })
    }

    const transaction = await Transaction.findOne({ qrCode: uuid});
    transaction.senderWallet = user.wallet;

    const adminWallet = Wallet.fromSeed("sEdSc1R6ZckunYrdi6iG61EKmDAkBY2");
    const userWallet = Wallet.fromSeed(user.wallet.seed);

    // Note: ExchangeRate import needs to be added when converting exchange models
    const latestRecord = await ExchangeRate.findOne({ quoteCurrency: transaction.iou })
            .sort({ createdAt: -1 }) 
            .exec();

    const tx = {
      TransactionType: "Payment",
      Account: userWallet.address,
      Destination: transaction.receiverWallet.address,
      Amount: {
        currency: transaction.iou,
        issuer: adminWallet.address,
        value: Math.floor(transaction.price/latestRecord.rate).toString(),
      },
    };

    const prepared = await client.autofill(tx);
    const signed = userWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    transaction.isSuccess=true;
    await transaction.save()
    return res.status(200).json({qrCode: uuid});
  } catch (error) {
    console.error('Error creating offer:', error)
    return res.status(500).json({ error: 'Failed to create offer' })
  } finally {
    await client.disconnect();
  }
})

/**
 * @swagger
 * /api/transaction/offers:
 *   get:
 *     summary: 나의 활성 오퍼 목록 조회
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 조회할 오퍼 수
 *     responses:
 *       '200':
 *         description: 오퍼 목록 조회 성공
 */
router.get('/offers', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { limit = 20 } = req.query

    const result = await userTradingService.getUserOffers(user.wallet.address, parseInt(limit))
    res.json(result)

  } catch (error) {
    console.error('Error getting user offers:', error)
    res.status(500).json({ error: 'Failed to get user offers' })
  }
})

/**
 * @swagger
 * /api/transaction/offer/cancel:
 *   post:
 *     summary: 오퍼 취소
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [offerSequence]
 *             properties:
 *               offerSequence:
 *                 type: number
 *                 description: 취소할 오퍼의 시퀀스 번호
 *     responses:
 *       '200':
 *         description: 오퍼 취소 성공
 */
router.post('/offer/cancel', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { offerSequence } = req.body

    if (!offerSequence) {
      return res.status(400).json({ error: 'Offer sequence is required' })
    }

    if (!user.wallet.seed) {
      return res.status(400).json({ error: 'User wallet seed not available' })
    }

    const result = await userTradingService.cancelOffer(user.wallet.seed, offerSequence)
    res.json(result)

  } catch (error) {
    console.error('Error cancelling offer:', error)
    res.status(500).json({ error: 'Failed to cancel offer' })
  }
})

// === 시장 정보 ===

/**
 * @swagger
 * /api/transaction/market/price:
 *   get:
 *     summary: 현재 시장가 조회
 *     tags: [Market]
 *     parameters:
 *       - in: query
 *         name: base
 *         schema:
 *           type: string
 *           default: 'XRP'
 *       - in: query
 *         name: counter
 *         schema:
 *           type: string
 *           default: 'KRW'
 *     responses:
 *       '200':
 *         description: 시장가 조회 성공
 */
router.get('/market/price', async (req, res) => {
  try {
    const { base = 'XRP', counter = 'KRW' } = req.query

    const result = await userTradingService.getMarketPrice(base, counter)
    res.json(result)

  } catch (error) {
    console.error('Error getting market price:', error)
    res.status(500).json({ error: 'Failed to get market price' })
  }
})

/**
 * @swagger
 * /api/transaction/market/pairs:
 *   get:
 *     summary: 거래 가능한 통화쌍 목록 조회
 *     tags: [Market]
 *     responses:
 *       '200':
 *         description: 통화쌍 목록 조회 성공
 */
router.get('/market/pairs', (req, res) => {
  try {
    const result = userTradingService.getTradingPairs()
    res.json(result)

  } catch (error) {
    console.error('Error getting trading pairs:', error)
    res.status(500).json({ error: 'Failed to get trading pairs' })
  }
})

/**
 * @swagger
 * /api/transaction/market/info:
 *   get:
 *     summary: KRW IOU 시장 정보 조회
 *     tags: [Market]
 *     responses:
 *       '200':
 *         description: 시장 정보 조회 성공
 */
router.get('/market/info', async (req, res) => {
  try {
    const result = await userIOUService.getIOUMarketInfo()
    res.json(result)

  } catch (error) {
    console.error('Error getting market info:', error)
    res.status(500).json({ error: 'Failed to get market info' })
  }
})

// === 거래 내역 및 통계 ===

/**
 * @swagger
 * /api/transaction/history:
 *   get:
 *     summary: 나의 IOU 거래 내역 조회
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 조회할 거래 내역 수
 *     responses:
 *       '200':
 *         description: 거래 내역 조회 성공
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { limit = 10 } = req.query

    const result = await userIOUService.getIOUTransactionHistory(user.wallet.address, parseInt(limit))
    res.json(result)

  } catch (error) {
    console.error('Error getting transaction history:', error)
    res.status(500).json({ error: 'Failed to get transaction history' })
  }
})

/**
 * @swagger
 * /api/transaction/stats:
 *   get:
 *     summary: 나의 거래 통계 조회
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           default: '24h'
 *         description: 조회 기간 (e.g., 24h, 7d, 30d)
 *     responses:
 *       '200':
 *         description: 거래 통계 조회 성공
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { period = '24h' } = req.query

    const result = await userTradingService.getTradingStats(user.wallet.address, period)
    res.json(result)

  } catch (error) {
    console.error('Error getting trading stats:', error)
    res.status(500).json({ error: 'Failed to get trading stats' })
  }
})

export default router;
