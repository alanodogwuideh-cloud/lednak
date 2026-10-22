import { compileLayout } from './templateRegistry';
import { createClient } from '@libsql/client';

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/build-resume") {
      try {
        const { template_id, resume_data, user_id } = await request.json();

        // 1. Inject user text data safely into your secure layout code blueprint
        const finalHtml = compileLayout(template_id, resume_data);

        // 2. Log transaction histories straight into Turso DB
        const turso = createClient({ url: env.TURSO_DB_URL, authToken: env.TURSO_AUTH_TOKEN });
        const recordId = crypto.randomUUID();
        await turso.execute({
          sql: "INSERT INTO resumes (id, user_id, template_id, resume_data) VALUES (?, ?, ?, ?)",
          args: [recordId, user_id || 'anonymous', template_id, JSON.stringify(resume_data)]
        });

        // 3. Save a live web snapshot file straight into your R2 Storage Bucket
        const storagePath = `resumes/${recordId}.html`;
        await env.R2_BUCKET.put(storagePath, finalHtml, {
          customMetadata: { "Content-Type": "text/html" }
        });

        // 4. Return compiled canvas markup straight to the frontend iframe
        return new Response(finalHtml, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    return new Response("API Core Backend Active", { status: 200 });
  }
};
