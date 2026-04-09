/**
 * Tailwind Config Extensions for Flow Ops & TCM features.
 * 
 * Merge these into your tailwind.config.ts → theme.extend
 * Also add the plugin: require("tailwindcss-animate")
 */

// Add to theme.extend:
const tailwindExtensions = {
  fontFamily: {
    heading: ['Space Grotesk', 'sans-serif'],
    body: ['DM Sans', 'sans-serif'],
  },
  colors: {
    // Base shadcn colors (if not already present)
    border: "hsl(var(--border))",
    input: "hsl(var(--input))",
    ring: "hsl(var(--ring))",
    background: "hsl(var(--background))",
    foreground: "hsl(var(--foreground))",
    primary: {
      DEFAULT: "hsl(var(--primary))",
      foreground: "hsl(var(--primary-foreground))",
    },
    secondary: {
      DEFAULT: "hsl(var(--secondary))",
      foreground: "hsl(var(--secondary-foreground))",
    },
    destructive: {
      DEFAULT: "hsl(var(--destructive))",
      foreground: "hsl(var(--destructive-foreground))",
    },
    muted: {
      DEFAULT: "hsl(var(--muted))",
      foreground: "hsl(var(--muted-foreground))",
    },
    accent: {
      DEFAULT: "hsl(var(--accent))",
      foreground: "hsl(var(--accent-foreground))",
    },
    popover: {
      DEFAULT: "hsl(var(--popover))",
      foreground: "hsl(var(--popover-foreground))",
    },
    card: {
      DEFAULT: "hsl(var(--card))",
      foreground: "hsl(var(--card-foreground))",
    },
    
    // ---- ROLE COLORS (required for Flow Ops & TCM) ----
    "flow-ops": "hsl(var(--flow-ops))",
    tcm: "hsl(var(--tcm))",
    hr: "hsl(var(--hr))",
    
    // ---- STATUS COLORS ----
    success: "hsl(var(--success))",
    warning: "hsl(var(--warning))",
    danger: "hsl(var(--danger))",
    
    // ---- SURFACE LAYERS ----
    "surface-1": "hsl(var(--surface-1))",
    "surface-2": "hsl(var(--surface-2))",
    "surface-3": "hsl(var(--surface-3))",
    
    // ---- SIDEBAR ----
    sidebar: {
      DEFAULT: "hsl(var(--sidebar-background))",
      foreground: "hsl(var(--sidebar-foreground))",
      primary: "hsl(var(--sidebar-primary))",
      "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
      accent: "hsl(var(--sidebar-accent))",
      "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
      border: "hsl(var(--sidebar-border))",
      ring: "hsl(var(--sidebar-ring))",
    },
  },
  borderRadius: {
    lg: "var(--radius)",
    md: "calc(var(--radius) - 2px)",
    sm: "calc(var(--radius) - 4px)",
  },
  keyframes: {
    "accordion-down": {
      from: { height: "0" },
      to: { height: "var(--radix-accordion-content-height)" },
    },
    "accordion-up": {
      from: { height: "var(--radix-accordion-content-height)" },
      to: { height: "0" },
    },
    "pulse-glow": {
      "0%, 100%": { opacity: "1" },
      "50%": { opacity: "0.6" },
    },
    "slide-up": {
      from: { transform: "translateY(10px)", opacity: "0" },
      to: { transform: "translateY(0)", opacity: "1" },
    },
  },
  animation: {
    "accordion-down": "accordion-down 0.2s ease-out",
    "accordion-up": "accordion-up 0.2s ease-out",
    "pulse-glow": "pulse-glow 2s ease-in-out infinite",
    "slide-up": "slide-up 0.3s ease-out",
  },
};

export default tailwindExtensions;

// Don't forget the plugin:
// plugins: [require("tailwindcss-animate")]
