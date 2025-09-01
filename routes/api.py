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


# Error handlers
@api.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@api.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500
