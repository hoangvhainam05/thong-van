import fs from 'node:fs';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const envPath = new URL('../.env', import.meta.url);
const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
const base = (process.env.API_URL || `http://127.0.0.1:${env.PORT || 8000}/api`).replace(/\/$/, '');
const requestIds = [];
const checks = {};
const token = env.STAFF_TOKEN || '';
let failure = null;
let db;

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function temporaryPhone() {
  return `09${String(crypto.randomInt(0, 100_000_000)).padStart(8, '0')}`;
}

function payload(product, overrides = {}) {
  const client_request_id = crypto.randomUUID();
  requestIds.push(client_request_id);
  return {
    customer_name: `Sprint2 integration ${client_request_id.slice(0, 8)}`,
    phone: temporaryPhone(),
    recipient_name: 'Nguoi nhan test',
    recipient_phone: '0907654321',
    is_gift: false,
    client_request_id,
    address: '12 Nguyen Hue, Quan 1, TP HCM',
    lat: 10.7769,
    lng: 106.7009,
    delivery_date: tomorrowYmd(),
    time_window_start: '08:00',
    time_window_end: '12:00',
    payment_method: 'COD',
    items: [{ product_id: product.id, quantity: 1 }],
    ...overrides,
  };
}

async function request(path, { method = 'GET', body, staff = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (staff) headers['X-Staff-Token'] = token;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

function tomorrowYmd() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function cleanup() {
  db = await mysql.createConnection({
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE || 'thongvan',
  });
  await db.beginTransaction();
  for (const requestId of requestIds) {
    const [orders] = await db.execute(
      'SELECT id, customer_id, status FROM orders WHERE client_request_id = ?',
      [requestId],
    );
    for (const order of orders) {
      const [items] = await db.execute(
        'SELECT product_id, quantity FROM order_item WHERE order_id = ?',
        [order.id],
      );
      if (order.status !== 'CANCELLED') {
        for (const item of items) {
          await db.execute('UPDATE product SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      }
      await db.execute('DELETE FROM order_history WHERE order_id = ?', [order.id]);
      await db.execute('DELETE FROM order_item WHERE order_id = ?', [order.id]);
      await db.execute('DELETE FROM orders WHERE id = ?', [order.id]);
      const [remaining] = await db.execute('SELECT COUNT(*) AS n FROM orders WHERE customer_id = ?', [order.customer_id]);
      if (remaining[0].n === 0) {
        await db.execute("DELETE FROM customer WHERE id = ? AND name LIKE 'Sprint2 integration %'", [order.customer_id]);
      }
    }
  }
  await db.commit();
  await db.end();
  db = null;
}

try {
  assert(token && token !== 'doi-token-nay', 'STAFF_TOKEN chưa được cấu hình trong backend/.env');
  const productsResponse = await request('/products');
  assert(productsResponse.status === 200, 'Không tải được sản phẩm công khai.');
  const products = productsResponse.data;
  const product = products.find((item) => item.id === 8 && item.active && item.stock > 0)
    || products.find((item) => item.active && item.stock > 0);
  assert(product, 'Không có sản phẩm hoạt động để kiểm thử.');
  const initialStock = product.stock;

  const transfer = payload(product, { is_gift: true, payment_method: 'BANK_TRANSFER' });
  const [first, retry] = await Promise.all([
    request('/orders', { method: 'POST', body: transfer }),
    request('/orders', { method: 'POST', body: transfer }),
  ]);
  assert(first.status === 201 && retry.status === 201 && first.data.id === retry.data.id, 'Request đồng thời cùng UUID phải trả cùng một đơn.');
  const transferOrder = first.data;
  assert(transferOrder.payment_status === 'PENDING' && transferOrder.is_gift, 'Đơn chuyển khoản/đặt hộ chưa lưu đúng trạng thái.');
  assert(transferOrder.payment_instructions?.transfer_content?.includes(transferOrder.code)
    && transferOrder.payment_instructions.amount === transferOrder.total, 'Hướng dẫn chuyển khoản không khớp mã/số tiền đơn.');
  checks.webCheckoutAndConcurrentIdempotency = true;
  const afterReservation = (await request('/products')).data.find((item) => item.id === product.id).stock;
  assert(afterReservation === initialStock - 1, 'Request lặp đã trừ tồn nhiều hơn một lần.');
  checks.stockReservedOnce = true;

  let response = await request(`/orders/${transferOrder.id}/request-info`, {
    method: 'POST', body: { message: 'Vui lòng xác nhận số nhà.' },
  });
  assert(response.status === 401, 'API yêu cầu bổ sung phải được bảo vệ bằng staff token.');
  response = await request(`/orders/${transferOrder.id}/request-info`, {
    method: 'POST', body: { message: 'Vui lòng xác nhận số nhà.' }, staff: true,
  });
  assert(response.status === 201 && response.data.history.some((item) => item.event_type === 'INFO_REQUEST'), 'Yêu cầu bổ sung chưa được ghi lịch sử.');
  response = await request(`/tracking/${transferOrder.code}?phone=${encodeURIComponent(transfer.phone)}`);
  assert(response.status === 200
    && response.data.requested_info?.some((item) => item.message === 'Vui lòng xác nhận số nhà.')
    && response.data.payment_instructions?.transfer_content?.includes(transferOrder.code), 'Khách chưa đọc được yêu cầu bổ sung/hướng dẫn chuyển khoản khi tra cứu đơn.');
  const wrongPhone = await request(`/tracking/${transferOrder.code}?phone=0900000000`);
  assert(wrongPhone.status === 404, 'Tra cứu sai số điện thoại không được trả dữ liệu đơn.');
  checks.customerCanReadRequestAndTrackingIsPrivate = true;

  response = await request(`/orders/${transferOrder.id}/status`, {
    method: 'PATCH', body: { status: 'CONFIRMED' }, staff: true,
  });
  assert(response.status === 409, 'Không được xác nhận đơn chuyển khoản chưa đối soát.');
  response = await request(`/orders/${transferOrder.id}/payment`, {
    method: 'PATCH', body: { status: 'PAID' }, staff: true,
  });
  assert(response.status === 200 && response.data.payment_status === 'PAID', 'Nhân viên không xác nhận được thanh toán.');
  response = await request(`/orders/${transferOrder.id}/status`, {
    method: 'PATCH', body: { status: 'CANCELLED', reason: 'smoke test' }, staff: true,
  });
  assert(response.status === 409, 'Đơn đã thanh toán phải qua quy trình hoàn tiền trước khi hủy.');
  response = await request(`/orders/${transferOrder.id}/status`, {
    method: 'PATCH', body: { status: 'CONFIRMED' }, staff: true,
  });
  assert(response.status === 200, 'Không xác nhận được đơn sau khi đối soát.');
  response = await request(`/orders/${transferOrder.id}/status`, {
    method: 'PATCH', body: { status: 'READY' }, staff: true,
  });
  assert(response.status === 200, 'Không chuyển được đơn sang READY.');
  response = await request(`/orders/${transferOrder.id}/location`, {
    method: 'PATCH', body: { lat: 10.78, lng: 106.7, address: '14 Nguyen Hue, Quan 1, TP HCM' }, staff: true,
  });
  assert(response.status === 200 && response.data.history.some((item) => item.event_type === 'LOCATION'), 'Sửa vị trí chưa được lưu/audit.');
  checks.paymentStatusAndStaffWorkflow = true;

  const cod = payload(product);
  response = await request('/orders', { method: 'POST', body: cod });
  assert(response.status === 201 && response.data.payment_status === 'UNPAID', 'Không tạo được đơn COD.');
  response = await request(`/orders/${response.data.id}/status`, {
    method: 'PATCH', body: { status: 'CANCELLED', reason: 'Khách đổi ý' }, staff: true,
  });
  assert(response.status === 200, 'Không hủy được đơn COD chưa thanh toán.');
  const restoredStock = (await request('/products')).data.find((item) => item.id === product.id).stock;
  assert(restoredStock === initialStock - 1, 'Hủy COD không hoàn tồn chính xác.');
  checks.cancelRestoresStock = true;

  const giftCod = payload(product, { is_gift: true, payment_method: 'COD' });
  response = await request('/orders', { method: 'POST', body: giftCod });
  assert(response.status === 400, 'Backend phải chặn COD cho đơn đặt hộ.');
  const webCounterCash = payload(product, { payment_method: 'COUNTER_CASH' });
  response = await request('/orders', { method: 'POST', body: webCounterCash });
  assert(response.status === 400, 'Tiền mặt tại quầy không được dùng cho đơn đặt qua website.');
  const shortWindow = payload(product, { time_window_start: '08:00', time_window_end: '08:30' });
  response = await request('/orders', { method: 'POST', body: shortWindow });
  assert(response.status === 400, 'Backend phải chặn khung giờ dưới một tiếng.');
  const highValue = products.find((item) => item.active && item.price >= 5_000_000 && item.stock >= 2);
  assert(highValue, 'Không có sản phẩm phù hợp để kiểm tra ngưỡng COD.');
  const highValueOrder = payload(highValue, { items: [{ product_id: highValue.id, quantity: 2 }], payment_method: 'COD' });
  response = await request('/orders', { method: 'POST', body: highValueOrder });
  assert(response.status === 400, 'Backend phải chặn COD từ 10 triệu đồng.');
  checks.codAndCheckoutValidation = true;

  const counter = payload(product, { customer_name: `Sprint2 integration counter ${crypto.randomUUID().slice(0, 8)}`, phone: temporaryPhone(), payment_method: 'COUNTER_CASH' });
  response = await request('/orders/counter', { method: 'POST', body: counter });
  assert(response.status === 401, 'API nhập đơn tại quầy phải yêu cầu staff token.');
  const [counterOrder, counterRetry] = await Promise.all([
    request('/orders/counter', { method: 'POST', body: counter, staff: true }),
    request('/orders/counter', { method: 'POST', body: counter, staff: true }),
  ]);
  assert(counterOrder.status === 201 && counterRetry.status === 201 && counterOrder.data.id === counterRetry.data.id && counterOrder.data.source === 'COUNTER' && counterOrder.data.payment_status === 'PAID', 'Đơn quầy, thanh toán tại quầy hoặc idempotency không đạt.');
  response = await request(`/orders/${counterOrder.data.id}/status`, {
    method: 'PATCH', body: { status: 'CANCELLED', reason: 'smoke test' }, staff: true,
  });
  assert(response.status === 409, 'Đơn đã thu tiền tại quầy cần quy trình hoàn tiền trước khi hủy.');
  checks.counterOrderAuthAndIdempotency = true;

  response = await request('/orders/payment-instructions');
  const expectedConfigured = Boolean(env.BANK_NAME?.trim() && env.BANK_ACCOUNT_NAME?.trim() && env.BANK_ACCOUNT_NUMBER?.trim());
  assert(response.status === 200 && response.data.configured === expectedConfigured, 'API cấu hình hướng dẫn chuyển khoản không hoạt động.');
  checks.paymentInstructionsConfig = true;
} catch (error) {
  failure = error.message;
} finally {
  try {
    await cleanup();
  } catch (error) {
    if (db) {
      try { await db.rollback(); } catch {}
      try { await db.end(); } catch {}
    }
    failure ||= `Dọn dữ liệu test thất bại: ${error.message}`;
  }
}

console.log(JSON.stringify({
  passed: Object.values(checks).filter(Boolean).length,
  total: Object.keys(checks).length,
  checks,
  cleanup: !db,
  error: failure,
}));
if (failure) process.exitCode = 1;
