import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VALID_GST_RATES = [5, 12, 18, 28];

interface Transaction {
  row: number;
  date: string;
  invoice_number: string;
  gstin: string;
  amount: number;
  gst_rate: number;
  gst_amount: number;
  vendor: string;
}

interface FlaggedTransaction extends Transaction {
  issues: string[];
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[\s_\-]/g, "");
}

function getField(row: Record<string, unknown>, patterns: string[]): unknown {
  const keys = Object.keys(row);
  for (const p of patterns) {
    const key = keys.find((k) => normalizeKey(k) === normalizeKey(p));
    if (key !== undefined) return row[key];
  }
  return "";
}

function parseTransactions(rows: Record<string, unknown>[]): Transaction[] {
  return rows.map((row, idx) => ({
    row: idx + 2,
    date: String(getField(row, ["date", "Date"]) ?? ""),
    invoice_number: String(
      getField(row, ["invoicenumber", "invoice", "invoiceno", "invoice_number"]) ?? ""
    ),
    gstin: String(getField(row, ["gstin", "gst", "gstno", "gst_number"]) ?? ""),
    amount: parseFloat(String(getField(row, ["amount", "baseamount", "taxableamount"]) ?? "0")) || 0,
    gst_rate: parseFloat(String(getField(row, ["gstrate", "rate", "taxrate", "gst_rate"]) ?? "0")) || 0,
    gst_amount: parseFloat(String(getField(row, ["gstamount", "taxamount", "gst_amount"]) ?? "0")) || 0,
    vendor: String(getField(row, ["vendor", "vendorname", "supplier", "party"]) ?? ""),
  }));
}

function validateTransactions(transactions: Transaction[]): FlaggedTransaction[] {
  const flagged: FlaggedTransaction[] = [];
  const invoiceSeen = new Map<string, number>();

  for (const t of transactions) {
    const issues: string[] = [];
    const invKey = t.invoice_number.trim();

    if (invKey) {
      if (invoiceSeen.has(invKey)) {
        issues.push(`Duplicate invoice number (first seen at row ${invoiceSeen.get(invKey)})`);
      } else {
        invoiceSeen.set(invKey, t.row);
      }
    }

    const gstin = t.gstin.trim();
    if (!gstin || gstin === "" || gstin.toLowerCase() === "null" || gstin.toLowerCase() === "undefined") {
      issues.push("Missing GSTIN");
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
      issues.push(`Invalid GSTIN format: ${gstin}`);
    }

    if (!VALID_GST_RATES.includes(t.gst_rate)) {
      issues.push(`Invalid GST rate ${t.gst_rate}% — allowed rates: 5%, 12%, 18%, 28%`);
    }

    if (t.amount > 0 && t.gst_rate > 0) {
      const expected = Math.round((t.amount * t.gst_rate) / 100 * 100) / 100;
      const actual = Math.round(t.gst_amount * 100) / 100;
      if (Math.abs(expected - actual) > 0.5) {
        issues.push(
          `GST mismatch: expected ₹${expected.toFixed(2)} (₹${t.amount} × ${t.gst_rate}%) but recorded ₹${actual.toFixed(2)}`
        );
      }
    }

    if (issues.length > 0) {
      flagged.push({ ...t, issues });
    }
  }

  return flagged;
}

async function callGemini(flagged: FlaggedTransaction[], total: number): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return "⚠ GEMINI_API_KEY secret is not configured. Please add it to enable AI-generated explanations.";
  }

  if (flagged.length === 0) {
    return "All transactions passed validation. No compliance issues detected.";
  }

  const issueLines = flagged
    .map(
      (t) =>
        `• Row ${t.row} | Vendor: ${t.vendor || "N/A"} | Invoice: ${t.invoice_number || "N/A"} | Amount: ₹${t.amount} | GST Rate: ${t.gst_rate}% | Issues: ${t.issues.join("; ")}`
    )
    .join("\n");

  const prompt = `You are a senior GST compliance auditor reviewing a batch of flagged transactions for an Indian business.

Total records processed: ${total}
Flagged transactions (${flagged.length} of ${total}):
${issueLines}

Provide a structured compliance report with:
1. Executive Summary (2-3 sentences on overall compliance health)
2. Issue Breakdown (group by issue type, explain risk and regulatory impact under CGST/IGST rules)
3. Priority Action Items (ranked by severity — what must be corrected immediately vs. monitored)

Keep language clear and professional, suitable for both finance teams and business owners. Be specific about regulatory implications.`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    return `Gemini API error: ${err}`;
  }

  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No explanation generated.";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const filename = file.name.toLowerCase();

    let rows: Record<string, unknown>[];

    if (filename.endsWith(".csv")) {
      const text = new TextDecoder().decode(uint8);
      const wb = XLSX.read(text, { type: "string" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
    } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      const wb = XLSX.read(uint8, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported file type. Please upload a CSV or Excel file." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "File is empty or has no data rows." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transactions = parseTransactions(rows);
    const flagged = validateTransactions(transactions);
    const aiExplanation = await callGemini(flagged, transactions.length);

    return new Response(
      JSON.stringify({
        total: transactions.length,
        flagged_count: flagged.length,
        clean_count: transactions.length - flagged.length,
        flagged_transactions: flagged,
        ai_explanation: aiExplanation,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
