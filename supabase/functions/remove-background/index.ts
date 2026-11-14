import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
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
    const briaToken = Deno.env.get("BRIA_API_TOKEN");
    if (!supabaseUrl || !anonKey || !serviceKey || !briaToken) {
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
    const { data: authData, error: authError } = await authClient.auth.getUser();
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
    // This ticket counts toward the shared wardrobe + beauty budget.
    // Refund automatically if the provider fails or we cannot deliver an image.
    const { data: ticket, error: quotaError } = await admin.rpc(
      "reserve_background_removal_ticket",
      { p_user_id: authData.user.id },
    );
    if (quotaError) {
      console.error("Quota error:", quotaError.message);
      return json({ error: "Kullanım limiti kontrol edilemedi." }, 500);
    }
    if (!ticket) {
      return json({ error: "Toplam 100 arka plan kaldırma hakkın doldu." }, 429);
    }

    let succeeded = false;
    try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    let briaResponse: Response;
    try {
      briaResponse = await fetch(
        "https://engine.prod.bria-api.com/v2/image/edit/remove_background",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api_token": briaToken,
          },
          body: JSON.stringify({
            image: imageBase64,
            preserve_alpha: true,
            sync: true,
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!briaResponse.ok) {
      const detail = await briaResponse.text();
      console.error("Bria error:", briaResponse.status, detail.slice(0, 500));
      return json({
        error: briaResponse.status === 403
          ? "Bria deneme hakkı veya API erişimi yetersiz."
          : "Arka plan kaldırma servisi işlemi tamamlayamadı.",
      }, 502);
    }

    const briaData = await briaResponse.json();
    const imageUrl = briaData?.result?.image_url;
    if (typeof imageUrl !== "string") {
      console.error("Bria response missing image URL");
      return json({ error: "Bria işlenmiş görsel adresi döndürmedi." }, 502);
    }

    let outputBase64: string;
    if (imageUrl.startsWith("data:image/png;base64,")) {
      outputBase64 = imageUrl.split(",")[1];
    } else {
      const parsed = new URL(imageUrl);
      if (parsed.protocol !== "https:") {
        return json({ error: "Beklenmeyen görsel adresi." }, 502);
      }
      // Only fetch HTTPS image URLs returned by the trusted Bria API.
      const imageResponse = await fetch(imageUrl, {
        signal: AbortSignal.timeout(15000),
      });
      if (!imageResponse.ok) {
        return json({ error: "İşlenmiş fotoğraf indirilemedi." }, 502);
      }
      const contentType = imageResponse.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/png")) {
        return json({ error: "Bria PNG biçiminde görsel döndürmedi." }, 502);
      }
      const contentLength = Number(imageResponse.headers.get("content-length") ?? "0");
      if (contentLength > 12_000_000) {
        return json({ error: "İşlenmiş fotoğraf çok büyük." }, 502);
      }
      const bytes = new Uint8Array(await imageResponse.arrayBuffer());
      if (bytes.byteLength > 12_000_000) {
        return json({ error: "İşlenmiş fotoğraf çok büyük." }, 502);
      }
      outputBase64 = toBase64(bytes);
    }
    if (!outputBase64) {
      return json({ error: "İşlenmiş fotoğraf boş geldi." }, 502);
    }
    succeeded = true;
    return json({ imageBase64: outputBase64, mimeType: "image/png" });
    } finally {
      if (!succeeded) {
        const { error: releaseError } = await admin.rpc("release_background_removal_ticket", {
          p_user_id: authData.user.id,
          p_id: ticket,
        });
        if (releaseError) console.error("Quota refund error:", releaseError.message);
      }
    }
  } catch (error) {
    console.error("Background removal error:", error);
    return json({ error: "İşlem sırasında bir hata oluştu." }, 500);
  }
});
