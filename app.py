"""
RxForecaster Supply Chain Management System
Main Flask Application with API Endpoints and Web Interface
"""

from flask import Flask, render_template, jsonify
from flask_cors import CORS
import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import routes
from routes.api import api

# Import utilities
from utils.database import initialize_database

def create_app():
    """Application factory pattern"""
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = 'rxforecaster-supply-chain-2024'
    app.config['DEBUG'] = True
    
    # Enable CORS for all routes
    CORS(app)
    
    # Register blueprints
    app.register_blueprint(api, url_prefix='/api/v1')
    
    # Initialize database
    print(" Initializing RxForecaster database...")
    try:
        db = initialize_database()
        print("Database initialized successfully")
    except Exception as e:
        print(f" Database initialization failed: {str(e)}")
    
    # Dashboard route
    @app.route('/dashboard')
    def dashboard():
        """HTML Dashboard page"""
        return render_template('dashboard.html')
    
    # Forecast view route
    @app.route('/forecast')
    def forecast_view():
        """Beautiful forecast visualization page"""
        return render_template('forecast_view.html')
    
    # Drugs view route
    @app.route('/drugs')
    def drugs_view():
        """Beautiful drug inventory page"""
        return render_template('drugs_view.html')
    
    # Health view route
    @app.route('/health')
    def health_view():
        """Beautiful system health page"""
        return render_template('health_view.html')
    
    # Reorder view route
    @app.route('/reorder')
    def reorder_view():
        """Beautiful reorder report page"""
        return render_template('reorder_view.html')
    
    # Anomaly view route
    @app.route('/anomaly')
    def anomaly_view():
        """Beautiful anomaly analysis page"""
        return render_template('anomaly_view.html')
    
    # Simple test route for deployment
    @app.route('/test')
    def test_route():
        """Simple test endpoint"""
        return jsonify({
            'status': 'RxForecaster is working!',
            'timestamp': datetime.now().isoformat(),
            'message': 'All systems operational'
        })
    
    # Root route
    @app.route('/')
    def index():
        """Main dashboard page"""
        return jsonify({
            'message': 'Welcome to RxForecaster Supply Chain Management System',
            'version': '1.0.0',
            'features': [
                'Drug inventory forecasting with FB Prophet and ARIMA',
                'Anomaly detection for unusual demand patterns',
                'Automated reorder recommendations',
                'Real-time dashboard and analytics',
                'RESTful API for integration'
            ],
            'api_endpoints': {
                'health_check': '/api/v1/health',
                'all_drugs': '/api/v1/drugs',
                'drug_forecast': '/api/v1/forecast/<drug_name>',
                'drug_anomalies': '/api/v1/anomalies/<drug_name>',
                'reorder_report': '/api/v1/reorder_report',
                'bulk_forecast': '/api/v1/bulk_forecast',
                'bulk_anomalies': '/api/v1/bulk_anomalies',
                'update_stock': '/api/v1/update_stock',
                'departments': '/api/v1/departments',
                'low_stock': '/api/v1/low_stock'
            },
            'documentation': {
                'streamlit_dashboard': 'Run: streamlit run dashboard.py',
                'api_testing': 'Use Postman or curl to test API endpoints',
                'data_format': 'All dates in ISO format, stock levels as integers'
            }
        })
    
    @app.route('/docs')
    def api_documentation():
        """API documentation page"""
        return jsonify({
            'api_version': '1.0.0',
            'base_url': '/api/v1',
            'endpoints': {
                'GET /health': {
                    'description': 'Health check for API services',
                    'response': 'Service status and availability'
                },
                'GET /drugs': {
                    'description': 'Get all drugs with optional filtering',
                    'parameters': {
                        'department': 'Filter by department (optional)',
                        'risk_level': 'Filter by risk level: CRITICAL, HIGH, MEDIUM, LOW (optional)'
                    },
                    'response': 'List of drugs with stock levels and risk assessment'
                },
                'GET /forecast/<drug_name>': {
                    'description': 'Get demand forecast for specific drug',
                    'parameters': {
                        'periods': 'Number of days to forecast (default: 30)'
                    },
                    'response': 'Forecast data with model comparison and stockout analysis'
                },
                'GET /anomalies/<drug_name>': {
                    'description': 'Get anomaly detection results for specific drug',
                    'parameters': {
                        'days_back': 'Days of historical data to analyze (default: 180)'
                    },
                    'response': 'Anomaly detection results with risk assessment'
                },
                'GET /reorder_report': {
                    'description': 'Generate comprehensive reorder report',
                    'parameters': {
                        'format': 'Response format: json or csv (default: json)',
                        'risk_level': 'Filter by risk levels (multiple values allowed)',
                        'department': 'Filter by departments (multiple values allowed)'
                    },
                    'response': 'Reorder recommendations with cost analysis'
                },
                'POST /bulk_forecast': {
                    'description': 'Generate forecasts for multiple drugs',
                    'body': {
                        'drug_names': 'List of drug names (optional, all drugs if empty)',
                        'periods': 'Number of days to forecast (default: 30)'
                    },
                    'response': 'Forecast results for all requested drugs'
                },
                'POST /bulk_anomalies': {
                    'description': 'Run anomaly detection for multiple drugs',
                    'body': {
                        'drug_names': 'List of drug names (optional, all drugs if empty)',
                        'days_back': 'Days of historical data (default: 180)'
                    },
                    'response': 'Anomaly detection results for all requested drugs'
                },
                'POST /update_stock': {
                    'description': 'Update stock level for a drug',
                    'body': {
                        'drug_name': 'Name of the drug',
                        'new_stock': 'New stock level (integer)'
                    },
                    'response': 'Confirmation of stock update'
                },
                'GET /departments': {
                    'description': 'Get list of all departments',
                    'response': 'List of department names'
                },
                'GET /low_stock': {
                    'description': 'Get drugs with low stock levels',
                    'parameters': {
                        'weeks_threshold': 'Weeks threshold for low stock (default: 2)'
                    },
                    'response': 'List of drugs below threshold'
                }
            },
            'response_format': {
                'success': 'JSON object with requested data',
                'error': 'JSON object with error message and HTTP status code'
            },
            'authentication': 'None required (add authentication in production)',
            'rate_limiting': 'None implemented (add rate limiting in production)'
        })
    
    return app


if __name__ == '__main__':
    # Create and run the application
    app = create_app()
    
    print("Starting RxForecaster Supply Chain Management System")
    print(" Features: Forecasting, Anomaly Detection, Reorder Management")
    print(" API available at: http://localhost:5000")
    print("Documentation at: http://localhost:5000/docs")
    print("Streamlit Dashboard: streamlit run dashboard.py")
    print("=" * 60)
    
    # Run the Flask app
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )
