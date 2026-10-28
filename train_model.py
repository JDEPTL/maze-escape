"""Create a small example training dataset and train the KNN behavior classifier."""
import pickle
from pathlib import Path
import numpy as np
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

# Features: [average distance from enemy in maze tiles, moves per minute, still-time percentage]
X = np.array([
    [1.0, 70, 5], [1.5, 65, 8], [2.0, 80, 4], [2.2, 60, 10],
    [4.0, 35, 25], [5.0, 30, 30], [4.5, 40, 20], [5.5, 25, 35],
    [7.0, 18, 55], [8.0, 12, 65], [6.5, 20, 60], [9.0, 10, 70],
    [2.5, 55, 12], [3.5, 38, 28], [7.5, 15, 58], [4.8, 33, 24],
    [1.8, 75, 6], [5.8, 22, 40], [8.5, 8, 75], [3.0, 45, 18],
])
y = np.array([
    "Aggressive", "Aggressive", "Aggressive", "Aggressive",
    "Cautious", "Cautious", "Cautious", "Cautious",
    "Evasive", "Evasive", "Evasive", "Evasive",
    "Aggressive", "Cautious", "Evasive", "Cautious",
    "Aggressive", "Evasive", "Evasive", "Aggressive",
])

model = make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=3))
model.fit(X, y)

path = Path(__file__).parent / "knn_model.pkl"
with open(path, "wb") as f:
    pickle.dump(model, f)

print(f"KNN model trained and saved to {path.name}")
print("Features: average enemy distance, moves per minute, still-time percentage")
