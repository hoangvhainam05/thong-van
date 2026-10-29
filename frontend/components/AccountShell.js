"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, loadToken } from '@/lib/api';
import { useStore } from '@/lib/store';
import { RequirePerm } from './Guard';
export default function AccountShell({children}){return <RequirePerm perm="order.track_own"><Inner>{children}</Inner></RequirePerm>;}
function Inner({children}){
 const pathname=usePathname(), {can}=useStore();const [unread,setUnread]=useState(0);
 useEffect(()=>{if(!can('notification.own'))return;let active=true;async function refresh(){try{const result=await api('/api/account/notifications',{token:loadToken()});if(active)setUnread(result.unread);}catch{if(active)setUnread(0);}}refresh();const timer=setInterval(refresh,30000);window.addEventListener('thongvan-notifications',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('thongvan-notifications',refresh);};},[can]);
 const items=[['/account/orders','Đơn hàng',0],...(can('notification.own') ? [['/account/notifications','Thông báo',unread]] : []),['/account/warranties','Bảo hành và bảo dưỡng',0],['/account/profile','Tài khoản',0]];
 return <div className="account-layout"><nav className="account-nav" aria-label="Tài khoản">{items.map(([href,label,n])=><Link key={href} href={href} className={pathname.startsWith(href)?'on':''}>{label}{n>0 && <span className="badge move plain">{n}</span>}</Link>)}</nav><div>{children}</div></div>;
}
