import {createClient} from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
type Candidate={name:string;brand:string;image:string;source_page:string;license_name:string;license_url:string;inci:string};
const normalize=(value:string)=>value.toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9ıüöşğç]+/g," ").trim();
Deno.serve(async(request)=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(request.method!=="POST")return reply({error:"POST gerekli."},405);
 try{
  const token=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!token||!url||!anon||!secret)return reply({error:"Oturum veya servis yapılandırması eksik."},401);
  const client=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
  const {data,error}=await client.auth.getUser(token);
  if(error||!data.user)return reply({error:"Oturum doğrulanamadı."},401);
  const body=await request.json().catch(()=>null);
  const name=typeof body?.name==="string"?body.name.trim().slice(0,110):"";
  const brand=typeof body?.brand==="string"?body.brand.trim().slice(0,70):"";
  if(name.length<3||!brand)return reply({error:"Ürün adı ve marka gerekli."},400);
  const admin=createClient(url,secret,{auth:{persistSession:false}});
  const from=new Date();from.setUTCHours(0,0,0,0);
  const {count,error:countError}=await admin.from("beauty_photo_lookup_usage")
    .select("id",{count:"exact",head:true}).eq("user_id",data.user.id).gte("created_at",from.toISOString());
  if(countError)return reply({error:"Arama kotası doğrulanamadı."},503);
  if((count||0)>=12)return reply({error:"Bugün için görsel arama sınırı doldu."},429);
  const {error:usageError}=await admin.from("beauty_photo_lookup_usage").insert({user_id:data.user.id});
  if(usageError)return reply({error:"Arama başlatılamadı."},503);
  const query=new URL("https://world.openbeautyfacts.org/cgi/search.pl");
  query.searchParams.set("search_simple","1");
  query.searchParams.set("action","process");
  query.searchParams.set("json","1");
  query.searchParams.set("search_terms",brand+" "+name);
  query.searchParams.set("page_size","10");
  query.searchParams.set("fields","code,product_name,brands,image_front_url,image_url,ingredients_text");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),7500);
  let response:Response;
  try{
   response=await fetch(query,{signal:controller.signal,headers:{
    "User-Agent":"PrizmaApp/0.1 (https://github.com/azraseker123/prizma-app)",
    "Accept":"application/json",
   }});
  }finally{clearTimeout(timeout);}
  if(!response.ok)return reply({error:"Ürün kataloğuna erişilemiyor."},502);
  const raw=await response.json();
  const incoming=Array.isArray(raw.products)?raw.products:[];
  const nBrand=normalize(brand);
  const nName=normalize(name);
  const candidates:Candidate[]=incoming.filter((item:any)=>{
    const itemBrands=normalize(String(item?.brands||""));
    const itemName=normalize(String(item?.product_name||""));
    const terms=nName.split(" ").filter(x=>x.length>2);
    const matchBrand=itemBrands.includes(nBrand)||nBrand.includes(itemBrands)&&itemBrands.length>=3;
    const overlap=terms.length?terms.filter(x=>itemName.includes(x)).length/terms.length:0;
    return matchBrand&&overlap>=.75&&/^\d{8,14}$/.test(String(item.code||""))&&
      /^https:\/\/(?:images\.)?openbeautyfacts\.org\//i.test(String(item.image_front_url||item.image_url||""));
  }).slice(0,4).map((item:any)=>({
    name:String(item.product_name).slice(0,110),
    brand:String(item.brands).slice(0,70),
    image:String(item.image_front_url||item.image_url),
    source_page:"https://world.openbeautyfacts.org/product/"+String(item.code),
    license_name:"Open Beauty Facts contributors — CC BY-SA 3.0",
    license_url:"https://creativecommons.org/licenses/by-sa/3.0/",
    inci:typeof item.ingredients_text==="string"?item.ingredients_text.slice(0,2000):"",
  }));
  return reply({candidates,notice:"Ürün fotoğrafları CC BY-SA koşullarına tabi olabilir. Ambalaj hakları ve doğruluğunu kontrol et."});
 }catch(error){
  console.error("beauty lookup",error instanceof Error?error.message:"unknown");
  return reply({error:"Ürün görseli aranamadı."},500);
 }
});
