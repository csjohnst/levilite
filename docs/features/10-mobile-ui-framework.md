# Feature Specification: Mobile Responsiveness & UI Framework

**Feature ID:** 10-Mobile-UI-Framework  
**Product:** LevyLite  
**Version:** 1.0 MVP  
**Date:** 16 February 2026  
**Author:** Kai (Kokoro Software)  
**Status:** Draft  
**Dependencies:** All features (foundational)

---

## 1. Overview

Mobile responsiveness is not a feature—it's the **foundation** of LevyLite's user experience. Strata managers work in the field: conducting site inspections, attending committee meetings at scheme locations, checking levy balances from their phone between appointments. The platform must deliver a **mobile-first experience** that works seamlessly on phones, tablets, and desktops without compromise.

This specification defines the complete UI/UX framework for LevyLite: design system, responsive patterns, component library, navigation architecture, accessibility standards, and performance budgets. Every feature in the PRD will be built on this foundation.

### Success Criteria

- **Mobile workflows** complete in ≤ same number of taps/clicks as desktop
- **Touch targets** meet WCAG 2.1 AA minimum 44×44px
- **Performance:** LCP < 2.5s, CLS < 0.1, FID < 100ms on 4G mobile
- **Accessibility:** WCAG 2.1 AA compliant (keyboard nav, screen readers, contrast)
- **Responsive tables** display cleanly on 375px mobile screens
- **Forms** optimised for mobile input (autocomplete, native pickers, camera upload)

---

## 2. Design System

### 2.1 Colour Palette

LevyLite's visual identity communicates **trust, professionalism, and simplicity**. The teal/dark/light palette avoids the institutional coldness of blue-heavy enterprise software.

#### Primary Colours

```css
--primary-teal-dark:  #02667F;  /* Buttons, headers, active states */
--primary-teal:       #0090B7;  /* Links, hover states, accents */
--primary-dark:       #3A3A3A;  /* Body text, dark UI elements */
--primary-light:      #F6F8FA;  /* Backgrounds, cards, subtle borders */
```

#### Semantic Colours

```css
--success:   #10B981;  /* Paid levies, completed tasks */
--warning:   #F59E0B;  /* Overdue <30 days, pending actions */
--error:     #EF4444;  /* Arrears >30 days, validation errors */
--info:      #3B82F6;  /* Informational messages, tooltips */
--neutral:   #6B7280;  /* Secondary text, disabled states */
```

#### Contrast Ratios (WCAG 2.1 AA)

All text meets minimum contrast requirements:

- **Body text (16px):** `#3A3A3A` on `#FFFFFF` = 11.6:1 (AAA)
- **Teal buttons:** `#FFFFFF` text on `#02667F` = 5.8:1 (AA)
- **Links:** `#0090B7` on `#FFFFFF` = 3.6:1 (AA for large text, use underline for small text)
- **Error text:** `#EF4444` on `#FFFFFF` = 3.9:1 (AA for large text, icons help)

**Implementation Note:** Use Tailwind's built-in colours as a foundation but override with custom palette in `tailwind.config.ts`.

### 2.2 Typography Scale

**Font Family:**  
- **UI:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`  
- **Monospace (amounts, lot numbers):** `'JetBrains Mono', 'Courier New', monospace`

Inter is a clean, readable sans-serif optimised for UI. JetBrains Mono ensures financial amounts and lot numbers (e.g., "Lot 42") are visually distinct.

**Type Scale (Mobile-First):**

| Element | Mobile (sm) | Desktop (lg) | Weight | Line Height |
|---------|-------------|--------------|--------|-------------|
| **H1 (Page Title)** | 24px (1.5rem) | 32px (2rem) | 700 | 1.2 |
| **H2 (Section)** | 20px (1.25rem) | 24px (1.5rem) | 600 | 1.3 |
| **H3 (Card Header)** | 18px (1.125rem) | 20px (1.25rem) | 600 | 1.4 |
| **Body** | 16px (1rem) | 16px (1rem) | 400 | 1.5 |
| **Small (Labels)** | 14px (0.875rem) | 14px (0.875rem) | 500 | 1.4 |
| **Tiny (Captions)** | 12px (0.75rem) | 12px (0.75rem) | 400 | 1.3 |
| **Mono (Amounts)** | 16px (1rem) | 16px (1rem) | 500 | 1.5 |

**Responsive Strategy:** Use `@media (min-width: 1024px)` to bump up headings on desktop. Body text stays 16px (optimal readability).

### 2.3 Spacing System (8px Grid)

Consistent spacing prevents visual clutter and ensures touch targets meet accessibility standards.

```css
--spacing-1:  4px;   /* Tight grouping (icon + text) */
--spacing-2:  8px;   /* Default gap (flex/grid) */
--spacing-3:  12px;  /* Card padding (mobile) */
--spacing-4:  16px;  /* Card padding (desktop), form fields */
--spacing-6:  24px;  /* Section spacing */
--spacing-8:  32px;  /* Page margins (desktop) */
--spacing-12: 48px;  /* Large vertical spacing */
```

**Touch Target Minimum:** 44×44px (WCAG 2.1 AA) for all interactive elements (buttons, checkboxes, links in lists).

### 2.4 Component Library (shadcn/ui Customisation)

LevyLite uses **shadcn/ui** (built on Radix UI primitives) for accessible, customisable components. Unlike component libraries that ship as packages, shadcn/ui copies source code into your project—full control, no dependency lock-in.

**Core shadcn/ui Components (MVP):**

- **Button** (primary, secondary, ghost, destructive variants)
- **Input** (text, email, number with validation)
- **Select** (autocomplete dropdown for owners, schemes)
- **Dialog** (modals for confirmations, quick actions)
- **Card** (container for stat cards, list items on mobile)
- **Table** (data tables with sorting/filtering)
- **Form** (react-hook-form + Zod integration)
- **Popover** (context menus, date pickers)
- **Toast** (success/error notifications)
- **Badge** (status indicators: paid, overdue, completed)
- **Tabs** (navigation within complex views)
- **Skeleton** (loading states)

**Customisation Strategy:**

1. Install shadcn/ui with `npx shadcn-ui@latest init` → copies Tailwind config
2. Add components: `npx shadcn-ui@latest add button card dialog form input select table toast`
3. Override default styles in `components/ui/*.tsx` to match LevyLite palette
4. Create custom variants (e.g., `buttonVariants.teal` for primary actions)

**Example: Custom Button Variants**

```tsx
// components/ui/button.tsx (modified from shadcn/ui)
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary-teal-dark text-white hover:bg-primary-teal",
        secondary: "bg-primary-light text-primary-dark hover:bg-gray-200",
        ghost: "hover:bg-primary-light hover:text-primary-dark",
        destructive: "bg-error text-white hover:bg-red-600",
        link: "text-primary-teal underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

---

## 3. Responsive Breakpoints & Layout Strategy

### 3.1 Breakpoints

Match Tailwind CSS defaults for ecosystem consistency:

| Breakpoint | Min Width | Target Devices | Layout Strategy |
|------------|-----------|----------------|-----------------|
| **Mobile (default)** | 0px | iPhone SE, Android phones | Single column, stacked cards, bottom nav |
| **sm** | 640px | Large phones (landscape), small tablets | 2-column grids, expanded cards |
| **md** | 768px | Tablets (portrait) | Sidebar appears (collapsible), 2-3 column grids |
| **lg** | 1024px | Tablets (landscape), laptops | Full sidebar, 3-4 column grids, tables expand |
| **xl** | 1280px | Desktops | Max content width (1280px), side panels for detail views |

**Design Philosophy:** Mobile-first. Build for 375px (iPhone SE) and scale up, not the reverse.

### 3.2 Layout Patterns

#### Mobile (<640px)

- **Single column:** All content stacks vertically
- **Cards over tables:** List items become cards with key fields visible (see Section 5)
- **Bottom navigation:** 4-5 primary nav items (Dashboard, Schemes, Levies, Documents, More)
- **Floating action button (FAB):** Primary action (e.g., "+ Add Levy Notice") floats bottom-right
- **Full-width inputs:** Forms span full width minus 16px padding
- **Sticky headers:** Page title + scheme switcher stick to top on scroll

#### Tablet (640px-1024px)

- **Sidebar (collapsible):** Hamburger icon toggles sidebar (default collapsed on `md`, expanded on `lg`)
- **2-column grids:** Stat cards, scheme lists display 2 across
- **Hybrid tables:** Important tables switch to horizontal scroll with sticky first column
- **Modal dialogs:** 600px max width (not full-screen like mobile)

#### Desktop (>1024px)

- **Persistent sidebar:** 240px wide, collapsible to 64px icon-only mode
- **3-4 column grids:** Stat cards show 4 across, scheme lists show 3 across
- **Full data tables:** All columns visible, sortable, filterable
- **Side panels:** Detail views (e.g., owner details) slide in from right (800px wide)
- **Breadcrumbs:** Replace mobile back button

### 3.3 Container Strategy

**Max Content Width:** 1280px (prevents line length >75ch on ultra-wide monitors)

```tsx
// layouts/MainLayout.tsx
<div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
  {children}
</div>
```

**Responsive Padding:**  
- Mobile: `px-4` (16px)  
- Tablet: `px-6` (24px)  
- Desktop: `px-8` (32px)

---

## 4. Navigation Architecture

### 4.1 Desktop Navigation (>1024px)

**Sidebar (Left, 240px wide):**

```
┌─────────────────────────┐
│ [LevyLite Logo]         │
│ [Scheme Switcher ▼]     │ ← Dropdown to switch active scheme
├─────────────────────────┤
│ 📊 Dashboard            │
│ 🏢 Schemes              │
│ 💰 Levies               │
│ 💳 Trust Accounting     │
│ 📅 Meetings             │
│ 🔧 Maintenance          │
│ 📁 Documents            │
│ 👥 Owners               │
├─────────────────────────┤
│ ⚙️ Settings             │
│ 👤 Chris Johnstone      │ ← User menu (logout, profile)
└─────────────────────────┘
```

**Features:**
- **Collapsible:** Click hamburger icon → collapses to 64px (icons only)
- **Active state:** Teal highlight + left border for current page
- **Badge indicators:** Red dot on "Levies" if arrears exist, count on "Maintenance" for open requests
- **Keyboard accessible:** Tab through items, Enter to navigate

**Breadcrumbs (Top Bar):**

```
Home > Schemes > Sunset Gardens > Levy Roll
```

Click any segment to navigate up hierarchy. Replaces back button on desktop.

### 4.2 Mobile Navigation (<640px)

**Top Bar (Sticky):**

```
┌───────────────────────────────────┐
│ [☰] Sunset Gardens ▼     [🔔] [👤]│ ← Hamburger, scheme switcher, notifications, profile
└───────────────────────────────────┘
```

**Bottom Navigation (Fixed):**

```
┌─────┬─────┬─────┬─────┬─────┐
│ 📊  │ 🏢  │ 💰  │ 📁  │ ⋯   │
│Home │Sites│Levy │Docs │More │
└─────┴─────┴─────┴─────┴─────┘
```

**Icon Selection:**
- **Home (Dashboard):** Stat cards, recent activity, quick actions
- **Sites (Schemes):** Scheme list, lot details
- **Levy:** Levy roll, quick balance check
- **Docs:** Document library (most accessed on mobile for viewing PDFs)
- **More:** Meetings, maintenance, trust accounting, settings

**Interaction:**
- **Tap icon:** Navigate to section
- **Active state:** Teal icon + label
- **Safe area insets:** Respect iPhone notch/home indicator (iOS `env(safe-area-inset-bottom)`)

**Hamburger Menu (Slide-in Drawer):**

Opens from left when tap `[☰]`. Full-height overlay with:
- All nav items (including those hidden in "More")
- User profile (name, email)
- Logout button
- Close with X icon or swipe-left

### 4.3 Scheme Context Switching

Every page operates within a **scheme context** (except "All Schemes" views). The scheme switcher is critical for managers handling 10-20 schemes.

**Desktop:** Dropdown in sidebar header (240px wide)
**Mobile:** Dropdown in top bar (full width)

**Switcher UI:**

```
┌─────────────────────────────────┐
│ Current: Sunset Gardens     [▼] │ ← Click to expand
├─────────────────────────────────┤
│ 🔍 Search schemes...            │
├─────────────────────────────────┤
│ ⭐ Sunset Gardens (Current)     │
│ ⭐ Ocean View Villas            │ ← Favourites (⭐ icon)
│    Parkside Apartments          │
│    Riverside Strata             │
│ → View All Schemes              │
└─────────────────────────────────┘
```

**Features:**
- **Search/filter:** Type to find scheme (autocomplete)
- **Recently viewed:** Show last 5 visited schemes at top
- **Favourites:** Star icon to pin frequently used schemes
- **Switch persistence:** Store last-viewed scheme in localStorage (restore on login)

---

## 5. Key Mobile Workflows

These workflows must be **optimised for one-handed mobile use** (thumb reach zone on 375px screen).

### 5.1 Site Inspection (Maintenance Request Management)

**Scenario:** Sarah visits Sunset Gardens after receiving complaint about broken pool gate. Needs to view request, update status, add photos.

**Mobile Flow:**

1. **Bottom Nav → More → Maintenance** (or Dashboard → "3 Open Requests" card)
2. **Maintenance List (Card View):**

```
┌─────────────────────────────────┐
│ 🔴 HIGH: Broken Pool Gate       │
│ Lot 12 • Reported 2 days ago    │
│ Status: Assigned → Fix It Fast  │
│ [View] [Update]                 │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ 🟡 MED: Dripping Tap            │
│ Lot 7 • Reported 5 days ago     │
│ Status: New                     │
│ [View] [Assign]                 │
└─────────────────────────────────┘
```

3. **Tap [View] → Detail Page:**
   - Photos of broken gate
   - Description, requester details
   - Tradesperson assigned (Fix It Fast Repairs)
   - Internal notes
   - **Action Buttons (Bottom):**
     - [📷 Add Photos] ← Opens camera
     - [✏️ Update Status] ← Opens status picker (New/Assigned/In Progress/Completed)
     - [💬 Add Note]

4. **Tap [📷 Add Photos]:**
   - Triggers native camera (HTML `<input type="file" accept="image/*" capture="environment">`)
   - Take 3 photos of repaired gate
   - Auto-upload to Supabase Storage
   - Thumbnail previews appear instantly

5. **Tap [✏️ Update Status] → Select "Completed":**
   - Date completed auto-fills (today)
   - Optional: Enter completion notes
   - [Save] → Updates request, sends notification to owner

**Mobile-Specific Optimisations:**

- **Large touch targets:** Buttons 48px high minimum
- **Camera integration:** Native file picker with `capture="environment"` (back camera default)
- **Image compression:** Resize photos to 1200px max width client-side before upload (reduce mobile data usage)
- **Offline photo capture:** Store photos in IndexedDB if offline, upload when connection restored (Phase 2)

### 5.2 Meeting Attendance (Record Attendees)

**Scenario:** Sarah attends Sunset Gardens AGM. Needs to record who's present (in person, proxy, Zoom).

**Mobile Flow:**

1. **Bottom Nav → More → Meetings**
2. **Upcoming Meetings List:**

```
┌─────────────────────────────────┐
│ 📅 Sunset Gardens AGM           │
│ Today, 6:00 PM • 15 lots        │
│ [Record Attendance]             │
└─────────────────────────────────┘
```

3. **Tap [Record Attendance] → Attendance Sheet:**

**Grid View (2 columns on mobile):**

```
┌──────────────┬──────────────┐
│ Lot 1: Smith │ Lot 2: Jones │
│ ☑ Present    │ ☐ Proxy      │
│ ☐ Proxy      │ ☐ Absent     │
│ ☐ Absent     │ ☐ Zoom       │
└──────────────┴──────────────┘
┌──────────────┬──────────────┐
│ Lot 3: Brown │ Lot 4: Davis │
│ ☐ Present    │ ☑ Zoom       │
│ ...          │ ...          │
```

**Features:**
- **Checkboxes:** Large 44×44px touch targets
- **Quick toggle:** Tap lot card to cycle through Present → Proxy → Absent → Zoom
- **Auto-save:** Every selection saves to DB immediately (no "Save" button to forget)
- **Summary bar (sticky bottom):** "12/15 lots represented (quorum met ✅)"

4. **During meeting:** Tap "Add Note" (FAB) to record key discussion points
   - Voice-to-text input (mobile keyboard's microphone button)
   - Auto-timestamps each note

5. **After meeting:** Tap "Finalize Minutes" → Generates draft minutes document

**Mobile-Specific Optimisations:**

- **Auto-save:** No risk of losing data if phone dies mid-meeting
- **Voice input:** Reduce typing on mobile (use browser's native speech-to-text)
- **Offline support:** Meeting attendance works offline (Supabase Realtime handles sync when reconnected—Phase 2)

### 5.3 Quick Levy Check

**Scenario:** Owner calls Sarah asking "Do I owe anything?" Sarah is at cafe, needs quick balance check.

**Mobile Flow:**

1. **Bottom Nav → Levy**
2. **Search Bar (Top):** Type "Smith" → Autocomplete shows "Lot 12, J. Smith, Sunset Gardens"
3. **Tap result → Levy Statement (Mobile-Optimised Card):**

```
┌─────────────────────────────────┐
│ Lot 12 • J. Smith               │
│ Sunset Gardens                  │
├─────────────────────────────────┤
│ Current Balance:                │
│ $1,250.00 OVERDUE              │ ← Large, bold, red if overdue
├─────────────────────────────────┤
│ Last Payment:                   │
│ $500.00 on 15 Jan 2026          │
├─────────────────────────────────┤
│ Next Levy Due:                  │
│ $625.00 on 1 Apr 2026           │
├─────────────────────────────────┤
│ [📄 Email Statement]            │
│ [📞 Contact Owner]              │
└─────────────────────────────────┘
```

**Tap [📄 Email Statement]:**
- Generates PDF levy statement
- Pre-fills email to owner's address
- Sends via mobile (opens Gmail/Outlook with attachment)

**Mobile-Specific Optimisations:**

- **Search-first UI:** Fastest path to answer (2 taps from home)
- **Large typography:** Balance amount is 32px, high contrast
- **One-tap actions:** Email statement, call owner (use `tel:` link)

### 5.4 Document Viewing

**Scenario:** Sarah is at inspection, owner asks "Can I see the building insurance certificate?"

**Mobile Flow:**

1. **Bottom Nav → Docs**
2. **Scheme:** Sunset Gardens (already in context)
3. **Folder:** Insurance → Building Insurance
4. **Tap:** "Certificate 2025-2026.pdf" → Opens in mobile browser viewer

**Mobile-Specific Optimisations:**

- **Lazy loading:** Only load thumbnails for visible documents (virtual scrolling for 1000+ docs)
- **PDF viewer:** Leverage browser's native PDF viewer (no custom implementation needed)
- **Download option:** "Download" button stores to device for offline access
- **Quick filters:** "Recent", "Insurance", "AGM", "By-laws" (most common searches)

---

## 6. Table Responsiveness

Data tables are the **hardest challenge** for mobile UI. LevyLite has 5 critical tables that must work on 375px screens.

### 6.1 Responsive Strategy: **Adaptive Views**

Don't force desktop tables onto mobile. Show different views based on screen size.

| Table | Mobile (<640px) | Desktop (>1024px) |
|-------|-----------------|-------------------|
| **Levy Roll** | Card view (1 lot per card) | Full table (8 columns) |
| **Payments** | Card view (transaction cards) | Full table (6 columns) |
| **Documents** | List view (icon + filename) | Table with preview column |
| **Meetings** | Card view (meeting cards) | Table (5 columns) |
| **Lots** | Card view (lot details) | Full table (7 columns) |

### 6.2 Example: Levy Roll

**Desktop Table (>1024px):**

| Lot | Owner | Admin Fund Due | CW Fund Due | Total Due | Paid | Arrears | Actions |
|-----|-------|----------------|-------------|-----------|------|---------|---------|
| 1 | J. Smith | $500 | $125 | $625 | $625 | $0 | [View] |
| 2 | M. Jones | $500 | $125 | $625 | $400 | $225 | [View] [Remind] |

**Mobile Card View (<640px):**

```
┌─────────────────────────────────┐
│ Lot 1 • J. Smith                │
│ ──────────────────────────────  │
│ Due: $625   Paid: $625   ✅     │
│ Status: Paid in Full            │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Lot 2 • M. Jones                │
│ ──────────────────────────────  │
│ Due: $625   Paid: $400   ⚠️     │
│ Arrears: $225 (overdue 12 days) │
│ [Send Reminder]                 │
└─────────────────────────────────┘
```

**Implementation:**

```tsx
// components/LevyRoll.tsx
export function LevyRoll({ lots }) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  
  if (isMobile) {
    return <LevyRollCards lots={lots} />;
  }
  
  return <LevyRollTable lots={lots} />;
}
```

### 6.3 Hybrid Approach: Horizontal Scroll (Fallback)

For tables that **must** show multiple columns on mobile (e.g., Trust Accounting ledger), use horizontal scroll with sticky first column.

```tsx
<div className="overflow-x-auto">
  <table className="min-w-full">
    <thead>
      <tr>
        <th className="sticky left-0 bg-white">Date</th> {/* Sticky */}
        <th>Description</th>
        <th>Receipts</th>
        <th>Payments</th>
        <th>Balance</th>
      </tr>
    </thead>
    <tbody>
      {/* Rows */}
    </tbody>
  </table>
</div>
```

**Visual Indicator:** Subtle right-edge gradient to signal "scroll for more."

---

## 7. Form Design (Mobile-Optimised)

Forms must be **fast and error-proof** on mobile (small screens, touch keyboards, auto-complete).

### 7.1 Best Practices

1. **Single column layout:** Stack all fields vertically (no side-by-side on mobile)
2. **Large touch targets:** Inputs 48px high minimum, 16px between fields
3. **Native input types:** Use `type="email"`, `type="tel"`, `type="number"` to trigger correct mobile keyboard
4. **Autocomplete:** `autocomplete="name"`, `autocomplete="email"` for browser autofill
5. **Floating labels:** Label floats above input when focused (saves vertical space)
6. **Inline validation:** Show errors immediately (don't wait for submit)
7. **Sticky action buttons:** "Save" / "Cancel" buttons stick to bottom on mobile (always visible)

### 7.2 Example: Add Owner Form

**Mobile Layout:**

```
┌─────────────────────────────────┐
│ Add Owner                   [X] │
├─────────────────────────────────┤
│ Lot Number *                    │
│ [12              ]              │ ← type="number", inputmode="numeric"
├─────────────────────────────────┤
│ Owner Name *                    │
│ [John Smith      ]              │ ← autocomplete="name"
├─────────────────────────────────┤
│ Email *                         │
│ [john@example.com]              │ ← type="email", autocomplete="email"
├─────────────────────────────────┤
│ Phone                           │
│ [0412 345 678    ]              │ ← type="tel", autocomplete="tel"
├─────────────────────────────────┤
│ Postal Address                  │
│ [12 Beach St     ]              │
│ [Suburb          ]              │
│ [State] [Postcode]              │ ← Grouped fields
├─────────────────────────────────┤
│ [Cancel]         [Save Owner]   │ ← Sticky bottom
└─────────────────────────────────┘
```

**Features:**

- **Required fields:** Asterisk + red border if empty on blur
- **Email validation:** Regex check + error message "Invalid email format"
- **Phone formatting:** Auto-format as user types (0412 345 678)
- **Address autocomplete:** Google Places API (Phase 2)—manual entry for MVP

### 7.3 Multi-Step Forms (Wizards)

Complex forms (e.g., Create New Scheme) break into steps on mobile to reduce cognitive load.

**Example: Create Scheme (4 Steps)**

```
Step 1: Basic Details
┌─────────────────────────────────┐
│ Step 1 of 4: Basic Details      │
│ ━━━━━━━━┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅  │ ← Progress bar
│                                 │
│ Scheme Name *                   │
│ [Sunset Gardens  ]              │
│ Address *                       │
│ [42 Beach Road   ]              │
│ [Suburb, State, Postcode]       │
│                                 │
│ [Back]              [Next Step] │
└─────────────────────────────────┘

Step 2: Legal Details
Step 3: Financial Setup
Step 4: Review & Create
```

**Implementation:** Use `react-hook-form` with `useForm({ mode: 'onBlur' })` to validate each step before proceeding.

### 7.4 Photo Upload (Camera Integration)

Critical for maintenance requests, site inspections.

```tsx
<input
  type="file"
  accept="image/*"
  capture="environment"  // Use back camera
  multiple
  onChange={handlePhotoUpload}
  className="hidden"
  ref={fileInputRef}
/>
<button onClick={() => fileInputRef.current?.click()}>
  📷 Take Photo
</button>
```

**Features:**

- **Multiple photos:** `multiple` attribute allows selecting 3-5 photos at once
- **Thumbnail previews:** Show 80×80px thumbnails immediately after selection
- **Client-side compression:** Use `browser-image-compression` library to resize to 1200px max width (reduce upload time on mobile)
- **Progress indicator:** Show upload progress bar (Supabase Storage supports multipart uploads)

---

## 8. Offline Considerations (PWA Roadmap)

**MVP Scope:** Online-only (acceptable for most workflows—managers have 4G/WiFi).

**Phase 2 Roadmap (Months 4-9):** Progressive Web App (PWA) with offline support.

### 8.1 What Works Offline (Future)

- **View levy roll** (cached data, last sync timestamp shown)
- **View documents** (cached PDFs in IndexedDB)
- **Record meeting attendance** (queued to sync when online)
- **Add maintenance photos** (stored in IndexedDB, upload when connected)

### 8.2 What Requires Connection

- **Trust accounting transactions** (audit trail requires immediate DB write)
- **Email levy notices** (SMTP)
- **Generate reports** (PDF generation on server)
- **Real-time data** (owner portal updates, payment notifications)

### 8.3 Service Worker Strategy (Future)

```js
// service-worker.js (Phase 2)
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/levies')) {
    // Cache levy roll data (stale-while-revalidate)
    event.respondWith(
      caches.open('levy-cache').then((cache) => {
        return cache.match(event.request).then((response) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          return response || fetchPromise;
        });
      })
    );
  }
});
```

**Installation Prompt:** Show "Install LevyLite" banner after 3 visits (iOS Safari, Android Chrome support).

---

## 9. Performance Budgets

Mobile users on 4G expect **fast load times**. Set strict budgets and monitor with Lighthouse CI.

### 9.1 Core Web Vitals Targets

| Metric | Target | Poor (Fail) | Measurement |
|--------|--------|-------------|-------------|
| **LCP (Largest Contentful Paint)** | < 2.5s | > 4.0s | Time until main content visible |
| **FID (First Input Delay)** | < 100ms | > 300ms | Time until page responds to tap |
| **CLS (Cumulative Layout Shift)** | < 0.1 | > 0.25 | Visual stability (no jumpy content) |
| **FCP (First Contentful Paint)** | < 1.8s | > 3.0s | Time until any content visible |
| **TTI (Time to Interactive)** | < 3.8s | > 7.3s | Time until page fully interactive |

**Test Conditions:** Moto G4 (mid-range Android), 4G throttled (Lighthouse default).

### 9.2 Performance Strategies

#### Code Splitting (Next.js Automatic)

Next.js App Router automatically splits code by route. Ensure heavy components are lazy-loaded:

```tsx
// Lazy load PDF viewer (only on document detail page)
const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  loading: () => <LoadingSkeleton />,
  ssr: false,
});
```

#### Image Optimisation

Use Next.js `<Image>` component for **automatic WebP conversion, lazy loading, responsive sizing**.

```tsx
import Image from 'next/image';

<Image
  src={scheme.coverPhoto}
  alt={scheme.name}
  width={400}
  height={300}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
  className="rounded-lg"
  priority={false}  // Lazy load below fold
/>
```

**Document Thumbnails:** Generate 200px thumbnails server-side (Supabase Edge Function) for PDF previews.

#### Font Loading

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',  // Show fallback font while loading
  variable: '--font-inter',
});
```

#### Database Query Optimisation

- **Pagination:** Limit levy roll queries to 50 lots per page (infinite scroll on mobile)
- **Indexes:** PostgreSQL indexes on `scheme_id`, `owner_id`, `lot_number` (Supabase migrations)
- **Supabase RPC:** Use stored procedures for complex queries (e.g., arrears calculation) to reduce round trips

#### Bundle Size Budget

| Asset | Budget | Current (Monitor) |
|-------|--------|-------------------|
| **Initial JS** | < 200 KB (gzip) | TBD (Lighthouse CI) |
| **CSS** | < 50 KB (gzip) | TBD |
| **Total Page** | < 500 KB | TBD |

**Monitoring:** Lighthouse CI in GitHub Actions (fail PR if LCP > 3.0s).

---

## 10. Accessibility (WCAG 2.1 AA Compliance)

LevyLite targets **WCAG 2.1 Level AA** (required for Australian government contracts, best practice for SaaS).

### 10.1 Accessibility Checklist

#### Perceivable

- ✅ **Colour contrast:** All text meets 4.5:1 ratio (3:1 for large text >18px)
- ✅ **Alt text:** All images have descriptive `alt` attributes (scheme logos, maintenance photos)
- ✅ **Captions:** Video tutorials include captions (future feature)
- ✅ **Resizable text:** Layout doesn't break at 200% zoom

#### Operable

- ✅ **Keyboard navigation:** All interactive elements reachable via Tab key
- ✅ **Focus indicators:** Visible 2px teal outline on focused elements (`focus-visible:ring-2 ring-primary-teal`)
- ✅ **Touch targets:** Minimum 44×44px for all buttons, links, checkboxes
- ✅ **No time limits:** No auto-logout <20 minutes (except for security on shared devices)

#### Understandable

- ✅ **Clear labels:** All form inputs have associated `<label>` elements
- ✅ **Error messages:** Descriptive errors ("Email is required" not "Invalid input")
- ✅ **Consistent navigation:** Sidebar order same across all pages

#### Robust

- ✅ **Semantic HTML:** Use `<nav>`, `<main>`, `<article>`, `<section>` (not just `<div>`)
- ✅ **ARIA labels:** Custom components have `aria-label` or `aria-labelledby`
- ✅ **Screen reader testing:** Test with VoiceOver (iOS), TalkBack (Android), NVDA (Windows)

### 10.2 Implementation Notes

**Skip to Main Content:**

```tsx
// app/layout.tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-teal text-white px-4 py-2 rounded">
  Skip to main content
</a>
<main id="main-content">
  {children}
</main>
```

**ARIA Live Regions (Toast Notifications):**

```tsx
<div role="status" aria-live="polite" aria-atomic="true">
  Levy notice sent to John Smith
</div>
```

**Form Validation Announcements:**

```tsx
<input
  aria-invalid={errors.email ? 'true' : 'false'}
  aria-describedby={errors.email ? 'email-error' : undefined}
/>
{errors.email && (
  <p id="email-error" className="text-error text-sm" role="alert">
    {errors.email.message}
  </p>
)}
```

### 10.3 Testing Tools

- **Lighthouse:** Accessibility audit in Chrome DevTools
- **axe DevTools:** Browser extension for WCAG violation detection
- **Screen readers:** VoiceOver (Mac/iOS), NVDA (Windows free), JAWS (Windows paid)
- **Keyboard testing:** Unplug mouse, navigate entire app with Tab/Enter/Space/Arrow keys

---

## 11. Component Specifications

Reusable components are the foundation of a consistent, maintainable UI.

### 11.1 DataTable Component

**Purpose:** Sortable, filterable tables for levy roll, payments, documents.

**Props:**

```tsx
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  mobileCardView?: boolean;  // Switch to cards on mobile
  emptyState?: React.ReactNode;
}
```

**Features:**

- **Sorting:** Click column header to sort ascending/descending
- **Filtering:** Global search input (searches all columns)
- **Pagination:** 50 rows per page (infinite scroll on mobile)
- **Responsive:** Switches to card view on `<640px` if `mobileCardView={true}`
- **Keyboard accessible:** Arrow keys navigate cells, Enter to activate row action

**Implementation:** Use `@tanstack/react-table` (formerly React Table v8) with shadcn/ui table components.

### 11.2 StatCard Component

**Purpose:** Dashboard KPIs (total arrears, open requests, upcoming AGMs).

**Props:**

```tsx
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  onClick?: () => void;
}
```

**Example:**

```tsx
<StatCard
  title="Total Arrears"
  value="$12,450"
  subtitle="Across 23 lots"
  icon={<DollarSign />}
  trend="down"
  trendValue="-8% from last month"
  onClick={() => router.push('/levies?filter=arrears')}
/>
```

**Mobile Layout:** 1 card per row on `<640px`, 2 per row on `640-1024px`, 4 per row on `>1024px`.

### 11.3 StatusBadge Component

**Purpose:** Visual indicators for levy status, maintenance request status, meeting status.

**Props:**

```tsx
interface StatusBadgeProps {
  status: 'paid' | 'overdue' | 'pending' | 'completed' | 'new' | 'assigned';
  size?: 'sm' | 'md' | 'lg';
}
```

**Styling:**

| Status | Background | Text | Icon |
|--------|------------|------|------|
| **paid** | `bg-success/10` | `text-success` | ✅ |
| **overdue** | `bg-error/10` | `text-error` | ⚠️ |
| **pending** | `bg-warning/10` | `text-warning` | ⏳ |
| **completed** | `bg-success/10` | `text-success` | ✓ |
| **new** | `bg-info/10` | `text-info` | 🆕 |
| **assigned** | `bg-neutral/10` | `text-neutral` | 👤 |

**Accessibility:** `aria-label="Status: Overdue"` for screen readers.

### 11.4 EmptyState Component

**Purpose:** Friendly message when no data exists (e.g., no maintenance requests).

**Props:**

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

**Example:**

```tsx
<EmptyState
  icon={<Wrench size={48} />}
  title="No maintenance requests"
  description="When owners submit requests, they'll appear here."
  action={{
    label: "Create Request",
    onClick: () => setShowCreateDialog(true),
  }}
/>
```

### 11.5 LoadingSkeleton Component

**Purpose:** Placeholder while data loads (prevents CLS, improves perceived performance).

**Variants:**

- `<SkeletonCard />` — Shimmer card matching StatCard dimensions
- `<SkeletonTable />` — Shimmer table rows
- `<SkeletonText />` — Text lines (for paragraphs)

**Implementation:** Tailwind `animate-pulse` with gradient background.

```tsx
<div className="h-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse rounded-lg" />
```

### 11.6 ConfirmDialog Component

**Purpose:** Destructive action confirmation (delete scheme, remove owner).

**Props:**

```tsx
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
}
```

**Example:**

```tsx
<ConfirmDialog
  open={showDelete}
  onOpenChange={setShowDelete}
  title="Delete Scheme?"
  description="This will permanently delete Sunset Gardens and all associated data. This action cannot be undone."
  confirmLabel="Delete Scheme"
  cancelLabel="Cancel"
  variant="danger"
  onConfirm={handleDelete}
/>
```

**Mobile:** Full-screen overlay on `<640px`, centered modal on `>640px`.

### 11.7 FileUpload Component

**Purpose:** Drag-and-drop document upload (desktop) or tap-to-select (mobile).

**Props:**

```tsx
interface FileUploadProps {
  accept?: string;  // e.g., 'application/pdf,image/*'
  multiple?: boolean;
  maxSize?: number;  // MB
  onUpload: (files: File[]) => void;
}
```

**Features:**

- **Drag-and-drop** (desktop)
- **Click to browse** (mobile)
- **File type validation** (reject unsupported types)
- **Size limit** (show error if >10MB)
- **Progress bar** (Supabase Storage upload)

**Mobile Behaviour:** Tap to open native file picker (supports camera, photo library, Files app).

### 11.8 DatePicker Component

**Purpose:** Select dates for levies, meetings, reports.

**Implementation:** Use `react-day-picker` with shadcn/ui Popover.

**Features:**

- **Calendar view** (desktop)
- **Native picker** (mobile—`<input type="date">`)
- **Date ranges** (e.g., filter payments from 1 Jan to 31 Mar)
- **Keyboard accessible** (arrow keys navigate calendar)

---

## 12. Theme Architecture

### 12.1 Tailwind Configuration

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',  // Future: toggle dark mode
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          teal: '#0090B7',
          'teal-dark': '#02667F',
          dark: '#3A3A3A',
          light: '#F6F8FA',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        neutral: '#6B7280',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',  // Custom spacing for specific components
      },
      borderRadius: {
        'lg': '0.5rem',
        'xl': '0.75rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),  // Better form defaults
    require('@tailwindcss/typography'),  // Prose styling for rich text
  ],
};

export default config;
```

### 12.2 CSS Custom Properties (Global Styles)

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Colours (sync with Tailwind) */
    --color-primary-teal: #0090B7;
    --color-primary-teal-dark: #02667F;
    --color-primary-dark: #3A3A3A;
    --color-primary-light: #F6F8FA;
    
    /* Spacing */
    --spacing-page-mobile: 1rem;
    --spacing-page-desktop: 2rem;
    
    /* Z-index layers */
    --z-sidebar: 10;
    --z-header: 20;
    --z-modal: 30;
    --z-toast: 40;
    
    /* Transitions */
    --transition-base: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary-teal-dark text-white hover:bg-primary-teal transition-colors rounded-lg px-4 py-2 font-medium;
  }
  
  .card {
    @apply bg-white rounded-lg shadow-card p-4 sm:p-6;
  }
  
  .input-field {
    @apply w-full rounded-lg border-gray-300 focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/20;
  }
}
```

### 12.3 Dark Mode (Future Roadmap)

**Phase 3 Feature:** Many users work late (reviewing financials after business hours). Dark mode reduces eye strain.

**Implementation Strategy:**

1. **Tailwind:** Already configured with `darkMode: 'class'`
2. **Toggle:** Settings page → "Appearance" → Light / Dark / System
3. **Storage:** Save preference in localStorage
4. **Palette (dark mode):**
   - Background: `#1A1A1A`
   - Cards: `#2A2A2A`
   - Text: `#E5E5E5`
   - Primary teal: Lighten to `#00B8E6` (better contrast on dark)

**shadcn/ui Compatibility:** Most shadcn/ui components support dark mode via `dark:` Tailwind classes.

---

## 13. Dependencies & Cross-Feature Impact

This UI framework is **foundational**—every feature in the PRD depends on it.

### 13.1 Feature Dependencies

| Feature | UI/Mobile Dependency |
|---------|---------------------|
| **Levy Management** | Mobile card view for levy roll, responsive forms for levy notice generation |
| **Trust Accounting** | Horizontal scroll table on mobile, sticky column for dates |
| **Meeting Admin** | Mobile attendance recording (large touch targets), document viewer |
| **Maintenance Requests** | Camera integration, photo upload, status updates on mobile |
| **Document Storage** | Mobile PDF viewer, folder navigation, search |
| **Owner Portal** | Fully mobile-first (owners primarily access via phone) |
| **Financial Reporting** | Responsive charts (Recharts), PDF export |

**Critical Path:** UI framework must be complete **before** building feature UIs. Recommendation: Build skeleton components (DataTable, StatCard, forms) in **Week 1-2**, then feature teams consume them.

### 13.2 Third-Party Integrations

| Integration | Mobile Consideration |
|-------------|---------------------|
| **Supabase Storage** | Client-side image compression before upload (reduce mobile data usage) |
| **PDF Generation** | Server-side rendering (react-pdf on Edge Function—too heavy for client) |
| **Email (Resend)** | Responsive email templates (levy notices, meeting notices) |
| **Stripe (Phase 2)** | Stripe Checkout mobile-optimised (no custom implementation needed) |

---

## 14. Open Questions & Decisions Needed

### 14.1 Navigation: Bottom Nav vs Hamburger Menu?

**Options:**

- **A) Bottom nav (5 items):** Faster access (1 tap), iOS/Android native pattern
- **B) Hamburger menu (drawer):** More space for future nav items, cleaner UI

**Recommendation:** **Bottom nav** for MVP (matches mobile app UX, validated by user testing in banking/e-commerce apps). Switch to drawer only if nav exceeds 5 items.

### 14.2 Offline Support in MVP or Phase 2?

**Tradeoff:**

- **MVP with offline:** Longer build time (+3-4 weeks for service worker, IndexedDB, sync logic), better UX for site inspections (may lack WiFi)
- **MVP online-only:** Ship faster, validate product-market fit, add offline in Phase 2 based on customer feedback

**Recommendation:** **Online-only MVP**. Most managers have 4G/5G. Sarah (persona) uses mobile at schemes with WiFi (common area) or tethers to phone. Validate demand before investing in offline.

**Exception:** Photo upload should queue in memory if connection drops mid-upload (retry on reconnect). This is low-effort, high-value.

### 14.3 Native Mobile App or PWA?

**Options:**

- **PWA:** Install from browser, works on iOS/Android, single codebase, push notifications (Android only)
- **Native app (React Native/Expo):** App store distribution, full offline support, camera/biometrics integration

**Recommendation:** **PWA for Phase 2**, native app only if customers demand it. PWAs are 80% of native UX at 20% of the cost. iOS Safari PWA support improved in iOS 16.4 (add to home screen, standalone mode, splash screens).

### 14.4 Chart Library: Recharts (Confirmed)

**Decision:** **Recharts** is the standardized chart library for LevyLite across all features.

**Rationale:**
- **React-native** composition (SVG-based components, not canvas wrapper)
- **Responsive** by default (no manual configuration required)
- **Accessibility** via SVG output (screen reader compatible)
- **Composable API** (intuitive React component syntax)
- **Bundle size** (~80 KB, negligible with code splitting)

All financial reports, dashboards, and analytics will use Recharts components (BarChart, LineChart, PieChart, AreaChart).

---

## 15. Success Metrics (UI/UX)

### 15.1 Performance Metrics

- ✅ **Lighthouse Score:** 90+ (Performance, Accessibility, Best Practices, SEO)
- ✅ **LCP:** <2.5s on 4G mobile (test with Lighthouse)
- ✅ **CLS:** <0.1 (no layout shift during load)
- ✅ **Bundle size:** <200 KB initial JS (gzip)

### 15.2 Usability Metrics

- ✅ **Mobile usage:** 40-50% of sessions on mobile devices (validate mobile-first hypothesis)
- ✅ **Task completion time:** "Record meeting attendance" <2 minutes on mobile (user testing)
- ✅ **Bounce rate:** <30% on mobile (indicates usable mobile experience)
- ✅ **Accessibility audit:** 0 critical violations (axe DevTools)

### 15.3 Adoption Metrics

- ✅ **Owner portal mobile logins:** 60%+ of owner logins from mobile (owners prefer phone over laptop)
- ✅ **Photo uploads from mobile:** 80%+ of maintenance photos uploaded via phone camera (validates camera integration)
- ✅ **Mobile form completion:** 70%+ of forms submitted successfully on first attempt (no validation errors)

---

## 16. Implementation Roadmap

### Week 1-2: Foundation

- [ ] Set up Next.js 15 project with App Router
- [ ] Configure Tailwind CSS with custom LevyLite theme
- [ ] Install shadcn/ui and customize base components (Button, Card, Input, Dialog)
- [ ] Build layout components (Sidebar, BottomNav, TopBar, SchemeSwitch)
- [ ] Implement responsive breakpoints and test on mobile/tablet/desktop

### Week 3-4: Core Components

- [ ] Build DataTable component (with mobile card view)
- [ ] Build StatCard, StatusBadge, EmptyState, LoadingSkeleton
- [ ] Build form components (Input, Select, DatePicker, FileUpload)
- [ ] Build ConfirmDialog, Toast notifications
- [ ] Accessibility audit (keyboard nav, screen reader testing)

### Week 5-6: Mobile Workflows

- [ ] Implement mobile levy roll (card view)
- [ ] Build maintenance request photo upload (camera integration)
- [ ] Build meeting attendance recorder (touch-friendly checkboxes)
- [ ] Test mobile workflows on real devices (iPhone SE, Android mid-range)

### Week 7-8: Performance & Polish

- [ ] Optimize images (Next.js Image component)
- [ ] Lazy load heavy components (PDF viewer, charts)
- [ ] Run Lighthouse CI in GitHub Actions (fail if LCP >3.0s)
- [ ] User testing with design partners (Sarah, Mark personas)
- [ ] Iterate based on feedback

---

## 17. Appendix: Figma Design Files (Future)

**MVP Approach:** Build directly in code (shadcn/ui provides design system). Figma designs are expensive and slow for solo developer.

**Post-MVP:** If Chris hires a designer, create Figma library with:

- Component library (buttons, cards, forms)
- Responsive breakpoints (mobile/tablet/desktop frames)
- User flows (levy management, meeting attendance)
- Design tokens (colours, typography, spacing)

**Tool:** Use Figma's Dev Mode to export Tailwind CSS classes directly.

---

## 18. References

- **WCAG 2.1 Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **Web Vitals:** https://web.dev/vitals/
- **shadcn/ui Documentation:** https://ui.shadcn.com/
- **Next.js Image Optimization:** https://nextjs.org/docs/app/building-your-application/optimizing/images
- **TanStack Table:** https://tanstack.com/table/latest
- **Tailwind CSS:** https://tailwindcss.com/docs

---

**End of Specification**

---

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-16 | Kai | Initial draft |

---

**Next Steps:**

1. **Review with Chris:** Validate responsive strategy, component approach, performance budgets
2. **Create GitHub project:** Break implementation roadmap into tickets (Week 1-8)
3. **Set up Next.js 15 + Supabase skeleton:** Verify tech stack works together
4. **Build first component (Button):** Validate shadcn/ui customization approach
5. **Mobile device testing plan:** Acquire iPhone SE, mid-range Android for testing

**Contact:** Kai | kai@kokorosoftware.com | Kokoro Software, Perth WA
