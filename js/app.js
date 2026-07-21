const WEBHOOK_URL = "";
const CALENDLY_URL = "https://calendly.com/elenaakage/30min";

const REWARDS = [
  {
    id: "cardenal",
    icon: "🍽️",
    label: "Comer en El Cardenal de Toledo",
    image: "assets/img/el-cardenal.jpg",
  },
  {
    id: "lazos",
    icon: "✂️",
    label: "Corte de lazos",
    image: "assets/img/corte-lazos.webp",
  },
  {
    id: "spa",
    icon: "🧖",
    label: "Dia de spa y relax",
    image: "assets/img/spa.jpeg",
  },
  {
    id: "bubari",
    icon: "🍜",
    label: "Comida o cena en Bubari",
    image: "assets/img/bubari.png",
  },
  {
    id: "a-tu-gusto",
    icon: "🌸",
    label: "Algo que te apetezca a ti",
    image: "",
  },
];

const RIBBON_COLORS = ["#ff6fa8", "#ffa149", "#66d6a4", "#9d7bff"];

const state = {
  isChoiceLocked: false,
  selectedReward: null,
  isTouchMode: false,
  previewIndex: null,
};

const screens = {
  one: document.getElementById("screen1"),
  two: document.getElementById("screen2"),
  three: document.getElementById("screen3"),
};

const duckCursor = document.getElementById("duckCursor");
const burstLayer = document.getElementById("duckBurstLayer");
const openGiftBtn = document.getElementById("openGiftBtn");
const choiceGrid = document.getElementById("choiceGrid");
const choiceMessage = document.getElementById("choiceMessage");
const interactionHint = document.getElementById("interactionHint");
const calendlyFrame = document.getElementById("calendlyFrame");
const selectedChoiceField = document.getElementById("selectedChoiceField");

let audioContext = null;
let fleeTimer = null;

function init() {
  detectInteractionMode();
  initCursor();
  renderChoiceBoxes();
  initEvents();
  initCalendly();
}

function initEvents() {
  openGiftBtn.addEventListener("click", () => {
    pulseDuckCursor();
    playQuack();
    switchScreen(screens.two);
  });

  document.addEventListener("pointerdown", (event) => {
    if (!state.isTouchMode || state.previewIndex === null) {
      return;
    }

    if (!event.target.closest(".choice-box")) {
      clearTouchPreview();
    }
  });
}

function detectInteractionMode() {
  state.isTouchMode = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  document.body.classList.toggle("touch-mode", state.isTouchMode);
  updateInteractionHint();
}

function updateInteractionHint() {
  if (!interactionHint) {
    return;
  }

  if (state.isTouchMode) {
    interactionHint.textContent =
      "En movil: toca una carta para ver el preview y vuelve a tocar para seleccionarla.";
    interactionHint.classList.remove("d-none");
    return;
  }

  interactionHint.classList.add("d-none");
}

function initCalendly() {
  calendlyFrame.src = CALENDLY_URL;
}

function buildCalendlyUrl(reward) {
  const url = new URL(CALENDLY_URL);

  if (reward?.label) {
    // Calendly custom question prefill (a1 = primera pregunta personalizada)
    url.searchParams.set("a1", reward.label);
  }

  return url.toString();
}

function prepareCalendlySelection(reward) {
  const choiceText = reward?.label || "Sin seleccionar";
  selectedChoiceField.value = choiceText;
  calendlyFrame.src = buildCalendlyUrl(reward);
}

function initCursor() {
  window.addEventListener("mousemove", (event) => {
    duckCursor.style.left = `${event.clientX}px`;
    duckCursor.style.top = `${event.clientY}px`;
  });

  window.addEventListener("mousedown", () => {
    pulseDuckCursor();
  });
}

function pulseDuckCursor() {
  duckCursor.classList.remove("pulse");
  requestAnimationFrame(() => duckCursor.classList.add("pulse"));
}

function switchScreen(nextScreen) {
  Object.values(screens).forEach((screen) => {
    screen.classList.remove("active");
  });

  nextScreen.classList.add("active");
}

function renderChoiceBoxes() {
  const hintText = state.isTouchMode ? "Toca para descubrir" : "Pasa el cursor";

  const boxHtml = REWARDS.map((reward, index) => {
    const color = RIBBON_COLORS[index % RIBBON_COLORS.length];

    return `
      <button class="choice-box tarot-choice" data-index="${index}" aria-label="Carta tarot ${index + 1}">
        <div class="tarot-card">
          <div class="tarot-face tarot-front" style="--tarot-accent:${color}">
            <div class="tarot-glyph">✦</div>
            <div class="tarot-title">Opcion ${index + 1}</div>
            <div class="tarot-subtitle">${hintText}</div>
          </div>
          <div class="tarot-face tarot-back">
            <div class="choice-reward">
              ${reward.image
                ? `
                  <img class="choice-reward-image" src="${reward.image}" alt="${reward.label}" />
                  <span class="choice-reward-label">${reward.label}</span>
                `
                : `
                  <div class="choice-reward-plain">
                    <span class="choice-reward-plain-icon">${reward.icon}</span>
                    <span class="choice-reward-label">${reward.label}</span>
                  </div>
                `}
            </div>
          </div>
        </div>
      </button>
    `;
  }).join("");

  choiceGrid.innerHTML = boxHtml;

  choiceGrid.querySelectorAll(".choice-box").forEach((box, index) => {
    box.addEventListener("pointerdown", (event) => {
      if (!state.isTouchMode) {
        moveOtherBoxes(index, event.clientX, event.clientY);
      }
    });

    box.addEventListener("click", async (event) => {
      event.preventDefault();

      if (state.isTouchMode && !box.classList.contains("preview") && !state.isChoiceLocked) {
        clearTouchPreview();
        box.classList.add("preview");
        state.previewIndex = index;
        return;
      }

      pulseDuckCursor();
      playQuack();
      await handleChoice(index);
    });
  });
}

function clearTouchPreview() {
  choiceGrid.querySelectorAll(".choice-box.preview").forEach((box) => {
    box.classList.remove("preview");
  });
  state.previewIndex = null;
}

async function handleChoice(index) {
  if (state.isChoiceLocked) {
    return;
  }

  await revealRealChoice(index);
}

async function revealRealChoice(index) {
  state.isChoiceLocked = true;
  clearTouchPreview();

  const boxes = [...choiceGrid.querySelectorAll(".choice-box")];
  const selected = boxes[index];
  const reward = REWARDS[index];

  boxes.forEach((box, idx) => {
    if (idx !== index) {
      box.classList.add("hidden");
    }
  });

  await sleep(240);
  choiceGrid.classList.add("focused");
  selected.classList.add("opened", "selected", "zoom-center");
  createDuckBurst(selected, 100);
  setTimeout(() => {
    selected.classList.add("final-picked");
  }, 420);

  state.selectedReward = reward;
  sendChoice(reward.id);

  choiceMessage.innerHTML = `
    <p class="mb-3"><strong>Perfecto.</strong><br />Ahora solo queda encontrar un dia para disfrutarlo juntas.</p>
    <button id="openCalendlyBtn" class="btn btn-main">Reservar dia</button>
  `;

  const openCalendlyBtn = document.getElementById("openCalendlyBtn");
  openCalendlyBtn.addEventListener("click", () => {
    pulseDuckCursor();
    playQuack();
    prepareCalendlySelection(reward);
    switchScreen(screens.three);
  });
}

function moveOtherBoxes(activeIndex, x, y) {
  const boxes = [...choiceGrid.querySelectorAll(".choice-box")];

  boxes.forEach((box, index) => {
    if (index === activeIndex || box.classList.contains("hidden")) {
      return;
    }

    const rect = box.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = centerX - x;
    const dy = centerY - y;
    const length = Math.hypot(dx, dy) || 1;

    const offset = 22;
    const moveX = (dx / length) * offset;
    const moveY = (dy / length) * offset;

    box.style.setProperty("--dx", `${moveX}px`);
    box.style.setProperty("--dy", `${moveY}px`);
    box.classList.add("fleeing");
  });

  clearTimeout(fleeTimer);
  fleeTimer = setTimeout(() => {
    boxes.forEach((box) => {
      box.classList.remove("fleeing");
      box.style.removeProperty("--dx");
      box.style.removeProperty("--dy");
    });
  }, 1000);
}

function createDuckBurst(target, count = 100) {
  const rect = target.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  for (let i = 0; i < count; i += 1) {
    const duck = document.createElement("img");
    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 340;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance + 40 + Math.random() * 120;

    duck.className = "duck-particle duck-particle-img";
    duck.src = "assets/icons/duck-cursor.svg";
    duck.alt = "";
    duck.style.left = `${originX}px`;
    duck.style.top = `${originY}px`;
    duck.style.setProperty("--tx", `${tx}px`);
    duck.style.setProperty("--ty", `${ty}px`);
    duck.style.setProperty("--rot", `${(Math.random() * 720 - 360).toFixed(1)}deg`);
    duck.style.setProperty("--dur", `${900 + Math.random() * 700}ms`);
    duck.style.setProperty("--size", `${16 + Math.random() * 20}px`);

    burstLayer.appendChild(duck);
    setTimeout(() => duck.remove(), 1800);
  }
}

async function sendChoice(choice) {
  if (!WEBHOOK_URL) {
    return;
  }

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        choice,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("No se pudo enviar la eleccion al webhook:", error);
  }
}

function playQuack() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) {
    return;
  }

  if (!audioContext) {
    audioContext = new Context();
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(520, now);
  oscillator.frequency.exponentialRampToValueAtTime(260, now + 0.12);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1200, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.035, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.22);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

init();
