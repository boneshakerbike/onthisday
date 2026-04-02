# 8i11 - Functional & Structural Specification for Stitch

**Objective:** Redesign the UI for a Next.js/Tailwind application while preserving all existing routes, links, and functional categories.

---

## Project Structure (The "What")
The application is a central hub called **8i11**. It is organized into five core functional categories. Any redesign must include navigation or "landing pads" for these specific areas:

### 1. Tools (Functional Category)
- **Purpose:** Utilities for writing and development.
- **Required Links:**
  - Prompt Library (`/tools/prompt-library`)
  - Markdown Converter (`/tools/markdown`)
  - Knowledge Diff (`/tools/knowledge-diff`)
  - Instruction Stripper (`/tools/instruction-stripper`)
  - Text Cleaner (`/tools/text-cleaner`)
- **Admin Context:** This section includes a sub-group of external "Quick Links" to GitHub, Vercel, Anthropic, Turso, and Oura developer portals.

### 2. Creative (Functional Category)
- **Purpose:** AI-assisted journaling and story archival.
- **Required Links:**
  - On This Day (`/creative`)
  - Archive (`/creative/archive`)
  - What Am I Trying To Say (`/creative/text-cleaner`)

### 3. Health (Functional Category)
- **Purpose:** Visualization of fitness and biometric data.
- **Data Source:** Fetches from `/api/health`.
- **Required Links:**
  - Oura Ring (`/health/oura`)
  - Strava (`/health/strava`)
  - COROS (`/health/coros`)
  - Wellness Hub (`/health/wellness`)

### 4. Games (Functional Category)
- **Purpose:** Interactive web games and predictions.
- **Required Links:**
  - Frogger (`/games/frogger`)
  - Breakout (`/games/breakout`)
  - F1 Predictions (`/games/f1`)

### 5. Weather (Functional Category)
- **Purpose:** Information display.
- **Required Link:** Weather Display (`/weather`)

---

## Global Navigation Requirements
- **NavTabs Component:** A consistent navigation system (currently using Radix UI Dropdowns) is used across all pages.
- **Footer:** Must include links to Privacy Policy (`/privacy`) and Terms of Service (`/terms`).
- **Auth:** The UI needs a "Login" state/button (`/login`).

## Technical Specification for Export
- **Framework:** Next.js 16 (App Router).
- **Styling:** Tailwind CSS (v4).
- **Icons:** Use Lucide React or standard SVG icons.
- **Interactive States:** Ensure clean hover/active states for all buttons and cards.

## Redesign Goal
Take this structural map and the provided screenshot (if any) and create a **modern, cohesive, and high-fidelity UI**. Do not feel constrained by the current layout or color scheme; the goal is a complete visual overhaul that remains 100% functionally compatible with the existing routes.
