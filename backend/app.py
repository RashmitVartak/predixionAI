from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
import os
from flask_cors import CORS, cross_origin
import pandas as pd
import asyncio
import logging

from dotenv import load_dotenv
from functools import wraps
from gevent import monkey  # Import gevent's monkey patching

from livekit_dispatcher import dispatch_call, init_dispatcher

monkey.patch_all()  # Patch the standard library EARLY!
load_dotenv()

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='../frontend/build', static_url_path='/')
CORS(app, supports_credentials=True, origins=["*"])

# Make sure this comes AFTER the CORS configuration
socketio = SocketIO(app, cors_allowed_origins="http://localhost:3000", async_mode='gevent')

init_dispatcher(socketio)

# Rate limiting decorator
def limiter(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        # Implement your rate limiting logic here
        return f(*args, **kwargs)
    return wrapper

@app.route("/upload-csv", methods=["POST"])
@limiter
def upload_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Invalid file format"}), 400

    if not file.filename.lower().endswith('.csv'):
        return jsonify({"error": "Only CSV files are allowed"}), 400

    try:
        # Read CSV with error handling
        try:
            df = pd.read_csv(file)
        except Exception as e:
            return jsonify({"error": f"Invalid CSV format: {str(e)}"}), 400

        # Define required columns with friendly names
        required_columns = {
            'Mobile_No': "Mobile Number",
            'F_Name': "First Name", 
            'L_Name': "Last Name",
            'Current_balance': "Current Balance",
            'Installment_Amount': "Installment Amount",
            'Date_of_last_payment': "Date of Last Payment",
            'Channel_Preference': "Channel Preference"
        }

        # Check for missing columns
        missing_columns = [col for col in required_columns.keys() if col not in df.columns]
        if missing_columns:
            friendly_names = [required_columns[col] for col in missing_columns]
            return jsonify({
                "error": "Missing required columns",
                "missing_columns": missing_columns,
                "friendly_names": friendly_names,
                "message": f"Your CSV is missing: {', '.join(friendly_names)}"
            }), 400
        
        # Update the numeric field validation
        try:
            borrowers = df.to_dict(orient="records")
            # Validate numeric fields
            for borrower in borrowers:
                borrower['Mobile_No'] = str(borrower['Mobile_No']).strip().replace(".0", "")
                borrower['Current_balance'] = float(borrower['Current_balance'])
                borrower['Installment_Amount'] = float(borrower['Installment_Amount'])
        except (ValueError, KeyError) as e:
            return jsonify({
                "error": "Invalid data format",
                "message": f"Please check your numeric columns (Current_balance, Installment_Amount): {str(e)}"
            }), 400
            
        socketio.emit("borrowers_update", {"borrowers": borrowers})
        return jsonify({"borrowers": borrowers}), 200

    except Exception as e:
        logger.error(f"CSV processing error: {str(e)}")
        return jsonify({
            "error": "Processing error",
            "message": str(e)
        }), 500

@app.route("/dispatch-call", methods=["POST","OPTIONS"])
@cross_origin(
    origins="http://localhost:3000",
    supports_credentials=True,
    methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"]
)
@limiter
async def handle_dispatch():  # Changed to async
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No data provided"}), 400

        # Phone number validation
        phone_str = str(data.get('phone', '')).strip()
        if not phone_str.isdigit() or len(phone_str) != 10:
            return jsonify({"status": "error", "message": "Invalid phone number - must be 10 digits"}), 400

        user_info = data.get('user_info', {})
        required_fields = ['F_Name', 'L_Name', 'Current_balance', 'Date_of_last_payment', 'Installment_Amount']
        if not all(field in user_info for field in required_fields):
            return jsonify({"status": "error", "message": "Missing required borrower information"}), 400

        # Convert numeric fields
        try:
            user_info['Current_balance'] = float(user_info['Current_balance'])
            user_info['Installment_Amount'] = float(user_info['Installment_Amount'])
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Invalid numeric values"}), 400

        from livekit_dispatcher import dispatch_call
        result = await dispatch_call(phone_str, user_info)
        
        return jsonify({
            "status": "success",
            "data": result,
            "message": "Call initiated successfully"
        }), 200

    except Exception as e:
        logger.error(f"Dispatch error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)