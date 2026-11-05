// Domain Logic for Habit Tracking, Fuzzy Matching, and Cloud Sync
const HABIT_GAS_URL = process.env.HABIT_GAS_URL || 'https://script.google.com/macros/s/AKfycbwTLJ5PSqaSlghakcqWW7s5-0GhBrC9KhUl5cUMfmwkkphNEiarrbEWYglYnnOcCXzo2w/exec';
const SECURE_ID = process.env.SECURE_ID || '2108';

let cachedHabits = null;
let cachedHabitsRaw = null;
let isObjectWrapperHabits = false;
let lastHabitFetchTime = 0;
let habitsFetchPromise = null;

const DEFAULT_HABITS = [
  { id: 'aeca10f3-4e8a-4d4f-b0b0-19a7514252ab', name: 'Consistency', completedDates: [] },
  { id: '9aaeffb8-2ba8-46e5-80e7-8b8d6d8dd85c', name: 'Sun', completedDates: [] },
  { id: 'd4949dde-a0e9-4f7f-9bad-2d03409c9f77', name: 'Workout', completedDates: [] },
  { id: 'c0b2f32d-4b52-444d-9ca8-5b0d98822947', name: 'SRE', completedDates: [] },
  { id: '9924de03-0810-4fe7-8b97-1618a42958b7', name: 'Maths', completedDates: [] },
  { id: '2dbcb63b-08ca-4c72-9736-9590b364a57e', name: 'IQ', completedDates: [] },
  { id: '9d53f009-302b-4e0c-b953-33b2e8c6a88a', name: 'Language', completedDates: [] }
];

// Normalize local date to YYYY-MM-DD
function getLocalDateISO(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Background fetch worker
async function refreshHabitsFromCloud() {
  if (habitsFetchPromise) return habitsFetchPromise;
  habitsFetchPromise = (async () => {
    try {
      const getRes = await fetch(`${HABIT_GAS_URL}?userId=${SECURE_ID}&t=${Date.now()}`);
      let rawData = await getRes.json();
      let habits = [];
      let isObjectWrapper = false;
      if (Array.isArray(rawData)) {
        habits = rawData;
      } else if (rawData && Array.isArray(rawData.habits)) {
        habits = rawData.habits;
        isObjectWrapper = true;
      } else if (rawData && typeof rawData === 'object' && Object.keys(rawData).length > 0) {
        habits = Array.isArray(rawData.habits) ? rawData.habits : [];
      }

      // Merge master DEFAULT_HABITS if any habit was missing
      DEFAULT_HABITS.forEach(def => {
        const found = habits.find(h => h.name && h.name.toLowerCase() === def.name.toLowerCase());
        if (!found) {
          habits.push({ ...def, completedDates: [] });
        } else if (!found.id) {
          found.id = def.id;
        }
      });

      if (habits.length > 0) {
        cachedHabits = habits;
        cachedHabitsRaw = rawData;
        isObjectWrapperHabits = isObjectWrapper;
        lastHabitFetchTime = Date.now();
      }
      return { habits: cachedHabits || habits, rawData, isObjectWrapper };
    } catch (e) {
      console.error("Failed to fetch habits from cloud:", e.message);
      if (!cachedHabits || cachedHabits.length === 0) {
        cachedHabits = DEFAULT_HABITS.map(h => ({ ...h, completedDates: [] }));
      }
      return { habits: cachedHabits, rawData: cachedHabitsRaw || [], isObjectWrapper: false };
    } finally {
      habitsFetchPromise = null;
    }
  })();
  return habitsFetchPromise;
}

// Fetch live habit state: SRE 5-Second Cache (0ms instant return if within 5s, fresh sync from cloud when returning)
async function getHabitsState(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedHabits && cachedHabits.length > 0 && (now - lastHabitFetchTime < 5000)) {
    return { habits: cachedHabits, rawData: cachedHabitsRaw, isObjectWrapper: isObjectWrapperHabits };
  }
  return refreshHabitsFromCloud();
}

// Smart habit matcher with aliases (SRE, Workout, Language, etc.)
function matchHabit(habitsList, identifier) {
  if (!identifier || !Array.isArray(habitsList)) return null;
  const clean = identifier.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  // Exact ID match
  let match = habitsList.find(h => h.id && h.id.toLowerCase() === identifier.toLowerCase().trim());
  if (match) return match;

  // Exact name or clean match
  match = habitsList.find(h => h.name && (h.name.toLowerCase() === identifier.toLowerCase().trim() || h.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean));
  if (match) return match;

  // Alias dictionary
  const aliases = {
    'sre': 'SRE',
    'workout': 'Workout',
    'gym': 'Workout',
    'exercise': 'Workout',
    'sun': 'Sun',
    'sunlight': 'Sun',
    'consistency': 'Consistency',
    'math': 'Maths',
    'maths': 'Maths',
    'mathematics': 'Maths',
    'iq': 'IQ',
    'fingernail': 'Finger nail',
    'fingernails': 'Finger nail',
    'nail': 'Finger nail',
    'nails': 'Finger nail',
    'language': 'Language',
    'lang': 'Language',
    'languages': 'Language',
    'hindi': 'Language',
    'kannada': 'Language',
    'vocab': 'Language',
    'speaking': 'Language'
  };

  if (aliases[clean]) {
    const targetName = aliases[clean];
    match = habitsList.find(h => h.name && (
      h.name.toLowerCase() === targetName.toLowerCase() ||
      h.name.toLowerCase().replace(/[^a-z0-9]/g, '') === targetName.toLowerCase().replace(/[^a-z0-9]/g, '')
    ));
    if (match) return match;
  }

  // Partial match
  return habitsList.find(h => h.name && h.name.toLowerCase().includes(identifier.toLowerCase().trim())) || null;
}

// Calculate streaks for a habit
function calculateStreak(completedDates) {
  if (!Array.isArray(completedDates) || completedDates.length === 0) return { currentStreak: 0, totalCompleted: 0 };
  const sorted = [...new Set(completedDates)].sort().reverse();
  const today = getLocalDateISO();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLocalDateISO(yesterdayDate);

  let currentStreak = 0;
  let checkDate = new Date();

  // If today isn't done, start checking from yesterday
  if (!sorted.includes(today)) {
    if (!sorted.includes(yesterday)) {
      return { currentStreak: 0, totalCompleted: sorted.length };
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (sorted.includes(getLocalDateISO(checkDate))) {
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return { currentStreak, totalCompleted: sorted.length };
}

// Update habits (check or uncheck) and sync to cloud
async function updateHabits({ habitIds, action = 'check', date }) {
  const targetDate = date || getLocalDateISO();
  let habits = cachedHabits;
  let isObjectWrapper = isObjectWrapperHabits;
  let rawData = cachedHabitsRaw;

  // If memory cache is empty, fetch once
  if (!habits || habits.length === 0) {
    const stateObj = await getHabitsState();
    habits = stateObj.habits;
    isObjectWrapper = stateObj.isObjectWrapper;
    rawData = stateObj.rawData;
  }

  let habitListToUpdate = Array.isArray(habitIds) 
    ? habitIds 
    : (typeof habitIds === 'string' ? habitIds.split(',').map(s => s.trim()).filter(Boolean) : []);

  let updatedNames = [];
  for (const hId of habitListToUpdate) {
    let foundHabit = matchHabit(habits, hId);
    if (!foundHabit) {
      const newId = Date.now().toString(36) + Math.random().toString(36).substring(2);
      foundHabit = { id: newId, name: hId.trim(), completedDates: [] };
      habits.push(foundHabit);
    }
    if (!Array.isArray(foundHabit.completedDates)) {
      foundHabit.completedDates = [];
    }

    if (action === 'check') {
      if (!foundHabit.completedDates.includes(targetDate)) {
        foundHabit.completedDates.push(targetDate);
      }
    } else if (action === 'uncheck') {
      foundHabit.completedDates = foundHabit.completedDates.filter(d => d !== targetDate);
    }
    updatedNames.push(foundHabit.name || hId);
  }

  cachedHabits = habits;
  lastHabitFetchTime = Date.now();

  const stateToSave = isObjectWrapper ? { ...(rawData || {}), habits: habits } : habits;
  const payload = {
    userId: SECURE_ID,
    habits: habits,
    action: "sync",
    state: stateToSave
  };

  // Async cloud sync
  fetch(`${HABIT_GAS_URL}?userId=${SECURE_ID}`, {
    method: "POST",
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).catch(err => console.warn("Background sync error:", err.message));

  return {
    status: "success",
    action,
    date: targetDate,
    updated: updatedNames
  };
}

module.exports = {
  getHabitsState,
  matchHabit,
  calculateStreak,
  updateHabits,
  getLocalDateISO
};
