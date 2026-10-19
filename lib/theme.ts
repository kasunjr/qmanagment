import { db } from "@/lib/db";
import { DEFAULT_APP_THEME } from "@/lib/theme-style";

export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] as const;
export const MAX_LOGO_BYTES = 1024 * 1024;
export const FONT_FAMILIES = ["system", "serif", "rounded", "mono"] as const;
export const CORNER_RADII = ["none", "small", "medium", "large"] as const;

type LogoMimeType = (typeof LOGO_MIME_TYPES)[number];

export interface ThemeResponse {
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  font_family: (typeof FONT_FAMILIES)[number];
  corner_radius: (typeof CORNER_RADII)[number];
  updated_at: Date | null;
}

export interface ThemeFields extends Omit<ThemeResponse, "logo_url" | "updated_at"> {
  // undefined keeps the stored logo, null removes it.
  logo?: { data: Buffer; mime_type: LogoMimeType } | null;
}

interface ThemeRow extends Omit<ThemeResponse, "logo_url"> {
  logo_data: Buffer | null;
  logo_mime_type: LogoMimeType | null;
}

export const DEFAULT_THEME: ThemeResponse = { ...DEFAULT_APP_THEME, updated_at: null };

const COLOR_FIELDS = [
  "primary_color",
  "secondary_color",
  "background_color",
  "surface_color",
  "text_color",
] as const;

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|svg\+xml|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function matchesMimeType(data: Buffer, mimeType: LogoMimeType): boolean {
  switch (mimeType) {
    case "image/png":
      return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/jpeg":
      return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    case "image/webp":
      return data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
    case "image/svg+xml": {
      const text = data.toString("utf8");
      // SVGs can carry scripts; reject anything active even though logos render through <img>.
      return /<svg[\s>]/i.test(text) &&
        !/<script|<foreignObject|\son[a-z]+\s*=|javascript:|<iframe|<embed|<object/i.test(text);
    }
  }
}

function parseLogo(value: unknown): { logo: ThemeFields["logo"]; error?: never } | { logo?: never; error: string } {
  if (value === null) return { logo: null };
  if (typeof value !== "string") return { error: "Logo must be an image data URL or null." };

  const match = DATA_URL_PATTERN.exec(value);
  if (!match) return { error: "Logo must be a PNG, JPG, SVG or WebP image." };

  const mimeType = match[1] as LogoMimeType;
  const data = Buffer.from(match[2], "base64");
  if (!data.length) return { error: "Logo image is empty." };
  if (data.length > MAX_LOGO_BYTES) return { error: "Logo must be 1 MB or smaller." };
  if (!matchesMimeType(data, mimeType)) return { error: "Logo file content does not match its image type or is not allowed." };

  return { logo: { data, mime_type: mimeType } };
}

export function validateThemeFields(
  value: unknown,
): { fields: ThemeFields; error?: never } | { fields?: never; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Request body must be a JSON object." };
  }

  const body = value as Record<string, unknown>;

  if (typeof body.app_name !== "string" || !body.app_name.trim() || body.app_name.trim().length > 60) {
    return { error: "Display name must be between 1 and 60 characters." };
  }

  const colors = {} as Record<(typeof COLOR_FIELDS)[number], string>;
  for (const field of COLOR_FIELDS) {
    const color = body[field];
    if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) {
      return { error: `${field.replace("_", " ")} must be a hex color like #1a2b3c.` };
    }
    colors[field] = color.toLowerCase();
  }

  if (!FONT_FAMILIES.includes(body.font_family as ThemeFields["font_family"])) {
    return { error: "Choose a supported font." };
  }
  if (!CORNER_RADII.includes(body.corner_radius as ThemeFields["corner_radius"])) {
    return { error: "Choose a supported corner style." };
  }

  const fields: ThemeFields = {
    app_name: body.app_name.trim(),
    ...colors,
    font_family: body.font_family as ThemeFields["font_family"],
    corner_radius: body.corner_radius as ThemeFields["corner_radius"],
  };

  if (Object.prototype.hasOwnProperty.call(body, "logo")) {
    const parsed = parseLogo(body.logo);
    if ("error" in parsed) return { error: parsed.error! };
    fields.logo = parsed.logo;
  }

  return { fields };
}

const themeColumns = `app_name, logo_data, logo_mime_type, primary_color, secondary_color,
  background_color, surface_color, text_color, font_family, corner_radius, updated_at`;

function toResponse(row: ThemeRow): ThemeResponse {
  const { logo_data, logo_mime_type, ...rest } = row;
  return {
    ...rest,
    logo_url: logo_data && logo_mime_type
      ? `data:${logo_mime_type};base64,${logo_data.toString("base64")}`
      : null,
  };
}

// Tenants that never saved a theme get the defaults.
export async function getTheme(tenantCode: string): Promise<ThemeResponse> {
  const result = await db.query<ThemeRow>(
    `SELECT ${themeColumns} FROM tenant_themes WHERE tenant_code = $1`,
    [tenantCode],
  );
  return result.rows[0] ? toResponse(result.rows[0]) : DEFAULT_THEME;
}

export async function saveTheme(tenantCode: string, fields: ThemeFields): Promise<ThemeResponse> {
  const keepLogo = fields.logo === undefined;
  const result = await db.query<ThemeRow>(
    `INSERT INTO tenant_themes (tenant_code, app_name, logo_data, logo_mime_type, primary_color,
       secondary_color, background_color, surface_color, text_color, font_family, corner_radius)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (tenant_code) DO UPDATE SET
       app_name = EXCLUDED.app_name,
       logo_data = CASE WHEN $12 THEN tenant_themes.logo_data ELSE EXCLUDED.logo_data END,
       logo_mime_type = CASE WHEN $12 THEN tenant_themes.logo_mime_type ELSE EXCLUDED.logo_mime_type END,
       primary_color = EXCLUDED.primary_color,
       secondary_color = EXCLUDED.secondary_color,
       background_color = EXCLUDED.background_color,
       surface_color = EXCLUDED.surface_color,
       text_color = EXCLUDED.text_color,
       font_family = EXCLUDED.font_family,
       corner_radius = EXCLUDED.corner_radius,
       updated_at = NOW()
     RETURNING ${themeColumns}`,
    [
      tenantCode,
      fields.app_name,
      fields.logo?.data ?? null,
      fields.logo?.mime_type ?? null,
      fields.primary_color,
      fields.secondary_color,
      fields.background_color,
      fields.surface_color,
      fields.text_color,
      fields.font_family,
      fields.corner_radius,
      keepLogo,
    ],
  );
  return toResponse(result.rows[0]);
}
