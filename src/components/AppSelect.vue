<template>
  <div
    ref="root"
    class="dropdown app-select"
    :class="{ 'dropdown-open': open, 'app-select--drop-up': dropUp }"
    @focusout="onFocusOut"
  >
    <button
      ref="trigger"
      type="button"
      class="btn btn-ghost app-select__trigger border-0 bg-base-200 font-medium text-base-content shadow-none"
      :class="{ 'text-base-content/55': !hasValue }"
      :aria-label="ariaLabel || undefined"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      :disabled="disabled"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="min-w-0 truncate">{{ displayLabel }}</span>
      <ChevronDown :size="16" class="shrink-0 text-base-content/60 transition-transform" :class="{ 'rotate-180': open }" />
    </button>
    <Transition name="app-select-drop" @after-leave="resetMenuPlacement">
      <ul
        v-if="open"
        :id="menuId"
        ref="menu"
        class="dropdown-content menu menu-sm app-select__menu rounded-box border border-base-300 bg-base-100 p-1.5 shadow-2xl"
        :style="menuStyle"
        role="listbox"
        :aria-label="ariaLabel || undefined"
        :aria-multiselectable="multiple || undefined"
        :aria-activedescendant="highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined"
        tabindex="-1"
        @keydown="onMenuKeydown"
      >
        <li v-for="(opt, index) in options" :key="opt.value" role="presentation">
          <button
            :id="optionId(index)"
            type="button"
            class="app-select__option w-full text-left"
            :class="{ 'app-select__option--selected': isSelected(opt.value), 'app-select__option--highlighted': highlightedIndex === index }"
            role="option"
            :aria-selected="isSelected(opt.value)"
            @mouseenter="highlightedIndex = index"
            @click.prevent="select(opt.value)"
          >
            <Check v-if="isSelected(opt.value)" :size="15" class="shrink-0 text-primary" />
            <span v-else class="inline-block size-[15px] shrink-0" aria-hidden="true" />
            <span class="min-w-0 truncate">{{ opt.label }}</span>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  useId,
  watch,
  type CSSProperties,
} from "vue";
import { Check, ChevronDown } from "lucide-vue-next";
import { calculateSelectPlacement } from "./selectPlacement";

export interface SelectOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | string[];
    options: SelectOption[];
    multiple?: boolean;
    placeholder?: string;
    maxMenuHeight?: number;
    ariaLabel?: string;
    disabled?: boolean;
  }>(),
  {
    multiple: false,
    placeholder: "请选择",
    maxMenuHeight: 320,
    ariaLabel: "",
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | string[]];
  change: [value: string | string[]];
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const menuId = `app-select-${useId()}`;
const highlightedIndex = ref(-1);
const dropUp = ref(false);
const menuPlacementReady = ref(false);
const menuMaxHeight = ref<number | null>(null);

const selectedValues = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue],
);

const hasValue = computed(
  () => selectedValues.value.length > 0 && !!selectedValues.value[0],
);

const displayLabel = computed(() => {
  if (!hasValue.value) return props.placeholder;
  const labels = props.options
    .filter((option) => selectedValues.value.includes(option.value))
    .map((option) => option.label);
  return labels.length ? labels.join(", ") : props.placeholder;
});

const menuStyle = computed<CSSProperties>(() => ({
  maxHeight:
    menuMaxHeight.value === null ? undefined : `${menuMaxHeight.value}px`,
  visibility: menuPlacementReady.value ? "visible" : "hidden",
}));

async function toggle() {
  if (props.disabled) return;
  if (open.value) {
    closeMenu();
    return;
  }
  highlightedIndex.value = props.options.length
    ? Math.max(0, props.options.findIndex((option) => isSelected(option.value)))
    : -1;
  open.value = true;
  menuPlacementReady.value = false;
  await nextTick();
  updateMenuPlacement();
  menuPlacementReady.value = true;
  menu.value?.focus();
  scrollHighlightedIntoView();
}

function closeMenu() {
  open.value = false;
}

function optionId(index: number): string {
  return `${menuId}-option-${index}`;
}

function scrollHighlightedIntoView(): void {
  const container = menu.value;
  const option = container?.children[highlightedIndex.value] as HTMLElement | undefined;
  if (!container || !option) return;
  const bounds = container.getBoundingClientRect();
  const optionBounds = option.getBoundingClientRect();
  if (optionBounds.top < bounds.top) container.scrollTop -= bounds.top - optionBounds.top;
  else if (optionBounds.bottom > bounds.bottom) container.scrollTop += optionBounds.bottom - bounds.bottom;
}

function moveHighlight(direction: number): void {
  if (!props.options.length) return;
  highlightedIndex.value = (highlightedIndex.value + direction + props.options.length) % props.options.length;
  scrollHighlightedIntoView();
}

function onTriggerKeydown(event: KeyboardEvent): void {
  if (props.disabled || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  if (!open.value) void toggle();
  else if (event.key === "ArrowDown" || event.key === "ArrowUp") moveHighlight(event.key === "ArrowDown" ? 1 : -1);
}

function onMenuKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveHighlight(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    highlightedIndex.value = event.key === "Home" ? 0 : props.options.length - 1;
    scrollHighlightedIntoView();
  } else if ((event.key === "Enter" || event.key === " ") && highlightedIndex.value >= 0) {
    event.preventDefault();
    const option = props.options[highlightedIndex.value];
    if (option) select(option.value);
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeMenu();
    trigger.value?.focus();
  }
}

function resetMenuPlacement() {
  if (open.value) return;
  dropUp.value = false;
  menuMaxHeight.value = null;
  menuPlacementReady.value = false;
}

function visibleBounds(element: HTMLElement): { top: number; bottom: number } {
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportBottom = viewport
    ? viewportTop + viewport.height
    : window.innerHeight;
  let top = viewportTop;
  let bottom = viewportBottom;

  for (
    let ancestor = element.parentElement;
    ancestor && ancestor !== document.body;
    ancestor = ancestor.parentElement
  ) {
    const overflowY = window.getComputedStyle(ancestor).overflowY;
    if (["auto", "scroll", "hidden", "clip"].includes(overflowY)) {
      const bounds = ancestor.getBoundingClientRect();
      top = Math.max(top, bounds.top);
      bottom = Math.min(bottom, bounds.bottom);
    }
  }

  return { top, bottom };
}

function updateMenuPlacement() {
  if (!open.value || !root.value || !menu.value) return;

  const triggerBounds = root.value.getBoundingClientRect();
  const visible = visibleBounds(root.value);
  const maxMenuHeight = Math.min(props.maxMenuHeight, window.innerHeight * 0.7);
  const placement = calculateSelectPlacement({
    triggerTop: triggerBounds.top,
    triggerBottom: triggerBounds.bottom,
    menuHeight: menu.value.scrollHeight,
    maxMenuHeight,
    boundaryTop: visible.top,
    boundaryBottom: visible.bottom,
  });
  dropUp.value = placement.side === "top";
  menuMaxHeight.value = placement.maxHeight;
}

function isSelected(value: string) {
  return selectedValues.value.includes(value);
}

function select(value: string) {
  if (props.multiple) {
    const next = [...selectedValues.value];
    const index = next.indexOf(value);
    if (index >= 0) {
      next.splice(index, 1);
    } else {
      next.push(value);
    }
    emit("update:modelValue", next);
    emit("change", next);
    return;
  }

  closeMenu();
  emit("update:modelValue", value);
  emit("change", value);
  trigger.value?.focus();
}

function onClickOutside(e: MouseEvent) {
  if (root.value && !e.composedPath().includes(root.value)) {
    closeMenu();
  }
}

function onFocusOut(event: FocusEvent): void {
  if (event.relatedTarget instanceof Node && root.value?.contains(event.relatedTarget)) return;
  closeMenu();
}

watch(() => props.disabled, (disabled) => {
  if (disabled) closeMenu();
});

onMounted(() => {
  document.addEventListener("click", onClickOutside, true);
  document.addEventListener("scroll", updateMenuPlacement, true);
  window.addEventListener("resize", updateMenuPlacement);
  window.visualViewport?.addEventListener("resize", updateMenuPlacement);
  window.visualViewport?.addEventListener("scroll", updateMenuPlacement);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onClickOutside, true);
  document.removeEventListener("scroll", updateMenuPlacement, true);
  window.removeEventListener("resize", updateMenuPlacement);
  window.visualViewport?.removeEventListener("resize", updateMenuPlacement);
  window.visualViewport?.removeEventListener("scroll", updateMenuPlacement);
});
</script>

<style scoped>
.app-select { position: relative; display: block; min-width: 152px; width: 100%; }
.app-select__trigger { display: flex; width: 100%; min-height: 36px; height: 36px; justify-content: space-between; white-space: normal; font-size: 14px; border-bottom: 2px solid transparent; }
.app-select__trigger:focus-visible { outline: none; border-bottom-color: var(--color-primary); }
.app-select__menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 60; min-width: 100%; max-height: min(320px, 70vh); overflow-y: auto; overscroll-behavior: contain; }
.app-select__menu .app-select__option { font-size: 14px; min-height: 36px; align-content: center; }
.app-select--drop-up .app-select__menu { top: auto; bottom: calc(100% + 6px); }
.app-select__option--selected { background: color-mix(in srgb, var(--color-primary) 14%, var(--color-base-100)); color: var(--color-base-content); font-weight: 650; }
.app-select__option--highlighted, .app-select__option:hover { background: color-mix(in srgb, var(--color-primary) 22%, var(--color-base-100)); }
.app-select-drop-enter-active, .app-select-drop-leave-active { transition: opacity 150ms ease, transform 150ms ease; }
.app-select-drop-enter-from, .app-select-drop-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
