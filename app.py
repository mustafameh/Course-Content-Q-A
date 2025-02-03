from flask import Flask, render_template, jsonify
from flask_cors import CORS
from src.auth import auth_bp, configure_auth
from src.models import Base, engine

app = Flask(__name__)
CORS(app)

# Configure Flask-Login
app.config['SECRET_KEY'] = 'your-secret-key'  # Change this in production
configure_auth(app)

# Register blueprints
app.register_blueprint(auth_bp)

# Create database tables
Base.metadata.create_all(bind=engine)

# Basic routes for testing
@app.route('/')
def home():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)