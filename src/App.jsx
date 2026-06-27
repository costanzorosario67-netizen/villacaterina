import { useState, useMemo, useEffect, useRef } from "react";
import { db, ref, set, get, onValue } from "./firebase";

const DEFAULT_APARTMENTS = [
  { id: "zaffiro",      name: "Zaffiro",        color: "#4A9FD4", emoji: "💙" },
  { id: "diamante",     name: "Diamante",       color: "#A0A8B0", emoji: "🩶" },
  { id: "rubino",       name: "Rubino",         color: "#D94F5C", emoji: "❤️" },
  { id: "smeraldo",     name: "Smeraldo",       color: "#4CAF8A", emoji: "💚" },
  { id: "villacaterina",name: "Villa Caterina", color: "#9B72CF", emoji: "🏰" },
];
const PLATFORMS = [
  { id:"airbnb",   label:"Airbnb",      emoji:"🏠", color:"#FF5A5F" },
  { id:"booking",  label:"Booking.com", emoji:"🔵", color:"#0066CC" },
  { id:"expedia",  label:"Expedia",     emoji:"✈️", color:"#FFC72C" },
  { id:"holidu",   label:"Holidu",      emoji:"🏡", color:"#00B4B4" },
  { id:"hometogo", label:"HomeToGo",    emoji:"🟣", color:"#7B2FBE" },
  { id:"hopper",   label:"Hopper",      emoji:"🐰", color:"#FF6B8A" },
  { id:"vrbo",     label:"Vrbo",        emoji:"🏘️", color:"#1A6BB5" },
  { id:"diretto",  label:"Diretto",     emoji:"🤝", color:"#C8A96E" },
  { id:"altro",    label:"Altro",       emoji:"📋", color:"#888888" },
];
const MAINT_TYPES = [
  { id:"garden",   label:"Giardiniere",    emoji:"🌿" },
  { id:"cleaning", label:"Pulizie",        emoji:"🧹" },
  { id:"plumber",  label:"Idraulico",      emoji:"🔧" },
  { id:"electric", label:"Elettricista",   emoji:"⚡" },
  { id:"ac",       label:"Climatizzatore", emoji:"❄️" },
  { id:"other",    label:"Altro",          emoji:"🛠️" },
];
const MONTHS       = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MONTHS_SHORT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const DAYS_SHORT   = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];
const SK_BOOKINGS="vcaterina-bookings", SK_MAINTS="vcaterina-maints", SK_NAMES="vcaterina-aptnames", SK_TAX="vcaterina-taxrate", SK_APIKEY="vcaterina-apikey", SK_PIN="vcaterina-pin";

/* ── localStorage shim (sostituisce window.storage) ── */
const ls = {
  get: (key) => { try { const v=localStorage.getItem(key); return v!=null?{value:v}:null; } catch{ return null; } },
  set: (key, value) => { try { localStorage.setItem(key,value); return true; } catch{ return null; } },
};

const p2 = n => String(n).padStart(2,"0");
const toISO = d => `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
const parseDate = s => { if(!s) return null; const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const fmtDate = d => { if(!d) return ""; return `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()}`; };
const nights  = (a,b) => (!a||!b)?0:Math.round((b-a)/86400000);
const addDays = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const todayISO = () => toISO(new Date());
const daysInMonth = (y,m) => new Date(y,m+1,0).getDate();
const bkYear  = b => { const c=parseDate(b.checkin); return c?c.getFullYear():null; };
const bkMonth = b => { const c=parseDate(b.checkin); return c?c.getMonth():null; };
const emptyForm  = () => ({ apt:DEFAULT_APARTMENTS[0].id, guest:"", checkin:"", checkout:"", price:"", guests:"", notes:"", platform:"diretto", status:"confirmed" });
const emptyMForm = () => ({ apt:"all", type:"garden", date:"", notes:"", cost:"" });

const S = {
  input:  { width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(200,169,110,0.3)", borderRadius:8, padding:"10px 12px", color:"#f0e6d3", fontSize:14, fontFamily:"Georgia,serif", outline:"none", boxSizing:"border-box", marginBottom:4 },
  card:   { flex:1, background:"rgba(255,255,255,0.05)", borderRadius:9, padding:"10px 6px", textAlign:"center", border:"1px solid rgba(255,255,255,0.07)" },
  navBtn: { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(200,169,110,0.3)", color:"#C8A96E", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:18 },
  btn:    (bg,bc) => ({ background:bg, border:`1px solid ${bc}`, color:bc, borderRadius:8, padding:"8px 12px", cursor:"pointer", fontFamily:"Georgia,serif", fontSize:13 }),
};

function Pill({ active, color, onClick, children }) {
  return <button onClick={onClick} style={{ padding:"5px 11px", borderRadius:20, border:active?"none":`1px solid ${color}44`, background:active?color:"rgba(255,255,255,0.06)", color:active?"#1a0533":"#f0e6d3", cursor:"pointer", fontSize:12, fontFamily:"Georgia,serif", whiteSpace:"nowrap" }}>{children}</button>;
}
function TabBtn({ active, onClick, label, children }) {
  return <button onClick={onClick} style={{ display:"flex", flexDirection:"column", alignItems:"center", background:"none", border:"none", color:active?"#C8A96E":"#555", cursor:"pointer", minWidth:48, fontFamily:"Georgia,serif", gap:2 }}><span style={{fontSize:18}}>{children}</span><span style={{fontSize:9}}>{label}</span></button>;
}
function openGCal(b, name) {
  const ci=parseDate(b.checkin), co=parseDate(b.checkout); if(!ci||!co) return;
  const fmt = d => toISO(d).replace(/-/g,"");
  window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Check-out: ${b.guest} — ${name}`)}&dates=${fmt(co)}/${fmt(co)}&details=${encodeURIComponent(`Appartamento: ${name}`)}`, "_blank");
}
function downloadICS(b, name) {
  const ci=parseDate(b.checkin), co=parseDate(b.checkout); if(!ci||!co) return;
  const fmt = d => toISO(d).replace(/-/g,"");
  const now = new Date().toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${b.id}@villacaterina\r\nDTSTAMP:${now}\r\nDTSTART;VALUE=DATE:${fmt(co)}\r\nDTEND;VALUE=DATE:${fmt(addDays(co,1))}\r\nSUMMARY:Check-out: ${b.guest} — ${name}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics],{type:"text/calendar"})); a.download = `checkout-${b.id}.ics`; a.click();
}

export default function App() {
  const [apts, setApts]         = useState(DEFAULT_APARTMENTS);
  const [aptNames, setAptNames] = useState(() => Object.fromEntries(DEFAULT_APARTMENTS.map(a=>[a.id,a.name])));
  const [bookings, setBookings] = useState([]);
  const [maints, setMaints]     = useState([]);
  const [taxRate, setTaxRate]   = useState(0);
  const [costRate, setCostRate] = useState(0);
  const [view, setView]         = useState("calendar");
  const [calView, setCalView]   = useState("month");
  const [calDate, setCalDate]   = useState(new Date());
  const [selApt, setSelApt]     = useState("all");
  const [form, setForm]         = useState(emptyForm());
  const [mForm, setMForm]       = useState(emptyMForm());
  const [editId, setEditId]     = useState(null);
  const [editMId, setEditMId]   = useState(null);
  const [delId, setDelId]       = useState(null);
  const [delMId, setDelMId]     = useState(null);
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [statsYear, setStatsYear]   = useState(new Date().getFullYear());
  const [statsMonth, setStatsMonth] = useState(null);
  const [statsApts, setStatsApts]   = useState(["all"]);
  const [calExportOpen, setCalExportOpen] = useState(null);
  const [diagInfo, setDiagInfo] = useState(null);
  const [importError, setImportError] = useState(null);
  const [showExport, setShowExport]   = useState(false);
  const [importText, setImportText]   = useState("");
  const [hideAmounts, setHideAmounts] = useState(false);
  const [listFilter, setListFilter]   = useState("all");
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiError, setAiError]         = useState(null);
  const [apiKey, setApiKey]           = useState("");
  const [pinInput, setPinInput]       = useState("");
  const [pinError, setPinError]       = useState(false);
  const [canEdit, setCanEdit]         = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [savedPin, setSavedPin]       = useState("");
  const [newPin, setNewPin]           = useState("");
  const fileInputRef = useRef(null);

  function toggleSelApt(id) {
    if (id==="all") { setSelApt("all"); return; }
    setSelApt(prev => { const arr=prev==="all"?[]:[...prev]; if(arr.includes(id)){ const n=arr.filter(x=>x!==id); return n.length===0?"all":n; } return [...arr,id]; });
  }
  const isAptSel = id => selApt==="all"||selApt.includes(id);
  const isAllSel = ()  => selApt==="all";
  function toggleStatsApt(id) {
    if(id==="all"){ setStatsApts(["all"]); return; }
    setStatsApts(prev => { const wo=prev.filter(x=>x!=="all"); if(wo.includes(id)){ const n=wo.filter(x=>x!==id); return n.length===0?["all"]:n; } return [...wo,id]; });
  }

  useEffect(() => {
    // Carica API key e PIN da localStorage (locale, non condivisi)
    const kR = ls.get(SK_APIKEY);
    if(kR?.value) setApiKey(kR.value);
    const pR = ls.get(SK_PIN);
    if(pR?.value) setSavedPin(pR.value);
    // Se non c'è PIN impostato, si può modificare liberamente
    if(!pR?.value) setCanEdit(true);
    // Ascolta Firebase in tempo reale
    const unsubB = onValue(ref(db,"bookings"), snap => { if(snap.exists()) setBookings(Object.values(snap.val())); else setBookings([]); });
    const unsubM = onValue(ref(db,"maints"),   snap => { if(snap.exists()) setMaints(Object.values(snap.val()));   else setMaints([]); });
    const unsubN = onValue(ref(db,"aptNames"), snap => { if(snap.exists()){ const nm=snap.val(); setAptNames(nm); setApts(DEFAULT_APARTMENTS.map(a=>({...a,name:nm[a.id]||a.name}))); }});
    const unsubT = onValue(ref(db,"taxRate"),  snap => { if(snap.exists()){ const p=snap.val(); setTaxRate(p.tax||0); setCostRate(p.cost||0); }});
    setLoading(false);
    return () => { unsubB(); unsubM(); unsubN(); unsubT(); };
  }, []);

  async function saveBookings(nb){
    setSyncing(true);
    try{
      const obj = Object.fromEntries(nb.map(b=>[b.id, b]));
      await set(ref(db,"bookings"), nb.length>0?obj:null);
    }catch(e){ showToast("Errore sync","error"); }
    finally{ setSyncing(false); }
  }
  async function saveMaints(nm){
    try{
      const obj = Object.fromEntries(nm.map(m=>[m.id, m]));
      await set(ref(db,"maints"), nm.length>0?obj:null);
    }catch(e){}
  }
  async function saveTax(t,c){ try{ await set(ref(db,"taxRate"),{tax:t,cost:c}); }catch(e){} }

  function showToast(msg, type="success"){ setToast({msg,type}); setTimeout(()=>setToast(null),2800); }

  const aptColor = id => apts.find(a=>a.id===id)?.color||"#888";
  const aptEmoji = id => apts.find(a=>a.id===id)?.emoji||"🏠";
  const aptLabel = id => apts.find(a=>a.id===id)?.name||id;
  const platColor = id => PLATFORMS.find(p=>p.id===id)?.color||"#888";
  const platEmoji = id => PLATFORMS.find(p=>p.id===id)?.emoji||"📋";
  const platLabel = id => PLATFORMS.find(p=>p.id===id)?.label||id;
  const mtEmoji  = t => MAINT_TYPES.find(m=>m.id===t)?.emoji||"🛠️";
  const mtLabel  = t => MAINT_TYPES.find(m=>m.id===t)?.label||t;
  const taxMult  = (100-(parseFloat(taxRate)||0)-(parseFloat(costRate)||0))/100;
  const fmtEur   = v => hideAmounts?"••••":(Math.round(v*100)/100).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2});

  function handleSave(){
    if(!canEdit){ setShowPinModal(true); return; }
    if(!form.guest.trim()||!form.checkin||!form.checkout){ showToast("Compila ospite, check-in e check-out","error"); return; }
    if(parseDate(form.checkout)<=parseDate(form.checkin)){ showToast("Checkout deve essere dopo check-in","error"); return; }
    const nb = editId!==null ? bookings.map(b=>b.id===editId?{...b,...form,id:editId}:b) : [...bookings,{...form,id:Date.now()}];
    showToast(editId!==null?"Aggiornata":"Salvata"); setEditId(null);
    setBookings(nb); saveBookings(nb); setForm(emptyForm()); setView("list");
  }
  function handleEdit(b){ if(!canEdit){ setShowPinModal(true); return; } setForm({apt:b.apt,guest:b.guest,checkin:b.checkin,checkout:b.checkout,price:b.price,guests:b.guests||"",notes:b.notes||"",platform:b.platform||"diretto",status:b.status||"confirmed"}); setEditId(b.id); setView("add"); }
  function handleDel(id){ if(!canEdit){ setShowPinModal(true); return; } const nb=bookings.filter(b=>b.id!==id); setBookings(nb); saveBookings(nb); setDelId(null); showToast("Eliminata"); }
  function handleMSave(){
    if(!canEdit){ setShowPinModal(true); return; }
    if(!mForm.date){ showToast("Inserisci la data","error"); return; }
    const nm = editMId!==null ? maints.map(m=>m.id===editMId?{...m,...mForm,id:editMId}:m) : [...maints,{...mForm,id:Date.now()}];
    showToast(editMId!==null?"Aggiornata":"Salvata"); setEditMId(null);
    setMaints(nm); saveMaints(nm); setMForm(emptyMForm()); setView("list");
  }
  function handleMEdit(m){ if(!canEdit){ setShowPinModal(true); return; } setMForm({apt:m.apt,type:m.type,date:m.date,notes:m.notes||"",cost:m.cost||""}); setEditMId(m.id); setView("addMaint"); }
  function handleMDel(id){ if(!canEdit){ setShowPinModal(true); return; } const nm=maints.filter(m=>m.id!==id); setMaints(nm); saveMaints(nm); setDelMId(null); showToast("Eliminata"); }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const key = apiKey.trim() || localStorage.getItem(SK_APIKEY) || "";
    if (!key) { setAiError("Inserisci la chiave API nelle Impostazioni ⚙️ per usare questa funzione."); return; }
    setAiError(null); setAiLoading(true);
    try {
      const base64 = await new Promise((res, rej) => { const reader = new FileReader(); reader.onload=()=>res(reader.result.split(",")[1]); reader.onerror=()=>rej(new Error("Lettura file fallita")); reader.readAsDataURL(file); });
      const isPdf = file.type === "application/pdf";
      const mediaType = isPdf ? "application/pdf" : (file.type||"image/jpeg");
      const contentBlock = isPdf ? { type:"document", source:{ type:"base64", media_type:mediaType, data:base64 } } : { type:"image", source:{ type:"base64", media_type:mediaType, data:base64 } };
      const platIds = PLATFORMS.map(p=>p.id).join("|");
      const aptIds  = apts.map(a=>a.id).join("|");
      const prompt  = `Questo documento è una conferma di prenotazione affitto breve. Rispondi SOLO con JSON valido, nessun testo aggiuntivo, nessun markdown. Formato esatto:\n{"guest":"nome cognome","checkin":"YYYY-MM-DD","checkout":"YYYY-MM-DD","price":0,"guests":0,"platform":"uno di: ${platIds}","apt":"uno di: ${aptIds} oppure stringa vuota","notes":""}\nSe un dato non è leggibile usa stringa vuota o 0. Le date devono essere in formato YYYY-MM-DD.`;
      const res = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}, body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:500, messages:[{ role:"user", content:[ contentBlock, { type:"text", text:prompt } ] }] }) });
      if (!res.ok) {
        const errData = await res.json().catch(()=>({}));
        throw new Error(`HTTP ${res.status}: ${errData?.error?.message||"Errore API"}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error.message||"Errore API");
      const rawText = (data.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("").trim();
      const parsed  = JSON.parse(rawText.replace(/```json|```/g,"").trim());
      setForm(f => ({ ...f, guest:parsed.guest||f.guest, checkin:parsed.checkin||f.checkin, checkout:parsed.checkout||f.checkout, price:parsed.price&&parsed.price!==0?String(parsed.price):f.price, guests:parsed.guests&&parsed.guests!==0?String(parsed.guests):f.guests, platform:PLATFORMS.some(p=>p.id===parsed.platform)?parsed.platform:f.platform, apt:apts.some(a=>a.id===parsed.apt)?parsed.apt:f.apt, notes:parsed.notes||f.notes }));
      showToast("Dati estratti ✓ Verifica e salva");
    } catch(err) { console.error(err); setAiError("Non riesco a leggere il documento. Controlla che sia un'immagine chiara o un PDF valido."); }
    finally { setAiLoading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function saveSettings(){
    const nm = Object.fromEntries(DEFAULT_APARTMENTS.map(a=>[a.id,aptNames[a.id]||a.name]));
    setApts(DEFAULT_APARTMENTS.map(a=>({...a,name:nm[a.id]})));
    try{ await set(ref(db,"aptNames"), nm); }catch(e){}
    await saveTax(taxRate,costRate);
    if(apiKey.trim()) ls.set(SK_APIKEY, apiKey.trim());
    if(newPin.trim()){ ls.set(SK_PIN, newPin.trim()); setSavedPin(newPin.trim()); setNewPin(""); }
    showToast("Salvato"); setView("calendar");
  }

  function tryPin(){
    if(pinInput===savedPin){ setCanEdit(true); setShowPinModal(false); setPinInput(""); setPinError(false); showToast("Accesso consentito ✓"); }
    else{ setPinError(true); setTimeout(()=>setPinError(false),1500); }
  }
  async function importFromText(text){
    try{
      const data=JSON.parse(text.trim());
      if(!data.bookings||!data.maints) throw new Error();
      setBookings(data.bookings); setMaints(data.maints);
      if(data.aptNames){ setAptNames(data.aptNames); setApts(DEFAULT_APARTMENTS.map(a=>({...a,name:data.aptNames[a.id]||a.name}))); }
      if(data.taxRate!==undefined) setTaxRate(data.taxRate);
      if(data.costRate!==undefined) setCostRate(data.costRate);
      await saveBookings(data.bookings); await saveMaints(data.maints);
      if(data.aptNames) await set(ref(db,"aptNames"), data.aptNames).catch(()=>{});
      if(data.taxRate!==undefined) await saveTax(data.taxRate, data.costRate||0);
      setImportError(null); setImportText(""); showToast("Dati ripristinati ✓"); setView("calendar");
    } catch{ setImportError("Testo non valido"); showToast("Errore importazione","error"); }
  }
  function runDiag(){
    const result={};
    for(const key of [SK_BOOKINGS,SK_MAINTS,SK_NAMES,SK_TAX]){
      try{ const r=ls.get(key); if(r?.value){ const p=JSON.parse(r.value); result[key]=Array.isArray(p)?`${p.length} elementi`:JSON.stringify(p).substring(0,80); } else result[key]="vuoto"; }catch{ result[key]="errore"; }
    }
    setDiagInfo(result);
  }

  const calMonth=calDate.getMonth(), calYear2=calDate.getFullYear();
  const dIM=new Date(calYear2,calMonth+1,0).getDate();
  const firstDay=new Date(calYear2,calMonth,1).getDay();
  const weekStart=(()=>{ const r=new Date(calDate); r.setDate(r.getDate()-r.getDay()); return r; })();
  const weekDays=Array.from({length:7},(_,i)=>addDays(weekStart,i));
  function navCal(dir){
    if(calView==="month"){ let m=calDate.getMonth()+dir,y=calDate.getFullYear(); if(m<0){m=11;y--;} if(m>11){m=0;y++;} setCalDate(new Date(y,m,1)); }
    else { setCalDate(d=>addDays(d,dir*7)); }
  }
  function itemsForDay(iso){
    const bks=bookings.filter(b=>(isAllSel()||selApt.includes(b.apt))&&iso>=b.checkin&&iso<b.checkout);
    const mts=maints.filter(m=>(isAllSel()||m.apt==="all"||selApt.includes(m.apt))&&m.date===iso);
    return {bks,mts};
  }
  function occupancyPct(aptId,year,month){
    const dim=daysInMonth(year,month); let occ=0;
    for(let d=0;d<dim;d++){ const iso=toISO(new Date(year,month,d+1)); if(bookings.some(b=>(aptId==="all"||b.apt===aptId)&&iso>=b.checkin&&iso<b.checkout)) occ++; }
    return Math.round(occ/dim*100);
  }
  function filterBks({ year, month, aptIds }){
    return bookings.filter(b=>{
      if(aptIds&&!aptIds.includes("all")&&!aptIds.includes(b.apt)) return false;
      if(year!==undefined&&bkYear(b)!==year) return false;
      if(month!==null&&month!==undefined&&bkMonth(b)!==month) return false;
      return true;
    });
  }

  const filteredBookings = useMemo(()=>bookings.filter(b=>selApt==="all"||selApt.includes(b.apt)).sort((a,b)=>a.checkin.localeCompare(b.checkin)),[bookings,selApt]);
  const filteredMaints   = useMemo(()=>maints.filter(m=>selApt==="all"||m.apt==="all"||selApt.includes(m.apt)).sort((a,b)=>a.date.localeCompare(b.date)),[maints,selApt]);
  const upcomingCheckouts= useMemo(()=>{ const t=todayISO(),l=toISO(addDays(new Date(),7)); return bookings.filter(b=>b.checkout>=t&&b.checkout<=l).sort((a,b)=>a.checkout.localeCompare(b.checkout)); },[bookings]);
  const upcomingCheckins = useMemo(()=>{ const t=todayISO(),l=toISO(addDays(new Date(),7)); return bookings.filter(b=>b.checkin>=t&&b.checkin<=l).sort((a,b)=>a.checkin.localeCompare(b.checkin)); },[bookings]);

  if(loading) return <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1a0533,#0d1f3c,#0a2e1a)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",color:"#C8A96E"}}><div style={{fontSize:40,marginBottom:12}}>🏰</div><div style={{fontSize:14,letterSpacing:2}}>Caricamento...</div></div>;

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1a0533 0%,#0d1f3c 50%,#0a2e1a 100%)",fontFamily:"Georgia,serif",color:"#f0e6d3",overflowX:"hidden"}}>
      {toast&&<div style={{position:"fixed",top:18,left:"50%",transform:"translateX(-50%)",background:toast.type==="error"?"#8B1A2A":"#1a4a2e",color:"#f0e6d3",padding:"11px 22px",borderRadius:8,zIndex:9999,fontSize:13,border:`1px solid ${toast.type==="error"?"#D94F5C":"#4CAF8E"}`,whiteSpace:"nowrap"}}>{toast.msg}</div>}
      {showPinModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"#1a0533",border:"1px solid #C8A96E",borderRadius:14,padding:28,maxWidth:300,width:"88%",textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>🔒</div><div style={{fontSize:16,color:"#C8A96E",marginBottom:6}}>Accesso modifiche</div><div style={{fontSize:12,color:"#999",marginBottom:16}}>Inserisci il PIN per modificare i dati</div><input type="password" value={pinInput} onChange={e=>setPinInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tryPin()} placeholder="PIN" style={{...S.input,textAlign:"center",fontSize:20,letterSpacing:6,marginBottom:8}} autoFocus/>{pinError&&<div style={{fontSize:12,color:"#D94F5C",marginBottom:8}}>PIN errato ❌</div>}<div style={{display:"flex",gap:8,marginTop:8}}><button onClick={()=>{setShowPinModal(false);setPinInput("");setPinError(false);}} style={{...S.btn("#1a1a2e","#888"),flex:1,padding:"11px 0"}}>Annulla</button><button onClick={tryPin} style={{...S.btn("#1a3a2a","#4CAF8A"),flex:2,padding:"11px 0",fontWeight:"bold"}}>Entra</button></div></div></div>}
      {calExportOpen&&(()=>{ const b=bookings.find(x=>x.id===calExportOpen); if(!b) return null; const nm=aptLabel(b.apt); return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setCalExportOpen(null)}><div style={{background:"#1a1a2e",border:"1px solid #C8A96E",borderRadius:14,padding:24,maxWidth:310,width:"88%"}} onClick={e=>e.stopPropagation()}><div style={{fontSize:16,color:"#C8A96E",marginBottom:4,textAlign:"center"}}>📅 Aggiungi al Calendario</div><div style={{fontSize:12,color:"#999",textAlign:"center",marginBottom:18}}>Check-out di <strong style={{color:"#f0e6d3"}}>{b.guest}</strong><br/>{fmtDate(parseDate(b.checkout))} · {nm}</div><button onClick={()=>{ openGCal(b,nm); setCalExportOpen(null); }} style={{width:"100%",padding:"13px 0",marginBottom:10,borderRadius:10,border:"none",background:"#4285F4",color:"#fff",fontFamily:"Georgia,serif",fontSize:14,cursor:"pointer",fontWeight:"bold"}}>🗓 Google Calendar</button><button onClick={()=>{ downloadICS(b,nm); setCalExportOpen(null); }} style={{width:"100%",padding:"13px 0",borderRadius:10,border:"1px solid #C8A96E",background:"rgba(200,169,110,0.1)",color:"#C8A96E",fontFamily:"Georgia,serif",fontSize:14,cursor:"pointer",fontWeight:"bold"}}>🍎 Apple Calendar (.ics)</button><button onClick={()=>setCalExportOpen(null)} style={{width:"100%",padding:"10px 0",marginTop:10,borderRadius:10,border:"none",background:"transparent",color:"#666",fontFamily:"Georgia,serif",fontSize:13,cursor:"pointer"}}>Annulla</button></div></div>; })()}
      {delId!==null&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:998,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"#1a0533",border:"1px solid #C8A96E",borderRadius:12,padding:28,maxWidth:300,width:"88%",textAlign:"center"}}><div style={{fontSize:28,marginBottom:10}}>🗑️</div><div style={{fontSize:15,marginBottom:22}}>Eliminare questa prenotazione?</div><div style={{display:"flex",gap:10,justifyContent:"center"}}><button onClick={()=>setDelId(null)} style={S.btn("#333","#888")}>Annulla</button><button onClick={()=>handleDel(delId)} style={S.btn("#8B1A2A","#D94F5C")}>Elimina</button></div></div></div>}
      {delMId!==null&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:998,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"#1a0533",border:"1px solid #C8A96E",borderRadius:12,padding:28,maxWidth:300,width:"88%",textAlign:"center"}}><div style={{fontSize:28,marginBottom:10}}>🗑️</div><div style={{fontSize:15,marginBottom:22}}>Eliminare questa manutenzione?</div><div style={{display:"flex",gap:10,justifyContent:"center"}}><button onClick={()=>setDelMId(null)} style={S.btn("#333","#888")}>Annulla</button><button onClick={()=>handleMDel(delMId)} style={S.btn("#8B1A2A","#D94F5C")}>Elimina</button></div></div></div>}

      <div style={{maxWidth:520,margin:"0 auto",paddingBottom:100}}>
        <div style={{padding:"22px 20px 6px",textAlign:"center"}}>
          <div style={{fontSize:10,letterSpacing:4,color:"#C8A96E",textTransform:"uppercase"}}>Gestione</div>
          <h1 style={{fontSize:24,fontWeight:"normal",margin:"4px 0"}}>Villa Caterina</h1>
          <div style={{width:32,height:2,background:"#C8A96E",margin:"8px auto 4px"}}/>
          <button onClick={()=>setHideAmounts(v=>!v)} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(200,169,110,0.3)",borderRadius:8,padding:"4px 12px",color:hideAmounts?"#FF6B6B":"#4CAF8A",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12,marginTop:6}}>{hideAmounts?"🙈 Importi nascosti":"👁 Importi visibili"}</button>
          {savedPin&&<button onClick={()=>{ if(canEdit){ setCanEdit(false); showToast("Modalità sola lettura"); } else setShowPinModal(true); }} style={{background:"rgba(255,255,255,0.07)",border:`1px solid ${canEdit?"#4CAF8A44":"#C8A96E44"}`,borderRadius:8,padding:"4px 12px",color:canEdit?"#4CAF8A":"#C8A96E",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12,marginTop:6,marginLeft:6}}>{canEdit?"🔓 Modifica attiva":"🔒 Sola lettura"}</button>}
          {syncing&&<div style={{fontSize:10,color:"#C8A96E",marginTop:4}}>⟳ Sincronizzazione...</div>}
        </div>

        {!["add","addMaint","settings","stats"].includes(view)&&(
          <div style={{padding:"4px 12px 8px",display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none"}}>
            <Pill active={isAllSel()} color="#C8A96E" onClick={()=>toggleSelApt("all")}>Tutti</Pill>
            {apts.map(a=><Pill key={a.id} active={isAptSel(a.id)} color={a.color} onClick={()=>toggleSelApt(a.id)}>{a.emoji} {a.name}</Pill>)}
          </div>
        )}

        {["calendar","list"].includes(view)&&(upcomingCheckouts.length>0||upcomingCheckins.length>0)&&(
          <div style={{margin:"0 12px 12px",display:"flex",flexDirection:"column",gap:10}}>
            {upcomingCheckouts.length>0&&<div style={{background:"rgba(255,107,107,0.08)",border:"1px solid rgba(255,107,107,0.35)",borderRadius:11,padding:12}}>
              <div style={{fontSize:10,color:"#FF6B6B",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>🔴 Check-out in scadenza</div>
              {upcomingCheckouts.map(b=>{ const dl=Math.round((parseDate(b.checkout)-new Date())/86400000); const lbl=b.checkout===todayISO()?"OGGI":b.checkout===toISO(addDays(new Date(),1))?"DOMANI":`tra ${dl} giorni`; return <div key={b.id} onClick={()=>handleEdit(b)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.06)",cursor:"pointer"}}><div><div style={{fontSize:13,fontWeight:"bold"}}>{b.guest}</div><div style={{fontSize:11,color:aptColor(b.apt)}}>{aptEmoji(b.apt)} {aptLabel(b.apt)}</div></div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:11,fontWeight:"bold",color:"#FF6B6B",padding:"3px 8px",borderRadius:8,background:"rgba(255,107,107,0.15)"}}>{lbl}</span><button onClick={e=>{e.stopPropagation();setCalExportOpen(b.id);}} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:7,padding:"4px 8px",color:"#f0e6d3",cursor:"pointer",fontSize:11}}>📅</button></div></div>; })}
            </div>}
            {upcomingCheckins.length>0&&<div style={{background:"rgba(76,175,138,0.08)",border:"1px solid rgba(76,175,138,0.35)",borderRadius:11,padding:12}}>
              <div style={{fontSize:10,color:"#4CAF8A",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>🟢 Check-in in arrivo</div>
              {upcomingCheckins.map(b=>{ const dl=Math.round((parseDate(b.checkin)-new Date())/86400000); const lbl=b.checkin===todayISO()?"OGGI":b.checkin===toISO(addDays(new Date(),1))?"DOMANI":`tra ${dl} giorni`; return <div key={b.id} onClick={()=>handleEdit(b)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.06)",cursor:"pointer"}}><div><div style={{fontSize:13,fontWeight:"bold"}}>{b.guest}</div><div style={{fontSize:11,color:aptColor(b.apt)}}>{aptEmoji(b.apt)} {aptLabel(b.apt)}</div></div><span style={{fontSize:11,fontWeight:"bold",color:"#4CAF8A",padding:"3px 8px",borderRadius:8,background:"rgba(76,175,138,0.15)"}}>{lbl}</span></div>; })}
            </div>}
          </div>
        )}

        {view==="calendar"&&(
          <div style={{padding:"0 12px"}}>
            <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:10}}>
              {["month","week"].map(v=><button key={v} onClick={()=>setCalView(v)} style={{...S.btn(calView===v?"#C8A96E":"rgba(255,255,255,0.06)",calView===v?"#1a0533":"#C8A96E"),padding:"5px 14px",fontSize:12}}>{v==="month"?"Mese":"Settimana"}</button>)}
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <button onClick={()=>navCal(-1)} style={S.navBtn}>‹</button>
              {calView==="month" ? <div style={{display:"flex",gap:6}}><select value={calMonth} onChange={e=>setCalDate(new Date(calYear2,+e.target.value,1))} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(200,169,110,0.3)",borderRadius:7,padding:"4px 8px",color:"#C8A96E",fontFamily:"Georgia,serif",fontSize:14,cursor:"pointer",outline:"none"}}>{MONTHS.map((m,i)=><option key={i} value={i} style={{background:"#1a0533"}}>{m}</option>)}</select><select value={calYear2} onChange={e=>setCalDate(new Date(+e.target.value,calMonth,1))} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(200,169,110,0.3)",borderRadius:7,padding:"4px 8px",color:"#C8A96E",fontFamily:"Georgia,serif",fontSize:14,cursor:"pointer",outline:"none"}}>{Array.from({length:6},(_,i)=>new Date().getFullYear()-1+i).map(y=><option key={y} value={y} style={{background:"#1a0533"}}>{y}</option>)}</select></div> : <div style={{fontSize:15,color:"#C8A96E"}}>{fmtDate(weekStart)} – {fmtDate(addDays(weekStart,6))}</div>}
              <button onClick={()=>navCal(1)} style={S.navBtn}>›</button>
            </div>
            {calView==="month"?(
              <><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>{DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:"#C8A96E",padding:"2px 0"}}>{d}</div>)}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                {Array.from({length:firstDay}).map((_,i)=><div key={i}/>)}
                {Array.from({length:dIM},(_,i)=>i+1).map(day=>{ const now=new Date(); const isT=day===now.getDate()&&calMonth===now.getMonth()&&calYear2===now.getFullYear(); const iso=toISO(new Date(calYear2,calMonth,day)); const {bks,mts}=itemsForDay(iso); const all=[...bks.map(b=>({...b,_k:"b"})),...mts.map(m=>({...m,_k:"m"}))]; const hasOut=bookings.some(b=>(isAllSel()||selApt.includes(b.apt))&&b.checkout===iso); const hasIn=bookings.some(b=>(isAllSel()||selApt.includes(b.apt))&&b.checkin===iso); return <div key={day} onClick={()=>{ if(bks.length>0) handleEdit(bks[0]); }} style={{minHeight:72,borderRadius:4,background:isT?"rgba(200,169,110,0.15)":"rgba(255,255,255,0.04)",border:isT?"1px solid #C8A96E":"1px solid rgba(255,255,255,0.06)",padding:"2px",overflow:"hidden",position:"relative",cursor:bks.length>0?"pointer":"default"}}>{hasOut&&<div style={{position:"absolute",top:1,left:1,width:5,height:5,borderRadius:"50%",background:"#FF6B6B"}}/>}{hasIn&&<div style={{position:"absolute",top:1,left:hasOut?8:1,width:5,height:5,borderRadius:"50%",background:"#4CAF8A"}}/>}<div style={{fontSize:9,color:isT?"#C8A96E":"#aaa",textAlign:"right"}}>{day}</div>{all.slice(0,4).map((x,i)=>x._k==="b"?<div key={i} style={{fontSize:8,background:aptColor(x.apt)+"cc",borderRadius:2,padding:"1px 2px",marginBottom:1,color:"#1a0533",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.guest.split(" ")[0]}</div>:<div key={i} style={{fontSize:8,background:"rgba(255,200,100,0.25)",borderRadius:2,padding:"1px 2px",marginBottom:1,color:"#ffd580",whiteSpace:"nowrap"}}>{mtEmoji(x.type)}</div>)}{all.length>4&&<div style={{fontSize:7,color:"#C8A96E"}}>+{all.length-4}</div>}</div>; })}
              </div></>
            ):(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"38px repeat(7,1fr)",gap:2,marginBottom:3}}><div/>{weekDays.map((d,i)=>{ const isT=toISO(d)===toISO(new Date()); return <div key={i} style={{textAlign:"center",fontSize:9,color:isT?"#C8A96E":"#aaa",borderBottom:isT?"2px solid #C8A96E":"none",paddingBottom:2}}><div>{DAYS_SHORT[d.getDay()]}</div><div style={{fontSize:12,fontWeight:isT?"bold":"normal"}}>{d.getDate()}</div></div>; })}</div>
                {(isAllSel()?apts:apts.filter(a=>Array.isArray(selApt)&&selApt.includes(a.id))).map(apt=>(
                  <div key={apt.id} style={{display:"grid",gridTemplateColumns:"38px repeat(7,1fr)",gap:2,marginBottom:2}}>
                    <div style={{fontSize:8,color:apt.color,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",lineHeight:1.2}}>{apt.name.substring(0,5)}</div>
                    {weekDays.map((d,i)=>{ const iso=toISO(d); const bk=bookings.find(b=>b.apt===apt.id&&iso>=b.checkin&&iso<b.checkout); const mt=maints.filter(m=>(m.apt==="all"||m.apt===apt.id)&&m.date===iso); const isT=iso===toISO(new Date()); const hasOut=bookings.some(b=>b.apt===apt.id&&b.checkout===iso); return <div key={i} onClick={()=>{ if(bk) handleEdit(bk); }} style={{minHeight:36,borderRadius:3,background:isT?"rgba(200,169,110,0.1)":"rgba(255,255,255,0.04)",border:isT?"1px solid #C8A96E44":"1px solid rgba(255,255,255,0.05)",padding:1,overflow:"hidden",position:"relative",cursor:bk?"pointer":"default"}}>{hasOut&&<div style={{position:"absolute",top:1,right:1,width:4,height:4,borderRadius:"50%",background:"#FF6B6B"}}/>}{bk&&<div style={{fontSize:7,background:apt.color+"dd",color:"#1a0533",borderRadius:2,padding:"1px 2px",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bk.guest.split(" ")[0]}</div>}{mt.map((m,j)=><div key={j} style={{fontSize:9,textAlign:"center"}}>{mtEmoji(m.type)}</div>)}</div>; })}
                  </div>
                ))}
              </div>
            )}
            <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:10}}>{apts.map(a=><div key={a.id} style={{display:"flex",alignItems:"center",gap:3,fontSize:10,color:"#ccc"}}><div style={{width:8,height:8,borderRadius:2,background:a.color}}/>{a.name}</div>)}<div style={{display:"flex",alignItems:"center",gap:3,fontSize:10,color:"#FF6B6B"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#FF6B6B"}}/>Check-out</div><div style={{display:"flex",alignItems:"center",gap:3,fontSize:10,color:"#4CAF8A"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#4CAF8A"}}/>Check-in</div></div>
          </div>
        )}

        {view==="list"&&(
          <div style={{padding:"0 12px"}}>
            <div style={{display:"flex",gap:6,marginBottom:14}}><Pill active={listFilter==="all"} color="#C8A96E" onClick={()=>setListFilter("all")}>Tutto</Pill><Pill active={listFilter==="bookings"} color="#4CAF8A" onClick={()=>setListFilter("bookings")}>📋 Prenotazioni</Pill><Pill active={listFilter==="maint"} color="#ffd580" onClick={()=>setListFilter("maint")}>🛠️ Manutenzioni</Pill></div>
            {listFilter!=="maint"&&<>
              <div style={{display:"flex",gap:8,marginBottom:14}}><div style={S.card}><div style={{fontSize:18,fontWeight:"bold",color:"#C8A96E"}}>{filteredBookings.length}</div><div style={{fontSize:9,color:"#999"}}>PRENOT.</div></div><div style={S.card}><div style={{fontSize:18,fontWeight:"bold",color:"#4CAF8A"}}>€{fmtEur(filteredBookings.reduce((s,b)=>s+(parseFloat(b.price)||0),0))}</div><div style={{fontSize:9,color:"#999"}}>LORDO</div></div><div style={S.card}><div style={{fontSize:18,fontWeight:"bold",color:"#7EC8E3"}}>€{fmtEur(filteredBookings.reduce((s,b)=>s+(parseFloat(b.price)||0),0)*taxMult)}</div><div style={{fontSize:9,color:"#999"}}>NETTO</div></div></div>
              {filteredBookings.length===0&&<div style={{textAlign:"center",padding:"28px 0",color:"#666"}}>Nessuna prenotazione</div>}
              {filteredBookings.map(b=>{ const a=apts.find(x=>x.id===b.apt); const n=nights(parseDate(b.checkin),parseDate(b.checkout)); const prc=parseFloat(b.price)||0; const dl=Math.round((parseDate(b.checkout)-new Date())/86400000); const soon=dl>=0&&dl<=7; return <div key={b.id} style={{background:"rgba(255,255,255,0.05)",borderRadius:11,padding:13,marginBottom:9,borderLeft:`4px solid ${a?a.color:"#888"}`,outline:soon?"1px solid rgba(255,107,107,0.3)":"none"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><div><div style={{fontSize:15,fontWeight:"bold"}}>{b.guest}{soon&&<span style={{marginLeft:6,fontSize:10,color:"#FF6B6B",background:"rgba(255,107,107,0.15)",padding:"1px 6px",borderRadius:8}}>⏰ {dl===0?"oggi":dl===1?"domani":`tra ${dl}gg`}</span>}</div><div style={{fontSize:11,color:a?a.color:"#888"}}>{a?.emoji} {a?.name}</div>{b.platform&&<div style={{marginTop:4,display:"inline-block",padding:"2px 8px",borderRadius:10,background:platColor(b.platform)+"33",border:`1px solid ${platColor(b.platform)}66`,fontSize:10,color:platColor(b.platform),fontWeight:"bold"}}>{platEmoji(b.platform)} {platLabel(b.platform)}</div>}</div><div style={{textAlign:"right"}}>{prc>0&&<div style={{fontSize:17,fontWeight:"bold",color:"#4CAF8A"}}>€{fmtEur(prc)}</div>}{prc>0&&<div style={{fontSize:10,color:"#7EC8E3"}}>~€{fmtEur(prc*taxMult)} netto</div>}<div style={{fontSize:10,marginTop:3,padding:"2px 6px",borderRadius:8,display:"inline-block",background:b.status==="tentative"?"rgba(200,169,110,0.2)":"rgba(76,175,138,0.2)",color:b.status==="tentative"?"#C8A96E":"#4CAF8A"}}>{b.status==="tentative"?"Provvisoria":"Confermata"}</div></div></div><div style={{display:"flex",gap:12,fontSize:13,marginBottom:4}}><div><div style={{fontSize:9,color:"#999"}}>CHECK-IN</div>{fmtDate(parseDate(b.checkin))}</div><div style={{color:"#555",alignSelf:"flex-end"}}>→</div><div><div style={{fontSize:9,color:"#999"}}>CHECK-OUT</div>{fmtDate(parseDate(b.checkout))}</div><div style={{marginLeft:"auto",textAlign:"right"}}><div style={{fontSize:9,color:"#999"}}>NOTTI</div><div style={{color:"#C8A96E"}}>{n}</div></div></div>{b.guests&&<div style={{fontSize:11,color:"#aaa",marginBottom:3}}>Ospiti: {b.guests}</div>}{b.notes&&<div style={{fontSize:11,color:"#aaa",fontStyle:"italic",borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:6,marginTop:4}}>{b.notes}</div>}<div style={{display:"flex",gap:7,marginTop:9}}><button onClick={()=>setCalExportOpen(b.id)} style={{...S.btn("#1a2a3a","#FFB347"),fontSize:12,padding:"7px 10px"}}>📅</button><button onClick={()=>handleEdit(b)} style={{...S.btn("#1a3a4a","#7EC8E3"),flex:1,fontSize:12,padding:"7px 0"}}>Modifica</button><button onClick={()=>setDelId(b.id)} style={{...S.btn("#3a1a1a","#D94F5C"),flex:1,fontSize:12,padding:"7px 0"}}>Elimina</button></div></div>; })}
            </>}
            {listFilter!=="bookings"&&<>
              {listFilter==="maint"&&<div style={{display:"flex",gap:8,marginBottom:14}}><div style={S.card}><div style={{fontSize:18,fontWeight:"bold",color:"#ffd580"}}>{filteredMaints.length}</div><div style={{fontSize:9,color:"#999"}}>MANUT.</div></div><div style={S.card}><div style={{fontSize:18,fontWeight:"bold",color:"#D94F5C"}}>€{fmtEur(filteredMaints.reduce((s,m)=>s+(parseFloat(m.cost)||0),0))}</div><div style={{fontSize:9,color:"#999"}}>COSTO TOT.</div></div></div>}
              {listFilter==="all"&&filteredMaints.length>0&&<div style={{fontSize:10,color:"#ffd580",letterSpacing:3,textTransform:"uppercase",margin:"16px 0 8px",borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:14}}>Manutenzioni</div>}
              {filteredMaints.length===0&&<div style={{textAlign:"center",padding:"28px 0",color:"#666"}}>Nessuna manutenzione</div>}
              {filteredMaints.map(m=>(<div key={m.id} style={{background:"rgba(255,200,80,0.06)",borderRadius:10,padding:12,marginBottom:8,borderLeft:"4px solid #ffd580"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:14}}>{mtEmoji(m.type)} {mtLabel(m.type)}</div><div style={{fontSize:11,color:"#aaa"}}>{m.apt==="all"?"Tutta la villa":aptEmoji(m.apt)+" "+aptLabel(m.apt)}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:12,color:"#ffd580"}}>{fmtDate(parseDate(m.date))}</div>{m.cost&&<div style={{fontSize:12,color:"#D94F5C"}}>€{fmtEur(parseFloat(m.cost))}</div>}</div></div>{m.notes&&<div style={{fontSize:11,color:"#aaa",fontStyle:"italic",marginTop:7}}>{m.notes}</div>}<div style={{display:"flex",gap:7,marginTop:9}}><button onClick={()=>handleMEdit(m)} style={{...S.btn("#2a2a1a","#ffd580"),flex:1,fontSize:12,padding:"7px 0"}}>Modifica</button><button onClick={()=>setDelMId(m.id)} style={{...S.btn("#3a1a1a","#D94F5C"),flex:1,fontSize:12,padding:"7px 0"}}>Elimina</button></div></div>))}
            </>}
          </div>
        )}

        {view==="stats"&&(()=>{
          const isAll=statsApts.includes("all");
          const bksYear=filterBks({year:statsYear,aptIds:statsApts});
          const bksFilt=statsMonth!==null?filterBks({year:statsYear,month:statsMonth,aptIds:statsApts}):bksYear;
          const totRev=bksFilt.reduce((s,b)=>s+(parseFloat(b.price)||0),0);
          const totNts=bksFilt.reduce((s,b)=>s+nights(parseDate(b.checkin),parseDate(b.checkout)),0);
          const avgNts=bksFilt.length>0?totNts/bksFilt.length:0;
          const monthly=Array(12).fill(0); bksYear.forEach(b=>{monthly[bkMonth(b)]+=parseFloat(b.price)||0;});
          const totYear=monthly.reduce((s,v)=>s+v,0);
          const totYearAll=filterBks({year:statsYear,aptIds:["all"]}).reduce((s,b)=>s+(parseFloat(b.price)||0),0);
          const maxVal=Math.max(...monthly,1);
          const barColor=(!isAll&&statsApts.length===1)?aptColor(statsApts[0]):"#C8A96E";
          const aptsShow=isAll?apts:apts.filter(a=>statsApts.includes(a.id));
          const periodLabel=statsMonth!==null?`${MONTHS[statsMonth]} ${statsYear}`:`Anno ${statsYear}`;
          const ATTIVITA_START="2026-05-15";
          return <div style={{padding:"0 12px"}}>
            <div style={{textAlign:"center",fontSize:10,color:"#C8A96E",letterSpacing:3,textTransform:"uppercase",marginBottom:10}}>Statistiche</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}><Pill active={statsApts.includes("all")} color="#C8A96E" onClick={()=>toggleStatsApt("all")}>Tutti</Pill>{apts.map(a=><Pill key={a.id} active={statsApts.includes(a.id)} color={a.color} onClick={()=>toggleStatsApt(a.id)}>{a.emoji} {a.name}</Pill>)}</div>
            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:11,padding:14,marginBottom:14,border:"1px solid rgba(255,255,255,0.08)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase"}}>{periodLabel.toUpperCase()}</div><div style={{display:"flex",alignItems:"center",gap:6}}><button onClick={()=>setStatsYear(y=>y-1)} style={{...S.navBtn,width:24,height:24,fontSize:14}}>‹</button><div style={{fontSize:13,color:"#C8A96E",minWidth:36,textAlign:"center"}}>{statsYear}</div><button onClick={()=>setStatsYear(y=>y+1)} style={{...S.navBtn,width:24,height:24,fontSize:14}}>›</button></div></div>
              <div style={{display:"flex",gap:8,marginBottom:8}}><div style={S.card}><div style={{fontSize:17,fontWeight:"bold",color:"#4CAF8A"}}>€{fmtEur(totRev)}</div><div style={{fontSize:9,color:"#999"}}>LORDO</div></div><div style={S.card}><div style={{fontSize:17,fontWeight:"bold",color:"#7EC8E3"}}>€{fmtEur(totRev*taxMult)}</div><div style={{fontSize:9,color:"#999"}}>NETTO</div></div><div style={S.card}><div style={{fontSize:17,fontWeight:"bold",color:"#aaa"}}>{bksFilt.length}</div><div style={{fontSize:9,color:"#999"}}>PRENOT.</div></div></div>
              <div style={{display:"flex",gap:8}}><div style={S.card}><div style={{fontSize:15,fontWeight:"bold",color:"#aaa"}}>{totNts}</div><div style={{fontSize:9,color:"#999"}}>NOTTI TOT.</div></div><div style={S.card}><div style={{fontSize:15,fontWeight:"bold",color:"#FFB347"}}>{bksFilt.length>0?avgNts.toFixed(1):"—"}</div><div style={{fontSize:9,color:"#999"}}>Ø NOTTI/PREN.</div></div></div>
            </div>
            {(()=>{ const allBks=(isAll?bookings:bookings.filter(b=>statsApts.includes(b.apt))).filter(b=>b.checkin>=ATTIVITA_START); const allRev=allBks.reduce((s,b)=>s+(parseFloat(b.price)||0),0); const allNts=allBks.reduce((s,b)=>s+nights(parseDate(b.checkin),parseDate(b.checkout)),0); const days=Math.floor((new Date()-parseDate(ATTIVITA_START))/86400000); return <div style={{background:"rgba(200,169,110,0.07)",borderRadius:11,padding:14,marginBottom:14,border:"1px solid rgba(200,169,110,0.35)"}}><div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>📊 Totale storico</div><div style={{fontSize:15,color:"#C8A96E",fontWeight:"bold",marginBottom:14}}>Dal 15 maggio 2026 · <span style={{fontSize:22,color:"#fff"}}>{days}</span> giorni di attività</div><div style={{display:"flex",gap:8,marginBottom:8}}><div style={S.card}><div style={{fontSize:18,fontWeight:"bold",color:"#4CAF8A"}}>€{fmtEur(allRev)}</div><div style={{fontSize:9,color:"#999"}}>LORDO TOTALE</div></div><div style={S.card}><div style={{fontSize:18,fontWeight:"bold",color:"#7EC8E3"}}>€{fmtEur(allRev*taxMult)}</div><div style={{fontSize:9,color:"#999"}}>NETTO TOTALE</div></div></div><div style={{display:"flex",gap:8}}><div style={S.card}><div style={{fontSize:16,fontWeight:"bold",color:"#C8A96E"}}>{allBks.length}</div><div style={{fontSize:9,color:"#999"}}>PREN. TOTALI</div></div><div style={S.card}><div style={{fontSize:16,fontWeight:"bold",color:"#C8A96E"}}>{allNts}</div><div style={{fontSize:9,color:"#999"}}>NOTTI TOTALI</div></div></div></div>; })()}
            <div style={{background:"rgba(255,255,255,0.04)",borderRadius:11,padding:14,marginBottom:14,border:"1px solid rgba(200,169,110,0.12)"}}>
              <div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>Ricavi mensili {statsYear}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:3,alignItems:"flex-end",height:110,marginBottom:4}}>{monthly.map((val,i)=>{ const pct=totYear>0?Math.round(val/totYear*100):0; const sel=statsMonth===i; return <div key={i} onClick={()=>setStatsMonth(statsMonth===i?null:i)} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%",cursor:"pointer"}}>{val>0&&<div style={{fontSize:7,color:sel?"#fff":barColor,marginBottom:2,textAlign:"center",lineHeight:1,fontWeight:sel?"bold":"normal"}}>{pct}%</div>}<div style={{width:"100%",background:val>0?(sel?"#fff":barColor+"cc"):"rgba(255,255,255,0.07)",borderRadius:"3px 3px 0 0",height:Math.max((val/maxVal)*80,val>0?8:3)+"%",outline:sel?"2px solid #fff":"none"}}/></div>; })}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:3,marginBottom:8}}>{MONTHS_SHORT.map((m,i)=><div key={i} onClick={()=>setStatsMonth(statsMonth===i?null:i)} style={{textAlign:"center",fontSize:7,color:statsMonth===i?"#C8A96E":"#666",cursor:"pointer",fontWeight:statsMonth===i?"bold":"normal",borderBottom:statsMonth===i?"1px solid #C8A96E":"none"}}>{m}</div>)}</div>
              {statsMonth===null&&(()=>{ const rows=Array.from({length:12},(_,mi)=>{ const bk=filterBks({year:statsYear,month:mi,aptIds:statsApts}); const r=bk.reduce((s,b)=>s+(parseFloat(b.price)||0),0); const n=bk.reduce((s,b)=>s+nights(parseDate(b.checkin),parseDate(b.checkout)),0); return {bks:bk.length,rev:r,nts:n,avg:bk.length>0?n/bk.length:0}; }); const tot={bks:0,rev:0,nts:0}; rows.forEach(r=>{tot.bks+=r.bks;tot.rev+=r.rev;tot.nts+=r.nts;}); return <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:12}}>{rows.map((d,i)=><div key={i} onClick={()=>setStatsMonth(i)} style={{display:"grid",gridTemplateColumns:"52px 1fr 36px 40px 52px",gap:4,padding:"5px 2px",borderRadius:6,cursor:"pointer",background:statsMonth===i?"rgba(200,169,110,0.1)":"transparent",marginBottom:1}}><div style={{fontSize:11,color:"#aaa"}}>{MONTHS_SHORT[i]}</div><div style={{fontSize:11,color:d.rev>0?"#4CAF8A":"#444",textAlign:"right"}}>€{fmtEur(d.rev)}</div><div style={{fontSize:11,color:d.bks>0?"#f0e6d3":"#444",textAlign:"right"}}>{d.bks||"—"}</div><div style={{fontSize:11,color:d.nts>0?"#C8A96E":"#444",textAlign:"right"}}>{d.nts||"—"}</div><div style={{fontSize:11,color:d.avg>0?"#FFB347":"#444",textAlign:"right"}}>{d.avg>0?d.avg.toFixed(1)+"n":"—"}</div></div>)}<div style={{display:"grid",gridTemplateColumns:"52px 1fr 36px 40px 52px",gap:4,padding:"6px 2px",borderTop:"1px solid rgba(200,169,110,0.3)",marginTop:4}}><div style={{fontSize:10,color:"#C8A96E",fontWeight:"bold"}}>TOT.</div><div style={{fontSize:11,color:"#4CAF8A",textAlign:"right",fontWeight:"bold"}}>€{fmtEur(tot.rev)}</div><div style={{fontSize:11,color:"#f0e6d3",textAlign:"right",fontWeight:"bold"}}>{tot.bks}</div><div style={{fontSize:11,color:"#C8A96E",textAlign:"right",fontWeight:"bold"}}>{tot.nts}</div><div style={{fontSize:11,color:"#FFB347",textAlign:"right",fontWeight:"bold"}}>{tot.bks>0?(tot.nts/tot.bks).toFixed(1)+"n":"—"}</div></div></div>; })()}
              {statsMonth!==null&&(()=>{ const bkM=filterBks({year:statsYear,month:statsMonth,aptIds:statsApts}); const rM=bkM.reduce((s,b)=>s+(parseFloat(b.price)||0),0); return <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:12}}><div style={{display:"flex",gap:8,marginBottom:10}}><div style={S.card}><div style={{fontSize:15,fontWeight:"bold",color:barColor}}>€{fmtEur(rM)}</div><div style={{fontSize:9,color:"#999"}}>LORDO {MONTHS_SHORT[statsMonth]}</div></div><div style={S.card}><div style={{fontSize:15,fontWeight:"bold",color:"#7EC8E3"}}>€{fmtEur(rM*taxMult)}</div><div style={{fontSize:9,color:"#999"}}>NETTO</div></div></div>{bkM.map(b=>{ const a=apts.find(x=>x.id===b.apt); const n=nights(parseDate(b.checkin),parseDate(b.checkout)); return <div key={b.id} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"9px 11px",marginBottom:7,borderLeft:`3px solid ${a?a.color:"#888"}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:13,fontWeight:"bold"}}>{b.guest}</div><div style={{fontSize:10,color:a?a.color:"#888"}}>{a?.emoji} {a?.name}</div><div style={{fontSize:10,color:"#888"}}>{fmtDate(parseDate(b.checkin))} → {fmtDate(parseDate(b.checkout))} · {n} notti</div></div><div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:"bold",color:"#4CAF8A"}}>€{fmtEur(parseFloat(b.price)||0)}</div>{b.platform&&<div style={{fontSize:9,color:platColor(b.platform)}}>{platEmoji(b.platform)} {platLabel(b.platform)}</div>}</div></div>; })}<button onClick={()=>setStatsMonth(null)} style={{...S.btn("transparent","#C8A96E44"),width:"100%",marginTop:6,padding:"7px 0",fontSize:12,color:"#999"}}>✕ Chiudi mese</button></div>; })()}
            </div>
            {(()=>{ const byP={}; PLATFORMS.forEach(p=>{byP[p.id]={count:0,revenue:0};}); bksFilt.forEach(b=>{const pid=b.platform||"altro"; if(!byP[pid])byP[pid]={count:0,revenue:0}; byP[pid].count++; byP[pid].revenue+=parseFloat(b.price)||0;}); return <div style={{background:"rgba(255,255,255,0.04)",borderRadius:11,padding:14,marginBottom:14,border:"1px solid rgba(200,169,110,0.12)"}}><div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Piattaforme — {periodLabel}</div>{PLATFORMS.map(p=>{ const d=byP[p.id]; const pct=bksFilt.length>0?(d.count/bksFilt.length*100):0; return <div key={p.id} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><div style={{fontSize:14,display:"flex",alignItems:"center",gap:6}}><span>{p.emoji}</span><span style={{color:p.color,fontWeight:"bold"}}>{p.label}</span></div><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{fontSize:13,fontWeight:"bold"}}>{d.count}</span>{d.revenue>0&&<span style={{fontSize:12,color:"#4CAF8A"}}>€{fmtEur(d.revenue)}</span>}<span style={{fontSize:11,color:"#666",minWidth:30,textAlign:"right"}}>{Math.round(pct)}%</span></div></div><div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:p.color,borderRadius:3}}/></div></div>; })}</div>; })()}
            {(()=>{ const medals=["🥇","🥈","🥉","4°","5°"]; const rankY=apts.map(a=>({...a,rev:filterBks({year:statsYear,aptIds:[a.id]}).reduce((s,b)=>s+(parseFloat(b.price)||0),0)})).sort((a,b)=>b.rev-a.rev); const rankA=apts.map(a=>({...a,rev:bookings.filter(b=>b.apt===a.id&&b.checkin>=ATTIVITA_START).reduce((s,b)=>s+(parseFloat(b.price)||0),0)})).sort((a,b)=>b.rev-a.rev); const mxY=Math.max(...rankY.map(a=>a.rev),1), mxA=Math.max(...rankA.map(a=>a.rev),1); return <div style={{background:"rgba(255,255,255,0.04)",borderRadius:11,padding:14,marginBottom:14,border:"1px solid rgba(200,169,110,0.12)"}}><div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>🏆 Classifica fatturato</div><div style={{fontSize:11,color:"#aaa",marginBottom:8}}>ANNO {statsYear}</div>{rankY.map((a,i)=>{ const pct=mxY>0?a.rev/mxY*100:0; return <div key={a.id} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}><div style={{display:"flex",alignItems:"center",gap:6,fontSize:13}}><span style={{fontSize:14,minWidth:20}}>{medals[i]}</span><span style={{width:9,height:9,borderRadius:2,background:a.color,display:"inline-block"}}/><span style={{color:a.color,fontWeight:"bold"}}>{a.name}</span></div><span style={{fontSize:13,fontWeight:"bold",color:"#4CAF8A"}}>€{fmtEur(a.rev)}</span></div><div style={{height:7,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${a.color}88,${a.color})`,borderRadius:4}}/></div></div>; })}<div style={{fontSize:11,color:"#aaa",margin:"14px 0 8px",paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.07)"}}>DAL 15 MAGGIO 2026 — STORICO</div>{rankA.map((a,i)=>{ const pct=mxA>0?a.rev/mxA*100:0; return <div key={a.id} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}><div style={{display:"flex",alignItems:"center",gap:6,fontSize:13}}><span style={{fontSize:14,minWidth:20}}>{medals[i]}</span><span style={{width:9,height:9,borderRadius:2,background:a.color,display:"inline-block"}}/><span style={{color:a.color,fontWeight:"bold"}}>{a.name}</span></div><span style={{fontSize:13,fontWeight:"bold",color:"#C8A96E"}}>€{fmtEur(a.rev)}</span></div><div style={{height:7,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${a.color}66,${a.color}cc)`,borderRadius:4}}/></div></div>; })}</div>; })()}
            {aptsShow.map(a=>{ const bkA=filterBks({year:statsYear,month:statsMonth,aptIds:[a.id]}); const rA=bkA.reduce((s,b)=>s+(parseFloat(b.price)||0),0); const nA=bkA.reduce((s,b)=>s+nights(parseDate(b.checkin),parseDate(b.checkout)),0); const pct=totYearAll>0?filterBks({year:statsYear,aptIds:[a.id]}).reduce((s,b)=>s+(parseFloat(b.price)||0),0)/totYearAll*100:0; const occ=statsMonth!==null?occupancyPct(a.id,statsYear,statsMonth):(()=>{ const v=Array.from({length:12},(_,m)=>occupancyPct(a.id,statsYear,m)); return Math.round(v.reduce((s,x)=>s+x,0)/12); })(); const oc=occ>=80?"#4CAF8A":occ>=50?"#FFB347":"#D94F5C"; return <div key={a.id} style={{background:"rgba(255,255,255,0.04)",borderRadius:11,padding:13,marginBottom:9,borderLeft:`4px solid ${a.color}`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{fontSize:14}}>{a.emoji} <span style={{color:a.color,fontWeight:"bold"}}>{a.name}</span></div><div style={{fontSize:10,color:"#999"}}>{pct.toFixed(0)}% del fatturato</div></div><div style={{height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,marginBottom:10,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:a.color,borderRadius:3}}/></div><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><div style={{fontSize:10,color:"#999"}}>OCCUPAZIONE</div><div style={{fontSize:13,fontWeight:"bold",color:oc}}>{occ}%</div></div><div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden",marginBottom:10}}><div style={{height:"100%",width:occ+"%",background:oc,borderRadius:4}}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}><div style={S.card}><div style={{fontSize:13,fontWeight:"bold"}}>{bkA.length}</div><div style={{fontSize:9,color:"#999"}}>PREN.</div></div><div style={S.card}><div style={{fontSize:13,fontWeight:"bold",color:"#C8A96E"}}>{nA}</div><div style={{fontSize:9,color:"#999"}}>NOTTI</div></div><div style={S.card}><div style={{fontSize:13,fontWeight:"bold",color:"#4CAF8A"}}>€{fmtEur(rA)}</div><div style={{fontSize:9,color:"#999"}}>LORDO</div></div></div></div>; })}
          </div>;
        })()}

        {view==="add"&&(
          <div style={{padding:"0 14px"}}>
            <div style={{fontSize:15,color:"#C8A96E",marginBottom:14,textAlign:"center",letterSpacing:1}}>{editId!==null?"Modifica":"Nuova"} Prenotazione</div>
            {editId===null&&(<div style={{background:"rgba(126,200,227,0.07)",border:"1px solid rgba(126,200,227,0.3)",borderRadius:11,padding:14,marginBottom:16}}><div style={{fontSize:12,color:"#7EC8E3",fontWeight:"bold",marginBottom:4}}>📷 Compila dai dati della prenotazione</div><div style={{fontSize:11,color:"#999",marginBottom:10}}>Carica uno screenshot o PDF della conferma. I campi verranno compilati automaticamente dall'IA — controlla sempre prima di salvare.</div><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={handleFileUpload} disabled={aiLoading} style={{display:"none"}} id="fileUpload"/><label htmlFor="fileUpload" style={{display:"block",textAlign:"center",...S.btn("#1a2a3a","#7EC8E3"),padding:"12px 0",fontWeight:"bold",cursor:aiLoading?"not-allowed":"pointer",opacity:aiLoading?0.6:1}}>{aiLoading?"⏳ Analisi in corso...":"📎 Scegli foto o PDF"}</label>{aiError&&<div style={{marginTop:8,fontSize:11,color:"#D94F5C",lineHeight:1.4}}>{aiError}</div>}</div>)}
            <div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:7}}>Appartamento</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>{apts.map(a=><Pill key={a.id} active={form.apt===a.id} color={a.color} onClick={()=>setForm(f=>({...f,apt:a.id}))}>{a.emoji} {a.name}</Pill>)}</div>
            <div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Nome Ospite</div>
            <input value={form.guest} onChange={e=>setForm(f=>({...f,guest:e.target.value}))} placeholder="Nome e cognome" style={S.input}/>
            <div style={{display:"flex",gap:8}}><div style={{flex:1}}><div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:6,marginTop:10}}>Check-in</div><input type="date" value={form.checkin} onChange={e=>setForm(f=>({...f,checkin:e.target.value}))} style={S.input}/></div><div style={{flex:1}}><div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:6,marginTop:10}}>Check-out</div><input type="date" value={form.checkout} onChange={e=>setForm(f=>({...f,checkout:e.target.value}))} style={S.input}/></div></div>
            {form.checkin&&form.checkout&&parseDate(form.checkout)>parseDate(form.checkin)&&<div style={{textAlign:"center",color:"#C8A96E",fontSize:12,margin:"4px 0 8px"}}>{nights(parseDate(form.checkin),parseDate(form.checkout))} notti</div>}
            <div style={{display:"flex",gap:8}}><div style={{flex:1}}><div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:6,marginTop:10}}>Prezzo (€)</div><input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="0" style={S.input}/></div><div style={{flex:1}}><div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:6,marginTop:10}}>Ospiti</div><input type="number" value={form.guests} onChange={e=>setForm(f=>({...f,guests:e.target.value}))} placeholder="1" style={S.input}/></div></div>
            <div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:7,marginTop:10}}>Piattaforma</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>{PLATFORMS.map(p=><button key={p.id} onClick={()=>setForm(f=>({...f,platform:p.id}))} style={{padding:"8px 14px",borderRadius:20,border:form.platform===p.id?"none":`1px solid ${p.color}55`,background:form.platform===p.id?p.color:"rgba(255,255,255,0.06)",color:form.platform===p.id?"#fff":"#f0e6d3",cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif",fontWeight:form.platform===p.id?"bold":"normal"}}>{p.emoji} {p.label}</button>)}</div>
            <div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:7}}>Stato</div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>{[["confirmed","Confermata","#4CAF8A"],["tentative","Provvisoria","#C8A96E"]].map(([v,l,c])=><button key={v} onClick={()=>setForm(f=>({...f,status:v}))} style={{flex:1,padding:"10px 0",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:13,background:form.status===v?c:"rgba(255,255,255,0.06)",color:form.status===v?"#1a0533":"#aaa"}}>{l}</button>)}</div>
            <div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Note</div>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Note aggiuntive..." rows={3} style={{...S.input,resize:"vertical",marginBottom:16}}/>
            <div style={{display:"flex",gap:8}}><button onClick={()=>{setEditId(null);setForm(emptyForm());setView("list");}} style={{...S.btn("#1a1a2e","#888"),flex:1,padding:"12px 0"}}>Annulla</button><button onClick={handleSave} style={{...S.btn("#1a3a2a","#4CAF8A"),flex:2,padding:"12px 0",fontWeight:"bold"}}>{editId!==null?"Aggiorna":"Salva"}</button></div>
          </div>
        )}

        {view==="addMaint"&&(
          <div style={{padding:"0 14px"}}>
            <div style={{fontSize:15,color:"#ffd580",marginBottom:14,textAlign:"center",letterSpacing:1}}>{editMId!==null?"Modifica":"Nuova"} Manutenzione</div>
            <div style={{fontSize:10,color:"#ffd580",letterSpacing:2,textTransform:"uppercase",marginBottom:7}}>Riguarda</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}><Pill active={mForm.apt==="all"} color="#ffd580" onClick={()=>setMForm(f=>({...f,apt:"all"}))}>Tutta la villa</Pill>{apts.map(a=><Pill key={a.id} active={mForm.apt===a.id} color={a.color} onClick={()=>setMForm(f=>({...f,apt:a.id}))}>{a.emoji} {a.name}</Pill>)}</div>
            <div style={{fontSize:10,color:"#ffd580",letterSpacing:2,textTransform:"uppercase",marginBottom:7}}>Tipo</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>{MAINT_TYPES.map(t=><Pill key={t.id} active={mForm.type===t.id} color="#ffd580" onClick={()=>setMForm(f=>({...f,type:t.id}))}>{t.emoji} {t.label}</Pill>)}</div>
            <div style={{fontSize:10,color:"#ffd580",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Data</div>
            <input type="date" value={mForm.date} onChange={e=>setMForm(f=>({...f,date:e.target.value}))} style={S.input}/>
            <div style={{fontSize:10,color:"#ffd580",letterSpacing:2,textTransform:"uppercase",marginBottom:6,marginTop:10}}>Costo (€)</div>
            <input type="number" value={mForm.cost} onChange={e=>setMForm(f=>({...f,cost:e.target.value}))} placeholder="0" style={S.input}/>
            <div style={{fontSize:10,color:"#ffd580",letterSpacing:2,textTransform:"uppercase",marginBottom:6,marginTop:10}}>Note</div>
            <textarea value={mForm.notes} onChange={e=>setMForm(f=>({...f,notes:e.target.value}))} placeholder="Descrizione..." rows={3} style={{...S.input,resize:"vertical",marginBottom:16}}/>
            <div style={{display:"flex",gap:8}}><button onClick={()=>{setEditMId(null);setMForm(emptyMForm());setView("list");}} style={{...S.btn("#1a1a2e","#888"),flex:1,padding:"12px 0"}}>Annulla</button><button onClick={handleMSave} style={{...S.btn("#2a2a1a","#ffd580"),flex:2,padding:"12px 0",fontWeight:"bold"}}>{editMId!==null?"Aggiorna":"Salva"}</button></div>
          </div>
        )}

        {view==="settings"&&(
          <div style={{padding:"0 14px"}}>
            <div style={{fontSize:15,color:"#C8A96E",marginBottom:16,textAlign:"center"}}>Impostazioni</div>
            <div style={{background:"rgba(76,175,138,0.07)",border:"1px solid rgba(76,175,138,0.3)",borderRadius:11,padding:14,marginBottom:14}}>
              <div style={{fontSize:12,color:"#4CAF8A",marginBottom:4}}>💾 Backup dati</div>
              <button onClick={()=>setShowExport(v=>!v)} style={{...S.btn("#1a3a2a","#4CAF8A"),width:"100%",padding:"12px 0",fontWeight:"bold",marginBottom:10,fontSize:14}}>{showExport?"▲ Nascondi":"⬇️ Mostra dati da copiare"}</button>
              {showExport&&(()=>{ const payload=JSON.stringify({version:1,exportedAt:new Date().toISOString(),bookings,maints,aptNames,taxRate,costRate}); return <div style={{marginBottom:10}}><textarea readOnly value={payload} rows={5} style={{...S.input,fontSize:10,fontFamily:"monospace",resize:"vertical",marginBottom:6}} onClick={e=>e.target.select()}/><button onClick={()=>navigator.clipboard?.writeText(payload).then(()=>showToast("Copiato ✓")).catch(()=>showToast("Seleziona e copia manualmente","error"))} style={{...S.btn("#1a2a3a","#4CAF8A"),width:"100%",padding:"10px 0",fontWeight:"bold"}}>📋 Copia negli appunti</button></div>; })()}
              <div style={{fontSize:11,color:"#C8A96E",marginBottom:6,marginTop:4}}>⬆️ Importa da testo</div>
              <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder="Incolla il tuo backup..." rows={4} style={{...S.input,fontSize:10,fontFamily:"monospace",resize:"vertical"}}/>
              <button onClick={()=>importFromText(importText)} style={{...S.btn("#1a2a3a","#7EC8E3"),width:"100%",padding:"11px 0",fontWeight:"bold",marginTop:6}}>Ripristina dati</button>
              {importError&&<div style={{marginTop:8,fontSize:11,color:"#D94F5C"}}>{importError}</div>}
            </div>
            <div style={{background:"rgba(255,100,100,0.07)",border:"1px solid rgba(255,100,100,0.2)",borderRadius:11,padding:14,marginBottom:18}}>
              <div style={{fontSize:12,color:"#ff9999",marginBottom:10}}>🔍 Diagnostica storage</div>
              <button onClick={runDiag} style={{...S.btn("#3a1a1a","#ff9999"),width:"100%",padding:"10px 0",marginBottom:diagInfo?10:0}}>Controlla dati salvati</button>
              {diagInfo&&<div style={{fontSize:11,lineHeight:1.7}}>{Object.entries(diagInfo).map(([k,v])=><div key={k} style={{borderBottom:"1px solid rgba(255,255,255,0.06)",paddingBottom:4,marginBottom:4}}><div style={{color:"#999",fontSize:10}}>{k}</div><div style={{color:(v.includes("0 elementi")||v==="vuoto")?"#ff9999":"#4CAF8A",fontWeight:"bold"}}>{v}</div></div>)}</div>}
            </div>
            {DEFAULT_APARTMENTS.map(a=>(<div key={a.id} style={{marginBottom:12}}><div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginBottom:6,display:"flex",alignItems:"center",gap:6}}><div style={{width:9,height:9,borderRadius:2,background:apts.find(x=>x.id===a.id)?.color||"#888"}}/>{a.emoji} {a.name}</div><input value={aptNames[a.id]??a.name} onChange={e=>setAptNames(n=>({...n,[a.id]:e.target.value}))} style={S.input}/></div>))}
            <div style={{fontSize:10,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase",marginTop:16,marginBottom:10}}>Aliquote netto</div>
            <div style={{display:"flex",gap:8,marginBottom:6}}><div style={{flex:1}}><div style={{fontSize:10,color:"#999",marginBottom:5}}>Tasse (%)</div><input type="number" value={taxRate} onChange={e=>setTaxRate(e.target.value)} placeholder="21" min="0" max="100" style={S.input}/></div><div style={{flex:1}}><div style={{fontSize:10,color:"#999",marginBottom:5}}>Altri costi (%)</div><input type="number" value={costRate} onChange={e=>setCostRate(e.target.value)} placeholder="10" min="0" max="100" style={S.input}/></div></div>
            <div style={{padding:"9px 12px",background:"rgba(126,200,227,0.08)",borderRadius:8,fontSize:12,color:"#999",marginBottom:18}}>Netto: {100-(parseFloat(taxRate)||0)-(parseFloat(costRate)||0)}%</div>
            <div style={{background:"rgba(200,169,110,0.07)",border:"1px solid rgba(200,169,110,0.25)",borderRadius:11,padding:14,marginBottom:18}}>
              <div style={{fontSize:12,color:"#C8A96E",fontWeight:"bold",marginBottom:4}}>🔒 PIN di accesso modifiche</div>
              <div style={{fontSize:11,color:"#999",marginBottom:10}}>Chi non conosce il PIN può solo visualizzare. Lascia vuoto per disabilitare.</div>
              <input type="password" value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder={savedPin?"••••• (lascia vuoto per non cambiare)":"Imposta PIN..."} style={{...S.input,fontFamily:"monospace"}}/>
              {savedPin&&<div style={{fontSize:11,color:"#4CAF8A",marginTop:4}}>✓ PIN attivo — inserisci nuovo PIN per cambiarlo</div>}
            </div>
            <div style={{background:"rgba(126,200,227,0.07)",border:"1px solid rgba(126,200,227,0.25)",borderRadius:11,padding:14,marginBottom:18}}>
              <div style={{fontSize:12,color:"#7EC8E3",fontWeight:"bold",marginBottom:4}}>🤖 Chiave API Anthropic</div>
              <div style={{fontSize:11,color:"#999",marginBottom:10}}>Necessaria per caricare prenotazioni da foto/PDF. Ottienila su console.anthropic.com</div>
              <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-ant-..." style={{...S.input,fontFamily:"monospace",fontSize:12}}/>
              {apiKey&&<div style={{fontSize:11,color:"#4CAF8A",marginTop:4}}>✓ Chiave inserita</div>}
            </div>
            <div style={{display:"flex",gap:8}}><button onClick={()=>setView("calendar")} style={{...S.btn("#1a1a2e","#888"),flex:1,padding:"12px 0"}}>Annulla</button><button onClick={saveSettings} style={{...S.btn("#1a3a2a","#4CAF8A"),flex:2,padding:"12px 0",fontWeight:"bold"}}>Salva</button></div>
          </div>
        )}

        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(8,4,18,0.96)",backdropFilter:"blur(16px)",borderTop:"1px solid rgba(200,169,110,0.18)",display:"flex",justifyContent:"space-around",alignItems:"center",padding:"8px 0 14px",zIndex:100}}>
          <TabBtn label="Calendario" active={view==="calendar"} onClick={()=>setView("calendar")}>📅</TabBtn>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>{setEditId(null);setForm(emptyForm());setAiError(null);setView("add");}} style={{width:48,height:48,borderRadius:"50%",background:"#4CAF8A",border:"none",fontSize:22,color:"#1a0533",cursor:"pointer",boxShadow:"0 4px 18px rgba(76,175,138,0.4)"}}>+</button>
            <button onClick={()=>{setEditMId(null);setMForm(emptyMForm());setView("addMaint");}} style={{width:36,height:36,borderRadius:"50%",background:"#ffd580",border:"none",fontSize:16,color:"#1a0533",cursor:"pointer"}}>M</button>
          </div>
          <TabBtn label="Lista"       active={view==="list"}     onClick={()=>setView("list")}>📋</TabBtn>
          <TabBtn label="Statistiche" active={view==="stats"}    onClick={()=>setView("stats")}>📊</TabBtn>
          <TabBtn label="Opzioni"     active={view==="settings"} onClick={()=>setView("settings")}>⚙️</TabBtn>
        </div>
      </div>
    </div>
  );
}
