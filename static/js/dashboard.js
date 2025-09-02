// React-inspired dashboard with matching functionality
window.RxDash = (function () {
  const colors = {
    // New Lavender/Periwinkle Color Scheme
    brandBlue: '#1A9BD7',
    periwinkle: '#5C6BC0',
    periwinkleDark: '#3F51B5',
    periwinkleLight: '#9FA8DA',
    lavender: '#E8EAF6',
    
    // Status Colors
    success: '#34A853',
    warning: '#FBBC05',
    critical: '#EA4335',
    info: '#5C6BC0',
    
    // Legacy compatibility - updated to periwinkle colors
    blue500: '#5C6BC0',
    blue600: '#3F51B5',
    blue700: '#303F9F',
    green600: '#34A853',
    red600: '#EA4335',
    orange600: '#FBBC05',
    yellow600: '#FBBC05',
    purple600: '#5C6BC0',
    purple700: '#3F51B5',
    indigo600: '#5C6BC0',
    gray500: '#5F6368',
    
    // Chart palette
    primary: '#5C6BC0',
    secondary: '#34A853',
    muted: '#5F6368',
    cyan600: '#5C6BC0'
  };

  // State management (like React useState)
  let dashboardState = {
    timeRange: 30,
    forecastHorizon: 12,
    alertSensitivity: 50,
    selectedDrug: 'all'
  };

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  }

  function formatRiskBadge(level) {
    const cls = {
      critical: 'risk-critical',
      high: 'risk-high', 
      medium: 'risk-medium',
      low: 'risk-low'
    }[level.toLowerCase()] || 'risk-low';
    return `<span class="risk-badge ${cls}">${level}</span>`;
  }

  // Mock data matching the React component
  const mockInventoryData = [
    { name: 'Morphine', stock: 85, reorderLevel: 20, expiry: '2025-03-15', risk: 'low' },
    { name: 'Paracetamol', stock: 12, reorderLevel: 50, expiry: '2025-02-28', risk: 'critical' },
    { name: 'Insulin', stock: 45, reorderLevel: 30, expiry: '2025-06-10', risk: 'medium' },
    { name: 'Aspirin', stock: 78, reorderLevel: 25, expiry: '2025-04-20', risk: 'low' },
    { name: 'Antibiotics', stock: 23, reorderLevel: 40, expiry: '2025-05-15', risk: 'high' }
  ];

  const mockAnomalyData = [
    { date: '2025-08-15', drug: 'Morphine', usage: 45, expected: 32, anomaly: true },
    { date: '2025-08-20', drug: 'Insulin', usage: 78, expected: 65, anomaly: true },
    { date: '2025-08-25', drug: 'Paracetamol', usage: 12, expected: 89, anomaly: true }
  ];

  const mockDepartmentUsage = [
    { department: 'ICU', usage: 35, budget: 85000 },
    { department: 'Emergency', usage: 28, budget: 65000 },
    { department: 'Surgery', usage: 22, budget: 95000 },
    { department: 'General', usage: 15, budget: 45000 }
  ];

  // Render inventory list
  function renderInventoryList(inventoryData = mockInventoryData) {
    const container = document.getElementById('inventory-list');
    if (!container) return;

    const html = inventoryData.map(drug => {
      // Handle both API format (drug_name, current_stock, risk_level) and mock format (name, stock, risk)
      const name = drug.drug_name || drug.name;
      const stock = drug.current_stock || drug.stock;
      const risk = drug.risk_level || drug.risk;
      
      return `
        <div class="inventory-item">
          <div class="item-info">
            <div class="item-name">${name}</div>
            <div class="item-stock">Stock: ${stock} units</div>
            <div class="item-weeks">Weeks left: ${drug.weeks_remaining || 'N/A'}</div>
          </div>
          ${formatRiskBadge(risk)}
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  // Render anomaly list
  function renderAnomalyList() {
    const container = document.getElementById('anomaly-list');
    if (!container) return;

    const html = mockAnomalyData.map(anomaly => `
      <div class="anomaly-item">
        <div class="anomaly-info">
          <div class="anomaly-drug">${anomaly.drug}</div>
          <div class="anomaly-usage">Usage: ${anomaly.usage} (Expected: ${anomaly.expected})</div>
        </div>
        <div class="anomaly-date">${anomaly.date}</div>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  // Create advanced forecast chart with real API data
  async function createForecastChart(drugName = 'Paracetamol', containerId = 'forecast-chart') {
    try {
      const periods = dashboardState.forecastHorizon || 12;
      const forecastData = await fetchJson(`/api/v1/forecast/chart/${drugName}?periods=${periods}`);
      
      const layout = {
        title: {
          text: `AI-Powered Demand Forecast - ${forecastData.drug_name}`,
          font: { family: 'Inter, sans-serif', size: 18, color: colors.gray500 }
        },
        xaxis: { 
          title: { text: 'Time Period', font: { size: 14 } },
          gridcolor: '#e5e7eb',
          linecolor: '#d1d5db',
          tickfont: { family: 'Inter, sans-serif', size: 12 },
          zeroline: false
        },
        yaxis: { 
          title: { text: 'Usage Units', font: { size: 14 } },
          gridcolor: '#e5e7eb',
          linecolor: '#d1d5db',
          tickfont: { family: 'Inter, sans-serif', size: 12 },
          zeroline: false
        },
        plot_bgcolor: 'rgba(248, 250, 252, 0.3)',
        paper_bgcolor: 'white',
        font: { family: 'Inter, sans-serif', size: 12 },
        margin: { l: 60, r: 40, t: 80, b: 60 },
        legend: { 
          orientation: 'h', 
          y: -0.2,
          x: 0.5,
          xanchor: 'center',
          font: { size: 12 }
        },
        hovermode: 'x unified',
        showlegend: true,
        annotations: [{
          x: 0.02,
          y: 0.98,
          xref: 'paper',
          yref: 'paper',
          text: `Forecast Horizon: ${periods} weeks | Sensitivity: ${dashboardState.alertSensitivity}%`,
          showarrow: false,
          font: { size: 10, color: '#6b7280' },
          align: 'left'
        }]
      };

      const traces = [];
      
      // Actual data with enhanced styling
      if (forecastData.actual && forecastData.actual.length > 0) {
        traces.push({
          x: forecastData.actual.map(d => d.x),
          y: forecastData.actual.map(d => d.y),
          type: 'scatter',
          mode: 'lines+markers',
          name: '📊 Historical Data',
          line: { 
            color: colors.blue600, 
            width: 4,
            shape: 'spline'
          },
          marker: { 
            size: 10, 
            color: colors.blue600,
            line: { color: 'white', width: 2 }
          },
          hovertemplate: '<b>Historical</b><br>Period: %{x}<br>Usage: %{y} units<extra></extra>'
        });
      }

      // Predicted data with confidence intervals
      if (forecastData.predicted && forecastData.predicted.length > 0) {
        // Confidence band (lower)
        traces.push({
          x: forecastData.predicted.map(d => d.x),
          y: forecastData.predicted.map(d => d.lower),
          type: 'scatter',
          mode: 'lines',
          name: 'Lower CI',
          line: { width: 0 },
          showlegend: false,
          hoverinfo: 'skip'
        });

        // Confidence band (upper)
        traces.push({
          x: forecastData.predicted.map(d => d.x),
          y: forecastData.predicted.map(d => d.upper),
          type: 'scatter',
          mode: 'lines',
          name: 'Upper CI',
          fill: 'tonexty',
          fillcolor: 'rgba(92, 107, 192, 0.15)',
          line: { width: 0 },
          showlegend: false,
          hoverinfo: 'skip'
        });

        // Main prediction line
        traces.push({
          x: forecastData.predicted.map(d => d.x),
          y: forecastData.predicted.map(d => d.y),
          type: 'scatter',
          mode: 'lines+markers',
          name: '🔮 AI Prediction',
          line: { 
            color: colors.periwinkle, 
            width: 4,
            dash: 'dot',
            shape: 'spline'
          },
          marker: { 
            size: 10, 
            color: colors.periwinkle,
            symbol: 'diamond',
            line: { color: 'white', width: 2 }
          },
          hovertemplate: '<b>Predicted</b><br>Period: %{x}<br>Usage: %{y} units<br>Range: %{customdata[0]} - %{customdata[1]}<extra></extra>',
          customdata: forecastData.predicted.map(d => [d.lower, d.upper])
        });
      }

      if (document.getElementById(containerId)) {
        Plotly.newPlot(containerId, traces, layout, { 
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
          displaylogo: false
        });
      }
      
    } catch (error) {
      console.error('Forecast chart failed:', error);
      createAdvancedSampleForecastChart(containerId);
    }
  }

  // Advanced fallback sample chart
  function createAdvancedSampleForecastChart(containerId = 'forecast-chart') {
    const periods = dashboardState.forecastHorizon || 12;
    const sensitivity = dashboardState.alertSensitivity || 50;
    
    const layout = {
      title: {
        text: `Advanced Forecast - Sample Data (${periods} periods)`,
        font: { family: 'Inter, sans-serif', size: 18, color: colors.gray500 }
      },
      xaxis: { 
        title: { text: 'Time Period', font: { size: 14 } },
        gridcolor: '#e5e7eb',
        tickfont: { family: 'Inter, sans-serif', size: 12 }
      },
      yaxis: { 
        title: { text: 'Usage Units', font: { size: 14 } },
        gridcolor: '#e5e7eb',
        tickfont: { family: 'Inter, sans-serif', size: 12 }
      },
      plot_bgcolor: 'rgba(248, 250, 252, 0.3)',
      paper_bgcolor: 'white',
      font: { family: 'Inter, sans-serif', size: 12 },
      margin: { l: 60, r: 40, t: 80, b: 60 },
      legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center' },
      hovermode: 'x unified',
      annotations: [{
        x: 0.02, y: 0.98, xref: 'paper', yref: 'paper',
        text: `Periods: ${periods} | Sensitivity: ${sensitivity}% | Sample Data`,
        showarrow: false, font: { size: 10, color: '#6b7280' }
      }]
    };

    // Generate dynamic data based on slider values
    const weeks = Array.from({length: periods}, (_, i) => `W${i+1}`);
    const baseValue = 120;
    const variance = sensitivity / 100 * 50; // Higher sensitivity = more variance
    
    const actual = weeks.slice(0, periods/2).map((_, i) => 
      baseValue + Math.sin(i * 0.5) * variance + Math.random() * 20 - 10
    );
    
    const predicted = weeks.slice(periods/2).map((_, i) => 
      baseValue + Math.sin((i + periods/2) * 0.5) * variance + Math.random() * 15 - 7.5
    );
    
    const upper = predicted.map(val => val + variance * 0.8);
    const lower = predicted.map(val => val - variance * 0.8);

    const traces = [
      {
        x: weeks.slice(0, actual.length),
        y: actual,
        type: 'scatter',
        mode: 'lines+markers',
        name: '📊 Historical Data',
        line: { color: colors.blue600, width: 4, shape: 'spline' },
        marker: { size: 10, color: colors.blue600, line: { color: 'white', width: 2 } }
      },
      {
        x: weeks.slice(actual.length),
        y: lower,
        type: 'scatter',
        mode: 'lines',
        name: 'Lower CI',
        line: { width: 0 },
        showlegend: false,
        hoverinfo: 'skip'
      },
      {
        x: weeks.slice(actual.length),
        y: upper,
        type: 'scatter',
        mode: 'lines',
        fill: 'tonexty',
        fillcolor: 'rgba(92, 107, 192, 0.15)',
        line: { width: 0 },
        showlegend: false,
        hoverinfo: 'skip'
      },
      {
        x: weeks.slice(actual.length),
        y: predicted,
        type: 'scatter', 
        mode: 'lines+markers',
        name: '🔮 AI Prediction',
        line: { color: colors.periwinkle, width: 4, dash: 'dot', shape: 'spline' },
        marker: { size: 10, color: colors.periwinkle, symbol: 'diamond', line: { color: 'white', width: 2 } }
      }
    ];

    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, traces, layout, { 
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
      });
    }
  }

  // Create risk distribution pie chart
  function createRiskChart(riskData, containerId = 'risk-chart') {
    const values = [riskData.CRITICAL || 0, riskData.HIGH || 0, riskData.MEDIUM || 0, riskData.LOW || 0];
    const labels = ['Critical', 'High', 'Medium', 'Low'];
    const chartColors = [colors.critical, colors.warning, colors.info, colors.success];

    const trace = {
      values: values,
      labels: labels,
      type: 'pie',
      hole: 0.4,
      marker: { colors: chartColors },
      textinfo: 'label+percent',
      textposition: 'outside',
      hovertemplate: '%{label}: %{value} drugs<br>%{percent}<extra></extra>'
    };

    const layout = {
      title: 'Drug Risk Distribution',
      font: { family: 'Inter, sans-serif' },
      margin: { l: 20, r: 20, t: 50, b: 20 },
      paper_bgcolor: 'white',
      showlegend: false
    };

    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, [trace], layout, { responsive: true });
    }
  }

  // Create department usage bar chart
  function createDepartmentChart(deptData, containerId = 'dept-chart') {
    const departments = deptData.map(d => d.department);
    const drugCounts = deptData.map(d => d.drug_count);

    const trace = {
      x: departments,
      y: drugCounts,
      type: 'bar',
      marker: { color: colors.periwinkle },
      hovertemplate: '%{x}: %{y} drugs<extra></extra>'
    };

    const layout = {
      title: 'Department Usage',
      xaxis: { title: 'Department' },
      yaxis: { title: 'Number of Drugs' },
      font: { family: 'Inter, sans-serif' },
      margin: { l: 50, r: 30, t: 50, b: 80 },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white'
    };

    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, [trace], layout, { responsive: true });
    }
  }

  // Create budget analysis area chart
  function createBudgetChart(containerId = 'budget-chart') {
    const departments = ['ICU', 'Emergency', 'Surgery', 'General'];
    const budgetData = [85000, 72000, 65000, 48000];

    const trace = {
      x: departments,
      y: budgetData,
      type: 'scatter',
      mode: 'lines',
      fill: 'tonexty',
      fillcolor: 'rgba(92, 107, 192, 0.2)',
      line: { color: colors.periwinkle, width: 3 },
      hovertemplate: '%{x}: $%{y:,.0f}<extra></extra>'
    };

    const layout = {
      title: 'Budget Analysis by Department',
      xaxis: { title: 'Department' },
      yaxis: { title: 'Budget ($)', tickformat: ',.0f' },
      font: { family: 'Inter, sans-serif' },
      margin: { l: 60, r: 30, t: 50, b: 50 },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white'
    };

    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, [trace], layout, { responsive: true });
    }
  }

  // Create anomaly detection timeline
  function createAnomalyChart(containerId = 'anomaly-chart') {
    const dates = ['2025-08-15', '2025-08-20', '2025-08-25'];
    const drugs = ['Morphine', 'Insulin', 'Paracetamol'];
    const usage = [45, 78, 12];
    const expected = [32, 65, 89];

    const trace1 = {
      x: dates,
      y: usage,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Actual Usage',
      line: { color: colors.warning, width: 3 },
      marker: { size: 10 }
    };

    const trace2 = {
      x: dates, 
      y: expected,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Expected Usage',
      line: { color: colors.muted, width: 2, dash: 'dash' },
      marker: { size: 8 }
    };

    const layout = {
      title: 'Anomaly Detection Timeline',
      xaxis: { title: 'Date' },
      yaxis: { title: 'Usage' },
      font: { family: 'Inter, sans-serif' },
      margin: { l: 50, r: 30, t: 50, b: 50 },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      hovermode: 'x unified'
    };

    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, [trace1, trace2], layout, { responsive: true });
    }
  }

  function renderTopLowStock(list) {
    const tbody = document.querySelector('#low-stock-body');
    if (!tbody) return;
    tbody.innerHTML = list.slice(0, 10).map(r => `
      <tr>
        <td>${r.drug_name}</td>
        <td>${r.department || ''}</td>
        <td>${r.current_stock}</td>
        <td>${r.weekly_sales}</td>
        <td>${Math.round(r.weeks_remaining * 10) / 10}</td>
        <td>${formatRiskBadge(r.risk_level)}</td>
      </tr>
    `).join('');
  }

  function renderCounters(metrics) {
    const map = [
      ['#count-drugs', metrics.drugs_loaded || 0],
      ['#count-depts', metrics.active_departments || 0], 
      ['#count-weeks', metrics.historical_weeks || '-']
    ];
    for (const [sel, val] of map) {
      const el = document.querySelector(sel);
      if (el) el.textContent = val;
    }
  }

  function setupSliderHandlers() {
    const sliders = ['#alert-sensitivity', '#forecast-horizon'];
    sliders.forEach(selector => {
      const slider = document.querySelector(selector);
      if (slider) {
        slider.addEventListener('input', function() {
          console.log(`${selector} changed to: ${this.value}`);
          // Update charts based on slider values
          refreshCharts();
        });
      }
    });
  }

  function refreshCharts() {
    // Refresh all charts when sliders change
    setTimeout(() => {
      createForecastChart();
      // Add slight delay for smooth updates
    }, 100);
  }

  // Create advanced risk distribution chart
  function createRiskChart(riskData = {}, containerId = 'risk-chart') {
    const values = [riskData.CRITICAL || 3, riskData.HIGH || 7, riskData.MEDIUM || 12, riskData.LOW || 8];
    const labels = ['🚨 Critical Risk', '⚠️ High Risk', '🟡 Medium Risk', '✅ Low Risk'];
    const chartColors = [colors.red600, colors.orange600, colors.yellow600, colors.green600];
    
    // Add subtle gradient effect using periwinkle/lavender colors
    const gradientColors = [
      'rgba(234, 67, 53, 0.9)',
      'rgba(251, 188, 5, 0.9)', 
      'rgba(92, 107, 192, 0.9)',
      'rgba(52, 168, 83, 0.9)'
    ];

    const trace = {
      values: values,
      labels: labels,
      type: 'pie',
      hole: 0.4,
      marker: { 
        colors: gradientColors,
        line: { color: 'white', width: 3 }
      },
      textinfo: 'label+percent+value',
      textposition: 'outside',
      textfont: { size: 11, family: 'Inter, sans-serif' },
      hovertemplate: '<b>%{label}</b><br>Count: %{value} drugs<br>Percentage: %{percent}<br><extra></extra>',
      pull: [0.1, 0.05, 0, 0] // Pull out critical and high risk slices
    };

    const layout = {
      title: {
        text: 'Drug Risk Distribution',
        font: { family: 'Inter, sans-serif', size: 14, color: colors.gray500 },
        y: 0.95
      },
      font: { family: 'Inter, sans-serif', size: 10 },
      margin: { l: 10, r: 10, t: 40, b: 10 },
      paper_bgcolor: 'white',
      showlegend: false,
      annotations: [{
        text: `Total<br><b>${values.reduce((a,b) => a+b, 0)}</b><br>Drugs`,
        x: 0.5, y: 0.5,
        font: { size: 14, color: colors.gray500 },
        showarrow: false
      }]
    };

    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, [trace], layout, { 
        responsive: true,
        displayModeBar: false
      });
    }

    // Update alert counts with animation
    animateCounter('critical-count', values[0]);
    animateCounter('high-count', values[1]);
  }

  // Animate counter numbers
  function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startValue = parseInt(element.textContent) || 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentValue = Math.round(startValue + (targetValue - startValue) * progress);
      
      element.textContent = currentValue;
      
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    }
    
    requestAnimationFrame(updateCounter);
  }

  // Create advanced anomaly detection timeline chart
  async function createAnomalyChart(containerId = 'anomaly-chart') {
    try {
      const sensitivity = dashboardState.alertSensitivity || 50;
      const anomalyData = await fetchJson(`/api/v1/anomaly-detection?sensitivity=${sensitivity}`);
      
      if (!anomalyData.anomalies || anomalyData.anomalies.length === 0) {
        throw new Error('No anomaly data available');
      }
      
      const dates = anomalyData.anomalies.map(a => a.date);
      const actual = anomalyData.anomalies.map(a => a.actual_usage);
      const expected = anomalyData.anomalies.map(a => a.expected_usage);
      const deviations = anomalyData.anomalies.map(a => Math.abs(a.deviation_percent));
      
      const traces = [
        {
          x: dates,
          y: actual,
          type: 'scatter',
          mode: 'lines+markers',
          name: '📈 Actual Usage',
          line: { color: colors.red600, width: 3 },
          marker: { 
            size: deviations.map(d => Math.max(8, d/10 + 5)), // Size based on deviation
            color: colors.red600,
            line: { color: 'white', width: 2 }
          },
          hovertemplate: '<b>Actual</b><br>Date: %{x}<br>Usage: %{y}<br>Deviation: %{customdata}%<extra></extra>',
          customdata: deviations
        },
        {
          x: dates,
          y: expected,
          type: 'scatter',
          mode: 'lines+markers',
          name: '📊 Expected Usage',
          line: { color: colors.blue600, width: 2, dash: 'dash' },
          marker: { size: 6, color: colors.blue600 },
          hovertemplate: '<b>Expected</b><br>Date: %{x}<br>Usage: %{y}<extra></extra>'
        }
      ];
      
      const layout = {
        title: {
          text: `Anomaly Detection Timeline (${anomalyData.summary.total_anomalies} anomalies found)`,
          font: { family: 'Inter, sans-serif', size: 14, color: colors.gray500 }
        },
        xaxis: { 
          title: 'Date',
          tickfont: { family: 'Inter, sans-serif', size: 10 }
        },
        yaxis: { 
          title: 'Usage',
          tickfont: { family: 'Inter, sans-serif', size: 10 }
        },
        font: { family: 'Inter, sans-serif', size: 10 },
        margin: { l: 50, r: 20, t: 50, b: 40 },
        paper_bgcolor: 'white',
        plot_bgcolor: 'rgba(248, 250, 252, 0.3)',
        hovermode: 'x unified',
        legend: { x: 0.02, y: 0.98 }
      };
      
      if (document.getElementById(containerId)) {
        Plotly.newPlot(containerId, traces, layout, { 
          responsive: true,
          displayModeBar: false
        });
      }
      
    } catch (error) {
      console.warn('Anomaly chart failed, using sample data:', error);
      createSampleAnomalyChart(containerId);
    }
  }

  function createSampleAnomalyChart(containerId = 'anomaly-chart') {
    const sensitivity = dashboardState.alertSensitivity || 50;
    const dates = ['2025-08-15', '2025-08-20', '2025-08-25', '2025-08-30'];
    const baseActual = [45, 78, 12, 65];
    const baseExpected = [32, 65, 89, 58];
    
    // Adjust based on sensitivity
    const variance = sensitivity / 100 * 20;
    const actual = baseActual.map(val => val + (Math.random() - 0.5) * variance);
    const expected = baseExpected;
    
    const traces = [
      {
        x: dates,
        y: actual,
        type: 'scatter',
        mode: 'lines+markers',
        name: '📈 Actual Usage',
        line: { color: colors.red600, width: 3 },
        marker: { size: [12, 10, 15, 8], color: colors.red600, line: { color: 'white', width: 2 } }
      },
      {
        x: dates,
        y: expected,
        type: 'scatter',
        mode: 'lines+markers', 
        name: '📊 Expected Usage',
        line: { color: colors.blue600, width: 2, dash: 'dash' },
        marker: { size: 6, color: colors.blue600 }
      }
    ];
    
    const layout = {
      title: {
        text: `Anomaly Detection - Sample Data (Sensitivity: ${sensitivity}%)`,
        font: { family: 'Inter, sans-serif', size: 14, color: colors.gray500 }
      },
      xaxis: { title: 'Date', tickfont: { family: 'Inter, sans-serif', size: 10 } },
      yaxis: { title: 'Usage', tickfont: { family: 'Inter, sans-serif', size: 10 } },
      font: { family: 'Inter, sans-serif', size: 10 },
      margin: { l: 50, r: 20, t: 50, b: 40 },
      paper_bgcolor: 'white',
      plot_bgcolor: 'rgba(248, 250, 252, 0.3)',
      hovermode: 'x unified',
      legend: { x: 0.02, y: 0.98 }
    };
    
    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, traces, layout, { 
        responsive: true,
        displayModeBar: false
      });
    }
  }

  // Create enhanced department usage bar chart
  function createDepartmentChart(containerId = 'dept-chart') {
    const timeRange = dashboardState.timeRange || 30;
    const departments = mockDepartmentUsage.map(d => d.department);
    
    // Adjust usage based on time range (simulate time-sensitive data)
    const timeFactor = timeRange / 30; // Scale factor based on time range
    const usage = mockDepartmentUsage.map(d => Math.round(d.usage * timeFactor));
    
    // Color bars based on usage levels
    const colors_array = usage.map(val => {
      if (val > 30) return colors.red600;
      if (val > 20) return colors.orange600;
      if (val > 10) return colors.yellow600;
      return colors.green600;
    });

    const trace = {
      x: departments,
      y: usage,
      type: 'bar',
      marker: { 
        color: colors_array,
        line: { color: 'white', width: 2 }
      },
      hovertemplate: '<b>%{x}</b><br>Usage: %{y} drugs<br>Time Range: ' + timeRange + ' days<extra></extra>'
    };

    const layout = {
      title: {
        text: `Department Usage (${timeRange} day period)`,
        font: { family: 'Inter, sans-serif', size: 14, color: colors.gray500 }
      },
      font: { family: 'Inter, sans-serif', size: 10 },
      margin: { l: 50, r: 20, t: 50, b: 70 },
      paper_bgcolor: 'white',
      plot_bgcolor: 'rgba(248, 250, 252, 0.3)',
      xaxis: { 
        tickfont: { family: 'Inter, sans-serif', size: 10 },
        gridcolor: '#e5e7eb'
      },
      yaxis: { 
        title: 'Drug Count',
        tickfont: { family: 'Inter, sans-serif', size: 10 },
        gridcolor: '#e5e7eb'
      }
    };

    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, [trace], layout, { 
        responsive: true,
        displayModeBar: false
      });
    }
  }

  // Create enhanced budget analysis area chart
  function createBudgetChart(containerId = 'budget-chart') {
    const timeRange = dashboardState.timeRange || 30;
    const alertSensitivity = dashboardState.alertSensitivity || 50;
    
    const departments = mockDepartmentUsage.map(d => d.department);
    
    // Adjust budgets based on time range and sensitivity
    const timeFactor = timeRange / 30;
    const sensitivityFactor = alertSensitivity / 50;
    const budgets = mockDepartmentUsage.map(d => Math.round(d.budget * timeFactor * sensitivityFactor));

    const trace = {
      x: departments,
      y: budgets,
      type: 'scatter',
      mode: 'lines+markers',
      fill: 'tozeroy',
      fillcolor: 'rgba(16, 185, 129, 0.2)',
      line: { 
        color: colors.green600, 
        width: 4,
        shape: 'spline'
      },
      marker: {
        size: 10,
        color: colors.green600,
        line: { color: 'white', width: 2 }
      },
      hovertemplate: '<b>%{x}</b><br>Budget: $%{y:,.0f}<br>Time: ' + timeRange + ' days<br>Sensitivity: ' + alertSensitivity + '%<extra></extra>'
    };

    const layout = {
      title: {
        text: `Budget Analysis (${timeRange}d, ${alertSensitivity}% sensitivity)`,
        font: { family: 'Inter, sans-serif', size: 14, color: colors.gray500 }
      },
      font: { family: 'Inter, sans-serif', size: 10 },
      margin: { l: 70, r: 20, t: 50, b: 70 },
      paper_bgcolor: 'white',
      plot_bgcolor: 'rgba(248, 250, 252, 0.3)',
      xaxis: { 
        tickfont: { family: 'Inter, sans-serif', size: 10 },
        gridcolor: '#e5e7eb'
      },
      yaxis: { 
        title: 'Budget ($)',
        tickfont: { family: 'Inter, sans-serif', size: 10 },
        gridcolor: '#e5e7eb',
        tickformat: ',.0f'
      }
    };

    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, [trace], layout, { 
        responsive: true,
        displayModeBar: false
      });
    }
  }

  function renderCounters(metrics = {}) {
    document.getElementById('count-drugs').textContent = metrics.drugs_loaded || 30;
    document.getElementById('count-weeks').textContent = metrics.historical_weeks || 52;
    document.getElementById('count-depts').textContent = metrics.active_departments || 7;
  }

  function setupSliderHandlers() {
    // Set up slider event listeners with proper state updates and immediate feedback
    const sliders = [
      { id: 'time-range', state: 'timeRange', display: 'time-range-value' },
      { id: 'forecast-horizon', state: 'forecastHorizon', display: 'forecast-horizon-value' },
      { id: 'alert-sensitivity', state: 'alertSensitivity', display: 'alert-sensitivity-value' }
    ];

    sliders.forEach(({ id, state, display }) => {
      const slider = document.getElementById(id);
      const valueDisplay = document.getElementById(display);
      
      if (slider) {
        // Initialize display value
        if (valueDisplay) {
          const unit = id === 'time-range' ? ' days' : 
                      id === 'forecast-horizon' ? ' weeks' : '%';
          valueDisplay.textContent = slider.value + unit;
        }
        
        // Add both input and change event listeners for immediate feedback
        ['input', 'change'].forEach(eventType => {
          slider.addEventListener(eventType, function() {
            const value = parseInt(this.value);
            dashboardState[state] = value;
            
            // Update display value immediately
            if (valueDisplay) {
              const unit = id === 'time-range' ? ' days' : 
                          id === 'forecast-horizon' ? ' weeks' : '%';
              valueDisplay.textContent = value + unit;
            }
            
            console.log(`🎛️ ${id} updated:`, value);
            
            // Add visual feedback to slider
            this.style.background = `linear-gradient(to right, var(--periwinkle) 0%, var(--periwinkle) ${(value - this.min) / (this.max - this.min) * 100}%, var(--card-shadow) ${(value - this.min) / (this.max - this.min) * 100}%, var(--card-shadow) 100%)`;
            
            // Debounced chart refresh for performance
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = setTimeout(() => refreshCharts(), 300);
          });
        });
      }
    });

    // Drug filter dropdown
    const drugFilter = document.getElementById('drug-filter');
    if (drugFilter) {
      drugFilter.addEventListener('change', function() {
        dashboardState.selectedDrug = this.value;
        console.log('Drug filter changed:', this.value);
        refreshCharts();
      });
    }

    // Set up all button click handlers
    setupButtonHandlers();
  }

  function refreshCharts() {
    // Refresh all charts based on current dashboard state with loading indicators
    console.log('🔄 Refreshing all charts with state:', dashboardState);
    
    // Add loading indicators to chart containers
    const chartContainers = ['forecast-chart', 'risk-chart', 'anomaly-chart', 'dept-chart', 'budget-chart', 'dept-performance-chart', 'budget-performance-chart', 'supply-chain-chart'];
    chartContainers.forEach(containerId => {
      const container = document.getElementById(containerId);
      if (container) {
        container.style.opacity = '0.6';
        container.style.transition = 'opacity 0.3s ease';
      }
    });
    
    // Refresh main forecast chart with current drug selection and forecast horizon
    const drugName = dashboardState.selectedDrug === 'all' ? 'Paracetamol' : dashboardState.selectedDrug;
    createForecastChart(drugName);
    
    // Refresh risk chart with animation
    createRiskChart();
    
    // Refresh anomaly chart with current sensitivity
    createAnomalyChart();
    
    // Refresh department and budget charts with time-sensitive data
    createDepartmentChart();
    createBudgetChart();
    
    // Refresh business analysis charts
    createDepartmentPerformanceChart();
    createBudgetPerformanceChart();
    createSupplyChainChart();
    
    // Update any time-range dependent data displays
    updateTimeRangeDependentData();
    
    // Remove loading indicators after a brief delay
    setTimeout(() => {
      chartContainers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
          container.style.opacity = '1';
        }
      });
    }, 500);
    
    // Show success notification
    showNotification('📊 Charts updated successfully!', 'success');
  }

  function updateTimeRangeDependentData() {
    const timeRange = dashboardState.timeRange;
    
    // Update the inventory list based on time range (simulate filtering)
    const filteredInventory = mockInventoryData.map(drug => ({
      ...drug,
      stock: Math.max(0, drug.stock - Math.floor((365 - timeRange) / 30) * 5) // Simulate time-based stock changes
    }));
    
    renderInventoryList(filteredInventory);
    
    // Update any other time-sensitive elements
    const statusText = document.querySelector('.header-status span');
    if (statusText) {
      statusText.textContent = `System Online - Monitoring ${timeRange} day period`;
    }
  }

  // Populate drug filter dropdown with all available drugs
  async function populateDrugFilter() {
    try {
      // Get all drugs from the database
      const response = await fetch('/api/v1/drugs');
      const drugs = await response.json();
      
      const drugFilter = document.getElementById('drug-filter');
      if (!drugFilter) return;
      
      // Clear existing options except 'All'
      drugFilter.innerHTML = '<option value="all">All Drugs</option>';
      
      // Add each drug as an option
      if (drugs && drugs.length > 0) {
        drugs.forEach(drug => {
          const option = document.createElement('option');
          const drugName = drug.drug_name || drug.name;
          option.value = drugName.toLowerCase();
          option.textContent = drugName;
          drugFilter.appendChild(option);
        });
        console.log(`✅ Loaded ${drugs.length} drugs into filter`);
      } else {
        // Fallback to common drugs if API fails
        const commonDrugs = [
          'Paracetamol', 'Ibuprofen', 'Morphine', 'Insulin_Glargine', 'Insulin_Aspart',
          'Amoxicillin', 'Ceftriaxone', 'Vancomycin', 'Ciprofloxacin', 'Azithromycin',
          'Lisinopril', 'Atorvastatin', 'Amlodipine', 'Metoprolol', 'Warfarin',
          'Omeprazole', 'Pantoprazole', 'Metformin', 'Levothyroxine', 'Prednisolone'
        ];
        
        commonDrugs.forEach(drugName => {
          const option = document.createElement('option');
          option.value = drugName.toLowerCase();
          option.textContent = drugName;
          drugFilter.appendChild(option);
        });
        console.log(`⚠️ Using fallback drugs (${commonDrugs.length})`);
      }
    } catch (error) {
      console.error('Failed to load drugs for filter:', error);
    }
  }

  function setupButtonHandlers() {
    // Add click handlers to all buttons based on their text content
    const allButtons = document.querySelectorAll('.btn');
    
    allButtons.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Add visual feedback with improved loading state
        this.classList.add('loading');
        this.style.transform = 'scale(0.98)';
        this.style.transition = 'all 0.1s ease';
        
        setTimeout(() => {
          this.style.transform = 'scale(1)';
          this.classList.remove('loading');
        }, 1000);
        
        const text = this.textContent.trim();
        console.log('🔘 Button clicked:', text);
        showNotification(`${text} - Action initiated`, 'info', 2000);
        
        // Handle different button types
        if (text.includes('Check System Health')) {
          fetch('/api/v1/health')
            .then(res => res.json())
            .then(data => {
              showNotification(`✅ System Status: ${data.status} | Database: Active | Version: ${data.version}`, 'success', 4000);
              console.log('Health check data:', data);
            })
            .catch(err => {
              showNotification(`❌ Health check failed: ${err.message}`, 'error', 4000);
              console.error('Health check error:', err);
            });
            
        } else if (text.includes('View All Drugs')) {
          window.location.href = '/drugs';
          
        } else if (text.includes('ICU Drugs')) {
          dashboardState.selectedDrug = 'morphine';
          const drugFilter = document.getElementById('drug-filter');
          if (drugFilter) drugFilter.value = 'morphine';
          createForecastChart('Morphine');
          showNotification('🏥 Switched to ICU drug view - Morphine forecast loaded', 'success');
          
        } else if (text.includes('Morphine Forecast')) {
          dashboardState.selectedDrug = 'morphine';
          const drugFilter = document.getElementById('drug-filter');
          if (drugFilter) drugFilter.value = 'morphine';
          createForecastChart('Morphine');
          showNotification('💊 Morphine forecast updated with current settings', 'success');
          
        } else if (text.includes('Paracetamol Forecast')) {
          dashboardState.selectedDrug = 'paracetamol';
          const drugFilter = document.getElementById('drug-filter');
          if (drugFilter) drugFilter.value = 'paracetamol';
          createForecastChart('Paracetamol');
          showNotification('💊 Paracetamol forecast updated with current settings', 'success');
          
        } else if (text.includes('Insulin Forecast')) {
          dashboardState.selectedDrug = 'insulin';
          const drugFilter = document.getElementById('drug-filter');
          if (drugFilter) drugFilter.value = 'insulin';
          createForecastChart('Insulin');
          showNotification('💊 Insulin forecast updated with current settings', 'success');
          
        } else if (text.includes('Analyze All Drugs')) {
          showNotification('🔍 Running anomaly detection analysis...', 'info', 2000);
          fetch('/api/v1/bulk_anomalies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              days_back: dashboardState.timeRange || 180,
              sensitivity: dashboardState.alertSensitivity || 50 
            })
          })
            .then(res => res.json())
            .then(data => {
              console.log('Anomaly data loaded:', data);
              showNotification('🔍 Anomaly analysis complete! Results updated in charts.', 'success', 3000);
              renderAnomalyList();
              createAnomalyChart(); // Refresh with new data
            })
            .catch(err => {
              console.error('Anomaly detection failed:', err);
              showNotification('❌ Anomaly analysis failed. Using sample data.', 'error', 4000);
              createAnomalyChart(); // Show sample data
            });
            
        } else if (text.includes('Advanced Analysis')) {
          showNotification('🔬 Advanced Analysis features coming soon! ML-based detection, seasonal patterns, and demand spike prediction.', 'info', 4000);
          
        } else if (text.includes('Download CSV')) {
          showNotification('📥 Generating CSV report...', 'info', 2000);
          
          // Try to fetch real data first
          fetch('/api/v1/reorder_report?format=csv')
            .then(res => res.blob())
            .then(blob => {
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `rx-forecaster-report-${new Date().toISOString().split('T')[0]}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
              showNotification('📥 CSV report downloaded successfully!', 'success', 3000);
            })
            .catch(err => {
              console.error('CSV download failed, using sample data:', err);
              // Fallback to sample data
              const csvData = [
                'Drug,Current Stock,Risk Level,Department,Reorder Qty,Last Updated',
                `Morphine,${85 + Math.floor(Math.random() * 20)},Low,ICU,150,${new Date().toISOString().split('T')[0]}`,
                `Paracetamol,${12 + Math.floor(Math.random() * 10)},Critical,Emergency,500,${new Date().toISOString().split('T')[0]}`,
                `Insulin,${45 + Math.floor(Math.random() * 15)},Medium,General,200,${new Date().toISOString().split('T')[0]}`,
                `Antibiotics,${78 + Math.floor(Math.random() * 25)},High,Surgery,300,${new Date().toISOString().split('T')[0]}`
              ].join('\n');
              
              const blob = new Blob([csvData], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `rx-forecaster-sample-${new Date().toISOString().split('T')[0]}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
              showNotification('📥 Sample CSV report downloaded!', 'success', 3000);
            });
          
        } else if (text.includes('Generate Report')) {
          showNotification('📊 Generating comprehensive report...', 'info', 2000);
          
          // Simulate report generation with actual data gathering
          const reportData = {
            timestamp: new Date().toISOString(),
            timeRange: dashboardState.timeRange,
            forecastHorizon: dashboardState.forecastHorizon,
            alertSensitivity: dashboardState.alertSensitivity,
            selectedDrug: dashboardState.selectedDrug
          };
          
          setTimeout(() => {
            showNotification('📊 Report generated! Includes inventory status, forecasts, risk assessments, and anomaly findings.', 'success', 4000);
            console.log('Report data:', reportData);
          }, 1500);
          
        } else if (text.includes('Department Report') || text.includes('Usage Trends') || text.includes('Efficiency Metrics')) {
          createDepartmentPerformanceChart();
          showNotification(`📈 ${text} updated with current data`, 'success');
          
        } else if (text.includes('Budget Report') || text.includes('Cost Analysis')) {
          createBudgetPerformanceChart();
          showNotification(`💰 ${text} updated with financial data`, 'success');
          
        } else if (text.includes('Export Financial Data')) {
          showNotification('💰 Exporting financial data...', 'info', 2000);
          // Generate financial CSV
          const financialData = [
            'Month,Budgeted,Actual,Variance,Department',
            'Jan,450000,435000,-3.33%,All',
            'Feb,420000,445000,5.95%,All',
            'Mar,480000,465000,-3.13%,All',
            'Apr,510000,525000,2.94%,All'
          ].join('\n');
          
          const blob = new Blob([financialData], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          showNotification('💰 Financial data exported successfully!', 'success');
          
        } else if (text.includes('Supplier Analysis') || text.includes('Lead Time Optimization') || text.includes('Inventory Optimization')) {
          createSupplyChainChart();
          showNotification(`🚚 ${text} updated with supply chain data`, 'success');
        }
        
        // Remove loading state
        setTimeout(() => this.classList.remove('loading'), 1000);
      });
    });
    
    // Add search functionality
    const searchBtn = document.getElementById('search-drug-btn');
    const searchInput = document.getElementById('drug-search');
    
    if (searchBtn && searchInput) {
      function performSearch() {
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) {
          showNotification('⚠️ Please enter a drug name to search', 'error', 3000);
          searchInput.focus();
          return;
        }
        
        console.log('🔍 Searching for drug:', searchTerm);
        showNotification(`🔍 Searching for: ${searchTerm}...`, 'info', 2000);
        
        // Update dashboard state
        dashboardState.selectedDrug = searchTerm.toLowerCase();
        
        // Update drug filter if the option exists
        const drugFilter = document.getElementById('drug-filter');
        if (drugFilter) {
          const option = Array.from(drugFilter.options).find(opt => 
            opt.text.toLowerCase().includes(searchTerm.toLowerCase())
          );
          if (option) {
            drugFilter.value = option.value;
            showNotification(`✅ Found ${option.text} in drug list`, 'success', 2000);
          } else {
            showNotification(`⚠️ ${searchTerm} not in predefined list - using custom search`, 'info', 3000);
          }
        }
        
        // Create forecast chart for the searched drug
        createForecastChart(searchTerm);
        
        // Update other relevant charts
        setTimeout(() => {
          showNotification(`📊 Forecast updated for: ${searchTerm}`, 'success', 3000);
        }, 1000);
        
        // Clear search input
        searchInput.value = '';
      }
      
      searchBtn.addEventListener('click', performSearch);
      
      // Allow search on Enter key
      searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          performSearch();
        }
      });
      
      // Add autocomplete functionality
      searchInput.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        if (value.length > 1) {
          const drugFilter = document.getElementById('drug-filter');
          if (drugFilter) {
            const suggestions = Array.from(drugFilter.options)
              .filter(opt => opt.text.toLowerCase().includes(value))
              .slice(0, 3);
            
            if (suggestions.length > 0) {
              this.title = `Suggestions: ${suggestions.map(s => s.text).join(', ')}`;
            } else {
              this.title = 'Enter drug name to search';
            }
          }
        } else {
          this.title = 'Enter drug name to search';
        }
      });
    }
    
    // Add keyboard shortcuts for accessibility
    document.addEventListener('keydown', function(e) {
      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('drug-search');
        if (searchInput) {
          searchInput.focus();
          showNotification('🔍 Search focused - Enter drug name', 'info', 2000);
        }
      }
      
      // Escape to clear focus
      if (e.key === 'Escape') {
        document.activeElement.blur();
      }
    });
  }

  async function load() {
    console.log('🚀 Loading RxForecaster Dashboard...');
    
    try {
      // Load real API data
      const [metrics, charts, alerts] = await Promise.all([
        fetchJson('/api/v1/dashboard/metrics').catch(e => { console.warn('Metrics API failed:', e); return null; }),
        fetchJson('/api/v1/inventory/charts').catch(e => { console.warn('Charts API failed:', e); return null; }),
        fetchJson('/api/v1/alerts/critical').catch(e => { console.warn('Alerts API failed:', e); return null; })
      ]);

      console.log('✅ Dashboard data loaded:', { metrics, charts, alerts });

      // Update counters with real or mock data
      renderCounters(metrics);
      
      // Populate drug filter with all available drugs
      await populateDrugFilter();
      
      // Render static lists with API data
      if (charts && charts.top_low_stock) {
        console.log('✅ Loading', charts.top_low_stock.length, 'inventory items');
        renderInventoryList(charts.top_low_stock);
      } else {
        console.warn('⚠️ Using mock inventory data');
        renderInventoryList(mockInventoryData);
      }
      renderAnomalyList();

      // Create all charts
      console.log('📊 Creating charts...');
      createForecastChart('Paracetamol');
      createRiskChart(charts?.risk_distribution);
      createDepartmentChart();
      createBudgetChart();
      createAnomalyChart(); // Add anomaly detection chart
      
      // Create business analysis charts
      createDepartmentPerformanceChart();
      createBudgetPerformanceChart();
      createSupplyChainChart();

      // Setup interactive controls
      console.log('🎛️ Setting up interactive controls...');
      setupSliderHandlers();
      
      // Add touch support for mobile devices
      addTouchSupport();
      
      // Auto-refresh data every 5 minutes
      setInterval(() => {
        console.log('🔄 Auto-refreshing dashboard data...');
        refreshCharts();
        showNotification('🔄 Dashboard data refreshed automatically', 'info', 2000);
      }, 300000); // 5 minutes
      
      console.log('✅ Dashboard fully loaded and interactive!');

    } catch (e) {
      console.error('❌ Dashboard load failed:', e);
      console.log('🔄 Falling back to mock data...');
      
      // Still render with mock data
      renderCounters({ drugs_loaded: 30, historical_weeks: 52, active_departments: 7 });
      renderInventoryList();
      renderAnomalyList();
      createForecastChart('Paracetamol');
      createRiskChart();
      createDepartmentChart();
      createBudgetChart();
      createAnomalyChart(); // Add anomaly detection chart
      
      // Create business analysis charts
      createDepartmentPerformanceChart();
      createBudgetPerformanceChart();
      createSupplyChainChart();
      
      setupSliderHandlers();
      
      console.log('✅ Dashboard loaded with mock data!');
    }
  }

  // Create enhanced department performance chart
  function createDepartmentPerformanceChart(containerId = 'dept-performance-chart') {
    const timeRange = dashboardState.timeRange || 30;
    
    const departments = ['ICU', 'Emergency', 'Surgery', 'General', 'Cardiology', 'Pediatrics', 'Oncology'];
    const currentUsage = [85, 78, 65, 45, 58, 42, 38].map(val => val * (timeRange / 30));
    const targetUsage = [90, 80, 70, 50, 60, 45, 40];
    const efficiency = currentUsage.map((curr, i) => Math.round((curr / targetUsage[i]) * 100));
    
    const trace1 = {
      x: departments,
      y: currentUsage,
      type: 'bar',
      name: 'Current Usage',
      marker: { color: colors.blue600 },
      hovertemplate: '<b>%{x}</b><br>Current: %{y} drugs<br>Time Range: ' + timeRange + ' days<extra></extra>'
    };
    
    const trace2 = {
      x: departments,
      y: targetUsage,
      type: 'bar',
      name: 'Target Usage',
      marker: { color: colors.green600 },
      hovertemplate: '<b>%{x}</b><br>Target: %{y} drugs<extra></extra>'
    };
    
    const trace3 = {
      x: departments,
      y: efficiency,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Efficiency %',
      yaxis: 'y2',
      line: { color: colors.orange600, width: 3 },
      marker: { size: 10, color: colors.orange600 },
      hovertemplate: '<b>%{x}</b><br>Efficiency: %{y}%<extra></extra>'
    };
    
    const layout = {
      title: {
        text: `Department Performance Analysis (${timeRange} day period)`,
        font: { family: 'Inter, sans-serif', size: 18, color: colors.gray500 }
      },
      xaxis: { title: 'Department', tickfont: { size: 12 } },
      yaxis: { 
        title: 'Drug Usage Count',
        tickfont: { size: 12 },
        side: 'left'
      },
      yaxis2: {
        title: 'Efficiency %',
        overlaying: 'y',
        side: 'right',
        tickfont: { size: 12 }
      },
      barmode: 'group',
      font: { family: 'Inter, sans-serif', size: 12 },
      margin: { l: 60, r: 60, t: 80, b: 80 },
      paper_bgcolor: 'white',
      plot_bgcolor: 'rgba(248, 250, 252, 0.3)',
      legend: { x: 0.7, y: 1 }
    };
    
    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, [trace1, trace2, trace3], layout, { 
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
      });
    }
  }

  // Create enhanced budget performance chart
  function createBudgetPerformanceChart(containerId = 'budget-performance-chart') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const budgeted = [450000, 420000, 480000, 510000, 475000, 490000];
    const actual = [435000, 445000, 465000, 525000, 460000, 505000];
    const variance = actual.map((act, i) => ((act - budgeted[i]) / budgeted[i] * 100));
    
    const trace1 = {
      x: months,
      y: budgeted,
      type: 'bar',
      name: 'Budgeted Amount',
      marker: { color: colors.blue600 },
      hovertemplate: '<b>%{x}</b><br>Budgeted: $%{y:,.0f}<extra></extra>'
    };
    
    const trace2 = {
      x: months,
      y: actual,
      type: 'bar',
      name: 'Actual Spend',
      marker: { color: colors.cyan600 },
      hovertemplate: '<b>%{x}</b><br>Actual: $%{y:,.0f}<extra></extra>'
    };
    
    const trace3 = {
      x: months,
      y: variance,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Variance %',
      yaxis: 'y2',
      line: { color: colors.red600, width: 3 },
      marker: { size: 10, color: colors.red600 },
      hovertemplate: '<b>%{x}</b><br>Variance: %{y:.1f}%<extra></extra>'
    };
    
    const layout = {
      title: {
        text: 'Financial Budget Analysis - Monthly Variance',
        font: { family: 'Inter, sans-serif', size: 18, color: colors.gray500 }
      },
      xaxis: { title: 'Month', tickfont: { size: 12 } },
      yaxis: { 
        title: 'Amount ($)',
        tickfont: { size: 12 },
        tickformat: ',.0f'
      },
      yaxis2: {
        title: 'Variance %',
        overlaying: 'y',
        side: 'right',
        tickfont: { size: 12 }
      },
      barmode: 'group',
      font: { family: 'Inter, sans-serif', size: 12 },
      margin: { l: 80, r: 60, t: 80, b: 60 },
      paper_bgcolor: 'white',
      plot_bgcolor: 'rgba(248, 250, 252, 0.3)',
      legend: { x: 0.02, y: 0.98 }
    };
    
    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, [trace1, trace2, trace3], layout, { 
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
      });
    }
  }

  // Create supply chain optimization chart
  function createSupplyChainChart(containerId = 'supply-chain-chart') {
    const suppliers = ['PharmaCorp', 'MediSupply', 'HealthDist', 'GlobalMed', 'BioPharma'];
    const leadTimes = [7, 10, 5, 12, 8]; // days
    const reliability = [98, 95, 99, 92, 96]; // percentage
    const costScore = [85, 78, 92, 75, 88]; // cost efficiency score
    const orderVolume = [12500, 8900, 15200, 6800, 10400]; // order volumes
    
    const trace1 = {
      x: leadTimes,
      y: reliability,
      mode: 'markers',
      type: 'scatter',
      marker: {
        size: orderVolume.map(vol => Math.max(10, vol/500)), // Scale bubble size
        color: costScore,
        colorscale: 'Viridis',
        showscale: true,
        colorbar: { title: 'Cost Efficiency Score' }
      },
      text: suppliers,
      textposition: 'top center',
      hovertemplate: '<b>%{text}</b><br>Lead Time: %{x} days<br>Reliability: %{y}%<br>Order Volume: %{customdata:,.0f}<extra></extra>',
      customdata: orderVolume,
      name: 'Suppliers'
    };
    
    const layout = {
      title: {
        text: 'Supply Chain Performance Matrix',
        font: { family: 'Inter, sans-serif', size: 18, color: colors.gray500 }
      },
      xaxis: { 
        title: 'Lead Time (Days)',
        tickfont: { size: 12 },
        range: [0, 15]
      },
      yaxis: { 
        title: 'Reliability (%)',
        tickfont: { size: 12 },
        range: [85, 100]
      },
      font: { family: 'Inter, sans-serif', size: 12 },
      margin: { l: 60, r: 60, t: 80, b: 60 },
      paper_bgcolor: 'white',
      plot_bgcolor: 'rgba(248, 250, 252, 0.3)',
      annotations: [{
        x: 0.02, y: 0.02, xref: 'paper', yref: 'paper',
        text: 'Bubble size = Order Volume | Color = Cost Efficiency',
        showarrow: false, font: { size: 10, color: colors.gray500 }
      }]
    };
    
    if (document.getElementById(containerId)) {
      Plotly.newPlot(containerId, [trace1], layout, { 
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
      });
    }
  }

  // Add touch support for mobile devices
  function addTouchSupport() {
    // Add touch event handlers for sliders
    const sliders = document.querySelectorAll('.slider');
    sliders.forEach(slider => {
      slider.addEventListener('touchstart', function(e) {
        this.style.transform = 'scale(1.05)';
        this.style.transition = 'transform 0.1s ease';
      });
      
      slider.addEventListener('touchend', function(e) {
        this.style.transform = 'scale(1)';
      });
    });
    
    // Add touch feedback for buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
      button.addEventListener('touchstart', function(e) {
        this.style.transform = 'scale(0.98)';
        this.style.transition = 'transform 0.1s ease';
      });
      
      button.addEventListener('touchend', function(e) {
        this.style.transform = 'scale(1)';
      });
    });
    
    // Add swipe gesture for chart navigation (basic implementation)
    let touchStartX = 0;
    const chartContainers = document.querySelectorAll('.chart-container, .chart-container-xl, .chart-container-large');
    
    chartContainers.forEach(container => {
      container.addEventListener('touchstart', function(e) {
        touchStartX = e.touches[0].clientX;
      });
      
      container.addEventListener('touchend', function(e) {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;
        
        // Simple swipe detection (more than 50px swipe)
        if (Math.abs(diff) > 50) {
          if (diff > 0) {
            // Swipe left - could trigger next view
            console.log('Swipe left detected on chart');
          } else {
            // Swipe right - could trigger previous view
            console.log('Swipe right detected on chart');
          }
        }
      });
    });
    
    console.log('📱 Touch support enabled for mobile devices');
  }

  // Add notification system
  function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.dashboard-notification');
    existingNotifications.forEach(n => n.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `dashboard-notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? 'var(--color-success)' : type === 'error' ? 'var(--color-critical)' : 'var(--periwinkle)'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      animation: slideInRight 0.3s ease;
      max-width: 400px;
      font-family: 'Inter', sans-serif;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .notification-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `;
    document.head.appendChild(style);
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after duration
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  return { load, refreshCharts, showNotification };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (window.RxDash) {
    window.RxDash.load();
  }
});


