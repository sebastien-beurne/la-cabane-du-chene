import { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { toast } from 'sonner';
import SeasonalDecor from '@/components/site/SeasonalDecor';
import { THEMES, DEFAULT_THEME } from '@/lib/themes';
import { useSite } from '@/lib/site';
import { http, errMsg } from '@/lib/api';

export default function ThemePicker() {
  const site=useSite();
  const saved=site.content?.appearance?.theme || DEFAULT_THEME;
  const [chosen,setChosen]=useState(saved),[busy,setBusy]=useState(false);
  useEffect(()=>()=>site.setPreviewTheme(null),[site.setPreviewTheme]);
  useEffect(()=>setChosen(saved),[saved]);
  const select=(key)=>{setChosen(key);site.setPreviewTheme(key);};
  const cancel=()=>{setChosen(saved);site.setPreviewTheme(null);};
  const save=async()=>{
    setBusy(true);
    try {const r=await http.put('/admin/appearance',{theme:chosen});site.setContent(r.data);site.setPreviewTheme(null);toast.success('Thème enregistré');}
    catch(e){toast.error(errMsg(e));}finally{setBusy(false);}
  };
  return <section data-testid="theme-picker" className="space-y-7 pb-12">
    <div><p className="text-action text-xs font-bold uppercase tracking-[.22em]">Charte graphique</p><h1 className="mt-3 text-4xl font-display text-ink">Un lieu, au rythme des saisons.</h1><p className="mt-4 text-muted-ink leading-relaxed">Sélectionnez un thème pour le prévisualiser immédiatement. L’enregistrement conserve vos textes, photos et réglages.</p></div>
    <div className="grid gap-5 sm:grid-cols-2">{Object.entries(THEMES).map(([key,t])=><button type="button" data-testid={'theme-'+key} disabled={busy} aria-pressed={chosen===key} key={key} onClick={()=>select(key)} className="overflow-hidden rounded-lg border-2 text-left shadow-sm" style={{borderColor:chosen===key?'rgb('+t.colors.action+')':'transparent',background:'rgb('+t.colors.paper+')'}}>
      <div className="relative h-40 overflow-hidden px-5 pt-5" style={{background:'rgb('+t.colors.canvas+')',color:'rgb('+t.colors.ink+')'}}><SeasonalDecor theme={key}/><div className="relative z-10 flex justify-between text-xs font-bold tracking-wider"><span>{site.content.general?.name||'MON HÉBERGEMENT'}</span>{chosen===key&&<Check size={17}/>}</div><div className="mt-5 text-3xl" style={{fontFamily:t.font}}>Une autre façon<br/>de s’évader.</div><div className="absolute bottom-4 right-5 h-5 w-20 rounded-full" style={{background:'rgb('+t.colors.action+')'}}/></div>
      <div className="p-5"><span className="font-semibold" style={{color:'rgb('+t.colors.ink+')'}}>{t.name}</span><p className="mt-2 text-sm" style={{color:'rgb('+t.colors['muted-ink']+')'}}>{t.description}</p><div className="mt-4 flex gap-2">{['brand','action','gold'].map(c=><span key={c} className="h-5 w-5 rounded-full border border-black/10" style={{background:'rgb('+t.colors[c]+')'}}/>)}</div></div>
    </button>)}</div>
    <div className="flex flex-wrap gap-3"><a className="rounded-full border border-brand/20 px-6 py-3 text-ink" href={`${site.content.setup?'/apercu':'/'}?theme-preview=${chosen}`} target="_blank" rel="noopener">Voir le thème sur le site complet ↗</a><button type="button" onClick={save} disabled={busy} data-testid="theme-save" className="inline-flex items-center gap-2 rounded-full bg-action px-6 py-3 font-semibold text-white disabled:opacity-50"><Save size={16}/>{busy?'Enregistrement…':'Enregistrer le thème'}</button><button type="button" onClick={cancel} className="rounded-full border border-brand/20 px-6 py-3 text-ink">Annuler l’aperçu</button></div>
    <p className="text-sm text-muted-ink">Les collections partagent les mêmes écrans et fonctionnalités. Le logo et les photos se configurent dans Identité et Photos.</p>
  </section>;
}

