import express from 'express'
import { authMiddleware } from '../../../shared/middleware/auth.js'
import User from '../../user/models/User.js'
import userIOUService from '../../iou/services/userIOUService.js'
import exchangeRateService from '../services/exchangeRateService.js'
import { Client, Wallet } from 'xrpl';
import PermissionedDomain from '../../domain/models/PermissionedDomain.js';


const router = express.Router()

// === 스왑 기능 ===

router.post('/xrp-to-krw', authMiddleware, async (req, res) => {
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

// KRW → XRP 스왑
router.post('/krw-to-xrp', authMiddleware, async (req, res) => {
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


// // XRP → KRW 스왑
// router.post('/xrp-to-iou', authMiddleware, async (req, res) => {
//   const client = new Client("wss://s.devnet.rippletest.net:51233");

//   try {
//     await client.connect();
//     const user = await User.findById(req.userId)
//     if (!user) {
//       return res.status(404).json({ error: 'User not found' })
//     }

//     const { amount, ratio } = req.body

//     if (!amount || !ratio) {
//       return res.status(400).json({ error: 'Valid XRP amount is required' })
//     }

//     const issuer = Wallet.fromSeed("sEdSc1R6ZckunYrdi6iG61EKmDAkBY2"); 
//     const subject = Wallet.fromSeed(user.wallet.seed);

//     const credentialCreateTx = {
//       TransactionType: "CredentialCreate",
//       Account: issuer.address, 
//       Subject: subject.address, 
//       CredentialType: toHex("DEX"), 
//       Expiration: now() + 3600, 
//       URI: toHex("https://example.com/credentials/kyc/user"),
//     };
//     const credentialCreatePrepared = await client.autofill(credentialCreateTx);
//     const credentialCreateSigned = issuer.sign(credentialCreatePrepared);
//     const credentialCreateResult = await client.submitAndWait(credentialCreateSigned.tx_blob);
//     console.log(credentialCreateResult);

//     const credentialAcceptTx = {
//       TransactionType: "CredentialAccept",
//       Account: subject.address, 
//       Issuer: issuer.address,
//       CredentialType: toHex("DEX"), 
//     };
//     const credentialAcceptPrepared = await client.autofill(credentialAcceptTx);
//     const credentialAcceptSigned = subject.sign(credentialAcceptPrepared);
//     const credentialAcceptResult = await client.submitAndWait(credentialAcceptSigned.tx_blob);
//     console.log(credentialAcceptResult);

//     const domain = await PermissionedDomain.findOne().sort({ _id: -1 }).exec();

//     const offerTx = {
//       TransactionType: "OfferCreate",
//       Account: user.address,
//       TakerGets: { currency: iou, issuer: admin.address, value: amount },
//       TakerPays: (amount*ratio).toString(), 
//       DomainID: domain.id,
//       ...(HYBRID ? { Flags: TF_HYBRID } : {}),
//     };

//     const offerPrepared = await client.autofill(offerTx);
//     const offerSigned = user.sign(offerPrepared);
//     const offerResult = await client.submitAndWait(offerSigned.tx_blob);
//     console.log(offerResult);

//     res.json({success: true})

//   } catch (error) {
//     console.error('Error swapping XRP to KRW:', error)
//     res.status(500).json({ error: 'Failed to swap XRP to KRW' })
//   }finally {
//     await client.disconnect();
//   }
// })

// // KRW → XRP 스왑
// router.post('/iou-to-xrp', authMiddleware, async (req, res) => {
//     const client = new Client("wss://s.devnet.rippletest.net:51233");

//   try {
//      await client.connect();
//     const user = await User.findById(req.userId)
//     if (!user) {
//       return res.status(404).json({ error: 'User not found' })
//     }

//     const { amount, ratio } = req.body

//     if (!amount || !ratio <= 0) {
//       return res.status(400).json({ error: 'Valid IOU amount is required' })
//     }

//         const issuer = Wallet.fromSeed("sEdSc1R6ZckunYrdi6iG61EKmDAkBY2"); 
//     const subject = Wallet.fromSeed(user.wallet.seed);

//     const credentialCreateTx = {
//       TransactionType: "CredentialCreate",
//       Account: issuer.address, 
//       Subject: subject.address, 
//       CredentialType: toHex("DEX"), 
//       Expiration: now() + 3600, 
//       URI: toHex("https://example.com/credentials/kyc/user"),
//     };
//     const credentialCreatePrepared = await client.autofill(credentialCreateTx);
//     const credentialCreateSigned = issuer.sign(credentialCreatePrepared);
//     const credentialCreateResult = await client.submitAndWait(credentialCreateSigned.tx_blob);
//     console.log(credentialCreateResult);

//     const credentialAcceptTx = {
//       TransactionType: "CredentialAccept",
//       Account: subject.address, 
//       Issuer: issuer.address,
//       CredentialType: toHex("DEX"), 
//     };
//     const credentialAcceptPrepared = await client.autofill(credentialAcceptTx);
//     const credentialAcceptSigned = subject.sign(credentialAcceptPrepared);
//     const credentialAcceptResult = await client.submitAndWait(credentialAcceptSigned.tx_blob);
//     console.log(credentialAcceptResult);

//     const domain = await PermissionedDomain.findOne().sort({ _id: -1 }).exec();

//     const offerTx = {
//       TransactionType: "OfferCreate",
//       Account: user.address,
//       TakerPays: { currency: iou, issuer: admin.address, value: amount },
//       TakerGets: (amount*ratio).toString(), 
//       DomainID: domain.id,
//       ...(HYBRID ? { Flags: TF_HYBRID } : {}),
//     };

//     const offerPrepared = await client.autofill(offerTx);
//     const offerSigned = user.sign(offerPrepared);
//     const offerResult = await client.submitAndWait(offerSigned.tx_blob);
//     console.log(offerResult);

//     res.json({success: true})

//   } catch (error) {
//     console.error('Error swapping KRW to XRP:', error)
//     res.status(500).json({ error: 'Failed to swap KRW to XRP' })
//   }finally {
//     await client.disconnect();
//   }
// })

// 스왑 수수료 계산 (미리보기) - 동적 수수료 적용
router.post('/calculate-fee', async (req, res) => {
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

// === 환율 정보 조회 ===

// XRP를 KRW로 환산
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

// KRW를 XRP로 환산
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

// 현재 환율 조회
router.get('/exchange-rate', async (req, res) => {
  try {
    const result = await exchangeRateService.getCurrentXRPKRWRate()
    res.json(result)

  } catch (error) {
    console.error('Error getting exchange rate:', error)
    res.status(500).json({ error: 'Failed to get exchange rate' })
  }
})

export default router