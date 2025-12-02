# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SOAP Voice is a PWA for massage therapists that converts voice recordings into structured SOAP notes. The app uses voice recording → transcription (Deepgram) → AI processing (Claude) to generate professional medical documentation.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Storage)
- **Voice**: Browser MediaRecorder API (webm/opus)
- **Transcription**: Deepgram API (Nova-2 model)
- **AI**: Claude API for SOAP note generation
- **PWA**: next-pwa for installability

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### App Router Structure
```
/app
  /(app)/           # Protected routes with bottom nav
    page.tsx        # Home - record button + recent sessions
    /clients/       # Client management
    /history/       # Session history
    /record/        # Recording flow
    /sessions/      # Session detail view
  /login/           # Magic link auth
  /auth/callback/   # Auth callback handler
  /api/
    /transcribe/    # Deepgram integration
    /generate-soap/ # Claude API integration
```

### Key Files
- `middleware.ts` - Auth protection, redirects unauthenticated users to /login
- `lib/supabase.ts` - Browser Supabase client
- `lib/supabase-server.ts` - Server component Supabase client
- `hooks/useAudioRecorder.ts` - MediaRecorder hook for voice capture
- `supabase/schema.sql` - Database schema with RLS policies

### Recording Flow
1. User taps Record → MediaRecorder captures audio
2. Audio uploaded to Supabase Storage
3. POST /api/transcribe → Deepgram transcription
4. POST /api/generate-soap → Claude generates SOAP note
5. User reviews/edits, then saves to database

## Database Schema

Three main tables with RLS enabled:
- `therapists` - User profiles (references auth.users)
- `clients` - Client information per therapist
- `sessions` - SOAP notes with audio_url, transcript, soap_note (JSONB)

## Environment Variables

Required in `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEEPGRAM_API_KEY=
ANTHROPIC_API_KEY=
```

## SOAP Note Format

The AI generates structured notes with:
- **Subjective**: Client's reported symptoms, pain levels, concerns
- **Objective**: Observable findings, techniques used, tissue quality
- **Assessment**: Clinical interpretation, progress notes
- **Plan**: Recommendations, home care, follow-up timing
- save this analyzis for later
- save this as well for later
- save this plan for the future
- save thse latest finding and analysis so we have for later.
- save these stats as well