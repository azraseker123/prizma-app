import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toBytes=(b64:string)=>{const raw=atob(b64);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;};
type ErrRecord={error?:string;message?:string};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Geçersiz istek."},405);
 const access=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!access)return json({error:"Giriş yapmalısın."},401);
 const url=Deno.env.get("SUPABASE_URL");
 const publicKey=Deno.env.get("SUPABASE_ANON_KEY");
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!publicKey||!serviceKey)return json({error:"Sanal deneme sunucusu hazırlanıyor."},503);
 const client=createClient(url,publicKey,{global:{headers:{Authorization:"Bearer "+access}},auth:{persistSession:false}});
 const {data:{user},error:authError}=await client.auth.getUser(access);
 if(authError||!user)return json({error:"Oturum doğrulanamadı."},401);
 const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
 let body:Record<string,unknown>;
 try{body=await req.json();if(!body||typeof body!=="object")throw Error("bad request");}
 catch{return json({error:"İstek okunamadı."},400);}
 const action=body.action==="start"?"start":body.action==="status"?"status":body.action==="eligibility"?"eligibility":null;
 if(!action)return json({error:"Geçersiz işlem."},400);
 if(action==="eligibility"){
  const {data,error}=await admin.from("tryon_entitlements").select("status,period_start,period_end,monthly_limit").eq("user_id",user.id).maybeSingle();
  if(error)return json({error:"Premium bilgisi alınamadı."},503);
  const active=data?.status==="active"&&Date.now()>=Date.parse(data.period_start)&&Date.now()<Date.parse(data.period_end);
  if(!active)return json({active:false,remaining:0,monthlyLimit:15});
  const {count,error:countError}=await admin.from("tryon_jobs").select("id",{head:true,count:"exact"}).eq("user_id",user.id).gte("created_at",data.period_start).lt("created_at",data.period_end).neq("status","failed");
  if(countError)return json({error:"Kullanım hakkı alınamadı."},503);
  return json({active:true,remaining:Math.max(0,data.monthly_limit-(count??0)),monthlyLimit:data.monthly_limit});
 }
 if(action==="start"){
  if(body.consent!==true)return json({error:"Fotoğrafların sanal deneme için harici AI servisine gönderilmesine onay vermelisin."},400);
  if(body.ownsPersonPhoto!==true)return json({error:"Kullanmak istediğin kişinin fotoğrafına ilişkin iznin olmalı."},400);
  const fashnKey=Deno.env.get("FASHN_API_KEY");
  if(!fashnKey)return json({error:"Sanal deneme hizmeti henüz etkinleştirilmedi."},503);
  const {data:profile,error:profileErr}=await admin.from("tryon_profiles").select("photo_path").eq("user_id",user.id).maybeSingle();
  if(profileErr||!profile?.photo_path||!profile.photo_path.startsWith(user.id+"/"))return json({error:"Önce deneme fotoğrafını kaydet."},400);
  const {data:personSigned,error:personErr}=await admin.storage.from("tryon-avatars").createSignedUrl(profile.photo_path,300);
  if(personErr||!personSigned?.signedUrl)return json({error:"Deneme fotoğrafı açılamadı."},503);
  let garmentImage:string|undefined;
  let category:"auto"|"tops"|"bottoms"|"one-pieces"="auto";
  if(typeof body.wardrobeItemId==="string"&&uuid.test(body.wardrobeItemId)){
    const {data:item,error}=await admin.from("wardrobe_items").select("image_path,category").eq("user_id",user.id).eq("id",body.wardrobeItemId).maybeSingle();
    if(error||!item?.image_path)return json({error:"Gardırop kıyafeti bulunamadı."},400);
    const signed=await admin.storage.from("wardrobe").createSignedUrl(item.image_path,300);
    if(signed.error||!signed.data?.signedUrl)return json({error:"Kıyafet fotoğrafı açılamadı."},503);
    garmentImage=signed.data.signedUrl;
    if(item.category==="Üst Giyim"||item.category==="Dış Giyim")category="tops";
    else if(item.category==="Alt Giyim")category="bottoms";
    else if(item.category==="Elbise")category="one-pieces";
  }else if(typeof body.garmentBase64==="string"&&body.garmentBase64.length>100&&body.garmentBase64.length<=2800000&&/^[A-Za-z0-9+/]+={0,2}$/.test(body.garmentBase64)){
    garmentImage="data:image/jpeg;base64,"+body.garmentBase64;
  }else return json({error:"Denemek istediğin kıyafeti seç."},400);
  const {data:jobId,error:reserveErr}=await admin.rpc("reserve_tryon_job",{p_user_id:user.id});
  if(reserveErr)return json({error:reserveErr.message.includes("TRYON_LIMIT_REACHED")?"Aylık sanal deneme hakkın doldu.":reserveErr.message.includes("PREMIUM_REQUIRED")?"Sanal deneme yalnızca aktif Premium üyelerde kullanılabilir.":"Sanal deneme başlatılamadı."},reserveErr.message.includes("PREMIUM_REQUIRED")?403:429);
  const fail=async(reason:string)=>{await admin.from("tryon_jobs").update({status:"failed",error_message:reason.slice(0,400),updated_at:new Date().toISOString()}).eq("id",jobId).eq("user_id",user.id);};
  try{
    const response=await fetch("https://api.fashn.ai/v1/run",{
      method:"POST",
      headers:{"Authorization":"Bearer "+fashnKey,"Content-Type":"application/json"},
      body:JSON.stringify({model_name:"tryon-v1.6",inputs:{model_image:personSigned.signedUrl,garment_image:garmentImage,category,mode:"balanced",moderation_level:"conservative",num_samples:1,output_format:"jpeg",return_base64:true}}),
      signal:AbortSignal.timeout(20000),
    });
    if(!response.ok){console.error("FASHN start",response.status);await fail("FASHN submission "+response.status);return json({error:"Sanal deneme şu anda başlatılamadı. Hakkın kullanılmadı."},502);}
    const submitted=await response.json();
    if(typeof submitted?.id!=="string"||!submitted.id){await fail("FASHN response missing id");return json({error:"Sanal deneme başlatılamadı."},502);}
    const {error:updateErr}=await admin.from("tryon_jobs").update({prediction_id:submitted.id,status:"submitted",updated_at:new Date().toISOString()}).eq("id",jobId).eq("user_id",user.id);
    if(updateErr){console.error("Tryon job persist failed",updateErr.message);return json({error:"Sanal deneme durumu kaydedilemedi. Destekle iletişime geç."},503);}
    return json({jobId,status:"processing"});
  }catch(error){console.error("FASHN start error",String(error));await fail("Submit failed");return json({error:"Sanal deneme başlatılamadı. Hakkın kullanılmadı."},503);}
 }
 const jobId=body.jobId;
 if(typeof jobId!=="string"||!uuid.test(jobId))return json({error:"Geçersiz işlem numarası."},400);
 const {data:job,error:jobErr}=await admin.from("tryon_jobs").select("id,prediction_id,status,result_path,created_at").eq("id",jobId).eq("user_id",user.id).maybeSingle();
 if(jobErr||!job)return json({error:"Sanal deneme bulunamadı."},404);
 if(job.status==="completed"&&job.result_path){
  const image=await admin.storage.from("tryon-results").createSignedUrl(job.result_path,3600);
  if(image.error)return json({error:"Sonuç yüklenemedi."},503);
  return json({status:"completed",url:image.data.signedUrl});
 }
 if(job.status==="failed")return json({status:"failed",error:"Sanal deneme oluşturulamadı. Başarısız işlem hakkından düşmedi."});
 if(!job.prediction_id)return json({status:"processing"});
 const fashnKey=Deno.env.get("FASHN_API_KEY");
 if(!fashnKey)return json({error:"Sanal deneme hizmeti etkin değil."},503);
 try{
  const response=await fetch("https://api.fashn.ai/v1/status/"+encodeURIComponent(job.prediction_id),{headers:{"Authorization":"Bearer "+fashnKey},signal:AbortSignal.timeout(12000)});
  if(!response.ok)return json({error:"Sonuç henüz kontrol edilemiyor."},503);
  const prediction=await response.json();
  if(prediction?.status==="failed"){
    await admin.from("tryon_jobs").update({status:"failed",error_message:JSON.stringify(prediction.error??{}).slice(0,380),updated_at:new Date().toISOString()}).eq("id",jobId).eq("user_id",user.id);
    return json({status:"failed",error:"Sanal deneme tamamlanamadı. Hakkın kullanılmadı."});
  }
  if(prediction?.status!=="completed")return json({status:"processing"});
  const output=Array.isArray(prediction.output)?prediction.output[0]:null;
  if(typeof output!=="string"||!output.startsWith("data:image/jpeg;base64,"))return json({error:"Sonuç formatı işlenemedi."},503);
  const b64=output.slice("data:image/jpeg;base64,".length);
  if(b64.length>15_000_000)return json({error:"Sonuç çok büyük."},503);
  const resultPath=user.id+"/"+jobId+".jpg";
  const {error:uploadError}=await admin.storage.from("tryon-results").upload(resultPath,toBytes(b64),{contentType:"image/jpeg",upsert:true});
  if(uploadError){console.error("Tryon upload",uploadError.message);return json({error:"Sonuç saklanamadı. Tekrar sonuç kontrolü yap."},503);}
  await admin.from("tryon_jobs").update({status:"completed",result_path:resultPath,updated_at:new Date().toISOString()}).eq("id",jobId).eq("user_id",user.id);
  const signed=await admin.storage.from("tryon-results").createSignedUrl(resultPath,3600);
  return json({status:"completed",url:signed.data?.signedUrl??null});
 }catch(error){console.error("Tryon status error",String(error));return json({error:"Sonuç kontrolü gerçekleştirilemedi."},503);}
});
