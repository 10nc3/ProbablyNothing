# WhatsApp to Calendar Bot

## Overview

This is an automated event creation system that converts WhatsApp invite messages into calendar events using AI-powered parsing. The application receives WhatsApp messages via Twilio, extracts event details using OpenAI's GPT-5, and creates calendar events in Google Calendar, Outlook, or custom endpoints.

The system operates as a polling-based bot that checks for new WhatsApp messages at configurable intervals, processes them through an AI parser, and automatically creates corresponding calendar events.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Library**: shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling

**Design System**: Follows the "new-york" style variant with a SaaS dashboard aesthetic inspired by products like Vercel, Stripe, and Linear. The design emphasizes progressive disclosure, clear visual hierarchy, and instant feedback.

**State Management**: TanStack Query (React Query) for server state management with custom query client configuration

**Routing**: Wouter for lightweight client-side routing

**Theme Support**: Custom theme provider supporting light/dark modes with persistent storage

**Key Design Decisions**:
- Component-based architecture with reusable UI primitives
- Form validation using React Hook Form with Zod resolvers
- Real-time data refetching at configurable intervals for status monitoring
- Responsive design with mobile-first approach
- Centralized API request handling through custom `apiRequest` utility

### Backend Architecture

**Runtime**: Node.js with Express.js framework

**Language**: TypeScript with ES modules

**API Pattern**: RESTful endpoints organized in a route handler pattern

**Key Services**:
1. **OpenAI Integration**: Uses Replit's AI Integrations service for GPT-5 access to parse invite messages into structured event data
2. **Twilio Integration**: Fetches WhatsApp messages via Twilio API with Basic Authentication
3. **Calendar Service**: Adapter pattern supporting multiple calendar providers (Google Calendar, Outlook, custom webhooks)

**Processing Model**: Interval-based polling system that:
- Fetches new WhatsApp messages from Twilio
- Processes messages through OpenAI for event extraction
- Creates calendar events via configured service
- Tracks processing status and error states

**Development Server**: Vite dev server in middleware mode with HMR support and custom error overlays for Replit environment

### Data Storage

**ORM**: Drizzle ORM with PostgreSQL dialect

**Database**: PostgreSQL (via Neon serverless driver)

**Schema Design**:
1. **Configurations Table**: Stores Twilio credentials, calendar service settings, polling intervals, and bot activation state (single-user configuration model)
2. **WhatsApp Messages Table**: Tracks received messages with processing status, timestamps, and error messages
3. **Calendar Events Table**: Records created calendar events with references to source messages

**Storage Abstraction**: `IStorage` interface with in-memory implementation (`MemStorage`) for development and testing, designed to be swappable with database-backed implementation

**Migration Strategy**: Drizzle Kit for schema migrations with TypeScript schema definitions

### Authentication and Authorization

Currently operates as a single-user system with `userId: "default"` convention. No authentication layer is implemented, designed for personal/internal use cases.

### External Dependencies

**Third-Party Services**:
1. **Twilio**: WhatsApp Business API for receiving messages
   - Requires: Account SID, Auth Token, WhatsApp-enabled phone number
   - Authentication: HTTP Basic Auth

2. **OpenAI (via Replit AI Integrations)**: Natural language processing for event extraction
   - Model: GPT-5
   - Uses JSON mode for structured responses
   - Accessed through Replit's proxy service (no direct API key needed)

3. **Google Calendar API**: Event creation endpoint
   - Authentication: OAuth 2.0 access token
   - Endpoint: `https://www.googleapis.com/calendar/v3/calendars/primary/events`

4. **Microsoft Outlook Calendar API**: Alternative calendar service
   - Authentication: OAuth 2.0 access token

5. **Custom Webhooks**: Supports arbitrary HTTP endpoints for calendar integrations

**Frontend Dependencies**:
- Radix UI: Comprehensive set of unstyled, accessible UI primitives
- Tailwind CSS: Utility-first CSS framework
- TanStack Query: Async state management
- React Hook Form: Form state management and validation
- Zod: Schema validation
- date-fns: Date manipulation utilities

**Backend Dependencies**:
- Express.js: Web application framework
- Drizzle ORM: Type-safe database toolkit
- connect-pg-simple: PostgreSQL session store
- OpenAI SDK: API client for GPT integration

**Development Tools**:
- Vite: Build tool and dev server
- TypeScript: Static type checking
- esbuild: Production bundler for backend
- Replit-specific plugins: Cartographer, dev banner, runtime error overlay