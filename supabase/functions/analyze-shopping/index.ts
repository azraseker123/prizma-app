import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try {
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return reply({error:"Giriş yapmalısın."},401);
  const url=Deno.env.get("SUPABASE_URL")!;
  const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
  const sb=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
  const {data:{user},error:authError}=await sb.auth.getUser(token);
  if(authError||!user)return reply({error:"Oturum doğrulanamadı."},401);
  const key=Deno.env.get("GEMINI_API_KEY");
  if(!key)return reply({error:"Sunucuda GEMINI_API_KEY bulunamadı."},503);
  const body=await req.json();
  const {imageBase64,mimeType,price,budget,note}=body;
  if(body.mode==="chat"){
    if(typeof body.message!=="string"||!body.message.trim()||body.message.length>600)return reply({error:"Mesaj 1-600 karakter olmalı."},400);
    const {data:items,error:dbError}=await sb.from("wardrobe_items").select("name,category,color,season").eq("user_id",user.id).limit(60);
    if(dbError)return reply({error:"Gardırop okunamadı."},500);
    const previous=body.previous&&typeof body.previous==="object"?body.previous:{};
    const history=Array.isArray(body.history)?body.history.slice(-8).filter((m:any)=>m&&(m.role==="user"||m.role==="assistant")&&typeof m.text==="string").map((m:any)=>({role:m.role,text:m.text.slice(0,600)})):[];
    const prompt="PRİZMA uygulamasının Türkçe stil danışmanısın. Samimi, somut, kısa cevap ver. Önceki alışveriş analizi: "+JSON.stringify({product:String(previous.product||"").slice(0,100),summary:String(previous.summary||"").slice(0,500),verdict:String(previous.verdict||"").slice(0,20)})+". Kullanıcının gerçek gardırop kayıtları: "+JSON.stringify(items||[])+". Önceki konuşma: "+JSON.stringify(history)+". Kullanıcının yeni sorusu: "+body.message+". Yalnızca kayıtlardaki ürünleri gardıropta var diye söyle. Bu sohbette fotoğrafı yeniden görmüyorsun; görünmeyen ayrıntıları uydurma. Yeni bilgiyle önceki karar değişebilir. En fazla 150 kelime.";
    const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.5,maxOutputTokens:600}})});
    if(!response.ok){console.error("Gemini chat error",response.status,(await response.text()).slice(0,400));return reply({error:response.status===429?"AI kullanım kotası doldu.":"Sohbet yanıtı alınamadı."},502);}
    const json=await response.json();
    const answer=json?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("").trim();
    return answer?reply({answer}):reply({error:"AI boş yanıt verdi."},502);
  }
  if(typeof imageBase64!=="string"||!imageBase64||imageBase64.length>8000000||!/^[A-Za-z0-9+/=]+$/.test(imageBase64))return reply({error:"Fotoğraf eksik veya çok büyük. Daha küçük JPEG yükle."},400);
  if(mimeType!=="image/jpeg"&&mimeType!=="image/png")return reply({error:"Desteklenmeyen fotoğraf biçimi."},400);
  if(typeof price!=="number"||typeof budget!=="number"||!Number.isFinite(price)||!Number.isFinite(budget)||price<=0||budget<=0||price>100000000||budget>100000000)return reply({error:"Fiyat veya bütçe geçersiz."},400);
  const {data:items,error:dbError}=await sb.from("wardrobe_items").select("name,category,color,season,notes").eq("user_id",user.id).limit(60);
  if(dbError)return reply({error:"Gardırop okunamadı."},500);
  const wardrobe=(items||[]).map(x=>({name:String(x.name||"").slice(0,90),category:String(x.category||"").slice(0,50),color:String(x.color||"").slice(0,40),season:String(x.season||"").slice(0,40)}));
  const instruction=`Sen PRİZMA uygulamasında Türkçe, gerçekçi bir alışveriş danışmanısın. Ürün fotoğrafını analiz et. Fiyat ${price} TL, kullanıcının bu alışveriş için bütçesi ${budget} TL. Kullanıcı notu: ${String(note||"").slice(0,400)}. Gardıroptaki ürünlerin yalnızca METİN bilgileri: ${JSON.stringify(wardrobe)}. Gardırop fotoğraflarını görmüyorsun; görmüş gibi davranma. Fotoğraftan anlaşılmayan marka, kumaş kalitesi, dayanıklılık veya gerçek fiyat/indirim bilgilerini uydurma. Bütçe aşılıyorsa bunu önemse. Kombin önerilerini mümkünse gardıropta gerçekten bulunan ürün adlarıyla oluştur, olmayanları varmış gibi söyleme. İhtiyaç ve kullanım sıklığını bilmiyorsun, kesin varsayma. AL/BEKLE/ALMA kararı ve 0-100 arası açıklanabilir tahmini uyum puanı üret. Puan objektif kalite ölçümü değil. Sadece belirtilen JSON şemasına uygun Türkçe cevap üret.`;
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents:[{role:"user",parts:[{text:instruction},{inline_data:{mime_type:mimeType,data:imageBase64}}]}],generationConfig:{temperature:0.35,responseMimeType:"application/json",responseSchema:{type:"OBJECT",properties:{verdict:{type:"STRING",enum:["AL","BEKLE","ALMA"]},score:{type:"INTEGER"},product:{type:"STRING"},summary:{type:"STRING"},reasons:{type:"ARRAY",items:{type:"STRING"}},outfits:{type:"ARRAY",items:{type:"STRING"}},warnings:{type:"ARRAY",items:{type:"STRING"}}},required:["verdict","score","product","summary","reasons","outfits","warnings"]}}})});
  if(!response.ok){const t=await response.text();console.error("Gemini error",response.status,t.slice(0,500));return reply({error:response.status===429?"AI kullanım kotası doldu. Daha sonra tekrar dene.":response.status===404?"Seçilen Gemini modeli bu anahtarla kullanılamıyor.":"AI sağlayıcısı isteği tamamlayamadı.",status:response.status},502);}
  const raw=await response.json();
  const content=raw?.candidates?.[0]?.content?.parts?.find((p:any)=>typeof p.text==="string")?.text;
  if(!content)return reply({error:"AI yanıt üretmedi."},502);
  const data=JSON.parse(content);
  if(!["AL","BEKLE","ALMA"].includes(data.verdict)||!Number.isInteger(data.score)||data.score<0||data.score>100||typeof data.summary!=="string"||!Array.isArray(data.reasons)||!Array.isArray(data.outfits))return reply({error:"AI yanıtı geçersiz."},502);
  return reply(data);
 }catch(e){console.error("analyze-shopping",String(e));return reply({error:"Analiz sırasında sunucu hatası oluştu."},500);}
});