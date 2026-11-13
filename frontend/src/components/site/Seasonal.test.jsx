import {act} from 'react';
import {createRoot} from 'react-dom/client';
import SeasonalDecor from './SeasonalDecor';
import {THEMES} from '@/lib/themes';
import {usePublicationRefresh} from '@/lib/publication';
import {SiteProvider,useSite} from '@/lib/site';
import {http} from '@/lib/api';
jest.mock('@/lib/api',()=>({http:{get:jest.fn()}}));
let root,container,site;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;history.replaceState(null,'','/');container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);http.get.mockImplementation(async url=>({data:url==='/photos'?[]:{appearance:{theme:'autumn'}}}));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();jest.clearAllMocks();});
const seasons=['spring','summer','autumn','winter','halloween','christmas','easter','valentine'];
test.each(seasons)('%s has exactly one menu motif and at most two page motifs',async key=>{
 await act(async()=>root.render(<SeasonalDecor theme={key} variant="menu"/>));
 expect(container.querySelector('[data-season]').dataset.season).toBe(key);
 expect(container.querySelectorAll('svg > g')).toHaveLength(1);
 expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
 await act(async()=>root.render(<SeasonalDecor theme={key}/>));
 expect(container.querySelectorAll('svg > g').length).toBeLessThanOrEqual(2);
});
test('each action palette retains readable white text',()=>{
 const luminance=rgb=>rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
 const entries=Array.isArray(THEMES)?THEMES:Object.values(THEMES);
 for(const t of entries){const c=t.colors?t.colors.action.split(' ').map(Number):[1,3,5].map(i=>parseInt(t.palette[1].slice(i,i+2),16));expect(1.05/(luminance(c)+.05)).toBeGreaterThanOrEqual(4.5);}
});
function RefreshProbe({refresh}){usePublicationRefresh(refresh);return null;}
test('public tabs refresh after publication; admin focus and storage events preserve drafts',async()=>{
 const refresh=jest.fn(async()=>{});await act(async()=>root.render(<RefreshProbe refresh={refresh}/>));
 await act(async()=>window.dispatchEvent(new Event('focus')));expect(refresh).toHaveBeenCalledTimes(1);
 history.replaceState(null,'','/admin');await act(async()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new StorageEvent('storage',{key:'site-content-published'}));});expect(refresh).toHaveBeenCalledTimes(1);
 history.replaceState(null,'','/');await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:'site-content-published'})));expect(refresh).toHaveBeenCalledTimes(2);
});
function Probe(){site=useSite();return <span>{site.content?.appearance?.theme}</span>;}
test('late initial response cannot overwrite a newly published theme',async()=>{
 let release;http.get.mockImplementation(url=>url==='/content'?new Promise(r=>{release=r;}):Promise.resolve({data:[]}));
 await act(async()=>root.render(<SiteProvider><Probe/></SiteProvider>));
 await act(async()=>site.setContent({appearance:{theme:'winter'}}));
 await act(async()=>release({data:{appearance:{theme:'autumn'}}}));
 expect(site.content.appearance.theme).toBe('winter');
});
test('temporary public API failure retains the last successful content',async()=>{
 await act(async()=>root.render(<SiteProvider><Probe/></SiteProvider>));expect(site.content.appearance.theme).toBe('autumn');
 http.get.mockRejectedValue(new Error('offline'));await act(async()=>window.dispatchEvent(new Event('focus')));
 expect(site.content.appearance.theme).toBe('autumn');
});
