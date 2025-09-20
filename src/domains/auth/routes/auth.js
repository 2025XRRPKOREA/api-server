const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../../user/models/User');
const WalletService = require('../../wallet/services/legacyWalletService');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: 사용자 인증 및 계정 관리
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 신규 사용자 등록 및 XRP 지갑 생성
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 사용자 이메일
 *               password:
 *                 type: string
 *                 format: password
 *                 description: 사용자 비밀번호 (6자 이상)
 *     responses:
 *       '201':
 *         description: 사용자 등록 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       '400':
 *         description: 잘못된 요청 (이메일, 비밀번호 누락 또는 형식 오류)
 *       '409':
 *         description: 이미 존재하는 사용자
 *       '500':
 *         description: 서버 내부 오류
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Generate XRP wallet
    const walletInfo = WalletService.generateWallet();

    // Create new user with wallet
    const user = new User({
      email,
      password,
      wallet: {
        address: walletInfo.address,
        seed: walletInfo.seed,
        publicKey: walletInfo.publicKey,
        privateKey: walletInfo.privateKey
      }
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        wallet: {
          address: user.wallet.address,
          publicKey: user.wallet.publicKey
        },
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 사용자 로그인
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 사용자 이메일
 *               password:
 *                 type: string
 *                 format: password
 *                 description: 사용자 비밀번호
 *     responses:
 *       '200':
 *         description: 로그인 성공, JWT 토큰 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       '400':
 *         description: 잘못된 요청 (이메일 또는 비밀번호 누락)
 *       '401':
 *         description: 인증 실패 (잘못된 자격 증명)
 *       '500':
 *         description: 서버 내부 오류
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email (works for both 'admin' and regular users)
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token with role
    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role
    };
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        wallet: {
          address: user.wallet.address,
          publicKey: user.wallet.publicKey
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
