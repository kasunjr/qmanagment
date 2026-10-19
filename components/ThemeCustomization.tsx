"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, RotateCcw, Save, Trash2, Undo2 } from "lucide-react";

interface ThemeSettings {
  appName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  fontFamily: string;
  cornerRadius: "none" | "small" | "medium" | "large";
}

interface ApiTheme {
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  font_family: string;
  corner_radius: ThemeSettings["cornerRadius"];
}

const fromApi = (theme: ApiTheme): ThemeSettings => ({
  appName: theme.app_name,
  logoUrl: theme.logo_url,
  primaryColor: theme.primary_color,
  secondaryColor: theme.secondary_color,
  backgroundColor: theme.background_color,
  surfaceColor: theme.surface_color,
  textColor: theme.text_color,
  fontFamily: theme.font_family,
  cornerRadius: theme.corner_radius,
});

const DEFAULT_THEME: ThemeSettings = {
  appName: "Queue Management",
  logoUrl: null,
  primaryColor: "#4f46e5",
  secondaryColor: "#10b981",
  backgroundColor: "#f8fafc",
  surfaceColor: "#ffffff",
  textColor: "#1e293b",
  fontFamily: "system",
  cornerRadius: "medium",
};

const PRESETS: { name: string; colors: Pick<ThemeSettings, "primaryColor" | "secondaryColor" | "backgroundColor" | "surfaceColor" | "textColor"> }[] = [
  { name: "Indigo", colors: { primaryColor: "#4f46e5", secondaryColor: "#10b981", backgroundColor: "#f8fafc", surfaceColor: "#ffffff", textColor: "#1e293b" } },
  { name: "Ocean", colors: { primaryColor: "#0369a1", secondaryColor: "#f59e0b", backgroundColor: "#f0f9ff", surfaceColor: "#ffffff", textColor: "#0c4a6e" } },
  { name: "Forest", colors: { primaryColor: "#15803d", secondaryColor: "#ca8a04", backgroundColor: "#f7fee7", surfaceColor: "#ffffff", textColor: "#14532d" } },
  { name: "Sunset", colors: { primaryColor: "#c2410c", secondaryColor: "#7c3aed", backgroundColor: "#fff7ed", surfaceColor: "#ffffff", textColor: "#431407" } },
  { name: "Midnight", colors: { primaryColor: "#818cf8", secondaryColor: "#34d399", backgroundColor: "#0f172a", surfaceColor: "#1e293b", textColor: "#f1f5f9" } },
];

const FONTS: { value: string; label: string; css: string }[] = [
  { value: "system", label: "System default", css: "ui-sans-serif, system-ui, sans-serif" },
  { value: "serif", label: "Serif", css: "ui-serif, Georgia, serif" },
  { value: "rounded", label: "Rounded", css: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { value: "mono", label: "Monospace", css: "ui-monospace, Consolas, monospace" },
];

const RADIUS: Record<ThemeSettings["cornerRadius"], string> = {
  none: "0px",
  small: "4px",
  medium: "8px",
  large: "16px",
};

const COLOR_FIELDS: { key: keyof Pick<ThemeSettings, "primaryColor" | "secondaryColor" | "backgroundColor" | "surfaceColor" | "textColor">; label: string; hint: string }[] = [
  { key: "primaryColor", label: "Primary color", hint: "Main buttons and highlights" },
  { key: "secondaryColor", label: "Secondary color", hint: "Now serving and status accents" },
  { key: "backgroundColor", label: "Background color", hint: "Page background" },
  { key: "surfaceColor", label: "Surface color", hint: "Cards and panels" },
  { key: "textColor", label: "Text color", hint: "Headings and body text" },
];

const LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_LOGO_BYTES = 1024 * 1024;
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const isValid = HEX_PATTERN.test(draft);

  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mb-1.5 text-xs text-slate-500">{hint}</p>
      <div className="flex items-center gap-2">
        <input
          aria-label={`${label} picker`}
          className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={value}
        />
        <input
          aria-invalid={!isValid}
          aria-label={`${label} hex value`}
          className={`w-28 rounded border px-2 py-1.5 font-mono text-sm uppercase ${
            isValid ? "border-slate-300" : "border-red-400"
          }`}
          maxLength={7}
          onBlur={() => !isValid && setDraft(value)}
          onChange={(event) => {
            setDraft(event.target.value);
            if (HEX_PATTERN.test(event.target.value)) onChange(event.target.value.toLowerCase());
          }}
          value={draft}
        />
      </div>
    </div>
  );
}

function ThemePreview({ theme, variant }: { theme: ThemeSettings; variant: "customer" | "staff" }) {
  const radius = RADIUS[theme.cornerRadius];
  const font = FONTS.find((item) => item.value === theme.fontFamily)?.css;

  return (
    <div
      className="overflow-hidden border border-slate-300 shadow-sm"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor, fontFamily: font, borderRadius: radius }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ backgroundColor: theme.surfaceColor, borderBottom: `1px solid ${theme.textColor}1a` }}
      >
        {theme.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-7 w-7 object-contain" src={theme.logoUrl} />
        ) : (
          <span
            className="flex h-7 w-7 items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: theme.primaryColor, borderRadius: radius }}
          >
            {theme.appName.trim().charAt(0).toUpperCase() || "Q"}
          </span>
        )}
        <span className="truncate text-sm font-bold">{theme.appName || "Queue Management"}</span>
        <span className="ml-auto text-xs opacity-60">{variant === "customer" ? "Customer" : "Staff"}</span>
      </div>

      {variant === "customer" ? (
        <div className="space-y-3 p-4">
          <p className="text-base font-bold">Get your ticket</p>
          <div className="space-y-2 p-3" style={{ backgroundColor: theme.surfaceColor, borderRadius: radius }}>
            <p className="text-xs opacity-70">Select a service</p>
            {["Cash deposit", "Account opening"].map((service, index) => (
              <div
                key={service}
                className="px-3 py-2 text-xs"
                style={{
                  borderRadius: radius,
                  border: `1px solid ${index === 0 ? theme.primaryColor : `${theme.textColor}26`}`,
                  backgroundColor: index === 0 ? `${theme.primaryColor}14` : "transparent",
                  fontWeight: index === 0 ? 600 : 400,
                }}
              >
                {service}
              </div>
            ))}
          </div>
          <button
            className="w-full py-2 text-xs font-bold text-white"
            style={{ backgroundColor: theme.primaryColor, borderRadius: radius }}
            tabIndex={-1}
            type="button"
          >
            Book ticket
          </button>
          <div className="flex items-center justify-between p-3" style={{ backgroundColor: theme.surfaceColor, borderRadius: radius }}>
            <span className="text-xs opacity-70">Your ticket</span>
            <span className="text-xl font-extrabold" style={{ color: theme.secondaryColor }}>042</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="p-4 text-white" style={{ backgroundColor: theme.secondaryColor, borderRadius: radius }}>
            <p className="text-[10px] font-bold uppercase opacity-80">Now serving</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <span className="text-3xl font-extrabold leading-none">041</span>
              <span className="truncate text-xs">Nimal · Cash deposit</span>
            </div>
          </div>
          <button
            className="w-full py-2 text-xs font-bold text-white"
            style={{ backgroundColor: theme.primaryColor, borderRadius: radius }}
            tabIndex={-1}
            type="button"
          >
            Call next customer
          </button>
          <div className="divide-y p-1" style={{ backgroundColor: theme.surfaceColor, borderRadius: radius, borderColor: `${theme.textColor}1a` }}>
            {["Kamal · Loan enquiry", "Saman · Card replacement"].map((row, index) => (
              <div key={row} className="flex justify-between px-2 py-1.5 text-xs" style={{ borderColor: `${theme.textColor}1a` }}>
                <span className="truncate">{row}</span>
                <span className="opacity-60">{index + 2} min</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ThemeCustomization({ accessToken }: { accessToken: string }) {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [savedTheme, setSavedTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [logoError, setLogoError] = useState("");
  const [previewVariant, setPreviewVariant] = useState<"customer" | "staff">("customer");
  const isDirty = JSON.stringify(theme) !== JSON.stringify(savedTheme);
  // Read through a ref so a token refresh does not reload the theme and drop unsaved edits.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/theme", {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as
          | { theme?: ApiTheme; error?: string }
          | null;
        if (!response.ok || !result?.theme) {
          throw new Error(result?.error || "Unable to load theme.");
        }
        const loaded = fromApi(result.theme);
        setTheme(loaded);
        setSavedTheme(loaded);
        setLoadError("");
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Unable to load theme.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const update = <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => {
    setSaveMessage("");
    setTheme((current) => ({ ...current, [key]: value }));
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoError("Use a PNG, JPG, SVG or WebP image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo must be 1 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoError("");
      update("logoUrl", reader.result as string);
    };
    reader.onerror = () => setLogoError("Unable to read the selected file.");
    reader.readAsDataURL(file);
  };

  const saveThemeSettings = async () => {
    if (!isDirty || isSaving) return;
    if (!theme.appName.trim()) {
      setSaveError("Display name is required.");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");
    const payload: Record<string, unknown> = {
      app_name: theme.appName.trim(),
      primary_color: theme.primaryColor,
      secondary_color: theme.secondaryColor,
      background_color: theme.backgroundColor,
      surface_color: theme.surfaceColor,
      text_color: theme.textColor,
      font_family: theme.fontFamily,
      corner_radius: theme.cornerRadius,
    };
    // The logo is only sent when it changed, to avoid re-uploading it on every save.
    if (theme.logoUrl !== savedTheme.logoUrl) payload.logo = theme.logoUrl;

    try {
      const response = await fetch("/api/theme", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | { theme?: ApiTheme; error?: string }
        | null;
      if (!response.ok || !result?.theme) {
        throw new Error(result?.error || "Unable to save theme.");
      }
      const saved = fromApi(result.theme);
      setTheme(saved);
      setSavedTheme(saved);
      setSaveMessage("Theme saved.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save theme.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-slate-500" role="status">Loading theme...</p>;
  }
  if (loadError) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
        {loadError}
      </p>
    );
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">App theme</h3>
          <p className="text-sm text-slate-500">
            Applies to both the staff counter and the customer app.
          </p>
        </div>

        <section aria-labelledby="branding-title" className="space-y-4">
          <h4 className="text-sm font-bold uppercase text-slate-500" id="branding-title">Branding</h4>
          <label className="block max-w-md space-y-1.5 text-sm font-medium text-slate-700">
            Display name
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
              maxLength={60}
              onChange={(event) => update("appName", event.target.value)}
              value={theme.appName}
            />
          </label>

          <div>
            <p className="text-sm font-medium text-slate-700">Logo</p>
            <p className="mb-2 text-xs text-slate-500">PNG, JPG, SVG or WebP, up to 1 MB. Square images work best.</p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
                {theme.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="Logo preview" className="h-full w-full object-contain" src={theme.logoUrl} />
                ) : (
                  <ImagePlus className="h-6 w-6 text-slate-400" />
                )}
              </div>
              <label className="cursor-pointer rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-within:ring-2 focus-within:ring-indigo-300">
                {theme.logoUrl ? "Replace logo" : "Upload logo"}
                <input accept={LOGO_TYPES.join(",")} className="sr-only" onChange={handleLogoChange} type="file" />
              </label>
              {theme.logoUrl && (
                <button
                  className="flex items-center gap-1 rounded px-2 py-2 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => update("logoUrl", null)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              )}
            </div>
            {logoError && <p className="mt-2 text-sm text-red-600" role="alert">{logoError}</p>}
          </div>
        </section>

        <section aria-labelledby="colors-title" className="space-y-4">
          <h4 className="text-sm font-bold uppercase text-slate-500" id="colors-title">Colors</h4>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => {
                const isActive = COLOR_FIELDS.every(({ key }) => theme[key] === preset.colors[key]);
                return (
                  <button
                    key={preset.name}
                    aria-pressed={isActive}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                      isActive ? "border-indigo-500 bg-indigo-50 font-semibold text-indigo-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setSaveMessage("");
                      setTheme((current) => ({ ...current, ...preset.colors }));
                    }}
                    type="button"
                  >
                    <span className="flex -space-x-1">
                      {[preset.colors.primaryColor, preset.colors.secondaryColor, preset.colors.backgroundColor].map((color) => (
                        <span key={color} className="h-4 w-4 rounded-full border border-white" style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {COLOR_FIELDS.map((field) => (
              <ColorField
                key={field.key}
                hint={field.hint}
                label={field.label}
                onChange={(value) => update(field.key, value)}
                value={theme[field.key]}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="style-title" className="space-y-4">
          <h4 className="text-sm font-bold uppercase text-slate-500" id="style-title">Typography &amp; shape</h4>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Font
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
                onChange={(event) => update("fontFamily", event.target.value)}
                value={theme.fontFamily}
              >
                {FONTS.map((font) => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-slate-700">Corner style</legend>
              <div className="flex rounded border border-slate-300 p-0.5">
                {(Object.keys(RADIUS) as ThemeSettings["cornerRadius"][]).map((option) => (
                  <label
                    key={option}
                    className={`flex-1 cursor-pointer rounded px-2 py-1.5 text-center text-sm capitalize focus-within:ring-2 focus-within:ring-indigo-300 ${
                      theme.cornerRadius === option ? "bg-indigo-600 font-semibold text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      checked={theme.cornerRadius === option}
                      className="sr-only"
                      name="corner-radius"
                      onChange={() => update("cornerRadius", option)}
                      type="radio"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <p aria-live="polite" className="mr-auto text-sm">
            {saveError ? (
              <span className="text-red-600" role="alert">{saveError}</span>
            ) : saveMessage ? (
              <span className="text-emerald-700">{saveMessage}</span>
            ) : isDirty ? (
              <span className="text-amber-700">Unsaved changes</span>
            ) : null}
          </p>
          <button
            className="flex items-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={() => {
              setSaveMessage("");
              setTheme({ ...DEFAULT_THEME, logoUrl: theme.logoUrl });
            }}
            title="Restore default name, colors, font and corners. The logo is kept."
            type="button"
          >
            <RotateCcw className="h-4 w-4" /> Reset to default
          </button>
          <button
            className="flex items-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isDirty || isSaving}
            onClick={() => {
              setTheme(savedTheme);
              setSaveError("");
              setLogoError("");
            }}
            type="button"
          >
            <Undo2 className="h-4 w-4" /> Discard changes
          </button>
          <button
            className="flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!isDirty || isSaving}
            onClick={() => void saveThemeSettings()}
            type="button"
          >
            <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save theme"}
          </button>
        </div>
      </div>

      <aside aria-label="Theme preview" className="xl:sticky xl:top-6 xl:self-start">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold uppercase text-slate-500">Live preview</h4>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
            {(["customer", "staff"] as const).map((variant) => (
              <button
                key={variant}
                aria-pressed={previewVariant === variant}
                className={`rounded-md px-3 py-1 ${
                  previewVariant === variant ? "bg-white font-semibold text-slate-800 shadow-sm" : "text-slate-600"
                }`}
                onClick={() => setPreviewVariant(variant)}
                type="button"
              >
                {variant === "customer" ? "Customer app" : "Staff counter"}
              </button>
            ))}
          </div>
        </div>
        <ThemePreview theme={theme} variant={previewVariant} />
      </aside>
    </div>
  );
}
