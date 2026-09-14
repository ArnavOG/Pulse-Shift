
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("best");
const finalScoreElement = document.getElementById("finalScore");
const dimensionLabel = document.getElementById("dimensionLabel");
const statusDot = document.getElementById("statusDot");

const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");


const joystick = document.getElementById("joystick");
const joystickKnob = document.getElementById("joystickKnob");
const mobileShiftButton = document.getElementById("mobileShiftButton");

let joystickActive = false;
let joystickPointerId = null;
let joystickX = 0;
let joystickY = 0;

const COLORS = {
  pulse: "#60a5fa",
  pulseObstacle: "#3b82f6",
  void: "#c4b5fd",
  voidObstacle: "#8b5cf6",
  background: "#10121c",
  grid: "#202435",
  text: "#e7eaf2",
  danger: "#fb7185"
};

let width = 800;
let height = 500;
let animationId = null;
let lastTime = 0;
let running = false;
let score = 0;
let bestScore = 0;
let elapsedTime = 0;
let spawnTimer = 0;
let nextSpawn = 1.1;
let currentDimension = "pulse";
let obstacles = [];
let keys = new Set();

const player = {
  x: 400,
  y: 250,
  radius: 13,
  speed: 300
};

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  width = Math.max(320, rect.width);
  height = Math.max(240, rect.height);

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!running) {
    player.x = width / 2;
    player.y = height / 2;
    draw();
  }
}

function resetGame() {
  score = 0;
  elapsedTime = 0;
  spawnTimer = 0;
  nextSpawn = 1.1;
  currentDimension = "pulse";
  obstacles = [];

  player.x = width / 2;
  player.y = height / 2;

  updateScore();
  updateDimension();
}

function startGame() {
  resetGame();

  running = true;
  lastTime = performance.now();

  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");

  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;

  bestScore = Math.max(bestScore, Math.floor(score));
  bestElement.textContent = bestScore;
  finalScoreElement.textContent = Math.floor(score);

  gameOverScreen.classList.remove("hidden");

  draw();
}

function updateScore() {
  scoreElement.textContent = Math.floor(score);
}

function updateDimension() {
  const isPulse = currentDimension === "pulse";

  dimensionLabel.textContent = isPulse
    ? "PULSE DIMENSION"
    : "VOID DIMENSION";

  statusDot.style.background = isPulse
    ? COLORS.pulse
    : COLORS.void;

  statusDot.style.boxShadow = isPulse
    ? `0 0 12px ${COLORS.pulse}`
    : `0 0 12px ${COLORS.void}`;
}

function shiftDimension() {
  if (!running) return;

  currentDimension =
    currentDimension === "pulse" ? "void" : "pulse";

  updateDimension();
}

function isDown(...names) {
  return names.some((name) => keys.has(name));
}


function updatePlayer(delta) {
  let dx = 0;
  let dy = 0;

  // Keyboard movement
  if (isDown("ArrowLeft", "a")) dx -= 1;
  if (isDown("ArrowRight", "d")) dx += 1;
  if (isDown("ArrowUp", "w")) dy -= 1;
  if (isDown("ArrowDown", "s")) dy += 1;

  // Mobile joystick movement
  if (joystickActive) {
    dx = joystickX;
    dy = joystickY;
  }

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);

    dx /= length;
    dy /= length;

    player.x += dx * player.speed * delta;
    player.y += dy * player.speed * delta;
  }

  // Keep the player inside the arena
  player.x = Math.max(
    player.radius,
    Math.min(width - player.radius, player.x)
  );

  player.y = Math.max(
    player.radius,
    Math.min(height - player.radius, player.y)
  );
}


function updateJoystick(event) {
  const rect = joystick.getBoundingClientRect();

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const maxDistance = rect.width / 2 - 24;

  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;

  const distance = Math.hypot(dx, dy);

  if (distance > maxDistance) {
    dx = (dx / distance) * maxDistance;
    dy = (dy / distance) * maxDistance;
  }

  joystickX = dx / maxDistance;
  joystickY = dy / maxDistance;

  joystickKnob.style.transform =
    `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function resetJoystick() {
  joystickActive = false;
  joystickPointerId = null;
  joystickX = 0;
  joystickY = 0;

  joystickKnob.style.transform =
    "translate(-50%, -50%)";
}

joystick.addEventListener("pointerdown", (event) => {
  if (!running) return;

  joystickActive = true;
  joystickPointerId = event.pointerId;

  joystick.setPointerCapture(event.pointerId);
  updateJoystick(event);
});

joystick.addEventListener("pointermove", (event) => {
  if (!joystickActive || event.pointerId !== joystickPointerId) {
    return;
  }

  updateJoystick(event);
});

joystick.addEventListener("pointerup", (event) => {
  if (event.pointerId === joystickPointerId) {
    resetJoystick();
  }
});

joystick.addEventListener("pointercancel", resetJoystick);
joystick.addEventListener("lostpointercapture", resetJoystick);

function spawnObstacle() {
  const size = 18 + Math.random() * 18;
  const fromTop = Math.random() < 0.5;

  let x;
  let y;

  if (fromTop) {
    x = Math.random() * width;
    y = -size;
  } else {
    x = width + size;
    y = Math.random() * height;
  }

  const angle = Math.atan2(player.y - y, player.x - x);
  const speed = 90 + Math.min(elapsedTime * 3, 100);

  obstacles.push({
    x,
    y,
    size,
    speed,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    dimension: Math.random() < 0.5 ? "pulse" : "void",
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - 0.5) * 2
  });
}

function updateObstacles(delta) {
  spawnTimer += delta;

  if (spawnTimer >= nextSpawn) {
    spawnTimer = 0;
    nextSpawn = Math.max(
      0.45,
      1.1 - elapsedTime * 0.008
    );
    spawnObstacle();
  }

  for (const obstacle of obstacles) {
    obstacle.x += obstacle.vx * delta;
    obstacle.y += obstacle.vy * delta;
    obstacle.rotation += obstacle.rotationSpeed * delta;
  }

  obstacles = obstacles.filter((obstacle) => {
    return (
      obstacle.x > -100 &&
      obstacle.x < width + 100 &&
      obstacle.y > -100 &&
      obstacle.y < height + 100
    );
  });
}

function checkCollisions() {
  for (const obstacle of obstacles) {
    if (obstacle.dimension !== currentDimension) {
      continue;
    }

    const dx = player.x - obstacle.x;
    const dy = player.y - obstacle.y;
    const distance = Math.hypot(dx, dy);

    if (distance < player.radius + obstacle.size * 0.7) {
      endGame();
      return;
    }
  }
}

function drawBackground() {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;

  const gridSize = 40;

  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const color =
    currentDimension === "pulse"
      ? COLORS.pulse
      : COLORS.void;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 25;

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.restore();
}

function drawObstacle(obstacle) {
  const color =
    obstacle.dimension === "pulse"
      ? COLORS.pulseObstacle
      : COLORS.voidObstacle;

  const active = obstacle.dimension === currentDimension;

  ctx.save();
  ctx.translate(obstacle.x, obstacle.y);
  ctx.rotate(obstacle.rotation);

  ctx.globalAlpha = active ? 1 : 0.16;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.rect(
    -obstacle.size / 2,
    -obstacle.size / 2,
    obstacle.size,
    obstacle.size
  );
  ctx.fill();

  ctx.globalAlpha = active ? 0.35 : 0.08;
  ctx.strokeRect(
    -obstacle.size,
    -obstacle.size,
    obstacle.size * 2,
    obstacle.size * 2
  );

  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = COLORS.text;
  ctx.font = "12px Arial";
  ctx.fillText(
    currentDimension === "pulse" ? "PULSE" : "VOID",
    18,
    26
  );

  ctx.textAlign = "right";
  ctx.fillText(`${Math.floor(score)} pts`, width - 18, 26);
  ctx.textAlign = "left";
}

function draw() {
  drawBackground();

  for (const obstacle of obstacles) {
    drawObstacle(obstacle);
  }

  drawPlayer();
  drawHud();
}

function gameLoop(timestamp) {
  if (!running) return;

  const delta = Math.min(
    (timestamp - lastTime) / 1000,
    0.05
  );

  lastTime = timestamp;
  elapsedTime += delta;
  score += delta;

  updatePlayer(delta);
  updateObstacles(delta);
  checkCollisions();
  updateScore();
  draw();

  if (running) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

// Keyboard controls
window.addEventListener("keydown", (event) => {
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]
      .includes(event.key)
  ) {
    event.preventDefault();
  }

  if (event.key === " " && !event.repeat) {
    shiftDimension();
    return;
  }

  keys.add(event.key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

window.addEventListener("blur", () => {
  keys.clear();
});

// Mouse and touch controls
canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" || event.pointerType === "touch") {
    shiftDimension();
  }
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
updateDimension();


mobileShiftButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  shiftDimension();
});