import { useEffect } from 'react';
export function announcePublication(){try{localStorage.setItem('site-content-published',String(Date.now()));}catch{}}
export function usePublicationRefresh(refresh){
 useEffect(()=>{
  const update=()=>{
   // Public refreshes must never replace private admin content or an unsaved draft.
   if(document.visibilityState==='hidden'||window.location.pathname.startsWith('/admin'))return;
   Promise.resolve(refresh()).catch(()=>{});
  };
  const storage=e=>{if(e.key==='site-content-published')update();};
  window.addEventListener('pageshow',update);window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);window.addEventListener('storage',storage);
  return()=>{window.removeEventListener('pageshow',update);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);window.removeEventListener('storage',storage);};
 },[refresh]);
}
