Yes. For the hackathon, I’d reduce the backend/product PRD to just **5 must-have features**.

## JalurEkspor — Simplified MVP PRD

### 1. Adaptive Export Readiness Assessment

The system must assess each UMKM based on its actual export condition instead of using one generic checklist. Questions should adapt based on previous answers and cover six readiness areas: legalitas usaha, produk & kapasitas, pasar tujuan, HS & Lartas, dokumen ekspor, and eksekusi ekspor. The result must show different readiness conditions for different UMKM and must not use one overall readiness score. This directly matches the brief’s requirement to distinguish businesses with different blockers and readiness levels. 

### 2. Personalized Next Actions

After the assessment, the system must generate a simple readiness summary and **maximum three prioritized next actions** for the UMKM. Each action should explain what to do, why it matters, and what information or evidence is needed. Guidance must use plain Bahasa Indonesia and translate technical concepts such as HS Code, PEB, and Lartas into understandable actions for first-time exporters. 

### 3. AI Draft With Explainable Context

AI must support the mentoring process by preparing a draft recommendation, but it must also show the information behind that recommendation. Officers should be able to see the facts used, missing information, uncertainty, and relevant source references. AI must never present a final HS Code, Lartas decision, PEB approval, or other official Customs decision. The brief explicitly requires AI to remain a supporting tool rather than the decision-maker. 

### 4. Officer Review and Validation

Every recommendation must go through a real officer review process before it becomes the final mentoring plan shown to the UMKM. The officer must be able to review the case, edit the AI recommendation, request additional information, escalate the case, or review and send the mentoring plan. The system must clearly record that the recommendation was reviewed by an officer. Officer-in-the-loop is a core requirement and represents 25% of the judging score. 

### 5. Mentoring Progress and History

The system must preserve the UMKM’s mentoring journey over time so future consultations do not start from zero. It should keep the readiness result, officer review, requested updates, next actions, completed tasks, and important case events in one history or timeline. The current next action and whether the UMKM or officer needs to act should always be visible. Continuous monitoring is explicitly part of the client problem, not just a one-time assessment. 

That’s enough for the MVP.

In one line:

**Assess → recommend → explain → officer reviews → track progress.**

Everything else—OCR, integrations, analytics, admin, WhatsApp, complex dashboards—should be stretch features only.
