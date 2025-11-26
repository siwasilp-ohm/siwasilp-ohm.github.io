// Huawei Solar System Simulator - Main JavaScript

// Hardware Specifications
const INVERTER_SPECS = {
    'SUN2000-2KTL': { maxPower: 2000, efficiency: 0.965, mpptMin: 70, mpptMax: 580 },
    'SUN2000-5KTL': { maxPower: 5000, efficiency: 0.972, mpptMin: 90, mpptMax: 580 },
    'SUN2000-10KTL': { maxPower: 10000, efficiency: 0.976, mpptMin: 90, mpptMax: 580 },
    'SUN2000-12KTL': { maxPower: 12000, efficiency: 0.978, mpptMin: 90, mpptMax: 580 },
    'SUN2000-15KTL': { maxPower: 15000, efficiency: 0.980, mpptMin: 90, mpptMax: 580 }
};

const BATTERY_SPECS = {
    'LUNA2000-5kWh': { capacity: 5000, maxRate: 5000, efficiency: 0.95 },
    'LUNA2000-10kWh': { capacity: 10000, maxRate: 7000, efficiency: 0.95 },
    'LUNA2000-15kWh': { capacity: 15000, maxRate: 10000, efficiency: 0.95 },
    'LUNA2000-20kWh': { capacity: 20000, maxRate: 10000, efficiency: 0.95 }
};

const PANEL_EFFICIENCY = {
    'mono': 0.22,
    'poly': 0.18,
    'thin': 0.12
};

// Seasonal variations (daylight hours and solar intensity)
const SEASONAL_DATA = {
    'spring': { daylightHours: 12, peakIntensity: 900, avgTemp: 18 },
    'summer': { daylightHours: 14, peakIntensity: 1000, avgTemp: 28 },
    'autumn': { daylightHours: 11, peakIntensity: 850, avgTemp: 16 },
    'winter': { daylightHours: 9, peakIntensity: 700, avgTemp: 8 }
};

// Weather impact multipliers
const WEATHER_MULTIPLIERS = {
    'clear': 1.0,
    'partly_cloudy': 0.7,
    'cloudy': 0.3,
    'rainy': 0.1
};

// Simulation State
class SolarSimulator {
    constructor() {
        this.running = false;
        this.simulationTime = new Date();
        this.simulationTime.setHours(6, 0, 0, 0); // Start at 6 AM
        
        // Hardware configuration
        this.inverterModel = 'SUN2000-10KTL';
        this.batteryModel = 'LUNA2000-10kWh';
        this.panelWattage = 400;
        this.panelCount = 16;
        this.panelType = 'mono';
        
        // Environmental settings
        this.season = 'summer';
        this.weather = 'clear';
        this.simSpeed = 1;
        
        // Battery state
        this.batterySOC = 50; // Start at 50%
        this.batteryEnergy = 0;
        
        // Energy tracking
        this.dailyEnergy = 0;
        this.totalEnergy = 0;
        
        // Data history for charts
        this.history = {
            time: [],
            powerIn: [],
            powerOut: [],
            batterySOC: [],
            batteryPower: [],
            irradiance: [],
            temperature: [],
            panelTemp: [],
            dailyEnergy: []
        };
        
        // WebSocket
        this.ws = null;
        this.wsConnected = false;
        this.lastDataSent = null;
        
        // Charts
        this.charts = {};
        
        // Initialize
        this.initializeUI();
        this.initializeCharts();
        this.setupEventListeners();
    }
    
    initializeUI() {
        // Update configuration displays
        this.updateInverterInfo();
        this.updateBatteryInfo();
        this.updatePanelInfo();
        
        // Initialize battery energy
        const batterySpec = BATTERY_SPECS[this.batteryModel];
        this.batteryEnergy = (batterySpec.capacity * this.batterySOC) / 100;
    }
    
    setupEventListeners() {
        // Configuration changes
        document.getElementById('inverterModel').addEventListener('change', (e) => {
            this.inverterModel = e.target.value;
            this.updateInverterInfo();
        });
        
        document.getElementById('batteryModel').addEventListener('change', (e) => {
            this.batteryModel = e.target.value;
            this.updateBatteryInfo();
            // Recalculate battery energy with new capacity
            const batterySpec = BATTERY_SPECS[this.batteryModel];
            this.batteryEnergy = (batterySpec.capacity * this.batterySOC) / 100;
        });
        
        document.getElementById('panelWattage').addEventListener('change', (e) => {
            this.panelWattage = parseInt(e.target.value);
            this.updatePanelInfo();
        });
        
        document.getElementById('panelCount').addEventListener('change', (e) => {
            this.panelCount = parseInt(e.target.value);
            this.updatePanelInfo();
        });
        
        document.getElementById('panelType').addEventListener('change', (e) => {
            this.panelType = e.target.value;
            this.updatePanelInfo();
        });
        
        document.getElementById('season').addEventListener('change', (e) => {
            this.season = e.target.value;
        });
        
        document.getElementById('weather').addEventListener('change', (e) => {
            this.weather = e.target.value;
        });
        
        document.getElementById('simSpeed').addEventListener('change', (e) => {
            this.simSpeed = parseFloat(e.target.value);
        });
        
        // Control buttons
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('wsConnectBtn').addEventListener('click', () => this.connectWebSocket());
        
        // Log controls
        document.getElementById('clearLogBtn').addEventListener('click', () => {
            document.getElementById('wsLog').innerHTML = '';
        });
    }
    
    updateInverterInfo() {
        const spec = INVERTER_SPECS[this.inverterModel];
        document.getElementById('inverterEfficiency').textContent = `Efficiency: ${(spec.efficiency * 100).toFixed(1)}%`;
        document.getElementById('inverterMPPT').textContent = `MPPT: ${spec.mpptMin}-${spec.mpptMax}V`;
    }
    
    updateBatteryInfo() {
        const spec = BATTERY_SPECS[this.batteryModel];
        document.getElementById('batteryCapacity').textContent = `Capacity: ${spec.capacity / 1000}kWh`;
        document.getElementById('batteryRate').textContent = `Rate: ${spec.maxRate / 1000}kW`;
    }
    
    updatePanelInfo() {
        const totalPower = (this.panelWattage * this.panelCount) / 1000;
        document.getElementById('totalPanelPower').textContent = `Total: ${totalPower.toFixed(1)}kW`;
    }
    
    start() {
        if (!this.running) {
            this.running = true;
            document.getElementById('startBtn').disabled = true;
            document.getElementById('pauseBtn').disabled = false;
            this.simulationLoop();
            this.log('Simulation started', 'success');
        }
    }
    
    pause() {
        this.running = false;
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        this.log('Simulation paused', 'warning');
    }
    
    reset() {
        this.running = false;
        this.simulationTime = new Date();
        this.simulationTime.setHours(6, 0, 0, 0);
        this.batterySOC = 50;
        const batterySpec = BATTERY_SPECS[this.batteryModel];
        this.batteryEnergy = (batterySpec.capacity * this.batterySOC) / 100;
        this.dailyEnergy = 0;
        
        // Clear history
        this.history = {
            time: [],
            powerIn: [],
            powerOut: [],
            batterySOC: [],
            batteryPower: [],
            irradiance: [],
            temperature: [],
            panelTemp: [],
            dailyEnergy: []
        };
        
        // Reset charts
        Object.values(this.charts).forEach(chart => {
            chart.data.labels = [];
            chart.data.datasets.forEach(dataset => dataset.data = []);
            chart.update();
        });
        
        // Reset display
        this.updateDisplay({
            powerIn: 0,
            powerOut: 0,
            batteryPower: 0,
            irradiance: 0,
            temperature: 0,
            panelTemp: 0,
            efficiency: 0
        });
        
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        
        this.log('Simulation reset', 'info');
    }
    
    simulationLoop() {
        if (!this.running) return;
        
        // Calculate time step (in milliseconds)
        const timeStep = 1000; // Update every second
        const simTimeIncrement = (1000 * this.simSpeed); // Simulation time increment in ms
        
        // Advance simulation time
        this.simulationTime = new Date(this.simulationTime.getTime() + simTimeIncrement);
        
        // Reset daily energy at midnight
        if (this.simulationTime.getHours() === 0 && this.simulationTime.getMinutes() === 0) {
            this.dailyEnergy = 0;
        }
        
        // Calculate solar data
        const data = this.calculateSolarData();
        
        // Update battery
        this.updateBattery(data);
        
        // Update display
        this.updateDisplay(data);
        
        // Update charts
        this.updateCharts(data);
        
        // Send WebSocket data
        if (this.wsConnected) {
            this.sendWebSocketData(data);
        }
        
        // Continue loop
        setTimeout(() => this.simulationLoop(), timeStep);
    }
    
    calculateSolarData() {
        const hour = this.simulationTime.getHours() + this.simulationTime.getMinutes() / 60;
        const seasonal = SEASONAL_DATA[this.season];
        const weatherMultiplier = WEATHER_MULTIPLIERS[this.weather];
        
        // Calculate solar irradiance (W/m²)
        let irradiance = 0;
        const sunrise = 12 - seasonal.daylightHours / 2;
        const sunset = 12 + seasonal.daylightHours / 2;
        
        if (hour >= sunrise && hour <= sunset) {
            // Bell curve for solar intensity throughout the day
            const solarNoon = 12;
            const hourFromNoon = Math.abs(hour - solarNoon);
            const maxHourFromNoon = seasonal.daylightHours / 2;
            const normalized = 1 - (hourFromNoon / maxHourFromNoon);
            
            // Apply sine curve for more realistic transition
            irradiance = seasonal.peakIntensity * Math.pow(Math.sin(normalized * Math.PI / 2), 1.5) * weatherMultiplier;
            
            // Add some random variation (±5%)
            irradiance *= (0.95 + Math.random() * 0.1);
        }
        
        // Calculate temperatures
        const baseTemp = seasonal.avgTemp;
        const tempVariation = 8; // Temperature varies ±8°C through the day
        const temperature = baseTemp + tempVariation * Math.sin((hour - 6) * Math.PI / 12);
        
        // Panel temperature is higher than ambient when sun is shining
        const panelTemp = temperature + (irradiance / 1000) * 25;
        
        // Calculate panel output power
        const panelEfficiency = PANEL_EFFICIENCY[this.panelType];
        const totalPanelArea = this.panelCount * 1.6; // Assume ~1.6 m² per panel
        const tempDerate = 1 - ((panelTemp - 25) * 0.004); // -0.4% per °C above 25°C
        
        let powerIn = irradiance * totalPanelArea * panelEfficiency * tempDerate;
        
        // Limit to panel capacity
        const maxPanelPower = this.panelWattage * this.panelCount;
        powerIn = Math.min(powerIn, maxPanelPower);
        
        // Apply inverter efficiency
        const inverterSpec = INVERTER_SPECS[this.inverterModel];
        let powerOut = powerIn * inverterSpec.efficiency;
        
        // Limit to inverter max power
        powerOut = Math.min(powerOut, inverterSpec.maxPower);
        
        // Calculate system efficiency
        const efficiency = powerIn > 0 ? (powerOut / powerIn) * 100 : 0;
        
        // Calculate voltage and current (simplified)
        const voltage = 380 + (Math.random() - 0.5) * 10; // 380V ±5V
        const current = powerOut > 0 ? powerOut / voltage : 0;
        const frequency = 50.0 + (Math.random() - 0.5) * 0.2; // 50Hz ±0.1Hz
        
        return {
            powerIn: Math.max(0, powerIn),
            powerOut: Math.max(0, powerOut),
            irradiance: Math.max(0, irradiance),
            temperature: temperature,
            panelTemp: panelTemp,
            efficiency: efficiency,
            voltage: voltage,
            current: current,
            frequency: frequency
        };
    }
    
    updateBattery(data) {
        const batterySpec = BATTERY_SPECS[this.batteryModel];
        const inverterSpec = INVERTER_SPECS[this.inverterModel];
        
        // Simulate load consumption (varies by time of day)
        const hour = this.simulationTime.getHours();
        let loadPower = 0;
        
        // Typical household consumption pattern
        if (hour >= 6 && hour < 9) loadPower = 2000; // Morning peak
        else if (hour >= 9 && hour < 17) loadPower = 800; // Daytime low
        else if (hour >= 17 && hour < 23) loadPower = 3000; // Evening peak
        else loadPower = 500; // Night baseline
        
        // Add some variation
        loadPower *= (0.9 + Math.random() * 0.2);
        
        // Calculate battery power (positive = charging, negative = discharging)
        let batteryPower = data.powerOut - loadPower;
        
        // Limit battery charge/discharge rate
        batteryPower = Math.max(-batterySpec.maxRate, Math.min(batterySpec.maxRate, batteryPower));
        
        // Update battery energy (Wh)
        // Time increment in hours
        const timeIncrementHours = this.simSpeed / 3600;
        
        if (batteryPower > 0) {
            // Charging
            const chargeEnergy = batteryPower * timeIncrementHours * batterySpec.efficiency;
            this.batteryEnergy = Math.min(batterySpec.capacity, this.batteryEnergy + chargeEnergy);
        } else if (batteryPower < 0) {
            // Discharging
            const dischargeEnergy = Math.abs(batteryPower) * timeIncrementHours / batterySpec.efficiency;
            this.batteryEnergy = Math.max(0, this.batteryEnergy - dischargeEnergy);
        }
        
        // Calculate SOC
        this.batterySOC = (this.batteryEnergy / batterySpec.capacity) * 100;
        
        // If battery is full or empty, adjust battery power
        if (this.batterySOC >= 99.9 && batteryPower > 0) {
            batteryPower = 0;
        } else if (this.batterySOC <= 0.1 && batteryPower < 0) {
            batteryPower = 0;
        }
        
        // Update daily and total energy (only count generation)
        if (data.powerIn > 0) {
            const energyIncrement = data.powerIn * timeIncrementHours / 1000; // Convert to kWh
            this.dailyEnergy += energyIncrement;
            this.totalEnergy += energyIncrement;
        }
        
        data.batteryPower = batteryPower;
        data.batterySOC = this.batterySOC;
        data.batteryEnergy = this.batteryEnergy;
        data.dailyEnergy = this.dailyEnergy;
        data.totalEnergy = this.totalEnergy;
    }
    
    updateDisplay(data) {
        // Save to localStorage for Battery Lab sync
        this.saveStateToLocalStorage(data);
        
        // Primary metrics
        document.getElementById('powerIn').textContent = `${data.powerIn.toFixed(2)} W`;
        document.getElementById('powerOut').textContent = `${data.powerOut.toFixed(2)} W`;
        document.getElementById('batteryPercentage').textContent = `${data.batterySOC.toFixed(1)}%`;
        document.getElementById('dailyEnergy').textContent = `${data.dailyEnergy.toFixed(2)} kWh`;
        
        // Sub-metrics
        document.getElementById('irradiance').textContent = data.irradiance.toFixed(0);
        document.getElementById('efficiency').textContent = data.efficiency.toFixed(1);
        document.getElementById('batteryPower').textContent = data.batteryPower.toFixed(0);
        document.getElementById('totalEnergy').textContent = data.totalEnergy.toFixed(1);
        
        // Secondary metrics
        document.getElementById('voltage').textContent = `${data.voltage.toFixed(1)} V`;
        document.getElementById('current').textContent = `${data.current.toFixed(2)} A`;
        document.getElementById('frequency').textContent = `${data.frequency.toFixed(1)} Hz`;
        document.getElementById('temperature').textContent = `${data.temperature.toFixed(1)}°C`;
        document.getElementById('panelTemp').textContent = `${data.panelTemp.toFixed(1)}°C`;
        
        // Local time
        document.getElementById('localTime').textContent = this.simulationTime.toLocaleTimeString();
        
        // Status
        let status = 'Normal';
        let statusClass = 'status-normal';
        
        if (data.batterySOC < 10) {
            status = 'Low Battery';
            statusClass = 'status-warning';
        } else if (data.batterySOC > 95) {
            status = 'Battery Full';
            statusClass = 'status-success';
        }
        
        if (data.powerIn < 10 && this.simulationTime.getHours() >= 10 && this.simulationTime.getHours() <= 16) {
            status = 'Low Generation';
            statusClass = 'status-warning';
        }
        
        const statusEl = document.getElementById('status');
        statusEl.textContent = status;
        statusEl.className = `metric-val status-badge ${statusClass}`;
        
        // Battery fill bar
        document.getElementById('batteryFill').style.width = `${data.batterySOC}%`;
        
        // Update battery fill color based on SOC
        const batteryFill = document.getElementById('batteryFill');
        if (data.batterySOC < 20) {
            batteryFill.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
        } else if (data.batterySOC < 50) {
            batteryFill.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc00)';
        } else {
            batteryFill.style.background = 'linear-gradient(90deg, #00ff88, #00cc66)';
        }
        
        // Check for alerts
        this.checkAlerts(data);
    }
    
    checkAlerts(data) {
        const alerts = [];
        
        if (data.batterySOC < 10) {
            alerts.push({ type: 'warning', message: 'Battery charge below 10%' });
        }
        
        if (data.panelTemp > 70) {
            alerts.push({ type: 'warning', message: 'Panel temperature high (>70°C)' });
        }
        
        if (data.voltage < 370 || data.voltage > 390) {
            alerts.push({ type: 'warning', message: 'Voltage out of normal range' });
        }
        
        const alertsSection = document.getElementById('alertsSection');
        const alertsList = document.getElementById('alertsList');
        
        if (alerts.length > 0) {
            alertsSection.style.display = 'block';
            alertsList.innerHTML = alerts.map(alert => 
                `<div class="alert alert-${alert.type}">${alert.message}</div>`
            ).join('');
        } else {
            alertsSection.style.display = 'none';
        }
        
        data.alerts = alerts;
    }
    
    updateCharts(data) {
        const timeLabel = this.simulationTime.toLocaleTimeString();
        
        // Limit history to last 100 points
        const maxPoints = 100;
        
        if (this.history.time.length >= maxPoints) {
            this.history.time.shift();
            this.history.powerIn.shift();
            this.history.powerOut.shift();
            this.history.batterySOC.shift();
            this.history.batteryPower.shift();
            this.history.irradiance.shift();
            this.history.temperature.shift();
            this.history.panelTemp.shift();
            this.history.dailyEnergy.shift();
        }
        
        this.history.time.push(timeLabel);
        this.history.powerIn.push(data.powerIn);
        this.history.powerOut.push(data.powerOut);
        this.history.batterySOC.push(data.batterySOC);
        this.history.batteryPower.push(data.batteryPower);
        this.history.irradiance.push(data.irradiance);
        this.history.temperature.push(data.temperature);
        this.history.panelTemp.push(data.panelTemp);
        this.history.dailyEnergy.push(data.dailyEnergy);
        
        // Update power chart
        this.charts.power.data.labels = this.history.time;
        this.charts.power.data.datasets[0].data = this.history.powerIn;
        this.charts.power.data.datasets[1].data = this.history.powerOut;
        this.charts.power.update('none');
        
        // Update battery chart
        this.charts.battery.data.labels = this.history.time;
        this.charts.battery.data.datasets[0].data = this.history.batterySOC;
        this.charts.battery.data.datasets[1].data = this.history.batteryPower;
        this.charts.battery.update('none');
        
        // Update environment chart
        this.charts.environment.data.labels = this.history.time;
        this.charts.environment.data.datasets[0].data = this.history.irradiance;
        this.charts.environment.data.datasets[1].data = this.history.temperature;
        this.charts.environment.data.datasets[2].data = this.history.panelTemp;
        this.charts.environment.update('none');
        
        // Update energy chart
        this.charts.energy.data.labels = this.history.time;
        this.charts.energy.data.datasets[0].data = this.history.dailyEnergy;
        this.charts.energy.update('none');
    }
    
    connectWebSocket() {
        if (this.wsConnected) {
            this.log('Already connected to WebSocket', 'warning');
            return;
        }
        
        this.log('Connecting to WebSocket...', 'info');
        
        try {
            this.ws = new WebSocket('wss://payment-project-t4dj.onrender.com/solar/solar_001');
            
            this.ws.onopen = () => {
                this.wsConnected = true;
                this.updateWSStatus(true);
                this.log('WebSocket connected successfully', 'success');
            };
            
            this.ws.onclose = () => {
                this.wsConnected = false;
                this.updateWSStatus(false);
                this.log('WebSocket disconnected', 'warning');
                
                // Auto-reconnect after 5 seconds
                setTimeout(() => {
                    if (!this.wsConnected && this.running) {
                        this.log('Attempting to reconnect...', 'info');
                        this.connectWebSocket();
                    }
                }, 5000);
            };
            
            this.ws.onerror = (error) => {
                this.log(`WebSocket error: ${error.message || 'Connection failed'}`, 'error');
            };
            
            this.ws.onmessage = (event) => {
                this.log(`Received: ${event.data}`, 'receive');
            };
            
        } catch (error) {
            this.log(`Failed to connect: ${error.message}`, 'error');
        }
    }
    
    sendWebSocketData(data) {
        if (!this.wsConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        // Prepare payload
        const payload = {
            type: 'realtime',
            payload: {
                device_id: 'solar_001',
                timestamp: new Date().toISOString(),
                data: {
                    power_in: parseFloat(data.powerIn.toFixed(2)),
                    power_out: parseFloat(data.powerOut.toFixed(2)),
                    battery_percentage: parseFloat(data.batterySOC.toFixed(2)),
                    battery_power: parseFloat(data.batteryPower.toFixed(2)),
                    voltage: parseFloat(data.voltage.toFixed(2)),
                    current: parseFloat(data.current.toFixed(2)),
                    solar_irradiance: parseFloat(data.irradiance.toFixed(2)),
                    temperature: parseFloat(data.temperature.toFixed(2)),
                    panel_temperature: parseFloat(data.panelTemp.toFixed(2)),
                    efficiency: parseFloat(data.efficiency.toFixed(2)),
                    frequency: parseFloat(data.frequency.toFixed(2)),
                    daily_energy: parseFloat(data.dailyEnergy.toFixed(2)),
                    total_energy: parseFloat(data.totalEnergy.toFixed(2)),
                    status: data.alerts && data.alerts.length > 0 ? 'warning' : 'normal',
                    alerts: data.alerts || []
                }
            }
        };
        
        try {
            const message = JSON.stringify(payload);
            this.ws.send(message);
            this.log(`Sent: ${message}`, 'send');
            this.lastDataSent = new Date();
        } catch (error) {
            this.log(`Failed to send data: ${error.message}`, 'error');
        }
    }
    
    updateWSStatus(connected) {
        const statusIndicator = document.getElementById('wsStatus');
        const statusText = document.getElementById('wsStatusText');
        const connectBtn = document.getElementById('wsConnectBtn');
        
        if (connected) {
            statusIndicator.style.color = '#00ff88';
            statusText.textContent = 'Connected';
            connectBtn.textContent = '✓ Connected';
            connectBtn.disabled = true;
        } else {
            statusIndicator.style.color = '#ff4444';
            statusText.textContent = 'Disconnected';
            connectBtn.textContent = '🔌 Connect WebSocket';
            connectBtn.disabled = false;
        }
    }
    
    log(message, type = 'info') {
        const logContainer = document.getElementById('wsLog');
        const timestamp = new Date().toLocaleTimeString();
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> <span class="log-message">${message}</span>`;
        
        logContainer.appendChild(logEntry);
        
        // Auto-scroll if enabled
        if (document.getElementById('autoScrollLog').checked) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        // Limit log entries to 100
        while (logContainer.children.length > 100) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }
    
    saveStateToLocalStorage(data) {
        try {
            const state = {
                batteryModel: this.batteryModel,
                batterySOC: data.batterySOC,
                batteryPower: data.batteryPower,
                temperature: data.temperature,
                voltage: data.voltage,
                current: data.current,
                powerIn: data.powerIn,
                powerOut: data.powerOut,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('solarSimulatorState', JSON.stringify(state));
        } catch (error) {
            // Silently fail if localStorage is not available
        }
    }
    
    initializeCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: true,
            animation: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e0e0e0'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#a0a0a0', maxTicksLimit: 10 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    ticks: { color: '#a0a0a0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        };
        
        // Power Chart
        this.charts.power = new Chart(document.getElementById('powerChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Solar Input (W)',
                        data: [],
                        borderColor: '#ffaa00',
                        backgroundColor: 'rgba(255, 170, 0, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Power Output (W)',
                        data: [],
                        borderColor: '#00ff88',
                        backgroundColor: 'rgba(0, 255, 136, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: chartOptions
        });
        
        // Battery Chart
        this.charts.battery = new Chart(document.getElementById('batteryChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Battery SOC (%)',
                        data: [],
                        borderColor: '#00aaff',
                        backgroundColor: 'rgba(0, 170, 255, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Battery Power (W)',
                        data: [],
                        borderColor: '#ff00ff',
                        backgroundColor: 'rgba(255, 0, 255, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                ...chartOptions,
                scales: {
                    x: chartOptions.scales.x,
                    y: {
                        ...chartOptions.scales.y,
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'SOC (%)', color: '#a0a0a0' }
                    },
                    y1: {
                        ...chartOptions.scales.y,
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Power (W)', color: '#a0a0a0' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
        
        // Environment Chart
        this.charts.environment = new Chart(document.getElementById('environmentChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Irradiance (W/m²)',
                        data: [],
                        borderColor: '#ffaa00',
                        backgroundColor: 'rgba(255, 170, 0, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Ambient Temp (°C)',
                        data: [],
                        borderColor: '#00ff88',
                        backgroundColor: 'rgba(0, 255, 136, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Panel Temp (°C)',
                        data: [],
                        borderColor: '#ff4444',
                        backgroundColor: 'rgba(255, 68, 68, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                ...chartOptions,
                scales: {
                    x: chartOptions.scales.x,
                    y: {
                        ...chartOptions.scales.y,
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Irradiance (W/m²)', color: '#a0a0a0' }
                    },
                    y1: {
                        ...chartOptions.scales.y,
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Temperature (°C)', color: '#a0a0a0' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
        
        // Energy Chart
        this.charts.energy = new Chart(document.getElementById('energyChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Daily Energy (kWh)',
                        data: [],
                        borderColor: '#00aaff',
                        backgroundColor: 'rgba(0, 170, 255, 0.2)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: chartOptions
        });
    }
}

// Initialize simulator when page loads
let simulator;
document.addEventListener('DOMContentLoaded', () => {
    simulator = new SolarSimulator();
    simulator.log('Solar Simulator initialized', 'success');
    simulator.log('Configure your system and click "Start Simulation"', 'info');
});
