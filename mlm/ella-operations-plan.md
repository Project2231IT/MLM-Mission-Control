# Miss Lucille's Marketplace — Operations Improvement Plan
_Based on Ella Questionnaire + Phase 1 Data | Generated 2026-04-02_

---

## Executive Summary

Ella is running a 186-booth marketplace on paper, memory, and manual processes. The biggest revenue leaks are: **lost sales from missing prices** (customers leave while waiting 5-10 min for vendor response), **undetected register discrepancies** (card terminals don't sync with POS), and **zero vendor accountability** (current standard is unenforced). Below is a prioritized plan organized by impact.

---

## 🔴 TIER 1 — Revenue Impact (Do These First)

### 1.1 — Price Lookup System (Biggest Single Win)
**Problem:** Items frequently have no tag. Ella's team texts the vendor a photo and waits 5-10 minutes. Customers leave. This is direct lost revenue every single day.

**Solution:** Build a vendor price submission system.
- When an untagged item is found, snap a photo and it goes into a queue
- Vendor gets an instant notification (SMS/email) with the photo
- If vendor doesn't respond in 2 minutes, system escalates to Ella
- Track how often each vendor has missing tags — this becomes a compliance metric
- **Phase 3 tie-in:** Eventually, vendors maintain a basic catalog with photos and prices. Staff looks up the item instead of texting.

**Revenue recovered:** Even 2-3 saved sales per day × $30 avg = $2,000-3,000/month in recovered revenue.

### 1.2 — Register Reconciliation Automation
**Problem:** Card terminals don't sync with Go Antiquing POS. Staff hand-types totals into the card terminal, creating frequent discrepancies. Reconciliation takes 25-45 min daily. When a receipt is lost, the discrepancy is unresolvable.

**Solution:**
- **Immediate:** Build an automated comparison tool. Ella inputs the Go Antiquing expected totals and the actual totals (cash drawer, credit batch, gift card batch) per register. System flags discrepancies instantly, calculates the gap, and generates the close-out report digitally.
- **Longer term:** Investigate POS-to-terminal integration to eliminate hand-typing entirely.
- **Output:** Digital close-out report auto-sent to accounting. No more paper pickup.

**Time saved:** 25-45 min/day → 5 min/day. ~30 min/day recovered = 15+ hours/month.

### 1.3 — Performance Standard Enforcement (Ready Now)
**Problem:** Current standard is "make rent in 1 of 3 months" — effectively unenforced. Only 5 booth turnovers in all of 2025. Underperformers squat indefinitely.

**Solution:** Already built. Compliance model with 1x-5x options ready for Grant to choose. Once selected:
- Auto-generate monthly compliance reports
- Auto-draft warning/probation/termination notices
- Ella delivers (with human judgment override — she knows vendor circumstances)
- Track consecutive months in Red

**Revenue impact:** Every underperforming booth replaced with a recruited high-performer increases revenue. At 48% occupancy, there's also massive upside in filling vacant booths with the RIGHT vendors.

---

## 🟡 TIER 2 — Time Savings & Accountability

### 2.1 — Vendor Communication Hub
**Problem:** Vendors email or call and leave messages. Mass communication has no efficient channel. Response time to vendor questions is 1-5 days when Ashton or Luci need to be looped in.

**Solution:**
- Vendor FAQ auto-responder for the top repeated questions:
  - "Do we have additional booths available?" → Auto-answer from live booth availability data
  - "Can you check if an item is sold?" → Lookup from POS/sold log
  - "Can you check if an item was rung up at the wrong price?" → Lookup from transaction data
  - "Has the furniture been picked up?" → Lookup from sold/hold log
  - "Can I put in a sale?" → Process doc with instructions
  - "Can you move an item from my account?" → Route to Ella with details pre-filled
- Mass notification system for announcements (email blast or SMS)

**Time saved:** Eliminates majority of Ella's repetitive vendor Q&A. Estimated 1-2 hours/day.

### 2.2 — Paper → Digital Conversion
**Problem:** Ella tracks 15+ things on paper: opening/closing tasks, safe balance, booth key log, dressing room log, daily tasks, register close-out, hold log, sold log, vendor sales, hold slips, sold slips, store inventory, guest contact info, team task notebooks.

**Solution:** Digitize in phases:
- **Phase A (immediate):** Hold log, sold log, guest contact info → simple digital forms that feed a searchable database
- **Phase B:** Daily task checklists for staff (this is already being built for maintenance via the tablet workflow — extend to MLM front counter)
- **Phase C:** Booth key log, dressing room log → timestamp-tracked digital logs

**Impact:** Searchable records, no lost paper, audit trail for everything.

### 2.3 — Maintenance Request Tracking
**Problem:** Issues go on "Caleb's List" spreadsheet. Ella doesn't get notified when things are fixed — has to manually check the list.

**Solution:** Already partially solved — the maintenance tablet system (Monty D) is being built. MLM needs to be added as a location with:
- Ella can submit requests from her phone/tablet
- Auto-notification when marked complete
- Escalation if not resolved within X days

---

## 🟢 TIER 3 — Strategic (Phase 2-3)

### 3.1 — Vendor Recruitment Pipeline
**Problem:** When a vendor leaves, Ella manually audits applications and sends 3-5 to Luci for approval. No scoring, no data-driven selection.

**Solution:** Score incoming WordPress applications against successful vendor profiles (we have the data — vendor types with highest revenue/sq ft). Auto-rank applicants. Ella still picks the finalists but with data backing.

### 3.2 — Booth Presentation Standards
**Problem:** Ella fixes minor issues herself or emails vendors about major ones. No systematic tracking.

**Solution:** Periodic booth photo audit → AI categorization + presentation scoring. Track over time. Tie to compliance alongside sales performance.

### 3.3 — Customer Self-Service
**Problem:** Repeated customer questions (no returns, dressing rooms available, furniture pickup policy, no layaway) despite signage.

**Solution:** Digital displays at checkout with rotating FAQ. QR code on receipts linking to policy page. Reduces front-counter interruptions.

### 3.4 — Guest Discovery Dashboard (Phase 3)
Already discussed — let customers browse by category, see booth locations on a map. Vendor bios and social shoutouts as upsell features.

---

## Priority Sequence

| Priority | Initiative | Owner | Timeline | Impact |
|----------|-----------|-------|----------|--------|
| 1 | Performance standard decision | Grant/Reese | This week | Unlocks enforcement |
| 2 | Price lookup/vendor response system | Reese/Dev | 2-4 weeks | Direct revenue recovery |
| 3 | Register reconciliation tool | Reese/Dev | 1-2 weeks | 15+ hrs/month saved |
| 4 | Vendor FAQ auto-responder | Mr. Crabs/Dev | 2-3 weeks | 1-2 hrs/day saved for Ella |
| 5 | Digital hold/sold log | Reese/Dev | 1-2 weeks | Searchability, no lost paper |
| 6 | Maintenance integration | Reese | Already in progress | Auto-notifications |
| 7 | Vendor recruitment scoring | Mr. Crabs | Phase 2 | Better vendor selection |
| 8 | Booth presentation audits | Mr. Crabs | Phase 2 | Visual standards |
| 9 | Customer self-service | Reese/Dev | Phase 3 | Reduced interruptions |
| 10 | Guest discovery dashboard | Reese/Dev | Phase 3 | Customer experience |

---

## Key Insight from Ella's Responses

**Ella is the institutional knowledge.** She knows which booth an untagged item belongs to by memory. She knows which vendors are going through personal struggles. She knows the nuance behind every compliance decision. Any automation must preserve her judgment loop — the goal is to give her better tools, not replace her decision-making. The system drafts, she approves. The system flags, she decides. That's the model.

---

## What Ella Said That Matters Most

> "What could hold me back is not having time or if the notice is lacking nuance."

Translation: She'll enforce if we make it easy AND keep her in the loop on tone. Auto-generated notices need a human review step before delivery.

> "The price of items" — the one thing she wants instantly available.

This is the #1 operational pain point AND the #1 revenue leak. Solve this first.
