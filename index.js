const fs = require('fs');
const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

let trades = [];
let openPosition = null;
let balance = 10000;
const tradesFilePath = path.join(__dirname, 'trades.json');

let currentPrice = null;
let chartData = [];

const readTradesFromFile = () => {
    try {
        const data = fs.readFileSync(tradesFilePath, 'utf8');
        trades = JSON.parse(data);

        // Find the trade with status 'Open' and set it as openPosition
        openPosition = trades.find(trade => trade.status === 'Open') || null;
    } catch (error) {
        console.error('Error reading trades from file:', error);
    }
};


const writeTradesToFile = () => {
    try {
        fs.writeFileSync(tradesFilePath, JSON.stringify(trades, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing trades to file:', error);
    }
};

const fetchLDOData = async () => {
    try {
        const [priceResponse, chartResponse] = await Promise.all([
            axios.get('https://api.binance.com/api/v3/ticker/price', {
                params: {
                    symbol: 'LDOUSDT',
                },
            }),
            axios.get('https://api.binance.com/api/v3/klines', {
                params: {
                    symbol: 'LDOUSDT',
                    interval: '1h',
                    limit: 168,
                },
            }),
        ]);

        currentPrice = priceResponse.data.price ? parseFloat(priceResponse.data.price) : null;

        chartData = chartResponse.data.map(([timestamp, , , , close]) => ({
            time: new Date(timestamp).toLocaleDateString(),
            price: parseFloat(close),
        }));
    } catch (error) {
        console.error('Error fetching LDO data:', error);
    }
};

readTradesFromFile();

setInterval(async () => {
    await fetchLDOData();
    console.log('Fetched new data at: ', new Date());
}, 5000);

app.get('/', (req, res) => {
    res.render('index', { trades, currentPrice, balance, openPosition });
});

let unfilledOrders = [];

const checkUnfilledOrders = async () => {
    await fetchLDOData();

    unfilledOrders.forEach(order => {
        if (order.status === 'Pending' && currentPrice <= order.limitPrice) {
            order.entryPrice = currentPrice;
            order.status = 'Open';
            order.result = 'Order Filled';
            openPosition = order;
            console.log(`Order filled at ${currentPrice} for position size ${order.positionSize}`);
        }
    });

    writeTradesToFile();
};

setInterval(checkUnfilledOrders, 30000);

app.post('/trade', async (req, res) => {
    const { limitPrice, takeProfit, stopLoss, positionSize } = req.body;
    const currentPrice = await fetchLDOData();

    const trade = {
        limitPrice: parseFloat(limitPrice),
        takeProfit: parseFloat(takeProfit),
        stopLoss: parseFloat(stopLoss),
        positionSize: parseFloat(positionSize),
        entryPrice: null,
        exitPrice: null,
        result: 'Pending',
        currentProfitLoss: 0,
        status: 'Pending',
    };

    if (currentPrice <= trade.limitPrice) {
        trade.entryPrice = currentPrice;
        trade.status = 'Open';
        openPosition = trade;
    } else {
        unfilledOrders.push(trade);
        trade.result = 'Order Not Filled';
        trade.status = 'Pending';
    }

    trades.push(trade);
    writeTradesToFile();

    res.redirect('/');
});

app.get('/profit-loss', async (req, res) => {
    if (!openPosition) {
        return res.json({ profitLoss: 0, position: null });
    }

    const currentPrice = await fetchLDOData();
    const profitLoss = ((currentPrice - openPosition.entryPrice) * openPosition.positionSize) * (currentPrice > openPosition.entryPrice ? 1 : -1);

    openPosition.currentProfitLoss = profitLoss;

    if (profitLoss !== 0) {
        balance += profitLoss;
        openPosition = null;
    }

    res.json({
        profitLoss,
        position: openPosition,
        currentPrice,
    });
});


app.get('/ldo-chart-data', (req, res) => {
    res.json(chartData);
});

app.get('/current-price', (req, res) => {
    res.json({ currentPrice });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
