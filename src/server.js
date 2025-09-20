const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const {Client, Wallet} = require('xrpl');

// Domain routes
const authRoutes = require('./domains/auth/routes/auth');
const walletRoutes = require('./domains/wallet/routes/walletRoutes');
const transactionRoutes = require('./domains/transaction/routes/transactionRoutes');
const iouRoutes = require('./domains/iou/routes/iouRoutes');
const domainRoutes = require('./domains/domain/routes/domainRoutes');
const swapFeeRoutes = require('./domains/swap/routes/swapFeeRoutes');
const exchangeRateRoutes = require('./domains/swap/routes/exchangeRateRoutes');
// Domain services
const adminSystemService = require('./domains/admin/services/adminSystemService');
const domainService = require('./domains/domain/services/domainService');
const exchangeRateService = require('./domains/swap/services/exchangeRateService');
const swapRate = require('./tasks/swapRate');
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    hsts: false
}));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({extended: true}));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/xrp_wallet?authSource=admin';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// KRW IOU 시스템 초기화
async function initializeKRWSystem() {
    try {
        // console.log('Initializing KRW IOU system...');

        // 1. 시스템 설정 및 관리자 계정 초기화
        // await adminSystemService.initializeSystem();

        // 2. XRPL에 Domain 설정
        // await adminSystemService.setDomainOnXRPL('krw-iou.local');

        // 3. 기본 환율 및 수수료 설정 초기화
        // await exchangeRateService.initializeDefaultRates();

        console.log('KRW IOU system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize KRW IOU system:', error);
        // 개발/테스트 환경에서는 에러가 있어도 서버를 계속 실행
        if (process.env.NODE_ENV === 'production') {
            throw error;
        }
    }
}

async function initAdmin() {
    const client = new Client("wss://s.devnet.rippletest.net:51233");
    try {
        await client.connect();

        const admin = Wallet.fromSeed("sEdSc1R6ZckunYrdi6iG61EKmDAkBY2");

        const tx = {
            TransactionType: "AccountSet",
            Account: admin.address,
            SetFlag: 8,
        };

        const prepared = await client.autofill(tx);
        const signed = admin.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        console.log(JSON.stringify(result, null, 2));
        console.log('success init admin');
    } catch (error) {
        console.error('fail init admin', error);
        throw new Error('XRPL connection failed');
    } finally {
        await client.disconnect();
        console.log('finish init admin');
    }
}

// 서버 시작 전 시스템 초기화
initializeKRWSystem().then(r =>
    console.log('KRW IOU system initialized successfully')
).catch(err =>
    console.error('Failed to initialize KRW IOU system:', err)
);

// 어드민 지갑 초기화
initAdmin().then(r =>
    console.log('admin wallet initialized successfully')
).catch(err =>
    console.error('Failed to initialize admin wallet:', err)
);

// Domain routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/admin/iou', iouRoutes);
app.use('/api/admin/domain', domainRoutes);
app.use('/api/admin/swap-fee', swapFeeRoutes);
app.use('/api/admin/exchange-rate', exchangeRateRoutes);

// Swagger API Docs
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./shared/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCssUrl: '/swagger-ui.css',
    customJs: '/swagger-ui-bundle.js',
    swaggerOptions: {
        url: '/api-docs.json'
    }
}));

// Swagger JSON endpoint for OpenAPI Generator
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// Health check
app.get('/health', (req, res) => {
    res.json({status: 'OK', timestamp: new Date().toISOString()});
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({error: 'Something went wrong!'});
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({error: 'Route not found'});
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// 1분마다 실행 (60,000ms)
setInterval(async () => {
    await swapRate.fetchRate("XRP");
}, 10000);