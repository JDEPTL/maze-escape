# Maze Escape — VS Code project

A small single-page maze game with:
- Player movement using Arrow keys or WASD
- A key and exit objective
- An enemy that follows a shortest path using BFS
- A trained KNN model that classifies play style as Aggressive, Cautious, or Evasive
- Score, timer, move count, restart, and a behavior panel

## Run in VS Code

1. Install Python 3.10 or newer.
2. Open this folder in VS Code.
3. Open Terminal → New Terminal.
4. Create and activate a virtual environment (recommended):

   **Windows PowerShell**
   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   If activation is blocked, you can skip the virtual environment and use `py -m pip` below.

5. Install dependencies:
   ```powershell
   py -m pip install -r requirements.txt
   ```
6. Train the KNN model:
   ```powershell
   py train_model.py
   ```
7. Start the website:
   ```powershell
   py app.py
   ```
8. Open **http://127.0.0.1:5000** in your browser.

## How to play
- Move with Arrow keys or WASD.
- Collect the yellow key, then reach the green exit.
- Avoid the red enemy.
- Press Restart to reset the maze.

## Machine learning note
The KNN model is trained on a small illustrative dataset included in `train_model.py`. It is a working demonstration of the syllabus algorithm, not a scientifically validated player-profiling model. The browser sends gameplay statistics to Flask, which runs the saved model.
