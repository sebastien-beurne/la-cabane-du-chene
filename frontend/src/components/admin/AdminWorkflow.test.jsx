import {act} from 'react';
import {createRoot} from 'react-dom/client';
import ClientsAdmin from './ClientsAdmin';
import MessagesAdmin from './MessagesAdmin';
import {StayPreview,StayTemplate} from './StayMessages';
import {http} from '@/lib/api';
import {toast} from 'sonner';
jest.mock('@/lib/api',()=>({http:{get:jest.fn(),post:jest.fn(),put:jest.fn(),delete:jest.fn()},errMsg:()=> 'Erreur de test'}));
jest.mock('sonner',()=>({toast:{success:jest.fn(),info:jest.fn(),error:jest.fn()}}));
let root,container;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);window.confirm=jest.fn(()=>true);if(!crypto.randomUUID)crypto.randomUUID=()=> 'test-token-123456';jest.clearAllMocks();});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const render=async node=>act(async()=>root.render(node));
const click=async selector=>act(async()=>container.querySelector(selector).click());
test('client view distinguishes reservation creation and stay dates, and opens private history',async()=>{
 http.get.mockImplementation(async url=>({data:{total:1,page:1,pages:1,items:url==='/admin/clients'?[{id:'b',name:'Alice',email:'alice@example.com',booking_count:2,last_booking_at:'2026-01-02',check_in:'2026-12-16',check_out:'2026-12-17'}]:[{id:'b',created_at:'2026-01-02',check_in:'2026-12-16',check_out:'2026-12-17',status:'confirmee',source:'direct'}]}}));
 await render(<ClientsAdmin/>);expect(container.textContent).toContain('Dernière réservation créée le');expect(container.textContent).toContain('16/12/2026');
 await click('[aria-expanded]');expect(http.get).toHaveBeenCalledWith('/admin/clients/b',{params:{page:1}});expect(container.textContent).toContain('Réservation créée le 02/01/2026');
});
test('arrival preview sends only after confirmation and shows disabled delivery truthfully',async()=>{
 http.get.mockResolvedValue({data:{to:'alice@example.com',subject:'Arrivée',body:'Bonjour Alice',preview_hash:'a'.repeat(64)}});http.post.mockResolvedValue({data:{ok:false,delivery_disabled:true,email:{error:'Envoi désactivé'}}});
 const onSent=jest.fn();await render(<StayPreview booking={{id:'b'}} kind="arrival" onSent={onSent}/>);
 expect(http.post).not.toHaveBeenCalled();await click('[data-testid="stay-send-arrival"]');expect(window.confirm).toHaveBeenCalled();expect(http.post.mock.calls[0][0]).toBe('/admin/booking-requests/b/stay-message/arrival');expect(toast.info).toHaveBeenCalled();expect(toast.success).not.toHaveBeenCalled();expect(container.textContent).toContain('Envoi désactivé');
});
test('canceling a welcome message never sends',async()=>{
 http.get.mockResolvedValue({data:{to:'alice@example.com',subject:'Bienvenue',body:'Bienvenue Alice',preview_hash:'a'.repeat(64)}});window.confirm.mockReturnValue(false);await render(<StayPreview booking={{id:'b'}} kind="welcome" onSent={()=>{}}/>);await click('[data-testid="stay-send-welcome"]');expect(http.post).not.toHaveBeenCalled();
});
test('welcome template is configurable from automatic mail section',async()=>{
 http.get.mockResolvedValue({data:{subject:'Bienvenue',body:'Bonjour {prenom}'}});http.put.mockResolvedValue({data:{subject:'Bienvenue',body:'Bonjour {prenom}'}});
 await render(<StayTemplate kind="welcome"/>);expect(container.textContent).toContain('soir de l’arrivée');await click('[data-testid="stay-template-save-welcome"]');expect(http.put).toHaveBeenCalledWith('/admin/stay-messages/welcome',{subject:'Bienvenue',body:'Bonjour {prenom}'});
});
test('sent mail can be trashed and filtered by recipient, with restoration in trash',async()=>{
 http.get.mockResolvedValue({data:{items:[],total:0,page:1,pages:1}});await render(<MessagesAdmin/>);await click('[data-testid="messages-tab-envoyes"]');expect(container.querySelector('[data-testid="sent-filter-audience"]')).not.toBeNull();
 http.get.mockResolvedValue({data:{items:[{id:'e',to:'alice@example.com',subject:'Test',status:'envoye',audience:'client',deleted_at:'2026-11-13'}],total:1,page:1,pages:1}});
 await click('[data-testid="sent-trash-toggle"]');expect(http.get.mock.calls.at(-1)[1].params.trash).toBe(true);await click('[data-testid="sent-delete-e"]');expect(http.post).toHaveBeenCalledWith('/admin/emails/e/restore');
});
