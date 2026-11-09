import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toBase64(bytes: Uint8Array): string {
  let result = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(result);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const falKey = Deno.env.get("FAL_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey || !falKey) {
      return json({ error: "Sunucu yapılandırması eksik." }, 500);
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Oturum açmalısın." }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser();

    if (authError || !authData.user) {
      return json({ error: "Geçersiz oturum." }, 401);
    }

    const body = await req.json().catch(() => null);
    const imageBase64 = body?.imageBase64;
    const mimeType = body?.mimeType ?? "image/jpeg";

    if (
      typeof imageBase64 !== "string" ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64) ||
      imageBase64.length > 8_000_000 ||
      imageBase64.length < 100
    ) {
      return json({ error: "Geçerli bir fotoğraf seç." }, 400);
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return json({ error: "Desteklenmeyen fotoğraf biçimi." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: allowed, error: quotaError } = await admin.rpc(
      "reserve_background_removal",
      { p_user_id: authData.user.id },
    );

    if (quotaError) {
      console.error("Quota error:", quotaError.message);
      return json({ error: "Kullanım limiti kontrol edilemedi." }, 500);
    }

    if (!allowed) {
      return json({
        error: "Günlük arka plan kaldırma hakkın doldu.",
      }, 429);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let falResponse: Response;

    try {
      falResponse = await fetch(
        "https://fal.run/fal-ai/bria/background/remove",
        {
          method: "POST",
          headers: {
            Authorization: `Key ${falKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: `data:${mimeType};base64,${imageBase64}`,
            sync_mode: true,
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!falResponse.ok) {
      const detail = await falResponse.text();
      console.error("fal.ai error:", falResponse.status, detail.slice(0, 500));

      return json({
        error: falResponse.status === 402
          ? "fal.ai bakiyesi yetersiz. Kredi yüklenmesi gerekiyor."
          : "Arka plan kaldırma servisi işlemi tamamlayamadı.",
      }, 502);
    }

    const falData = await falResponse.json();
    const imageUrl = falData?.image?.url;

    if (typeof imageUrl !== "string") {
      return json({ error: "fal.ai görsel döndürmedi." }, 502);
    }

    let outputBase64: string;

    if (imageUrl.startsWith("data:image/")) {
      outputBase64 = imageUrl.split(",")[1];
    } else {
      const parsed = new URL(imageUrl);

      if (
        parsed.protocol !== "https:" ||
        !(
          parsed.hostname === "fal.media" ||
          parsed.hostname.endsWith(".fal.media")
        )
      ) {
        return json({ error: "Beklenmeyen görsel adresi." }, 502);
      }

      const imageResponse = await fetch(imageUrl);

      if (!imageResponse.ok) {
        return json({ error: "İşlenmiş fotoğraf indirilemedi." }, 502);
      }

      const bytes = new Uint8Array(await imageResponse.arrayBuffer());
      outputBase64 = toBase64(bytes);
    }

    if (!outputBase64) {
      return json({ error: "İşlenmiş fotoğraf boş geldi." }, 502);
    }

    return json({
      imageBase64: outputBase64,
      mimeType: "image/png",
    });
  } catch (error) {
    console.error("Background removal error:", error);
    return json({ error: "İşlem sırasında bir hata oluştu." }, 500);
  }
});
