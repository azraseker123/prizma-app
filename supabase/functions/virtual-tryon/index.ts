import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 const action=body.action==="start"?"start":body.action==="status"?"status":body.action==="eligibility"?"eligibility":body.action==="gallery"?"gallery":body.action==="delete"?"delete":null;
 if(!action)return json({error:"Geçersiz işlem."},400);
 if(action==="eligibility"){
  const {data,error}=await admin.from("tryon_entitlements").select("status,period_start,period_end,monthly_limit,grant_source").eq("user_id",user.id).maybeSingle();
  if(error)return json({error:"Premium bilgisi alınamadı."},503);
  const active=(data?.status==="active"||data?.status==="test")&&Date.now()>=Date.parse(data.period_start)&&Date.now()<Date.parse(data.period_end);
  if(!active)return json({active:false,remaining:0,monthlyLimit:15,testAccess:false,providerReady:Boolean(Deno.env.get("BRIA_API_TOKEN"))});
  const {count,error:countError}=await admin.from("tryon_jobs").select("id",{head:true,count:"exact"}).eq("user_id",user.id).gte("created_at",data.period_start).lt("created_at",data.period_end).neq("status","failed");
  if(countError)return json({error:"Kullanım hakkı alınamadı."},503);
  return json({active:true,remaining:Math.max(0,data.monthly_limit-(count??0)),monthlyLimit:data.monthly_limit,testAccess:data?.grant_source==="development"||data?.status==="test",providerReady:Boolean(Deno.env.get("BRIA_API_TOKEN"))});
 }
 if(action==="gallery"){
  const {data:jobs,error}=await admin.from("tryon_jobs").select("id,created_at,result_path").eq("user_id",user.id).eq("status","completed").not("result_path","is",null).order("created_at",{ascending:false}).limit(60);
  if(error)return json({error:"Denemelerin yüklenemedi."},503);
  const items: Array<{id:string;createdAt:string;url:string}> = [];
  for(const job of jobs??[]){
    if(!job.result_path?.startsWith(user.id+"/"))continue;
    const signed=await admin.storage.from("tryon-results").createSignedUrl(job.result_path,3600);
    if(!signed.error&&signed.data?.signedUrl)items.push({id:job.id,createdAt:job.created_at,url:signed.data.signedUrl});
  }
  return json({items});
 }
 if(action==="delete"){
  if(typeof body.jobId!=="string"||!uuid.test(body.jobId))return json({error:"Geçersiz deneme."},400);
  const {data:job,error:jobError}=await admin.from("tryon_jobs").select("id,status,result_path").eq("id",body.jobId).eq("user_id",user.id).maybeSingle();
  if(jobError||!job)return json({error:"Deneme bulunamadı."},404);
  if(job.status==="deleted")return json({deleted:true});
  if(job.status!=="completed"||!job.result_path?.startsWith(user.id+"/"))return json({error:"Bu görsel silinemiyor."},400);
  const removed=await admin.storage.from("tryon-results").remove([job.result_path]);
  if(removed.error){console.error("Tryon delete storage",removed.error.message);return json({error:"Görsel silinemedi. Yeniden dene."},503);}
  const {error:dbError}=await admin.from("tryon_jobs").update({status:"deleted",result_path:null,updated_at:new Date().toISOString()}).eq("id",job.id).eq("user_id",user.id).eq("status","completed");
  if(dbError){console.error("Tryon delete record",dbError.message);return json({error:"Görsel silindi fakat kayıt güncellenemedi."},503);}
  return json({deleted:true});
 }
 if(action==="start"){
  if(body.consent!==true)return json({error:"Fotoğrafların sanal deneme için harici AI servisine gönderilmesine onay vermelisin."},400);
  if(body.ownsPersonPhoto!==true)return json({error:"Kullanmak istediğin kişinin fotoğrafına ilişkin iznin olmalı."},400);
  const briaToken=Deno.env.get("BRIA_API_TOKEN");
  if(!briaToken)return json({error:"Bria sanal deneme erişimi yapılandırılmadı."},503);
  const {data:profile,error:profileErr}=await admin.from("tryon_profiles").select("photo_path").eq("user_id",user.id).maybeSingle();
  if(profileErr||!profile?.photo_path||!profile.photo_path.startsWith(user.id+"/"))return json({error:"Önce deneme fotoğrafını kaydet."},400);
  const {data:personSigned,error:personErr}=await admin.storage.from("tryon-avatars").createSignedUrl(profile.photo_path,300);
  if(personErr||!personSigned?.signedUrl)return json({error:"Deneme fotoğrafı açılamadı."},503);
  let garmentImage:string|undefined;
  if(typeof body.wardrobeItemId==="string"&&uuid.test(body.wardrobeItemId)){
    const {data:item,error}=await admin.from("wardrobe_items").select("image_path,category").eq("user_id",user.id).eq("id",body.wardrobeItemId).maybeSingle();
    if(error||!item?.image_path)return json({error:"Gardırop kıyafeti bulunamadı."},400);
    const signed=await admin.storage.from("wardrobe").createSignedUrl(item.image_path,300);
    if(signed.error||!signed.data?.signedUrl)return json({error:"Kıyafet fotoğrafı açılamadı."},503);
    garmentImage=signed.data.signedUrl;
  }else if(typeof body.garmentBase64==="string"&&body.garmentBase64.length>100&&body.garmentBase64.length<=2800000&&/^[A-Za-z0-9+/]+={0,2}$/.test(body.garmentBase64)){
    garmentImage=body.garmentBase64;
  }else return json({error:"Denemek istediğin kıyafeti seç."},400);
  const {data:jobId,error:reserveErr}=await admin.rpc("reserve_tryon_job",{p_user_id:user.id});
  if(reserveErr)return json({error:reserveErr.message.includes("TRYON_LIMIT_REACHED")?"Aylık sanal deneme hakkın doldu.":reserveErr.message.includes("PREMIUM_REQUIRED")?"Sanal deneme yalnızca aktif Premium üyelerde kullanılabilir.":"Sanal deneme başlatılamadı."},reserveErr.message.includes("PREMIUM_REQUIRED")?403:429);
  const fail=async(reason:string)=>{await admin.from("tryon_jobs").update({status:"failed",error_message:reason.slice(0,400),updated_at:new Date().toISOString()}).eq("id",jobId).eq("user_id",user.id);};
  try{
    const response=await fetch("https://engine.prod.bria-api.com/v2/image/edit/product/virtual-tryon",{
      method:"POST",
      headers:{"api_token":briaToken,"Content-Type":"application/json"},
      body:JSON.stringify({
        person_image:personSigned.signedUrl,garment_images:[garmentImage],
        sync:false,output_type:"jpeg",visual_output_content_moderation:true
      }),
      signal:AbortSignal.timeout(20000)
    });
    if(!response.ok){
      console.error("Bria try-on submission",response.status,(await response.text()).slice(0,300));
      await fail("Bria rejected "+response.status);
      return json({error:[402,403].includes(response.status)?"Bria hesabında sanal deneme erişimi veya kredisi yetersiz.":"Sanal deneme başlatılamadı. Hakkın korunuyor."},502);
    }
    const submitted=await response.json();
    const requestId=typeof submitted?.request_id==="string"?submitted.request_id:null;
    if(!requestId){
      console.error("Bria missing request_id");
      return json({error:"İşlem kabul edilmiş olabilir ancak işlem numarası alınamadı. Yeni deneme başlatmadan destekle görüş."},503);
    }
    const {error:updateErr}=await admin.from("tryon_jobs").update({prediction_id:requestId,status:"submitted",updated_at:new Date().toISOString()}).eq("id",jobId).eq("user_id",user.id);
    if(updateErr){console.error("Tryon persist failed",updateErr.message);return json({error:"İşlem durumu kaydedilemedi. Yeni deneme başlatmadan destekle görüş."},503);}
    return json({jobId,status:"processing"});
  }catch(error){
    console.error("Bria try-on submission uncertain",String(error));
    return json({error:"Bria yanıtı alınamadı. İşlem başlamış olabilir, yeni deneme başlatmadan destekle görüş."},503);
  }
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
 const briaToken=Deno.env.get("BRIA_API_TOKEN");
 if(!briaToken)return json({error:"Bria hizmeti etkin değil."},503);
 try{
  const response=await fetch("https://engine.prod.bria-api.com/v2/status/"+encodeURIComponent(job.prediction_id),{headers:{"api_token":briaToken},signal:AbortSignal.timeout(12000)});
  if(!response.ok)return json({error:"Sonuç henüz kontrol edilemiyor."},503);
  const prediction=await response.json();
  if(prediction?.status==="ERROR"||prediction?.status==="UNKNOWN"){
    await admin.from("tryon_jobs").update({status:"failed",error_message:JSON.stringify(prediction.error??{}).slice(0,380),updated_at:new Date().toISOString()}).eq("id",jobId).eq("user_id",user.id);
    return json({status:"failed",error:"Sanal deneme tamamlanamadı. Başarısız işlem hakkından düşmedi."});
  }
  if(prediction?.status!=="COMPLETED")return json({status:"processing"});
  const imageUrl=prediction?.result?.image_url;
  if(typeof imageUrl!=="string"||!imageUrl.startsWith("https://"))return json({error:"Bria sonuç görseli alınamadı."},503);
  const imageSource=new URL(imageUrl);
  if(imageSource.username||imageSource.password||imageSource.port||!imageSource.hostname.includes(".")||imageSource.hostname==="localhost"||imageSource.hostname.endsWith(".localhost"))return json({error:"Güvenli sonuç adresi alınamadı."},503);
  const downloaded=await fetch(imageUrl,{signal:AbortSignal.timeout(20000),redirect:"error"});
  if(!downloaded.ok)return json({error:"Sonuç indirilemedi. Tekrar kontrol et."},503);
  const contentType=(downloaded.headers.get("content-type")??"").split(";")[0].trim().toLowerCase();
  if(!["image/jpeg","image/png"].includes(contentType))return json({error:"Sonuç görselinin biçimi desteklenmiyor."},503);
  const bytes=new Uint8Array(await downloaded.arrayBuffer());
  if(!bytes.byteLength||bytes.byteLength>10*1024*1024)return json({error:"Sonuç fotoğrafı çok büyük."},503);
  const resultPath=user.id+"/"+jobId+(contentType==="image/png"?".png":".jpg");
  const {error:uploadError}=await admin.storage.from("tryon-results").upload(resultPath,bytes,{contentType,upsert:true});
  if(uploadError){console.error("Tryon upload",uploadError.message);return json({error:"Sonuç kaydedilemedi. Yeniden kontrol et."},503);}
  const {error:completeErr}=await admin.from("tryon_jobs").update({status:"completed",result_path:resultPath,updated_at:new Date().toISOString()}).eq("id",jobId).eq("user_id",user.id);
  if(completeErr)return json({error:"Sonuç kaydı tamamlanamadı. Yeniden kontrol et."},503);
  const signed=await admin.storage.from("tryon-results").createSignedUrl(resultPath,3600);
  if(signed.error||!signed.data?.signedUrl)return json({error:"Sonuç açılamadı."},503);
  return json({status:"completed",url:signed.data.signedUrl});
 }catch(error){console.error("Bria status error",String(error));return json({error:"Sonuç kontrolü gerçekleştirilemedi."},503);}
});
