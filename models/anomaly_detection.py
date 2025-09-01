"""
Anomaly Detection System for RxForecaster Supply Chain Management
Detects unusual demand patterns that could indicate pandemic-like events or supply disruptions
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import sqlite3
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False


class AnomalyDetector:
    """Advanced anomaly detection for drug demand patterns"""
    
    def __init__(self, db_path: str = "data/pharmacy.db"):
        self.db_path = db_path
        self.anomaly_thresholds = {
            'z_score': 2.5,        # Z-score threshold for outlier detection
            'prophet_width': 0.95,  # Prophet confidence interval width
            'seasonal_factor': 2.0, # Seasonal anomaly factor
            'trend_change': 0.3     # Significant trend change threshold
        }
    
    def get_historical_data(self, drug_name: str, days_back: int = 180) -> pd.DataFrame:
        """Get historical sales data for anomaly detection"""
        cutoff_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
        
        with sqlite3.connect(self.db_path) as conn:
            query = """
                SELECT date, SUM(sales_quantity) as sales, department
                FROM historical_sales
                WHERE drug_name = ? AND date >= ?
                GROUP BY date, department
                ORDER BY date
            """
            df = pd.read_sql_query(query, conn, params=(drug_name, cutoff_date))
        
        if len(df) == 0:
            raise ValueError(f"No historical data found for {drug_name}")
        
        df['date'] = pd.to_datetime(df['date'])
        
        # Aggregate by date if multiple departments
        df_agg = df.groupby('date')['sales'].sum().reset_index()
        df_agg = df_agg.set_index('date').asfreq('D', fill_value=0).reset_index()
        
        return df_agg
    
    def z_score_anomaly_detection(self, df: pd.DataFrame, window_size: int = 14) -> Dict:
        """Detect anomalies using rolling Z-score method"""
        # Calculate rolling statistics
        df['rolling_mean'] = df['sales'].rolling(window=window_size, center=True).mean()
        df['rolling_std'] = df['sales'].rolling(window=window_size, center=True).std()
        
        # Calculate Z-scores
        df['z_score'] = np.abs((df['sales'] - df['rolling_mean']) / df['rolling_std'])
        
        # Identify anomalies
        threshold = self.anomaly_thresholds['z_score']
        df['is_anomaly'] = df['z_score'] > threshold
        
        # Find anomaly periods (consecutive anomalous days)
        anomaly_periods = []
        in_anomaly = False
        start_date = None
        
        for idx, row in df.iterrows():
            if row['is_anomaly'] and not in_anomaly:
                in_anomaly = True
                start_date = row['date']
            elif not row['is_anomaly'] and in_anomaly:
                in_anomaly = False
                anomaly_periods.append({
                    'start_date': start_date,
                    'end_date': df.iloc[idx-1]['date'],
                    'max_z_score': df[(df['date'] >= start_date) & 
                                     (df['date'] <= df.iloc[idx-1]['date'])]['z_score'].max(),
                    'type': 'z_score_spike'
                })
        
        # Handle case where anomaly continues to end of data
        if in_anomaly:
            anomaly_periods.append({
                'start_date': start_date,
                'end_date': df.iloc[-1]['date'],
                'max_z_score': df[df['date'] >= start_date]['z_score'].max(),
                'type': 'z_score_spike'
            })
        
        return {
            'method': 'z_score',
            'anomalies_detected': len(anomaly_periods),
            'anomaly_periods': anomaly_periods,
            'anomaly_dates': df[df['is_anomaly']]['date'].tolist(),
            'max_z_score': df['z_score'].max(),
            'mean_z_score': df['z_score'].mean(),
            'data_with_scores': df
        }
    
    def prophet_anomaly_detection(self, df: pd.DataFrame) -> Dict:
        """Detect anomalies using Prophet's built-in anomaly detection"""
        if not PROPHET_AVAILABLE:
            return {'error': 'Prophet not available'}
        
        try:
            # Prepare data for Prophet
            prophet_df = df[['date', 'sales']].rename(columns={'date': 'ds', 'sales': 'y'})
            
            # Fit Prophet model
            model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
                changepoint_prior_scale=0.05,
                uncertainty_samples=1000
            )
            
            model.fit(prophet_df)
            
            # Make predictions
            forecast = model.predict(prophet_df)
            
            # Calculate anomalies based on confidence intervals
            width = self.anomaly_thresholds['prophet_width']
            
            # Anomalies are points outside the confidence interval
            anomalies = []
            for i, row in prophet_df.iterrows():
                actual = row['y']
                predicted = forecast.iloc[i]['yhat']
                lower = forecast.iloc[i]['yhat_lower']
                upper = forecast.iloc[i]['yhat_upper']
                
                if actual < lower or actual > upper:
                    severity = max(
                        abs(actual - upper) / upper if actual > upper else 0,
                        abs(lower - actual) / lower if actual < lower else 0
                    )
                    
                    anomalies.append({
                        'date': row['ds'],
                        'actual': actual,
                        'predicted': predicted,
                        'lower_bound': lower,
                        'upper_bound': upper,
                        'severity': severity,
                        'type': 'spike' if actual > upper else 'drop'
                    })
            
            # Detect changepoints (sudden trend changes)
            changepoints = []
            if len(model.changepoints) > 0:
                for cp in model.changepoints:
                    changepoints.append({
                        'date': cp,
                        'type': 'trend_change'
                    })
            
            return {
                'method': 'prophet',
                'anomalies_detected': len(anomalies),
                'anomalies': anomalies,
                'changepoints': changepoints,
                'model_performance': {
                    'mape': np.mean(np.abs((prophet_df['y'] - forecast['yhat']) / prophet_df['y'])) * 100
                }
            }
            
        except Exception as e:
            return {'error': f'Prophet anomaly detection failed: {str(e)}'}
    
    def seasonal_anomaly_detection(self, df: pd.DataFrame) -> Dict:
        """Detect seasonal anomalies by comparing to historical patterns"""
        df['day_of_week'] = df['date'].dt.dayofweek
        df['week_of_year'] = df['date'].dt.isocalendar().week
        df['month'] = df['date'].dt.month
        
        # Calculate seasonal baselines
        seasonal_patterns = {
            'weekly': df.groupby('day_of_week')['sales'].agg(['mean', 'std']),
            'monthly': df.groupby('month')['sales'].agg(['mean', 'std'])
        }
        
        # Detect seasonal anomalies
        seasonal_anomalies = []
        
        for idx, row in df.iterrows():
            # Check weekly pattern
            dow_mean = seasonal_patterns['weekly'].loc[row['day_of_week'], 'mean']
            dow_std = seasonal_patterns['weekly'].loc[row['day_of_week'], 'std']
            
            if dow_std > 0:
                weekly_z = abs(row['sales'] - dow_mean) / dow_std
                if weekly_z > self.anomaly_thresholds['seasonal_factor']:
                    seasonal_anomalies.append({
                        'date': row['date'],
                        'type': 'weekly_seasonal',
                        'z_score': weekly_z,
                        'expected': dow_mean,
                        'actual': row['sales']
                    })
            
            # Check monthly pattern
            month_mean = seasonal_patterns['monthly'].loc[row['month'], 'mean']
            month_std = seasonal_patterns['monthly'].loc[row['month'], 'std']
            
            if month_std > 0:
                monthly_z = abs(row['sales'] - month_mean) / month_std
                if monthly_z > self.anomaly_thresholds['seasonal_factor']:
                    seasonal_anomalies.append({
                        'date': row['date'],
                        'type': 'monthly_seasonal',
                        'z_score': monthly_z,
                        'expected': month_mean,
                        'actual': row['sales']
                    })
        
        return {
            'method': 'seasonal',
            'anomalies_detected': len(seasonal_anomalies),
            'anomalies': seasonal_anomalies,
            'seasonal_patterns': seasonal_patterns
        }
    
    def detect_demand_spikes(self, df: pd.DataFrame, spike_factor: float = 3.0) -> Dict:
        """Detect sudden demand spikes that could indicate emergencies"""
        # Calculate percentage changes
        df['pct_change'] = df['sales'].pct_change()
        df['abs_change'] = df['sales'].diff()
        
        # Calculate rolling baseline
        df['baseline'] = df['sales'].rolling(window=7, center=True).median()
        
        # Detect spikes
        spikes = []
        for idx, row in df.iterrows():
            if pd.isna(row['baseline']) or row['baseline'] == 0:
                continue
                
            spike_ratio = row['sales'] / row['baseline']
            
            if spike_ratio >= spike_factor:
                spikes.append({
                    'date': row['date'],
                    'sales': row['sales'],
                    'baseline': row['baseline'],
                    'spike_ratio': spike_ratio,
                    'severity': 'high' if spike_ratio >= spike_factor * 1.5 else 'medium'
                })
        
        # Identify sustained spikes (multiple consecutive days)
        sustained_spikes = []
        if spikes:
            current_spike = [spikes[0]]
            
            for i in range(1, len(spikes)):
                # Check if spike is within 3 days of previous
                if (spikes[i]['date'] - current_spike[-1]['date']).days <= 3:
                    current_spike.append(spikes[i])
                else:
                    if len(current_spike) >= 2:  # Sustained if 2+ days
                        sustained_spikes.append({
                            'start_date': current_spike[0]['date'],
                            'end_date': current_spike[-1]['date'],
                            'duration_days': len(current_spike),
                            'max_spike_ratio': max(s['spike_ratio'] for s in current_spike),
                            'avg_spike_ratio': np.mean([s['spike_ratio'] for s in current_spike])
                        })
                    current_spike = [spikes[i]]
            
            # Handle last spike group
            if len(current_spike) >= 2:
                sustained_spikes.append({
                    'start_date': current_spike[0]['date'],
                    'end_date': current_spike[-1]['date'],
                    'duration_days': len(current_spike),
                    'max_spike_ratio': max(s['spike_ratio'] for s in current_spike),
                    'avg_spike_ratio': np.mean([s['spike_ratio'] for s in current_spike])
                })
        
        return {
            'method': 'demand_spike',
            'single_spikes': spikes,
            'sustained_spikes': sustained_spikes,
            'total_spike_days': len(spikes)
        }
    
    def comprehensive_anomaly_analysis(self, drug_name: str, days_back: int = 180) -> Dict:
        """Run comprehensive anomaly analysis using multiple methods"""
        try:
            # Get historical data
            df = self.get_historical_data(drug_name, days_back)
            
            if len(df) < 30:
                return {'error': f'Insufficient data for {drug_name}: only {len(df)} days'}
            
            # Run all anomaly detection methods
            results = {
                'drug_name': drug_name,
                'analysis_period': {
                    'start_date': df['date'].min(),
                    'end_date': df['date'].max(),
                    'days_analyzed': len(df)
                },
                'methods': {}
            }
            
            # Z-score based anomaly detection
            try:
                results['methods']['z_score'] = self.z_score_anomaly_detection(df.copy())
            except Exception as e:
                results['methods']['z_score'] = {'error': str(e)}
            
            # Prophet based anomaly detection
            if PROPHET_AVAILABLE:
                try:
                    results['methods']['prophet'] = self.prophet_anomaly_detection(df.copy())
                except Exception as e:
                    results['methods']['prophet'] = {'error': str(e)}
            
            # Seasonal anomaly detection
            try:
                results['methods']['seasonal'] = self.seasonal_anomaly_detection(df.copy())
            except Exception as e:
                results['methods']['seasonal'] = {'error': str(e)}
            
            # Demand spike detection
            try:
                results['methods']['demand_spikes'] = self.detect_demand_spikes(df.copy())
            except Exception as e:
                results['methods']['demand_spikes'] = {'error': str(e)}
            
            # Generate overall anomaly summary
            results['summary'] = self.generate_anomaly_summary(results['methods'])
            
            # Save to database
            self.save_anomaly_results(drug_name, results)
            
            return results
            
        except Exception as e:
            return {'error': str(e), 'drug_name': drug_name}
    
    def generate_anomaly_summary(self, methods_results: Dict) -> Dict:
        """Generate overall anomaly summary from all methods"""
        total_anomalies = 0
        risk_factors = []
        recommendations = []
        
        # Aggregate results from all methods
        for method_name, method_result in methods_results.items():
            if 'error' in method_result:
                continue
                
            if method_name == 'z_score':
                anomaly_count = method_result.get('anomalies_detected', 0)
                total_anomalies += anomaly_count
                if anomaly_count > 5:
                    risk_factors.append(f"High frequency of statistical outliers ({anomaly_count})")
                    recommendations.append("Investigate underlying causes of demand variability")
            
            elif method_name == 'prophet':
                anomaly_count = method_result.get('anomalies_detected', 0)
                total_anomalies += anomaly_count
                changepoints = len(method_result.get('changepoints', []))
                if changepoints > 3:
                    risk_factors.append(f"Multiple trend changes detected ({changepoints})")
                    recommendations.append("Review demand patterns for structural changes")
            
            elif method_name == 'seasonal':
                anomaly_count = method_result.get('anomalies_detected', 0)
                if anomaly_count > 10:
                    risk_factors.append("Significant deviations from seasonal patterns")
                    recommendations.append("Adjust seasonal inventory planning")
            
            elif method_name == 'demand_spikes':
                sustained_spikes = len(method_result.get('sustained_spikes', []))
                if sustained_spikes > 0:
                    risk_factors.append(f"Sustained demand spikes detected ({sustained_spikes})")
                    recommendations.append("Prepare for potential emergency demand scenarios")
        
        # Determine overall risk level
        if total_anomalies > 20:
            risk_level = "HIGH"
        elif total_anomalies > 10:
            risk_level = "MEDIUM"
        elif total_anomalies > 5:
            risk_level = "LOW"
        else:
            risk_level = "MINIMAL"
        
        return {
            'total_anomalies_detected': total_anomalies,
            'risk_level': risk_level,
            'risk_factors': risk_factors,
            'recommendations': recommendations,
            'analysis_confidence': 'HIGH' if len([r for r in methods_results.values() if 'error' not in r]) >= 3 else 'MEDIUM'
        }
    
    def save_anomaly_results(self, drug_name: str, results: Dict):
        """Save anomaly detection results to database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Save summary to anomalies table
                summary = results.get('summary', {})
                conn.execute("""
                    INSERT INTO anomalies 
                    (drug_name, detection_date, anomaly_type, severity, description)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    drug_name,
                    datetime.now().strftime('%Y-%m-%d'),
                    'comprehensive_analysis',
                    summary.get('total_anomalies_detected', 0),
                    f"Risk Level: {summary.get('risk_level', 'UNKNOWN')}"
                ))
                conn.commit()
        except Exception as e:
            print(f"⚠️  Failed to save anomaly results: {str(e)}")
    
    def bulk_anomaly_detection(self, drug_names: List[str] = None) -> Dict[str, Dict]:
        """Run anomaly detection for multiple drugs"""
        if drug_names is None:
            # Get all drugs from database
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT drug_name FROM drugs")
                drug_names = [row[0] for row in cursor.fetchall()]
        
        results = {}
        for drug_name in drug_names:
            print(f"🔍 Analyzing anomalies for {drug_name}...")
            results[drug_name] = self.comprehensive_anomaly_analysis(drug_name)
        
        return results
    
    def get_high_risk_drugs(self) -> pd.DataFrame:
        """Get drugs with high anomaly risk"""
        with sqlite3.connect(self.db_path) as conn:
            query = """
                SELECT drug_name, MAX(severity) as max_severity, 
                       COUNT(*) as anomaly_count,
                       MAX(description) as latest_description
                FROM anomalies 
                WHERE detection_date >= date('now', '-30 days')
                GROUP BY drug_name
                HAVING max_severity > 10
                ORDER BY max_severity DESC
            """
            return pd.read_sql_query(query, conn)


if __name__ == "__main__":
    # Test the anomaly detection system
    print("🔍 Testing RxForecaster Anomaly Detection System...")
    
    detector = AnomalyDetector()
    
    # Test single drug analysis
    try:
        result = detector.comprehensive_anomaly_analysis("Morphine")
        if 'error' not in result:
            print(f"✅ Anomaly analysis successful for Morphine")
            print(f"   Risk Level: {result['summary']['risk_level']}")
            print(f"   Total Anomalies: {result['summary']['total_anomalies_detected']}")
        else:
            print(f"❌ Analysis failed: {result['error']}")
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
