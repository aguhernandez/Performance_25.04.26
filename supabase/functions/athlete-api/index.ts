import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // Expected paths (after /athlete-api prefix):
    //   GET /athlete-api/share/{token}          → full snapshot
    //   GET /athlete-api/share/{token}/sessions → sessions only
    //   GET /athlete-api/share/{token}/nutrition → nutrition only
    //   GET /athlete-api/share/{token}/lab       → lab tests only

    const shareIdx = parts.indexOf("share");
    const token = shareIdx >= 0 ? parts[shareIdx + 1] : null;
    const sub = shareIdx >= 0 ? parts[shareIdx + 2] : null;

    if (!token) {
      return errorResponse("Missing share token. Usage: /athlete-api/share/{token}", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: link, error: linkErr } = await supabase
      .from("shareable_links")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (linkErr || !link) {
      return errorResponse("Share link not found", 404);
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return errorResponse("Share link has expired", 410);
    }

    await supabase
      .from("shareable_links")
      .update({ view_count: link.view_count + 1, last_viewed_at: new Date().toISOString() })
      .eq("id", link.id);

    const athleteId = link.athlete_id;

    if (sub === "sessions") {
      if (!link.include_sessions) return errorResponse("Sessions not included in this share link", 403);
      const { data, error } = await supabase
        .from("sessions")
        .select("id,session_date,session_type,title,duration_min,avg_power_watts,normalized_power_watts,avg_hr,rpe,distance_km,elevation_m,impulse,created_at")
        .eq("athlete_id", athleteId)
        .order("session_date", { ascending: false })
        .limit(200);
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ sessions: data, count: data?.length ?? 0 });
    }

    if (sub === "nutrition") {
      if (!link.include_nutrition) return errorResponse("Nutrition data not included in this share link", 403);
      const { data, error } = await supabase
        .from("nutrition_logs")
        .select("id,log_date,calories,protein_g,carbs_g,fat_g,sleep_hours,sleep_quality")
        .eq("athlete_id", athleteId)
        .order("log_date", { ascending: false })
        .limit(90);
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ nutrition: data, count: data?.length ?? 0 });
    }

    if (sub === "lab") {
      if (!link.include_lab) return errorResponse("Lab data not included in this share link", 403);
      const { data, error } = await supabase
        .from("lab_tests")
        .select("id,test_date,test_type,vo2max_result,vlamax_result,cp_result,notes")
        .eq("athlete_id", athleteId)
        .order("test_date", { ascending: false });
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ lab_tests: data, count: data?.length ?? 0 });
    }

    const [athleteRes, sessionsRes, snapshotsRes, nutritionRes, labRes] = await Promise.all([
      supabase
        .from("athletes")
        .select("id,name,sport,vo2max,vlamax,cp_watts,weight_kg,lean_mass_kg,max_hr,resting_hr,created_at")
        .eq("id", athleteId)
        .maybeSingle(),
      link.include_sessions
        ? supabase
            .from("sessions")
            .select("id,session_date,session_type,title,duration_min,avg_power_watts,normalized_power_watts,avg_hr,rpe,distance_km,elevation_m,impulse,created_at")
            .eq("athlete_id", athleteId)
            .order("session_date", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("performance_snapshots")
        .select("snapshot_date,fitness,fatigue,form,recovery_ratio,tau_fitness_used,tau_fatigue_used")
        .eq("athlete_id", athleteId)
        .order("snapshot_date", { ascending: false })
        .limit(365),
      link.include_nutrition
        ? supabase
            .from("nutrition_logs")
            .select("id,log_date,calories,protein_g,carbs_g,fat_g,sleep_hours,sleep_quality")
            .eq("athlete_id", athleteId)
            .order("log_date", { ascending: false })
            .limit(90)
        : Promise.resolve({ data: null, error: null }),
      link.include_lab
        ? supabase
            .from("lab_tests")
            .select("id,test_date,test_type,vo2max_result,vlamax_result,cp_result,notes")
            .eq("athlete_id", athleteId)
            .order("test_date", { ascending: false })
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (athleteRes.error) return errorResponse(athleteRes.error.message, 500);
    if (!athleteRes.data) return errorResponse("Athlete not found", 404);

    const payload: Record<string, unknown> = {
      meta: {
        generated_at: new Date().toISOString(),
        share_label: link.label,
        includes: {
          sessions: link.include_sessions,
          nutrition: link.include_nutrition,
          lab: link.include_lab,
        },
      },
      athlete: athleteRes.data,
      performance_snapshots: snapshotsRes.data ?? [],
    };

    if (link.include_sessions) payload.sessions = sessionsRes.data ?? [];
    if (link.include_nutrition) payload.nutrition = nutritionRes.data ?? [];
    if (link.include_lab) payload.lab_tests = labRes.data ?? [];

    return jsonResponse(payload);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal server error", 500);
  }
});
