// Sinh dữ liệu mẫu có tính tất định (cùng kết quả mỗi lần), ngày tháng tính theo hôm nay.
import { DEFAULT_MATRIX } from "../rbac";
import { addDays, toMin, ymd } from "../format";
import { etaWindow, optimize } from "../optimizer";
import { PRODUCTS } from "./catalog";

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEPOT = { name: "Kho Thông Vân", address: "Kho trung tâm (toạ độ mẫu, cập nhật địa chỉ thật)", lat: 21.0285, lng: 105.8542 };

const DISTRICTS = [
  ["Ba Đình", 21.034, 105.814, ["Đội Cấn", "Kim Mã", "Liễu Giai", "Nguyễn Thái Học"]],
  ["Hoàn Kiếm", 21.0285, 105.852, ["Hàng Bài", "Lý Thường Kiệt", "Hàng Bông"]],
  ["Đống Đa", 21.018, 105.829, ["Tây Sơn", "Xã Đàn", "Thái Hà", "Chùa Bộc"]],
  ["Hai Bà Trưng", 21.006, 105.858, ["Bạch Mai", "Minh Khai", "Lò Đúc", "Trần Khát Chân"]],
  ["Cầu Giấy", 21.036, 105.79, ["Xuân Thuỷ", "Trần Duy Hưng", "Hoàng Quốc Việt", "Nguyễn Khánh Toàn"]],
  ["Thanh Xuân", 20.995, 105.81, ["Nguyễn Trãi", "Khương Đình", "Vũ Trọng Phụng"]],
  ["Tây Hồ", 21.068, 105.818, ["Lạc Long Quân", "Âu Cơ", "Xuân Diệu"]],
  ["Long Biên", 21.047, 105.889, ["Nguyễn Văn Cừ", "Ngọc Lâm", "Ngô Gia Tự"]],
  ["Hoàng Mai", 20.974, 105.864, ["Giải Phóng", "Tam Trinh", "Lĩnh Nam"]],
  ["Hà Đông", 20.971, 105.778, ["Quang Trung", "Tô Hiệu", "Văn Phú"]],
  ["Nam Từ Liêm", 21.013, 105.766, ["Mễ Trì", "Lê Đức Thọ", "Mỹ Đình"]],
  ["Bắc Từ Liêm", 21.065, 105.77, ["Phạm Văn Đồng", "Cổ Nhuế", "Đức Thắng"]],
];

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
const DEM = ["Văn", "Thị", "Minh", "Thu", "Đức", "Ngọc", "Thanh", "Hải", "Quốc", "Bảo", "Gia", "Khánh", "Phương", "Hữu"];
const TEN = ["An", "Bình", "Châu", "Dũng", "Giang", "Hà", "Hạnh", "Hiếu", "Hoa", "Huy", "Khoa", "Lan", "Linh", "Long", "Mai", "Minh", "Nam", "Ngân", "Nhung", "Phong", "Phúc", "Quân", "Quỳnh", "Sơn", "Tâm", "Thảo", "Trang", "Trung", "Tú", "Vân", "Việt", "Yến"];

const WINDOWS = [
  ["08:00", "12:00"], ["08:00", "17:00"], ["13:00", "17:00"], ["08:00", "17:00"],
  ["09:00", "11:00"], ["14:00", "17:00"], ["08:00", "17:00"], ["08:00", "12:00"],
];
const FAIL_REASONS = ["Khách không có nhà", "Khách hẹn giao lại ngày khác", "Sai địa chỉ, không liên lạc được", "Không đủ chỗ lắp đặt"];

export const DEFAULT_SETTINGS = {
  depot: DEPOT,
  dayStart: "08:00",
  dayEnd: "18:00",
  speed: 30,
  roadFactor: 1.35,
  wKm: 1,
  wTime: 0.5,
  unloadMin: 10,
  shippingFee: 150000,
  freeShipFrom: 5000000,
};

export function buildSeed() {
  const r = rng(20261019);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const between = (a, b) => a + r() * (b - a);
  const int = (a, b) => Math.floor(between(a, b + 1));
  const today = ymd();
  const nowIso = new Date().toISOString();
  const isoAt = (date, min) => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d, Math.floor(min / 60), min % 60).toISOString();
  };

  // ---------------------------------------------------------- khách hàng
  const customers = [];
  for (let i = 1; i <= 72; i++) {
    const [dname, lat, lng, streets] = pick(DISTRICTS);
    const name = `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`;
    const aLat = +(lat + between(-0.012, 0.012)).toFixed(6);
    const aLng = +(lng + between(-0.012, 0.012)).toFixed(6);
    customers.push({
      id: i,
      name,
      phone: `09${String(10000000 + ((i * 7919) % 89999999)).padStart(8, "0")}`,
      email: i % 3 === 0 ? `khach${i}@example.com` : "",
      createdAt: isoAt(addDays(today, -int(25, 400)), 600),
      addresses: [{
        id: 1, label: "Nhà riêng",
        address: `Số ${int(1, 180)}, ${pick(streets)}, ${dname}, Hà Nội`,
        district: dname, lat: aLat, lng: aLng,
      }],
    });
  }
  // khách demo
  customers[0] = {
    ...customers[0],
    name: "Phạm Thu Trang",
    phone: "0912345678",
    email: "khach@thongvan.vn",
    addresses: [
      { id: 1, label: "Nhà riêng", address: "Số 25, ngõ 120 Xã Đàn, Đống Đa, Hà Nội", district: "Đống Đa", lat: 21.0172, lng: 105.8338 },
      { id: 2, label: "Nhà bố mẹ", address: "Số 8, Ngọc Lâm, Long Biên, Hà Nội", district: "Long Biên", lat: 21.0452, lng: 105.8768 },
    ],
  };

  // ---------------------------------------------------------- nhân sự, xe
  const drivers = [
    { id: 1, name: "Nguyễn Văn Hùng", phone: "0901111001", license: "C", active: true },
    { id: 2, name: "Trần Đức Thắng", phone: "0901111002", license: "C", active: true },
    { id: 3, name: "Lê Quốc Bảo", phone: "0901111003", license: "B2", active: true },
    { id: 4, name: "Phạm Văn Tuấn", phone: "0901111004", license: "C", active: true },
    { id: 5, name: "Đỗ Minh Khoa", phone: "0901111005", license: "B2", active: true },
    { id: 6, name: "Bùi Văn Lực", phone: "0901111006", license: "C", active: false },
  ];
  const vehicles = [
    { id: 1, plate: "29H-123.45", type: "Xe tải 1,25 tấn", capacity: 6, capacityKg: 1250, active: true },
    { id: 2, plate: "29H-234.56", type: "Xe tải 1,25 tấn", capacity: 6, capacityKg: 1250, active: true },
    { id: 3, plate: "29C-345.67", type: "Xe tải 2 tấn", capacity: 9, capacityKg: 2000, active: true },
    { id: 4, plate: "29H-456.78", type: "Xe tải 990 kg", capacity: 4.5, capacityKg: 990, active: true },
    { id: 5, plate: "29C-567.89", type: "Xe tải 2 tấn", capacity: 9, capacityKg: 2000, active: false },
  ];

  const users = [
    { id: 1, name: "Hoàng Minh Quân", email: "admin@thongvan.vn", phone: "0988000001", password: "123456", role: "ADMIN", active: true },
    { id: 2, name: "Vũ Thị Lan", email: "quanly@thongvan.vn", phone: "0988000002", password: "123456", role: "MANAGER", active: true },
    { id: 3, name: "Ngô Thanh Hà", email: "banhang@thongvan.vn", phone: "0988000003", password: "123456", role: "SALES", active: true },
    { id: 4, name: "Đặng Bảo Ngọc", email: "banhang2@thongvan.vn", phone: "0988000004", password: "123456", role: "SALES", active: true },
    ...drivers.map((d, i) => ({
      id: 10 + d.id, name: d.name, email: `taixe${d.id}@thongvan.vn`, phone: d.phone,
      password: "123456", role: "DRIVER", active: d.active, driverId: d.id,
    })),
    { id: 100, name: customers[0].name, email: "khach@thongvan.vn", phone: customers[0].phone, password: "123456", role: "CUSTOMER", active: true, customerId: 1 },
    { id: 101, name: customers[4].name, email: `khach5@example.com`, phone: customers[4].phone, password: "123456", role: "CUSTOMER", active: true, customerId: 5 },
  ];
  drivers.forEach((d) => (d.userId = 10 + d.id));

  // ---------------------------------------------------------- đơn hàng
  const bigProducts = PRODUCTS.filter((p) => p.category !== "gia-dung" && p.active);
  const smallProducts = PRODUCTS.filter((p) => p.category === "gia-dung");
  const orders = [];
  let orderId = 0;
  const staffNames = ["Ngô Thanh Hà", "Đặng Bảo Ngọc", "Vũ Thị Lan"];

  function makeOrder(date, status, customerId) {
    orderId++;
    const c = customers[(customerId ?? int(2, customers.length)) - 1];
    const addr = c.addresses[0];
    const items = [];
    const main = pick(bigProducts);
    items.push({ productId: main.id, name: main.name, price: main.price, qty: 1 });
    if (r() < 0.35) {
      const extra = pick(smallProducts);
      items.push({ productId: extra.id, name: extra.name, price: extra.price, qty: r() < 0.8 ? 1 : 2 });
    }
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const shippingFee = subtotal >= DEFAULT_SETTINGS.freeShipFrom ? 0 : DEFAULT_SETTINGS.shippingFee;
    const [ws, we] = pick(WINDOWS);
    // ngày đặt không được ở tương lai so với thời điểm hiện tại
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    let created = addDays(date, -int(0, 3));
    let createdMin = int(7 * 60, 21 * 60);
    if (created > today) created = today;
    if (created === today && createdMin > nowMin - 10) {
      if (nowMin > 7 * 60 + 30) createdMin = int(7 * 60, nowMin - 10);
      else { created = addDays(today, -1); }
    }
    const method = r() < 0.62 ? "COD" : r() < 0.7 ? "BANK" : "EWALLET";
    const o = {
      id: orderId,
      code: `TV${String(100000 + orderId * 7).slice(-6)}`,
      customerId: c.id,
      customerName: c.name,
      phone: c.phone,
      address: addr.address,
      district: addr.district,
      lat: addr.lat,
      lng: addr.lng,
      items,
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
      deliveryDate: date,
      window: { start: ws, end: we },
      payment: { method, status: method === "COD" ? "UNPAID" : "PAID" },
      note: r() < 0.15 ? pick(["Gọi trước 30 phút", "Nhà trong ngõ nhỏ, xe tải không vào được", "Giao giờ hành chính", "Tháo máy cũ giúp"]) : "",
      status,
      createdAt: isoAt(created, createdMin),
      history: [{ status: "PENDING", at: isoAt(created, createdMin), by: "Khách hàng" }],
    };
    const flow = ["CONFIRMED", "READY", "SCHEDULED", "OUT_FOR_DELIVERY"];
    const target = ["PENDING", "CONFIRMED", "READY", "SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].indexOf(status);
    flow.forEach((st, i) => {
      if (target > i) o.history.push({ status: st, at: isoAt(created, Math.min(createdMin + 30 * (i + 1), 23 * 60)), by: st === "OUT_FOR_DELIVERY" ? "Hệ thống" : pick(staffNames) });
    });
    if (status === "CANCELLED") o.history.push({ status: "CANCELLED", at: isoAt(created, createdMin + 90), by: pick(staffNames), note: pick(["Khách đổi ý", "Hết hàng", "Khách đặt trùng đơn"]) });
    orders.push(o);
    return o;
  }

  const serviceOf = (o) => DEFAULT_SETTINGS.unloadMin + o.items.reduce((s, it) => s + (PRODUCTS[it.productId - 1].install * it.qty), 0);
  const volumeOf = (o) => o.items.reduce((s, it) => s + PRODUCTS[it.productId - 1].volume * it.qty, 0);
  const toStop = (o) => ({
    id: o.id, order: o.id, lat: o.lat, lng: o.lng,
    twStart: toMin(o.window.start), twEnd: toMin(o.window.end),
    service: serviceOf(o), volume: volumeOf(o),
  });

  const routes = [];
  let routeId = 0;
  function planRoutes(date, dayOrders, vehicleIds) {
    const vs = vehicleIds.map((id, i) => ({ id, capacity: vehicles[id - 1].capacity, driverId: [1, 2, 3, 4, 5][(i + date.length) % 5] }));
    // tài xế khác nhau cho mỗi xe
    vs.forEach((v, i) => (v.driverId = ((i + Number(date.slice(-2))) % 5) + 1));
    const res = optimize(DEPOT, dayOrders.map(toStop), vs, { dayStart: 480, dayEnd: 1080 });
    return res.plans.map((p) => {
      routeId++;
      return {
        id: routeId,
        code: `R${date.slice(5).replace("-", "")}-${p.vehicleId}`,
        date,
        vehicleId: p.vehicleId,
        driverId: p.driverId,
        status: "DONE",
        totalKm: p.totalKm,
        totalMin: p.totalMin,
        baselineKm: p.baselineKm,
        solver: "heuristic",
        createdAt: isoAt(addDays(date, -1), 17 * 60),
        stops: p.stops.map((s) => {
          const eta = etaWindow(s.arrival, s.seq);
          return { orderId: s.orderId, seq: s.seq, planned: s.arrival, etaStart: eta.start, etaEnd: eta.end, arrivedAt: null, completedAt: null, result: null };
        }),
      };
    });
  }

  function complete(route, upTo, opts = {}) {
    let drift = 0;
    route.stops.forEach((s, i) => {
      if (i >= upTo) return;
      const o = orders.find((x) => x.id === s.orderId);
      drift += int(-6, 14);
      s.arrivedAt = s.planned + drift;
      s.completedAt = s.arrivedAt + serviceOf(o) + int(-3, 10);
      const failed = !opts.noFail && r() < 0.06;
      s.result = failed ? "FAILED" : "DELIVERED";
      o.status = s.result;
      if (failed) o.failReason = pick(FAIL_REASONS);
      o.history.push({ status: s.result, at: isoAt(route.date, s.completedAt), by: route.driverId ? drivers[route.driverId - 1].name : "Tài xế", note: o.failReason });
      if (!failed && o.payment.method === "COD") o.payment.status = "PAID";
    });
  }

  // ---------- 21 ngày đã qua
  for (let d = 21; d >= 1; d--) {
    const date = addDays(today, -d);
    const n = int(7, 13);
    const dayOrders = [];
    for (let i = 0; i < n; i++) {
      if (r() < 0.06) makeOrder(date, "CANCELLED");
      else dayOrders.push(makeOrder(date, "OUT_FOR_DELIVERY"));
    }
    const vehicleIds = dayOrders.length > 9 ? [1, 2, 3] : [1, 3];
    const rs = planRoutes(date, dayOrders, vehicleIds);
    rs.forEach((rt) => complete(rt, rt.stops.length));
    // đơn không xếp được (hiếm) -> giao thất bại / dời lịch
    dayOrders.filter((o) => o.status === "OUT_FOR_DELIVERY").forEach((o) => { o.status = "FAILED"; o.failReason = "Không xếp được tuyến, dời lịch"; });
    routes.push(...rs);
  }

  // ---------- hôm nay
  const todayOrders = [];
  for (let i = 0; i < 14; i++) todayOrders.push(makeOrder(today, "OUT_FOR_DELIVERY"));
  const todayRoutes = planRoutes(today, todayOrders, [1, 2, 3]);
  // Tuyến 1 đang chạy, tuyến 2 đã chốt chờ xuất kho, tuyến 3 nháp
  const [rA, rB, rC] = todayRoutes;
  // tài khoản demo taixe1 lái tuyến đang chạy, taixe2 lái tuyến đã chốt
  todayRoutes.forEach((rt, i) => (rt.driverId = i + 1));
  rA.status = "IN_PROGRESS";
  rA.lockedAt = isoAt(today, 7 * 60 + 30);
  rA.startedAt = isoAt(today, 8 * 60);
  const doneA = Math.min(2, rA.stops.length - 3);
  complete(rA, doneA, { noFail: true });
  if (rA.stops[doneA]) rA.stops[doneA].arrivedAt = rA.stops[doneA].planned + 12;
  // khách demo nằm ở điểm thứ (doneA + 3) của tuyến đang chạy: còn 2 điểm phía trước
  const demoStop = rA.stops[Math.min(doneA + 2, rA.stops.length - 1)];
  const demoOrder = orders.find((o) => o.id === demoStop.orderId);
  Object.assign(demoOrder, {
    customerId: 1, customerName: customers[0].name, phone: customers[0].phone,
    address: customers[0].addresses[0].address, district: "Đống Đa",
  });
  rA.stops.forEach((s) => {
    const o = orders.find((x) => x.id === s.orderId);
    if (!s.completedAt) o.status = "OUT_FOR_DELIVERY";
  });
  if (rB) {
    rB.status = "LOCKED";
    rB.lockedAt = isoAt(today, 7 * 60 + 40);
    rB.stops.forEach((s) => {
      const o = orders.find((x) => x.id === s.orderId);
      o.status = "SCHEDULED";
      o.history = o.history.filter((h) => h.status !== "OUT_FOR_DELIVERY");
    });
  }
  if (rC) {
    rC.status = "DRAFT";
    rC.stops.forEach((s) => {
      const o = orders.find((x) => x.id === s.orderId);
      o.status = "SCHEDULED";
      o.history = o.history.filter((h) => h.status !== "OUT_FOR_DELIVERY");
    });
  }
  routes.push(...todayRoutes);
  // đơn hôm nay chưa xếp tuyến
  for (let i = 0; i < 3; i++) makeOrder(today, "READY");
  for (let i = 0; i < 2; i++) makeOrder(today, "CONFIRMED");
  for (let i = 0; i < 3; i++) makeOrder(today, "PENDING");
  // một đơn thiếu toạ độ (rủi ro R1)
  const noLoc = makeOrder(today, "PENDING");
  Object.assign(noLoc, { lat: null, lng: null, address: "Thôn 3, xã Vân Côn (khách ghi chung chung)", district: "Hoài Đức" });

  // ---------- ngày mai và ngày kia
  const tomorrow = addDays(today, 1);
  for (let i = 0; i < 6; i++) makeOrder(tomorrow, "READY");
  for (let i = 0; i < 4; i++) makeOrder(tomorrow, "CONFIRMED");
  for (let i = 0; i < 5; i++) makeOrder(tomorrow, "PENDING");
  makeOrder(tomorrow, "PENDING", 1);
  for (let i = 0; i < 5; i++) makeOrder(addDays(today, 2), "PENDING");

  // đơn cũ đã giao của khách demo
  const pastDemo = orders.filter((o) => o.status === "DELIVERED" && o.deliveryDate < today).slice(-3);
  pastDemo.forEach((o) => Object.assign(o, { customerId: 1, customerName: customers[0].name, phone: customers[0].phone, address: customers[0].addresses[(o.id % 2)].address }));

  // ---------------------------------------------------------- thông báo khách demo
  const notifications = [];
  let nId = 0;
  orders.filter((o) => o.customerId === 1).forEach((o) => {
    o.history.forEach((h) => {
      const text = {
        PENDING: ["Đã nhận đơn", `Thông Vân đã nhận đơn ${o.code}. Nhân viên sẽ gọi xác nhận trong ít phút.`],
        CONFIRMED: ["Đơn đã được xác nhận", `Đơn ${o.code} đã được xác nhận và đang chuẩn bị hàng.`],
        SCHEDULED: ["Đã xếp lịch giao", `Đơn ${o.code} đã có lịch giao. Bạn có thể xem thứ tự giao trong trang theo dõi.`],
        OUT_FOR_DELIVERY: ["Xe đã xuất kho", `Đơn ${o.code} đang được giao. Theo dõi để biết còn bao nhiêu điểm trước bạn.`],
        DELIVERED: ["Giao hàng thành công", `Đơn ${o.code} đã giao thành công. Cảm ơn bạn đã mua sắm tại Thông Vân.`],
      }[h.status];
      if (text) notifications.push({ id: ++nId, customerId: 1, orderId: o.id, title: text[0], body: text[1], at: h.at, read: o.deliveryDate < today });
    });
  });

  // ---------------------------------------------------------- nhật ký
  const audit = [
    { at: isoAt(today, 7 * 60 + 30), user: "Vũ Thị Lan", action: "Chốt tuyến", detail: rA.code },
    { at: isoAt(today, 7 * 60 + 40), user: "Vũ Thị Lan", action: "Chốt tuyến", detail: rB?.code },
    { at: isoAt(today, 8 * 60), user: "Vũ Thị Lan", action: "Xuất kho", detail: rA.code },
    { at: isoAt(addDays(today, -1), 17 * 60), user: "Vũ Thị Lan", action: "Tối ưu tuyến", detail: `${today}: 14 đơn, 3 xe` },
    { at: isoAt(addDays(today, -2), 9 * 60), user: "Hoàng Minh Quân", action: "Đổi phân quyền", detail: "SALES: thêm quyền Xem lịch giao" },
  ].filter((a) => a.detail);

  const cart = [];

  return {
    version: 3,
    seededAt: nowIso,
    seedDate: today,
    roleMatrix: DEFAULT_MATRIX,
    settings: DEFAULT_SETTINGS,
    users,
    customers,
    products: PRODUCTS,
    orders,
    routes,
    drivers,
    vehicles,
    notifications,
    audit,
    cart,
    session: null,
  };
}
