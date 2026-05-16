# AI-Mentor HUB — Ultra-Detailed Product & UI/UX Specification
## Startup Edition — Banking Onboarding SaaS Platform

---

# 1. PRODUCT OVERVIEW

## Product Name
AI-Mentor

---

# Product Category
B2B SaaS Platform for Banking Employee Onboarding & Training

---

# Core Mission

AI-Mentor HUB helps banks onboard employees:
- faster,
- safer,
- more consistently,
- and with measurable performance visibility.

The platform replaces fragmented onboarding systems including:
- spreadsheets,
- PDFs,
- manual mentor assignment,
- disconnected LMS tools,
- risky access to real banking systems,
- and non-trackable internship programs.

---

# Primary Problems Solved

## HR Problems
- No centralized onboarding visibility
- Difficult mentor assignment
- Hard to measure intern progress
- Manual reporting workflows
- Time-consuming performance reviews
- Poor onboarding standardization

## Employee Problems
- Mentoring overload
- Scattered tasks
- Unclear onboarding ownership
- Limited collaboration tools
- Lack of recognition systems

## Intern Problems
- Confusing onboarding process
- Fear of making mistakes in real systems
- Information overload
- No guided learning structure
- Low engagement during onboarding

---

# Core Solution

AI-Mentor HUB combines:
- onboarding management,
- mentorship,
- simulated banking systems,
- AI learning assistance,
- analytics,
- and gamification

into one unified platform.

---

# 2. DESIGN PHILOSOPHY

# Design Theme
## “Clear Sky SaaS”

A modern, light, premium B2B SaaS aesthetic.

Inspired by:
- Notion
- Linear
- Rippling
- Ramp
- Mercury
- Stripe Dashboard

But adapted specifically for:
- banking operations,
- HR systems,
- and onboarding simulations.

---

# Emotional Feel

The product should feel:
- calm,
- trustworthy,
- intelligent,
- safe,
- structured,
- modern,
- human-centered.

NOT:
- cold enterprise software,
- outdated banking UI,
- overly playful startup design,
- or cluttered dashboards.

---

# UX Principles

## 1. Clarity Over Density
Even data-heavy screens should breathe.

## 2. Guided Progress
Users should always know:
- where they are,
- what comes next,
- and how much remains.

## 3. Encouraging Feedback
The system should reward progress visually and emotionally.

## 4. Safe Learning Environment
Interns must feel comfortable making mistakes.

## 5. Enterprise Trust
The platform must still feel secure and reliable for banks.

---

# 3. TYPOGRAPHY SYSTEM

| Usage | Font | Style |
|---|---|---|
| Headings | Sora | Bold geometric authority |
| Body Text | DM Sans | Clean and readable |
| Data / Stats | IBM Plex Mono | Technical precision |

---

# Typography Scale

| Element | Size | Weight |
|---|---|---|
| Hero Heading | 56px | 700 |
| Section Heading | 36px | 700 |
| Card Heading | 20px | 600 |
| Body Large | 18px | 400 |
| Body | 16px | 400 |
| Caption | 14px | 400 |
| Data Labels | 13px | 500 mono |

---

# 4. COLOR SYSTEM

```css
:root {
  --bg:           #F0F6FF;
  --surface:      #FFFFFF;
  --sidebar:      #E8F2FF;

  --primary:      #3B82F6;
  --primary-dark: #2563EB;
  --secondary:    #0EA5E9;

  --gold:         #F59E0B;
  --success:      #10B981;
  --danger:       #EF4444;

  --text-1:       #1E293B;
  --text-2:       #64748B;

  --border:       #CBD5E1;
  --highlight:    #DBEAFE;
}
```

---

# Color Usage Rules

## Primary Blue
Used for:
- primary CTAs,
- active states,
- progress indicators,
- links,
- focus states.

## Secondary Cyan
Used for:
- gradients,
- highlights,
- XP systems,
- onboarding progress.

## Gold
Used sparingly for:
- bonuses,
- achievements,
- rewards,
- milestone celebrations.

## Green
Used only for:
- successful completion,
- validation,
- active states.

## Red
Used minimally:
- destructive actions,
- critical warnings,
- validation failures.

---

# 5. GLOBAL LAYOUT SYSTEM

# Desktop Grid
- 12-column layout
- max-width: 1440px
- content padding: 32px
- section spacing: 96px

---

# Card System

## Default Card Style
```css
background: #FFFFFF;
border-radius: 12px;
box-shadow: 0 1px 4px rgba(0,0,0,0.07);
border: 1px solid #EFF4FB;
```

---

# Hover Behavior
Cards subtly:
- lift by 2px,
- shadow slightly increases,
- transitions: 180ms ease.

---

# Border Radius System

| Element | Radius |
|---|---|
| Buttons | 8px |
| Cards | 12px |
| Modals | 16px |
| Pills | 999px |

---

# Shadows

## Small
```css
0 1px 4px rgba(0,0,0,0.07)
```

## Medium
```css
0 8px 24px rgba(15,23,42,0.08)
```

## Large Modal
```css
0 24px 64px rgba(15,23,42,0.18)
```

---

# 6. LANDING PAGE SPECIFICATION

# Navbar

## Structure
- Sticky top
- Height: 72px
- White background
- Subtle bottom border

---

## Left Section
AI-Mentor HUB wordmark:
- Sora font
- 700 weight
- Primary blue

Optional icon:
- abstract cloud/grid/mentor symbol.

---

## Center Navigation
Links:
- Features
- How It Works
- Pricing
- Contact

Hover:
- text becomes primary blue,
- subtle underline animation.

---

## Right Actions
### Log In
Ghost button:
- white background,
- blue border,
- hover → light blue background.

### Get Started
Primary button:
- blue fill,
- white text,
- hover darkens slightly.

---

# Hero Section

## Layout
2-column split:
- left text,
- right illustration/dashboard.

Gap:
64px.

---

# Hero Left Content

## Heading
> “The smarter way to onboard banking teams”

Large Sora heading:
- 56px,
- tight line-height,
- max-width 620px.

---

## Subheading
Readable paragraph width:
- max 540px,
- muted slate color.

---

## CTA Row
Buttons:
- Start Free Trial
- Watch Demo

Watch Demo includes:
- play icon,
- hover animation.

---

# Hero Illustration

Mockup should include:
- analytics cards,
- onboarding progress,
- AI assistant bubble,
- banking simulator preview.

NO:
- overly futuristic UI,
- crypto aesthetic,
- dark fintech visuals.

---

# Background Styling

Use:
- soft organic blob shapes,
- ultra-light blue overlays,
- blurred gradient circles.

Avoid:
- sharp gradients,
- noisy textures,
- neon effects.

---

# Social Proof Strip

## Layout
Thin horizontal strip:
- centered logos,
- grayscale,
- subtle opacity.

Auto-scroll slowly on large screens.

---

# Features Section

## Layout
3 equal-width feature cards.

Spacing:
32px gap.

---

# Feature Card Interaction

Hover:
- slight elevation,
- accent stripe glows slightly,
- icon scales subtly.

---

# HR Teams Card
Includes:
- CRM dashboard,
- mentor assignment,
- analytics,
- task systems,
- performance visibility.

---

# Employee Card
Includes:
- mentorship management,
- task ownership,
- collaboration tools,
- skills tracking.

---

# Intern Card
Includes:
- onboarding simulator,
- AI assistant,
- gamified progression,
- structured learning path.

---

# How It Works Section

## Layout
Horizontal timeline.

Each step contains:
- number circle,
- icon,
- title,
- description.

Connector line animates on scroll.

---

# Stats Section

Counters animate upward on viewport entry.

Metrics:
- 30% faster onboarding
- 24/7 AI support
- 0 customer data exposure
- <2s AI response

Numbers use IBM Plex Mono.

---

# Testimonials

## Card Layout
- avatar,
- quote,
- role,
- company.

Cards stagger slightly vertically for organic feel.

---

# Final CTA Band

Background:
```css
#DBEAFE
```

Centered content:
- strong heading,
- supportive text,
- CTA button.

---

# Footer

## Structure
4-column layout:
- Product
- Company
- Resources
- Contact

Bottom row:
- copyright,
- language selector,
- social icons.

---

# 7. HR DASHBOARD

# Layout Structure

## Sidebar
- fixed left,
- width: 240px,
- light blue background.

## Top Navbar
- white,
- 64px height.

## Main Content
- scrollable,
- soft blue page background.

---

# Sidebar Behavior

## Active Item
```css
background: #DBEAFE;
border-left: 3px solid #3B82F6;
font-weight: 600;
```

---

# Sidebar Items
- Overview
- Employees
- Interns
- Mentors
- Tasks
- Analytics
- Bonuses
- Settings

Icons:
- outlined,
- minimalist,
- consistent stroke weight.

---

# Top Navbar

## Left
Global search bar.

## Center
Optional breadcrumb.

## Right
- notifications bell,
- language switcher,
- avatar dropdown.

---

# KPI Cards

Each card contains:
- title,
- large number,
- percentage delta,
- small trend icon.

Hover:
- subtle lift,
- animated number transitions.

---

# Team Table

## Header Row
```css
background: #F8FAFF;
```

Sticky while scrolling.

---

# Table Features

## Search
Instant filtering.

## Sorting
All columns sortable.

## Row Hover
```css
background: #DBEAFE;
```

## Export
CSV export button top-right.

---

# Status Pills

| State | Color |
|---|---|
| Active | Green |
| In Training | Blue |
| Pending | Amber |
| Locked | Gray |

---

# Mentor Assignment Modal

## Modal Overlay
Dark translucent background:
```css
rgba(15,23,42,0.45)
```

Fade + scale animation.

---

## Modal Layout
2-column modal:
- intern info,
- mentor list.

Mentor cards display:
- avatar,
- specialization,
- current mentees,
- workload status,
- availability.

---

# Bonus System

## Bonus Types
- Performance
- Milestone
- Spot Bonus

---

# Reward Feel
The modal should feel:
- celebratory,
- warm,
- motivating.

Gold accents appear only here.

---

# Analytics Dashboard

## Charts
- line chart,
- bar chart,
- pie chart.

---

# Chart Rules
- minimal grid lines,
- no clutter,
- soft animation on load,
- rounded chart bars.

---

# 8. EMPLOYEE DASHBOARD

# Purpose
Help employees:
- manage tasks,
- mentor interns,
- track growth,
- communicate efficiently.

---

# Task Cards

Each task includes:
- title,
- deadline,
- progress,
- priority stripe,
- status state.

---

# Priority Colors

| Priority | Color |
|---|---|
| Low | Blue |
| Medium | Amber |
| High | Red |

---

# Mentee List

Each row:
- avatar,
- module status,
- progress bar,
- quick message action.

Progress bars animate on update.

---

# Skill Radar Chart

Axes:
- Compliance
- KYC
- AML
- Communication
- Technical Skills

Blue semi-transparent fill.

---

# Recommendation Engine UI

Small cards:
- module title,
- estimated duration,
- relevance reason.

Example:
> “Recommended because your Compliance score improved.”

---

# Notification Feed

Supports:
- unread indicators,
- grouped notifications,
- smooth dismissal animation.

---

# 9. INTERN DASHBOARD

# Goal
Make onboarding:
- interactive,
- safe,
- rewarding,
- easy to follow.

---

# Top Progress Bar

Full-width onboarding tracker.

Animated gradient:
```css
#0EA5E9 → #3B82F6
```

Milestones:
- completed,
- current,
- upcoming.

---

# Learning Path Column

Vertical module system.

## Module States

### Completed
- green check,
- slight glow.

### Current
- animated blue border,
- visible progress bar.

### Locked
- reduced opacity,
- soft lock icon,
- still visually visible.

---

# Simulator Interface

## Design Direction
Should resemble:
- a modern banking terminal,
- but simplified for onboarding.

---

# Includes
- blue module header,
- task instructions,
- synthetic client data,
- forms,
- dropdowns,
- validation states.

---

# Validation UX

## Correct Input
Green border + soft success check.

## Incorrect Input
Red border + helpful explanation.

Never punish harshly.

---

# Submit Interaction

When completed:
- score animation,
- XP reward,
- success toast,
- next-step suggestion.

---

# AI Assistant

Floating bottom-right assistant.

Supports:
- Uzbek,
- Russian.

Functions:
- explain workflows,
- clarify terminology,
- guide next steps,
- answer onboarding questions.

---

# Progress & Motivation Column

# Daily To-Do
Daily reset checklist.

---

# XP System

## Purpose
Increase engagement and completion motivation.

---

# Level Structure
Example:
- Level 1 → Beginner
- Level 2 → Trainee
- Level 3 → Junior Trainee

---

# Badge System

Earned badges:
- colorful,
- celebratory,
- slightly animated.

Locked badges:
- grayscale,
- tooltip hint.

---

# Mentor Card

Contains:
- avatar,
- role,
- online status,
- message action,
- call scheduling action.

---

# 10. GLOBAL COMPONENT SYSTEM

# Buttons

## Primary
```css
background: #3B82F6;
color: white;
```

Hover:
```css
background: #2563EB;
```

---

## Ghost
Transparent with border.

Hover:
```css
background: #DBEAFE;
```

---

# Inputs

## Default
- white background,
- gray border,
- rounded corners.

## Focus
Blue border + subtle glow.

---

# Toast Notifications

Position:
bottom-right.

Auto-dismiss:
4 seconds.

Types:
- success,
- warning,
- error,
- info.

---

# Modals

Animation:
- fade-in,
- slight scale-up.

Overlay blur optional.

---

# Tables

Desktop:
full-width.

Mobile:
horizontal swipe cards.

---

# 11. RESPONSIVE BEHAVIOR

# Tablet
- reduced spacing,
- stacked analytics,
- collapsible sidebar.

---

# Mobile

## Navigation
Sidebar becomes bottom navigation.

Max 5 tabs visible.

---

# Simulator
Becomes fullscreen.

Back button pinned top-left.

---

# Cards
Stack vertically.

---

# Tables
Scrollable horizontally.

---

# AI Assistant
Always fixed bottom-right.

---

# 12. MICROCOPY SYSTEM

# HR Tone
Action-focused and efficient.

Examples:
- Assign Mentor
- Export Report
- Review Progress

---

# Employee Tone
Supportive and collaborative.

Example:
> “Your mentee Jasur is making great progress 🎉”

---

# Intern Tone
Encouraging and confidence-building.

Example:
> “Great work! You've completed 3 of 5 modules.”

Avoid robotic system messages.

---

# Empty States

Bad:
> “No data available.”

Good:
> “You're all caught up for today.”

---

# Error States

Bad:
> “Submission failed.”

Good:
> “We couldn’t save your changes. Please try again.”

---

# 13. ANIMATION SYSTEM

# Principles
Animations should:
- guide attention,
- reward progress,
- feel smooth,
- never distract.

---

# Timing

| Interaction | Duration |
|---|---|
| Hover | 180ms |
| Modal Open | 240ms |
| Page Transition | 300ms |
| Progress Fill | 500ms |

---

# Animation Examples

## XP Gain
Number counts upward smoothly.

## Progress Completion
Bar fills with gradient animation.

## Badge Unlock
Small bounce + glow.

---

# 14. ACCESSIBILITY

# Requirements
- WCAG AA contrast minimum
- keyboard navigation
- visible focus states
- screen-reader labels
- semantic HTML

---

# Accessibility Features

## Charts
Include data summaries.

## Icons
Must have labels/tooltips.

## Inputs
Associated labels always visible.

---

# 15. FUTURE EXPANSION IDEAS

Potential future modules:
- AI-generated onboarding plans
- Voice assistant
- Video onboarding
- Real LMS integrations
- HR predictive analytics
- Compliance certification system
- Branch performance comparison
- Multi-bank white-label support

---

# 16. FINAL PRODUCT IDENTITY

AI-Mentor HUB should feel like:
- a premium modern SaaS platform,
- designed specifically for banking onboarding,
- combining enterprise trust with startup usability,
- and making onboarding feel guided, measurable, and rewarding.

The experience should communicate:
- safety,
- clarity,
- confidence,
- progress,
- and professionalism.