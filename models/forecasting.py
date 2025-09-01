"""
Advanced Forecasting Models for RxForecaster Supply Chain System
Implements FB Prophet and ARIMA models with model comparison and selection
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

# Prophet for time series forecasting
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    print("⚠️  Prophet not available. Install with: pip install prophet")
    PROPHET_AVAILABLE = False

# ARIMA from statsmodels
try:
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.seasonal import seasonal_decompose
    from statsmodels.tsa.stattools import adfuller
    STATSMODELS_AVAILABLE = True
except ImportError:
    print("⚠️  Statsmodels not available. Install with: pip install statsmodels")
    STATSMODELS_AVAILABLE = False

from sklearn.metrics import mean_squared_error
import sqlite3


class ForecastingEngine:
    """Advanced forecasting engine with multiple models and automatic selection"""
    
    def __init__(self, db_path: str = "data/pharmacy.db"):
        self.db_path = db_path
        self.models = {}
        self.model_performance = {}
    
    def prepare_data(self, drug_name: str, days_back: int = 365) -> pd.DataFrame:
        """Prepare time series data for forecasting"""
        # Get historical sales data
        with sqlite3.connect(self.db_path) as conn:
            cutoff_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
            query = """
                SELECT date, SUM(sales_quantity) as sales
                FROM historical_sales
                WHERE drug_name = ? AND date >= ?
                GROUP BY date
                ORDER BY date
            """
            df = pd.read_sql_query(query, conn, params=(drug_name, cutoff_date))
        
        if len(df) == 0:
            raise ValueError(f"No historical data found for {drug_name}")
        
        df['date'] = pd.to_datetime(df['date'])
        df = df.set_index('date').asfreq('D', fill_value=0)  # Fill missing dates with 0
        
        # Smooth the data with 7-day rolling average
        df['sales_smooth'] = df['sales'].rolling(window=7, center=True).mean().fillna(df['sales'])
        
        return df.reset_index()
    
    def prophet_forecast(self, df: pd.DataFrame, periods: int = 30) -> Dict:
        """Generate forecast using Facebook Prophet"""
        if not PROPHET_AVAILABLE:
            raise ImportError("Prophet not available")
        
        # Prepare data for Prophet (requires 'ds' and 'y' columns)
        prophet_df = df[['date', 'sales_smooth']].rename(columns={'date': 'ds', 'sales_smooth': 'y'})
        
        # Initialize Prophet with sensible parameters for drug demand
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            seasonality_mode='multiplicative',
            changepoint_prior_scale=0.05,  # Lower value for more stable forecasts
            seasonality_prior_scale=10,
            uncertainty_samples=1000
        )
        
        # Add custom seasonalities for healthcare patterns
        model.add_seasonality(name='monthly', period=30.5, fourier_order=5)
        
        # Fit model
        model.fit(prophet_df)
        
        # Make future dataframe
        future = model.make_future_dataframe(periods=periods)
        forecast = model.predict(future)
        
        # Extract forecast results
        latest_forecast = forecast.tail(periods)
        
        # Calculate RMSE on historical data
        historical_pred = forecast[:-periods]
        rmse = np.sqrt(mean_squared_error(prophet_df['y'], historical_pred['yhat']))
        
        return {
            'model_name': 'Prophet',
            'forecast': latest_forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].to_dict('records'),
            'rmse': rmse,
            'model_object': model,
            'changepoints': model.changepoints.tolist(),
            'trend': latest_forecast['trend'].mean()
        }
    
    def arima_forecast(self, df: pd.DataFrame, periods: int = 30) -> Dict:
        """Generate forecast using ARIMA model"""
        if not STATSMODELS_AVAILABLE:
            raise ImportError("Statsmodels not available")
        
        ts = df['sales_smooth'].values
        
        # Check for stationarity
        def check_stationarity(timeseries):
            result = adfuller(timeseries)
            return result[1] <= 0.05  # p-value <= 0.05 means stationary
        
        # Difference the series if not stationary
        d = 0
        ts_diff = ts.copy()
        while not check_stationarity(ts_diff) and d < 2:
            ts_diff = np.diff(ts_diff)
            d += 1
        
        # Auto-select ARIMA parameters using AIC
        best_aic = float('inf')
        best_params = (1, d, 1)
        
        for p in range(0, 4):
            for q in range(0, 4):
                try:
                    model = ARIMA(ts, order=(p, d, q))
                    fitted_model = model.fit()
                    if fitted_model.aic < best_aic:
                        best_aic = fitted_model.aic
                        best_params = (p, d, q)
                except:
                    continue
        
        # Fit best model
        model = ARIMA(ts, order=best_params)
        fitted_model = model.fit()
        
        # Generate forecast
        forecast_result = fitted_model.forecast(steps=periods, alpha=0.05)
        forecast_values = forecast_result[0] if isinstance(forecast_result, tuple) else forecast_result
        
        # Get confidence intervals
        conf_int = fitted_model.get_forecast(steps=periods).conf_int()
        
        # Create forecast dates
        last_date = df['date'].max()
        forecast_dates = pd.date_range(start=last_date + timedelta(days=1), periods=periods, freq='D')
        
        # Calculate RMSE
        fitted_values = fitted_model.fittedvalues
        rmse = np.sqrt(mean_squared_error(ts[1:], fitted_values))  # Skip first value due to differencing
        
        forecast_data = []
        for i, date in enumerate(forecast_dates):
            forecast_data.append({
                'ds': date,
                'yhat': max(0, forecast_values[i]),  # Ensure non-negative
                'yhat_lower': max(0, conf_int.iloc[i, 0]),
                'yhat_upper': max(0, conf_int.iloc[i, 1])
            })
        
        return {
            'model_name': 'ARIMA',
            'forecast': forecast_data,
            'rmse': rmse,
            'model_object': fitted_model,
            'parameters': best_params,
            'aic': best_aic
        }
    
    def simple_moving_average_forecast(self, df: pd.DataFrame, periods: int = 30, window: int = 14) -> Dict:
        """Simple moving average forecast as baseline"""
        recent_avg = df['sales_smooth'].tail(window).mean()
        
        # Create forecast dates
        last_date = df['date'].max()
        forecast_dates = pd.date_range(start=last_date + timedelta(days=1), periods=periods, freq='D')
        
        # Simple forecast with slight trend adjustment
        trend = (df['sales_smooth'].tail(7).mean() - df['sales_smooth'].head(7).mean()) / len(df)
        
        forecast_data = []
        for i, date in enumerate(forecast_dates):
            predicted_value = max(0, recent_avg + trend * i)
            forecast_data.append({
                'ds': date,
                'yhat': predicted_value,
                'yhat_lower': predicted_value * 0.8,
                'yhat_upper': predicted_value * 1.2
            })
        
        # Calculate RMSE using naive forecast
        naive_forecast = [recent_avg] * (len(df) - window)
        actual = df['sales_smooth'].tail(len(df) - window).values
        rmse = np.sqrt(mean_squared_error(actual, naive_forecast))
        
        return {
            'model_name': 'Moving Average',
            'forecast': forecast_data,
            'rmse': rmse,
            'model_object': None,
            'recent_average': recent_avg
        }
    
    def compare_models_and_forecast(self, drug_name: str, periods: int = 30) -> Dict:
        """Compare multiple models and select the best one"""
        try:
            # Prepare data
            df = self.prepare_data(drug_name)
            
            if len(df) < 30:  # Need minimum data for reliable forecasting
                raise ValueError(f"Insufficient data for {drug_name}: only {len(df)} days available")
            
            models_to_try = []
            
            # Try Prophet
            if PROPHET_AVAILABLE:
                try:
                    prophet_result = self.prophet_forecast(df, periods)
                    models_to_try.append(prophet_result)
                except Exception as e:
                    print(f"⚠️  Prophet failed for {drug_name}: {str(e)}")
            
            # Try ARIMA
            if STATSMODELS_AVAILABLE:
                try:
                    arima_result = self.arima_forecast(df, periods)
                    models_to_try.append(arima_result)
                except Exception as e:
                    print(f"⚠️  ARIMA failed for {drug_name}: {str(e)}")
            
            # Always try moving average as baseline
            try:
                ma_result = self.simple_moving_average_forecast(df, periods)
                models_to_try.append(ma_result)
            except Exception as e:
                print(f"⚠️  Moving Average failed for {drug_name}: {str(e)}")
            
            if not models_to_try:
                raise ValueError("All forecasting models failed")
            
            # Select best model based on RMSE
            best_model = min(models_to_try, key=lambda x: x['rmse'])
            
            # Calculate stockout prediction
            stockout_analysis = self.predict_stockout(drug_name, best_model['forecast'])
            
            result = {
                'drug_name': drug_name,
                'best_model': best_model,
                'all_models': models_to_try,
                'stockout_analysis': stockout_analysis,
                'forecast_generated_at': datetime.now().isoformat()
            }
            
            # Store results
            self.models[drug_name] = result
            
            return result
            
        except Exception as e:
            print(f"❌ Forecasting failed for {drug_name}: {str(e)}")
            return {'error': str(e), 'drug_name': drug_name}
    
    def predict_stockout(self, drug_name: str, forecast_data: List[Dict]) -> Dict:
        """Predict when stockout will occur based on forecast"""
        # Get current stock
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT current_stock, lead_time_days FROM drugs WHERE drug_name = ?", 
                (drug_name,)
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Drug {drug_name} not found in database")
            
            current_stock, lead_time = row
        
        # Calculate cumulative demand
        cumulative_demand = 0
        stockout_date = None
        safety_stock = 7  # 7 days of safety stock
        
        for forecast_point in forecast_data:
            cumulative_demand += forecast_point['yhat']
            
            # Check if stock (minus safety stock) will be depleted
            if cumulative_demand >= (current_stock - safety_stock):
                stockout_date = forecast_point['ds']
                break
        
        # Calculate reorder point (when to reorder considering lead time)
        days_until_stockout = None
        reorder_date = None
        
        if stockout_date:
            if isinstance(stockout_date, str):
                stockout_date = datetime.fromisoformat(stockout_date.replace('Z', '+00:00'))
            
            days_until_stockout = (stockout_date - datetime.now()).days
            reorder_date = stockout_date - timedelta(days=lead_time)
            
            # If reorder date is in the past, reorder immediately
            if reorder_date < datetime.now():
                reorder_date = datetime.now()
        
        # Calculate recommended order quantity
        if forecast_data:
            avg_daily_demand = np.mean([fp['yhat'] for fp in forecast_data])
            recommended_order_qty = int(avg_daily_demand * (lead_time + safety_stock + 30))  # 30 days extra
        else:
            recommended_order_qty = 0
        
        return {
            'current_stock': current_stock,
            'stockout_date': stockout_date.isoformat() if stockout_date else None,
            'days_until_stockout': days_until_stockout,
            'reorder_date': reorder_date.isoformat() if reorder_date else None,
            'recommended_order_qty': recommended_order_qty,
            'lead_time_days': lead_time,
            'safety_stock_days': safety_stock,
            'risk_level': self.calculate_risk_level(days_until_stockout, lead_time)
        }
    
    def calculate_risk_level(self, days_until_stockout: Optional[int], lead_time: int) -> str:
        """Calculate risk level based on stockout timing"""
        if days_until_stockout is None:
            return "LOW"
        
        if days_until_stockout <= lead_time:
            return "CRITICAL"
        elif days_until_stockout <= lead_time * 2:
            return "HIGH"
        elif days_until_stockout <= 30:
            return "MEDIUM"
        else:
            return "LOW"
    
    def bulk_forecast(self, drug_names: List[str] = None, periods: int = 30) -> Dict[str, Dict]:
        """Generate forecasts for multiple drugs"""
        if drug_names is None:
            # Get all drugs from database
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT drug_name FROM drugs")
                drug_names = [row[0] for row in cursor.fetchall()]
        
        results = {}
        for drug_name in drug_names:
            print(f"🔄 Forecasting {drug_name}...")
            results[drug_name] = self.compare_models_and_forecast(drug_name, periods)
        
        return results
    
    def get_reorder_report(self) -> pd.DataFrame:
        """Generate comprehensive reorder report"""
        if not self.models:
            print("⚠️  No forecasts available. Run bulk_forecast() first.")
            return pd.DataFrame()
        
        reorder_data = []
        
        for drug_name, forecast_result in self.models.items():
            if 'error' in forecast_result:
                continue
                
            stockout_analysis = forecast_result['stockout_analysis']
            best_model = forecast_result['best_model']
            
            reorder_data.append({
                'drug_name': drug_name,
                'current_stock': stockout_analysis['current_stock'],
                'days_until_stockout': stockout_analysis['days_until_stockout'],
                'risk_level': stockout_analysis['risk_level'],
                'recommended_order_qty': stockout_analysis['recommended_order_qty'],
                'reorder_date': stockout_analysis['reorder_date'],
                'best_model': best_model['model_name'],
                'model_rmse': round(best_model['rmse'], 2)
            })
        
        df = pd.DataFrame(reorder_data)
        
        # Sort by risk level and days until stockout
        risk_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
        df['risk_sort'] = df['risk_level'].map(risk_order)
        df = df.sort_values(['risk_sort', 'days_until_stockout']).drop('risk_sort', axis=1)
        
        return df


if __name__ == "__main__":
    # Test the forecasting engine
    print("🔄 Testing RxForecaster Forecasting Engine...")
    
    engine = ForecastingEngine()
    
    # Test single drug forecast
    try:
        result = engine.compare_models_and_forecast("Paracetamol", periods=14)
        if 'error' not in result:
            print(f"✅ Forecast successful for Paracetamol")
            print(f"   Best Model: {result['best_model']['model_name']}")
            print(f"   RMSE: {result['best_model']['rmse']:.2f}")
            print(f"   Risk Level: {result['stockout_analysis']['risk_level']}")
        else:
            print(f"❌ Forecast failed: {result['error']}")
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
