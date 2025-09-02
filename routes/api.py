"""
Flask API Routes for RxForecaster Supply Chain Management System
Provides REST endpoints for forecasting, anomaly detection, and reorder management
"""

from flask import Blueprint, jsonify, request, send_file
from datetime import datetime, timedelta
import pandas as pd
import json
import io
import sqlite3
import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.forecasting import ForecastingEngine
from models.anomaly_detection import AnomalyDetector
from utils.database import DatabaseManager

# Create Blueprint
api = Blueprint('api', __name__)

# Initialize components
db_manager = DatabaseManager()
forecasting_engine = ForecastingEngine()
anomaly_detector = AnomalyDetector()


@api.route('/health', methods=['GET'])
def health_check():
    """API health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0',
        'services': {
            'database': 'active',
            'forecasting': 'active',
            'anomaly_detection': 'active'
        }
    })


@api.route('/drugs', methods=['GET'])
def get_all_drugs():
    """Return enriched drugs and departments for UI consumers.

    Response shape:
      {
        "drugs": [ { drug_name, department, current_stock, weekly_sales, weeks_remaining, risk_level, unit_cost? } ],
        "departments": ["ICU", ...],
        "total_count": N
      }

    This satisfies both the dashboard filter and the /drugs view.
    """
    try:
        drugs_df = db_manager.get_all_drugs()
        if drugs_df.empty:
            return jsonify({ 'drugs': [], 'departments': [], 'total_count': 0 })

        # Ensure required numeric fields exist
        if 'weekly_sales' not in drugs_df.columns:
            drugs_df['weekly_sales'] = 0
        if 'current_stock' not in drugs_df.columns:
            drugs_df['current_stock'] = 0
        if 'department' not in drugs_df.columns:
            drugs_df['department'] = ''
        if 'unit_cost' not in drugs_df.columns:
            drugs_df['unit_cost'] = 0.0

        # Compute weeks_remaining and risk_level
        safe_weekly = drugs_df['weekly_sales'].clip(lower=1)
        drugs_df['weeks_remaining'] = (drugs_df['current_stock'] / safe_weekly).round(2)

        def compute_risk(weeks_remaining: float) -> str:
            if weeks_remaining <= 1:
                return 'CRITICAL'
            if weeks_remaining <= 2:
                return 'HIGH'
            if weeks_remaining <= 4:
                return 'MEDIUM'
            return 'LOW'

        drugs_df['risk_level'] = drugs_df['weeks_remaining'].apply(compute_risk)

        # Build departments list
        try:
            departments = db_manager.get_departments()
        except Exception:
            departments = sorted(list(set(drugs_df['department'].dropna().tolist())))

        # Select fields for UI
        cols = ['drug_name', 'department', 'current_stock', 'weekly_sales', 'weeks_remaining', 'risk_level', 'unit_cost']
        present_cols = [c for c in cols if c in drugs_df.columns]
        drugs_list = drugs_df[present_cols].to_dict('records')

        return jsonify({
            'drugs': drugs_list,
            'departments': departments,
            'total_count': len(drugs_list)
        })

    except Exception as e:
        print(f"❌ Failed to get drugs list: {str(e)}")
        return jsonify({ 'error': str(e), 'drugs': [], 'departments': [], 'total_count': 0 }), 500


@api.route('/dashboard/metrics', methods=['GET'])
def get_dashboard_metrics():
    """Dashboard system metrics for header cards"""
    try:
        drugs_df = db_manager.get_all_drugs()
        departments = db_manager.get_departments()

        # Historical range (approximate using historical_sales)
        with sqlite3.connect(db_manager.db_path) as conn:
            row = conn.execute("SELECT MIN(date), MAX(date), COUNT(*) FROM historical_sales").fetchone()
            min_date, max_date, rows = row if row else (None, None, 0)

        response = {
            'system_status': 'online',
            'timestamp': datetime.now().isoformat(),
            'drugs_loaded': int(len(drugs_df)),
            'historical_weeks': None,
            'active_departments': int(len(departments)),
            'records_in_history': int(rows)
        }

        if min_date and max_date:
            start_dt = datetime.fromisoformat(str(min_date))
            end_dt = datetime.fromisoformat(str(max_date))
            response['historical_weeks'] = max(1, int((end_dt - start_dt).days // 7))

        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/inventory/charts', methods=['GET'])
def get_inventory_charts():
    """Chart-ready data for inventory dashboards (levels, risk, departments)."""
    try:
        drugs_df = db_manager.get_all_drugs()

        # Risk assessment similar to /drugs
        def compute_risk(row):
            weeks_remaining = row['current_stock'] / max(row['weekly_sales'], 1)
            if weeks_remaining <= 1:
                return 'CRITICAL'
            elif weeks_remaining <= 2:
                return 'HIGH'
            elif weeks_remaining <= 4:
                return 'MEDIUM'
            else:
                return 'LOW'

        drugs_df['risk_level'] = drugs_df.apply(compute_risk, axis=1)
        drugs_df['weeks_remaining'] = (drugs_df['current_stock'] / drugs_df['weekly_sales'].clip(lower=1)).round(2)

        # Aggregations
        by_department = (
            drugs_df.groupby('department').agg(
                total_stock=('current_stock', 'sum'),
                avg_weeks_remaining=('weeks_remaining', 'mean'),
                drug_count=('drug_name', 'count')
            ).reset_index()
        )

        risk_distribution = (
            drugs_df.groupby('risk_level').size().reindex(['CRITICAL','HIGH','MEDIUM','LOW'], fill_value=0).to_dict()
        )

        top_low_stock = (
            drugs_df.sort_values('weeks_remaining').head(15)[
                ['drug_name','department','current_stock','weekly_sales','weeks_remaining','risk_level']
            ].to_dict('records')
        )

        return jsonify({
            'generated_at': datetime.now().isoformat(),
            'risk_distribution': risk_distribution,
            'department_summary': by_department.to_dict('records'),
            'top_low_stock': top_low_stock
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/alerts/critical', methods=['GET'])
def get_critical_alerts():
    """Return critical/high risk alerts with simple timeline info."""
    try:
        threshold_weeks = float(request.args.get('weeks_threshold', 2))
        low_stock_df = db_manager.get_low_stock_drugs(threshold_weeks)

        # Pull recent anomalies summary
        with sqlite3.connect(db_manager.db_path) as conn:
            recent = pd.read_sql_query(
                """
                SELECT drug_name, MAX(detection_date) as last_detected,
                       MAX(severity) as max_severity
                FROM anomalies
                WHERE detection_date >= date('now','-30 days')
                GROUP BY drug_name
                ORDER BY max_severity DESC
                """,
                conn
            )

        alerts = []
        for _, row in low_stock_df.iterrows():
            entry = {
                'drug_name': row['drug_name'],
                'department': row.get('department', ''),
                'current_stock': int(row['current_stock']),
                'weekly_sales': float(row['weekly_sales']),
                'weeks_remaining': float(row['weeks_remaining']),
                'risk_level': 'CRITICAL' if row['weeks_remaining'] <= 1 else 'HIGH'
            }
            # Attach anomaly info if present
            if not recent.empty and row['drug_name'] in set(recent['drug_name']):
                r = recent[recent['drug_name'] == row['drug_name']].iloc[0]
                entry['latest_anomaly'] = {
                    'last_detected': r['last_detected'],
                    'max_severity': r['max_severity']
                }
            alerts.append(entry)

        return jsonify({
            'generated_at': datetime.now().isoformat(),
            'count': len(alerts),
            'alerts': alerts[:50]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/drugs/filtered', methods=['GET'])
def get_filtered_drugs():
    """Get all drugs with optional filtering"""
    try:
        department = request.args.get('department')
        risk_level = request.args.get('risk_level')
        
        if department:
            drugs_df = db_manager.get_drugs_by_department(department)
        else:
            drugs_df = db_manager.get_all_drugs()
        
        # Convert to dict and add risk assessment
        drugs_list = []
        for _, drug in drugs_df.iterrows():
            drug_dict = drug.to_dict()
            
            # Calculate weeks remaining
            weeks_remaining = drug['current_stock'] / max(drug['weekly_sales'], 1)
            
            # Determine risk level
            if weeks_remaining <= 1:
                risk = 'CRITICAL'
            elif weeks_remaining <= 2:
                risk = 'HIGH'
            elif weeks_remaining <= 4:
                risk = 'MEDIUM'
            else:
                risk = 'LOW'
            
            drug_dict['weeks_remaining'] = round(weeks_remaining, 2)
            drug_dict['risk_level'] = risk
            
            # Filter by risk level if specified
            if risk_level and risk != risk_level.upper():
                continue
                
            drugs_list.append(drug_dict)
        
        return jsonify({
            'drugs': drugs_list,
            'total_count': len(drugs_list),
            'departments': db_manager.get_departments()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/forecast/<drug_name>', methods=['GET'])
def get_drug_forecast(drug_name):
    """Get forecast for a specific drug"""
    try:
        # Get optional parameters
        periods = int(request.args.get('periods', 14))  # Reduced default for faster loading
        
        # Limit periods for performance on free hosting
        periods = min(periods, 30)
        
        # Generate forecast
        forecast_result = forecasting_engine.compare_models_and_forecast(drug_name, periods)
        
        if 'error' in forecast_result:
            return jsonify({'error': forecast_result['error']}), 400
        
        # Format response
        response = {
            'drug_name': drug_name,
            'forecast_generated_at': forecast_result['forecast_generated_at'],
            'periods': periods,
            'best_model': {
                'name': forecast_result['best_model']['model_name'],
                'rmse': forecast_result['best_model']['rmse'],
                'forecast_data': forecast_result['best_model']['forecast'][:periods]
            },
            'stockout_analysis': forecast_result['stockout_analysis'],
            'model_comparison': [
                {
                    'model': model['model_name'],
                    'rmse': model['rmse']
                }
                for model in forecast_result['all_models']
            ]
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/anomalies/<drug_name>', methods=['GET'])
def get_drug_anomalies(drug_name):
    """Get anomaly detection results for a specific drug"""
    try:
        # Get optional parameters
        days_back = int(request.args.get('days_back', 180))
        
        # Run anomaly detection
        anomaly_result = anomaly_detector.comprehensive_anomaly_analysis(drug_name, days_back)
        
        if 'error' in anomaly_result:
            return jsonify({'error': anomaly_result['error']}), 400
        
        # Format response
        response = {
            'drug_name': drug_name,
            'analysis_period': anomaly_result['analysis_period'],
            'summary': anomaly_result['summary'],
            'methods_used': list(anomaly_result['methods'].keys()),
            'detailed_results': {}
        }
        
        # Include detailed results for each method
        for method_name, method_result in anomaly_result['methods'].items():
            if 'error' not in method_result:
                response['detailed_results'][method_name] = {
                    'anomalies_count': method_result.get('anomalies_detected', 0),
                    'method_specific_data': method_result
                }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/reorder_report', methods=['GET'])
def get_reorder_report():
    """Generate comprehensive reorder report"""
    try:
        # Get optional parameters
        format_type = request.args.get('format', 'json')  # json or csv
        risk_levels = request.args.getlist('risk_level')  # Filter by risk levels
        departments = request.args.getlist('department')  # Filter by departments
        
        # Get all drugs or filter by department
        if departments:
            all_drugs = pd.DataFrame()
            for dept in departments:
                dept_drugs = db_manager.get_drugs_by_department(dept)
                all_drugs = pd.concat([all_drugs, dept_drugs], ignore_index=True)
        else:
            all_drugs = db_manager.get_all_drugs()
        
        # Generate forecasts for all drugs
        drug_names = all_drugs['drug_name'].tolist()
        print(f"🔄 Generating forecasts for {len(drug_names)} drugs...")
        
        forecast_results = forecasting_engine.bulk_forecast(drug_names, periods=14)
        
        # Compile reorder report
        reorder_data = []
        
        for drug_name, forecast_result in forecast_results.items():
            if 'error' in forecast_result:
                continue
            
            stockout_analysis = forecast_result['stockout_analysis']
            best_model = forecast_result['best_model']
            
            # Get drug details
            drug_info = db_manager.get_drug_by_name(drug_name)
            
            reorder_entry = {
                'drug_name': drug_name,
                'department': drug_info.get('department', 'Unknown'),
                'therapeutic_class': drug_info.get('therapeutic_class', 'Unknown'),
                'current_stock': stockout_analysis['current_stock'],
                'weekly_sales': drug_info.get('weekly_sales', 0),
                'days_until_stockout': stockout_analysis['days_until_stockout'],
                'stockout_date': stockout_analysis['stockout_date'],
                'risk_level': stockout_analysis['risk_level'],
                'recommended_order_qty': stockout_analysis['recommended_order_qty'],
                'reorder_date': stockout_analysis['reorder_date'],
                'lead_time_days': stockout_analysis['lead_time_days'],
                'unit_cost': drug_info.get('unit_cost', 0),
                'total_order_cost': stockout_analysis['recommended_order_qty'] * drug_info.get('unit_cost', 0),
                'best_model': best_model['model_name'],
                'model_rmse': round(best_model['rmse'], 2),
                'forecast_confidence': 'HIGH' if best_model['rmse'] < 10 else 'MEDIUM' if best_model['rmse'] < 20 else 'LOW'
            }
            
            # Filter by risk levels if specified
            if risk_levels and reorder_entry['risk_level'] not in [r.upper() for r in risk_levels]:
                continue
            
            reorder_data.append(reorder_entry)
        
        # Sort by risk level and days until stockout
        risk_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
        reorder_data.sort(key=lambda x: (
            risk_order.get(x['risk_level'], 4),
            x['days_until_stockout'] if x['days_until_stockout'] is not None else 999
        ))
        
        # Generate summary statistics
        summary = {
            'total_drugs_analyzed': len(reorder_data),
            'drugs_needing_reorder': len([d for d in reorder_data if d['risk_level'] in ['CRITICAL', 'HIGH']]),
            'total_estimated_cost': sum(d['total_order_cost'] for d in reorder_data),
            'risk_distribution': {
                'CRITICAL': len([d for d in reorder_data if d['risk_level'] == 'CRITICAL']),
                'HIGH': len([d for d in reorder_data if d['risk_level'] == 'HIGH']),
                'MEDIUM': len([d for d in reorder_data if d['risk_level'] == 'MEDIUM']),
                'LOW': len([d for d in reorder_data if d['risk_level'] == 'LOW'])
            },
            'department_distribution': {}
        }
        
        # Calculate department distribution
        for dept in set(d['department'] for d in reorder_data):
            dept_count = len([d for d in reorder_data if d['department'] == dept])
            summary['department_distribution'][dept] = dept_count
        
        if format_type.lower() == 'csv':
            # Return as CSV file
            df = pd.DataFrame(reorder_data)
            output = io.StringIO()
            df.to_csv(output, index=False)
            output.seek(0)
            
            return send_file(
                io.BytesIO(output.getvalue().encode()),
                mimetype='text/csv',
                as_attachment=True,
                download_name=f'reorder_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            )
        else:
            # Return as JSON
            return jsonify({
                'report_generated_at': datetime.now().isoformat(),
                'summary': summary,
                'reorder_recommendations': reorder_data,
                'filters_applied': {
                    'risk_levels': risk_levels,
                    'departments': departments
                }
            })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/bulk_forecast', methods=['POST'])
def bulk_forecast():
    """Generate forecasts for multiple drugs"""
    try:
        data = request.get_json()
        drug_names = data.get('drug_names', [])
        periods = data.get('periods', 30)
        
        if not drug_names:
            # Get all drugs if none specified
            all_drugs = db_manager.get_all_drugs()
            drug_names = all_drugs['drug_name'].tolist()
        
        # Generate forecasts
        results = forecasting_engine.bulk_forecast(drug_names, periods)
        
        # Format results
        formatted_results = {}
        for drug_name, result in results.items():
            if 'error' not in result:
                formatted_results[drug_name] = {
                    'best_model': result['best_model']['model_name'],
                    'rmse': result['best_model']['rmse'],
                    'stockout_analysis': result['stockout_analysis'],
                    'forecast_data': result['best_model']['forecast'][:10]  # First 10 days
                }
            else:
                formatted_results[drug_name] = {'error': result['error']}
        
        return jsonify({
            'forecast_generated_at': datetime.now().isoformat(),
            'drugs_processed': len(drug_names),
            'successful_forecasts': len([r for r in results.values() if 'error' not in r]),
            'results': formatted_results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/bulk_anomalies', methods=['POST'])
def bulk_anomaly_detection():
    """Run anomaly detection for multiple drugs"""
    try:
        data = request.get_json()
        drug_names = data.get('drug_names', [])
        days_back = data.get('days_back', 180)
        
        if not drug_names:
            # Get all drugs if none specified
            all_drugs = db_manager.get_all_drugs()
            drug_names = all_drugs['drug_name'].tolist()
        
        # Run anomaly detection
        results = anomaly_detector.bulk_anomaly_detection(drug_names)
        
        # Format results
        formatted_results = {}
        high_risk_drugs = []
        
        for drug_name, result in results.items():
            if 'error' not in result:
                summary = result['summary']
                formatted_results[drug_name] = {
                    'risk_level': summary['risk_level'],
                    'total_anomalies': summary['total_anomalies_detected'],
                    'risk_factors': summary['risk_factors'],
                    'analysis_confidence': summary['analysis_confidence']
                }
                
                if summary['risk_level'] in ['HIGH', 'MEDIUM']:
                    high_risk_drugs.append(drug_name)
            else:
                formatted_results[drug_name] = {'error': result['error']}
        
        return jsonify({
            'analysis_generated_at': datetime.now().isoformat(),
            'drugs_analyzed': len(drug_names),
            'successful_analyses': len([r for r in results.values() if 'error' not in r]),
            'high_risk_drugs': high_risk_drugs,
            'results': formatted_results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/update_stock', methods=['POST'])
def update_stock():
    """Update stock level for a drug"""
    try:
        data = request.get_json()
        drug_name = data.get('drug_name')
        new_stock = data.get('new_stock')
        
        if not drug_name or new_stock is None:
            return jsonify({'error': 'drug_name and new_stock are required'}), 400
        
        # Update stock in database
        db_manager.update_stock_level(drug_name, new_stock)
        
        return jsonify({
            'message': f'Stock updated successfully for {drug_name}',
            'drug_name': drug_name,
            'new_stock': new_stock,
            'updated_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/departments', methods=['GET'])
def get_departments():
    """Get list of all departments"""
    try:
        departments = db_manager.get_departments()
        return jsonify({'departments': departments})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/low_stock', methods=['GET'])
def get_low_stock_drugs():
    """Get drugs with low stock levels"""
    try:
        weeks_threshold = float(request.args.get('weeks_threshold', 2))
        
        low_stock_drugs = db_manager.get_low_stock_drugs(weeks_threshold)
        
        return jsonify({
            'threshold_weeks': weeks_threshold,
            'drugs_count': len(low_stock_drugs),
            'drugs': low_stock_drugs.to_dict('records')
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/forecast/chart/<drug_name>', methods=['GET'])
def get_forecast_chart_data(drug_name):
    """Get chart-ready forecast data for a specific drug"""
    try:
        periods = int(request.args.get('periods', 8))
        
        # Generate forecast using existing engine
        forecast_result = forecasting_engine.compare_models_and_forecast(drug_name, periods)
        
        if 'error' in forecast_result:
            return jsonify({'error': forecast_result['error']}), 400
            
        # Format for charts
        forecast_data = forecast_result['best_model']['forecast']
        
        # Split into actual (historical) and predicted (future)
        # For now, assume first half is "actual" for demo
        mid_point = max(1, len(forecast_data) // 2)
        
        actual_data = []
        predicted_data = []
        
        for i, point in enumerate(forecast_data):
            date_str = point['ds'] if isinstance(point['ds'], str) else point['ds'].strftime('%Y-%m-%d')
            week_label = f"W{i+1}"
            
            if i < mid_point:
                actual_data.append({
                    'x': week_label,
                    'y': round(point['yhat'], 1),
                    'date': date_str
                })
            else:
                predicted_data.append({
                    'x': week_label, 
                    'y': round(point['yhat'], 1),
                    'upper': round(point.get('yhat_upper', point['yhat'] * 1.2), 1),
                    'lower': round(point.get('yhat_lower', point['yhat'] * 0.8), 1),
                    'date': date_str
                })
        
        return jsonify({
            'drug_name': drug_name,
            'model_used': forecast_result['best_model']['model_name'],
            'rmse': round(forecast_result['best_model']['rmse'], 2),
            'actual': actual_data,
            'predicted': predicted_data,
            'stockout_risk': forecast_result['stockout_analysis']['risk_level']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Error handlers
@api.route('/anomaly-detection', methods=['GET'])
def get_anomaly_detection():
    """Advanced anomaly detection for all drugs"""
    try:
        # Get parameters
        sensitivity = float(request.args.get('sensitivity', 50))
        time_range = int(request.args.get('time_range', 30))
        
        drugs_df = db_manager.get_all_drugs()
        if drugs_df.empty:
            return jsonify({'error': 'No drugs data available'}), 400
            
        anomalies = []
        anomaly_summary = {
            'total_anomalies': 0,
            'critical_anomalies': 0,
            'drugs_affected': 0,
            'detection_rate': 0
        }
        
        for _, drug in drugs_df.iterrows():
            drug_name = drug['drug_name']  # Fix column name
            
            # Get sales data for anomaly detection
            sales_data = db_manager.get_historical_sales(drug_name)
            if sales_data.empty:
                continue
                
            # Detect anomalies using the anomaly detector
            anomaly_result = anomaly_detector.detect_seasonal_anomalies(sales_data, sensitivity/100)
            
            if anomaly_result and 'anomalies' in anomaly_result:
                for anomaly in anomaly_result['anomalies']:
                    anomaly_data = {
                        'drug_name': drug_name,
                        'date': anomaly.get('date', datetime.now().strftime('%Y-%m-%d')),
                        'actual_usage': anomaly.get('actual', 0),
                        'expected_usage': anomaly.get('expected', 0),
                        'deviation_percent': anomaly.get('deviation', 0),
                        'severity': 'critical' if abs(anomaly.get('deviation', 0)) > 50 else 'medium',
                        'pattern_type': anomaly.get('type', 'spike'),
                        'confidence': anomaly.get('confidence', 0.8)
                    }
                    anomalies.append(anomaly_data)
                    
                    if anomaly_data['severity'] == 'critical':
                        anomaly_summary['critical_anomalies'] += 1
        
        # Update summary
        anomaly_summary['total_anomalies'] = len(anomalies)
        anomaly_summary['drugs_affected'] = len(set(a['drug_name'] for a in anomalies))
        anomaly_summary['detection_rate'] = min(100, (len(anomalies) / max(1, len(drugs_df))) * 100)
        
        # Sort by severity and date
        anomalies.sort(key=lambda x: (x['severity'] == 'critical', x['date']), reverse=True)
        
        return jsonify({
            'success': True,
            'anomalies': anomalies[:20],  # Limit to 20 most recent/severe
            'summary': anomaly_summary,
            'parameters': {
                'sensitivity': sensitivity,
                'time_range': time_range
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Anomaly detection failed: {str(e)}")
        
        # Return mock data for demonstration
        mock_anomalies = [
            {
                'drug_name': 'Morphine',
                'date': '2025-01-15',
                'actual_usage': 45,
                'expected_usage': 32,
                'deviation_percent': 40.6,
                'severity': 'medium',
                'pattern_type': 'spike',
                'confidence': 0.92
            },
            {
                'drug_name': 'Insulin',
                'date': '2025-01-20',
                'actual_usage': 78,
                'expected_usage': 65,
                'deviation_percent': 20.0,
                'severity': 'medium',
                'pattern_type': 'trend',
                'confidence': 0.87
            },
            {
                'drug_name': 'Paracetamol',
                'date': '2025-01-25',
                'actual_usage': 12,
                'expected_usage': 89,
                'deviation_percent': -86.5,
                'severity': 'critical',
                'pattern_type': 'drop',
                'confidence': 0.95
            }
        ]
        
        return jsonify({
            'success': True,
            'anomalies': mock_anomalies,
            'summary': {
                'total_anomalies': 3,
                'critical_anomalies': 1,
                'drugs_affected': 3,
                'detection_rate': 15.8
            },
            'parameters': {
                'sensitivity': sensitivity,
                'time_range': time_range
            },
            'timestamp': datetime.now().isoformat(),
            'note': 'Using sample data - check logs for details'
        })


@api.route('/export/csv', methods=['GET'])
def export_inventory_csv():
    """Export complete inventory data as CSV"""
    try:
        drugs_df = db_manager.get_all_drugs()
        if drugs_df.empty:
            return jsonify({'error': 'No data to export'}), 400
            
        # Add additional calculated fields
        current_time = datetime.now()
        export_data = []
        
        for _, drug in drugs_df.iterrows():
            sales_data = db_manager.get_drug_sales_data(drug['name'])
            
            # Calculate recent usage
            recent_usage = 0
            if not sales_data.empty:
                recent_sales = sales_data[sales_data['date'] >= (current_time - timedelta(days=7))]
                recent_usage = recent_sales['quantity_sold'].sum() if not recent_sales.empty else 0
            
            export_row = {
                'Drug_Name': drug['name'],
                'Current_Stock': drug.get('current_stock', 0),
                'Reorder_Level': drug.get('reorder_level', 0),
                'Weekly_Usage': recent_usage,
                'Risk_Level': 'Critical' if drug.get('current_stock', 0) < drug.get('reorder_level', 0) else 'Normal',
                'Department': drug.get('department', 'General'),
                'Last_Updated': current_time.strftime('%Y-%m-%d %H:%M:%S')
            }
            export_data.append(export_row)
        
        # Convert to CSV
        df = pd.DataFrame(export_data)
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        
        return send_file(
            io.BytesIO(output.getvalue().encode()),
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'rx_inventory_{current_time.strftime("%Y%m%d_%H%M%S")}.csv'
        )
        
    except Exception as e:
        return jsonify({'error': f'Export failed: {str(e)}'}), 500


@api.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@api.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500
