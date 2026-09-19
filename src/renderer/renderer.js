const character = document.querySelector('#character');
const desktopPetRoot = document.querySelector('#desktopPet');
const panel = document.querySelector('#panel');
const speech = document.querySelector('#speech');
const quote = document.querySelector('#quote');
const updateStatus = document.querySelector('#updateStatus');
const versionLabel = document.querySelector('#versionLabel');
const statusText = document.querySelector('#statusText');
const sleepButton = document.querySelector('[data-action="manual-sleep"]');
const eatButton = document.querySelector('[data-action="manual-eat"]');
const sizeDownButton = document.querySelector('[data-action="size-down"]');
const sizeUpButton = document.querySelector('[data-action="size-up"]');
const sizeLabel = document.querySelector('#sizeLabel');

const lines = [
  '今天也要好好吃饭。',
  '这段旋律……你觉得怎么样？',
  '稍微休息一下，再继续写歌吧。',
  '谢谢你陪在这里。'
];

let speechTimer;
let dragging = false;
let moved = false;
let lastPoint = null;
let idleTimer;
let idleAction = null;
let manualAction = null;
let idleFrameTimers = [];
let idleLoopTimer;
const petSizes = [170, 210, 260];
const petSizeLabels = ['小', '标准', '大'];
let petSizeIndex = Number.parseInt(localStorage.getItem('kanadePetSize') || '1', 10);
if (!Number.isInteger(petSizeIndex) || petSizeIndex < 0 || petSizeIndex >= petSizes.length) petSizeIndex = 1;

function applyPetSize() {
  const size = petSizes[petSizeIndex];
  desktopPetRoot.style.setProperty('--pet-size', `${size}px`);
  desktopPetRoot.style.setProperty('--name-tag-right', `${12 + (size - 100) / 2}px`);
  sizeLabel.textContent = petSizeLabels[petSizeIndex];
  sizeDownButton.disabled = petSizeIndex === 0;
  sizeUpButton.disabled = petSizeIndex === petSizes.length - 1;
  localStorage.setItem('kanadePetSize', String(petSizeIndex));
}

function updateManualButtons() {
  sleepButton.textContent = manualAction === 'sleep' ? '停止睡觉' : '睡觉';
  eatButton.textContent = manualAction === 'eat' ? '停止吃饭' : '吃饭';
  sleepButton.classList.toggle('active', manualAction === 'sleep');
  eatButton.classList.toggle('active', manualAction === 'eat');
  sleepButton.disabled = manualAction === 'eat';
  eatButton.disabled = manualAction === 'sleep';
}

function clearIdleSequence() {
  idleFrameTimers.forEach((timer) => clearTimeout(timer));
  idleFrameTimers = [];
  clearInterval(idleLoopTimer);
  idleLoopTimer = null;
  character.classList.remove('idle-sequence-complete');
  character.querySelectorAll('.idle-frame').forEach((frame) => frame.classList.remove('active'));
}

function showIdleFrame(group, frameNumber) {
  character.querySelectorAll(`.${group}-frame`).forEach((frame) => {
    frame.classList.toggle('active', frame.dataset.frame === String(frameNumber));
  });
}

function startIdleSequence(action) {
  clearIdleSequence();
  const group = action === 'sleep' ? 'idle-sleep' : 'idle-eat';
  showIdleFrame(group, 1);
  idleFrameTimers.push(setTimeout(() => showIdleFrame(group, 2), 620));
  idleFrameTimers.push(setTimeout(() => {
    showIdleFrame(group, 3);
    character.classList.add('idle-sequence-complete');
    if (action === 'eat') {
      let eatingFrame = 3;
      idleLoopTimer = setInterval(() => {
        eatingFrame = eatingFrame === 3 ? 2 : 3;
        showIdleFrame(group, eatingFrame);
      }, 520);
    }
  }, 1240));
}

function exitIdleAction(force = false) {
  if (!idleAction) return;
  if (manualAction && !force) return;
  clearIdleSequence();
  idleAction = null;
  manualAction = null;
  character.classList.remove('idle-sleep', 'idle-eat');
  statusText.textContent = '正在创作中';
  character.classList.add('waking');
  setTimeout(() => character.classList.remove('waking'), 460);
  updateManualButtons();
}

function enterAction(action, manual = false) {
  clearTimeout(idleTimer);
  if (idleAction) exitIdleAction(true);
  idleAction = action;
  manualAction = manual ? action : null;
  character.classList.remove('blink', 'reacting', 'landing', 'waking');
  character.classList.add(action === 'sleep' ? 'idle-sleep' : 'idle-eat');
  startIdleSequence(action);
  statusText.textContent = action === 'sleep' ? '盖着被子睡觉中' : '正在吃合味道杯面';
  quote.textContent = action === 'sleep'
    ? '“稍微睡一会儿……晚安。”'
    : '“合味道……果然很好吃。”';
  updateManualButtons();
}

function scheduleIdleAction() {
  clearTimeout(idleTimer);
  if (manualAction) return;
  idleTimer = setTimeout(() => {
    if (dragging || panel.classList.contains('open')) {
      scheduleIdleAction();
      return;
    }
    enterAction(Math.random() < 0.5 ? 'sleep' : 'eat');
  }, 5000);
}

function markActivity() {
  if (manualAction) {
    clearTimeout(idleTimer);
    return;
  }
  exitIdleAction();
  scheduleIdleAction();
}

function blink() {
  if (!character.classList.contains('sleeping') && !idleAction) {
    character.classList.add('blink');
    setTimeout(() => character.classList.remove('blink'), 170);
  }
  setTimeout(blink, 2600 + Math.random() * 4300);
}

function say(text = lines[Math.floor(Math.random() * lines.length)]) {
  clearTimeout(speechTimer);
  speech.textContent = text;
  speech.classList.add('show');
  quote.textContent = `“${text}”`;
  speechTimer = setTimeout(() => speech.classList.remove('show'), 3200);
}

function react() {
  character.classList.remove('reacting');
  void character.offsetWidth;
  character.classList.add('reacting');
  setTimeout(() => character.classList.remove('reacting'), 600);
  say();
}

function setPanel(open) {
  panel.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
}

character.addEventListener('pointerdown', (event) => {
  markActivity();
  dragging = true;
  moved = false;
  lastPoint = { x: event.screenX, y: event.screenY };
  character.classList.remove('landing', 'reacting', 'blink', 'waking');
  character.style.setProperty('--drag-tilt', '0deg');
  character.classList.add('dragging');
  character.setPointerCapture(event.pointerId);
});

character.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  scheduleIdleAction();
  const dx = event.screenX - lastPoint.x;
  const dy = event.screenY - lastPoint.y;
  if (Math.abs(dx) + Math.abs(dy) > 1) {
    moved = true;
    const tilt = Math.max(-7, Math.min(7, dx * 0.85));
    character.style.setProperty('--drag-tilt', `${tilt}deg`);
    window.desktopPet.moveWindow(dx, dy);
    lastPoint = { x: event.screenX, y: event.screenY };
  }
});

character.addEventListener('pointerup', () => {
  dragging = false;
  character.classList.remove('dragging');
  character.style.setProperty('--drag-tilt', '0deg');
  if (moved) {
    character.classList.add('landing');
    setTimeout(() => character.classList.remove('landing'), 520);
  }
  if (!moved) react();
});

character.addEventListener('pointercancel', () => {
  dragging = false;
  character.classList.remove('dragging');
  character.style.setProperty('--drag-tilt', '0deg');
});

character.addEventListener('dblclick', () => setPanel(true));
document.querySelector('#openPanel').addEventListener('click', () => {
  setPanel(true);
  scheduleIdleAction();
});
document.querySelector('#closePanel').addEventListener('click', () => {
  setPanel(false);
  scheduleIdleAction();
});
document.querySelector('#quit').addEventListener('click', () => window.desktopPet.quit());

document.querySelector('[data-action="talk"]').addEventListener('click', () => say());
sleepButton.addEventListener('click', () => {
  if (manualAction === 'sleep') {
    exitIdleAction(true);
    scheduleIdleAction();
    return;
  }
  enterAction('sleep', true);
});
eatButton.addEventListener('click', () => {
  if (manualAction === 'eat') {
    exitIdleAction(true);
    scheduleIdleAction();
    return;
  }
  enterAction('eat', true);
});
sizeDownButton.addEventListener('click', () => {
  if (petSizeIndex === 0) return;
  petSizeIndex -= 1;
  applyPetSize();
});
sizeUpButton.addEventListener('click', () => {
  if (petSizeIndex === petSizes.length - 1) return;
  petSizeIndex += 1;
  applyPetSize();
});

document.querySelector('[data-action="update"]').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = '正在选择安装包…';
  updateStatus.className = 'update-status';
  updateStatus.textContent = '';
  try {
    const result = await window.desktopPet.selectLocalUpdate();
    if (result.status === 'opened') {
      updateStatus.classList.add('success');
      updateStatus.textContent = `已打开 ${result.version} 安装镜像，请完成替换安装。`;
    } else if (result.status !== 'canceled') {
      updateStatus.classList.add('error');
      updateStatus.textContent = result.message || '未能打开更新安装包。';
    }
  } catch (error) {
    updateStatus.classList.add('error');
    updateStatus.textContent = '检查更新时出现错误。';
  } finally {
    button.disabled = false;
    button.textContent = '安装本地更新';
  }
});

window.desktopPet.getAppInfo().then(({ version, packaged }) => {
  versionLabel.textContent = `v${version}${packaged ? '' : ' · 开发模式'}`;
});

document.addEventListener('pointerdown', markActivity, { capture: true });
document.addEventListener('pointermove', markActivity, { passive: true });

applyPetSize();
updateManualButtons();
setTimeout(blink, 1200);
setTimeout(() => say('你好，我是宵崎奏。'), 900);
scheduleIdleAction();
