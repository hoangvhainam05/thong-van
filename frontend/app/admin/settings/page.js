"use client";
import { useEffect,useState } from 'react';
import { api,loadToken } from '@/lib/api';
import { vnd } from '@/lib/format';
import { RequirePerm } from '@/components/Guard';
import { PageHead } from '@/components/AdminShell';
import { Loading } from '@/components/ui';
function Settings(){
 const [data,setData]=useState(null),[error,setError]=useState('');useEffect(()=>{api('/api/admin/settings',{token:loadToken()}).then(setData).catch(e=>setError(e.message));},[]);
 return <><PageHead title="Cấu hình hiện tại" sub="Các giá trị đang được backend sử dụng."/>{error?<div className="notice bad">{error}</div>:!data?<Loading/>:<div className="grid-2"><section className="panel panel-pad stack-sm"><h3>Kho xuất hàng</h3>{data.warehouse?<><b>{data.warehouse.name}</b><div>{data.warehouse.address}</div><div className="small muted">{data.warehouse.lat}, {data.warehouse.lng}</div></>:<span>Chưa cấu hình kho</span>}</section><section className="panel panel-pad stack-sm"><h3>Phí giao hàng</h3><div>Phí: {vnd(data.shipping.fee)}</div><div>Miễn phí từ: {vnd(data.shipping.free_from)}</div></section><section className="panel panel-pad stack-sm"><h3>Tối ưu tuyến</h3><div>Giờ giao: {data.optimization.day_start}–{data.optimization.day_end}</div><div>Tốc độ ước tính: {data.optimization.speed_kmh} km/h · Hệ số đường: {data.optimization.road_factor}</div><div>Trọng số km: {data.optimization.weight_km} · thời gian: {data.optimization.weight_time}</div></section><div className="notice">Thay đổi cấu hình backend trong tệp môi trường và khởi động lại backend. Thông tin kho được cập nhật tại mục Kho xuất hàng.</div></div>}</>;
}
export default function SettingsPage(){return <RequirePerm perm="settings.manage"><Settings/></RequirePerm>;}
