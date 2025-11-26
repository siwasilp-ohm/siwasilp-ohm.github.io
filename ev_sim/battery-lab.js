// LUNA2000 Battery Laboratory System

// Battery specifications by model
const BATTERY_CONFIGURATIONS = {
    'LUNA2000-5kWh': {
        capacity: 5000, // Wh
        maxRate: 5000, // W
        efficiency: 0.95,
        modules: 2,
        cellsPerModule: 16,
        nominalVoltage: 200,
        cellNominalVoltage: 3.7,
        cellCapacityAh: 50
    },
    'LUNA2000-10kWh': {
        capacity: 10000,
        maxRate: 7000,
        efficiency: 0.95,
        modules: 3,
        cellsPerModule: 16,
        nominalVoltage: 400,
        cellNominalVoltage: 3.7,
        cellCapacityAh: 50
    },
    'LUNA2000-15kWh': {
        capacity: 15000,
        maxRate: 10000,
        efficiency: 0.95,
        modules: 4,
        cellsPerModule: 16,
        nominalVoltage: 400,
        cellNominalVoltage: 3.7,
        cellCapacityAh: 75
    },
    'LUNA2000-20kWh': {
        capacity: 20000,
        maxRate: 10000,
        efficiency: 0.95,
        modules: 5,
        cellsPerModule: 16,
        nominalVoltage: 400,
        cellNominalVoltage: 3.7,
        cellCapacityAh: 75
    }
};

class BatteryLab {
    constructor() {
        this.batteryModel = 'LUNA2000-10kWh';
        this.config = BATTERY_CONFIGURATIONS[this.batteryModel];
        
        // Battery state
        this.soc = 50;
        this.dod = 50;
        this.currentPower = 0;
        this.temperature = 25;
        this.voltage = this.config.nominalVoltage;
        
        // Cell array
        this.cells = [];
        this.modules = [];
        
        // Testing
        this.testMode = 'normal';
        this.testRunning = false;
        this.simSpeed = 1;
        
        // Charts
        this.charts = {};
        
        // Selected cell for popup
        this.selectedCell = null;
        
        // History tracking
        this.history = {
            time: [],
            voltage: [],
            current: [],
            power: [],
            temperature: [],
            soc: []
        };
        
        // Initialize
        this.initializeCells();
        this.loadDashboardData();
        this.setupUI();
        this.initializeCharts();
        this.setupEventListeners();
        this.startMonitoring();
    }
    
    initializeCells() {
        const totalCells = this.config.modules * this.config.cellsPerModule;
        
        // Create modules
        for (let m = 0; m < this.config.modules; m++) {
            const module = {
                id: m + 1,
                cells: [],
                voltage: 0,
                current: 0,
                temperature: 25,
                avgSOC: 50,
                health: 100
            };
            
            // Create cells for this module
            for (let c = 0; c < this.config.cellsPerModule; c++) {
                const cell = {
                    id: `M${m + 1}-C${c + 1}`,
                    moduleId: m + 1,
                    cellIndex: c + 1,
                    voltage: this.config.cellNominalVoltage + (Math.random() - 0.5) * 0.1,
                    current: 0,
                    temperature: 25 + (Math.random() - 0.5) * 2,
                    soc: 50 + (Math.random() - 0.5) * 5,
                    health: 98 + Math.random() * 2,
                    cycleCount: Math.floor(Math.random() * 100),
                    resistance: 45 + Math.random() * 10, // mΩ
                    capacity: this.config.cellCapacityAh,
                    status: 'normal',
                    history: [],
                    faults: []
                };
                
                module.cells.push(cell);
                this.cells.push(cell);
            }
            
            this.modules.push(module);
        }
        
        this.updateModuleStats();
    }
    
    loadDashboardData() {
        // Try to sync with main dashboard
        try {
            const dashboardData = localStorage.getItem('solarSimulatorState');
            if (dashboardData) {
                const data = JSON.parse(dashboardData);
                this.batteryModel = data.batteryModel || 'LUNA2000-10kWh';
                this.soc = data.batterySOC || 50;
                this.currentPower = data.batteryPower || 0;
                this.temperature = data.temperature || 25;
                
                // Reinitialize if model changed
                if (this.batteryModel !== data.batteryModel) {
                    this.config = BATTERY_CONFIGURATIONS[this.batteryModel];
                    this.initializeCells();
                }
                
                this.log('Synced with dashboard data', 'success');
            }
        } catch (error) {
            this.log('Could not sync with dashboard', 'warning');
        }
        
        // Set up periodic sync
        setInterval(() => this.syncWithDashboard(), 2000);
    }
    
    syncWithDashboard() {
        try {
            const dashboardData = localStorage.getItem('solarSimulatorState');
            if (dashboardData) {
                const data = JSON.parse(dashboardData);
                
                // Update from dashboard if not in test mode
                if (this.testMode === 'normal' && !this.testRunning) {
                    this.soc = data.batterySOC || this.soc;
                    this.currentPower = data.batteryPower || 0;
                    this.temperature = data.temperature || this.temperature;
                    
                    // Update cells based on overall SOC
                    this.updateCellsFromSOC(this.soc);
                }
                
                document.getElementById('syncStatus').className = 'status-indicator synced';
                document.getElementById('syncStatusText').textContent = 'Synced with Dashboard';
            }
        } catch (error) {
            document.getElementById('syncStatus').className = 'status-indicator unsynced';
            document.getElementById('syncStatusText').textContent = 'Not Synced';
        }
    }
    
    updateCellsFromSOC(soc) {
        this.cells.forEach(cell => {
            // Add small variance to each cell
            const variance = (Math.random() - 0.5) * 3;
            cell.soc = Math.max(0, Math.min(100, soc + variance));
            
            // Update voltage based on SOC
            cell.voltage = this.calculateCellVoltage(cell.soc);
            
            // Update current based on power
            const cellCurrent = this.currentPower / this.cells.length / cell.voltage;
            cell.current = cellCurrent;
            
            // Update status
            if (cellCurrent > 0.1) {
                cell.status = 'charging';
            } else if (cellCurrent < -0.1) {
                cell.status = 'discharging';
            } else {
                cell.status = 'normal';
            }
        });
        
        this.updateModuleStats();
    }
    
    calculateCellVoltage(soc) {
        // Realistic Li-ion voltage curve
        const minV = 3.0;
        const maxV = 4.2;
        const nominalV = 3.7;
        
        if (soc < 10) {
            return minV + (nominalV - minV) * (soc / 10);
        } else if (soc > 90) {
            return nominalV + (maxV - nominalV) * ((soc - 90) / 10);
        } else {
            return nominalV + (soc - 50) * 0.004;
        }
    }
    
    setupUI() {
        // Update battery info
        document.getElementById('batteryModel').textContent = this.batteryModel;
        document.getElementById('moduleCount').textContent = this.config.modules;
        document.getElementById('cellsPerModule').textContent = this.config.cellsPerModule;
        document.getElementById('totalCells').textContent = this.cells.length;
        document.getElementById('capacity').textContent = `${this.config.capacity / 1000} kWh`;
        document.getElementById('maxRate').textContent = `${this.config.maxRate / 1000} kW`;
        document.getElementById('efficiency').textContent = `${this.config.efficiency * 100} %`;
        
        // Create module visualization
        this.renderModules();
    }
    
    renderModules() {
        const container = document.getElementById('modulesContainer');
        container.innerHTML = '';
        
        this.modules.forEach((module, idx) => {
            const moduleBox = document.createElement('div');
            moduleBox.className = 'module-box';
            moduleBox.innerHTML = `
                <div class="module-header">
                    <div class="module-title">Module ${module.id}</div>
                    <div class="module-stats">
                        <div class="module-stat">
                            <div class="module-stat-label">Voltage</div>
                            <div class="module-stat-value" id="moduleVoltage${module.id}">0 V</div>
                        </div>
                        <div class="module-stat">
                            <div class="module-stat-label">Current</div>
                            <div class="module-stat-value" id="moduleCurrent${module.id}">0 A</div>
                        </div>
                        <div class="module-stat">
                            <div class="module-stat-label">Temp</div>
                            <div class="module-stat-value" id="moduleTemp${module.id}">25°C</div>
                        </div>
                        <div class="module-stat">
                            <div class="module-stat-label">Avg SOC</div>
                            <div class="module-stat-value" id="moduleSOC${module.id}">50%</div>
                        </div>
                    </div>
                </div>
                <div class="cells-grid" id="module${module.id}Cells"></div>
            `;
            
            container.appendChild(moduleBox);
            
            // Render cells for this module
            const cellsGrid = document.getElementById(`module${module.id}Cells`);
            module.cells.forEach(cell => {
                const cellEl = document.createElement('div');
                cellEl.className = 'cell status-normal';
                cellEl.id = `cell-${cell.id}`;
                cellEl.innerHTML = `
                    <div class="cell-id">${cell.id}</div>
                    <div class="cell-soc">${cell.soc.toFixed(0)}%</div>
                    <div class="cell-voltage">${cell.voltage.toFixed(2)}V</div>
                `;
                
                // Add event listeners
                cellEl.addEventListener('mouseenter', (e) => this.showTooltip(cell, e));
                cellEl.addEventListener('mouseleave', () => this.hideTooltip());
                cellEl.addEventListener('click', () => this.showCellPopup(cell));
                
                cellsGrid.appendChild(cellEl);
            });
        });
    }
    
    showTooltip(cell, event) {
        const tooltip = document.getElementById('cellTooltip');
        
        document.getElementById('tooltipVoltage').textContent = `${cell.voltage.toFixed(3)} V`;
        document.getElementById('tooltipCurrent').textContent = `${cell.current.toFixed(2)} A`;
        document.getElementById('tooltipTemp').textContent = `${cell.temperature.toFixed(1)} °C`;
        document.getElementById('tooltipSOC').textContent = `${cell.soc.toFixed(1)} %`;
        document.getElementById('tooltipHealth').textContent = `${cell.health.toFixed(1)} %`;
        
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.pageX + 15}px`;
        tooltip.style.top = `${event.pageY + 15}px`;
    }
    
    hideTooltip() {
        document.getElementById('cellTooltip').style.display = 'none';
    }
    
    showCellPopup(cell) {
        this.selectedCell = cell;
        const popup = document.getElementById('cellPopup');
        
        // Update popup content
        document.getElementById('popupTitle').textContent = `Cell ${cell.id}`;
        document.getElementById('popupVoltage').textContent = `${cell.voltage.toFixed(3)} V`;
        document.getElementById('popupCurrent').textContent = `${cell.current.toFixed(3)} A`;
        document.getElementById('popupTemp').textContent = `${cell.temperature.toFixed(1)} °C`;
        document.getElementById('popupSOC').textContent = `${cell.soc.toFixed(1)} %`;
        document.getElementById('popupHealth').textContent = `${cell.health.toFixed(1)} %`;
        document.getElementById('popupCycles').textContent = cell.cycleCount;
        document.getElementById('popupResistance').textContent = `${cell.resistance.toFixed(1)} mΩ`;
        document.getElementById('popupCapacity').textContent = `${cell.capacity.toFixed(1)} Ah`;
        
        // Show popup
        popup.style.display = 'block';
        
        // Initialize cell chart
        this.initializeCellChart(cell);
    }
    
    initializeCellChart(cell) {
        const ctx = document.getElementById('cellChart');
        
        // Destroy existing chart
        if (this.cellChart) {
            this.cellChart.destroy();
        }
        
        // Generate realistic history data based on current cell state
        const historyLength = 50;
        const timeLabels = Array.from({length: historyLength}, (_, i) => `-${historyLength - i}s`);
        
        // Voltage data with realistic variation
        const voltageData = Array.from({length: historyLength}, (_, i) => {
            const trend = (cell.voltage - 3.7) * (i / historyLength);
            return 3.7 + trend + (Math.random() - 0.5) * 0.02;
        });
        voltageData.push(cell.voltage);
        
        // Temperature data
        const tempData = Array.from({length: historyLength}, (_, i) => {
            const trend = (cell.temperature - 25) * (i / historyLength);
            return 25 + trend + (Math.random() - 0.5) * 0.3;
        });
        tempData.push(cell.temperature);
        
        // SOC data
        const socData = Array.from({length: historyLength}, (_, i) => {
            const trend = (cell.soc - 50) * (i / historyLength);
            return 50 + trend + (Math.random() - 0.5) * 0.1;
        });
        socData.push(cell.soc);
        
        // Current data
        const currentData = Array.from({length: historyLength}, (_, i) => {
            return cell.current + (Math.random() - 0.5) * 0.1;
        });
        
        this.cellChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [
                    {
                        label: 'Voltage (V)',
                        data: voltageData,
                        borderColor: '#00ff88',
                        backgroundColor: 'rgba(0, 255, 136, 0.1)',
                        yAxisID: 'y',
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'Current (A)',
                        data: currentData,
                        borderColor: '#ff00ff',
                        backgroundColor: 'rgba(255, 0, 255, 0.1)',
                        yAxisID: 'y1',
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'Temperature (°C)',
                        data: tempData,
                        borderColor: '#ff4444',
                        backgroundColor: 'rgba(255, 68, 68, 0.1)',
                        yAxisID: 'y2',
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'SOC (%)',
                        data: socData,
                        borderColor: '#00aaff',
                        backgroundColor: 'rgba(0, 170, 255, 0.1)',
                        yAxisID: 'y3',
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        ticks: { 
                            color: '#a0a0a0', 
                            maxTicksLimit: 10,
                            font: { size: 10 }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { 
                            display: true, 
                            text: 'Voltage (V)', 
                            color: '#00ff88',
                            font: { size: 11 }
                        },
                        ticks: { 
                            color: '#00ff88',
                            font: { size: 10 }
                        },
                        grid: { color: 'rgba(0, 255, 136, 0.1)' },
                        min: 3.0,
                        max: 4.2
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: { 
                            display: true, 
                            text: 'Current (A)', 
                            color: '#ff00ff',
                            font: { size: 11 }
                        },
                        ticks: { 
                            color: '#ff00ff',
                            font: { size: 10 }
                        },
                        grid: { drawOnChartArea: false }
                    },
                    y2: {
                        type: 'linear',
                        position: 'right',
                        title: { 
                            display: true, 
                            text: 'Temp (°C)', 
                            color: '#ff4444',
                            font: { size: 11 }
                        },
                        ticks: { 
                            color: '#ff4444',
                            font: { size: 10 }
                        },
                        grid: { drawOnChartArea: false }
                    },
                    y3: {
                        type: 'linear',
                        position: 'right',
                        title: { 
                            display: true, 
                            text: 'SOC (%)', 
                            color: '#00aaff',
                            font: { size: 11 }
                        },
                        ticks: { 
                            color: '#00aaff',
                            font: { size: 10 }
                        },
                        grid: { drawOnChartArea: false },
                        min: 0,
                        max: 100
                    }
                },
                plugins: {
                    legend: { 
                        labels: { 
                            color: '#e0e0e0',
                            font: { size: 11 },
                            padding: 10,
                            usePointStyle: true
                        },
                        position: 'top'
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 10,
                        titleFont: { size: 12 },
                        bodyFont: { size: 11 }
                    }
                }
            }
        });
        
        // Store chart for updates
        this.selectedCellChart = this.cellChart;
    }
    
    testCell(action) {
        if (!this.selectedCell) return;
        
        const cell = this.selectedCell;
        const timestamp = new Date().toLocaleTimeString();
        
        switch (action) {
            case 'charge':
                cell.current = 2.0;
                cell.status = 'charging';
                this.addCellHistory(cell, `Force charging at 2.0A`, 'success');
                setTimeout(() => {
                    cell.soc = Math.min(100, cell.soc + 5);
                    cell.voltage = this.calculateCellVoltage(cell.soc);
                    cell.current = 0;
                    cell.status = 'normal';
                    this.updateCellDisplay(cell);
                }, 3000);
                break;
                
            case 'discharge':
                cell.current = -2.0;
                cell.status = 'discharging';
                this.addCellHistory(cell, `Force discharging at 2.0A`, 'warning');
                setTimeout(() => {
                    cell.soc = Math.max(0, cell.soc - 5);
                    cell.voltage = this.calculateCellVoltage(cell.soc);
                    cell.current = 0;
                    cell.status = 'normal';
                    this.updateCellDisplay(cell);
                }, 3000);
                break;
                
            case 'overheat':
                cell.temperature = 65;
                cell.status = 'warning';
                this.addCellHistory(cell, `Simulated overheat to 65°C`, 'warning');
                this.log(`Cell ${cell.id} overheating!`, 'warning');
                setTimeout(() => {
                    cell.temperature = 25;
                    cell.status = 'normal';
                    this.updateCellDisplay(cell);
                }, 5000);
                break;
                
            case 'balance':
                this.addCellHistory(cell, `Cell balancing initiated`, 'success');
                cell.soc = this.soc; // Balance to average
                cell.voltage = this.calculateCellVoltage(cell.soc);
                this.updateCellDisplay(cell);
                break;
                
            case 'fault':
                cell.status = 'fault';
                cell.faults.push({ type: 'injected', time: timestamp });
                this.addCellHistory(cell, `Fault injected`, 'error');
                this.log(`Cell ${cell.id} FAULT!`, 'error');
                break;
                
            case 'reset':
                cell.status = 'normal';
                cell.temperature = 25;
                cell.current = 0;
                cell.faults = [];
                this.addCellHistory(cell, `Cell reset to normal`, 'success');
                this.updateCellDisplay(cell);
                break;
        }
        
        this.updateCellDisplay(cell);
        this.updatePopupDisplay(cell);
    }
    
    addCellHistory(cell, message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const historyItem = document.createElement('div');
        historyItem.className = `history-item ${type}`;
        historyItem.textContent = `[${timestamp}] ${message}`;
        
        const historyContainer = document.getElementById('cellHistory');
        historyContainer.insertBefore(historyItem, historyContainer.firstChild);
        
        // Keep only last 20 items
        while (historyContainer.children.length > 20) {
            historyContainer.removeChild(historyContainer.lastChild);
        }
    }
    
    updateCellDisplay(cell) {
        const cellEl = document.getElementById(`cell-${cell.id}`);
        if (cellEl) {
            cellEl.className = `cell status-${cell.status}`;
            cellEl.querySelector('.cell-soc').textContent = `${cell.soc.toFixed(0)}%`;
            cellEl.querySelector('.cell-voltage').textContent = `${cell.voltage.toFixed(2)}V`;
        }
    }
    
    updatePopupDisplay(cell) {
        if (this.selectedCell && this.selectedCell.id === cell.id) {
            document.getElementById('popupVoltage').textContent = `${cell.voltage.toFixed(3)} V`;
            document.getElementById('popupCurrent').textContent = `${cell.current.toFixed(3)} A`;
            document.getElementById('popupTemp').textContent = `${cell.temperature.toFixed(1)} °C`;
            document.getElementById('popupSOC').textContent = `${cell.soc.toFixed(1)} %`;
        }
    }
    
    updateModuleStats() {
        this.modules.forEach(module => {
            let totalVoltage = 0;
            let totalCurrent = 0;
            let totalTemp = 0;
            let totalSOC = 0;
            
            module.cells.forEach(cell => {
                totalVoltage += cell.voltage;
                totalCurrent += cell.current;
                totalTemp += cell.temperature;
                totalSOC += cell.soc;
            });
            
            module.voltage = totalVoltage;
            module.current = totalCurrent / module.cells.length;
            module.temperature = totalTemp / module.cells.length;
            module.avgSOC = totalSOC / module.cells.length;
            
            // Update UI
            const voltageEl = document.getElementById(`moduleVoltage${module.id}`);
            const currentEl = document.getElementById(`moduleCurrent${module.id}`);
            const tempEl = document.getElementById(`moduleTemp${module.id}`);
            const socEl = document.getElementById(`moduleSOC${module.id}`);
            
            if (voltageEl) voltageEl.textContent = `${module.voltage.toFixed(1)} V`;
            if (currentEl) currentEl.textContent = `${module.current.toFixed(2)} A`;
            if (tempEl) tempEl.textContent = `${module.temperature.toFixed(1)}°C`;
            if (socEl) socEl.textContent = `${module.avgSOC.toFixed(0)}%`;
        });
        
        // Calculate overall stats
        this.voltage = this.modules.reduce((sum, m) => sum + m.voltage, 0) / this.modules.length;
        const ocVoltage = this.voltage * 1.05;
        const scCurrent = this.config.maxRate / this.voltage;
        const peakPower = this.config.maxRate;
        const fillFactor = (this.voltage * scCurrent) / (ocVoltage * scCurrent);
        
        // Update system display
        document.getElementById('soc').textContent = `${this.soc.toFixed(1)} %`;
        document.getElementById('dod').textContent = `${this.dod.toFixed(1)} %`;
        document.getElementById('currentPower').textContent = `${this.currentPower.toFixed(0)} W`;
        document.getElementById('batteryTemp').textContent = `${this.temperature.toFixed(1)} °C`;
        document.getElementById('workingVoltage').textContent = `${this.voltage.toFixed(1)} V`;
        document.getElementById('peakPower').textContent = `${(peakPower / 1000).toFixed(1)} kW`;
        document.getElementById('ocVoltage').textContent = `${ocVoltage.toFixed(1)} V`;
        document.getElementById('scCurrent').textContent = `${scCurrent.toFixed(1)} A`;
        document.getElementById('fillFactor').textContent = fillFactor.toFixed(2);
    }
    
    setupEventListeners() {
        // Close popup
        document.getElementById('closePopup').addEventListener('click', () => {
            document.getElementById('cellPopup').style.display = 'none';
            this.selectedCell = null;
            if (this.selectedCellChart) {
                this.selectedCellChart.destroy();
                this.selectedCellChart = null;
            }
        });
        
        // BMS Controls
        document.getElementById('runBalancing').addEventListener('click', () => {
            this.runCellBalancing();
        });
        
        document.getElementById('activateCooling').addEventListener('click', () => {
            this.activateCooling();
        });
        
        // Test controls
        document.getElementById('testMode').addEventListener('change', (e) => {
            this.testMode = e.target.value;
            this.log(`Test mode changed to: ${this.testMode}`, 'info');
        });
        
        document.getElementById('labSimSpeed').addEventListener('change', (e) => {
            this.simSpeed = parseFloat(e.target.value);
        });
        
        document.getElementById('tempOverride').addEventListener('input', (e) => {
            document.getElementById('tempValue').textContent = `${e.target.value}°C`;
        });
        
        document.getElementById('loadOverride').addEventListener('input', (e) => {
            document.getElementById('loadValue').textContent = `${e.target.value} W`;
        });
        
        // Test buttons
        document.getElementById('startTest').addEventListener('click', () => this.startTest());
        document.getElementById('pauseTest').addEventListener('click', () => this.pauseTest());
        document.getElementById('resetTest').addEventListener('click', () => this.resetTest());
        document.getElementById('exportData').addEventListener('click', () => this.exportData());
    }
    
    runCellBalancing() {
        this.log('Running cell balancing algorithm...', 'info');
        
        // Calculate average voltage
        const avgVoltage = this.cells.reduce((sum, cell) => sum + cell.voltage, 0) / this.cells.length;
        
        // Balance cells towards average
        let balancedCount = 0;
        this.cells.forEach(cell => {
            const diff = Math.abs(cell.voltage - avgVoltage);
            if (diff > 0.02) {
                cell.voltage = avgVoltage + (Math.random() - 0.5) * 0.01;
                cell.soc = ((cell.voltage - 3.0) / (4.2 - 3.0)) * 100;
                balancedCount++;
                this.updateCellDisplay(cell);
            }
        });
        
        this.updateModuleStats();
        this.updateBMSDisplay();
        this.log(`Balanced ${balancedCount} cells to ±0.02V`, 'success');
    }
    
    activateCooling() {
        this.log('Activating thermal management system...', 'info');
        
        this.cells.forEach(cell => {
            if (cell.temperature > 30) {
                cell.temperature = Math.max(25, cell.temperature - 5);
                this.updateCellDisplay(cell);
            }
        });
        
        this.updateModuleStats();
        this.updateBMSDisplay();
        this.log('Cooling activated - temperature reduced', 'success');
    }
    
    updateBMSDisplay() {
        // Calculate BMS metrics
        const voltages = this.cells.map(c => c.voltage);
        const temperatures = this.cells.map(c => c.temperature);
        const maxVoltage = Math.max(...voltages);
        const minVoltage = Math.min(...voltages);
        const maxTemp = Math.max(...temperatures);
        const minTemp = Math.min(...temperatures);
        
        // Cell balancing status
        const voltageDiff = maxVoltage - minVoltage;
        document.getElementById('maxVoltageDiff').textContent = `${voltageDiff.toFixed(3)} V`;
        document.getElementById('cellsBalanced').textContent = `${this.cells.length}/${this.cells.length}`;
        
        const balancingStatus = document.getElementById('balancingStatus');
        if (voltageDiff < 0.05) {
            balancingStatus.textContent = 'Balanced';
            balancingStatus.className = 'status-badge status-normal';
        } else {
            balancingStatus.textContent = 'Balancing';
            balancingStatus.className = 'status-badge status-warning';
        }
        
        // Thermal management
        const tempDiff = maxTemp - minTemp;
        document.getElementById('maxTemp').textContent = `${maxTemp.toFixed(1)}°C`;
        document.getElementById('tempDiff').textContent = `${tempDiff.toFixed(1)}°C`;
        
        const coolingStatus = document.getElementById('coolingStatus');
        if (maxTemp > 45) {
            coolingStatus.textContent = 'Cooling Active';
            coolingStatus.className = 'status-badge status-warning';
        } else {
            coolingStatus.textContent = 'Normal';
            coolingStatus.className = 'status-badge status-normal';
        }
        
        // Safety protection
        document.getElementById('ovProtection').textContent = maxVoltage > 4.2 ? '✗' : '✓';
        document.getElementById('ovProtection').className = maxVoltage > 4.2 ? 'protection-indicator error' : 'protection-indicator';
        
        document.getElementById('uvProtection').textContent = minVoltage < 3.0 ? '✗' : '✓';
        document.getElementById('uvProtection').className = minVoltage < 3.0 ? 'protection-indicator error' : 'protection-indicator';
        
        document.getElementById('ocProtection').textContent = Math.abs(this.currentPower) > this.config.maxRate * 1.2 ? '✗' : '✓';
        document.getElementById('ocProtection').className = Math.abs(this.currentPower) > this.config.maxRate * 1.2 ? 'protection-indicator error' : 'protection-indicator';
        
        document.getElementById('otProtection').textContent = maxTemp > 60 ? '✗' : '✓';
        document.getElementById('otProtection').className = maxTemp > 60 ? 'protection-indicator error' : 'protection-indicator';
        
        // SOH Estimation
        const avgHealth = this.cells.reduce((sum, cell) => sum + cell.health, 0) / this.cells.length;
        document.getElementById('soh').textContent = `${avgHealth.toFixed(1)}%`;
        document.getElementById('sohFill').style.width = `${avgHealth}%`;
        
        const degradationRate = (100 - avgHealth) / 12; // per month
        document.getElementById('degradationRate').textContent = `${degradationRate.toFixed(2)}%/month`;
        
        const estimatedLife = avgHealth / (degradationRate * 12);
        document.getElementById('estimatedLife').textContent = `${estimatedLife.toFixed(1)} years`;
        
        // Charge management
        const chargeMode = this.currentPower > 0 ? 'CC-CV' : this.currentPower < 0 ? 'Discharge' : 'Idle';
        document.getElementById('chargeMode').textContent = chargeMode;
        document.getElementById('chargeCurrent').textContent = `${(this.currentPower / this.voltage).toFixed(1)} A`;
        document.getElementById('cutoffVoltage').textContent = `${(this.config.nominalVoltage * 1.05).toFixed(1)} V`;
    }
    
    startTest() {
        this.testRunning = true;
        document.getElementById('startTest').disabled = true;
        document.getElementById('pauseTest').disabled = false;
        this.log(`Test started in ${this.testMode} mode`, 'success');
    }
    
    pauseTest() {
        this.testRunning = false;
        document.getElementById('startTest').disabled = false;
        document.getElementById('pauseTest').disabled = true;
        this.log('Test paused', 'warning');
    }
    
    resetTest() {
        this.testRunning = false;
        this.initializeCells();
        this.renderModules();
        this.log('All cells reset', 'info');
    }
    
    exportData() {
        const exportData = {
            timestamp: new Date().toISOString(),
            batteryModel: this.batteryModel,
            modules: this.modules.map(m => ({
                id: m.id,
                voltage: m.voltage,
                current: m.current,
                temperature: m.temperature,
                avgSOC: m.avgSOC,
                cells: m.cells.map(c => ({
                    id: c.id,
                    voltage: c.voltage,
                    current: c.current,
                    temperature: c.temperature,
                    soc: c.soc,
                    health: c.health,
                    status: c.status
                }))
            }))
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `battery-lab-data-${Date.now()}.json`;
        a.click();
        
        this.log('Data exported successfully', 'success');
    }
    
    startMonitoring() {
        setInterval(() => {
            if (this.testRunning) {
                this.runTestCycle();
            }
            
            this.updateModuleStats();
            this.updateCharts();
            this.updateBMSDisplay();
            
            // Update DOD
            this.dod = 100 - this.soc;
            
            // Update cell chart if popup is open
            if (this.selectedCell && this.selectedCellChart) {
                this.updateSelectedCellChart();
            }
        }, 1000);
    }
    
    updateSelectedCellChart() {
        if (!this.selectedCellChart || !this.selectedCell) return;
        
        const cell = this.selectedCell;
        const chart = this.selectedCellChart;
        
        // Shift data if needed
        if (chart.data.labels.length >= 50) {
            chart.data.labels.shift();
            chart.data.datasets.forEach(dataset => dataset.data.shift());
        }
        
        // Add new data point
        const timeLabel = new Date().toLocaleTimeString();
        chart.data.labels.push(timeLabel);
        chart.data.datasets[0].data.push(cell.voltage);
        chart.data.datasets[1].data.push(cell.current);
        chart.data.datasets[2].data.push(cell.temperature);
        chart.data.datasets[3].data.push(cell.soc);
        
        chart.update('none');
    }
    
    runTestCycle() {
        const tempOverride = parseFloat(document.getElementById('tempOverride').value);
        const loadOverride = parseFloat(document.getElementById('loadOverride').value);
        
        switch (this.testMode) {
            case 'stress':
                // Rapid charge/discharge cycles
                this.cells.forEach(cell => {
                    cell.current = (Math.random() - 0.5) * 4;
                    cell.temperature = tempOverride + Math.random() * 5;
                });
                break;
                
            case 'thermal':
                // Temperature stress
                this.cells.forEach(cell => {
                    cell.temperature = tempOverride + Math.sin(Date.now() / 1000) * 10;
                    if (cell.temperature > 60) {
                        cell.status = 'warning';
                    }
                });
                break;
                
            case 'capacity':
                // Full discharge test
                this.cells.forEach(cell => {
                    cell.soc = Math.max(0, cell.soc - 0.1 * this.simSpeed);
                    cell.voltage = this.calculateCellVoltage(cell.soc);
                });
                break;
                
            case 'aging':
                // Simulate aging
                this.cells.forEach(cell => {
                    cell.health -= 0.001 * this.simSpeed;
                    cell.resistance += 0.01 * this.simSpeed;
                    cell.cycleCount += 0.1 * this.simSpeed;
                });
                break;
        }
        
        // Apply load override
        if (loadOverride !== 0) {
            this.currentPower = loadOverride;
            this.updateCellsFromSOC(this.soc);
        }
        
        // Update displays
        this.cells.forEach(cell => this.updateCellDisplay(cell));
    }
    
    initializeCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: true,
            animation: false,
            plugins: {
                legend: { labels: { color: '#e0e0e0' } }
            },
            scales: {
                x: {
                    ticks: { color: '#a0a0a0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    ticks: { color: '#a0a0a0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        };
        
        // Module Voltage Chart
        this.charts.moduleVoltage = new Chart(document.getElementById('moduleVoltageChart'), {
            type: 'bar',
            data: {
                labels: this.modules.map(m => `Module ${m.id}`),
                datasets: [{
                    label: 'Voltage (V)',
                    data: this.modules.map(m => m.voltage),
                    backgroundColor: 'rgba(0, 255, 136, 0.6)',
                    borderColor: '#00ff88',
                    borderWidth: 2
                }]
            },
            options: chartOptions
        });
        
        // Module Temperature Chart
        this.charts.moduleTemp = new Chart(document.getElementById('moduleTempChart'), {
            type: 'line',
            data: {
                labels: this.modules.map(m => `Module ${m.id}`),
                datasets: [{
                    label: 'Temperature (°C)',
                    data: this.modules.map(m => m.temperature),
                    borderColor: '#ff4444',
                    backgroundColor: 'rgba(255, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: chartOptions
        });
        
        // Cell SOC Distribution
        this.charts.cellSOC = new Chart(document.getElementById('cellSOCChart'), {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Cell SOC',
                    data: this.cells.map((cell, idx) => ({ x: idx, y: cell.soc })),
                    backgroundColor: 'rgba(0, 170, 255, 0.6)',
                    borderColor: '#00aaff',
                    pointRadius: 4
                }]
            },
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: {
                        ...chartOptions.scales.y,
                        min: 0,
                        max: 100,
                        title: { display: true, text: 'SOC (%)', color: '#a0a0a0' }
                    },
                    x: {
                        ...chartOptions.scales.x,
                        title: { display: true, text: 'Cell Index', color: '#a0a0a0' }
                    }
                }
            }
        });
        
        // Cell Health
        this.charts.cellHealth = new Chart(document.getElementById('cellHealthChart'), {
            type: 'bar',
            data: {
                labels: this.cells.map(c => c.id),
                datasets: [{
                    label: 'Health (%)',
                    data: this.cells.map(c => c.health),
                    backgroundColor: this.cells.map(c => 
                        c.health > 95 ? 'rgba(0, 255, 136, 0.6)' : 
                        c.health > 80 ? 'rgba(255, 170, 0, 0.6)' : 
                        'rgba(255, 68, 68, 0.6)'
                    ),
                    borderWidth: 0
                }]
            },
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: { ...chartOptions.scales.y, min: 0, max: 100 },
                    x: { ...chartOptions.scales.x, display: false }
                }
            }
        });
        
        // Power Flow Timeline
        this.charts.powerFlow = new Chart(document.getElementById('powerFlowChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Power (W)',
                    data: [],
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: chartOptions
        });
        
        // Temperature Timeline
        this.charts.tempTime = new Chart(document.getElementById('tempTimeChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: this.modules.map((m, idx) => ({
                    label: `Module ${m.id}`,
                    data: [],
                    borderColor: `hsl(${idx * 60}, 70%, 60%)`,
                    backgroundColor: `hsla(${idx * 60}, 70%, 60%, 0.1)`,
                    tension: 0.4
                }))
            },
            options: chartOptions
        });
    }
    
    updateCharts() {
        const timestamp = new Date().toLocaleTimeString();
        
        // Update module charts
        this.charts.moduleVoltage.data.datasets[0].data = this.modules.map(m => m.voltage);
        this.charts.moduleVoltage.update('none');
        
        this.charts.moduleTemp.data.datasets[0].data = this.modules.map(m => m.temperature);
        this.charts.moduleTemp.update('none');
        
        this.charts.cellSOC.data.datasets[0].data = this.cells.map((cell, idx) => ({ x: idx, y: cell.soc }));
        this.charts.cellSOC.update('none');
        
        this.charts.cellHealth.data.datasets[0].data = this.cells.map(c => c.health);
        this.charts.cellHealth.update('none');
        
        // Update timeline charts
        const maxPoints = 50;
        
        if (this.charts.powerFlow.data.labels.length >= maxPoints) {
            this.charts.powerFlow.data.labels.shift();
            this.charts.powerFlow.data.datasets[0].data.shift();
        }
        
        this.charts.powerFlow.data.labels.push(timestamp);
        this.charts.powerFlow.data.datasets[0].data.push(this.currentPower);
        this.charts.powerFlow.update('none');
        
        if (this.charts.tempTime.data.labels.length >= maxPoints) {
            this.charts.tempTime.data.labels.shift();
            this.charts.tempTime.data.datasets.forEach(ds => ds.data.shift());
        }
        
        this.charts.tempTime.data.labels.push(timestamp);
        this.modules.forEach((m, idx) => {
            this.charts.tempTime.data.datasets[idx].data.push(m.temperature);
        });
        this.charts.tempTime.update('none');
    }
    
    log(message, type = 'info') {
        const alertsContainer = document.getElementById('alertsContainer');
        const timestamp = new Date().toLocaleTimeString();
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = `[${timestamp}] ${message}`;
        
        alertsContainer.insertBefore(alert, alertsContainer.firstChild);
        
        // Keep only last 50 alerts
        while (alertsContainer.children.length > 50) {
            alertsContainer.removeChild(alertsContainer.lastChild);
        }
    }
}

// Initialize Battery Lab
let batteryLab;
document.addEventListener('DOMContentLoaded', () => {
    batteryLab = new BatteryLab();
});
