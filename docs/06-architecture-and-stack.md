# 06 — System Architecture & Tech Stack

> Source sections: 7 and 9 of the original AI-Mentor-HUB project overview.

---

## 7. System Architecture

### Layers

```
USERS
  HR Specialist | Existing Employee | Newcomer

FRONTEND
  React / Vue.js | Mobile-Responsive Web

BACKEND
  Python (AI/ML) | Node.js (API) | API Gateway

CORE SERVICES
  AI Assistant + RAG Search
  Bank Simulator Engine
  iSpring LMS Integration
  PostgreSQL — Progress & Logs
```

### Key Technical Decisions

- **LLM + RAG:** Grounds AI answers in actual bank documents; prevents hallucination
- **Dummy Data Only:** Simulator runs on synthetically generated data; no real accounts, no real money
- **Cross-Platform:** Web browser + mobile-responsive
- **API Gateway:** Connects frontend to all backend services including iSpring and HR system

---

## 9. Tech Stack

| Layer        | Technologies                                     |
| ------------ | ------------------------------------------------ |
| Frontend     | React.js / Vue.js                                |
| Backend      | Python (AI/ML models), Node.js, REST API Gateway |
| AI/ML        | LLM, RAG Architecture, NLP (Uzbek + Russian)     |
| Database     | PostgreSQL (user progress, logs)                 |
| Integrations | iSpring LMS, HR System API                       |
