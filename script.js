"use strict";

/* ==========================================================================
   Config
   ========================================================================== */
const API_BASE = "http://127.0.0.1:8000";
const PREDICT_ENDPOINT = `${API_BASE}/predict`;

/* ==========================================================================
   Small DOM helpers
   ========================================================================== */
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/* ==========================================================================
   Toast notifications
   ========================================================================== */
const toastStack = $("#toastStack");

const TOAST_ICONS = {
  success: `<svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error: `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M10 6v5M10 13.5h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  info: `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M10 9v4.5M10 6.5h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
};

function showToast({ type = "info", title, message, duration = 5000 }) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <div class="toast-body">
      <strong>${title}</strong>
      <span>${message}</span>
    </div>
  `;
  toastStack.appendChild(toast);

  const remove = () => {
    toast.classList.add("hide");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  };
  const timer = setTimeout(remove, duration);
  toast.addEventListener("click", () => {
    clearTimeout(timer);
    remove();
  });
}

/* ==========================================================================
   API status pill — best-effort reachability check
   ========================================================================== */
async function checkApiStatus() {
  const dot = $("#apiStatusDot");
  const text = $("#apiStatusText");
  try {
    await fetch(API_BASE, { method: "GET", mode: "cors" });
    dot.classList.add("online");
    dot.classList.remove("offline");
    text.textContent = "Model server connected";
  } catch (err) {
    dot.classList.add("offline");
    dot.classList.remove("online");
    text.textContent = "Model server unreachable";
  }
}
checkApiStatus();

/* ==========================================================================
   Form validation
   ========================================================================== */
const form = $("#predictForm");
const submitBtn = $("#submitBtn");

const NUMERIC_RULES = {
  age: { min: 10, max: 100, label: "Age" },
  usageHours: { min: 0, max: 24, label: "Average daily usage" },
  unlocks: { min: 0, max: 500, label: "Daily unlocks" },
  studyHours: { min: 0, max: 24, label: "Study hours" },
  activityHours: { min: 0, max: 24, label: "Physical activity hours" },
  sleepHours: { min: 0, max: 24, label: "Sleep hours" },
};

function fieldWrap(inputEl) {
  return inputEl.closest(".field");
}

function setFieldError(id, message) {
  const input = $(`#${id}`);
  const wrap = fieldWrap(input);
  const errorEl = $(`[data-error-for="${id}"]`);
  if (message) {
    wrap.classList.add("has-error");
    errorEl.textContent = message;
  } else {
    wrap.classList.remove("has-error");
    errorEl.textContent = "";
  }
  return !message;
}

function validateForm() {
  let isValid = true;

  // Required select/text fields
  const requiredSelects = ["gender", "country", "academicLevel", "platform", "purpose", "stressLevel"];
  requiredSelects.forEach((id) => {
    const input = $(`#${id}`);
    const ok = setFieldError(id, input.value ? "" : "Please make a selection.");
    isValid = isValid && ok;
  });

  // Numeric fields
  Object.entries(NUMERIC_RULES).forEach(([id, rule]) => {
    const input = $(`#${id}`);
    const raw = input.value.trim();
    if (raw === "") {
      isValid = setFieldError(id, `${rule.label} is required.`) && isValid;
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) {
      isValid = setFieldError(id, "Enter a valid number.") && isValid;
    } else if (num < rule.min || num > rule.max) {
      isValid = setFieldError(id, `Must be between ${rule.min} and ${rule.max}.`) && isValid;
    } else {
      isValid = setFieldError(id, "") && isValid;
    }
  });

  return isValid;
}

// Live-clear errors as the user fixes fields
$$("#predictForm input, #predictForm select").forEach((el) => {
  el.addEventListener("input", () => setFieldError(el.id, ""));
  el.addEventListener("change", () => setFieldError(el.id, ""));
});

/* ==========================================================================
   Build payload matching backend schema
   ========================================================================== */
function buildPayload() {
  return {
    Age: Number($("#age").value),
    gender: $("#gender").value,
    Country: $("#country").value,
    Academic_Level: $("#academicLevel").value,
    Most_Used_Platform: $("#platform").value,
    Purpose_Of_Use: $("#purpose").value,
    Avg_Daily_Usage_Hours: Number($("#usageHours").value),
    Daily_Unlocks: Number($("#unlocks").value),
    Study_Hours: Number($("#studyHours").value),
    Physical_Activity_Hours: Number($("#activityHours").value),
    Sleep_Hours_Per_Night: Number($("#sleepHours").value),
    Stress_Level: $("#stressLevel").value,
  };
}

/* ==========================================================================
   Result rendering
   ========================================================================== */
const RING_CIRCUMFERENCE = 2 * Math.PI * 96; // matches r=96 in SVG

const CATEGORY_BANDS = [
  {
    min: 80,
    label: "Excellent",
    color: "var(--score-excellent)",
    headline: "You're in a strong place",
    summary:
      "Your habits around sleep, activity and screen time are well balanced. Keep the routines that are working for you.",
    recommendations: [
      "Keep your current sleep schedule — it's clearly paying off.",
      "Notice which habits help most, and protect them during busy weeks.",
      "Consider mentoring a friend who's struggling with screen time balance.",
    ],
  },
  {
    min: 60,
    label: "Good",
    color: "var(--score-good)",
    headline: "Solidly on track, with room to grow",
    summary:
      "Most of your indicators look healthy. A few small adjustments could push your score even higher.",
    recommendations: [
      "Set one screen-free hour before bed to improve sleep quality.",
      "Add a short walk or stretch break between study sessions.",
      "Try muting non-essential notifications during study hours.",
    ],
  },
  {
    min: 40,
    label: "Moderate",
    color: "var(--score-moderate)",
    headline: "A few areas need attention",
    summary:
      "There are some patterns — usage, stress or sleep — that may be weighing on your wellbeing. Small changes can help.",
    recommendations: [
      "Aim for at least 7 hours of sleep on most nights.",
      "Reduce daily unlocks by turning off non-urgent notifications.",
      "Schedule 20–30 minutes of physical activity, even if broken into chunks.",
      "If stress feels persistent, consider talking to a counselor or trusted mentor.",
    ],
  },
  {
    min: 0,
    label: "Needs Attention",
    color: "var(--score-attention)",
    headline: "Your wellbeing could use some support",
    summary:
      "Your current habits suggest meaningful strain — likely from a mix of high usage, low sleep, or elevated stress. Consider reaching out for support.",
    recommendations: [
      "Talk to someone you trust — a friend, family member, or counselor.",
      "Prioritize sleep first; even 30 extra minutes a night can help.",
      "Set app timers to reduce daily usage gradually rather than all at once.",
      "Build in short daily movement breaks to help regulate stress.",
    ],
  },
];

function getCategoryBand(score) {
  return CATEGORY_BANDS.find((band) => score >= band.min) || CATEGORY_BANDS[CATEGORY_BANDS.length - 1];
}

const REC_ICON = `<svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function renderResult(score) {
  const clamped = Math.max(0, Math.min(100, score));
  const band = getCategoryBand(clamped);

  const resultSection = $("#resultSection");
  resultSection.hidden = false;

  $("#resultScore").textContent = Math.round(clamped);
  $("#resultCategory").textContent = band.label;
  $("#resultCategory").style.color = band.color;
  $("#resultCategory").style.background = "rgba(255,255,255,0.06)";
  $("#resultHeadline").textContent = band.headline;
  $("#resultSummary").textContent = band.summary;

  const ring = $("#ringProgress");
  ring.style.stroke = band.color;
  // Reset then animate for a clean transition even on repeat submissions
  ring.style.transition = "none";
  ring.style.strokeDashoffset = RING_CIRCUMFERENCE;
  // Force reflow so the transition re-triggers
  void ring.getBoundingClientRect();
  ring.style.transition = "";
  const offset = RING_CIRCUMFERENCE * (1 - clamped / 100);
  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = offset;
  });

  const recList = $("#recommendations");
  recList.innerHTML = band.recommendations
    .map(
      (tip) => `
      <div class="recommendation-item">
        <span class="rec-icon">${REC_ICON}</span>
        <p>${tip}</p>
      </div>`
    )
    .join("");

  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ==========================================================================
   Submit handling
   ========================================================================== */
function setLoading(isLoading) {
  submitBtn.classList.toggle("loading", isLoading);
  submitBtn.disabled = isLoading;
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!validateForm()) {
    showToast({
      type: "error",
      title: "Check the form",
      message: "A few fields need your attention before we can run the assessment.",
    });
    const firstError = $(".field.has-error input, .field.has-error select");
    if (firstError) firstError.focus();
    return;
  }

  const payload = buildPayload();
  setLoading(true);

  try {
    const response = await fetch(PREDICT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = `Server responded with status ${response.status}.`;
      try {
        const errBody = await response.json();
        if (errBody?.detail) detail = String(errBody.detail);
      } catch (_) {
        /* ignore parse failure, keep default message */
      }
      throw new Error(detail);
    }

    const data = await response.json();
    const score = Number(data.predicted_mental_health_score);

    if (Number.isNaN(score)) {
      throw new Error("The server response didn't include a valid score.");
    }

    renderResult(score);
    showToast({
      type: "success",
      title: "Score generated",
      message: "Your mental wellness score is ready below.",
    });
  } catch (err) {
    const isNetworkError = err instanceof TypeError;
    showToast({
      type: "error",
      title: isNetworkError ? "Can't reach the model server" : "Prediction failed",
      message: isNetworkError
        ? "Make sure the FastAPI server is running at 127.0.0.1:8000 and CORS is enabled."
        : err.message || "Something went wrong while generating your score.",
      duration: 7000,
    });
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", handleSubmit);

/* ==========================================================================
   Retake button
   ========================================================================== */
$("#retakeBtn").addEventListener("click", () => {
  $("#resultSection").hidden = true;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});
