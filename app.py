from flask import Flask, render_template, request, jsonify
from pathlib import Path
import pickle
import numpy as np

app = Flask(__name__)
MODEL_PATH = Path(__file__).parent / "knn_model.pkl"
model = None

def load_model():
    global model
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)

load_model()

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    global model
    data = request.get_json(silent=True) or {}
    try:
        # Features: average distance from enemy, moves per minute, time spent nearly still (%)
        features = np.array([[
            float(data.get("avg_distance", 5)),
            float(data.get("moves_per_minute", 30)),
            float(data.get("still_percent", 20))
        ]])
        if model is None:
            return jsonify({"error": "Model not trained yet. Run: python train_model.py"}), 500
        label = str(model.predict(features)[0])
        return jsonify({"behavior": label})
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid player statistics."}), 400

if __name__ == "__main__":
    app.run(debug=True)
