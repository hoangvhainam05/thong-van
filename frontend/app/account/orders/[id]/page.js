"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import OrderTracking from "@/components/OrderTracking";
import { Empty, Loading } from "@/components/ui";

function Detail() {
  const { id } = useParams();
  const params = useSearchParams();
  const { state, user, actions } = useStore();
  const order = state.orders.find((o) => o.id === Number(id));
  // khách chỉ xem được đơn của chính mình
  if (!order || order.customerId !== user.customerId)
    return <div className="panel"><Empty title="Không tìm thấy đơn hàng" action={<Link className="btn" href="/account/orders">Về danh sách đơn</Link>} /></div>;

  return (
    <div className="stack">
      <Link href="/account/orders" className="small muted">‹ Đơn hàng của tôi</Link>
      {params.get("new") && (
        <div className="notice ok">Đặt hàng thành công. Mã đơn của bạn là <b>{order.code}</b>. Cửa hàng sẽ gọi xác nhận trong ít phút.</div>
      )}
      <OrderTracking
        order={order}
        actions={order.status === "PENDING" && (
          <div className="row">
            <button className="btn secondary sm" onClick={() => confirm("Huỷ đơn này?") && actions.cancelOwnOrder(order.id)}>Huỷ đơn</button>
            <span className="small muted">Bạn có thể tự huỷ khi đơn chưa được xác nhận.</span>
          </div>
        )}
      />
    </div>
  );
}

export default function OrderDetailPage() {
  return <Suspense fallback={<Loading />}><Detail /></Suspense>;
}
