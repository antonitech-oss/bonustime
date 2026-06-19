"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase";

// ── WebCodecs types provided by TypeScript lib.dom.d.ts ───────────────────────

// ── H264 Annex-B decoder → canvas ─────────────────────────────────────────────
class H264Decoder {
  private dec: VideoDecoder | null = null;
  private buf  = new Uint8Array(0);
  private sps: Uint8Array | null = null;
  private pps: Uint8Array | null = null;
  private ready = false;
  private ts = 0;
  constructor(private canvas: HTMLCanvasElement) {}

  push(data: Uint8Array) {
    const merged = new Uint8Array(this.buf.length + data.length);
    merged.set(this.buf); merged.set(data, this.buf.length);
    this.buf = merged;
    const starts: { pos: number; scLen: number }[] = [];
    for (let i = 0; i < this.buf.length - 3; i++) {
      if (this.buf[i] === 0 && this.buf[i+1] === 0) {
        if (this.buf[i+2] === 0 && this.buf[i+3] === 1) { starts.push({pos:i,scLen:4}); i+=3; }
        else if (this.buf[i+2] === 1)                    { starts.push({pos:i,scLen:3}); i+=2; }
      }
    }
    if (starts.length < 2) return;
    for (let i = 0; i < starts.length - 1; i++) {
      const ns = starts[i].pos + starts[i].scLen;
      const ne = starts[i+1].pos;
      if (ne > ns) this.processNAL(this.buf.slice(ns, ne));
    }
    this.buf = this.buf.slice(starts[starts.length-1].pos);
  }

  private processNAL(nal: Uint8Array) {
    if (!nal.length) return;
    const nalType = nal[0] & 0x1F;
    if (nalType === 7) { this.sps = nal.slice(); return; }
    if (nalType === 8) { this.pps = nal.slice(); return; }
    if (nalType === 9 || nalType === 6) return;
    if (nalType !== 1 && nalType !== 5 && nalType !== 19) return;
    if (!this.ready && this.sps && this.pps) this.initDecoder();
    if (!this.dec || !this.ready) return;
    const isKey = nalType === 5 || nalType === 19;
    const sc = new Uint8Array([0,0,0,1]);
    let frameData: Uint8Array;
    if (isKey && this.sps && this.pps) {
      frameData = new Uint8Array(sc.length+this.sps.length+sc.length+this.pps.length+sc.length+nal.length);
      let o=0; frameData.set(sc,o); o+=sc.length; frameData.set(this.sps,o); o+=this.sps.length;
      frameData.set(sc,o); o+=sc.length; frameData.set(this.pps,o); o+=this.pps.length;
      frameData.set(sc,o); o+=sc.length; frameData.set(nal,o);
    } else {
      frameData = new Uint8Array(sc.length+nal.length);
      frameData.set(sc); frameData.set(nal,sc.length);
    }
    try {
      this.dec!.decode(new EncodedVideoChunk({ type:isKey?"key":"delta", timestamp:this.ts++*33333, data:frameData }));
    } catch { this.ready=false; }
  }

  private initDecoder() {
    try {
      this.dec = new VideoDecoder({
        output: (frame) => {
          const c=this.canvas; const ctx=c.getContext("2d");
          if (ctx) {
            if (c.width!==frame.displayWidth)  c.width=frame.displayWidth;
            if (c.height!==frame.displayHeight) c.height=frame.displayHeight;
            ctx.drawImage(frame as unknown as CanvasImageSource, 0, 0);
          }
          frame.close();
        },
        error: (e) => { console.warn("[H264]",e); this.ready=false; }
      });
      this.dec.configure({ codec:"avc1.42001E", optimizeForLatency:true, hardwareAcceleration:"prefer-hardware" });
      this.ready = true;
    } catch(e) { console.warn("[H264] WebCodecs n/a:",e); }
  }

  reset() {
    try { this.dec?.close(); } catch {}
    this.dec=null; this.ready=false; this.sps=null; this.pps=null;
    this.buf=new Uint8Array(0); this.ts=0;
  }
}

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Device { id:string; model:string; android:string; batteria:number; status:"connesso"|"errore"; screenWidth:number; screenHeight:number; }
interface LogEntry { time:string; msg:string; ok:boolean; }
interface AcPoint  { relX:number; relY:number; delay:number; }
interface Tag      { id:string; name:string; color:string; deviceIds:string[]; }
interface Cred     { deviceId:string; book:string; user:string; pass:string; }

const AGENT    = "http://localhost:8765";
const AGENT_WS = "ws://localhost:8765";
const RELAY_CHANNEL = "dispositivi-relay";
const battColor = (b:number)=>b>50?"#2dd4bf":b>20?"#f5a623":"#ef4444";
const TAG_COLORS = ["#8b5cf6","#2dd4bf","#f5a623","#ef4444","#3b82f6","#10b981"];
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));

const NavBack   = ()=><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>;
const NavHome   = ()=><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/></svg>;
const NavRecent = ()=><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;

const BOOK_APPS = [
  { label:"Goldbet",      pkg:"com.goldbet.app/.MainActivity" },
  { label:"Bet365",       pkg:"com.bet365.mobile/.MainActivity" },
  { label:"Snai",         pkg:"com.snai.app/.MainActivity" },
  { label:"Sisal",        pkg:"it.sisal.matchpoint/.MainActivity" },
  { label:"Planetwin",    pkg:"com.planetwin365.app/.MainActivity" },
  { label:"William Hill", pkg:"com.williamhill.sport/.MainActivity" },
  { label:"Betsson",      pkg:"com.betsson.android/.MainActivity" },
  { label:"Sportbet",     pkg:"com.sportbet.android/.MainActivity" },
];

// ── PhoneMirror ────────────────────────────────────────────────────────────────
function PhoneMirror({ deviceId, width, height, focused, onPointerDown, onPointerUp, onWheel, onCanvasMount, ripple, longPressIndicator, jpegSrc }: {
  deviceId:string; width:number; height:number; focused:boolean;
  onPointerDown:(e:React.PointerEvent<HTMLDivElement>)=>void;
  onPointerUp:(e:React.PointerEvent<HTMLDivElement>)=>void;
  onWheel:(e:React.WheelEvent<HTMLDivElement>)=>void;
  onCanvasMount:(id:string,canvas:HTMLCanvasElement|null)=>void;
  ripple?:{x:number;y:number}|null;
  longPressIndicator?:boolean;
  jpegSrc?:string;
}) {
  const setRef = useCallback((el:HTMLCanvasElement|null)=>{ onCanvasMount(deviceId,el); }, [deviceId,onCanvasMount]);
  return (
    <div style={{position:"relative",width,height,background:"#070710",borderRadius:12,overflow:"hidden",cursor:"default",
      outline:focused?"2px solid rgba(139,92,246,.7)":"none",outlineOffset:-2}}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onWheel={onWheel}>
      {jpegSrc
        ? <img src={jpegSrc} alt="" style={{display:"block",width:"100%",height:"100%",objectFit:"contain"}}/>
        : <canvas ref={setRef} width={540} height={960} style={{display:"block",width:"100%",height:"100%"}}/>
      }
      {ripple&&(
        <div style={{position:"absolute",left:`${ripple.x}%`,top:`${ripple.y}%`,width:28,height:28,
          marginLeft:-14,marginTop:-14,borderRadius:"50%",
          background:longPressIndicator?"rgba(245,166,35,.65)":"rgba(139,92,246,.55)",
          animation:"ripple .45s ease-out forwards",pointerEvents:"none"}}/>
      )}
      {focused&&(
        <div style={{position:"absolute",top:4,left:"50%",transform:"translateX(-50%)",
          fontSize:8,color:"rgba(139,92,246,.9)",background:"rgba(0,0,0,.5)",
          padding:"1px 6px",borderRadius:8,pointerEvents:"none"}}>⌨ KB</div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DispositiviPage() {
  const [devices, setDevices]         = useState<Device[]>([]);
  const [agentOnline, setAgentOnline] = useState(false);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [streams, setStreams]         = useState<Set<string>>(new Set());
  const [log, setLog]                 = useState<LogEntry[]>([]);
  const [zoom, setZoom]               = useState(1);
  const [hidden, setHidden]           = useState<Set<string>>(new Set());
  const [zoomDev, setZoomDev]         = useState<Record<string,number>>({});
  const [unlocking, setUnlocking]     = useState(false);
  const [cmdText, setCmdText]         = useState("");
  const [showLog, setShowLog]         = useState(false);
  const [ripples, setRipples]         = useState<Record<string,{x:number;y:number}|null>>({});

  // ─ Remote mode ─
  const [remoteMode, setRemoteMode]   = useState(false);
  const [jpegFrames, setJpegFrames]   = useState<Record<string,string>>({});
  const channelRef                    = useRef<ReturnType<typeof getSupabase>["channel"] extends (...args: any[]) => infer R ? R : never|null>(null as any);
  const wsRetryCount                  = useRef(0);

  // ─ Smart Tap ─
  const [smartTap, setSmartTap]       = useState(false);
  const [stLog, setStLog]             = useState<{devId:string;text:string;ok:boolean;delay?:number}[]>([]);

  // ─ Keyboard ─
  const [focusedDev, setFocusedDev]   = useState<string|null>(null);
  const [typeTextVal, setTypeTextVal] = useState("");

  // ─ Tags ─
  const [tags, setTags]               = useState<Tag[]>([]);
  const [tagEditing, setTagEditing]   = useState<string|null>(null);
  const [tagNewName, setTagNewName]   = useState("");

  // ─ Credentials ─
  const [credentials, setCredentials] = useState<Cred[]>([]);
  const [credPanel, setCredPanel]     = useState<string|null>(null);
  const [credEdit, setCredEdit]       = useState<{book:string;user:string;pass:string}|null>(null);

  // ─ Saldi ─
  type SaldiGrid = Record<string, Record<string, { saldo: number | null; stato: string }>>;
  const [saldiData, setSaldiData]         = useState<SaldiGrid>({});
  const [saldiLoading, setSaldiLoading]   = useState(false);
  const [saldiProgress, setSaldiProgress] = useState<{ device: string; book: string; step: number; total: number } | null>(null);
  const [saldiTs, setSaldiTs]             = useState<number | null>(null);
  const [saldiTotale, setSaldiTotale]     = useState<number>(0);

  // ─ Autoclicker ─
  const [acOpen, setAcOpen]           = useState(false);
  const [acPoints, setAcPoints]       = useState<AcPoint[]>([]);
  const [acRecording, setAcRecording] = useState(false);
  const [acRunning, setAcRunning]     = useState(false);
  const [acTicks, setAcTicks]         = useState(0);
  const [acStopMode, setAcStopMode]   = useState<"never"|"cycles"|"duration">("never");
  const [acMaxCycles, setAcMaxCycles] = useState(10);
  const [acMaxDuration, setAcMaxDuration] = useState(60);
  const [acSavedConfigs, setAcSavedConfigs] = useState<{name:string;points:AcPoint[];stopMode:string;maxCycles:number;maxDuration:number}[]>([]);
  const [acConfigName, setAcConfigName] = useState("");

  // ─ Refs ─
  const wsRef          = useRef<WebSocket|null>(null);
  const retryRef       = useRef<ReturnType<typeof setTimeout>|null>(null);
  const swipeStart     = useRef<{x:number;y:number;deviceId:string}|null>(null);
  const h264Decoders   = useRef<Map<string,H264Decoder>>(new Map());
  const canvasEls      = useRef<Map<string,HTMLCanvasElement>>(new Map());
  const longPressTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const isLongPressRef = useRef(false);
  const lastTapRef     = useRef<{time:number;relX:number;relY:number;devId:string}|null>(null);
  const acRecordingRef = useRef(false);
  const focusedDevRef  = useRef<string|null>(null);
  const smartTapRef    = useRef(false);
  const selectedRef    = useRef<Set<string>>(new Set());
  const connectedRef   = useRef<Device[]>([]);
  const remoteModeRef  = useRef(false);

  // Keep refs in sync
  useEffect(()=>{ selectedRef.current = selected; },[selected]);
  useEffect(()=>{ focusedDevRef.current = focusedDev; },[focusedDev]);
  useEffect(()=>{ acRecordingRef.current = acRecording; },[acRecording]);
  useEffect(()=>{ smartTapRef.current = smartTap; },[smartTap]);
  useEffect(()=>{ remoteModeRef.current = remoteMode; },[remoteMode]);

  // ─ Supabase load on mount ────────────────────────────────────────────────────
  useEffect(()=>{
    const sb = getSupabase();
    (async()=>{
      try {
        const [{ data: tData }, { data: cData }, { data: aData }] = await Promise.all([
          sb.from("bnt_tags").select("*").order("created_at"),
          sb.from("bnt_credentials").select("*"),
          sb.from("bnt_ac_configs").select("*").order("created_at"),
        ]);
        if(tData) setTags(tData.map((r:any)=>({id:r.id,name:r.name,color:r.color,deviceIds:r.device_ids||[]})));
        if(cData) setCredentials(cData.map((r:any)=>({deviceId:r.device_id,book:r.book,user:r.username,pass:r.password})));
        if(aData) setAcSavedConfigs(aData.map((r:any)=>({name:r.name,...r.config})));
      } catch(e){ console.warn("[Supabase] load error:",e); }
    })();
  },[]);

  const addLog = useCallback((msg:string,ok:boolean)=>{
    const t=new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    setLog(l=>[{time:t,msg,ok},...l.slice(0,299)]);
  },[]);

  // ── Supabase Realtime channel setup ──────────────────────────────────────────
  const setupRelayChannel = useCallback(()=>{
    const sb = getSupabase();
    if(channelRef.current) {
      try { sb.removeChannel(channelRef.current as any); } catch {}
    }
    const ch = sb.channel(RELAY_CHANNEL, { config:{ broadcast:{ self:false } } });
    ch
      .on("broadcast", { event:"status" }, ({ payload }:any)=>{
        if(payload?.type==="devices")       setDevices(payload.payload || []);
        if(payload?.type==="agent_online")  { setAgentOnline(true); addLog("agente remoto online",true); }
        if(payload?.type==="agent_offline") { setAgentOnline(false); addLog("agente remoto offline",false); }
        if(payload?.type==="exec_result")   payload.results?.forEach((r:any)=>addLog(`[${r.deviceId.slice(0,6)}] ${payload.label} ${r.ok?"✓":"✗"}`,r.ok));
        if(payload?.type==="tap_ok")        addLog(`tap(${Math.round(payload.x)},${Math.round(payload.y)})→${payload.deviceId?.slice(0,6)}`,true);
        if(payload?.type==="unlock_result") { setUnlocking(false); payload.results?.forEach((r:any)=>addLog(`unlock ${r.deviceId.slice(0,6)}: ${r.msg}`,r.ok)); }
        if(payload?.type==="ac_started")    { setAcRunning(true); setAcTicks(0); addLog("autoclicker avviato",true); }
        if(payload?.type==="ac_tick")       setAcTicks(payload.clickCount);
        if(payload?.type==="ac_stopped")    { setAcRunning(false); addLog(`autoclicker stop — ${payload.clickCount||0} tap`,true); }
        if(payload?.type==="smart_tap_ok")  { setStLog(l=>[{devId:payload.deviceId,text:payload.text,ok:true,delay:payload.delay},...l.slice(0,19)]); addLog(`✓ smart tap ${payload.deviceId?.slice(0,6)} "${payload.text}"`,true); }
        if(payload?.type==="smart_tap_miss"){ setStLog(l=>[{devId:payload.deviceId,text:payload.msg,ok:false},...l.slice(0,19)]); addLog(`⚠ smart tap ${payload.deviceId?.slice(0,6)}: ${payload.msg}`,false); }
        // ── Saldi ──
        if(payload?.type==="saldi_progress") {
          setSaldiProgress({ device: payload.deviceId, book: payload.book, step: payload.step, total: payload.total });
          addLog(`📖 lettura ${payload.book} su ${payload.deviceId?.slice(0,6)} (${payload.step}/${payload.total})`, true);
        }
        if(payload?.type==="saldi_result") {
          setSaldiLoading(false);
          setSaldiProgress(null);
          if(payload.ok) {
            setSaldiData(payload.risultati || {});
            setSaldiTotale(payload.totale ?? 0);
            setSaldiTs(payload.ts ?? Date.now() / 1000);
            addLog(`✓ saldi aggiornati — €${(payload.totale??0).toFixed(2)} | ok:${payload.n_ok} login:${payload.n_login} err:${payload.n_err}`, true);
          } else {
            addLog(`✗ saldi: ${payload.msg}`, false);
          }
        }
      })
      .on("broadcast", { event:"frame" }, ({ payload }:any)=>{
        if(payload?.deviceId && payload?.data) {
          setJpegFrames(f=>({...f,[payload.deviceId]:`data:image/jpeg;base64,${payload.data}`}));
        }
      })
      .subscribe((status:string)=>{
        if(status==="SUBSCRIBED") {
          setRemoteMode(true);
          remoteModeRef.current=true;
          addLog("📡 canale remoto attivo",true);
          // ping agent for status
          ch.send({ type:"broadcast", event:"cmd", payload:{ type:"ping" } });
        }
        if(status==="CHANNEL_ERROR"||status==="TIMED_OUT") {
          addLog("canale remoto errore",false);
        }
      });
    channelRef.current = ch as any;
  },[addLog]);

  const disconnectRelay = useCallback(()=>{
    const sb = getSupabase();
    if(channelRef.current) {
      try { sb.removeChannel(channelRef.current as any); } catch {}
      channelRef.current = null as any;
    }
    setRemoteMode(false);
    remoteModeRef.current=false;
    setAgentOnline(false);
    setJpegFrames({});
  },[]);

  const send = useCallback((data:object)=>{
    if(wsRef.current?.readyState===WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else if(channelRef.current && remoteModeRef.current) {
      (channelRef.current as any).send({ type:"broadcast", event:"cmd", payload:data });
    }
  },[]);

  const fetchHTTP = useCallback(async()=>{
    if(remoteModeRef.current) {
      // in remote mode, request device list via channel
      send({ type:"get_devices" });
      return;
    }
    try { const r=await fetch(`${AGENT}/devices`); setDevices(await r.json()); } catch {}
  },[send]);

  // ── Leggi saldi da tutti i book per i device selezionati ─────────────────────
  const BOOKS_PREFERITI = [
    "Goldbet","Bet365","PlanetWin","Betsson","Betfair",
    "Sisal","Snai","AdmiralBet","BetFlag","Eurobet","PayPal",
  ];

  const leggiSaldi = useCallback((devIds?: string[], books?: string[]) => {
    const ids   = devIds  ?? Array.from(selectedRef.current);
    const bks   = books   ?? BOOKS_PREFERITI;
    if (!ids.length) { addLog("Seleziona almeno un dispositivo", false); return; }
    setSaldiLoading(true);
    setSaldiProgress(null);
    addLog(`▶ lettura saldi: ${ids.length} device × ${bks.length} book…`, true);
    send({ type: "leggi_saldi", deviceIds: ids, books: bks });
  }, [send, addLog]);

  const onCanvasMount = useCallback((id:string,canvas:HTMLCanvasElement|null)=>{
    if(canvas){
      canvasEls.current.set(id,canvas);
      const ex=h264Decoders.current.get(id);
      if(ex) (ex as unknown as {canvas:HTMLCanvasElement}).canvas=canvas;
    } else {
      canvasEls.current.delete(id);
    }
  },[]);

  // WebSocket connection (local mode)
  useEffect(()=>{
    let mounted=true;
    const connect=()=>{
      if(!mounted) return;
      if(remoteModeRef.current) return; // don't retry WS if in remote mode
      const ws=new WebSocket(AGENT_WS);
      ws.binaryType="arraybuffer";
      wsRef.current=ws;
      ws.onopen=()=>{
        if(!mounted){ws.close();return;}
        wsRetryCount.current=0;
        setAgentOnline(true);
        fetchHTTP();
      };
      ws.onclose=()=>{
        if(!mounted) return;
        setAgentOnline(false); wsRef.current=null;
        setStreams(s=>{s.forEach(id=>{h264Decoders.current.get(id)?.reset();h264Decoders.current.delete(id);});return new Set();});
        setAcRunning(false);
        wsRetryCount.current++;
        if(wsRetryCount.current>=3 && !remoteModeRef.current) {
          // dopo 3 tentativi falliti, attiva modalità remota
          addLog("WS locale non disponibile — provo canale remoto…",false);
          setupRelayChannel();
          return;
        }
        retryRef.current=setTimeout(connect,5000);
      };
      ws.onerror=()=>ws.close();
      ws.onmessage=(e)=>{
        if(!mounted) return;
        if(e.data instanceof ArrayBuffer){
          const view=new Uint8Array(e.data);
          if(view.length<34||view[0]!==0xB0||view[1]!==0x0B) return;
          const devId=new TextDecoder().decode(view.slice(2,34)).replace(/\0/g,"").trim();
          const h264Data=view.slice(34);
          let dec=h264Decoders.current.get(devId);
          if(!dec){ const c=canvasEls.current.get(devId); if(!c) return; dec=new H264Decoder(c); h264Decoders.current.set(devId,dec); }
          dec.push(h264Data);
          return;
        }
        try {
          const msg=JSON.parse(e.data);
          if(msg.type==="devices")       setDevices(msg.payload);
          if(msg.type==="exec_result")   msg.results.forEach((r:{deviceId:string;ok:boolean})=>addLog(`[${r.deviceId.slice(0,6)}] ${msg.label} ${r.ok?"✓":"✗"}`,r.ok));
          if(msg.type==="tap_ok")        addLog(`tap(${Math.round(msg.x)},${Math.round(msg.y)})→${msg.deviceId.slice(0,6)}`,true);
          if(msg.type==="unlock_result") { setUnlocking(false); msg.results.forEach((r:{deviceId:string;ok:boolean;msg:string})=>addLog(`unlock ${r.deviceId.slice(0,6)}: ${r.msg}`,r.ok)); }
          if(msg.type==="ac_started")       { setAcRunning(true); setAcTicks(0); addLog("autoclicker avviato",true); }
          if(msg.type==="ac_tick")          { setAcTicks(msg.clickCount); }
          if(msg.type==="ac_stopped")       { setAcRunning(false); addLog(`autoclicker stop — ${msg.clickCount||0} tap`,true); }
          if(msg.type==="smart_tap_found")  { addLog(`🔍 trovato: "${msg.text||msg.className}"`,true); }
          if(msg.type==="smart_tap_ok")     { setStLog(l=>[{devId:msg.deviceId,text:msg.text,ok:true,delay:msg.delay},...l.slice(0,19)]); addLog(`✓ smart tap ${msg.deviceId?.slice(0,6)} "${msg.text}"`,true); }
          if(msg.type==="smart_tap_miss")   { setStLog(l=>[{devId:msg.deviceId,text:msg.msg,ok:false},...l.slice(0,19)]); addLog(`⚠ smart tap ${msg.deviceId?.slice(0,6)}: ${msg.msg}`,false); }
          if(msg.type==="smart_tap_error")  { addLog(`✗ smart tap: ${msg.msg}`,false); }
        } catch {}
      };
    };
    connect();
    return ()=>{
      mounted=false;
      if(retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
      h264Decoders.current.forEach(d=>d.reset());
    };
  },[addLog,fetchHTTP,setupRelayChannel]);

  // Update connectedRef on every devices/hidden change
  const connessi = devices.filter(d=>d.status==="connesso"&&!hidden.has(d.id));
  connectedRef.current = connessi;

  const getTargets = useCallback(()=>selected.size>0?[...selected]:connessi.map(d=>d.id),[selected,connessi]);

  // ─ Keyboard capture ──────────────────────────────────────────────────────────
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement;
      if(target.tagName==="INPUT"||target.tagName==="TEXTAREA"||target.tagName==="SELECT") return;
      const dev=focusedDevRef.current;
      if(!dev) return;
      const sel=selectedRef.current;
      const targets=sel.size>0?[...sel]:[dev];
      const keyMap:Record<string,string>={
        Backspace:"KEYCODE_DEL",Enter:"KEYCODE_ENTER",Tab:"KEYCODE_TAB",Escape:"KEYCODE_BACK",
        ArrowUp:"KEYCODE_DPAD_UP",ArrowDown:"KEYCODE_DPAD_DOWN",
        ArrowLeft:"KEYCODE_DPAD_LEFT",ArrowRight:"KEYCODE_DPAD_RIGHT",
        Delete:"KEYCODE_FORWARD_DEL"," ":"KEYCODE_SPACE",
      };
      if(e.ctrlKey&&e.key==="v"){
        e.preventDefault();
        navigator.clipboard.readText().then(text=>{
          if(!text) return;
          if(wsRef.current?.readyState===WebSocket.OPEN) wsRef.current.send(JSON.stringify({type:"type_text",deviceIds:targets,text}));
          else if(channelRef.current&&remoteModeRef.current) (channelRef.current as any).send({type:"broadcast",event:"cmd",payload:{type:"type_text",deviceIds:targets,text}});
        }).catch(()=>{});
        return;
      }
      if(keyMap[e.key]){
        e.preventDefault();
        if(wsRef.current?.readyState===WebSocket.OPEN) wsRef.current.send(JSON.stringify({type:"keyevent_multi",deviceIds:targets,keycode:keyMap[e.key]}));
        else if(channelRef.current&&remoteModeRef.current) (channelRef.current as any).send({type:"broadcast",event:"cmd",payload:{type:"keyevent_multi",deviceIds:targets,keycode:keyMap[e.key]}});
        return;
      }
      if(e.key.length===1&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
        e.preventDefault();
        if(wsRef.current?.readyState===WebSocket.OPEN) wsRef.current.send(JSON.stringify({type:"type_text",deviceIds:targets,text:e.key}));
        else if(channelRef.current&&remoteModeRef.current) (channelRef.current as any).send({type:"broadcast",event:"cmd",payload:{type:"type_text",deviceIds:targets,text:e.key}});
      }
    };
    document.addEventListener("keydown",handler);
    return()=>document.removeEventListener("keydown",handler);
  },[]);

  // ─ Streams ───────────────────────────────────────────────────────────────────
  const toggleStream=(id:string)=>{
    if(streams.has(id)){
      if(remoteMode) send({type:"stop_jpeg",deviceId:id});
      else { send({type:"stop_h264",deviceId:id}); h264Decoders.current.get(id)?.reset(); h264Decoders.current.delete(id); }
      setStreams(s=>{const n=new Set(s);n.delete(id);return n;});
      if(remoteMode) setJpegFrames(f=>{const n={...f};delete n[id];return n;});
    } else {
      if(remoteMode) {
        send({type:"start_jpeg",deviceId:id});
      } else {
        const canvas=canvasEls.current.get(id);
        if(canvas) h264Decoders.current.set(id,new H264Decoder(canvas));
        send({type:"start_h264",deviceId:id});
      }
      setStreams(s=>new Set(s).add(id));
      addLog(`Stream: ${id.slice(0,8)}`,true);
    }
  };

  const startAllStreams=()=>{
    connessi.forEach(d=>{
      if(!streams.has(d.id)){
        if(remoteMode) {
          send({type:"start_jpeg",deviceId:d.id});
        } else {
          const canvas=canvasEls.current.get(d.id);
          if(canvas) h264Decoders.current.set(d.id,new H264Decoder(canvas));
          send({type:"start_h264",deviceId:d.id});
        }
      }
    });
    setStreams(new Set(connessi.map(d=>d.id)));
    addLog(`Stream ×${connessi.length}`,true);
  };

  // ─ Actions ───────────────────────────────────────────────────────────────────
  const sblocca=()=>{
    const t=getTargets(); setUnlocking(true);
    send({type:"unlock",deviceIds:t,pin:"111111"});
    addLog(`sblocco ${t.length}…`,true);
    setTimeout(()=>setUnlocking(false),6000);
  };

  const eseguiCmd=(cmd:string,label:string,t?:string[])=>send({type:"exec",deviceIds:t??getTargets(),command:cmd,label});
  const sendKey  =(key:string,devId?:string)=>send({type:"exec",deviceIds:devId?[devId]:getTargets(),command:`input keyevent ${key}`,label:key});

  const sendWifi=(on:boolean)=>{send({type:"wifi",deviceIds:getTargets(),on});addLog(`wifi ${on?"on":"off"} ×${getTargets().length}`,true);};
  const sendAirplane=(on:boolean)=>{send({type:"airplane",deviceIds:getTargets(),on});addLog(`aereo ${on?"on":"off"} ×${getTargets().length}`,true);};
  const sendRotation=(landscape:boolean)=>{send({type:"rotation",deviceIds:getTargets(),landscape});addLog(`rot ${landscape?"land":"port"} ×${getTargets().length}`,true);};
  const sendClearCookies=()=>{send({type:"clear_cookies",deviceIds:getTargets()});addLog(`clear cookies ×${getTargets().length}`,true);};
  const sendTypeText=(text:string)=>{if(!text.trim())return;send({type:"type_text",deviceIds:getTargets(),text});addLog(`text: ${text.slice(0,15)}`,true);};

  const sendCredentials=async(devId:string,user:string,pass:string)=>{
    await sleep(0);
    send({type:"type_text",deviceIds:[devId],text:user});
    await sleep(400);
    send({type:"keyevent_multi",deviceIds:[devId],keycode:"KEYCODE_TAB"});
    await sleep(300);
    send({type:"type_text",deviceIds:[devId],text:pass});
    await sleep(300);
    send({type:"keyevent_multi",deviceIds:[devId],keycode:"KEYCODE_ENTER"});
    addLog(`cred inviato: ${devId.slice(0,8)}`,true);
  };

  // ─ Pointer handlers with long press + double tap ──────────────────────────────
  const handlePointerDown=useCallback((e:React.PointerEvent<HTMLDivElement>,dev:Device)=>{
    if(e.button!==0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect=e.currentTarget.getBoundingClientRect();
    const relX=(e.clientX-rect.left)/rect.width;
    const relY=(e.clientY-rect.top)/rect.height;
    swipeStart.current={x:relX,y:relY,deviceId:dev.id};
    isLongPressRef.current=false;
    if(longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current=setTimeout(()=>{
      if(!swipeStart.current||swipeStart.current.deviceId!==dev.id) return;
      isLongPressRef.current=true;
      const start=swipeStart.current;
      const targets=selectedRef.current.size>0?connectedRef.current.filter(d=>selectedRef.current.has(d.id)):[dev];
      targets.forEach(d=>{
        const payload={type:"longpress",deviceId:d.id,x:Math.round(start.x*d.screenWidth),y:Math.round(start.y*d.screenHeight),duration:600};
        if(wsRef.current?.readyState===WebSocket.OPEN) wsRef.current.send(JSON.stringify(payload));
        else if(channelRef.current&&remoteModeRef.current) (channelRef.current as any).send({type:"broadcast",event:"cmd",payload});
      });
      setRipples(r=>({...r,[dev.id]:{x:relX*100,y:relY*100}}));
      setTimeout(()=>setRipples(r=>({...r,[dev.id]:null})),700);
      addLog(`longpress ×${targets.length}`,true);
    },400);
    setFocusedDev(dev.id);
  },[addLog]);

  const handlePointerUp=useCallback((e:React.PointerEvent<HTMLDivElement>,dev:Device)=>{
    if(longPressTimer.current){ clearTimeout(longPressTimer.current); longPressTimer.current=null; }
    const start=swipeStart.current;
    if(!start) return;
    swipeStart.current=null;
    if(isLongPressRef.current){ isLongPressRef.current=false; return; }

    const rect=e.currentTarget.getBoundingClientRect();
    const relX=(e.clientX-rect.left)/rect.width;
    const relY=(e.clientY-rect.top)/rect.height;
    const dx=relX-start.x, dy=relY-start.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    const targets=selectedRef.current.size>0?connectedRef.current.filter(d=>selectedRef.current.has(d.id)):[dev];

    if(dist<0.025){
      if(acRecordingRef.current){
        setAcPoints(p=>[...p,{relX,relY,delay:1}]);
        setRipples(r=>({...r,[dev.id]:{x:relX*100,y:relY*100}}));
        setTimeout(()=>setRipples(r=>({...r,[dev.id]:null})),400);
        addLog(`punto AC #${acPoints.length+1} registrato`,true);
        return;
      }
      if(smartTapRef.current){
        setRipples(r=>({...r,[dev.id]:{x:relX*100,y:relY*100}}));
        setTimeout(()=>setRipples(r=>({...r,[dev.id]:null})),600);
        const allTargets=selectedRef.current.size>0?[...selectedRef.current]:connectedRef.current.map(d=>d.id);
        send({type:"smart_tap",deviceId:dev.id,x:Math.round(relX*dev.screenWidth),y:Math.round(relY*dev.screenHeight),deviceIds:allTargets});
        addLog(`🔍 smart tap → ${allTargets.length} dev`,true);
        return;
      }
      const now=Date.now();
      const last=lastTapRef.current;
      const isDouble=last&&last.devId===dev.id&&now-last.time<300&&Math.abs(relX-last.relX)<0.06&&Math.abs(relY-last.relY)<0.06;
      if(isDouble){
        lastTapRef.current=null;
        targets.forEach(d=>{ send({type:"double_tap",deviceId:d.id,x:Math.round(relX*d.screenWidth),y:Math.round(relY*d.screenHeight)}); });
        addLog(`double tap ×${targets.length}`,true);
      } else {
        lastTapRef.current={time:now,relX,relY,devId:dev.id};
        setRipples(r=>({...r,[dev.id]:{x:relX*100,y:relY*100}}));
        setTimeout(()=>setRipples(r=>({...r,[dev.id]:null})),500);
        targets.forEach(d=>{ send({type:"tap",deviceId:d.id,x:Math.round(relX*d.screenWidth),y:Math.round(relY*d.screenHeight)}); });
      }
    } else {
      targets.forEach(d=>{
        send({type:"swipe",deviceId:d.id,x1:Math.round(start.x*d.screenWidth),y1:Math.round(start.y*d.screenHeight),x2:Math.round(relX*d.screenWidth),y2:Math.round(relY*d.screenHeight),dur:Math.round(dist*800+200)});
      });
      addLog(`swipe ×${targets.length}`,true);
    }
  },[addLog,send]);

  const handleWheel=useCallback((e:React.WheelEvent<HTMLDivElement>,dev:Device)=>{
    e.preventDefault();
    const targets=selectedRef.current.size>0?connectedRef.current.filter(d=>selectedRef.current.has(d.id)):[dev];
    const dy=e.deltaY;
    targets.forEach(d=>{
      const cx=Math.round(d.screenWidth/2);
      const sy=dy>0?Math.round(d.screenHeight*.72):Math.round(d.screenHeight*.28);
      const ey=dy>0?Math.round(d.screenHeight*.28):Math.round(d.screenHeight*.72);
      const dur=Math.min(Math.max(Math.round(Math.abs(dy)*.4),180),600);
      send({type:"swipe",deviceId:d.id,x1:cx,y1:sy,x2:cx,y2:ey,dur});
    });
  },[send]);

  // ─ Autoclicker ───────────────────────────────────────────────────────────────
  const startAc=()=>{
    if(!acPoints.length) return;
    const targets=getTargets();
    const dims=connessi.reduce((a,d)=>({...a,[d.id]:{w:d.screenWidth,h:d.screenHeight}}),{} as Record<string,{w:number;h:number}>);
    send({type:"ac_start",config:{deviceIds:targets,points:acPoints,stopMode:acStopMode,maxCycles:acMaxCycles,maxDuration:acMaxDuration,deviceDimensions:dims}});
  };
  const stopAc=()=>{ send({type:"ac_stop"}); setAcRunning(false); };
  const saveAcConfig=async()=>{
    if(!acConfigName.trim()) return;
    const cfg={name:acConfigName,points:acPoints,stopMode:acStopMode,maxCycles:acMaxCycles,maxDuration:acMaxDuration};
    setAcSavedConfigs(s=>[...s.filter(c=>c.name!==acConfigName),cfg]);
    setAcConfigName("");
    addLog(`config AC "${cfg.name}" salvata`,true);
    await getSupabase().from("bnt_ac_configs").upsert({name:cfg.name,config:{points:cfg.points,stopMode:cfg.stopMode,maxCycles:cfg.maxCycles,maxDuration:cfg.maxDuration}},{onConflict:"name"});
  };
  const loadAcConfig=(name:string)=>{
    const cfg=acSavedConfigs.find(c=>c.name===name);
    if(!cfg) return;
    setAcPoints(cfg.points);
    setAcStopMode(cfg.stopMode as "never"|"cycles"|"duration");
    setAcMaxCycles(cfg.maxCycles);
    setAcMaxDuration(cfg.maxDuration);
  };

  // ─ Tags ──────────────────────────────────────────────────────────────────────
  const createTag=async()=>{
    const n=tagNewName.trim(); if(!n) return;
    const tag:Tag={id:Date.now().toString(),name:n,color:TAG_COLORS[tags.length%TAG_COLORS.length],deviceIds:[...selected]};
    setTags(t=>[...t,tag]); setTagNewName("");
    addLog(`tag "${n}" creato (${tag.deviceIds.length} dev)`,true);
    await getSupabase().from("bnt_tags").insert({id:tag.id,name:tag.name,color:tag.color,device_ids:tag.deviceIds});
  };
  const deleteTag=async(id:string)=>{
    setTags(t=>t.filter(x=>x.id!==id));
    await getSupabase().from("bnt_tags").delete().eq("id",id);
  };
  const selectTag=(tag:Tag)=>setSelected(new Set(tag.deviceIds.filter(id=>connessi.some(d=>d.id===id))));

  // ─ Credentials ───────────────────────────────────────────────────────────────
  const getDevCreds=(devId:string)=>credentials.filter(c=>c.deviceId===devId);
  const upsertCred=async(devId:string,book:string,user:string,pass:string)=>{
    setCredentials(c=>{const n=c.filter(x=>!(x.deviceId===devId&&x.book===book));return [...n,{deviceId:devId,book,user,pass}];});
    await getSupabase().from("bnt_credentials").upsert({device_id:devId,book,username:user,password:pass},{onConflict:"device_id,book"});
  };
  const deleteCred=async(devId:string,book:string)=>{
    setCredentials(c=>c.filter(x=>!(x.deviceId===devId&&x.book===book)));
    await getSupabase().from("bnt_credentials").delete().eq("device_id",devId).eq("book",book);
  };

  // ─ Misc ─────────────────────────────────────────────────────────────────────
  const devZoom=(id:string)=>(zoomDev[id]??1)*zoom;
  const phoneBaseW=220, phoneBaseH=390;

  return (
    <AppShell>
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
          style={agentOnline
            ?{background:"rgba(45,212,191,.12)",color:"#2dd4bf",border:"1px solid rgba(45,212,191,.25)"}
            :{background:"rgba(245,166,35,.12)",color:"#f5a623",border:"1px solid rgba(245,166,35,.25)"}}>
          <span className="w-1.5 h-1.5 rounded-full" style={{background:agentOnline?"#2dd4bf":"#f5a623"}}/>
          {agentOnline?`${connessi.length} dispositivi`:"Agente offline"}
        </span>

        {/* Remote mode badge + toggle */}
        {remoteMode
          ? <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
              style={{background:"rgba(99,149,255,.12)",color:"#6395ff",border:"1px solid rgba(99,149,255,.25)"}}>
              📡 Remoto
            </span>
          : null
        }
        <button
          onClick={()=>{ if(remoteMode) disconnectRelay(); else setupRelayChannel(); }}
          className="text-xs px-3 py-1.5 rounded-xl font-medium transition-all"
          style={remoteMode
            ?{background:"rgba(239,68,68,.12)",color:"#ef4444",border:"1px solid rgba(239,68,68,.25)"}
            :{background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.45)",border:"1px solid rgba(255,255,255,.1)"}}>
          {remoteMode?"✕ Disconnetti remoto":"📡 Connetti remoto"}
        </button>

        <div className="flex items-center gap-2 bg-bg-hover rounded-xl px-3 py-1.5">
          <span className="text-xs text-txt-secondary">🔍</span>
          <input type="range" min="0.4" max="2.5" step="0.05" value={zoom}
            onChange={e=>setZoom(parseFloat(e.target.value))} className="w-20 accent-violet cursor-pointer"/>
          <span className="text-xs text-txt-secondary w-8 tabular-nums">{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(1)} className="text-[10px] text-txt-secondary hover:text-violet">↺</button>
        </div>

        <button onClick={()=>setSelected(s=>s.size===0?new Set(connessi.map(d=>d.id)):new Set())}
          className="btn btn-ghost text-xs px-3 py-1.5">
          {selected.size===0?"Sel. tutti":`${selected.size} sel. ✕`}
        </button>
        <button onClick={sblocca} disabled={!agentOnline||unlocking} className="btn btn-lime text-xs px-4 py-1.5" style={unlocking?{opacity:.6}:{}}>
          {unlocking?"⏳ Sblocco…":"🔓 Sblocca"}
        </button>
        <button onClick={()=>{send({type:"lock",deviceIds:getTargets()});addLog(`lock ×${getTargets().length}`,true);}} disabled={!agentOnline}
          className="btn btn-ghost text-xs px-4 py-1.5">🔒 Blocca</button>
        <button onClick={startAllStreams} disabled={!agentOnline} className="btn btn-ghost text-xs px-3 py-1.5">▶ Tutti</button>
        <button onClick={()=>sendKey("KEYCODE_BACK")}       className="btn btn-ghost px-3 py-1.5"><NavBack/></button>
        <button onClick={()=>sendKey("KEYCODE_HOME")}       className="btn btn-ghost px-3 py-1.5"><NavHome/></button>
        <button onClick={()=>sendKey("KEYCODE_APP_SWITCH")} className="btn btn-ghost px-3 py-1.5"><NavRecent/></button>
        <button onClick={fetchHTTP} className="btn btn-ghost text-xs px-3 py-1.5">↻</button>
        <button onClick={()=>setShowLog(s=>!s)} className="btn btn-ghost text-xs px-3 py-1.5">≡ Log</button>
        <button
          onClick={()=>{ setSmartTap(s=>!s); smartTapRef.current=!smartTap; setStLog([]); }}
          className="text-xs px-3 py-1.5 rounded-xl font-medium transition-all"
          style={smartTap
            ?{background:"rgba(45,212,191,.18)",color:"#2dd4bf",border:"1px solid rgba(45,212,191,.4)"}
            :{background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.45)",border:"1px solid rgba(255,255,255,.1)"}}>
          {smartTap?"🔍 Smart ON":"🔍 Smart"}
        </button>
        {focusedDev&&<span className="text-xs px-2 py-1 rounded-lg" style={{background:"rgba(139,92,246,.15)",color:"#8b5cf6",border:"1px solid rgba(139,92,246,.3)"}}>⌨ {focusedDev.slice(0,8)}</span>}
        {hidden.size>0&&<button onClick={()=>setHidden(new Set())} className="btn btn-ghost text-xs px-3 py-1.5 text-acc-yellow">+{hidden.size} nascosti</button>}
      </div>

      {/* ── Azioni rapide ── */}
      {agentOnline&&(
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span className="text-xs text-txt-secondary shrink-0">Azioni:</span>
          <button onClick={()=>sendWifi(true)}       className="btn btn-ghost text-xs px-2.5 py-1">📶 WiFi+</button>
          <button onClick={()=>sendWifi(false)}      className="btn btn-ghost text-xs px-2.5 py-1">📶 WiFi−</button>
          <button onClick={()=>sendAirplane(true)}   className="btn btn-ghost text-xs px-2.5 py-1">✈️ Aereo+</button>
          <button onClick={()=>sendAirplane(false)}  className="btn btn-ghost text-xs px-2.5 py-1">✈️ Aereo−</button>
          <button onClick={()=>sendRotation(false)}  className="btn btn-ghost text-xs px-2.5 py-1">📱 Vert.</button>
          <button onClick={()=>sendRotation(true)}   className="btn btn-ghost text-xs px-2.5 py-1">📱 Oriz.</button>
          <button onClick={sendClearCookies}         className="btn btn-ghost text-xs px-2.5 py-1">🍪 Clear</button>
          <button onClick={()=>sendKey("KEYCODE_POWER")} className="btn btn-ghost text-xs px-2.5 py-1">⚡</button>
        </div>
      )}

      {/* ── Type text ── */}
      {agentOnline&&(
        <div className="flex gap-2 mb-3">
          <input className="input font-mono text-xs flex-1" placeholder="Testo su dispositivi selezionati…"
            value={typeTextVal} onChange={e=>setTypeTextVal(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"){sendTypeText(typeTextVal);setTypeTextVal("");}}}/>
          <button className="btn btn-ghost text-xs px-3" onClick={()=>{sendTypeText(typeTextVal);setTypeTextVal("");}}>⌨ Invia</button>
        </div>
      )}

      {/* ── Book apps ── */}
      {agentOnline&&connessi.length>0&&(
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
          <span className="text-xs text-txt-secondary shrink-0">Apri:</span>
          {BOOK_APPS.map(a=>(
            <button key={a.label}
              onClick={()=>{eseguiCmd(`am start -n ${a.pkg}`,`Apri ${a.label}`);addLog(`Apri ${a.label}×${getTargets().length}`,true);}}
              className="btn btn-ghost text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">{a.label}</button>
          ))}
        </div>
      )}

      {/* ── Tags ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-txt-secondary shrink-0">Tag:</span>
        {tags.map(tag=>(
          <div key={tag.id} className="flex items-center gap-1">
            <button onClick={()=>selectTag(tag)}
              className="text-xs px-2.5 py-1 rounded-lg font-medium transition-opacity hover:opacity-90"
              style={{background:`${tag.color}22`,color:tag.color,border:`1px solid ${tag.color}44`}}>
              {tag.name} <span style={{opacity:.7}}>({tag.deviceIds.filter(id=>connessi.some(d=>d.id===id)).length})</span>
            </button>
            <button onClick={()=>deleteTag(tag.id)} className="text-[10px] text-txt-secondary hover:text-acc-red" title="Elimina tag">×</button>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <input className="input text-xs py-1 px-2 w-24" placeholder="Nuovo tag…"
            value={tagNewName} onChange={e=>setTagNewName(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter") createTag();}}/>
          <button onClick={createTag} className="btn btn-ghost text-xs px-2 py-1" title="Crea tag con dispositivi selezionati">+</button>
        </div>
      </div>

      {/* ── Griglia telefoni ── */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 items-start" style={{minWidth:"max-content"}}>
          {!agentOnline&&(
            <div className="card card-static p-6 text-center" style={{width:220}}>
              <div className="text-xl mb-2">⚠️</div>
              <div className="text-xs text-txt-secondary mb-1">Avvia AVVIA_AGENTE.bat</div>
              <div className="text-[10px] text-txt-secondary opacity-60">oppure clicca "Connetti remoto"</div>
            </div>
          )}
          {connessi.map((device,idx)=>{
            const isSel=selected.has(device.id);
            const isStream=streams.has(device.id);
            const isFocused=focusedDev===device.id;
            const dz=devZoom(device.id);
            const W=Math.round(phoneBaseW*dz);
            const H=Math.round(phoneBaseH*dz);
            const devCreds=getDevCreds(device.id);
            const jpegSrc=remoteMode&&isStream?jpegFrames[device.id]:undefined;

            return (
              <div key={device.id} style={{
                position:"relative",width:W,height:H,borderRadius:13,overflow:"hidden",
                border:isSel?"2px solid rgba(139,92,246,.75)":"1px solid rgba(255,255,255,.09)",
                boxShadow:isSel?"0 0 20px rgba(139,92,246,.3)":"0 2px 12px rgba(0,0,0,.4)",
                background:"#070710",flexShrink:0,
              }}>
                <PhoneMirror
                  deviceId={device.id} width={W} height={H} focused={isFocused}
                  onCanvasMount={onCanvasMount} ripple={ripples[device.id]}
                  onPointerDown={e=>handlePointerDown(e,device)}
                  onPointerUp={e=>handlePointerUp(e,device)}
                  onWheel={e=>handleWheel(e,device)}
                  jpegSrc={jpegSrc}
                />

                {/* Overlay top */}
                <div style={{position:"absolute",top:0,left:0,right:0,display:"flex",alignItems:"center",
                  justifyContent:"space-between",padding:"4px 5px",
                  background:"linear-gradient(to bottom,rgba(0,0,0,.65) 0%,transparent 100%)",pointerEvents:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:4,pointerEvents:"auto"}}>
                    <button onClick={()=>setSelected(s=>{const n=new Set(s);n.has(device.id)?n.delete(device.id):n.add(device.id);return n;})}
                      style={{width:20,height:20,borderRadius:5,fontSize:10,fontWeight:700,display:"flex",
                        alignItems:"center",justifyContent:"center",flexShrink:0,
                        background:isSel?"#8b5cf6":"rgba(255,255,255,.18)",color:"#fff",border:"none",cursor:"pointer"}}>
                      {String(idx+1).padStart(2,"0")}
                    </button>
                    <span style={{fontSize:9,color:"rgba(255,255,255,.6)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:60}}>{device.model}</span>
                    <button onClick={()=>setCredPanel(credPanel===device.id?null:device.id)}
                      title="Credenziali"
                      style={{background:devCreds.length?"rgba(45,212,191,.25)":"rgba(255,255,255,.12)",
                        border:"none",cursor:"pointer",color:devCreds.length?"#2dd4bf":"rgba(255,255,255,.5)",
                        fontSize:9,padding:"1px 4px",borderRadius:4,lineHeight:1.4}}>
                      🔑{devCreds.length>0?devCreds.length:""}
                    </button>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:2,pointerEvents:"auto"}}>
                    <span style={{fontSize:9,color:battColor(device.batteria),marginRight:2}}>{device.batteria}%</span>
                    <button onClick={()=>setZoomDev(z=>({...z,[device.id]:Math.min((z[device.id]??1)+.25,2.5)}))}
                      style={{width:18,height:18,borderRadius:4,fontSize:11,background:"rgba(255,255,255,.15)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                    <button onClick={()=>setZoomDev(z=>({...z,[device.id]:Math.max((z[device.id]??1)-.25,.4)}))}
                      style={{width:18,height:18,borderRadius:4,fontSize:11,background:"rgba(255,255,255,.15)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                    <button onClick={()=>{setHidden(s=>new Set(s).add(device.id));if(isStream){send({type:"stop_h264",deviceId:device.id});h264Decoders.current.get(device.id)?.reset();}}}
                      style={{width:18,height:18,borderRadius:4,fontSize:11,background:"rgba(239,68,68,.25)",color:"#ef4444",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                  </div>
                </div>

                {/* Overlay bottom nav */}
                <div style={{position:"absolute",bottom:0,left:0,right:0,display:"flex",alignItems:"center",
                  justifyContent:"center",gap:20,padding:"5px 0",
                  background:"linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 100%)"}}>
                  <button onClick={()=>sendKey("KEYCODE_BACK",       selected.size>0?undefined:device.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.75)",padding:3,display:"flex"}}><NavBack/></button>
                  <button onClick={()=>sendKey("KEYCODE_HOME",       selected.size>0?undefined:device.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.75)",padding:3,display:"flex"}}><NavHome/></button>
                  <button onClick={()=>sendKey("KEYCODE_APP_SWITCH", selected.size>0?undefined:device.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.75)",padding:3,display:"flex"}}><NavRecent/></button>
                  <button onClick={()=>toggleStream(device.id)}
                    style={{background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,padding:3,color:isStream?"#ef4444":"#2dd4bf"}}>
                    {isStream?"⏹":"▶"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Credential Panel ── */}
      {credPanel&&(()=>{
        const dev=connessi.find(d=>d.id===credPanel);
        if(!dev) return null;
        const devCreds=getDevCreds(dev.id);
        return (
          <div className="card p-3 mt-2 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="label-tiny">🔑 Credenziali — {dev.model}</span>
              <button onClick={()=>{setCredPanel(null);setCredEdit(null);}} className="text-xs text-txt-secondary hover:text-acc-red">✕</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {devCreds.map(c=>(
                <div key={c.book} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 text-txt-secondary">{c.book}</span>
                  <span className="flex-1 font-mono text-[11px] text-txt-primary truncate">{c.user}</span>
                  <span className="flex-1 font-mono text-[11px] text-txt-secondary">{"•".repeat(Math.min(c.pass.length,10))}</span>
                  <button onClick={()=>sendCredentials(dev.id,c.user,c.pass)}
                    className="btn btn-ghost text-[10px] px-2 py-0.5">▶ Invia</button>
                  <button onClick={()=>setCredEdit({book:c.book,user:c.user,pass:c.pass})}
                    className="text-[10px] text-txt-secondary hover:text-violet">✎</button>
                  <button onClick={()=>deleteCred(dev.id,c.book)}
                    className="text-[10px] text-txt-secondary hover:text-acc-red">✕</button>
                </div>
              ))}
              {(()=>{
                const ce=credEdit;
                const isNew=!ce;
                return (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-bord/20">
                    <input className="input text-xs py-1 px-2 w-20" placeholder="Book"
                      defaultValue={ce?.book??""}
                      id={`cred-book-${dev.id}`}/>
                    <input className="input text-xs py-1 px-2 flex-1" placeholder="Username"
                      defaultValue={ce?.user??""}
                      id={`cred-user-${dev.id}`}/>
                    <input className="input text-xs py-1 px-2 flex-1" type="password" placeholder="Password"
                      defaultValue={ce?.pass??""}
                      id={`cred-pass-${dev.id}`}/>
                    <button className="btn btn-lime text-[10px] px-2 py-1" onClick={()=>{
                      const b=(document.getElementById(`cred-book-${dev.id}`) as HTMLInputElement)?.value.trim();
                      const u=(document.getElementById(`cred-user-${dev.id}`) as HTMLInputElement)?.value.trim();
                      const p=(document.getElementById(`cred-pass-${dev.id}`) as HTMLInputElement)?.value.trim();
                      if(b&&u&&p){ upsertCred(dev.id,b,u,p); setCredEdit(null); }
                    }}>
                      {isNew?"+ Aggiungi":"✓ Salva"}
                    </button>
                    {!isNew&&<button onClick={()=>setCredEdit(null)} className="text-[10px] text-txt-secondary">✕</button>}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* ── Smart Tap log ── */}
      {smartTap&&stLog.length>0&&(
        <div className="card p-2 mt-2 mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="label-tiny">🔍 Smart Tap — ultimo giro</span>
            <button onClick={()=>setStLog([])} className="text-[10px] text-txt-secondary hover:text-acc-red">Clear</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stLog.map((e,i)=>(
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg font-mono"
                style={e.ok
                  ?{background:"rgba(45,212,191,.12)",color:"#2dd4bf",border:"1px solid rgba(45,212,191,.2)"}
                  :{background:"rgba(239,68,68,.12)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)"}}>
                {e.devId.slice(0,6)}{e.delay?` +${(e.delay/1000).toFixed(1)}s`:""} {e.ok?"✓":"⚠"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Autoclicker panel ── */}
      {agentOnline&&(
        <div className="card mt-2 mb-3">
          <button onClick={()=>setAcOpen(s=>!s)}
            className="flex items-center justify-between w-full p-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">🤖 Autoclicker</span>
              {acRunning&&<span className="text-xs px-2 py-0.5 rounded-full" style={{background:"rgba(45,212,191,.15)",color:"#2dd4bf"}}>● {acTicks} tap</span>}
              {acRecording&&<span className="text-xs px-2 py-0.5 rounded-full" style={{background:"rgba(245,166,35,.15)",color:"#f5a623"}}>● REC {acPoints.length} punti</span>}
            </div>
            <span className="text-txt-secondary text-xs">{acOpen?"▲":"▼"}</span>
          </button>

          {acOpen&&(
            <div className="px-3 pb-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="label-tiny">Punti click ({acPoints.length}/10)</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={()=>{ setAcRecording(r=>!r); acRecordingRef.current=!acRecording; }}
                      className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={acRecording
                        ?{background:"rgba(245,166,35,.2)",color:"#f5a623",border:"1px solid rgba(245,166,35,.4)"}
                        :{background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.6)",border:"1px solid rgba(255,255,255,.12)"}}>
                      {acRecording?"⏹ Stop REC":"⏺ Registra"}
                    </button>
                    <button onClick={()=>setAcPoints([])} className="text-[10px] text-txt-secondary hover:text-acc-red px-1">Clear</button>
                  </div>
                </div>
                {acPoints.length===0&&(
                  <div className="text-xs text-txt-secondary py-2 text-center" style={{background:"rgba(255,255,255,.03)",borderRadius:8}}>
                    {acRecording?"Clicca sui telefoni per registrare i punti…":"Clicca su \"Registra\" poi tocca i telefoni"}
                  </div>
                )}
                {acPoints.map((p,i)=>(
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-violet font-mono w-5 shrink-0">P{i+1}</span>
                    <span className="text-txt-secondary font-mono flex-1">{Math.round(p.relX*100)}% {Math.round(p.relY*100)}%</span>
                    <span className="text-txt-secondary text-[10px]">delay</span>
                    <input type="number" min="0.1" max="30" step="0.1" value={p.delay}
                      onChange={e=>setAcPoints(pts=>pts.map((pt,j)=>j===i?{...pt,delay:parseFloat(e.target.value)||1}:pt))}
                      className="input text-xs py-0.5 px-1.5 w-14 text-center"/>
                    <span className="text-txt-secondary text-[10px]">s</span>
                    <button onClick={()=>setAcPoints(pts=>pts.filter((_,j)=>j!==i))}
                      className="text-[10px] text-txt-secondary hover:text-acc-red">✕</button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="label-tiny">Stop:</span>
                {(["never","cycles","duration"] as const).map(m=>(
                  <button key={m} onClick={()=>setAcStopMode(m)}
                    className="text-xs px-2.5 py-1 rounded-lg"
                    style={acStopMode===m
                      ?{background:"rgba(139,92,246,.2)",color:"#8b5cf6",border:"1px solid rgba(139,92,246,.4)"}
                      :{background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)"}}>
                    {m==="never"?"Mai":m==="cycles"?"Cicli":"Durata"}
                  </button>
                ))}
                {acStopMode==="cycles"&&(
                  <div className="flex items-center gap-1 text-xs">
                    <input type="number" min="1" max="9999" value={acMaxCycles}
                      onChange={e=>setAcMaxCycles(parseInt(e.target.value)||10)}
                      className="input text-xs py-0.5 px-2 w-16 text-center"/>
                    <span className="text-txt-secondary">cicli</span>
                  </div>
                )}
                {acStopMode==="duration"&&(
                  <div className="flex items-center gap-1 text-xs">
                    <input type="number" min="1" max="3600" value={acMaxDuration}
                      onChange={e=>setAcMaxDuration(parseInt(e.target.value)||60)}
                      className="input text-xs py-0.5 px-2 w-16 text-center"/>
                    <span className="text-txt-secondary">secondi</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={acRunning?stopAc:startAc} disabled={!acPoints.length&&!acRunning}
                  className={`btn text-xs px-4 py-1.5 ${acRunning?"btn-ghost":"btn-lime"}`}
                  style={(!acPoints.length&&!acRunning)?{opacity:.4}:{}}>
                  {acRunning?`⏹ Stop (${acTicks})`:"▶ Avvia"}
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  <input className="input text-xs py-1 px-2 w-28" placeholder="Nome config…"
                    value={acConfigName} onChange={e=>setAcConfigName(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter") saveAcConfig();}}/>
                  <button onClick={saveAcConfig} disabled={!acConfigName.trim()} className="btn btn-ghost text-xs px-2 py-1">💾</button>
                </div>
                {acSavedConfigs.length>0&&(
                  <select onChange={e=>loadAcConfig(e.target.value)} defaultValue=""
                    className="input text-xs py-1 px-2 cursor-pointer" style={{minWidth:100}}>
                    <option value="" disabled>Carica…</option>
                    {acSavedConfigs.map(c=>(
                      <option key={c.name} value={c.name}>{c.name} ({c.points.length}pt)</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ADB command ── */}
      {agentOnline&&(
        <div className="flex gap-2 mt-2">
          <input className="input font-mono text-xs flex-1" placeholder="Comando ADB shell…"
            value={cmdText} onChange={e=>setCmdText(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&cmdText.trim()){eseguiCmd(cmdText,cmdText);setCmdText("");}}}/>
          <button className="btn btn-lime px-4 text-xs"
            onClick={()=>{if(cmdText.trim()){eseguiCmd(cmdText,cmdText);setCmdText("");}}}>Esegui</button>
        </div>
      )}

      {/* ── Log ── */}
      {showLog&&(
        <div className="card p-3 mt-3 max-h-40 overflow-y-auto">
          <div className="flex justify-between mb-1">
            <span className="label-tiny">Log</span>
            <button onClick={()=>setLog([])} className="text-[10px] text-txt-secondary hover:text-acc-red">Cancella</button>
          </div>
          {log.map((l,i)=>(
            <div key={i} className="flex gap-2 text-[11px] py-0.5 border-b border-bord/20 font-mono">
              <span className="text-txt-secondary shrink-0 w-16">{l.time}</span>
              <span className={l.ok?"text-lime":"text-acc-red"}>{l.msg}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes ripple {
          0%   { transform:scale(.4); opacity:1; }
          100% { transform:scale(3.5); opacity:0; }
        }
      `}</style>
    </AppShell>
  );
}
