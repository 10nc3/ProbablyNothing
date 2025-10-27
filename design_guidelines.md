# Design Guidelines: WhatsApp-to-Calendar Bot Configuration UI

## Design Approach

**Selected Approach:** Design System with SaaS Dashboard Inspiration

**Reference Products:** Vercel Dashboard, Stripe Settings, Railway.app, Linear Settings

**Rationale:** This is a utility-focused configuration interface where clarity, efficiency, and error prevention are paramount. Drawing from best-in-class SaaS configuration UIs ensures users can quickly set up and manage their bot with confidence.

**Key Design Principles:**
1. Progressive disclosure - reveal complexity only when needed
2. Clear visual hierarchy - distinguish between sections and actions
3. Instant feedback - show validation states immediately
4. Scannable layout - users should quickly understand the structure

---

## Core Design Elements

### A. Typography

**Font Family:** Inter or System UI Stack
- Primary: `font-sans` (Inter via Google Fonts)
- Monospace for API keys: `font-mono` (JetBrains Mono or SF Mono)

**Type Scale:**
- Page Title: `text-3xl font-bold` (30px)
- Section Headers: `text-xl font-semibold` (20px)
- Subsection Headers: `text-base font-medium` (16px)
- Body Text: `text-sm` (14px)
- Helper Text: `text-xs` (12px)
- Labels: `text-sm font-medium` (14px)

**Line Height:**
- Headlines: `leading-tight` (1.25)
- Body: `leading-relaxed` (1.625)

---

### B. Layout System

**Spacing Primitives:** Use Tailwind units of **4, 6, 8, 12, 16, 24**
- Component padding: `p-6` or `p-8`
- Section spacing: `space-y-8` or `space-y-12`
- Form field gaps: `gap-6`
- Inline elements: `gap-4`

**Container Structure:**
```
- Max width: `max-w-4xl mx-auto` (768px centered)
- Page padding: `px-6 py-12` on mobile, `px-8 py-16` on desktop
- Card/Panel padding: `p-6` or `p-8`
```

**Grid System:**
- Single column on mobile
- Two-column for form sections on desktop: `grid-cols-1 md:grid-cols-2 gap-6`

---

### C. Component Library

#### 1. Page Structure

**Header Section:**
- Page title with description
- Optional status indicator (e.g., "Bot Status: Active/Inactive")
- Sticky positioning with subtle border on scroll

**Main Content Area:**
- Organized into collapsible or tab-based sections
- Clear visual separation between configuration groups

**Footer Actions:**
- Primary action button (Save Configuration)
- Secondary action (Cancel/Reset)
- Fixed to bottom on mobile, inline on desktop

#### 2. Form Components

**Input Fields:**
- Full-width by default with `w-full`
- Height: `h-12` for consistency
- Border radius: `rounded-lg`
- Clear focus states with ring utilities
- Labels positioned above inputs with `mb-2`
- Helper text below inputs with `mt-1.5 text-xs`

**API Key Input:**
- Monospace font for credential display
- Password-style masking with toggle visibility button
- Copy-to-clipboard button positioned inline-end
- Validation indicator (checkmark icon when valid)

**Select Dropdowns:**
- Height: `h-12` matching text inputs
- Custom chevron icon for consistency
- Max height for options list: `max-h-60`

**Toggle Switches:**
- Modern switch component (not checkbox style)
- Label positioned to the left or right consistently
- Size: height `h-6`, width `w-11`

**Text Areas:**
- Minimum height: `min-h-32`
- Resizable vertically: `resize-y`
- Auto-expanding option for better UX

#### 3. Navigation & Organization

**Configuration Sections:**
Use card-based panels with clear section headers:

1. **Twilio WhatsApp Setup**
   - Account SID input
   - Auth Token input (masked)
   - WhatsApp phone number input with country code selector
   - Test connection button
   - Connection status indicator

2. **Calendar Integration**
   - Service selector (Google Calendar, Outlook, Custom Endpoint)
   - Conditional fields based on selection
   - OAuth connection button for Google/Outlook
   - Custom endpoint URL input
   - Webhook configuration section

3. **Bot Behavior Settings**
   - Polling interval selector
   - Auto-parsing preferences
   - Notification settings toggle

4. **Advanced Settings** (Collapsible)
   - Logging level
   - Retry configuration
   - Timeout settings

**Section Card Structure:**
- Border with subtle styling: `border rounded-lg`
- Padding: `p-6 md:p-8`
- Spacing between cards: `space-y-6`
- Optional icons for each section (using Heroicons)

#### 4. Feedback Components

**Alert Banners:**
- Success: Full-width with icon and message
- Error: Full-width with error details and retry action
- Warning: Informational with dismissible option
- Height: `min-h-12`, padding: `p-4`

**Loading States:**
- Skeleton loaders for input fields during data fetch
- Spinner for button actions (small, 16px)
- Disabled state styling during processing

**Validation Messages:**
- Inline below each field: `text-xs mt-1.5`
- Icon-based indicators (error icon, success checkmark)
- Real-time validation on blur

**Toast Notifications:**
- Position: Top-right corner `top-4 right-4`
- Auto-dismiss after 5 seconds
- Slide-in animation using CSS transitions

#### 5. Action Buttons

**Primary Button (Save/Connect):**
- Height: `h-12`
- Padding: `px-6`
- Font: `font-semibold text-sm`
- Border radius: `rounded-lg`
- Full-width on mobile, auto-width on desktop

**Secondary Button (Cancel/Reset):**
- Same dimensions as primary
- Outlined variant with border

**Tertiary Button (Test Connection):**
- Smaller size: `h-10 px-4 text-sm`
- Positioned inline with relevant input

**Icon Buttons:**
- Size: `h-10 w-10` for standard actions
- Size: `h-8 w-8` for compact contexts
- Border radius: `rounded-lg`

#### 6. Status Indicators

**Connection Status:**
- Dot indicator with label: `h-2.5 w-2.5 rounded-full`
- Positioned inline with section headers
- States: Connected, Disconnected, Checking

**API Status Cards:**
- Small info cards showing integration health
- Grid layout: `grid-cols-1 sm:grid-cols-3 gap-4`
- Display: Service name, status, last sync time

---

### D. Animations

**Use Sparingly:**
- Smooth transitions on toggle switches: `transition-all duration-200 ease-in-out`
- Accordion expand/collapse: `transition-all duration-300`
- Button hover states: `transition-colors duration-150`
- Toast slide-in: `transition-transform duration-300`

**Avoid:**
- Page load animations
- Excessive micro-interactions
- Parallax effects
- Complex SVG animations

---

## Page Layout Structure

**Desktop Layout (≥768px):**
```
[Page Header with Title & Description]
    ↓
[Status Overview Bar - Optional]
    ↓
[Section 1: Twilio Configuration Card]
    ↓
[Section 2: Calendar Integration Card]
    ↓
[Section 3: Bot Settings Card]
    ↓
[Section 4: Advanced Settings (Collapsible)]
    ↓
[Action Buttons: Save & Cancel]
```

**Mobile Layout (<768px):**
- Stack all elements vertically
- Sticky header with title
- Fixed bottom action bar with Save button
- Collapsible sections by default to reduce scroll

---

## Accessibility

- All form inputs have associated labels with `for` attributes
- Error messages use `aria-describedby` linked to inputs
- Focus visible states on all interactive elements
- Keyboard navigation fully supported (Tab, Enter, Escape)
- Screen reader announcements for status changes
- Minimum contrast ratio 4.5:1 for all text
- Touch targets minimum 44x44px on mobile

---

## Icons

**Icon Library:** Heroicons (via CDN)

**Usage:**
- Section headers: 20px icons (outline style)
- Input fields: 16px icons for validation states
- Buttons: 16px icons when paired with text
- Status indicators: 12px icons for compact displays
- Alert banners: 20px icons for visibility

**Common Icons Needed:**
- Settings/Cog for configuration sections
- Check circle for success states
- Exclamation triangle for warnings
- X circle for errors
- Eye/Eye-off for password visibility toggle
- Clipboard for copy actions
- Chevron down for dropdowns and accordions

---

## Implementation Notes

- Forms use proper HTML semantics (`<form>`, `<label>`, `<input>`)
- Client-side validation before API calls
- Loading states prevent duplicate submissions
- Auto-save draft configurations to local storage
- Clear error recovery paths with actionable messages
- Responsive breakpoint: 768px (md:)