# Miss Lucille's Marketplace — Master Game Plan
_Updated 2026-04-02 | Integrates Phase Blueprint + Ella Questionnaire + Sales Data + Floor Plan_

---

## PHASE 1 — Compliance Visibility & Data Foundation
**Status: 90% complete | Target close: This week**

### ✅ Done
- [x] Vendor roster extracted (186 booths, 89 occupied, 97 vacant, 48% occupancy)
- [x] Rent amounts documented (~170 booths)
- [x] 90-day sales data loaded (110,570 line items, $1.97M revenue)
- [x] Compliance table built (82 vendors tracked, all Green under current 1x standard)
- [x] Performance standard model built (1x through 5x options ready)
- [x] Vendor type taxonomy started (10 categories from booth photos)
- [x] Pricing anomalies flagged (7 booths with irregular rent)
- [x] Floor plan processed and booth locations mapped
- [x] Ella questionnaire analyzed — operational pain points identified
- [x] Multi-booth operators identified (Heather Augustine x3, Larae Davenport x2, etc.)

### 🔲 Remaining to Close Phase 1
| Task | Owner | Dependency | ETA |
|------|-------|------------|-----|
| Pick performance standard (1x-5x) | Grant/Reese | Meeting with Grant | This week |
| Verify 16 booths with missing rent | Reese | Physical walkthrough | This week |
| Pull vendor contract — map sections 1.3, 2.4, 4.1, 4.3, 5, 10, 12 to compliance metrics | Reese/Ella | Get contract copy | This week |
| Build notice workflow: draft → Ella reviews → approve → send | Mr. Crabs/Reese | Standard must be picked first | After Grant decides |
| Confirm dealer ID → booth mapping for remaining unknowns | Reese | Dashboard check | This week |

### Deliverables at Phase 1 Close
- First compliance report issued with chosen standard
- Warning notice drafts ready for any Red vendors
- Ella briefed on the notice workflow and her review role

---

## PHASE 2A — Revenue Recovery
**Status: Scoped | Target start: Week after Phase 1 closes**

_These came directly from Ella's questionnaire. They don't require vendor cooperation or policy changes — just building tools._

### 2A.1 — Price Lookup & Vendor Response System
**Problem:** Untagged items → staff texts vendor photo → waits 5-10 min → customer leaves.
**Revenue at stake:** 2-3 lost sales/day × ~$30 avg = $2,000-3,000/month

**Implementation steps:**
1. **Week 1:** Build a simple notification queue
   - Staff takes photo of untagged item on tablet/phone
   - System identifies booth (from location or staff input)
   - Sends vendor an SMS/email with photo and "Reply with price" prompt
   - 2-minute timeout → escalates to Ella or lead on duty
2. **Week 2:** Add tracking layer
   - Log every missing-tag incident by vendor
   - Weekly report: which vendors have the most missing tags
   - This becomes a compliance metric — "tag rate" alongside sales performance
3. **Week 3-4:** Vendor catalog (stretch goal)
   - Vendors can upload photos + prices for their inventory
   - Staff searches catalog before texting vendor
   - Reduces wait time to near-zero for cataloged items

**Who builds it:** Reese (dev) + Mr. Crabs (tracking/reporting)
**Ella's role:** Validates the workflow works for front counter reality. She knows the edge cases.

### 2A.2 — Register Reconciliation Tool
**Problem:** Card terminals don't sync with Go Antiquing. Staff hand-types totals → errors → 25-45 min daily reconciliation. Lost receipts = unresolvable discrepancies. Paper close-out picked up by accounting.
**Time at stake:** 15-20 hours/month

**Implementation steps:**
1. **Week 1:** Build digital close-out form
   - Input fields: Go Antiquing expected totals per register (cash, credit, gift card)
   - Input fields: Actual totals per register (cash drawer count, credit batch, gift card batch)
   - Auto-calculate discrepancy per register and all-registers total
   - Flag any discrepancy > $5 with a visual alert
2. **Week 2:** Add smart diagnostics
   - When discrepancy detected, prompt: "Is the discrepancy in cash, credit, or gift card?"
   - If credit/gift card: pull transaction list from Go Antiquing for that register → display for manual receipt matching
   - Log every discrepancy with date, register, amount, resolution status
3. **Week 3:** Reporting & accounting handoff
   - Auto-generate digital close-out report
   - Email to accounting daily (no more paper pickup)
   - Monthly discrepancy trend report — which registers, which shifts, how often

**Who builds it:** Reese (dev)
**Ella's role:** Tests it, confirms it matches her current paper process, flags anything missing.

### 2A.3 — Customer Issue Escalation Button
**Problem:** Ella's team sometimes mishandles angry guests/vendors. No escalation protocol.

**Implementation:**
- Add to the front counter tablet: "Need Help" button
- Tapping it sends an instant notification to Ella or lead on duty with register number and timestamp
- Simple. No workflow. Just a fast alert.

**Who builds it:** Reese (5 min add to existing tablet system)

---

## PHASE 2B — Vendor Accountability & Growth
**Status: Data ready | Target start: Runs parallel with 2A**

### 2B.1 — Performance Standard Enforcement
**Depends on:** Grant picking a standard (Phase 1 close-out)

**Once standard is chosen:**
1. Mr. Crabs generates first compliance report
2. Red vendors get drafted warning notices
3. Ella reviews notices, adds context/nuance where needed
4. Ella delivers via email or phone call
5. 30-day cure period starts
6. Monthly compliance refresh — Mr. Crabs re-runs, auto-drafts next-level notices for vendors still in Red

**Escalation ladder:**
- Month 1 below minimum: Warning notice
- Month 2 consecutive: Probation notice
- Month 3 consecutive: Termination/non-renewal notice

### 2B.2 — Vendor Communication Hub
**Problem:** Same 6 questions over and over. 1-5 day response time when Ashton/Luci needed.

**Implementation:**
1. **Auto-answers (no human needed):**
   - "Do we have additional booths available?" → pulls from live booth data
   - "Can I put in a sale?" → sends process document
2. **Assisted answers (pulls data, Ella confirms):**
   - "Can you check if an item sold?" → POS lookup, Ella verifies
   - "Was my item rung up at the wrong price?" → transaction lookup with tag bag reference
   - "Has the furniture been picked up?" → sold/hold log lookup
3. **Routed to Ella (requires judgment):**
   - "Can you move an item from my account?" → pre-filled request sent to Ella
   - Anything not matching the above → goes to Ella's queue

**Mass communication:** Build email blast system for marketplace-wide announcements.

### 2B.3 — Vendor Recruitment Scoring
**Problem:** Ella manually audits applications, often finds no strong candidates, sometimes can't find the right fit for a specific location.

**Implementation:**
1. Pull WordPress application data
2. Score each applicant against vendor type performance data (we know which categories generate highest revenue/sq ft)
3. Location-aware matching: "Booth 406 is vacant, adjacent to farmhouse decor (booth 404) and leather goods (booth 408) — applicants selling home goods or western accessories would fit best"
4. Ella still picks the 3-5 finalists, but now with data ranking and location context
5. **Active recruitment ads:** When high-performing categories are underrepresented, draft targeted recruitment copy for those vendor types

### 2B.4 — Rate Increase Justification
**Already have the data:**
- Revenue per sq ft by booth type
- Current rent vs. market performance
- Specific vendors on legacy/discounted rates (508 at $160 for 10x20, 714 at $170 for 10x20)

When management is ready, Mr. Crabs drafts the justification memo with:
- Proposed new rates by booth type
- How many vendors are affected
- Projected revenue impact
- Suggested implementation timeline (grandfathering period vs. immediate)

---

## PHASE 3A — Operations Modernization
**Status: Scoped | Target start: After Phase 2A tools are stable**

### 3A.1 — Paper → Digital Conversion
**Priority order (by search frequency and error risk):**

| Wave | System | Current State | Digital Replacement |
|------|--------|---------------|-------------------|
| 1 | Hold log | Paper slips | Searchable database — item, vendor, customer, date, pickup deadline |
| 1 | Sold log | Paper slips | Same — auto-populated from POS where possible |
| 1 | Guest contact info | Notes on paper | Digital form — name, phone, reason, vendor, follow-up status |
| 2 | Daily task checklists | Team notebooks | Tablet-based (extend Monty D system to MLM front counter) |
| 2 | Register close-out | Paper sheets | Already digitized in Phase 2A.2 |
| 3 | Booth key log | Paper log | Timestamp + staff ID digital log |
| 3 | Dressing room log | Paper log | Same |
| 3 | Safe balance | Paper tracking | Digital with daily photo verification |
| 3 | Store inventory/supplies | Paper list | Simple inventory tracker with reorder alerts |

### 3A.2 — Maintenance Integration
- Add MLM as a location in the Monty D tablet system
- Ella can submit requests from her phone
- Auto-notification when marked complete (solves her #1 complaint about "Caleb's List")
- Escalation if not resolved within configurable timeframe

### 3A.3 — Customer Conflict Protocol
- Simple escalation script on front counter tablet for handling angry guests
- "Guest is upset about [pricing/return/wait time/other]" → pre-written response guide
- "Need manager" button pings Ella immediately
- Doesn't replace training but gives the team a safety net

---

## PHASE 3B — Growth, Upsell & Culture Shift
**Status: Conceptual | Target start: After 3A is stable**

### 3B.1 — Guest Discovery Dashboard
- Customers browse by vendor category (vintage, clothing, home decor, etc.)
- Map view showing booth locations
- Search by product type
- QR code at entrance links to the dashboard

### 3B.2 — Vendor Upsell Features
- Social media spotlight packages (proven: "Neato" stress ball case study — $300 in one day from one post)
- Vendor bio/profile on guest dashboard
- Premium placement options
- "Featured vendor of the month" program

### 3B.3 — Performance Gamification
- Monthly leaderboard (top 10 by sales, top 10 by revenue/sq ft)
- Quarterly awards (best presentation, most improved, highest sales)
- Shift culture from "hobby squat" to competitive retail

### 3B.4 — Vendor Self-Service Portal
- Vendors log in to see their own sales data, compliance status, settlement history
- Submit booth change requests, sale announcements, vacation notices
- Reduces Ella's inbound communication load dramatically

---

## TIMELINE OVERVIEW

```
April 2026
├── Week 1: Close Phase 1 (Grant picks standard, Reese verifies booths)
├── Week 2: First compliance report issued, warning notices drafted
├── Week 3: Begin Phase 2A.1 (price lookup system) + 2A.2 (register tool)
└── Week 4: Phase 2A tools in testing with Ella

May 2026
├── Weeks 1-2: Phase 2A tools live, Ella using daily
├── Week 2: Begin Phase 2B.1 (enforcement cycle starts)
├── Week 3: Phase 2B.2 (vendor FAQ hub) + 2B.3 (application scoring)
└── Week 4: First enforcement action on any Month-2 Red vendors

June 2026
├── Phase 2B.4 (rate increase memos if management ready)
├── Begin Phase 3A.1 (paper → digital, Wave 1: hold/sold logs)
├── Phase 3A.2 (maintenance integration)
└── Evaluate Phase 2 results, adjust standards if needed

Q3 2026
├── Phase 3A completes (all paper systems digitized)
├── Phase 3B begins (guest dashboard, vendor upsells)
└── Second occupancy push — recruit for vacant booths using data
```

---

## KEY PEOPLE & ROLES

| Person | Role in This Plan |
|--------|------------------|
| **Grant** | Decides performance standard, approves rate increases, final authority |
| **Ella** | Reviews/delivers notices, tests all front-counter tools, vendor relationship manager |
| **Reese** | Builds tools, manages implementation, coordinates between teams |
| **Mr. Crabs** | Data analysis, compliance reports, notice drafting, vendor profiling |
| **Luci** | Approves new vendor applications (final sign-off) |
| **Ashton** | Escalation contact for vendor questions Ella can't answer |
| **Accounting** | Receives digital close-out reports (replacing paper pickup) |

---

## SUCCESS METRICS

| Metric | Current | Phase 1 Target | Phase 2 Target | Phase 3 Target |
|--------|---------|---------------|---------------|---------------|
| Occupancy rate | 48% | 48% (baseline) | 55% | 65%+ |
| Vendors in Red | Unknown (0 at 1x) | Identified | Reduced by 50% | Near zero |
| Monthly revenue | ~$330K (Feb) | Baseline set | +$5-10K (recovered sales) | +$15-20K |
| Register reconciliation time | 25-45 min/day | — | 5 min/day | Automated |
| Lost sales from missing prices | Unknown | Begin tracking | Reduce by 80% | Near zero |
| Vendor communication response | 1-5 days | — | Same day (auto) | Instant (self-serve) |
| Paper systems | 15+ | — | 5 digitized | All digital |
| Booth turnover (vendors replaced) | 5/year | — | 12-15/year | Performance-driven |
