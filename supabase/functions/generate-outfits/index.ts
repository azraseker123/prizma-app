import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type Item = {
  id: string;
  name: string;
  category: string;
  color: string | null;
  season: string | null;
  notes: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return reply({ error: "Desteklenmeyen istek." }, 405);
  }

  try {
    const token = req.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return reply({ error: "Giriş yapmalısın." }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const key = Deno.env.get("GEMINI_API_KEY");

    if (!url || !anon || !key) {
      return reply({ error: "Sunucu yapılandırması eksik." }, 503);
    }

    const sb = createClient(url, anon, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } =
      await sb.auth.getUser(token);

    if (authError || !authData.user) {
      return reply({ error: "Oturum doğrulanamadı." }, 401);
    }

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return reply({ error: "Geçersiz istek." }, 400);
    }

    const occasion =
      typeof body.occasion === "string"
        ? body.occasion.trim()
        : "";

    const style =
      typeof body.style === "string"
        ? body.style.trim()
        : "";

    if (
      !occasion ||
      occasion.length > 300 ||
      style.length > 500
    ) {
      return reply({
        error: "Etkinlik 1-300, tarz en fazla 500 karakter olmalı.",
      }, 400);
    }

    const { data, error } = await sb
      .from("wardrobe_items")
      .select("id,name,category,color,season,notes")
      .eq("user_id", authData.user.id)
      .limit(100);

    if (error) {
      return reply({ error: "Gardırop okunamadı." }, 500);
    }

    const items = (data || []) as Item[];

    if (items.length < 2) {
      return reply({
        error: "Kombin oluşturmak için en az iki kıyafet eklemelisin.",
      }, 400);
    }

    const wardrobe = items.map((item) => ({
      id: item.id,
      name: String(item.name || "").slice(0, 90),
      category: String(item.category || "").slice(0, 50),
      color: String(item.color || "").slice(0, 40),
      season: String(item.season || "").slice(0, 40),
      notes: String(item.notes || "").slice(0, 150),
    }));

    const instruction = `
Sen PRİZMA uygulamasının Türkçe stil danışmanısın.

Kullanıcının etkinliği:
${occasion}

Kullanıcının istediği tarz:
${style || "Belirtilmedi"}

Kullanıcının GERÇEK gardırobu:
${JSON.stringify(wardrobe)}

Kurallar:
- En fazla 3 farklı kombin öner.
- Yalnızca verilen gardıroptaki ID'leri kullan.
- Her kombin en az 2 farklı kıyafet içermeli.
- Kombinler etkinliğe ve istenen tarza uygun olmalı.
- Yeterli çeşitlilik yoksa daha az kombin üret.
- Kıyafetlerin fotoğraflarını görmüyorsun.
- Kumaş, kesim veya görünüm bilgisi uydurma.
- Aynı kıyafeti farklı kombinlerde kullanabilirsin.
- Bir kombinin içinde aynı ID tekrarlanamaz.
- Kombinleri yalnızca farklı sırayla tekrar etme.
- Uygun kombin oluşturulamıyorsa boş outfits dizisi döndür.
- Açıklamalar kısa, doğal ve Türkçe olsun.
- Yalnızca istenen JSON biçiminde cevap ver.
`;

    const schema = {
      type: "OBJECT",
      properties: {
        outfits: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              description: { type: "STRING" },
              item_ids: {
                type: "ARRAY",
                items: { type: "STRING" },
              },
            },
            required: ["name", "description", "item_ids"],
          },
        },
      },
      required: ["outfits"],
    };

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: instruction }],
          }],
          generationConfig: {
            temperature: 0.5,
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "generate-outfits Gemini error",
        response.status,
        (await response.text()).slice(0, 300),
      );

      return reply({
        error: response.status === 429
          ? "AI kullanım kotası doldu."
          : "AI kombin oluşturamadı.",
      }, 502);
    }

    const raw = await response.json();

    const content = raw?.candidates?.[0]?.content?.parts
      ?.find((part: { text?: string }) =>
        typeof part.text === "string"
      )?.text;

    if (!content) {
      return reply({ error: "AI boş yanıt verdi." }, 502);
    }

    const parsed = JSON.parse(content);
    const validIds = new Set(items.map((item) => item.id));
    const seen = new Set<string>();

    const outfits = (Array.isArray(parsed.outfits)
      ? parsed.outfits
      : [])
      .filter((outfit: any) =>
        outfit &&
        typeof outfit.name === "string" &&
        typeof outfit.description === "string" &&
        Array.isArray(outfit.item_ids)
      )
      .map((outfit: any) => {
        const ids = [...new Set(
          outfit.item_ids.filter(
            (id: unknown) =>
              typeof id === "string" && validIds.has(id)
          )
        )];

        return {
          name: outfit.name.slice(0, 80),
          description: outfit.description.slice(0, 400),
          item_ids: ids,
        };
      })
      .filter((outfit: any) => {
        if (outfit.item_ids.length < 2) return false;

        const signature = [...outfit.item_ids]
          .sort()
          .join("|");

        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      })
      .slice(0, 3);

    return reply({
      outfits,
      message: outfits.length
        ? "Kombinlerin hazır!"
        : "Gardırobundaki parçalarla uygun bir kombin oluşturulamadı.",
    });
  } catch (error) {
    console.error("generate-outfits", String(error));

    return reply({
      error: "Kombin oluşturulurken sunucu hatası oluştu.",
    }, 500);
  }
});
