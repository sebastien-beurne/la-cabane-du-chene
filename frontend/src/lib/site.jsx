import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {http} from './api';
import seed from '@/data/site.json';
import {applyTheme,DEFAULT_THEME} from './themes';
import {announcePublication,usePublicationRefresh} from './publication';
const SiteCtx=createContext(null);
export function SiteProvider({children}){
 const [content,updateContent]=useState(seed.content),[photos,setPhotos]=useState(seed.photos),[ready,setReady]=useState(false),[previewTheme,setPreviewTheme]=useState(null);
 const revision=useRef(0);
 const setContent=useCallback(next=>{revision.current++;updateContent(next);announcePublication();},[]);
 const load=useCallback(async()=>{const ticket=++revision.current;try{const[c,p]=await Promise.all([http.get('/content'),http.get('/photos')]);if(ticket===revision.current){if(c.data&&typeof c.data==='object')updateContent(c.data);setPhotos(Array.isArray(p.data)?p.data:[]);}}catch{}finally{setReady(true);}},[]);
 useEffect(()=>{load();},[load]);
 const refresh=useCallback(async()=>{const ticket=++revision.current;const r=await http.get('/content');if(ticket===revision.current&&!window.location.pathname.startsWith('/admin')&&r.data&&typeof r.data==='object')updateContent(r.data);},[]);
 usePublicationRefresh(refresh);
 useEffect(()=>{applyTheme(previewTheme||content?.appearance?.theme||DEFAULT_THEME);},[previewTheme,content?.appearance?.theme]);
 const reloadAdmin=useCallback(async()=>{const r=await http.get('/admin/content');revision.current++;updateContent(r.data);},[]);
 const value=useMemo(()=>{const byCat=cat=>photos.filter(p=>p.category===cat),pick=(...cats)=>cats.map(c=>byCat(c)[0]).find(Boolean)||null,gallery=photos.filter(p=>p.category!=='guide'&&p.url!==content?.general?.logo);return {content,photos,gallery,byCat,pick,ready,reload:load,reloadAdmin,setContent,previewTheme,setPreviewTheme};},[content,photos,ready,load,reloadAdmin,setContent,previewTheme]);
 return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>;
}
export const useSite=()=>useContext(SiteCtx);

export const FALLBACK = {
  hero_title: "Le calme, tout simplement.",
  hero_subtitle:
    "Une cabane en bois brûlé, un spa privatif et le petit déjeuner inclus, en Moselle.",
};

