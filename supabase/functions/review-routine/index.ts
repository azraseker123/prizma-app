import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"POST gerekli."},405);
 try{
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return reply({error:"Giriş yapmalısın."},401);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),key=Deno.env.get("GEMINI_API_KEY");
  if(!url||!anon||!service||!key)return reply({error:"AI yapılandırması eksik."},503);
  const sb=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
  const {data:auth,error:authError}=await sb.auth.getUser(token);
  if(authError||!auth.user)return reply({error:"Oturum doğrulanamadı."},401);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  const category=body?.category;
  const period=body?.period;
  const steps=body?.steps;
  if(!["skin","hair","makeup"].includes(String(category))||!["Sabah","Akşam"].includes(String(period))||
    !Array.isArray(steps)||steps.length>20||steps.some(x=>typeof x!=="string"||x.length>100))
     return reply({error:"Rutin verileri geçersiz."},400);
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const start=new Date();start.setUTCHours(0,0,0,0);
  const {count,error:countError}=await admin.from("routine_ai_review_usage").select("id",{count:"exact",head:true})
    .eq("user_id",auth.user.id).gte("created_at",start.toISOString());
  if(countError)return reply({error:"Kullanım sınırı kontrol edilemedi."},503);
  if((count||0)>=5)return reply({error:"Günlük 5 rutin analizi sınırına ulaşıldı."},429);
  const {error:usageError}=await admin.from("routine_ai_review_usage").insert({user_id:auth.user.id});
  if(usageError)return reply({error:"Kullanım kaydı oluşturulamadı."},503);
  const instruction=[
   "Sen PRİZMA Türkçe kozmetik bakım rutini danışmanısın.",
   "Yalnızca düşük riskli genel bakım önerileri ver; tanı koyma veya ilaç reçete etme.",
   "Cilt hastalıkları için tıbbi teşhis ve güçlü aktif içerik kullanımı önermeden bir uzmana danışmayı öner.",
   "Fotoğraf, cilt tanısı veya doğrulanmamış ürün içeriği bildiğini iddia etme.",
   "Mevcut adımları kullanıcı onayı olmadan değiştiremezsin.",
   "En fazla 3 opsiyonel kısa adım öner, yalnızca faydalıysa; bir şey eksik değilse boş dizi döndür.",
   "Her öneri makul, zararsız ve spesifik bir rutin eylemi olmalı.",
   "Kullanıcı kategorisi: "+category,
   "Dönem: "+period,
   "Mevcut adımlar: "+JSON.stringify(steps),
   "Bir paragraf özet ve opsiyonel adımlar için JSON döndür."
  ].join("\n");
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",{
   method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},
   body:JSON.stringify({contents:[{role:"user",parts:[{text:instruction}]}],generationConfig:{
    temperature:0.2,responseMimeType:"application/json",responseSchema:{type:"OBJECT",properties:{
     summary:{type:"STRING"},suggestions:{type:"ARRAY",items:{type:"OBJECT",properties:{
      title:{type:"STRING"},reason:{type:"STRING"}},required:["title","reason"]}}},required:["summary","suggestions"]}}}),
  });
  if(!response.ok){console.error("routine review provider error",response.status);return reply({error:"AI rutin analizi şu an çalışmıyor."},502);}
  const raw=await response.json();
  const rawText=String(raw?.candidates?.[0]?.content?.parts?.[0]?.text||"");
  let obj:Record<string,unknown>;
  try{obj=JSON.parse(rawText);}catch{return reply({error:"AI yanıtı okunamadı."},502);}
  const suggestions=(Array.isArray(obj.suggestions)?obj.suggestions:[])
    .filter((x):x is {title:string;reason:string}=>x&&typeof x.title==="string"&&typeof x.reason==="string")
    .slice(0,3).map(x=>({title:x.title.slice(0,100),reason:x.reason.slice(0,250)}));
  return reply({summary:typeof obj.summary==="string"?obj.summary.slice(0,550):"Rutinin değerlendirildi.",suggestions});
 }catch(error){console.error("routine review failed",error instanceof Error?error.message:"unknown");return reply({error:"AI değerlendirme yapılamadı."},500);}
});
