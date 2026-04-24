# AuditIQ — AI GST Compliance Audit Assistant

<div align="center">
  <img src="public/favicon.png" alt="AuditIQ Logo" width="80" />
  <h3>Instant GST transaction validation powered by Google Gemini AI</h3>

  ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)
  ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
  ![Supabase](https://img.shields.io/badge/Supabase-Edge%20Functions-3ECF8E?logo=supabase&logoColor=white)
  ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38BDF8?logo=tailwindcss&logoColor=white)
  ![License](https://img.shields.io/badge/License-MIT-green)
</div>

---

## 📋 Overview

**AuditIQ** is a web-based GST compliance audit tool that lets you upload CSV or Excel transaction files and get instant, rule-based GST validation enriched with an AI-generated compliance explanation from **Google Gemini**.

### Key Features

- 📂 **Drag-and-drop file upload** — supports CSV, XLSX, and XLS formats
- ✅ **Rule-based GST validation** — checks 4 critical compliance rules automatically
- 🤖 **AI compliance explanation** — narrative audit report from Google Gemini
- 📊 **Summary dashboard** — total records, flagged count, clean count, and compliance rate
- 🔴 **Flagged transaction table** — with colour-coded issue tags for quick triage
- ⚡ **Serverless backend** — powered by Supabase Edge Functions (Deno)

---

## 🔍 Validation Rules

| Rule | Description |
|------|-------------|
| 🔴 **Missing / Invalid GSTIN** | Transactions with no GSTIN or invalid 15-char format are flagged |
| 🟠 **Invalid GST Rate** | Only 5%, 12%, 18%, and 28% are valid under India's GST law |
| 🔵 **Calculation Mismatch** | `GST Amount` must equal `Base Amount × GST Rate / 100` (±0.5 tolerance) |
| 🟡 **Duplicate Invoice** | Invoice numbers appearing more than once are flagged |

---

## 🗂️ Project Structure

```
gst/
├── public/
│   └── favicon.png           # App favicon
├── src/
│   ├── App.tsx               # Main React component (upload, audit, results)
│   ├── main.tsx              # React entry point
│   ├── index.css             # Global styles
│   └── vite-env.d.ts         # Vite type declarations
├── supabase/
│   └── functions/
│       └── audit-compliance/ # Supabase Edge Function (Deno)
├── .env.example              # Environment variables template
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A [Supabase](https://supabase.com) project with Edge Functions enabled
- A **Google Gemini API key** (configured in your Supabase Edge Function secrets)

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/auditiq-gst.git
cd auditiq-gst
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root (use `.env.example` as a reference):

```bash
cp .env.example .env
```

Then fill in your values:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

> ⚠️ **Never commit your `.env` file.** It is already listed in `.gitignore`.

### 4. Deploy the Supabase Edge Function

```bash
npx supabase functions deploy audit-compliance
```

Set the Gemini API key as a secret:

```bash
npx supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local development server |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |

---

## 📄 Expected CSV / Excel Format

Your uploaded file must include the following columns (case-insensitive):

| Column | Example |
|--------|---------|
| `Date` | `2024-03-15` |
| `Invoice Number` | `INV-2024-001` |
| `GSTIN` | `27AAPFU0939F1ZV` |
| `Amount` | `10000` |
| `GST Rate` | `18` |
| `GST Amount` | `1800` |
| `Vendor` | `Acme Supplies Pvt. Ltd.` |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Backend | Supabase Edge Functions (Deno) |
| AI | Google Gemini API |
| Database | Supabase (PostgreSQL) |

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  Built with ❤️ · Powered by <a href="https://gemini.google.com">Google Gemini</a> & <a href="https://supabase.com">Supabase</a>
</div>
