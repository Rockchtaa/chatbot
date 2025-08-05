In Bearbeitung:
# 📚 Internes Chatbot-System mit Azure AI

Ein interner, KI-gestützter Chatbot zur Beantwortung von Mitarbeitendenanfragen basierend auf unternehmensinternen Daten. Der Chatbot nutzt Azure AI Services und greift über die Sage API auf aktuelle Abwesenheitsinformationen von Mitarbeitenden zu. Externe Datenquellen werden bewusst ausgeschlossen.

---

## 🔧 Tech-Stack

### Backend
- [Node.js](https://nodejs.org/)
- [Express (TypeScript)](https://expressjs.com/)
- [Azure OpenAI Service](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/)
- [Sage API](https://developer.sage.com/) *(nur intern verfügbar)*

### Frontend
- [Vue 3](https://vuejs.org/)
- [Pinia](https://pinia.vuejs.org/) – State Management
- [Vue Router](https://router.vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## 🚀 Features

- 🔍 **KI-Antworten** zu internen Themen basierend auf Azure AI (GPT)
- 🧠 **RAG (Retrieval-Augmented Generation)** mit firmeneigenen Daten
- 📅 **Abfrage von Mitarbeitendenstatus** (Krank/Urlaub + Zeitraum) via Sage API
- 🔐 **Kein Internetzugriff** – 100 % datenschutzkonform
- 🌐 **Moderne Weboberfläche** für einfache Bedienung im Unternehmen

---

## 🛠️ Projektstruktur

```
/backend
  ├─ src/
  │   ├─ routes/
  │   ├─ services/
  │   └─ index.ts
/frontend
  ├─ src/
  │   ├─ components/
  │   ├─ store/
  │   ├─ views/
  │   └─ App.vue
```

---

## ⚙️ Setup

### 🖥 Backend

```bash
cd backend
npm install
npm run dev
```

> 📌 .env-Datei mit Azure & Sage API Keys erforderlich.

### 🌐 Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 📆 Status & Roadmap

- ✅ MVP mit Sage-Integration & Azure AI ist funktionsfähig
- ⏳ Weitere Module geplant (z. B. FAQ, Prozessautomatisierung)

---

## 📄 Lizenz

Internes Projekt – keine öffentliche Lizenzierung.
