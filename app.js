import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDwO-LeNjEBHzK5NHJlR0fPDNTXXTdHlSM',
  authDomain: 'sport-calendar-ac287.firebaseapp.com',
  projectId: 'sport-calendar-ac287',
  storageBucket: 'sport-calendar-ac287.firebasestorage.app',
  messagingSenderId: '448585132425',
  appId: '1:448585132425:web:6fde5614752076ab2b5958',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const sports = [
  {
    id: 'judo',
    name: 'Judo',
    icon: '🥋',
    color: 'linear-gradient(135deg, #7b5cff, #5a3bff)',
    variations: ['Ne-waza', 'Randori', 'Technique', 'Kumi-kata', 'Conditioning'],
  },
  {
    id: 'jjb',
    name: 'Jiu-Jitsu Brésilien',
    icon: '🥋',
    color: 'linear-gradient(135deg, #5af8b9, #2ec4a3)',
    variations: ['Drill', 'Sparring', 'Passages de garde', 'Soumissions', 'Escapes'],
  },
  {
    id: 'strength',
    name: 'Musculation',
    icon: '🏋️',
    color: 'linear-gradient(135deg, #ff6b6b, #ff8e53)',
    variations: ['Force', 'Hypertrophie', 'Full body', 'Push/Pull', 'Core'],
  },
  {
    id: 'yoga',
    name: 'Yoga',
    icon: '🧘',
    color: 'linear-gradient(135deg, #26d4ff, #84f2ff)',
    variations: ['Vinyasa', 'Hatha', 'Yin', 'Power', 'Respiration'],
  },
  {
    id: 'stretch',
    name: 'Stretching',
    icon: '🤸',
    color: 'linear-gradient(135deg, #ffb36b, #ffd56b)',
    variations: ['Mobilité', 'Souplesse', 'Recovery', 'Full body'],
  },
  {
    id: 'cardio',
    name: 'Cardio',
    icon: '🏃',
    color: 'linear-gradient(135deg, #00f2fe, #4facfe)',
    variations: ['HIIT', 'Endurance', 'Fractionné', 'Cyclisme', 'Course'],
  },
];

const intensityOptions = ['Relax', 'Modérée', 'Soutenue', 'Intense', 'Max'];
const feelingOptions = ['En pleine forme', 'Focus', 'Fatigué', 'Blessé', 'Flow'];

const authView = document.getElementById('auth-view');
const dashboard = document.getElementById('dashboard');
const sportsList = document.getElementById('sports-list');
const calendarGrid = document.getElementById('calendar-grid');
const currentWeekLabel = document.getElementById('current-week');
const currentMonthLabel = document.getElementById('current-month');
const weekStartSelect = document.getElementById('week-start');
const aiPanel = document.getElementById('ai-panel');
const aiMessages = document.getElementById('ai-messages');
const aiForm = document.getElementById('ai-form');
const aiInput = document.getElementById('ai-input');
const aiSuggestion = document.getElementById('ai-suggestion');

let currentUser = null;
let startDay = Number(weekStartSelect.value);
let selectedWeekStart = getStartOfWeek(new Date(), startDay);
let unsubscribeSessions = null;
let slotHeight = 28;
let sessionsCache = [];

function toDateTimeLocalValue(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function renderSports() {
  sportsList.innerHTML = '';
  sports.forEach((sport) => {
    const pill = document.createElement('div');
    pill.className = 'sport-pill';
    pill.draggable = true;
    pill.dataset.sportId = sport.id;
    pill.innerHTML = `
      <div class="sport-icon" style="background:${sport.color}">${sport.icon}</div>
      <div class="sport-info">
        <h3>${sport.name}</h3>
        <p>${sport.variations[0]}</p>
      </div>
    `;

    pill.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', sport.id);
      event.dataTransfer.effectAllowed = 'copy';
    });

    sportsList.appendChild(pill);
  });
}

function getStartOfWeek(date, startOfWeek = 1) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day < startOfWeek ? day + 7 : day) - startOfWeek;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function renderCalendar() {
  calendarGrid.innerHTML = '';
  const headerRow = document.createElement('div');
  headerRow.className = 'calendar-header-row';

  const empty = document.createElement('div');
  empty.className = 'calendar-header-cell';
  headerRow.appendChild(empty);

  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const dayDate = new Date(selectedWeekStart);
    dayDate.setDate(dayDate.getDate() + i);
    days.push(dayDate);
    const cell = document.createElement('div');
    cell.className = 'calendar-header-cell';
    const formatted = dayDate.toLocaleDateString('fr-FR', {
      weekday: 'short',
    });
    cell.innerHTML = `<strong>${dayDate.getDate()}</strong>${formatted}`;
    headerRow.appendChild(cell);
  }

  calendarGrid.appendChild(headerRow);

  const body = document.createElement('div');
  body.className = 'calendar-body';

  for (let slot = 0; slot < 96; slot += 1) {
    const row = document.createElement('div');
    row.className = 'time-row';

    const timeCell = document.createElement('div');
    timeCell.className = 'time-cell';
    const hours = Math.floor(slot / 4);
    const minutes = (slot % 4) * 15;
    const label = `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;
    timeCell.textContent = label;
    row.appendChild(timeCell);

    days.forEach((dayDate, dayIndex) => {
      const dropCell = document.createElement('div');
      dropCell.className = 'drop-cell';
      dropCell.dataset.slot = slot;
      dropCell.dataset.dayIndex = dayIndex;
      dropCell.dataset.datetime = new Date(
        dayDate.getFullYear(),
        dayDate.getMonth(),
        dayDate.getDate(),
        hours,
        minutes,
      ).toISOString();

      dropCell.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropCell.classList.add('highlight');
      });

      dropCell.addEventListener('dragleave', () => {
        dropCell.classList.remove('highlight');
      });

      dropCell.addEventListener('drop', (event) => {
        event.preventDefault();
        dropCell.classList.remove('highlight');
        const sportId = event.dataTransfer.getData('text/plain');
        const sport = sports.find((item) => item.id === sportId);
        if (!sport) return;
        openSessionModal({
          sportId,
          start: dropCell.dataset.datetime,
        });
      });

      row.appendChild(dropCell);
    });

    body.appendChild(row);
  }

  calendarGrid.appendChild(body);
  requestAnimationFrame(() => {
    slotHeight = calendarGrid.querySelector('.drop-cell')?.offsetHeight || 28;
    renderSessions();
  });

  updatePeriodLabels(days);
}

function updatePeriodLabels(days) {
  const weekStart = days[0];
  const weekEnd = days[6];
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  const weekLabel = `${weekStart.getDate()} ${weekStart.toLocaleDateString('fr-FR', {
    month: 'short',
  })} – ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('fr-FR', {
    month: 'short',
  })}`;
  currentWeekLabel.textContent = weekLabel;
  currentMonthLabel.textContent = formatter.format(weekStart);
}

function populateSelect(select, options) {
  select.innerHTML = '';
  options.forEach((option) => {
    const element = document.createElement('option');
    element.value = option;
    element.textContent = option;
    select.appendChild(element);
  });
}

function populateChips(container, options) {
  container.innerHTML = '';
  options.forEach((option) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = option;
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
    });
    container.appendChild(chip);
  });
}

const sessionSportSelect = document.getElementById('session-sport');
const sessionVariationSelect = document.getElementById('session-variation');
const sessionStartInput = document.getElementById('session-start');
const sessionDurationInput = document.getElementById('session-duration');
const intensityContainer = document.getElementById('intensity-tags');
const feelingContainer = document.getElementById('feeling-tags');
const sessionModal = document.getElementById('session-modal');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalIcon = document.getElementById('modal-icon');
const closeModalButton = document.getElementById('close-modal');
const aiSuggestButton = document.getElementById('ai-suggest');

populateSelect(sessionSportSelect, sports.map((sport) => sport.name));
populateChips(intensityContainer, intensityOptions);
populateChips(feelingContainer, feelingOptions);
updateModalForSport(sports[0]);

sessionSportSelect.addEventListener('change', () => {
  const sport = sports.find((item) => item.name === sessionSportSelect.value);
  updateModalForSport(sport || sports[0]);
});

function updateModalForSport(sport) {
  sessionVariationSelect.innerHTML = '';
  sport.variations.forEach((variation) => {
    const option = document.createElement('option');
    option.value = variation;
    option.textContent = variation;
    sessionVariationSelect.appendChild(option);
  });
  modalIcon.textContent = sport.icon;
  modalTitle.textContent = `${sport.name}`;
}

function openSessionModal({ sportId, start }) {
  const sport = sports.find((item) => item.id === sportId) || sports[0];
  sessionSportSelect.value = sport.name;
  updateModalForSport(sport);
  sessionVariationSelect.value = sport.variations[0];
  sessionStartInput.value = toDateTimeLocalValue(new Date(start));
  sessionDurationInput.value = 60;
  modalSubtitle.textContent = new Date(start).toLocaleString('fr-FR', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  intensityContainer.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('selected'));
  feelingContainer.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('selected'));
  aiSuggestion.classList.add('hidden');
  aiSuggestion.textContent = '';
  sessionModal.classList.remove('hidden');
}

function closeSessionModal() {
  sessionModal.classList.add('hidden');
}

closeModalButton.addEventListener('click', closeSessionModal);
sessionModal.addEventListener('click', (event) => {
  if (event.target === sessionModal) {
    closeSessionModal();
  }
});

async function saveSession(event) {
  event.preventDefault();
  if (!currentUser) return;

  const sport = sports.find((item) => item.name === sessionSportSelect.value);
  const status = document.querySelector('input[name="session-status"]:checked').value;
  const startDate = new Date(sessionStartInput.value);
  const duration = Number(sessionDurationInput.value) || 60;
  const intensity = Array.from(intensityContainer.querySelectorAll('.chip.selected')).map(
    (chip) => chip.textContent,
  );
  const feelings = Array.from(feelingContainer.querySelectorAll('.chip.selected')).map(
    (chip) => chip.textContent,
  );

  const payload = {
    userId: currentUser.uid,
    sportId: sport.id,
    sportName: sport.name,
    variation: sessionVariationSelect.value,
    start: startDate.toISOString(),
    duration,
    intensity,
    feelings,
    status,
    createdAt: serverTimestamp(),
  };

  try {
    await addDoc(collection(db, 'sessions'), payload);
    closeSessionModal();
  } catch (error) {
    console.error(error);
    alert("Impossible d'enregistrer la séance. Réessaie plus tard.");
  }
}

document.getElementById('session-form').addEventListener('submit', saveSession);

function renderSessions() {
  calendarGrid.querySelectorAll('.session-block').forEach((block) => block.remove());
  sessionsCache.forEach((session) => {
    const startDate = new Date(session.start);
    const dayIndex = Math.floor((startDate - selectedWeekStart) / (1000 * 60 * 60 * 24));
    if (dayIndex < 0 || dayIndex > 6) return;
    const startSlot = startDate.getHours() * 4 + Math.floor(startDate.getMinutes() / 15);
    const slots = Math.max(1, Math.round(session.duration / 15));
    const targetCell = calendarGrid.querySelector(
      `.drop-cell[data-day-index="${dayIndex}"][data-slot="${startSlot}"]`,
    );
    if (!targetCell) return;

    const block = document.createElement('div');
    block.className = `session-block ${session.status === 'completed' ? 'completed' : 'planned'}`;
    block.style.height = `${slots * slotHeight - 8}px`;
    block.style.background = session.status === 'completed'
      ? 'linear-gradient(135deg, rgba(68, 255, 161, 0.85), rgba(32, 201, 151, 0.95))'
      : 'linear-gradient(135deg, rgba(123, 92, 255, 0.8), rgba(38, 212, 255, 0.9))';
    block.innerHTML = `
      <strong>${session.sportName}</strong>
      <span>${session.variation}</span>
      <div class="session-meta">
        <span>${new Date(session.start).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })}</span>
        <span>${session.duration} min</span>
      </div>
    `;
    targetCell.appendChild(block);
  });
}

function subscribeToSessions() {
  if (!currentUser) return;
  if (unsubscribeSessions) unsubscribeSessions();

  const weekEnd = new Date(selectedWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const sessionsQuery = query(
    collection(db, 'sessions'),
    where('userId', '==', currentUser.uid),
    where('start', '>=', selectedWeekStart.toISOString()),
    where('start', '<', weekEnd.toISOString()),
    orderBy('start', 'asc'),
  );

  unsubscribeSessions = onSnapshot(
    sessionsQuery,
    (snapshot) => {
      sessionsCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      renderSessions();
    },
    (error) => {
      console.error(error);
    },
  );
}

function changeWeek(offset) {
  selectedWeekStart.setDate(selectedWeekStart.getDate() + offset * 7);
  renderCalendar();
  subscribeToSessions();
}

function openMonthPicker() {
  const current = selectedWeekStart.toISOString().slice(0, 7);
  const input = prompt('Choisis un mois (AAAA-MM)', current);
  if (!input) return;
  const [year, month] = input.split('-').map(Number);
  if (Number.isNaN(year) || Number.isNaN(month)) return;
  selectedWeekStart = getStartOfWeek(new Date(year, month - 1, 1), startDay);
  renderCalendar();
  subscribeToSessions();
}

function toggleAIPanel(show) {
  if (show) {
    aiPanel.classList.remove('hidden');
  } else {
    aiPanel.classList.add('hidden');
  }
}

async function callMistral(prompt) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer uW9AaHXECYi1wn0EJHmh2OelX1KDx3ee',
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        {
          role: 'system',
          content:
            "Tu es un coach sportif qui conçoit des entraînements personnalisés et motivants. Fournis des réponses structurées, avec des listes quand c'est pertinent.",
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error('API IA indisponible');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

aiForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = aiInput.value.trim();
  if (!question) return;

  const userBubble = document.createElement('div');
  userBubble.className = 'ai-message user';
  userBubble.textContent = question;
  aiMessages.appendChild(userBubble);
  aiMessages.scrollTop = aiMessages.scrollHeight;

  aiInput.value = '';

  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'ai-message';
  loadingBubble.textContent = 'Réflexion en cours...';
  aiMessages.appendChild(loadingBubble);
  aiMessages.scrollTop = aiMessages.scrollHeight;

  try {
    const reply = await callMistral(question);
    loadingBubble.textContent = reply;
  } catch (error) {
    loadingBubble.textContent = "L'IA n'a pas pu répondre pour le moment.";
  }
});

aiSuggestButton.addEventListener('click', async () => {
  const sport = sports.find((item) => item.name === sessionSportSelect.value);
  const start = new Date(sessionStartInput.value);
  const status = document.querySelector('input[name="session-status"]:checked').value;
  const context = `Je prépare une séance de ${sport.name} (${sport.id}) ${
    status === 'planned' ? 'planifiée' : 'déjà réalisée'
  } le ${start.toLocaleString('fr-FR', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })} pour ${sessionDurationInput.value} minutes. Propose un contenu structuré avec variation, travail par segment et conseils.`;

  aiSuggestion.classList.remove('hidden');
  aiSuggestion.textContent = 'Génération de ta séance personnalisée...';

  try {
    const reply = await callMistral(context);
    aiSuggestion.textContent = reply;
  } catch (error) {
    aiSuggestion.textContent = "Impossible de récupérer une suggestion IA pour le moment.";
  }
});

function attachAuthHandlers() {
  const tabs = document.querySelectorAll('.tab');
  const forms = document.querySelectorAll('.form');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.remove('active'));
      forms.forEach((form) => form.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });

  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert('Connexion impossible. Vérifie tes identifiants.');
    }
  });

  document.getElementById('signup-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const name = document.getElementById('signup-name').value;
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });
    } catch (error) {
      alert('Création de compte impossible. Vérifie tes informations.');
    }
  });

  document.getElementById('logout').addEventListener('click', () => signOut(auth));

  document.getElementById('reset-link').addEventListener('click', async (event) => {
    event.preventDefault();
    const email = prompt('Indique ton email pour réinitialiser ton mot de passe');
    if (!email) return;
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Email envoyé ! Vérifie ta boîte de réception.');
    } catch (error) {
      alert("Impossible d'envoyer l'email. Vérifie l'adresse renseignée.");
    }
  });
}

function initNavigation() {
  document.getElementById('prev-week').addEventListener('click', () => changeWeek(-1));
  document.getElementById('next-week').addEventListener('click', () => changeWeek(1));
  document.getElementById('month-picker').addEventListener('click', openMonthPicker);
  document.getElementById('ai-builder').addEventListener('click', () => toggleAIPanel(true));
  document.getElementById('ai-chat-trigger').addEventListener('click', () => toggleAIPanel(true));
  document.getElementById('close-ai').addEventListener('click', () => toggleAIPanel(false));

  weekStartSelect.addEventListener('change', () => {
    startDay = Number(weekStartSelect.value);
    selectedWeekStart = getStartOfWeek(selectedWeekStart, startDay);
    renderCalendar();
    subscribeToSessions();
  });
}

attachAuthHandlers();
initNavigation();
renderSports();
renderCalendar();

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authView.classList.add('hidden');
    dashboard.classList.remove('hidden');
    selectedWeekStart = getStartOfWeek(new Date(), startDay);
    renderCalendar();
    subscribeToSessions();
  } else {
    dashboard.classList.add('hidden');
    authView.classList.remove('hidden');
    if (unsubscribeSessions) unsubscribeSessions();
    sessionsCache = [];
  }
});
