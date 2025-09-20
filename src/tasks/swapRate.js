const axios = require('axios');
const ExchangeRate = require('../domains/swap/models/ExchangeRate');

async function fetchRate(symbol) {
    let ticker = await getTicker(symbol);
    const price = ticker[0].trade_price;
    console.log('Fetched price:', price);

    // 데이터베이스에 환율 저장
    await saveExchangeRate(symbol, price);

    return price;
}

async function saveExchangeRate(symbol, price) {
    try {
        // 기존 환율을 비활성화
        await ExchangeRate.updateMany(
            {
                baseCurrency: symbol.toUpperCase(),
                quoteCurrency: 'KRW',
                isActive: true
            },
            {
                isActive: false,
                validTo: new Date()
            }
        );

        // 새로운 환율 저장
        const exchangeRate = new ExchangeRate({
            baseCurrency: symbol.toUpperCase(),
            quoteCurrency: 'KRW',
            rate: price,
            source: 'API',
            sourceMetadata: {
                provider: 'bithumb',
                lastUpdated: new Date(),
                confidence: 1.0
            },
            createdBy: 'SYSTEM',
            isActive: true
        });

        await exchangeRate.save();
        console.log(`Saved exchange rate: ${symbol}/KRW = ${price}`);

        return exchangeRate;
    } catch (error) {
        console.error('Error saving exchange rate:', error);
        throw error;
    }
}

async function getTicker(symbol) {
    try {
        const url = `https://api.bithumb.com/v1/trades/ticks?market=KRW-${symbol}&count=1`;
        const response = await axios.get(url);
        if (response.status === 200) {
            return response.data;
        } else {
            throw new Error(response.statusText);
        }
    } catch (err) {
        console.error("REST API Error:", err.message);
    }
}

exports.fetchRate = fetchRate;