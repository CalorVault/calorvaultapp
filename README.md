# CalorVault

A fitness & calorie tracking app built with Expo (React Native + TypeScript).

## Features

- **Onboarding** — collects height, weight, age, sex, activity level, and goal
  (lose weight / maintain / gain / build muscle), then computes a daily
  calorie and macro (protein/carbs/fat) target using the Mifflin-St Jeor
  equation.
- **Camera food scan** — take a photo of your food and it's sent to Claude's
  vision API to identify the food and estimate calories/macros. Review and
  edit before saving.
- **Voice logging** — describe what you ate out loud; on-device speech
  recognition transcribes it, then Claude estimates the nutrition.
- **Manual entry** — search-free manual food/macro entry as a fallback.
- **Today screen** — calorie budget, remaining calories, and macro progress
  bars for the current day.
- **History** — a week strip (days of the week) showing at a glance whether
  each day was under/near/over target, plus a scrollable list of past days.
  Tap any day to see everything logged that day.
- **Settings** — edit body stats/goal (plan recalculates automatically),
  manage your Claude API key, reset all local data.

## Data & privacy

All data (profile, daily plan, food log history) is stored **locally on
device** via `AsyncStorage` — there is no backend server and no account
system. Nothing is synced or uploaded except the two AI calls below.

## AI recognition

Camera and voice logging call the Anthropic Claude API directly from the
app using an API key you enter in **Settings**. This is convenient for a
prototype, but note that **embedding an API key in a client app is not
secure for production** — a determined user can extract it from the app
bundle/network traffic. Before shipping this to real users, proxy those
calls through a small backend that holds the key server-side.

Get a key at https://console.anthropic.com/ and paste it into Settings →
AI food recognition.

## Getting started

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go for the manual-entry flow. Camera scanning
and voice logging use native modules (`expo-camera`,
`expo-speech-recognition`) that require a **development build** rather than
Expo Go:

```bash
npx expo prebuild
npx expo run:ios      # or: npx expo run:android
```

## Project structure

```
App.tsx                     — app entry, providers
src/
  types/                    — shared TypeScript types
  theme.ts                  — color/spacing tokens
  lib/
    calorieCalc.ts          — BMR/TDEE/macro math, unit conversions
    aiFood.ts                — Claude API calls for photo/voice → nutrition
  storage/db.ts              — AsyncStorage persistence layer
  context/AppContext.tsx     — profile/plan/today's-log app state
  navigation/                — bottom tabs + stack navigator
  screens/                   — Onboarding, Home, LogFood, History,
                                DayDetail, Settings
  components/                — CalorieSummary, MacroBars, ProgressBar,
                                FoodEntryRow, WeekStrip
```

## Known limitations

- Not tested on a physical device/simulator in this environment — the app
  typechecks and bundles cleanly (`npx tsc --noEmit`, `npx expo export`),
  but the camera/voice/onboarding flows should be smoke-tested on a real
  device before relying on them.
- No multi-device sync (by design — local storage only, see above).
- Speech recognition language is hardcoded to `en-US`.
