"""
Database utilities for RxForecaster Supply Chain Management System
Handles SQLite database operations for drug inventory and forecasting data
"""

import sqlite3
import pandas as pd
import os
from datetime import datetime, timedelta
import numpy as np
from typing import List, Dict, Optional

class DatabaseManager:
    """Manages SQLite database operations for pharmacy inventory"""
    
    def __init__(self, db_path: str = "data/pharmacy.db"):
        self.db_path = db_path
        self.ensure_database_exists()
    
    def ensure_database_exists(self):
        """Create database and tables if they don't exist"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        with sqlite3.connect(self.db_path) as conn:
            # Create drugs table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS drugs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    drug_name TEXT UNIQUE NOT NULL,
                    current_stock INTEGER NOT NULL,
                    weekly_sales REAL NOT NULL,
                    lead_time_days INTEGER NOT NULL,
                    department TEXT,
                    unit_cost REAL,
                    therapeutic_class TEXT,
                    min_stock_level INTEGER DEFAULT 0,
                    max_stock_level INTEGER DEFAULT 1000,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create historical sales table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS historical_sales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    drug_name TEXT NOT NULL,
                    date DATE NOT NULL,
                    sales_quantity INTEGER NOT NULL,
                    department TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (drug_name) REFERENCES drugs (drug_name)
                )
            """)
            
            # Create forecasts table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS forecasts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    drug_name TEXT NOT NULL,
                    forecast_date DATE NOT NULL,
                    predicted_demand REAL NOT NULL,
                    model_used TEXT NOT NULL,
                    confidence_interval_lower REAL,
                    confidence_interval_upper REAL,
                    rmse REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (drug_name) REFERENCES drugs (drug_name)
                )
            """)
            
            # Create anomalies table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS anomalies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    drug_name TEXT NOT NULL,
                    detection_date DATE NOT NULL,
                    anomaly_type TEXT NOT NULL,
                    severity REAL NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (drug_name) REFERENCES drugs (drug_name)
                )
            """)
            
            conn.commit()
    
    def load_drugs_from_csv(self, csv_path: str = "data/drugs.csv"):
        """Load drug data from CSV into database"""
        try:
            df = pd.read_csv(csv_path)
            
            # Rename columns to match database schema
            df = df.rename(columns={
                'Drug': 'drug_name',
                'Current_Stock': 'current_stock',
                'Weekly_Sales': 'weekly_sales',
                'Lead_Time_Days': 'lead_time_days',
                'Department': 'department',
                'Unit_Cost': 'unit_cost',
                'Therapeutic_Class': 'therapeutic_class',
                'Min_Stock_Level': 'min_stock_level',
                'Max_Stock_Level': 'max_stock_level'
            })
            
            with sqlite3.connect(self.db_path) as conn:
                # Use replace to handle duplicates
                df.to_sql('drugs', conn, if_exists='replace', index=False)
            
            print(f"✅ Successfully loaded {len(df)} drugs into database")
            return True
            
        except Exception as e:
            print(f"❌ Error loading drugs from CSV: {str(e)}")
            return False
    
    def generate_historical_sales_data(self, weeks_back: int = 52):
        """Generate realistic historical sales data for forecasting"""
        drugs = self.get_all_drugs()
        print(f"🔄 Generating historical data for {len(drugs)} drugs over {weeks_back} weeks...")
        
        historical_data = []
        base_date = datetime.now() - timedelta(weeks=weeks_back)
        
        # Process in batches for better memory management
        batch_size = 50
        total_batches = (len(drugs) + batch_size - 1) // batch_size
        
        for batch_idx in range(0, len(drugs), batch_size):
            batch_drugs = drugs.iloc[batch_idx:batch_idx + batch_size]
            batch_data = []
            
            print(f"   Processing batch {batch_idx//batch_size + 1}/{total_batches}...")
            
            for _, drug in batch_drugs.iterrows():
                drug_name = drug['drug_name']
                base_weekly_sales = drug['weekly_sales']
                department = drug['department']
                
                for week in range(weeks_back):
                    current_date = base_date + timedelta(weeks=week)
                    
                    # Add seasonality and randomness
                    seasonal_factor = 1 + 0.2 * np.sin(2 * np.pi * week / 52)  # Annual seasonality
                    weekly_factor = 1 + 0.1 * np.sin(2 * np.pi * week / 4)    # Monthly variation
                    
                    # Add random variation (±20%)
                    random_factor = np.random.normal(1, 0.2)
                    
                    # Simulate demand spikes for critical care drugs during "events"
                    if department == 'ICU' and 20 <= week <= 25:  # Simulate pandemic-like event
                        spike_factor = np.random.uniform(1.5, 2.5)
                    elif department == 'Oncology' and 30 <= week <= 35:  # Simulate cancer treatment surge
                        spike_factor = np.random.uniform(1.3, 2.0)
                    else:
                        spike_factor = 1
                    
                    daily_sales = (base_weekly_sales / 7) * seasonal_factor * weekly_factor * random_factor * spike_factor
                    weekly_sales = max(0, int(daily_sales * 7))  # Ensure non-negative
                    
                    # Generate weekly aggregated data for better performance
                    # Create 3-4 data points per week instead of daily for large datasets
                    data_points_per_week = 3
                    for point in range(data_points_per_week):
                        date = current_date + timedelta(days=point * 2)  # Every 2-3 days
                        point_quantity = max(0, int(weekly_sales / data_points_per_week * np.random.uniform(0.7, 1.3)))
                        
                        batch_data.append({
                            'drug_name': drug_name,
                            'date': date.strftime('%Y-%m-%d'),
                            'sales_quantity': point_quantity,
                            'department': department
                        })
            
            historical_data.extend(batch_data)
        
        # Save to database in batches
        print(f"💾 Saving {len(historical_data)} historical records to database...")
        historical_df = pd.DataFrame(historical_data)
        
        with sqlite3.connect(self.db_path) as conn:
            # Clear existing data first
            conn.execute("DELETE FROM historical_sales")
            
            # Insert new data in chunks for better performance
            chunk_size = 10000
            for i in range(0, len(historical_df), chunk_size):
                chunk = historical_df.iloc[i:i + chunk_size]
                chunk.to_sql('historical_sales', conn, if_exists='append', index=False)
            
            # Create indexes for better query performance
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_historical_drug_date 
                ON historical_sales (drug_name, date)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_historical_department 
                ON historical_sales (department)
            """)
            conn.commit()
        
        print(f"✅ Generated {len(historical_data)} historical sales records with performance optimizations")
        return True
    
    def get_all_drugs(self) -> pd.DataFrame:
        """Get all drugs from database"""
        with sqlite3.connect(self.db_path) as conn:
            return pd.read_sql_query("SELECT * FROM drugs", conn)
    
    def get_drug_by_name(self, drug_name: str) -> Optional[Dict]:
        """Get specific drug by name"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT * FROM drugs WHERE drug_name = ?", (drug_name,)
            )
            row = cursor.fetchone()
            if row:
                columns = [description[0] for description in cursor.description]
                return dict(zip(columns, row))
            return None
    
    def get_historical_sales(self, drug_name: str, days_back: int = 365) -> pd.DataFrame:
        """Get historical sales data for a specific drug"""
        cutoff_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
        
        with sqlite3.connect(self.db_path) as conn:
            query = """
                SELECT date, sales_quantity
                FROM historical_sales
                WHERE drug_name = ? AND date >= ?
                ORDER BY date
            """
            df = pd.read_sql_query(query, conn, params=(drug_name, cutoff_date))
            df['date'] = pd.to_datetime(df['date'])
            return df
    
    def save_forecast(self, drug_name: str, forecast_data: Dict):
        """Save forecast results to database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO forecasts 
                (drug_name, forecast_date, predicted_demand, model_used, 
                 confidence_interval_lower, confidence_interval_upper, rmse)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                drug_name,
                forecast_data['forecast_date'],
                forecast_data['predicted_demand'],
                forecast_data['model_used'],
                forecast_data.get('ci_lower'),
                forecast_data.get('ci_upper'),
                forecast_data.get('rmse')
            ))
            conn.commit()
    
    def save_anomaly(self, drug_name: str, anomaly_data: Dict):
        """Save anomaly detection results to database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO anomalies 
                (drug_name, detection_date, anomaly_type, severity, description)
                VALUES (?, ?, ?, ?, ?)
            """, (
                drug_name,
                anomaly_data['detection_date'],
                anomaly_data['anomaly_type'],
                anomaly_data['severity'],
                anomaly_data.get('description', '')
            ))
            conn.commit()
    
    def get_departments(self) -> List[str]:
        """Get list of all departments"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT DISTINCT department FROM drugs ORDER BY department")
            return [row[0] for row in cursor.fetchall()]
    
    def get_drugs_by_department(self, department: str) -> pd.DataFrame:
        """Get all drugs in a specific department"""
        with sqlite3.connect(self.db_path) as conn:
            return pd.read_sql_query(
                "SELECT * FROM drugs WHERE department = ?", 
                conn, 
                params=(department,)
            )
    
    def update_stock_level(self, drug_name: str, new_stock: int):
        """Update stock level for a drug"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                UPDATE drugs 
                SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
                WHERE drug_name = ?
            """, (new_stock, drug_name))
            conn.commit()
    
    def get_low_stock_drugs(self, weeks_threshold: int = 2) -> pd.DataFrame:
        """Get drugs that will run out within threshold weeks"""
        with sqlite3.connect(self.db_path) as conn:
            query = """
                SELECT *, 
                       (current_stock * 1.0 / weekly_sales) as weeks_remaining
                FROM drugs 
                WHERE (current_stock * 1.0 / weekly_sales) <= ?
                ORDER BY weeks_remaining
            """
            return pd.read_sql_query(query, conn, params=(weeks_threshold,))


def initialize_database():
    """Initialize database with sample data"""
    db = DatabaseManager()
    
    # Load drugs from CSV
    if os.path.exists("data/drugs.csv"):
        db.load_drugs_from_csv()
    
    # Generate historical sales data
    db.generate_historical_sales_data()
    
    return db


if __name__ == "__main__":
    # Initialize database when run directly
    print("🔄 Initializing RxForecaster database...")
    db = initialize_database()
    
    # Display summary
    drugs = db.get_all_drugs()
    print(f"📊 Database initialized with {len(drugs)} drugs")
    print(f"🏥 Departments: {', '.join(db.get_departments())}")
    
    # Show low stock drugs
    low_stock = db.get_low_stock_drugs()
    if len(low_stock) > 0:
        print(f"⚠️  {len(low_stock)} drugs need attention:")
        for _, drug in low_stock.head().iterrows():
            print(f"   - {drug['drug_name']}: {drug['weeks_remaining']:.1f} weeks remaining")
