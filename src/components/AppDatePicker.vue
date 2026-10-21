<template>
  <div
    ref="root"
    class="app-date-picker"
    :class="{
      'app-date-picker--align-end': align === 'end',
      'app-date-picker--trigger-only': triggerOnly,
      'is-active': Boolean(modelValue),
      'is-open': open,
    }"
  >
    <input
      v-if="!triggerOnly"
      :value="inputText"
      class="input input-ghost app-date-picker__input"
      type="text"
      inputmode="none"
      :placeholder="placeholder"
      :aria-label="ariaLabel || undefined"
      autocomplete="off"
      readonly
      :disabled="disabled"
      @click="openDatePicker"
    />
    <button
      type="button"
      class="btn btn-ghost btn-square btn-sm app-date-picker__trigger"
      :aria-label="ariaLabel || '选择日期'"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :disabled="disabled"
      @click="openDatePicker"
    >
      <CalendarDays :size="14" :stroke-width="2.2" />
      <span v-if="triggerOnly && inputText" class="app-date-picker__value">
        {{ inputText }}
      </span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="calendar"
        class="card rounded-box border border-base-300 bg-base-100 shadow-2xl app-date-picker__calendar"
        :style="calendarStyle"
        :data-placement="calendarSide"
        role="dialog"
        :aria-label="ariaLabel || '选择日期'"
        @click.stop
      >
        <div class="app-date-picker__calendar-head">
          <button
            type="button"
            class="btn btn-ghost btn-square btn-xs app-date-picker__calendar-nav"
            aria-label="上个月"
            @click="shiftCalendarMonth(-1)"
          >
            <ChevronLeft :size="15" />
          </button>
          <strong>{{ calendarMonthLabel }}</strong>
          <button
            type="button"
            class="btn btn-ghost btn-square btn-xs app-date-picker__calendar-nav"
            aria-label="下个月"
            @click="shiftCalendarMonth(1)"
          >
            <ChevronRight :size="15" />
          </button>
        </div>
        <div class="app-date-picker__calendar-weekdays">
          <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
        </div>
        <div class="app-date-picker__calendar-days">
          <button
            v-for="(day, index) in calendarDays"
            :key="day ? day.date : 'empty-' + index"
            type="button"
            class="btn btn-ghost btn-xs app-date-picker__calendar-day"
            :class="calendarDayClass(day)"
            :disabled="calendarDayDisabled(day)"
            @click="selectCalendarDate(day?.date)"
          >
            {{ day?.day }}
          </button>
        </div>
        <div class="app-date-picker__calendar-foot">
          <button class="btn btn-link btn-xs text-primary" type="button" @click="clearDate">清除</button>
          <button class="btn btn-link btn-xs text-primary" type="button" @click="selectToday">今天</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-vue-next";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type CSSProperties,
} from "vue";
import { calculateCalendarPlacement } from "./calendarPlacement";

type CalendarDay = {
  date: string;
  day: number;
};

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    min?: string;
    max?: string;
    placeholder?: string;
    ariaLabel?: string;
    referenceTime?: number | null;
    disabledDate?: (date: string) => boolean;
    align?: "start" | "end";
    triggerOnly?: boolean;
    disabled?: boolean;
  }>(),
  {
    modelValue: "",
    min: "",
    max: "",
    placeholder: "YYYY/MM/DD",
    ariaLabel: "",
    referenceTime: null,
    align: "start",
    triggerOnly: false,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const root = ref<globalThis.HTMLElement | null>(null);
const calendar = ref<globalThis.HTMLElement | null>(null);
const calendarStyle = ref<CSSProperties>({ visibility: "hidden" });
const calendarSide = ref("bottom");
let calendarObserver: ResizeObserver | null = null;
let placementFrame: number | null = null;
const open = ref(false);
const inputText = ref(formatDisplayDate(props.modelValue));
const calendarYear = ref(new Date().getFullYear());
const calendarMonth = ref(new Date().getMonth());
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

const calendarMonthLabel = computed(
  () => `${calendarYear.value}年${calendarMonth.value + 1}月`,
);
const calendarDays = computed<Array<CalendarDay | null>>(() => {
  const firstDay = new Date(
    Date.UTC(calendarYear.value, calendarMonth.value, 1),
  ).getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(calendarYear.value, calendarMonth.value + 1, 0),
  ).getUTCDate();

  return Array.from({ length: firstDay + daysInMonth }, (_, index) => {
    if (index < firstDay) return null;

    const day = index - firstDay + 1;
    return {
      day,
      date: [
        String(calendarYear.value),
        String(calendarMonth.value + 1).padStart(2, "0"),
        String(day).padStart(2, "0"),
      ].join("-"),
    };
  });
});

watch(
  () => props.modelValue,
  (value) => {
    inputText.value = formatDisplayDate(value);
  },
);

watch(() => props.disabled, (disabled) => {
  if (disabled) open.value = false;
});

watch(open, async (isOpen, _, onCleanup) => {
  let active = true;
  onCleanup(() => {
    active = false;
    stopCalendarTracking();
  });
  calendarStyle.value = { visibility: "hidden" };
  if (!isOpen) return;

  await nextTick();
  if (!active || !root.value || !calendar.value) return;
  updateCalendarPlacement();
  if (!open.value) return;

  calendarObserver = new ResizeObserver(queueCalendarPlacement);
  calendarObserver.observe(root.value);
  calendarObserver.observe(calendar.value);
  const dialog = root.value.closest('[role="dialog"]');
  if (dialog) calendarObserver.observe(dialog);
});

watch(
  [calendarYear, calendarMonth, () => props.align],
  queueCalendarPlacement,
  { flush: "post" },
);

function queueCalendarPlacement(): void {
  if (!open.value || placementFrame !== null) return;
  placementFrame = window.requestAnimationFrame(() => {
    placementFrame = null;
    updateCalendarPlacement();
  });
}

function stopCalendarTracking(): void {
  calendarObserver?.disconnect();
  calendarObserver = null;
  if (placementFrame !== null) window.cancelAnimationFrame(placementFrame);
  placementFrame = null;
}

function updateCalendarPlacement(): void {
  if (!open.value || !root.value || !calendar.value) return;

  const viewport = window.visualViewport;
  const boundary = {
    top: viewport?.offsetTop ?? 0,
    left: viewport?.offsetLeft ?? 0,
    bottom:
      (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight),
    right: (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth),
  };
  const trigger = root.value.getBoundingClientRect();
  const visibleTrigger = { ...boundary };
  let zIndex = 40;

  // The calendar escapes clipping containers, but closes if its input scrolls
  // out of view. Keep it above the sheet or modal that owns the input.
  for (
    let ancestor = root.value.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    const style = window.getComputedStyle(ancestor);
    zIndex = Math.max(zIndex, (Number.parseInt(style.zIndex, 10) || 0) + 1);
    const bounds = ancestor.getBoundingClientRect();
    if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) {
      visibleTrigger.left = Math.max(visibleTrigger.left, bounds.left);
      visibleTrigger.right = Math.min(visibleTrigger.right, bounds.right);
    }
    if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) {
      visibleTrigger.top = Math.max(visibleTrigger.top, bounds.top);
      visibleTrigger.bottom = Math.min(visibleTrigger.bottom, bounds.bottom);
    }
  }
  if (
    trigger.bottom <= visibleTrigger.top ||
    trigger.top >= visibleTrigger.bottom ||
    trigger.right <= visibleTrigger.left ||
    trigger.left >= visibleTrigger.right
  ) {
    open.value = false;
    return;
  }

  // Measure after constraining the width, since a narrow viewport changes the
  // day-cell sizes. scrollHeight also includes rows hidden by the height cap.
  calendar.value.style.maxWidth = `${Math.max(0, boundary.right - boundary.left - 16)}px`;
  const bounds = calendar.value.getBoundingClientRect();
  const placement = calculateCalendarPlacement({
    trigger,
    boundary,
    width: bounds.width,
    height:
      calendar.value.scrollHeight +
      calendar.value.offsetHeight -
      calendar.value.clientHeight,
    align: props.align,
  });
  calendarSide.value = placement.side;
  calendarStyle.value = {
    top: `${placement.top}px`,
    left: `${placement.left}px`,
    maxWidth: `${placement.maxWidth}px`,
    maxHeight: `${placement.maxHeight}px`,
    zIndex,
    visibility: "visible",
  };
}

function formatDisplayDate(value: string): string {
  return value.replace(/-/g, "/");
}

function isAllowedDate(value: string): boolean {
  return (
    (!props.min || value >= props.min) &&
    (!props.max || value <= props.max) &&
    !props.disabledDate?.(value)
  );
}

function formatLocalDate(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function todayDate(): string {
  return formatLocalDate(props.referenceTime ?? Date.now());
}

function openDatePicker(): void {
  if (props.disabled) return;
  if (/^\d{4}-\d{2}-\d{2}$/.test(props.modelValue)) {
    calendarYear.value = Number(props.modelValue.slice(0, 4));
    calendarMonth.value = Number(props.modelValue.slice(5, 7)) - 1;
  } else {
    const date = new Date(props.referenceTime ?? Date.now());
    calendarYear.value = date.getFullYear();
    calendarMonth.value = date.getMonth();
  }
  open.value = true;
}

function shiftCalendarMonth(delta: number): void {
  const next = calendarMonth.value + delta;
  if (next < 0) {
    calendarYear.value -= 1;
    calendarMonth.value = 11;
  } else if (next > 11) {
    calendarYear.value += 1;
    calendarMonth.value = 0;
  } else {
    calendarMonth.value = next;
  }
}

function calendarDayClass(day: CalendarDay | null): Record<string, boolean> {
  if (!day) return {};
  return {
    "is-selected": props.modelValue === day.date,
    "is-today": day.date === todayDate(),
  };
}

function calendarDayDisabled(day: CalendarDay | null): boolean {
  return !day || !isAllowedDate(day.date);
}

function selectCalendarDate(date?: string): void {
  if (!date || !isAllowedDate(date)) return;
  setValue(date);
  open.value = false;
}

function clearDate(): void {
  setValue("");
  open.value = false;
}

function selectToday(): void {
  const today = todayDate();
  if (!isAllowedDate(today)) return;
  setValue(today);
  open.value = false;
}

function setValue(value: string): void {
  inputText.value = formatDisplayDate(value);
  emit("update:modelValue", value);
}

function onDocumentClick(event: globalThis.MouseEvent): void {
  const target = event.target;
  if (
    target instanceof globalThis.Node &&
    (root.value?.contains(target) || calendar.value?.contains(target))
  )
    return;
  open.value = false;
}

onMounted(() => {
  globalThis.document.addEventListener("click", onDocumentClick, true);
  globalThis.document.addEventListener("scroll", queueCalendarPlacement, true);
  window.addEventListener("resize", queueCalendarPlacement);
  window.visualViewport?.addEventListener("resize", queueCalendarPlacement);
  window.visualViewport?.addEventListener("scroll", queueCalendarPlacement);
});

onBeforeUnmount(() => {
  stopCalendarTracking();
  globalThis.document.removeEventListener("click", onDocumentClick, true);
  globalThis.document.removeEventListener(
    "scroll",
    queueCalendarPlacement,
    true,
  );
  window.removeEventListener("resize", queueCalendarPlacement);
  window.visualViewport?.removeEventListener("resize", queueCalendarPlacement);
  window.visualViewport?.removeEventListener("scroll", queueCalendarPlacement);
});
</script>

<style scoped>
.app-date-picker { position: relative; flex: 1 1 0; min-width: 0; }
.app-date-picker__input { width: 100%; min-height: 36px; padding-right: 38px; cursor: pointer; }
.app-date-picker__trigger { position: absolute; top: 50%; right: 3px; transform: translateY(-50%); }
.app-date-picker--trigger-only { flex: 0 0 36px; width: 36px; min-width: 36px; }
.app-date-picker--trigger-only .app-date-picker__trigger { position: static; transform: none; border: 1px solid var(--color-base-300); }
.app-date-picker--trigger-only.is-active { flex-basis: auto; width: auto; min-width: 0; }
.app-date-picker--trigger-only.is-active .app-date-picker__trigger { width: auto; padding-inline: 10px; background: color-mix(in srgb, var(--color-primary) 17%, var(--color-base-100)); color: var(--color-base-content); }
.app-date-picker__value { font-size: 12px; font-weight: 700; white-space: nowrap; }
.app-date-picker__calendar { position: fixed; z-index: 80; width: 270px; max-height: min(400px, 80vh); box-sizing: border-box; padding: 12px; overflow-y: auto; overscroll-behavior: contain; }
.app-date-picker__calendar-head { display: grid; grid-template-columns: 28px 1fr 28px; align-items: center; gap: 7px; margin-bottom: 9px; text-align: center; font-size: 13px; }
.app-date-picker__calendar-weekdays, .app-date-picker__calendar-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }
.app-date-picker__calendar-weekdays { margin-bottom: 4px; color: color-mix(in srgb, var(--color-base-content) 60%, transparent); font-size: 12px; font-weight: 700; text-align: center; }
.app-date-picker__calendar-day { width: 100%; min-width: 0; height: 32px; min-height: 32px; padding: 0; }
.app-date-picker__calendar-day.is-selected { background: var(--color-primary); color: var(--color-primary-content); }
.app-date-picker__calendar-day.is-today:not(.is-selected) { box-shadow: inset 0 0 0 1px var(--color-primary); color: var(--color-primary); }
.app-date-picker__calendar-day:disabled { opacity: .3; }
.app-date-picker__calendar-foot { display: flex; justify-content: space-between; margin-top: 9px; padding-top: 7px; border-top: 1px solid var(--color-base-300); }
</style>
