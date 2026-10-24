const BASE = 'http://127.0.0.1:3000'
const STAMP = Date.now()
const PW = 'T177b-Qa-Str0ng1!'
function makeSession(){let cookie='';const ip=`10.177.${Math.floor(Math.random()*250)+1}.${Math.floor(Math.random()*250)+1}`;return async function call(method,path,body){const res=await fetch(`${BASE}${path}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),'X-Forwarded-For':ip},body:body?JSON.stringify(body):undefined});for(const c of res.headers.getSetCookie?.()??[]){const p=c.split(';')[0];if(p)cookie=cookie?`${cookie}; ${p}`:p}return{status:res.status,json:await res.json().catch(()=>null)}}}
const admin=makeSession(),supplier=makeSession()
await admin('POST','/api/auth/register',{userType:'admin',authProvider:'email',email:`t177b-admin-${STAMP}@t.test`,password:PW,fullName:'T177b Admin'})
await supplier('POST','/api/auth/register',{userType:'supplier',authProvider:'email',email:`t177b-supp-${STAMP}@t.test`,password:PW,fullName:'T177b Supp',businessName:'T177b Mill'})
const {PrismaClient}=await import('@prisma/client');const db=new PrismaClient()
let categoryId=(await db.categories.findFirst({where:{slug:'garments'}}))?.id
if(!categoryId){await admin('POST','/api/admin/categories',{name:'Garments',isActive:true});categoryId=(await db.categories.findFirst({where:{slug:'garments'}}))?.id}
const p=await supplier('POST','/api/supplier/products',{name:'T177b Demo Fabric',description:'flow test',categoryId,unit:'pcs',moq:10,basePrice:500,currency:'BDT',stockQuantity:100,priceTiers:[{minQty:10,pricePerUnit:500}],images:[{imageUrl:'/placeholder.svg',sortOrder:0}],videos:[]})
const pid=p.json?.data?.id??p.json?.id
await admin('PATCH','/api/admin/products',{productId:pid,action:'approve',reason:'T177b'})
const sp=await db.supplierProfiles.findFirst({where:{companyName:'T177b Mill'}})
if(sp)await db.supplierProfiles.update({where:{id:sp.id},data:{verificationStatus:'approved'}})
console.log('SEEDED pid='+pid)
await db.$disconnect()
