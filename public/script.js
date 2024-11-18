let cachedChartData = null;
let chartDataTimestamp = null;
let chartInstance = null;

async function fetchChartData() {
    const cacheDuration = 5 * 60 * 1000;
    const currentTime = Date.now();

    try {
        const response = await fetch('/ldo-chart-data');
        const data = await response.json();
        
        cachedChartData = data;
        chartDataTimestamp = currentTime;

        if (chartInstance) {
            chartInstance.data.labels = data.map(point => point.time);
            chartInstance.data.datasets[0].data = data.map(point => point.price);
            chartInstance.update();
        } else {
            renderChart(data);
        }
    } catch (error) {
        console.error('Error fetching chart data:', error);
    }
}

function renderChart(data) {
    const ctx = document.getElementById('ldoChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(point => point.time),
            datasets: [{
                label: 'LDO-USD Price',
                data: data.map(point => point.price),
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                fill: false,
            }],
        },
        options: {
            scales: {
                x: { title: { display: true, text: 'Date' } },
                y: { title: { display: true, text: 'Price (USD)' } },
            },
        },
    });
}

async function fetchCurrentPrice() {
    try {
        const response = await fetch('/current-price');
        const data = await response.json();
        const currentPriceDiv = document.getElementById('currentPrice');
        
        if (data.currentPrice) {
            currentPriceDiv.innerHTML = `<p>Current Price: $${data.currentPrice.toFixed(2)}</p>`;
        }
    } catch (error) {
        console.error('Error fetching current price:', error);
    }
}

async function fetchOpenPosition() {
    try {
        const response = await fetch('/profit-loss');
        const data = await response.json();

        const currentPositionDiv = document.getElementById('currentPosition');
        if (data.position) {
            currentPositionDiv.innerHTML = `
                <p>Current Position:</p>
                <p>Limit Price: $${data.position.limitPrice.toFixed(2)}</p>
                <p>Entry Price: $${data.position.entryPrice.toFixed(2)}</p>
                <p>Position Size: ${data.position.positionSize} LDO</p>
                <p>Status: ${data.position.status}</p>
                <p>Take Profit: $${data.position.takeProfit.toFixed(2)}</p>
                <p>Stop Loss: $${data.position.stopLoss.toFixed(2)}</p>
            `;
        } else {
            currentPositionDiv.innerHTML = '<p>No open position.</p>';
        }
    } catch (error) {
        console.error('Error fetching open position:', error);
    }
}

setInterval(fetchOpenPosition, 5000);  // Update current position every 5 seconds

fetchChartData();
fetchCurrentPrice();

setInterval(fetchChartData, 5000);
setInterval(fetchCurrentPrice, 5000);
