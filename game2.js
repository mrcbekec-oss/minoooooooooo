const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameWrap = document.getElementById('gameWrap');
const playerNameInput = document.getElementById('playerName');
const startButton = document.getElementById('startButton');
const playerLabel = document.getElementById('playerLabel');
const playerTitle = document.getElementById('playerTitle');
const taskCounter = document.getElementById('taskCounter');
const statusBox = document.getElementById('status');
const useButton = document.getElementById('useButton');

let playerName = 'Crewmate';
let playerTitleText = 'Crewmate';
let gameStarted = false;
let animationFrameId = null;
let lastTime = 0;
let completedTasks = 0;
let emergencyActive = false;
let elapsed = 0;
let interactionTarget = null;
let lastHintTask = null;
let playerGhost = false;

const keys = {};
let spaceQueued = false;
const isMobile = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const player = {
  x: 360,
  y: 270,
  radius: 22,
  speed: 230,
  dead: false,
};

const tasks = [
  { x: 170, y: 120, w: 42, h: 42, color: '#ff6262', label: 'O2 Filtre', completed: false, progress: 0 },
  { x: 690, y: 140, w: 42, h: 42, color: '#4fd1c5', label: 'Elektrik Paneli', completed: false, progress: 0 },
  { x: 180, y: 395, w: 42, h: 42, color: '#f2b84b', label: 'Yedek Kartuş', completed: false, progress: 0 },
  { x: 450, y: 110, w: 42, h: 42, color: '#8b9cff', label: 'Aksesuar Kontrol', completed: false, progress: 0 },
  { x: 610, y: 400, w: 42, h: 42, color: '#c48cff', label: 'Rota Onarımı', completed: false, progress: 0 },
  { x: 320, y: 300, w: 42, h: 42, color: '#ff8f5b', label: 'Havalandırma', completed: false, progress: 0 },
];

const emergencyButton = {
  x: 770,
  y: 420,
  radius: 24,
};

const npcs = [
  { x: 120, y: 100, radius: 16, color: '#8b9cff', role: 'crewmate', vx: 60, vy: 40, revealed: false, alive: true, targetTaskIndex: 0, taskProgress: 0, killTimer: 0 },
  { x: 690, y: 280, radius: 16, color: '#ffd166', role: 'crewmate', vx: -60, vy: 30, revealed: false, alive: true, targetTaskIndex: 1, taskProgress: 0, killTimer: 0 },
  { x: 500, y: 440, radius: 16, color: '#98fb98', role: 'crewmate', vx: 50, vy: -40, revealed: false, alive: true, targetTaskIndex: 2, taskProgress: 0, killTimer: 0 },
  { x: 260, y: 180, radius: 16, color: '#4fd1c5', role: 'crewmate', vx: 45, vy: -20, revealed: false, alive: true, targetTaskIndex: 3, taskProgress: 0, killTimer: 0 },
  { x: 600, y: 120, radius: 16, color: '#ff8f5b', role: 'crewmate', vx: -35, vy: 50, revealed: false, alive: true, targetTaskIndex: 4, taskProgress: 0, killTimer: 0 },
  { x: 340, y: 390, radius: 16, color: '#c48cff', role: 'crewmate', vx: 55, vy: -45, revealed: false, alive: true, targetTaskIndex: 5, taskProgress: 0, killTimer: 0 },
  { x: 760, y: 380, radius: 16, color: '#ff4d6d', role: 'impostor', vx: -70, vy: 25, revealed: false, alive: true, targetTaskIndex: -1, taskProgress: 0, killTimer: 4 },
];

function setStatus(message) {
  statusBox.textContent = message;
}

function updateTaskCounter() {
  taskCounter.textContent = `Görev: ${completedTasks}/${tasks.length}`;
}

function getNearbyTask() {
  for (const task of tasks) {
    if (task.completed) continue;
    const distance = Math.hypot(player.x - (task.x + task.w / 2), player.y - (task.y + task.h / 2));
    if (distance < 90) {
      return task;
    }
  }
  return null;
}

function refreshInteractionHint() {
  if (player.dead) {
    interactionTarget = null;
    useButton.classList.add('hidden');
    return;
  }

  const task = getNearbyTask();
  const nearEmergency = Math.hypot(player.x - emergencyButton.x, player.y - emergencyButton.y) < 90;

  if (task) {
    interactionTarget = task;
    useButton.classList.remove('hidden');
    useButton.textContent = isMobile ? 'Use' : 'E';
    if (lastHintTask !== task.label) {
      setStatus(`${task.label} için ${isMobile ? 'Use' : 'E'} ile aç.`);
      lastHintTask = task.label;
    }
    return;
  }

  if (nearEmergency) {
    interactionTarget = 'emergency';
    useButton.classList.remove('hidden');
    useButton.textContent = isMobile ? 'Use' : 'E';
    if (lastHintTask !== 'emergency') {
      setStatus(`Acil buton için ${isMobile ? 'Use' : 'E'} ile bas.`);
      lastHintTask = 'emergency';
    }
    return;
  }

  interactionTarget = null;
  useButton.classList.add('hidden');
  if (lastHintTask) {
    setStatus(`${playerName}, görevleri tamamla ve gemiyi kurtar.`);
    lastHintTask = null;
  }
}

function completeTask(task) {
  if (!task || task.completed) return;
  task.completed = true;
  task.progress = 100;
  completedTasks += 1;
  updateTaskCounter();
  setStatus(`${task.label} tamamlandı!`);
  if (completedTasks === tasks.length) {
    setStatus('Tüm görevler tamamlandı. Oyun kazandı!');
  }
}

function selectNextTask(npc) {
  const nextTask = tasks.find((task) => !task.completed);
  if (!nextTask) {
    npc.targetTaskIndex = -1;
    return;
  }

  npc.targetTaskIndex = tasks.indexOf(nextTask);
}

function killNpc(npc, reason = 'Bir karakter öldürüldü.') {
  npc.alive = false;
  npc.revealed = true;
  setStatus(reason);
}

function startGame() {
  const rawName = playerNameInput.value.trim();
  const normalizedName = rawName || 'Crewmate';
  playerName = normalizedName;
  playerTitleText = normalizedName.toLowerCase() === 'minoss' ? 'Ada Kurucu' : 'Crewmate';

  playerLabel.textContent = playerName;
  playerTitle.textContent = playerTitleText;
  setStatus(`${playerName}, görevleri tamamla ve impostoru bul.`);
  updateTaskCounter();

  startScreen.classList.add('hidden');
  gameWrap.classList.remove('hidden');

  if (!gameStarted) {
    gameStarted = true;
    lastTime = performance.now();
    animationFrameId = requestAnimationFrame(loop);
  }
}

function resetGame() {
  tasks.forEach((task) => {
    task.completed = false;
    task.progress = 0;
  });
  completedTasks = 0;
  emergencyActive = false;
  player.dead = false;
  playerGhost = false;
  updateTaskCounter();
  setStatus(`${playerName}, görevleri tamamla ve impostoru bul.`);
}

function loop(timestamp) {
  const delta = Math.min(0.03, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  update(delta);
  draw();
  animationFrameId = requestAnimationFrame(loop);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#07111d');
  gradient.addColorStop(0.6, '#11233d');
  gradient.addColorStop(1, '#0a1522');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 80; i += 1) {
    const x = (i * 97) % canvas.width;
    const y = (i * 53) % (canvas.height - 80);
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#8cc8ff';
    ctx.beginPath();
    ctx.arc(x, y + 20, i % 4 === 0 ? 1.4 : 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#14253b';
  ctx.fillRect(70, 60, 760, 420);
  ctx.fillStyle = '#20394f';
  ctx.fillRect(90, 80, 720, 380);

  ctx.strokeStyle = '#5c79b7';
  ctx.lineWidth = 2;
  ctx.strokeRect(70, 60, 760, 420);
  ctx.strokeRect(90, 80, 720, 380);

  ctx.fillStyle = '#4a647a';
  ctx.fillRect(70, 200, 30, 120);
  ctx.fillRect(800, 210, 30, 120);
  ctx.fillRect(430, 60, 40, 30);
  ctx.fillRect(430, 450, 40, 30);

  ctx.strokeStyle = '#7eb6ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(110, 110, 160, 110);
  ctx.strokeRect(310, 110, 160, 110);
  ctx.strokeRect(510, 110, 160, 110);
  ctx.strokeRect(710, 110, 80, 110);

  ctx.fillStyle = '#0f1d2d';
  ctx.fillRect(120, 320, 260, 100);
  ctx.fillRect(430, 320, 260, 100);

  ctx.fillStyle = '#6de0ff';
  ctx.fillRect(130, 330, 80, 80);
  ctx.fillRect(225, 330, 80, 80);
  ctx.fillRect(440, 330, 80, 80);
  ctx.fillRect(535, 330, 80, 80);
}

function drawCharacter(x, y, color, isPlayer = false, isGhost = false, isDead = false) {
  const bob = Math.sin(elapsed * 4 + x * 0.01) * 2.5;
  const bodyY = y + bob;

  ctx.save();
  ctx.translate(x, bodyY);
  ctx.shadowBlur = 16;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  if (isDead) ctx.globalAlpha = 0.45;
  if (isGhost) ctx.globalAlpha = 0.8;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -15, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(-14, -2, 28, 26);
  ctx.fillRect(-18, -2, 8, 20);
  ctx.fillRect(10, -2, 8, 20);

  ctx.fillStyle = '#dfefff';
  ctx.fillRect(-12, -12, 24, 10);
  ctx.fillStyle = '#4c8be4';
  ctx.fillRect(-10, -10, 20, 6);

  ctx.fillStyle = '#2a2f38';
  ctx.fillRect(-8, 24, 6, 18);
  ctx.fillRect(2, 24, 6, 18);

  ctx.fillStyle = isPlayer ? '#ffd166' : '#7cf4c6';
  ctx.fillRect(-13, 18, 26, 6);
  ctx.restore();
}

function drawTaskMarker(task) {
  const pulse = 1 + Math.sin(elapsed * 4 + task.x) * 0.08;
  ctx.save();
  ctx.translate(task.x + task.w / 2, task.y + task.h / 2);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = task.completed ? '#2e8b57' : task.color;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText(task.completed ? '✓' : '!', -4, 4);
  ctx.restore();

  if (!task.completed) {
    ctx.save();
    ctx.strokeStyle = '#7eb6ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(task.x + task.w / 2, task.y + task.h / 2, 34, -Math.PI / 2, -Math.PI / 2 + (task.progress / 100) * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function update(delta) {
  if (!player.dead) {
    let dx = 0;
    let dy = 0;

    if (keys['arrowup'] || keys['w']) dy -= 1;
    if (keys['arrowdown'] || keys['s']) dy += 1;
    if (keys['arrowleft'] || keys['a']) dx -= 1;
    if (keys['arrowright'] || keys['d']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      player.x += dx * player.speed * delta;
      player.y += dy * player.speed * delta;
    }

    player.x = Math.max(36, Math.min(canvas.width - 36, player.x));
    player.y = Math.max(36, Math.min(canvas.height - 36, player.y));
  } else {
    playerGhost = true;
    let dx = 0;
    let dy = 0;

    if (keys['arrowup'] || keys['w']) dy -= 1;
    if (keys['arrowdown'] || keys['s']) dy += 1;
    if (keys['arrowleft'] || keys['a']) dx -= 1;
    if (keys['arrowright'] || keys['d']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      player.x += dx * 180 * delta;
      player.y += dy * 180 * delta;
    }

    player.x = Math.max(36, Math.min(canvas.width - 36, player.x));
    player.y = Math.max(36, Math.min(canvas.height - 36, player.y));
  }

  for (const npc of npcs) {
    if (!npc.alive) continue;

    if (npc.role === 'impostor') {
      npc.x += Math.sin(elapsed + npc.x * 0.01) * 48 * delta;
      npc.y += Math.cos(elapsed * 0.9 + npc.y * 0.01) * 42 * delta;
      npc.x = Math.max(40, Math.min(canvas.width - 40, npc.x));
      npc.y = Math.max(40, Math.min(canvas.height - 40, npc.y));

      npc.killTimer -= delta;
      if (npc.killTimer <= 0) {
        const killTargets = [];
        for (const crewmate of npcs.filter((entry) => entry.role === 'crewmate' && entry.alive)) {
          const distance = Math.hypot(player.x - crewmate.x, player.y - crewmate.y);
          if (distance < 110) {
            killTargets.push(crewmate);
          }
        }

        const targetsToKill = killTargets.slice(0, 3);
        if (targetsToKill.length > 0) {
          targetsToKill.forEach((target) => killNpc(target, 'İmpostor bir crewmate öldürdü!'));
          setStatus('İmpostor bir turda 3 kişiyi öldürdü!');
        }
        npc.killTimer = 6;
      }

      if (!player.dead) {
        const distanceToPlayer = Math.hypot(player.x - npc.x, player.y - npc.y);
        if (distanceToPlayer < 70) {
          player.dead = true;
          playerGhost = true;
          setStatus('İmpostor seni öldürdü. Hayalet olarak başkalarını izle.');
        }
      }
      continue;
    }

    const task = tasks[npc.targetTaskIndex];
    if (!task || task.completed) {
      selectNextTask(npc);
      continue;
    }

    const targetX = task.x + task.w / 2;
    const targetY = task.y + task.h / 2;
    const dx = targetX - npc.x;
    const dy = targetY - npc.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 18) {
      npc.x += (dx / (distance || 1)) * npc.radius * delta * 2.2;
      npc.y += (dy / (distance || 1)) * npc.radius * delta * 2.2;
    } else {
      task.progress = Math.min(100, task.progress + delta * 55);
      npc.taskProgress += delta * 55;
      if (task.progress >= 100) {
        task.completed = true;
        completedTasks += 1;
        updateTaskCounter();
        setStatus(`${task.label} tamamlandı. Crewmen görevini bitirdi.`);
        if (completedTasks === tasks.length) {
          setStatus('Tüm görevler tamamlandı. Oyun kazandı!');
        }
        selectNextTask(npc);
      }
    }

    npc.x = Math.max(40, Math.min(canvas.width - 40, npc.x));
    npc.y = Math.max(40, Math.min(canvas.height - 40, npc.y));

    const distanceToPlayer = Math.hypot(player.x - npc.x, player.y - npc.y);
    if (distanceToPlayer < 220) {
      npc.revealed = true;
    }
  }

  if (spaceQueued) {
    interact();
    spaceQueued = false;
  }

  refreshInteractionHint();
  elapsed += delta;
}

function interact() {
  if (player.dead) return;

  if (interactionTarget === 'emergency') {
    emergencyActive = true;
    setStatus('Acil toplantı başlatıldı. Görevleri tamamlamaya devam et!');
    return;
  }

  if (interactionTarget) {
    completeTask(interactionTarget);
    return;
  }

  const nearbyNpc = npcs.find((npc) => npc.alive && Math.hypot(player.x - npc.x, player.y - npc.y) < 70);
  if (nearbyNpc) {
    killNpc(nearbyNpc, nearbyNpc.role === 'impostor' ? 'İmpostor öldürüldü!' : 'Bir crewmate öldürüldü!');
    return;
  }

  const buttonDistance = Math.hypot(player.x - emergencyButton.x, player.y - emergencyButton.y);
  if (buttonDistance < 70) {
    emergencyActive = true;
    setStatus('Acil toplantı başlatıldı. Görevleri tamamlamaya devam et!');
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  tasks.forEach((task) => {
    drawTaskMarker(task);
  });

  ctx.beginPath();
  ctx.arc(emergencyButton.x, emergencyButton.y, emergencyButton.radius, 0, Math.PI * 2);
  ctx.fillStyle = emergencyActive ? '#ff4d4d' : '#d9534f';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText('Acil', emergencyButton.x - 16, emergencyButton.y + 4);

  for (const npc of npcs) {
    if (!npc.alive) continue;
    if (npc.revealed || npc.role === 'impostor') {
      drawCharacter(npc.x, npc.y, npc.color, false, false, false);
    }
  }

  if (player.dead) {
    drawCharacter(player.x, player.y, '#9ed6ff', true, true, false);
  } else {
    drawCharacter(player.x, player.y, playerTitleText === 'Ada Kurucu' ? '#ffd166' : '#4cb0ff', true, false, false);
  }
}

startButton.addEventListener('click', startGame);
playerNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    startGame();
  }
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'e'].includes(key)) {
    event.preventDefault();
  }

  keys[key] = true;
  if (key === 'e') {
    interact();
    return;
  }
  if (event.code === 'Space') {
    spaceQueued = true;
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
  if (event.code === 'Space') {
    spaceQueued = false;
  }
});

useButton.addEventListener('click', () => {
  interact();
});

updateTaskCounter();
