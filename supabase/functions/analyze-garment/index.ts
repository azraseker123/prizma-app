import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{...cors,"Content-Type":"application/json"}
});
const categories=["Üst Giyim","Alt Giyim","Dış Giyim","Elbise","Ayakkabı","Çanta","Aksesuar","Diğer"];
const seasons=["Dört Mevsim","İlkbahar","Yaz","Sonbahar","Kış"];
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Yalnızca POST destekleniyor."},405);
 try{
  const bearer=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL");
  const publishable=Deno.env.get("SUPABASE_ANON_KEY");
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const gemini=Deno.env.get("GEMINI_API_KEY");
  if(!bearer)return reply({error:"Önce giriş yapmalısın."},401);
  if(!url||!publishable||!secret||!gemini)return reply({error:"AI yapılandırması tamamlanmadı."},503);
  const sb=createClient(url,publishable,{global:{headers:{Authorization:"Bearer "+bearer}},auth:{persistSession:false}});
  const {data:auth,error:authError}=await sb.auth.getUser(bearer);
  if(authError||!auth.user)return reply({error:"Oturum doğrulanamadı."},401);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  if(!body||typeof body.image!=="string"||typeof body.mimeType!=="string")
   return reply({error:"Geçersiz görsel."},400);
  const mime=body.mimeType;
  if(!["image/jpeg","image/png","image/webp"].includes(mime))return reply({error:"Yalnızca JPG, PNG ve WebP kabul edilir."},400);
  const base64=body.image.replace(/^data:image\/[^;]+;base64,/,"");
  if(base64.length<100||base64.length>4200000||!/^[A-Za-z0-9+/=]+$/.test(base64))
   return reply({error:"Görsel 3 MB sınırını aşıyor veya okunamadı."},413);
  const admin=createClient(url,secret,{auth:{persistSession:false}});
  const start=new Date();start.setUTCHours(0,0,0,0);
  const {count,error:countError}=await admin.from("garment_analysis_usage")
   .select("id",{count:"exact",head:true}).eq("user_id",auth.user.id).gte("created_at",start.toISOString());
  if(countError)return reply({error:"AI kullanım sınırı doğrulanamadı."},503);
  if((count||0)>=10)return reply({error:"Bugünkü 10 fotoğraf analizi hakkın doldu."},429);
  const {error:usageError}=await admin.from("garment_analysis_usage").insert({user_id:auth.user.id});
  if(usageError)return reply({error:"AI kullanım kaydı oluşturulamadı."},503);
  const instruction="Bu fotoğrafta bir kıyafet/aksesuar varsa yalnızca ürünü analiz et. Kişileri tanımlama, yüzleri veya vücutları değerlendirme. Emin değilsen kategori Diğer seç. Görünmeyen renk, kumaş, marka ve etiket uydurma. Türkçe kısa bir kıyafet adı (en fazla 60 karakter), kategorilerden biri, baskın renk adı ve mevsimlerden biri döndür. Fotoğrafta insan varsa bile yalnızca kıyafete odaklan.";
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",{
   method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":gemini},
   body:JSON.stringify({contents:[{role:"user",parts:[{text:instruction},{inline_data:{mime_type:mime,data:base64}}]}],
    generationConfig:{temperature:0.15,responseMimeType:"application/json",responseSchema:{
     type:"OBJECT",properties:{name:{type:"STRING"},category:{type:"STRING",enum:categories},
      color:{type:"STRING"},season:{type:"STRING",enum:seasons}},
     required:["name","category","color","season"]}}}),
  });
  if(!response.ok){console.error("garment analysis returned",response.status);return reply({error:response.status===429?"AI kotası doldu.":"Fotoğraf analiz edilemedi."},502);}
  const result=await response.json();
  const text=String(result?.candidates?.[0]?.content?.parts?.[0]?.text||"");
  let parsed:Record<string,unknown>;
  try{parsed=JSON.parse(text);}catch{return reply({error:"AI sonucu okunamadı."},502);}
  const category=typeof parsed.category==="string"&&categories.includes(parsed.category)?parsed.category:"Diğer";
  const season=typeof parsed.season==="string"&&seasons.includes(parsed.season)?parsed.season:"Dört Mevsim";
  return reply({name:typeof parsed.name==="string"?parsed.name.trim().slice(0,60):"Yeni parça",category,
   color:typeof parsed.color==="string"?parsed.color.trim().slice(0,32):"",season});
 }catch(error){console.error("garment analysis error",error instanceof Error?error.message:"unknown");return reply({error:"Fotoğraf analiz edilemedi."},500);}
});
