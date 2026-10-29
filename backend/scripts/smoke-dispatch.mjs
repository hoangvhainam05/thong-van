import fs from 'node:fs';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const env = Object.fromEntries(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
  .split(/\r?\n/).filter((line) => line && !line.startsWith('#'))
  .map((line) => { const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1)]; }));
const base = (process.env.API_URL || 'http://127.0.0.1:' + (env.PORT || 8000) + '/api').replace(/\/$/, '');
const token = process.env.AUTH_TEST_TOKEN || '';
const requestIds = [];
const fleetIds = { drivers: [], vehicles: [] };
const checks = {};
let failure = null;
let cleanupSucceeded = false;

function assert(condition, message) { if (!condition) throw new Error(message); }
function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}
async function request(path, { method = 'GET', body, staff = true } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(staff ? { 'Authorization': `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}
function orderPayload(productId, date, lat, lng) {
  const id = crypto.randomUUID();
  requestIds.push(id);
  return {
    customer_name: 'Sprint3 integration ' + id.slice(0, 8),
    phone: '09' + String(crypto.randomInt(0, 100_000_000)).padStart(8, '0'),
    client_request_id: id,
    address: '12 Tran Hung Dao, Hoan Kiem, Ha Noi',
    ...(lat == null ? {} : { lat, lng }),
    delivery_date: date,
    time_window_start: '08:00',
    time_window_end: '17:00',
    payment_method: 'COD',
    items: [{ product_id: productId, quantity: 1 }],
  };
}
async function prepareOrder(payload) {
  let response = await request('/orders', { method: 'POST', body: payload, staff: false });
  assert(response.status === 201, 'Tạo đơn thử thất bại: ' + JSON.stringify(response.data));
  const order = response.data;
  response = await request('/orders/' + order.id + '/status', { method: 'PATCH', body: { status: 'CONFIRMED' } });
  assert(response.status === 200, 'Xác nhận đơn thử thất bại');
  response = await request('/orders/' + order.id + '/status', { method: 'PATCH', body: { status: 'READY' } });
  assert(response.status === 200, 'Chuyển READY thất bại, kể cả khi thiếu toạ độ');
  return order;
}
async function cleanup() {
  const db = await mysql.createConnection({
    host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306),
    user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE || 'thongvan',
  });
  try {
    await db.beginTransaction();
    const orderIds = [];
    const customerIds = [];
    for (const requestId of requestIds) {
      const [rows] = await db.execute('SELECT id, customer_id, status FROM orders WHERE client_request_id = ?', [requestId]);
      for (const row of rows) {
        orderIds.push(row.id);
        customerIds.push(row.customer_id);
      }
    }
    if (orderIds.length) {
      const placeholders = orderIds.map(() => '?').join(',');
      const [routeRows] = await db.query('SELECT DISTINCT route_id FROM delivery_stop WHERE order_id IN (' + placeholders + ')', orderIds);
      for (const row of routeRows) await db.execute('DELETE FROM route WHERE id = ?', [row.route_id]);
      for (const id of orderIds) {
        const [items] = await db.execute('SELECT product_id, quantity FROM order_item WHERE order_id = ?', [id]);
        for (const item of items) await db.execute('UPDATE product SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        await db.execute('DELETE FROM orders WHERE id = ?', [id]);
      }
      for (const id of customerIds) {
        await db.execute("DELETE FROM customer WHERE id = ? AND name LIKE 'Sprint3 integration %' AND NOT EXISTS (SELECT 1 FROM orders WHERE customer_id = ?)", [id, id]);
      }
    }
    for (const id of fleetIds.vehicles) await db.execute('DELETE FROM vehicle WHERE id = ?', [id]);
    for (const id of fleetIds.drivers) await db.execute('DELETE FROM driver WHERE id = ?', [id]);
    await db.commit();
    cleanupSucceeded = true;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

try {
  assert(token, 'Cần AUTH_TEST_TOKEN của tài khoản có quyền quản trị');
  const date = dateAfter(90);
  let response = await request('/routes?route_date=' + date, { staff: false });
  assert(response.status === 401, 'API tuyến phải yêu cầu đăng nhập');
  response = await request('/orders?delivery_date=' + date);
  assert(response.status === 200 && response.data.length === 0, 'Ngày thử đã có đơn, không được thay đổi dữ liệu thật');
  response = await request('/routes?route_date=' + date);
  assert(response.status === 200 && response.data.length === 0, 'Ngày thử đã có tuyến, không được thay đổi dữ liệu thật');
  const products = await request('/products', { staff: false });
  const product = products.data.find((item) => item.active && item.price < 5_000_000 && item.stock >= 4);
  assert(product, 'Không có sản phẩm phù hợp để thử điều phối');

  let driver1 = await request('/drivers', { method: 'POST', body: { name: 'Sprint3 Driver A', phone: '09' + String(crypto.randomInt(0, 100_000_000)).padStart(8, '0') } });
  assert(driver1.status === 201, 'Không tạo được tài xế thử');
  fleetIds.drivers.push(driver1.data.id);
  let driver2 = await request('/drivers', { method: 'POST', body: { name: 'Sprint3 Driver B', phone: '09' + String(crypto.randomInt(0, 100_000_000)).padStart(8, '0') } });
  assert(driver2.status === 201, 'Không tạo được tài xế thử thứ hai');
  fleetIds.drivers.push(driver2.data.id);
  const suffix = String(crypto.randomInt(10000, 99999));
  let vehicle1 = await request('/vehicles', { method: 'POST', body: { plate: 'TVS3-A' + suffix, capacity_m3: 3.5, capacity_kg: 800 } });
  assert(vehicle1.status === 201, 'Không tạo được xe thử');
  fleetIds.vehicles.push(vehicle1.data.id);
  let vehicle2 = await request('/vehicles', { method: 'POST', body: { plate: 'TVS3-B' + suffix, capacity_m3: 3.5, capacity_kg: 800 } });
  assert(vehicle2.status === 201, 'Không tạo được xe thử thứ hai');
  fleetIds.vehicles.push(vehicle2.data.id);
  response = await request('/vehicles/' + vehicle2.data.id, { method: 'PATCH', body: { capacity_kg: 750 } });
  assert(response.status === 200 && response.data.capacity_kg === 750, 'Cập nhật năng lực xe không lưu xuống MySQL');
  checks.fleetCrudAndAuth = true;

  const first = await prepareOrder(orderPayload(product.id, date, 21.032, 105.852));
  const second = await prepareOrder(orderPayload(product.id, date, 21.035, 105.858));
  const missing = await prepareOrder(orderPayload(product.id, date, null, null));
  response = await request('/orders/' + first.id + '/priority', { method: 'PATCH', body: { is_urgent: true } });
  assert(response.status === 200 && response.data.is_urgent, 'Không đánh dấu được đơn gấp');
  checks.readyWithoutLocationAndPriority = true;

  response = await request('/routes/optimize', { method: 'POST', body: { date, vehicle_ids: [vehicle1.data.id] } });
  assert(response.status === 201, 'Tối ưu thất bại: ' + JSON.stringify(response.data));
  assert(response.data.routes.length === 1 && response.data.routes[0].stops.length === 2, 'Không xếp được hai đơn vào một xe');
  assert(response.data.missing_location_codes.includes(missing.code), 'Đơn thiếu toạ độ không được báo rõ');
  let route = response.data.routes[0];
  assert(route.total_minutes <= 480, 'Tuyến vượt ca 8 giờ');
  checks.optimizeAndMissingLocation = true;

  const reversed = route.stops.map((stop) => stop.order_id).reverse();
  response = await request('/routes/' + route.id + '/draft', { method: 'PATCH', body: { order_ids: reversed, driver_id: driver1.data.id } });
  assert(response.status === 200 && response.data.stops.map((stop) => stop.order_id).join(',') === reversed.join(','), 'Sửa thứ tự tuyến nháp không lưu');
  response = await request('/routes/' + route.id + '/draft', { method: 'PATCH', body: { vehicle_id: vehicle2.data.id } });
  assert(response.status === 200 && response.data.vehicle_id === vehicle2.data.id, 'Đổi xe không lưu');
  response = await request('/routes/' + route.id + '/draft', { method: 'PATCH', body: { vehicle_id: vehicle1.data.id } });
  assert(response.status === 200 && response.data.vehicle_id === vehicle1.data.id, 'Không đổi xe về ban đầu được');
  response = await request('/routes/' + route.id + '/draft', { method: 'PATCH', body: { driver_id: null } });
  assert(response.status === 200 && response.data.driver_id === null, 'Không bỏ phân công tài xế được');
  response = await request('/routes/' + route.id + '/draft', { method: 'PATCH', body: { driver_id: driver1.data.id } });
  assert(response.status === 200 && response.data.driver_id === driver1.data.id, 'Không phân công lại tài xế được');
  route = response.data;
  checks.editDraftAssignmentAndSequence = true;

  response = await request('/routes/' + route.id + '/lock', { method: 'POST' });
  assert(response.status === 201 && response.data.status === 'LOCKED', 'Không chốt được tuyến');
  response = await request('/routes/' + route.id + '/draft', { method: 'PATCH', body: { order_ids: reversed.reverse() } });
  assert(response.status === 409, 'Tuyến đã chốt vẫn bị sửa');
  const lockedSnapshot = (await request('/routes/' + route.id)).data;
  checks.lockPreventsEdits = true;

  const urgent = await prepareOrder(orderPayload(product.id, date, 21.039, 105.86));
  response = await request('/orders/' + urgent.id + '/priority', { method: 'PATCH', body: { is_urgent: true } });
  assert(response.status === 200, 'Không đánh dấu được đơn gấp sau khi đã chốt tuyến khác');
  response = await request('/routes/optimize', { method: 'POST', body: { date, vehicle_ids: [vehicle2.data.id] } });
  assert(response.status === 201 && response.data.routes.length === 1, 'Đơn gấp sau chốt không được đưa vào tuyến mới');
  const lockedAfter = (await request('/routes/' + route.id)).data;
  assert(lockedAfter.status === 'LOCKED' && lockedAfter.stops.map((stop) => stop.order_id).join(',') === lockedSnapshot.stops.map((stop) => stop.order_id).join(','), 'Tối ưu lại đã thay đổi tuyến chốt');
  checks.urgentAfterLockPreservesLockedRoute = true;

  response = await request('/routes?route_date=' + date);
  assert(response.status === 200 && response.data.length === 2, 'Danh sách tuyến không đọc được từ MySQL');
  checks.routeReadback = true;
} catch (error) {
  failure = error.message;
} finally {
  try { await cleanup(); } catch (error) { failure ||= 'Dọn dữ liệu thử thất bại: ' + error.message; }
}

console.log(JSON.stringify({ passed: Object.values(checks).filter(Boolean).length, total: Object.keys(checks).length, checks, cleanup: cleanupSucceeded, error: failure }));
if (failure) process.exitCode = 1;
