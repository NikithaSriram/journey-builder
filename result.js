const resultContainer = document.getElementById("resultContainer");
const endMonthInput = document.getElementById("endMonthInput");
const screenshotButton = document.getElementById("screenshotButton");
const screenshotMessage = document.getElementById("screenshotMessage");
const resultCaptureArea = document.getElementById("resultCaptureArea");

const CONFIGURED_END_MONTH = "2027-04";
const TIMELINE_TYPES = ["Live360", "TnD", "OneShot", "Revision"];
const MONTH_WIDTH = 92;

const EXAM_CONFIG = {
  inicet_may: {
    label: "INICET May 2026",
    summary: "Revision-first plan",
    steps: [{ type: "Revision", duration: 1 }],
  },
  neet_pg: {
    label: "NEET PG August 2026",
    summary: "LiveTnD Plan - 4 Months",
    steps: [
      { type: "OneShot", duration: 0.33 },
      { type: "TnD", duration: 3 },
      { type: "Revision", duration: 1 },
    ],
  },
  inicet_nov: {
    label: "INICET November 2026",
    summary: "LiveTnD Plan - 6 Months",
    steps: [
      { type: "OneShot", duration: 0.33 },
      { type: "TnD", duration: 4 },
      { type: "Revision", duration: 2 },
    ],
  },
  next_year: {
    label: "Next year or later",
    summary: "Live360 - 9+1 Months Plan",
    steps: [
      { type: "Live360", duration: 6 },
      { type: "TnD", duration: 3 },
      { type: "OneShot", duration: 0.33 },
      { type: "Revision", duration: 2 },
    ],
  },
};

const EXAM_DATE_MAP = {
  inicet_may: {
    date: "2026-05-16",
    label: "INICET May 2026",
    status: "confirmed",
  },
  neet_pg: {
    date: "2026-08-30",
    label: "NEET PG 2026",
    status: "confirmed",
  },
  inicet_nov: {
    date: "2026-11-08",
    label: "INICET Nov 2026",
    status: "tentative",
  },
};

const TYPE_CLASS_MAP = {
  Live360: "timeline-bar--live360",
  TnD: "timeline-bar--tnd",
  OneShot: "timeline-bar--oneshot",
  Revision: "timeline-bar--revision",
};

const state = {
  axisStartDate: startOfMonth(new Date()),
  configuredEndDate: parseMonthValue(CONFIGURED_END_MONTH),
  selectedPlans: [],
  timelineMonths: [],
};

const dragState = {
  active: false,
  mode: "move",
  planIndex: null,
  stepIndex: null,
  pointerId: null,
  startPointerX: 0,
  initialStartIndex: 0,
  initialDuration: 0,
};

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseMonthValue(value) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function formatMonthValue(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function formatMonthLabel(date) {
  return date.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatShortMonthDay(date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function diffInMonths(startDate, endDate) {
  return (
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth())
  );
}

function formatDuration(duration) {
  if (duration < 1) {
    const days = Math.max(1, Math.round(duration * 30));
    return `${days} days`;
  }

  return Number.isInteger(duration) ? `${duration} mo` : `${duration.toFixed(2)} mo`;
}

function getExamIndicator(plan) {
  const examConfig = EXAM_DATE_MAP[plan.examKey];

  if (!examConfig) {
    return null;
  }

  const examDate = new Date(`${examConfig.date}T00:00:00`);
  const examMonthStart = startOfMonth(examDate);
  const monthIndex = diffInMonths(state.axisStartDate, examMonthStart);
  const position = monthIndex + examDate.getDate() / 30;

  if (position < 0 || position > state.timelineMonths.length) {
    return null;
  }

  return {
    ...examConfig,
    dateObject: examDate,
    left: position * MONTH_WIDTH,
  };
}

function getMinDuration(type) {
  return type === "OneShot" ? 0.33 : 1;
}

function getStepEnd(step) {
  return step.startIndex + step.duration;
}

function getPreviousStepEnd(plan, stepIndex) {
  if (stepIndex === 0) {
    return 0;
  }

  return getStepEnd(plan.steps[stepIndex - 1]);
}

function getDateFromIndex(index) {
  return addMonths(state.axisStartDate, Math.floor(index));
}

function getInclusiveEndDate(step) {
  const span = Math.max(1, Math.ceil(step.duration));
  return addMonths(getDateFromIndex(step.startIndex), span - 1);
}

function createSequentialSteps(stepDefinitions, examKey) {
  let cursor = 0;

  return stepDefinitions.map((step, index) => {
    const duration = Math.max(0, Number(step.duration) || 0);
    const currentStep = {
      id: `${examKey}-${step.type.toLowerCase()}-${index}`,
      type: step.type,
      duration,
      startIndex: cursor,
    };

    cursor += duration;
    return currentStep;
  });
}

function createBaseSteps() {
  return TIMELINE_TYPES.map((type) => ({
    type,
    duration: 0,
  }));
}

function mergePlanSteps(configuredSteps) {
  const mergedSteps = createBaseSteps();

  configuredSteps.forEach((configuredStep) => {
    const matchingStep = mergedSteps.find((step) => step.type === configuredStep.type);

    if (!matchingStep) {
      return;
    }

    matchingStep.duration = Math.max(0, Number(configuredStep.duration) || 0);
  });

  return mergedSteps;
}

function buildPlanState(examKey) {
  const definition = EXAM_CONFIG[examKey];

  if (!definition) {
    return null;
  }

  return {
    examKey,
    label: definition.label,
    summary: definition.summary,
    steps: createSequentialSteps(mergePlanSteps(definition.steps), examKey),
  };
}

function getMaxPlanEnd(plans) {
  return plans.reduce((maxValue, plan) => {
    const planEnd = plan.steps.reduce((latest, step) => {
      return Math.max(latest, getStepEnd(step));
    }, 0);

    return Math.max(maxValue, planEnd);
  }, 0);
}

function normalizeConfiguredEndDate(date) {
  if (date < state.axisStartDate) {
    return state.axisStartDate;
  }

  return startOfMonth(date);
}

function buildTimelineMonths() {
  const configuredUnits =
    Math.max(0, diffInMonths(state.axisStartDate, state.configuredEndDate)) + 1;
  const requiredUnits = Math.ceil(getMaxPlanEnd(state.selectedPlans));
  const totalUnits = Math.max(configuredUnits, requiredUnits, 1);

  return Array.from({ length: totalUnits }, (_, index) => {
    const date = addMonths(state.axisStartDate, index);
    return {
      index,
      key: formatMonthValue(date),
      label: date.toLocaleString("en-US", { month: "short" }),
      year: date.getFullYear(),
    };
  });
}

function syncEndMonthInput() {
  endMonthInput.min = formatMonthValue(state.axisStartDate);
  endMonthInput.value = formatMonthValue(state.configuredEndDate);
}

async function downloadScreenshot() {
  screenshotMessage.textContent = "";

  if (typeof window.html2canvas !== "function") {
    screenshotMessage.textContent = "Screenshot is not available right now.";
    return;
  }

  screenshotButton.disabled = true;
  screenshotButton.textContent = "Preparing Screenshot...";

  try {
    const canvas = await window.html2canvas(resultCaptureArea, {
      backgroundColor: "#f4f7fb",
      scale: 2,
      useCORS: true,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "study-plan-timeline.png";
    link.click();

    screenshotMessage.textContent = "Screenshot downloaded.";
  } catch (error) {
    screenshotMessage.textContent = "Unable to capture screenshot. Please try again.";
  } finally {
    screenshotButton.disabled = false;
    screenshotButton.textContent = "Take Screenshot";
  }
}

function syncPlanSteps(plan, changedIndex) {
  plan.steps.forEach((step) => {
    const nextDuration = Math.max(0, Number(step.duration) || 0);
    step.duration = nextDuration > 0 ? Math.max(getMinDuration(step.type), nextDuration) : 0;
  });

  for (let index = 0; index < plan.steps.length; index += 1) {
    const previousEnd = index === 0 ? 0 : getStepEnd(plan.steps[index - 1]);

    if (index < changedIndex) {
      plan.steps[index].startIndex = Math.max(plan.steps[index].startIndex, previousEnd);
      continue;
    }

    if (index === changedIndex) {
      plan.steps[index].startIndex = Math.max(plan.steps[index].startIndex, previousEnd);
      continue;
    }

    plan.steps[index].startIndex = getStepEnd(plan.steps[index - 1]);
  }
}

function applyStepChange(planIndex, stepIndex, changes) {
  const plan = state.selectedPlans[planIndex];
  const step = plan.steps[stepIndex];

  if (typeof changes.startIndex === "number") {
    step.startIndex = Math.max(0, changes.startIndex);
  }

  if (typeof changes.duration === "number") {
    const nextDuration = Math.max(0, changes.duration);
    step.duration =
      nextDuration > 0 ? Math.max(getMinDuration(step.type), nextDuration) : 0;
  }

  syncPlanSteps(plan, stepIndex);
  state.timelineMonths = buildTimelineMonths();
  renderResults();
}

function createLegend() {
  const legend = document.createElement("div");
  legend.className = "timeline-legend";

  TIMELINE_TYPES.forEach((type) => {
    const item = document.createElement("div");
    item.className = "timeline-legend__item";

    const swatch = document.createElement("span");
    swatch.className = `timeline-legend__swatch timeline-legend__swatch--${type.toLowerCase()}`;

    const label = document.createElement("span");
    label.textContent = type;

    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  });

  return legend;
}

function createMonthAxis(board) {
  const axis = document.createElement("div");
  axis.className = "timeline-axis";

  const axisLabel = document.createElement("div");
  axisLabel.className = "timeline-axis-label";
  axisLabel.textContent = "Months";

  const monthRow = document.createElement("div");
  monthRow.className = "timeline-axis-months";

  state.timelineMonths.forEach((month) => {
    const monthCell = document.createElement("div");
    monthCell.className = "timeline-month";
    monthCell.innerHTML = `${month.label}<br>${month.year}`;
    monthRow.appendChild(monthCell);
  });

  axis.appendChild(axisLabel);
  axis.appendChild(monthRow);
  board.appendChild(axis);
}

function createExamLine(indicator, showLabel) {
  const line = document.createElement("div");
  line.className = `timeline-exam-line timeline-exam-line--${indicator.status}`;
  line.style.left = `${indicator.left}px`;
  line.title = `${indicator.label} - ${formatShortMonthDay(indicator.dateObject)} (${
    indicator.status === "confirmed" ? "Confirmed" : "Tentative"
  })`;

  if (showLabel) {
    const label = document.createElement("span");
    label.className = "timeline-exam-label";
    label.textContent =
      indicator.status === "tentative"
        ? `${indicator.label} (Tentative)`
        : indicator.label;
    line.appendChild(label);
  }

  return line;
}

function createTimelineRow(type, plan, indicator, showExamLabel) {
  const row = document.createElement("div");
  row.className = "timeline-row";

  const label = document.createElement("div");
  label.className = "timeline-row-label";
  label.textContent = type;

  const track = document.createElement("div");
  track.className = "timeline-track";

  if (indicator) {
    track.appendChild(createExamLine(indicator, showExamLabel));
  }

  const step = plan.steps.find((item) => item.type === type);

  if (step && step.duration > 0) {
    const bar = document.createElement("div");
    bar.className = `timeline-bar ${TYPE_CLASS_MAP[type]}`;
    bar.dataset.planIndex = `${state.selectedPlans.indexOf(plan)}`;
    bar.dataset.stepIndex = `${plan.steps.indexOf(step)}`;
    bar.style.left = `${step.startIndex * MONTH_WIDTH}px`;
    bar.style.width = `${step.duration * MONTH_WIDTH}px`;
    bar.title = `${type} | start ${formatMonthLabel(
      getDateFromIndex(step.startIndex)
    )} | duration ${formatDuration(step.duration)}`;

    const leftHandle = document.createElement("span");
    leftHandle.className = "timeline-resize-handle timeline-resize-handle--left";
    leftHandle.dataset.resize = "left";

    const labelText = document.createElement("span");
    labelText.className = "timeline-bar__label";
    labelText.textContent = `${type} (${formatDuration(step.duration)})`;

    const rightHandle = document.createElement("span");
    rightHandle.className = "timeline-resize-handle timeline-resize-handle--right";
    rightHandle.dataset.resize = "right";

    bar.appendChild(leftHandle);
    bar.appendChild(labelText);
    bar.appendChild(rightHandle);
    track.appendChild(bar);
  }

  row.appendChild(label);
  row.appendChild(track);

  return row;
}

function createControl(plan, planIndex, step, stepIndex) {
  const control = document.createElement("div");
  control.className = "timeline-control";
  control.dataset.planIndex = `${planIndex}`;
  control.dataset.stepIndex = `${stepIndex}`;
  control.dataset.type = step.type;

  const header = document.createElement("div");
  header.className = "timeline-control__header";

  const title = document.createElement("h3");
  title.className = "timeline-control__title";
  title.textContent = step.type;

  const meta = document.createElement("div");
  meta.className = "timeline-control__meta";
  meta.textContent =
    step.duration > 0
      ? `${formatMonthLabel(getDateFromIndex(step.startIndex))} to ${formatMonthLabel(
          getInclusiveEndDate(step)
        )}`
      : "No duration set yet";

  header.appendChild(title);
  header.appendChild(meta);

  const slider = document.createElement("input");
  slider.className = "timeline-slider";
  slider.type = "range";
  slider.min = "0";
  slider.max = `${Math.max(state.timelineMonths.length - getMinDuration(step.type), 0)}`;
  slider.step = "0.01";
  slider.value = step.startIndex.toFixed(2);

  const fieldGrid = document.createElement("div");
  fieldGrid.className = "timeline-control__grid";

  const startField = document.createElement("label");
  startField.className = "timeline-field";
  startField.innerHTML = '<span>Start month</span>';

  const startInput = document.createElement("input");
  startInput.type = "month";
  startInput.className = "timeline-range-start";
  startInput.min = formatMonthValue(state.axisStartDate);
  startInput.max = state.timelineMonths[state.timelineMonths.length - 1].key;
  startInput.value = formatMonthValue(getDateFromIndex(step.startIndex));

  const endField = document.createElement("label");
  endField.className = "timeline-field";
  endField.innerHTML = '<span>End month</span>';

  const endInput = document.createElement("input");
  endInput.type = "month";
  endInput.className = "timeline-range-end";
  endInput.min = formatMonthValue(state.axisStartDate);
  endInput.max = state.timelineMonths[state.timelineMonths.length - 1].key;
  endInput.value = formatMonthValue(getInclusiveEndDate(step));

  startField.appendChild(startInput);
  endField.appendChild(endInput);
  fieldGrid.appendChild(startField);
  fieldGrid.appendChild(endField);

  control.appendChild(header);
  control.appendChild(slider);
  control.appendChild(fieldGrid);

  return control;
}

function createTimelineSection(plan, planIndex) {
  const section = document.createElement("section");
  section.className = "timeline-section";

  const header = document.createElement("div");
  header.className = "timeline-section__header";

  const title = document.createElement("h2");
  title.textContent = plan.label;

  const summary = document.createElement("p");
  summary.className = "timeline-section__meta";
  summary.textContent = `${plan.summary}. Drag bars, resize them from either edge, move sliders, or edit the month range to customize the sequence.`;

  const note = document.createElement("p");
  note.className = "timeline-note";
  note.textContent = `Timeline starts in ${formatMonthLabel(
    state.axisStartDate
  )} and currently extends through ${formatMonthLabel(
    addMonths(state.axisStartDate, state.timelineMonths.length - 1)
  )}.`;

  header.appendChild(title);
  header.appendChild(summary);
  header.appendChild(note);
  header.appendChild(createLegend());

  const scroll = document.createElement("div");
  scroll.className = "timeline-scroll";

  const board = document.createElement("div");
  board.className = "timeline-board";
  board.style.setProperty("--month-count", state.timelineMonths.length);
  board.style.setProperty("--month-width", `${MONTH_WIDTH}px`);
  const examIndicator = getExamIndicator(plan);

  createMonthAxis(board);

  TIMELINE_TYPES.forEach((type, index) => {
    board.appendChild(createTimelineRow(type, plan, examIndicator, index === 0));
  });

  scroll.appendChild(board);

  const controls = document.createElement("div");
  controls.className = "timeline-controls";

  plan.steps.forEach((step, stepIndex) => {
    controls.appendChild(createControl(plan, planIndex, step, stepIndex));
  });

  section.appendChild(header);
  section.appendChild(scroll);
  section.appendChild(controls);

  return section;
}

function renderEmptyState() {
  resultContainer.innerHTML =
    '<p class="empty-state">No plan selected. Please go back and try again.</p>';
}

function renderResults() {
  resultContainer.innerHTML = "";

  if (!state.selectedPlans.length) {
    renderEmptyState();
    return;
  }

  state.selectedPlans.forEach((plan, planIndex) => {
    resultContainer.appendChild(createTimelineSection(plan, planIndex));
  });
}

function handleRangeUpdate(control) {
  const planIndex = Number(control.dataset.planIndex);
  const stepIndex = Number(control.dataset.stepIndex);
  const stepType = control.dataset.type;
  const startInput = control.querySelector(".timeline-range-start");
  const endInput = control.querySelector(".timeline-range-end");

  if (!startInput.value || !endInput.value) {
    return;
  }

  let startDate = parseMonthValue(startInput.value);
  let endDate = parseMonthValue(endInput.value);

  if (endDate < startDate) {
    endDate = startDate;
    endInput.value = startInput.value;
  }

  const startIndex = diffInMonths(state.axisStartDate, startDate);
  const inclusiveMonths = diffInMonths(startDate, endDate) + 1;
  const duration = stepType === "OneShot" && inclusiveMonths === 1 ? 0.33 : inclusiveMonths;

  applyStepChange(planIndex, stepIndex, { startIndex, duration });
}

function handleControlInput(event) {
  const control = event.target.closest(".timeline-control");

  if (!control) {
    return;
  }

  if (event.target.classList.contains("timeline-slider")) {
    applyStepChange(
      Number(control.dataset.planIndex),
      Number(control.dataset.stepIndex),
      { startIndex: Number(event.target.value) }
    );
    return;
  }

  if (
    event.target.classList.contains("timeline-range-start") ||
    event.target.classList.contains("timeline-range-end")
  ) {
    handleRangeUpdate(control);
  }
}

function handleBarPointerDown(event) {
  const bar = event.target.closest(".timeline-bar");

  if (!bar) {
    return;
  }

  const resizeHandle = event.target.closest(".timeline-resize-handle");

  dragState.active = true;
  dragState.mode = resizeHandle ? resizeHandle.dataset.resize : "move";
  dragState.planIndex = Number(bar.dataset.planIndex);
  dragState.stepIndex = Number(bar.dataset.stepIndex);
  dragState.pointerId = event.pointerId;
  dragState.startPointerX = event.clientX;
  dragState.initialStartIndex = state.selectedPlans[dragState.planIndex].steps[
    dragState.stepIndex
  ].startIndex;
  dragState.initialDuration = state.selectedPlans[dragState.planIndex].steps[
    dragState.stepIndex
  ].duration;

  document.body.classList.add("is-dragging");
  bar.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function handleBarPointerMove(event) {
  if (!dragState.active || event.pointerId !== dragState.pointerId) {
    return;
  }

  const deltaX = event.clientX - dragState.startPointerX;
  const deltaUnits = deltaX / MONTH_WIDTH;
  const plan = state.selectedPlans[dragState.planIndex];
  const step = plan.steps[dragState.stepIndex];
  const previousEnd = getPreviousStepEnd(plan, dragState.stepIndex);
  const stepEnd = dragState.initialStartIndex + dragState.initialDuration;

  if (dragState.mode === "move") {
    applyStepChange(dragState.planIndex, dragState.stepIndex, {
      startIndex: dragState.initialStartIndex + deltaUnits,
    });
    return;
  }

  if (dragState.mode === "right") {
    applyStepChange(dragState.planIndex, dragState.stepIndex, {
      duration: dragState.initialDuration + deltaUnits,
    });
    return;
  }

  if (dragState.mode === "left") {
    const minStartIndex = previousEnd;
    const maxStartIndex = stepEnd - getMinDuration(step.type);
    const nextStartIndex = Math.min(
      Math.max(dragState.initialStartIndex + deltaUnits, minStartIndex),
      maxStartIndex
    );

    applyStepChange(dragState.planIndex, dragState.stepIndex, {
      startIndex: nextStartIndex,
      duration: stepEnd - nextStartIndex,
    });
  }
}

function clearDragState() {
  dragState.active = false;
  dragState.mode = "move";
  dragState.planIndex = null;
  dragState.stepIndex = null;
  dragState.pointerId = null;
  dragState.startPointerX = 0;
  dragState.initialStartIndex = 0;
  dragState.initialDuration = 0;
  document.body.classList.remove("is-dragging");
}

function handleBarPointerUp(event) {
  if (!dragState.active || event.pointerId !== dragState.pointerId) {
    return;
  }

  clearDragState();
}

function initializeApp() {
  const params = new URLSearchParams(window.location.search);
  const examParam = params.get("exam");

  if (!examParam) {
    renderEmptyState();
    return;
  }

  const exams = examParam
    .split(",")
    .map((exam) => exam.trim())
    .filter(Boolean);

  state.selectedPlans = exams.map(buildPlanState).filter(Boolean);

  if (!state.selectedPlans.length) {
    renderEmptyState();
    return;
  }

  state.configuredEndDate = normalizeConfiguredEndDate(state.configuredEndDate);
  syncEndMonthInput();
  state.timelineMonths = buildTimelineMonths();
  renderResults();
}

endMonthInput.addEventListener("change", (event) => {
  if (!event.target.value) {
    syncEndMonthInput();
    return;
  }

  state.configuredEndDate = normalizeConfiguredEndDate(
    parseMonthValue(event.target.value)
  );
  syncEndMonthInput();
  state.timelineMonths = buildTimelineMonths();
  renderResults();
});

resultContainer.addEventListener("input", handleControlInput);
resultContainer.addEventListener("change", handleControlInput);
resultContainer.addEventListener("pointerdown", handleBarPointerDown);
window.addEventListener("pointermove", handleBarPointerMove);
window.addEventListener("pointerup", handleBarPointerUp);
window.addEventListener("pointercancel", handleBarPointerUp);
screenshotButton.addEventListener("click", downloadScreenshot);

initializeApp();
