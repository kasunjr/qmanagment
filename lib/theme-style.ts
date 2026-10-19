import type { CSSProperties } from "react";

export interface AppTheme {
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  font_family: "system" | "serif" | "rounded" | "mono";
  corner_radius: "none" | "small" | "medium" | "large";
}

export const DEFAULT_APP_THEME: AppTheme = {
  app_name: "Queue Management",
  logo_url: null,
  primary_color: "#4f46e5",
  secondary_color: "#10b981",
  background_color: "#f8fafc",
  surface_color: "#ffffff",
  text_color: "#1e293b",
  font_family: "system",
  corner_radius: "medium",
};

const FONT_STACKS: Record<AppTheme["font_family"], string> = {
  system: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  rounded: "'Trebuchet MS', 'Segoe UI', sans-serif",
  mono: "ui-monospace, Consolas, monospace",
};

const RADII: Record<AppTheme["corner_radius"], string> = {
  none: "0px",
  small: "4px",
  medium: "8px",
  large: "16px",
};

function toChannels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Black or white, whichever reads better on the given color (WCAG relative luminance).
function readableOn(hex: string): string {
  const [r, g, b] = toChannels(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? "0 0 0" : "255 255 255";
}

// CSS variables consumed by the "theme" colors in tailwind.config.js.
export function themeStyle(theme: AppTheme): CSSProperties {
  const channels = (hex: string) => toChannels(hex).join(" ");
  return {
    "--qm-primary": channels(theme.primary_color),
    "--qm-on-primary": readableOn(theme.primary_color),
    "--qm-secondary": channels(theme.secondary_color),
    "--qm-on-secondary": readableOn(theme.secondary_color),
    "--qm-bg": channels(theme.background_color),
    "--qm-surface": channels(theme.surface_color),
    "--qm-text": channels(theme.text_color),
    "--qm-radius": RADII[theme.corner_radius],
    "--qm-font": FONT_STACKS[theme.font_family],
    backgroundColor: theme.background_color,
    color: theme.text_color,
    fontFamily: FONT_STACKS[theme.font_family],
  } as CSSProperties;
}
