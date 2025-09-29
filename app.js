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
  doc,
  updateDoc,
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
    icon: 'sports_martial_arts',
    color: 'linear-gradient(135deg, #7b5cff, #5a3bff)',
    variations: ['Ne-waza', 'Randori', 'Technique', 'Kumi-kata', 'Conditioning'],
  },
  {
    id: 'jjb',
    name: 'Jiu-Jitsu Brésilien',
    icon: 'sports_mma',
    color: 'linear-gradient(135deg, #5af8b9, #2ec4a3)',
    variations: ['Drill', 'Sparring', 'Passages de garde', 'Soumissions', 'Escapes'],
  },
  {
    id: 'strength',
    name: 'Musculation',
    icon: 'fitness_center',
    color: 'linear-gradient(135deg, #ff6b6b, #ff8e53)',
    variations: ['Force', 'Hypertrophie', 'Full body', 'Push/Pull', 'Core'],
  },
  {
    id: 'yoga',
    name: 'Yoga',
    icon: 'self_improvement',
    color: 'linear-gradient(135deg, #26d4ff, #84f2ff)',
    variations: ['Vinyasa', 'Hatha', 'Yin', 'Power', 'Respiration'],
  },
  {
    id: 'stretch',
    name: 'Stretching',
    icon: 'accessibility_new',
    color: 'linear-gradient(135deg, #ffb36b, #ffd56b)',
    variations: ['Mobilité', 'Souplesse', 'Recovery', 'Full body'],
  },
  {
    id: 'cardio',
    name: 'Cardio',
    icon: 'directions_run',
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
const themeToggleButtons = [
  document.getElementById('theme-toggle'),
].filter(Boolean);

const THEME_STORAGE_KEY = 'sportflow-theme';

function updateThemeToggleButtons(theme) {
  const isLight = theme === 'light';
  const iconName = isLight ? 'dark_mode' : 'light_mode';
  const label = isLight ? 'Activer le mode sombre' : 'Activer le mode clair';
  themeToggleButtons.forEach((button) => {
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    const iconElement = button.querySelector('.material-symbols-rounded');
    if (iconElement) {
      iconElement.textContent = iconName;
    }
  });
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  updateThemeToggleButtons(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // Local storage may be unavailable (private mode, etc.)
  }
}

let storedTheme = null;
try {
  storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
} catch (error) {
  storedTheme = null;
}

applyTheme(storedTheme || 'dark');

themeToggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
  });
});

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
    pill.setAttribute('role', 'button');
    pill.setAttribute('aria-label', `Planifier une séance de ${sport.name}`);
    pill.innerHTML = `
      <div class="sport-icon" style="background:${sport.color}">
        <span class="material-symbols-rounded" aria-hidden="true">${sport.icon}</span>
      </div>
      <div class="sport-info">
        <h3>${sport.name}</h3>
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

  // Affichage par défaut : 8h à 21h (52 slots de 15min)
  const defaultStartSlot = 8 * 4; // 8h = slot 32
  const defaultEndSlot = 21 * 4; // 21h = slot 84
  const totalSlots = 96; // 24h * 4 slots/heure

  // Créer les boutons d'expansion
  const expandButton = document.createElement('div');
  expandButton.className = 'time-expand-button';
  expandButton.innerHTML = '⬆️';
  expandButton.title = 'Afficher les heures supplémentaires (0h-8h)';
  expandButton.addEventListener('click', () => toggleTimeRange('early'));
  
  const expandButtonLate = document.createElement('div');
  expandButtonLate.className = 'time-expand-button';
  expandButtonLate.innerHTML = '⬇️';
  expandButtonLate.title = 'Afficher les heures supplémentaires (21h-24h)';
  expandButtonLate.addEventListener('click', () => toggleTimeRange('late'));

  // Fonction pour basculer l'affichage des heures
  function toggleTimeRange(period) {
    const isExpanded = document.body.classList.contains(`expanded-${period}`);
    if (isExpanded) {
      document.body.classList.remove(`expanded-${period}`);
      renderTimeSlots(defaultStartSlot, defaultEndSlot);
    } else {
      document.body.classList.add(`expanded-${period}`);
      if (period === 'early') {
        renderTimeSlots(0, defaultEndSlot);
      } else {
        renderTimeSlots(defaultStartSlot, totalSlots);
      }
    }
  }

  // Fonction pour rendre les créneaux horaires
  function renderTimeSlots(startSlot, endSlot) {
    // Supprimer les anciens créneaux
    body.querySelectorAll('.time-row').forEach(row => row.remove());
    
    for (let slot = startSlot; slot < endSlot; slot += 1) {
      const row = document.createElement('div');
      row.className = 'time-row';

      const timeCell = document.createElement('div');
      timeCell.className = 'time-cell';
      const hours = Math.floor(slot / 4);
      const minutes = (slot % 4) * 15;
      
      // Afficher les heures pleines et demi-heures
      let label = '';
      if (minutes === 0) {
        label = `${hours.toString().padStart(2, '0')}:00`;
        timeCell.classList.add('hour-mark');
      } else if (minutes === 30) {
        label = `${hours.toString().padStart(2, '0')}:30`;
        timeCell.classList.add('half-hour-mark');
      } else {
        // Pour les quarts d'heure, afficher un point discret
        label = '•';
        timeCell.classList.add('quarter-mark');
      }
      
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

      const highlightDropCell = () => {
        if (minutes === 15 || minutes === 45) {
          dropCell.classList.add('quarter-highlight');
        } else {
          dropCell.classList.add('highlight');
        }
      };

      dropCell.addEventListener('dragenter', (event) => {
        if (!event.dataTransfer) return;
        highlightDropCell();
      });

      dropCell.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (event.dataTransfer) {
          const isSessionDrag = Array.from(event.dataTransfer.types || []).includes('application/json');
          event.dataTransfer.dropEffect = isSessionDrag ? 'move' : 'copy';
        }
        highlightDropCell();
      });

      dropCell.addEventListener('dragleave', () => {
        dropCell.classList.remove('highlight', 'quarter-highlight');
      });

      dropCell.addEventListener('drop', (event) => {
        event.preventDefault();
        dropCell.classList.remove('highlight', 'quarter-highlight');
        
        const dataType = event.dataTransfer.getData('text/plain');
        
        if (dataType === 'session') {
          // Déplacer une session existante
          const sessionData = JSON.parse(event.dataTransfer.getData('application/json'));
          moveSession(sessionData, dropCell.dataset.datetime);
        } else {
          // Créer une nouvelle session
          const sportId = dataType;
          const sport = sports.find((item) => item.id === sportId);
          if (!sport) return;
          openSessionModal({
            sportId,
            start: dropCell.dataset.datetime,
          });
        }
      });

      row.appendChild(dropCell);
    });

    body.appendChild(row);
  }
  }

  // Rendre les créneaux par défaut (8h-21h)
  renderTimeSlots(defaultStartSlot, defaultEndSlot);

  // Ajouter le bouton d'expansion en haut
  body.insertBefore(expandButton, body.firstChild);
  
  // Ajouter le bouton d'expansion en bas
  body.appendChild(expandButtonLate);

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

function populateChips(container, options, isExclusive = false) {
  container.innerHTML = '';
  options.forEach((option) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = option;
    chip.addEventListener('click', () => {
      if (isExclusive) {
        // Pour les tags exclusifs (comme le type de séance), désélectionner les autres
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      } else {
        // Pour les tags multiples (intensité, sensations), toggle
        chip.classList.toggle('selected');
      }
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
const sessionTypeContainer = document.getElementById('session-type-tags');
const sessionModal = document.getElementById('session-modal');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalIcon = document.getElementById('modal-icon');
const closeModalButton = document.getElementById('close-modal');
const aiSuggestButton = document.getElementById('ai-suggest');

populateSelect(sessionSportSelect, sports.map((sport) => sport.name));
populateChips(intensityContainer, intensityOptions);
populateChips(feelingContainer, feelingOptions);
populateChips(sessionTypeContainer, ['Planification', 'Reporting'], true);
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
  modalIcon.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">${sport.icon}</span>`;
  modalIcon.style.background = sport.color;
  modalTitle.textContent = `Nouvelle séance - ${sport.name}`;
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
  
  // Détection automatique du type de séance selon l'heure
  const sessionTime = new Date(start);
  const currentTime = new Date();
  const isPast = sessionTime < currentTime;
  
  sessionTypeContainer.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('selected'));
  const defaultType = isPast ? 'completed' : 'planned';
  sessionTypeContainer.querySelector(`.chip[data-value="${defaultType}"]`).classList.add('selected');
  
  aiSuggestion.classList.add('hidden');
  aiSuggestion.textContent = '';
  sessionModal.classList.remove('hidden');
}

function closeSessionModal() {
  sessionModal.classList.add('hidden');
  // Réinitialiser le formulaire
  document.getElementById('session-form').reset();
  sessionDurationInput.value = 60;
  intensityContainer.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('selected'));
  feelingContainer.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('selected'));
  sessionTypeContainer.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('selected'));
  sessionTypeContainer.querySelector('.chip[data-value="planned"]').classList.add('selected');
  // Supprimer l'ID de session stocké
  delete sessionModal.dataset.sessionId;
}

function openSessionModalForEdit(session) {
  const sport = sports.find((item) => item.id === session.sportId);
  if (!sport) return;
  
  // Pré-remplir le formulaire avec les données de la session
  sessionSportSelect.value = sport.name;
  updateModalForSport(sport);
  sessionVariationSelect.value = sport.variations.includes(session.variation)
    ? session.variation
    : sport.variations[0];
  sessionStartInput.value = toDateTimeLocalValue(new Date(session.start));
  sessionDurationInput.value = session.duration;
  
  const selectedIntensity = Array.isArray(session.intensity) ? session.intensity : [];
  const selectedFeelings = Array.isArray(session.feelings) ? session.feelings : [];

  // Sélectionner les chips d'intensité
  intensityContainer.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('selected', selectedIntensity.includes(chip.textContent));
  });

  // Sélectionner les chips de sensations
  feelingContainer.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('selected', selectedFeelings.includes(chip.textContent));
  });
  
  // Sélectionner le statut
  sessionTypeContainer.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('selected'));
  sessionTypeContainer.querySelector(`.chip[data-value="${session.status}"]`).classList.add('selected');
  
  // Mettre à jour le titre de la modale
  modalTitle.textContent = `Modifier ${sport.name}`;
  modalSubtitle.textContent = new Date(session.start).toLocaleString('fr-FR', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  
  // Stocker l'ID de la session pour la mise à jour
  sessionModal.dataset.sessionId = session.id;
  
  aiSuggestion.classList.add('hidden');
  aiSuggestion.textContent = '';
  sessionModal.classList.remove('hidden');
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
  const status = sessionTypeContainer.querySelector('.chip.selected').dataset.value;
  const startDate = new Date(sessionStartInput.value);
  const duration = Number(sessionDurationInput.value) || 60;
  const intensity = Array.from(intensityContainer.querySelectorAll('.chip.selected')).map(
    (chip) => chip.textContent,
  );
  const feelings = Array.from(feelingContainer.querySelectorAll('.chip.selected')).map(
    (chip) => chip.textContent,
  );

  const basePayload = {
    userId: currentUser.uid,
    sportId: sport.id,
    sportName: sport.name,
    variation: sessionVariationSelect.value,
    start: startDate.toISOString(),
    duration,
    intensity,
    feelings,
    status,
  };

  try {
    const sessionId = sessionModal.dataset.sessionId;

    if (sessionId) {
      // Mise à jour d'une session existante
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, {
        ...basePayload,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Création d'une nouvelle session
      await addDoc(collection(db, 'sessions'), {
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    }
    
    closeSessionModal();
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    alert("Impossible d'enregistrer la séance. Réessaie plus tard.");
  }
}

document.getElementById('session-form').addEventListener('submit', saveSession);

async function moveSession(sessionData, newStartTime) {
  if (!currentUser) return;

  try {
    const sessionRef = doc(db, 'sessions', sessionData.id);
    await updateDoc(sessionRef, {
      start: new Date(newStartTime).toISOString(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erreur lors du déplacement de la session:', error);
    alert("Impossible de déplacer la séance. Réessaie plus tard.");
  }
}

function updateWeeklyKPI() {
  const totalSessions = sessionsCache.length;
  const totalDuration = sessionsCache.reduce((sum, session) => sum + session.duration, 0);
  const plannedSessions = sessionsCache.filter(session => session.status === 'planned').length;
  const completedSessions = sessionsCache.filter(session => session.status === 'completed').length;
  
  document.getElementById('total-sessions').textContent = totalSessions;
  document.getElementById('total-duration').textContent = `${Math.round(totalDuration / 60)}h`;
  document.getElementById('planned-sessions').textContent = plannedSessions;
  document.getElementById('completed-sessions').textContent = completedSessions;
}

function renderSessions() {
  calendarGrid.querySelectorAll('.session-block').forEach((block) => block.remove());
  sessionsCache.forEach((session) => {
    const startDate = new Date(session.start);
    const dayIndex = Math.floor((startDate - selectedWeekStart) / (1000 * 60 * 60 * 24));
    if (dayIndex < 0 || dayIndex > 6) return;
    
    // Calculer le slot absolu (0-95 pour 24h)
    const absoluteStartSlot = startDate.getHours() * 4 + Math.floor(startDate.getMinutes() / 15);
    const slots = Math.max(1, Math.round(session.duration / 15));
    
    // Vérifier si le slot est visible dans la plage actuelle
    const isExpandedEarly = document.body.classList.contains('expanded-early');
    const isExpandedLate = document.body.classList.contains('expanded-late');
    
    let isVisible = false;
    if (isExpandedEarly && isExpandedLate) {
      // Toutes les heures sont visibles
      isVisible = true;
    } else if (isExpandedEarly) {
      // 0h-21h visibles
      isVisible = absoluteStartSlot >= 0 && absoluteStartSlot < 84;
    } else if (isExpandedLate) {
      // 8h-24h visibles
      isVisible = absoluteStartSlot >= 32 && absoluteStartSlot < 96;
    } else {
      // 8h-21h visibles (par défaut)
      isVisible = absoluteStartSlot >= 32 && absoluteStartSlot < 84;
    }
    
    if (!isVisible) return;
    
    const targetCell = calendarGrid.querySelector(
      `.drop-cell[data-day-index="${dayIndex}"][data-slot="${absoluteStartSlot}"]`,
    );
    if (!targetCell) return;

    const block = document.createElement('div');
    block.className = `session-block ${session.status === 'completed' ? 'completed' : 'planned'}`;
    block.style.height = `${slots * slotHeight - 8}px`;
    block.style.background = session.status === 'completed'
      ? 'linear-gradient(135deg, rgba(68, 255, 161, 0.85), rgba(32, 201, 151, 0.95))'
      : 'linear-gradient(135deg, rgba(123, 92, 255, 0.8), rgba(38, 212, 255, 0.9))';
    block.draggable = true;
    block.dataset.sessionId = session.id;
    block.dataset.sessionData = JSON.stringify(session);
    block.setAttribute('role', 'button');
    block.setAttribute(
      'aria-label',
      `${session.sportName} à ${new Date(session.start).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })} pour ${session.duration} minutes`,
    );
    block.tabIndex = 0;
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

    // Ajouter les événements de drag & drop pour les sessions
    block.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', 'session');
      event.dataTransfer.setData('application/json', JSON.stringify(session));
      event.dataTransfer.effectAllowed = 'move';
      block.classList.add('is-dragging');
      block.setAttribute('aria-grabbed', 'true');
    });

    block.addEventListener('dragend', () => {
      block.classList.remove('is-dragging');
      block.removeAttribute('aria-grabbed');
    });

    // Ajouter l'événement de clic pour modifier la session
    block.addEventListener('click', (event) => {
      event.stopPropagation();
      openSessionModalForEdit(session);
    });

    block.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openSessionModalForEdit(session);
      }
    });

    targetCell.appendChild(block);
  });
  
  // Mettre à jour les KPI après le rendu
  updateWeeklyKPI();
}

function subscribeToSessions() {
  if (!currentUser) return;
  if (unsubscribeSessions) unsubscribeSessions();

  const weekEnd = new Date(selectedWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Requête ultra-simplifiée pour éviter tout problème d'index
  const sessionsQuery = query(
    collection(db, 'sessions'),
    where('userId', '==', currentUser.uid),
  );

  unsubscribeSessions = onSnapshot(
    sessionsQuery,
    (snapshot) => {
      // Filtrer côté client pour la semaine courante
      const weekEnd = new Date(selectedWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      sessionsCache = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((session) => {
          const sessionDate = new Date(session.start);
          return sessionDate >= selectedWeekStart && sessionDate < weekEnd;
        })
        .sort((a, b) => new Date(a.start) - new Date(b.start));
      renderSessions();
    },
    (error) => {
      console.error('Erreur lors de la récupération des sessions:', error);
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
            "Tu es un coach sportif qui conçoit des entraînements personnalisés et motivants. Fournis des réponses structurées, avec des listes quand c'est pertinent. Des fiches détaillées sont disponibles dans le dossier docs (Markdown) : appuie-toi dessus quand elles sont utiles pour répondre.",
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
  const status = sessionTypeContainer.querySelector('.chip.selected').dataset.value;
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

  // Gestion de la visibilité des mots de passe
  const loginPasswordInput = document.getElementById('login-password');
  const loginPasswordToggle = document.getElementById('login-password-toggle');
  const signupPasswordInput = document.getElementById('signup-password');
  const signupPasswordToggle = document.getElementById('signup-password-toggle');

  function togglePasswordVisibility(input, toggle) {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const iconElement = toggle.querySelector('.material-symbols-rounded');
    if (iconElement) {
      iconElement.textContent = isPassword ? 'visibility_off' : 'visibility';
    }
    toggle.setAttribute('aria-label', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  }

  loginPasswordToggle.addEventListener('click', () => {
    togglePasswordVisibility(loginPasswordInput, loginPasswordToggle);
  });

  signupPasswordToggle.addEventListener('click', () => {
    togglePasswordVisibility(signupPasswordInput, signupPasswordToggle);
  });

  // Bouton de connexion rapide pour le développement
  document.getElementById('dev-login-btn').addEventListener('click', async () => {
    const email = 'jeanminono13@gmail.com';
    const password = 'admin13009';
    
    // Pré-remplir les champs
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = password;
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert('Connexion rapide échouée. Vérifie que le compte existe.');
    }
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
