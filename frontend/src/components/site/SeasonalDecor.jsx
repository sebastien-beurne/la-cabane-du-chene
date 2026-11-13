import { themeById } from '@/lib/themes';
// Small line drawings, rather than emoji or large illustrated backgrounds.
function Tree(){return <g><path d="m0-19-10 13h5l-8 12h9v7h8V6h9L5-6h5Z"/><path d="M-4 15h8"/></g>;}
function Snowman(){return <g><circle cy="-10" r="6"/><ellipse cy="5" rx="10" ry="11"/><path d="M-8-15H8M-5-15v-6h10v6M-6-4h13l3 9M-10 3l-9-6M10 3l8-6"/><path d="M0 2v1m0 6v1M1-10l6 2-6 1"/></g>;}
function Pumpkin(){return <g><ellipse cy="2" rx="15" ry="12"/><ellipse cy="2" rx="7" ry="12"/><path d="M0-10q-1-9 6-11M3-13q8-6 12 0-7 4-12 0M-8 1l3-3 2 3m6 0 3-3 2 3M-6 6q6 5 12 0"/></g>;}
function Rabbit(){return <g><ellipse cy="7" rx="11" ry="12"/><circle cy="-5" r="8"/><ellipse cx="-5" cy="-20" rx="3" ry="10" transform="rotate(-12 -5 -20)"/><ellipse cx="5" cy="-20" rx="3" ry="10" transform="rotate(12 5 -20)"/><circle cx="12" cy="12" r="4"/><path d="M-3-5h.1m6 0h.1M0-2v3m-5 15h10"/></g>;}
function Leaf(){return <g><path d="M-12 15C-16-9 2-18 15-18c1 23-9 36-27 33ZM-17 22 8-9M-5 6l-2-12m5 10 10 1"/></g>;}
function Flower(){return <g><path d="M0-5c-19-10-8-22 0-8 8-14 19-2 3 8C22-9 23 7 4 0 13 16-4 21-2 3-16 16-24 0-5-3"/><circle cy="-4" r="4"/><path d="M0 7v18m0-5q-12-12-14-4 4 8 14 4"/></g>;}
function Bee(){return <g><ellipse rx="13" ry="8"/><path d="M-4-7v14m8-14v14M13 0l6-2-3 5M-8-7q-16-19-1-18 12 2 9 17M1-8q8-19 16-14 5 8-10 14M-13 0h-5"/></g>;}
function Snowflake(){return <g><path d="M0-18v36M-16-9l32 18M-16 9l32-18M-6-15l6 5 6-5m-12 30 6-5 6 5"/></g>;}
function Heart(){return <g><path d="M0 15C-30-2-16-25 0-10 16-25 30-2 0 15Z"/></g>;}
const collections={christmas:[Tree,Snowman],halloween:[Pumpkin,Leaf],easter:[Rabbit,Flower],autumn:[Leaf,Leaf],summer:[Bee,Flower],spring:[Flower,Bee],winter:[Snowflake,Snowman],valentine:[Heart]};
export default function SeasonalDecor({theme,variant}){
 const t=themeById(theme),motifs=collections[t.id];if(!motifs)return null;
 return <div className={variant==='menu'?'seasonal-decor seasonal-menu-decor':'seasonal-decor'} data-testid={variant==='menu'?'mobile-seasonal-decor':undefined} data-season={t.id} aria-hidden="true"><svg viewBox={variant==='menu'?'0 0 64 64':'0 0 130 210'} fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">{(variant==='menu'?motifs.slice(0,1):motifs).map((Motif,i)=><g key={i} transform={variant==='menu'?'translate(32 32)':`translate(${[83,33][i]} ${[48,153][i]}) rotate(${[-12,9][i]})`}><Motif/></g>)}{variant!=='menu'&&<path d="M31 37h4m-2-2v4M89 108h4m-2-2v4M34 176h3" opacity=".5"/>}</svg></div>;
}
