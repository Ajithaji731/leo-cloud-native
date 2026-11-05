const {
  fetchHabits,
  updateHabits,
  fetchWealthSummary,
  recordInvestments,
  removeInvestmentData,
  getUnifiedQuickOverview
} = require('./serviceClients');

const AI_CHAT_GAS_URL = process.env.AI_CHAT_GAS_URL || 'https://script.google.com/macros/s/AKfycbzGKwN7SseLOsaQeOnql_3cmMqaM4u7gJdcoIXsCbhn104CqpaECzwV9U6PwidLas0y/exec';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const SECURE_ID = process.env.SECURE_ID || '2108';

const groqTools = [
  {
    type: "function",
    function: {
      name: "get_habits",
      description: "Get user's habit tracker status, completed habits, pending habits, and streaks for a given date.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Target date in YYYY-MM-DD (defaults to today)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_habit",
      description: "Mark one or multiple habits as completed (check) or uncheck/undo them for a specific date.",
      parameters: {
        type: "object",
        properties: {
          habit_ids: {
            type: "array",
            items: { type: "string" },
            description: "List of habit names or IDs (e.g. ['Workout', 'SRE', 'Language'])"
          },
          action: {
            type: "string",
            enum: ["check", "uncheck"],
            description: "Action to perform: 'check' to mark done, 'uncheck' to undo/unmark"
          },
          date: { type: "string", description: "Target date in YYYY-MM-DD" }
        },
        required: ["habit_ids", "action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_investments",
      description: "Get user's total net worth, core investments, category totals, emergency fund, and goals breakdown.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Month in YYYY-MM format or name like 'September' (defaults to current month)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_investments",
      description: "Log, add, or update investment amounts for specific assets in a given month.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Target month in YYYY-MM format" },
          investments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                asset_id: { type: "string", description: "Name or ID of asset (e.g. 'Parag Parikh', 'Emergency Fund')" },
                amount: { type: "number", description: "Amount invested in INR" },
                mode: { type: "string", enum: ["add", "set"], description: "'add' to increment or 'set' to overwrite" }
              },
              required: ["asset_id", "amount"]
            }
          }
        },
        required: ["month", "investments"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_investment_data",
      description: "Safely delete/remove all investment records for a specific month (e.g. 'delete dec' or 'remove December records').",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Target month in YYYY-MM format (e.g. '2026-12')" },
          asset_id: { type: "string", description: "Optional specific asset ID to delete instead of entire month" }
        },
        required: ["month"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_unified_status",
      description: "Superfast combined check for BOTH daily habits and investment net worth in one single call.",
      parameters: { type: "object", properties: {} }
    }
  }
];

// Execute tool calls against our local microservices at lightning speed
async function executeToolCall(name, args) {
  const t0 = Date.now();
  let result;

  switch (name) {
    case 'get_habits':
      const habitsRes = await fetchHabits({ date: args.date });
      result = habitsRes.data;
      break;

    case 'update_habit':
      result = await updateHabits({
        habitIds: args.habit_ids || args.habit_id,
        action: args.action || 'check',
        date: args.date
      });
      break;

    case 'get_investments':
      const wealthRes = await fetchWealthSummary({ month: args.month });
      result = wealthRes.data;
      break;

    case 'manage_investments':
      result = await recordInvestments({
        month: args.month,
        investments: args.investments || [{ asset_id: args.asset_id, amount: args.amount, mode: args.mode }]
      });
      break;

    case 'remove_investment_data':
      result = await removeInvestmentData({
        month: args.month,
        assetId: args.asset_id || args.assetId || null
      });
      break;

    case 'get_unified_status':
      result = await getUnifiedQuickOverview();
      break;

    default:
      result = { error: `Unknown tool: ${name}` };
  }

  const durationMs = Date.now() - t0;
  return { result, durationMs };
}

const FAST_HABIT_ALIASES = {
  'sre': 'SRE', 'sre study': 'SRE', 'sre revision': 'SRE',
  'workout': 'Workout', 'gym': 'Workout', 'exercise': 'Workout', 'exercised': 'Workout', 'working out': 'Workout', 'lifted': 'Workout', 'training': 'Workout', 'weights': 'Workout',
  'sun': 'Sun', 'sunlight': 'Sun', 'morning sun': 'Sun', 'sun exposure': 'Sun', 'sunshine': 'Sun',
  'consistency': 'Consistency', 'streak': 'Consistency',
  'math': 'Maths', 'maths': 'Maths', 'mathematics': 'Maths', 'math problem': 'Maths',
  'iq': 'IQ', 'puzzles': 'IQ', 'brain': 'IQ', 'riddles': 'IQ', 'iq test': 'IQ',
  'finger': 'Finger nail', 'fingers': 'Finger nail', 'fingernail': 'Finger nail', 'fingernails': 'Finger nail', 'finger nail': 'Finger nail', 'nails': 'Finger nail', 'nail': 'Finger nail',
  'learn hindi': 'Language', 'learned hindi': 'Language', 'learning hindi': 'Language', 'hindi language': 'Language', 'hindi lang': 'Language', 'hindilang': 'Language', 'hindilanguage': 'Language', 'hindi study': 'Language', 'hindi practice': 'Language', 'hindi lesson': 'Language', 'hindi revision': 'Language', 'hindi class': 'Language', 'hindi': 'Language',
  'learn kannada': 'Language', 'learned kannada': 'Language', 'learning kannada': 'Language', 'kannada language': 'Language', 'kannada lang': 'Language', 'kannadalang': 'Language', 'kannadalanguage': 'Language', 'kannada study': 'Language', 'kannada practice': 'Language', 'kannada lesson': 'Language', 'kannada revision': 'Language', 'kannada class': 'Language', 'kannada': 'Language',
  'learn language': 'Language', 'learning language': 'Language', 'language learning': 'Language', 'language practice': 'Language', 'language study': 'Language', 'language': 'Language', 'lang': 'Language', 'languages': 'Language', 'vocab': 'Language', 'grammar': 'Language', 'duolingo': 'Language', 'speaking': 'Language'
};

const MARK_VERBS = ['mark', 'marked', 'did', 'done', 'finish', 'finished', 'complete', 'completed', 'check', 'checked', 'log', 'logged', 'track', 'tracked', 'achieve', 'achieved', 'studied', 'practiced', 'exercised', 'walked', 'read', 'lifted', 'trained', 'meditated', 'prayed'];
const { DEFAULT_INVEST_ASSETS, normalizeMonth, matchAsset } = require('./assetCatalog');

const UNMARK_VERBS = ['unmark', 'unmarked', 'uncheck', 'unchecked', 'undo', 'remove', 'removed', 'delete', 'deleted', 'skip', 'skipped', 'miss', 'missed', 'revert', 'reverted', 'cancel', 'cancelled', 'did not', 'didnt', 'not done'];

function tryFastInvestLog(userText, assetsList = DEFAULT_INVEST_ASSETS) {
  const clean = userText.trim().toLowerCase();
  
  // Guard against habit logs or questions
  if (/\b(how much|what is|what's|did i|have i|list habits|what all i did)\b/i.test(clean)) return null;

  // Extract month
  let targetMonth = null;
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'sep', 'oct', 'nov', 'dec'
  ];

  // 1. Explicit YYYY-MM check
  const yyyymmMatch = clean.match(/\b(20\d\d-\d\d)\b/);
  if (yyyymmMatch) {
    targetMonth = yyyymmMatch[1];
  } else {
    // 2. Check if a 4-digit year is explicitly attached to the month name (e.g. "dec 2026", "2026 dec")
    const monthYearMatch = clean.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s*(202\d)\b/i) ||
                           clean.match(/\b(202\d)\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i);

    for (const m of monthNames) {
      if (new RegExp('\\b' + m + '\\b', 'i').test(clean)) {
        targetMonth = normalizeMonth(monthYearMatch ? `${monthYearMatch[2] || monthYearMatch[1]}-${m}` : m);
        break;
      }
    }
  }

  if (!targetMonth) {
    targetMonth = normalizeMonth(null);
  }

  const isSetAction = /\b(set|replace)\b/i.test(clean);
  const items = [];
  const filterWordsRegex = new RegExp('\\b(' + monthNames.join('|') + '|for|in|to|into|month|added|add|invested|invest|put|saved|logged|set|deposit|deposited|updating|update|balance|fund|funds)\\b', 'gi');

  // Split clauses by commas, semicolons, newlines, 'and', '&', '+'
  const parts = clean.split(/(?:\band\b|[,;&\n\r]+)/i);
  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    const numMatch = trimmedPart.match(/(?:₹|rs\.?\s*)?(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakh|lac|cr)?/i);
    if (numMatch) {
      let rawVal = parseFloat(numMatch[1].replace(/,/g, ''));
      if (numMatch[2] && numMatch[2].toLowerCase() === 'k') rawVal *= 1000;
      if (numMatch[2] && (numMatch[2].toLowerCase() === 'lakh' || numMatch[2].toLowerCase() === 'lac')) rawVal *= 100000;
      if (numMatch[2] && numMatch[2].toLowerCase() === 'cr') rawVal *= 10000000;

      const assetCandidate = trimmedPart
        .replace(numMatch[0], ' ')
        .replace(filterWordsRegex, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim();

      if (assetCandidate.length >= 2 && rawVal > 0) {
        const matchedAsset = matchAsset(assetsList, assetCandidate);
        if (matchedAsset) {
          const existing = items.find(it => it.asset_id === matchedAsset.id);
          if (existing) {
            existing.amount += rawVal;
          } else {
            items.push({
              asset_id: matchedAsset.id,
              name: matchedAsset.name,
              amount: rawVal,
              mode: isSetAction ? 'set' : 'add'
            });
          }
        }
      }
    }
  }

  return items.length > 0 ? { month: targetMonth, items } : null;
}

function tryFastInvestDelete(userText) {
  const clean = userText.trim().toLowerCase().replace(/[?!.,]/g, '');
  const isDel = /\b(delete|del|remove|clear|wipe|erase)\b/i.test(clean);
  if (!isDel) return null;

  let targetMonth = null;
  const monthYearMatch = clean.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s*(202\d)\b/i) ||
                         clean.match(/\b(202\d)\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i);

  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'sep', 'oct', 'nov', 'dec'
  ];
  for (const m of monthNames) {
    if (new RegExp('\\b' + m + '\\b', 'i').test(clean)) {
      targetMonth = normalizeMonth(monthYearMatch ? `${monthYearMatch[2] || monthYearMatch[1]}-${m}` : m);
      break;
    }
  }
  const yyyymmMatch = clean.match(/\b(20\d\d-\d\d)\b/);
  if (yyyymmMatch) targetMonth = yyyymmMatch[1];

  if (targetMonth) return { month: targetMonth };
  return null;
}

// --- SRE Fast-Path: Instant Response Engine with Exact Original Leo Formatting ---
async function tryFastPath(cleanQuery) {
  const raw = (cleanQuery || '').trim();
  const q = raw.toLowerCase();
  const clean = q.replace(/[?!.,]/g, '').trim();

  // Fast Investment Delete Action (e.g. "delete dec", "delete december", "remove 2026-12", "clear december")
  const investDelMatch = tryFastInvestDelete(raw);
  if (investDelMatch) {
    await removeInvestmentData({ month: investDelMatch.month });
    return {
      response: `🗑️ **Removed all records for month ${investDelMatch.month} alone.**\n\n*All other months remain completely safe and intact!*`,
      fastPath: true
    };
  }

  // Fast Investment Log (e.g. "for dec 3000 - epf", "for dec : 2000 - epf , 1000 - digigold , ...")
  // NOTE: Pass raw with commas preserved so multi-item inputs split correctly!
  if (/\b\d{3,}\b|\b\d+k\b|₹\d+/i.test(q) && !/\b(how much|what|which|status|overview|summary)\b/i.test(clean)) {
    const investItems = tryFastInvestLog(raw);
    if (investItems && investItems.items.length > 0) {
      await recordInvestments({
        month: investItems.month,
        investments: investItems.items
      });
      const lines = investItems.items.map(it => `- **${it.name}**: +₹${Math.round(it.amount).toLocaleString('en-IN')}`).join('\n');
      return {
        response: `📈 **Logged Investment(s) for ${investItems.month}:**\n\n${lines}\n\n*Saved to your portfolio!* 🚀`,
        fastPath: true
      };
    }
  }

  // Fast Habit Action: Mark or Unmark (e.g. "did sun", "mark sre done", "unmark workout")
  const isQuery = /\b(how many|how much|how often|what|which|did i|have i|count|streak|stats?|history|record|status|overview|summary|list|all)\b/i.test(clean);
  const unmarkRegex = new RegExp('\\b(' + UNMARK_VERBS.join('|') + ')\\b', 'i');
  const isUnmark = unmarkRegex.test(clean) && !isQuery;
  const markRegex = new RegExp('\\b(' + MARK_VERBS.join('|') + ')\\b', 'i');
  const isMark = (markRegex.test(clean) || /\b(i\s+did|done|completed|mark)\b/i.test(clean)) && !isQuery;

  if (isUnmark || isMark) {
    const detectedHabits = [];

    // 1. Fast Alias Check (0ms in-memory lookup)
    for (const [alias, canonicalName] of Object.entries(FAST_HABIT_ALIASES)) {
      if (new RegExp(`\\b${alias}\\b`, 'i').test(clean)) {
        if (!detectedHabits.includes(canonicalName)) {
          detectedHabits.push(canonicalName);
        }
      }
    }

    // 2. Only if no alias matched, check dynamic habit names from microservice
    if (detectedHabits.length === 0) {
      const habitsRes = await fetchHabits();
      const habitsList = (habitsRes && habitsRes.data && (habitsRes.data.all || habitsRes.data.completed)) || [];
      habitsList.forEach(h => {
        if (h.name && !detectedHabits.includes(h.name)) {
          if (new RegExp(`\\b${h.name.toLowerCase()}\\b`, 'i').test(clean)) {
            detectedHabits.push(h.name);
          }
        }
      });
    }

    if (detectedHabits.length > 0) {
      const action = isUnmark ? 'uncheck' : 'check';
      const targetDate = new Date().toISOString().slice(0, 10);
      await updateHabits({ habitIds: detectedHabits, action, date: targetDate });

      const names = detectedHabits.join(', ');
      const response = action === 'uncheck'
        ? `Unmarked **${names}** for today. ⏪`
        : `✅ **${names}** habit marked as done for today! Keep shining! 🌞`;

      return { response, fastPath: true };
    }
  }

  // 1. Total Net Worth / Portfolio Overview
  if (/^(total\s*net\s*worth|net\s*worth|networth|how\s*much\s*funds|my\s*net\s*worth|portfolio)$/i.test(q) ||
      (/\b(total|how much|what)\b/i.test(q) && /\b(networth|net\s*worth|invested|investments?|portfolio)\b/i.test(q))) {
    const wealthRes = await fetchWealthSummary();
    const w = wealthRes.data;
    const targetMonth = w.month || new Date().toISOString().slice(0, 7);
    const total = Math.round(w.totalNetWorth || 0).toLocaleString('en-IN');
    const core = Math.round(w.coreInvestments || 0).toLocaleString('en-IN');
    
    const catLines = Object.entries(w.categoryTotals || {})
      .map(([cat, sum]) => `- **${cat}:** ₹${Math.round(Number(sum)).toLocaleString('en-IN')}`)
      .join('\n');

    return {
      response: `💼 **Portfolio Overview (${targetMonth}):**\n\n- **Total Net Worth:** ₹${total}\n- **Core Investments:** ₹${core}\n\n**Breakdown by Category:**\n${catLines || 'No active holdings logged yet.'}`,
      fastPath: true
    };
  }

  // 2. Completed / Status for today
  if (/^(what\s*all\s*i\s*did\s*today|what\s*i\s*did\s*today|completed\s*habits|done\s*today|today'?s?\s*status)$/i.test(q) ||
      (/\b(what\s*did\s*i\s*do|what\s*i\s*did|what\s*all\s*i\s*did|what\s*have\s*i\s*done|things\s*i\s*have\s*done|what\s*is\s*done)\b/i.test(q))) {
    const habitsRes = await fetchHabits();
    const h = habitsRes.data;
    const targetISO = h.date || new Date().toISOString().slice(0, 10);

    if (!h.completed || h.completed.length === 0) {
      const pendingList = (h.pending || []).map(x => `• ${x.name}`).join('\n');
      return {
        response: `📅 **Status for today (${targetISO}):**\n\nNo habits completed yet today. Let me know when you finish any! ☀️\n\n**Pending:**\n${pendingList || 'No active habits found.'}`,
        fastPath: true
      };
    }

    const completedList = h.completed.map(x => `• **${x.name}** ✅`).join('\n');
    const pendingList = (h.pending && h.pending.length > 0)
      ? h.pending.map(x => `• ${x.name}`).join('\n')
      : 'None! All done 🎉';

    return {
      response: `📅 **Habits you completed today (${targetISO}):**\n\n${completedList}\n\n**Pending:**\n${pendingList}`,
      fastPath: true
    };
  }

  // 3. Pending habits query
  if (/^(what\s*is\s*pending|pending|pending\s*habits|whats\s*pending|remaining\s*habits|not\s*done)$/i.test(q)) {
    const habitsRes = await fetchHabits();
    const h = habitsRes.data;
    const targetISO = h.date || new Date().toISOString().slice(0, 10);

    if (!h.pending || h.pending.length === 0) {
      return {
        response: `🎉 **Amazing!** You have completed all your habits for today (${targetISO})! ☀️`,
        fastPath: true
      };
    }

    const pendingList = h.pending.map(x => `• **${x.name}** ⏳`).join('\n');
    return {
      response: `⏳ **Pending habits for today (${targetISO}):**\n\n${pendingList}`,
      fastPath: true
    };
  }

  // 4. Stocks & ETFs query
  if (/^(stocks|stocks\s*&\s*etfs|stocks\s*and\s*etfs|etf|etfs)$/i.test(q)) {
    const wealthRes = await fetchWealthSummary();
    const targetMonth = wealthRes.data.month || new Date().toISOString().slice(0, 7);
    const holdings = (wealthRes.data.holdings || []).filter(item => item.category === 'Stocks/ETFs');
    let totalStocks = 0;
    let list = [];
    holdings.forEach(item => {
      totalStocks += item.invested;
      list.push(`- **${item.name}:** ₹${Math.round(item.invested).toLocaleString('en-IN')}`);
    });
    return {
      response: `📊 **Stocks & ETFs Holdings (${targetMonth}):**\n\n**Total Invested:** ₹${Math.round(totalStocks).toLocaleString('en-IN')}\n\n${list.join('\n') || 'No stock records logged for this month.'}`,
      fastPath: true
    };
  }

  // 5. Mutual Funds query
  if (/^(mutual\s*funds?|mfs?)$/i.test(q)) {
    const wealthRes = await fetchWealthSummary();
    const targetMonth = wealthRes.data.month || new Date().toISOString().slice(0, 7);
    const holdings = (wealthRes.data.holdings || []).filter(item => item.category === 'Mutual Funds');
    let totalMF = 0;
    let list = [];
    holdings.forEach(item => {
      totalMF += item.invested;
      list.push(`- **${item.name}:** ₹${Math.round(item.invested).toLocaleString('en-IN')}`);
    });
    return {
      response: `📈 **Mutual Funds Investment (${targetMonth}):**\n\n**Total Invested:** ₹${Math.round(totalMF).toLocaleString('en-IN')}\n\n${list.join('\n') || 'No mutual fund records logged for this month.'}`,
      fastPath: true
    };
  }

  // 6. Habit streaks query / weekly summary
  if (/^(weekly\s*summary|habits\s*streak|streaks|habit\s*streaks)$/i.test(q)) {
    const habitsRes = await fetchHabits();
    const all = (habitsRes.data.all || []).map(x => `- **${x.name}:** ${x.currentStreak} day streak (${x.totalCompleted} days total)`).join('\n');
    return {
      response: `📊 **Habit Streaks & Statistics:**\n\n${all || 'No habit records found.'}`,
      fastPath: true
    };
  }

  return null;
}

// Process user chat message through Groq LLM with tools
async function processChat({ message, history = [] }) {
  // Check instant fast-path first!
  const fastResult = await tryFastPath(message);
  if (fastResult) {
    return fastResult;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const systemPrompt = `You are Ajith's personal AI agent (Leo). Today's date is ${todayStr}.
You manage his Habit Tracker and Investment Portfolio with sub-millisecond microservices.

Habits:
- Common habits: Workout, SRE, Sun, Consistency, Maths, IQ, Finger nail, Language (all language study maps to 'Language').
- When user did/completed a habit: call 'update_habit' with action: 'check'.
- When user says "unmark", "undo", "uncheck", "didn't do": call 'update_habit' with action: 'uncheck'.
- When user asks what habits they completed, what is pending, streaks: ALWAYS call 'get_habits'.

Investments & Portfolio:
- When user asks how much funds they have, emergency fund, net worth, goals: call 'get_investments'.
- When user wants to log investments: call 'manage_investments'.
- If user asks about both habits AND net worth together: call 'get_unified_status'.

Always keep responses short, friendly, clear, and confirm actions with emojis.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-6).map(m => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content || " "
    })),
    { role: "user", content: message }
  ];

  const payload = {
    model: "openai/gpt-oss-120b",
    messages: messages,
    tools: groqTools,
    temperature: 0.2,
    max_tokens: 1000
  };

  // Call LLM (using direct Groq API if key provided, or through secure proxy)
  let rawResponse;
  if (GROQ_API_KEY) {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    rawResponse = await groqRes.json();
  } else {
    const proxyRes = await fetch(`${AI_CHAT_GAS_URL}?userId=${SECURE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'chatWithGroq',
        userId: SECURE_ID,
        payload
      })
    });
    rawResponse = await proxyRes.json();
  }

  if (rawResponse.error) {
    return { response: `⚠️ LLM Error: ${JSON.stringify(rawResponse.error)}` };
  }

  const choice = rawResponse.choices && rawResponse.choices[0];
  const choiceMsg = choice ? choice.message : null;

  // Handle Tool Calls if LLM decided to invoke microservices
  if (choiceMsg && choiceMsg.tool_calls && choiceMsg.tool_calls.length > 0) {
    let toolResults = [];
    for (const toolCall of choiceMsg.tool_calls) {
      const toolName = toolCall.function.name;
      let args = {};
      try { args = JSON.parse(toolCall.function.arguments || "{}"); } catch (e) {}

      const { result, durationMs } = await executeToolCall(toolName, args);
      toolResults.push({ tool: toolName, result, durationMs });
    }

    // Secondary synthesis call for natural conversation
    const followUpMessages = [
      ...messages,
      choiceMsg,
      ...toolResults.map((tr, idx) => ({
        role: "tool",
        tool_call_id: choiceMsg.tool_calls[idx].id,
        content: JSON.stringify(tr.result)
      }))
    ];

    let secondResponse;
    const secondPayload = {
      model: "openai/gpt-oss-120b",
      messages: followUpMessages,
      temperature: 0.2,
      max_tokens: 600
    };

    if (GROQ_API_KEY) {
      const res2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(secondPayload)
      });
      secondResponse = await res2.json();
    } else {
      const res2 = await fetch(`${AI_CHAT_GAS_URL}?userId=${SECURE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'chatWithGroq', userId: SECURE_ID, payload: secondPayload })
      });
      secondResponse = await res2.json();
    }

    const finalAnswer = (secondResponse.choices && secondResponse.choices[0] && secondResponse.choices[0].message)
      ? secondResponse.choices[0].message.content
      : "Done! Synced with microservices.";

    return {
      response: finalAnswer,
      toolExecutions: toolResults
    };
  }

  return {
    response: choiceMsg ? choiceMsg.content : "How can I help you today?"
  };
}

module.exports = {
  processChat,
  executeToolCall
};
