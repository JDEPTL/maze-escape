const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const TILE = 40;
const COLS = 18;
const ROWS = 14;
// 1 = wall, 0 = floor
const originalMap = [
"111111111111111111",
"100000000100000001",
"101110100101110101",
"100010100000010001",
"111010111110010101",
"100000000010000001",
"101111110010111101",
"100000010000000001",
"101110010111010101",
"100010000100010001",
"101011110100110101",
"100000000000000001",
"100111011101110001",
"111111111111111111"
].map(row => row.split("").map(Number));

let map, player, enemy, key, exitTile, hasKey, moves, score, startTime, elapsed, running, moveTimes, distanceSamples, stillMs, lastActivity, lastPrediction;
const keyPos = {x: 1, y: 9};
const exitPos = {x: 16, y: 1};
const startPlayer = {x: 1, y: 1};
const startEnemy = {x: 15, y: 11};

function resetGame() {
  map = originalMap.map(r => r.slice());
  player = {...startPlayer};
  enemy = {...startEnemy};
  key = {...keyPos, collected:false};
  exitTile = {...exitPos};
  hasKey = false; moves = 0; score = 0;
  startTime = Date.now(); elapsed = 0; running = true;
  moveTimes = []; distanceSamples = []; stillMs = 0;
  lastActivity = Date.now(); lastPrediction = 0;
  document.getElementById("overlay").classList.add("hidden");
  document.getElementById("key-status").textContent = "MISSING";
  document.getElementById("key-status").className = "warning";
  document.getElementById("enemy-status").textContent = "Searching for you...";
  document.getElementById("score").textContent = "000";
  document.getElementById("moves").textContent = "0";
  document.getElementById("behavior").textContent = "Collecting data...";
  document.getElementById("behavior-description").textContent = "Play for a few seconds to give the model movement data.";
  draw();
}
function walkable(x,y) { return y>=0 && y<ROWS && x>=0 && x<COLS && map[y][x]===0; }
function same(a,b) { return a.x===b.x && a.y===b.y; }
function manhattan(a,b) { return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }

function bfsPath(start, target) {
  const queue = [start];
  const firstKey = p => `${p.x},${p.y}`;
  const visited = new Set([firstKey(start)]);
  const previous = new Map();
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  while(queue.length) {
    const current = queue.shift();
    if(same(current,target)) break;
    for(const [dx,dy] of dirs) {
      const next = {x:current.x+dx,y:current.y+dy};
      const k = firstKey(next);
      if(walkable(next.x,next.y) && !visited.has(k)) {
        visited.add(k); previous.set(k,current); queue.push(next);
      }
    }
  }
  const endKey = firstKey(target);
  if(!visited.has(endKey)) return [];
  const path = [];
  let cur = target;
  while(!same(cur,start)) {
    path.push(cur);
    cur = previous.get(firstKey(cur));
    if(!cur) return [];
  }
  return path.reverse();
}

function movePlayer(dx,dy) {
  if(!running) return;
  const next = {x:player.x+dx,y:player.y+dy};
  if(!walkable(next.x,next.y)) return;
  player = next;
  moves++;
  moveTimes.push(Date.now());
  moveTimes = moveTimes.filter(t => Date.now()-t < 60000);
  lastActivity = Date.now();
  score += 1;
  if(same(player,key) && !hasKey) {
    hasKey = true; key.collected = true; score += 50;
    document.getElementById("key-status").textContent = "COLLECTED";
    document.getElementById("key-status").className = "";
    document.getElementById("key-status").style.color = "var(--green)";
  }
  if(same(player,exitTile)) {
    if(hasKey) { score += 100; finish(true); return; }
    document.getElementById("enemy-status").textContent = "Exit is locked — find the key!";
  }
  distanceSamples.push(manhattan(player,enemy));
  if(distanceSamples.length>60) distanceSamples.shift();
  updateEnemy();
  if(same(player,enemy)) { finish(false); return; }
  updateStats();
  draw();
  maybePredict();
}
function updateEnemy() {
  const path = bfsPath(enemy,player);
  if(path.length) enemy = path[0];
  document.getElementById("enemy-status").textContent = "Following BFS path...";
  if(same(player,enemy)) finish(false);
}
function finish(won) {
  running = false;
  const overlay = document.getElementById("overlay");
  document.getElementById("overlay-title").textContent = won ? "YOU ESCAPED!" : "CAUGHT!";
  document.getElementById("overlay-title").style.color = won ? "var(--green)" : "var(--red)";
  document.getElementById("overlay-text").textContent = won ? `Key collected. Score: ${score}` : "The stalker caught you. Try another route!";
  overlay.classList.remove("hidden");
  document.getElementById("enemy-status").textContent = won ? "You escaped!" : "Target caught.";
}
function updateStats() {
  elapsed = Math.floor((Date.now()-startTime)/1000);
  document.getElementById("score").textContent = String(score).padStart(3,"0");
  document.getElementById("moves").textContent = moves;
  document.getElementById("time").textContent = `${String(Math.floor(elapsed/60)).padStart(2,"0")}:${String(elapsed%60).padStart(2,"0")}`;
  const d = distanceSamples.length ? distanceSamples.reduce((a,b)=>a+b,0)/distanceSamples.length : manhattan(player,enemy);
  document.getElementById("danger-meter").style.width = `${Math.max(8,Math.min(100,100-d*8))}%`;
  document.getElementById("distance-feature").textContent = d.toFixed(1)+" tiles";
  document.getElementById("pace-feature").textContent = moveTimes.length+" / min";
  document.getElementById("still-feature").textContent = Math.min(100,Math.round(stillMs/Math.max(1,Date.now()-startTime)*100))+"%";
}
async function maybePredict() {
  if(Date.now()-lastPrediction < 2500 || moves < 3) return;
  lastPrediction = Date.now();
  const avg = distanceSamples.length ? distanceSamples.reduce((a,b)=>a+b,0)/distanceSamples.length : manhattan(player,enemy);
  const elapsedMs = Math.max(1000,Date.now()-startTime);
  const stillPercent = Math.min(100,stillMs/elapsedMs*100);
  const payload = {avg_distance:avg,moves_per_minute:moveTimes.length,still_percent:stillPercent};
  try {
    const res = await fetch("/predict",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || "Prediction failed");
    document.getElementById("behavior").textContent = data.behavior;
    document.getElementById("behavior-symbol").textContent = data.behavior==="Aggressive" ? "⚡" : data.behavior==="Evasive" ? "↗" : "◇";
    document.getElementById("behavior-description").textContent = {
      "Aggressive":"You tend to move quickly and stay close to the enemy.",
      "Cautious":"Your movement looks balanced and measured.",
      "Evasive":"You tend to keep distance and wait for safer moments."
    }[data.behavior] || "KNN classified your current movement.";
  } catch(err) {
    document.getElementById("behavior").textContent = "Model unavailable";
    document.getElementById("behavior-description").textContent = "Run train_model.py first, then restart app.py.";
  }
}
function drawTile(x,y,wall) {
  const px=x*TILE, py=y*TILE;
  if(wall) {
    ctx.fillStyle="#263644"; ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle="#344858"; ctx.fillRect(px+2,py+2,TILE-4,TILE-4);
    ctx.fillStyle="#405463"; ctx.fillRect(px+4,py+4,TILE-8,5);
    ctx.fillStyle="#1a2731"; ctx.fillRect(px+4,py+TILE-8,TILE-8,4);
    ctx.fillStyle="#243541"; ctx.fillRect(px+TILE/2-1,py+7,2,TILE-14);
    if((x+y)%2===0){ctx.fillStyle="#526371";ctx.fillRect(px+8,py+12,4,3);}
  } else {
    ctx.fillStyle="#101a22";ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle="#14212a";ctx.fillRect(px+2,py+2,TILE-4,TILE-4);
    ctx.fillStyle="#1c2a34";ctx.fillRect(px+7,py+7,2,2);
    if((x*3+y)%5===0){ctx.fillStyle="#243540";ctx.fillRect(px+27,py+28,3,2);}
  }
}
function drawCharacter(p,color,accent,isEnemy=false) {
  const x=p.x*TILE,y=p.y*TILE;
  // Deliberately simple, hand-drawn pixel-style character made from rectangles.
  ctx.fillStyle="#070b0e";ctx.fillRect(x+10,y+8,22,27);
  ctx.fillStyle=color;ctx.fillRect(x+13,y+6,16,15);
  ctx.fillStyle=accent;ctx.fillRect(x+14,y+10,4,4);ctx.fillRect(x+23,y+10,4,4);
  ctx.fillStyle="#10151a";ctx.fillRect(x+15,y+11,2,2);ctx.fillRect(x+24,y+11,2,2);
  ctx.fillStyle=color;ctx.fillRect(x+10,y+22,22,10);
  ctx.fillStyle="#26323b";ctx.fillRect(x+11,y+31,8,7);ctx.fillRect(x+23,y+31,8,7);
  if(isEnemy){ctx.fillStyle="#fff0f0";ctx.fillRect(x+13,y+17,14,2);}
  else {ctx.fillStyle="#c7a27b";ctx.fillRect(x+17,y+23,6,3);}
}
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) drawTile(x,y,map[y][x]===1);
  // Exit
  ctx.fillStyle=hasKey?"#1f9e69":"#27553f";
  ctx.fillRect(exitTile.x*TILE+7,exitTile.y*TILE+4,26,32);
  ctx.fillStyle=hasKey?"#82ffbc":"#4f9470";
  ctx.fillRect(exitTile.x*TILE+12,exitTile.y*TILE+9,16,22);
  ctx.fillStyle="#10251c";ctx.fillRect(exitTile.x*TILE+22,exitTile.y*TILE+18,3,3);
  // Key
  if(!hasKey){
    const kx=key.x*TILE+20, ky=key.y*TILE+20;
    ctx.strokeStyle="#ffd166";ctx.lineWidth=4;ctx.beginPath();ctx.arc(kx-4,ky-3,6,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#ffd166";ctx.fillRect(kx,ky-2,13,4);ctx.fillRect(kx+7,ky+1,3,5);ctx.fillRect(kx+12,ky+1,3,4);
  }
  drawCharacter(enemy,"#b63d4c","#ffe0dc",true);
  drawCharacter(player,"#4eae91","#d9fff0",false);
}
document.addEventListener("keydown",e=>{
  const keyName=e.key.toLowerCase();
  const dirs={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]};
  if(dirs[keyName]){e.preventDefault();movePlayer(...dirs[keyName]);}
});
document.getElementById("restart").addEventListener("click",resetGame);
document.getElementById("overlay-restart").addEventListener("click",resetGame);
setInterval(()=>{
  if(running){
    if(Date.now()-lastActivity>1000) stillMs += 1000;
    updateStats();
    if(Date.now()-lastPrediction>5000 && moves>=3) maybePredict();
  }
},1000);
resetGame();
