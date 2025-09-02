// React-inspired dashboard with matching functionality
window.RxDash = (function () {
  const colors = {
    blue500: '#3b82f6',
    blue600: '#2563eb',
    blue700: '#1d4ed8',
    green600: '#16a34a',
    red600: '#dc2626',
    orange600: '#ea580c',
    yellow600: '#ca8a04',
    purple600: '#9333ea',
    purple700: '#7c3aed',
    indigo600: '#4f46e5',
    gray500: '#6b7280',
    // Additional palette used in charts below
    primary: '#1e40af',
    secondary: '#3b82f6',
    success: '#059669',
    warning: '#ea580c',
    critical: '#dc2626',
    muted: '#94a3b8',
    cyan600: '#0891b2'
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
          fillcolor: 'rgba(124, 58, 237, 0.15)',
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
            color: colors.purple700, 
            width: 4,
            dash: 'dot',
            shape: 'spline'
          },
          marker: { 
            size: 10, 
            color: colors.purple700,
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
        fillcolor: 'rgba(124, 58, 237, 0.15)',
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
        line: { color: colors.purple700, width: 4, dash: 'dot', shape: 'spline' },
        marker: { size: 10, color: colors.purple700, symbol: 'diamond', line: { color: 'white', width: 2 } }
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
    const chartColors = [colors.critical, colors.warning, colors.secondary, colors.success];

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
      marker: { color: colors.secondary },
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
      fillcolor: 'rgba(30,64,175,0.2)',
      line: { color: colors.primary, width: 3 },
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
    
    // Add subtle gradient effect
    const gradientColors = [
      'rgba(220, 38, 38, 0.9)',
      'rgba(234, 88, 12, 0.9)', 
      'rgba(202, 138, 4, 0.9)',
      'rgba(5, 150, 105, 0.9)'
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
    // Set up slider event listeners with proper state updates
    const sliders = [
      { id: 'time-range', state: 'timeRange', display: 'time-range-value' },
      { id: 'forecast-horizon', state: 'forecastHorizon', display: 'forecast-horizon-value' },
      { id: 'alert-sensitivity', state: 'alertSensitivity', display: 'alert-sensitivity-value' }
    ];

    sliders.forEach(({ id, state, display }) => {
      const slider = document.getElementById(id);
      const valueDisplay = document.getElementById(display);
      
      if (slider) {
        slider.addEventListener('input', function() {
          const value = parseInt(this.value);
          dashboardState[state] = value;
          
          // Update display value
          if (valueDisplay) {
            const unit = id === 'time-range' ? ' days' : 
                        id === 'forecast-horizon' ? ' weeks' : '%';
            valueDisplay.textContent = value + unit;
          }
          
          console.log(`Updated ${id}:`, value);
          refreshCharts();
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
    // Refresh all charts based on current dashboard state
    console.log('🔄 Refreshing all charts with state:', dashboardState);
    
    // Refresh main forecast chart with current drug selection and forecast horizon
    const drugName = dashboardState.selectedDrug === 'all' ? 'Paracetamol' : dashboardState.selectedDrug;
    createForecastChart(drugName);
    
    // Refresh risk chart (static but animated)
    createRiskChart();
    
    // Refresh anomaly chart with current sensitivity
    createAnomalyChart();
    
    // Refresh department and budget charts with time-sensitive data
    createDepartmentChart();
    createBudgetChart();
    
    // Update any time-range dependent data displays
    updateTimeRangeDependentData();
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
        // Add visual feedback
        this.classList.add('loading');
        setTimeout(() => this.classList.remove('loading'), 2000);
        
        const text = this.textContent.trim();
        console.log('🔘 Button clicked:', text);
        
        // Handle different button types
        if (text.includes('Check System Health')) {
          fetch('/api/v1/health')
            .then(res => res.json())
            .then(data => {
              alert(`✅ System Status: ${data.status}\n📊 Database: ${data.database ? 'Connected' : 'Disconnected'}\n🔢 Drugs Loaded: ${data.drugs_count || 'N/A'}`);
            })
            .catch(err => alert('❌ Health check failed: ' + err.message));
            
        } else if (text.includes('View All Drugs')) {
          window.location.href = '/drugs';
          
        } else if (text.includes('ICU Drugs')) {
          dashboardState.selectedDrug = 'morphine'; // ICU typically uses Morphine
          document.getElementById('drug-filter').value = 'morphine';
          createForecastChart('Morphine');
          
        } else if (text.includes('Morphine Forecast')) {
          dashboardState.selectedDrug = 'morphine';
          document.getElementById('drug-filter').value = 'morphine';
          createForecastChart('Morphine');
          
        } else if (text.includes('Paracetamol Forecast')) {
          dashboardState.selectedDrug = 'paracetamol';
          document.getElementById('drug-filter').value = 'paracetamol';
          createForecastChart('Paracetamol');
          
        } else if (text.includes('Insulin Forecast')) {
          dashboardState.selectedDrug = 'insulin';
          document.getElementById('drug-filter').value = 'insulin';
          createForecastChart('Insulin');
          
        } else if (text.includes('Analyze All Drugs')) {
          fetch('/api/v1/anomaly-detection')
            .then(res => res.json())
            .then(data => {
              console.log('Anomaly data loaded:', data);
              alert('🔍 Anomaly analysis complete! Check the Anomaly Detection panel for results.');
              renderAnomalyList(); // Refresh with new data
            })
            .catch(err => {
              console.error('Anomaly detection failed:', err);
              alert('❌ Anomaly analysis failed. Using sample data.');
            });
            
        } else if (text.includes('Advanced Analysis')) {
          alert('🔬 Advanced Analysis feature coming soon!\nWill include:\n• ML-based anomaly detection\n• Seasonal pattern analysis\n• Demand spike prediction');
          
        } else if (text.includes('Download CSV')) {
          // Generate CSV download
          const csvData = [
            'Drug,Stock,Risk,Department,Last Updated',
            'Morphine,85,Low,ICU,2025-01-01',
            'Paracetamol,12,Critical,Emergency,2025-01-01',
            'Insulin,45,Medium,General,2025-01-01'
          ].join('\n');
          
          const blob = new Blob([csvData], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'rx-forecaster-inventory.csv';
          a.click();
          window.URL.revokeObjectURL(url);
          
        } else if (text.includes('Generate Report')) {
          alert('📊 Report generation started!\n\nReport will include:\n• Inventory status\n• Demand forecasts\n• Risk assessments\n• Anomaly findings\n\nCheck your downloads folder in a few moments.');
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
          alert('⚠️ Please enter a drug name to search');
          return;
        }
        
        console.log('🔍 Searching for drug:', searchTerm);
        
        // Update dashboard state
        dashboardState.selectedDrug = searchTerm;
        
        // Update drug filter if the option exists
        const drugFilter = document.getElementById('drug-filter');
        if (drugFilter) {
          const option = Array.from(drugFilter.options).find(opt => 
            opt.text.toLowerCase().includes(searchTerm.toLowerCase())
          );
          if (option) {
            drugFilter.value = option.value;
          }
        }
        
        // Create forecast chart for the searched drug
        createForecastChart(searchTerm);
        
        // Show success message
        alert(`🔍 Search complete! Showing forecast for: ${searchTerm}`);
        
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
    }
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

  return { load, refreshCharts };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (window.RxDash) {
    window.RxDash.load();
  }
});


