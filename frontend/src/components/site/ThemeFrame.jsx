import {useEffect} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {THEMES,DEFAULT_THEME,themeById} from '@/lib/themes';
import {useSite} from '@/lib/site';
import SeasonalDecor from './SeasonalDecor';
export default function ThemeFrame({children}){
 const site=useSite(),location=useLocation(),navigate=useNavigate(),admin=location.pathname.startsWith('/admin'),query=new URLSearchParams(location.search).get('theme-preview');
 const preview=!admin&&Object.hasOwn(THEMES,query)?query:null;
 useEffect(()=>{if(!admin)site.setPreviewTheme(preview);return()=>{if(!admin)site.setPreviewTheme(null);};},[admin,preview,site.setPreviewTheme]);
 const theme=themeById(preview||site.previewTheme||site.content?.appearance?.theme||DEFAULT_THEME);
 return <div className="site-skin" data-site-theme={theme.id}>{preview&&<aside className="theme-preview-notice" data-no-translate aria-label="Comparateur d’ambiances"><span>Aperçu · Non publié</span><label><span className="sr-only">Ambiance à comparer</span><select data-testid="theme-preview-select" value={theme.id} onChange={e=>{const p=new URLSearchParams(location.search);p.set('theme-preview',e.target.value);navigate({pathname:location.pathname,search:p.toString()},{replace:true});}}>{Object.entries(THEMES).map(([k,t])=><option key={k} value={k}>{t.label||t.name}</option>)}</select></label><a href={location.pathname}>Quitter l’aperçu</a></aside>}{!admin&&<div className="seasonal-page-rail"><SeasonalDecor theme={theme.id}/></div>}{children}</div>;
}
export function SeasonalBand(){const s=useSite(),t=themeById(s.previewTheme||s.content?.appearance?.theme||DEFAULT_THEME);return t.mood?<section className="seasonal-atmosphere" data-testid="seasonal-atmosphere" data-no-translate><small>{t.label} · {s.content?.general?.name||'Votre hébergement'}</small><p>{t.mood}</p><SeasonalDecor theme={t.id}/></section>:null;}
