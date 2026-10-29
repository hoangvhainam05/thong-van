// Phân quyền theo vai trò (RBAC).
// Mỗi vai trò có một tập quyền; giao diện kiểm tra quyền chứ không kiểm tra tên vai trò,
// nên có thể đổi ma trận quyền ở trang Quản trị > Phân quyền mà không sửa code.

export const ROLES = {
  ADMIN: { label: "Quản trị viên", desc: "Toàn quyền hệ thống, quản lý tài khoản và phân quyền" },
  MANAGER: { label: "Quản lý điều phối", desc: "Duyệt đơn, tối ưu và chốt tuyến, xuất kho, xem báo cáo" },
  SALES: { label: "Nhân viên bán hàng", desc: "Xác nhận và xử lý đơn, quản lý sản phẩm, chăm sóc khách" },
  DRIVER: { label: "Nhân viên giao hàng", desc: "Nhận tuyến, giao hàng, cập nhật trạng thái từng điểm" },
  CUSTOMER: { label: "Khách hàng", desc: "Mua hàng, thanh toán, theo dõi đơn và thứ tự giao" },
};

export const STAFF_ROLES = ["ADMIN", "MANAGER", "SALES", "DRIVER"];

export const PERMISSION_GROUPS = [
  {
    group: "Mua hàng",
    items: [
      ["order.place", "Đặt hàng và thanh toán"],
      ["order.track_own", "Xem và theo dõi đơn của mình"],
      ["notification.own", "Nhận thông báo đơn hàng"],
    ],
  },
  {
    group: "Đơn hàng",
    items: [
      ["backoffice.access", "Vào trang quản trị"],
      ["dashboard.view", "Xem tổng quan"],
      ["order.view_all", "Xem tất cả đơn hàng"],
      ["order.confirm", "Xác nhận và chuẩn bị đơn"],
      ["order.edit_location", "Sửa vị trí giao hàng"],
      ["order.cancel", "Huỷ đơn"],
      ["customer.view", "Xem khách hàng"],
    ],
  },
  {
    group: "Sản phẩm",
    items: [["product.manage", "Thêm, sửa, ẩn sản phẩm"]],
  },
  {
    group: "Giao hàng",
    items: [
      ["dispatch.view", "Xem lịch giao và tuyến"],
      ["route.optimize", "Chạy tối ưu tuyến"],
      ["route.approve", "Duyệt và chốt tuyến"],
      ["route.dispatch", "Xuất kho, đổi tài xế"],
      ["fleet.manage", "Quản lý tài xế và xe"],
      ["delivery.app", "Dùng ứng dụng giao hàng"],
      ["delivery.update", "Cập nhật kết quả giao"],
    ],
  },
  {
    group: "Hệ thống",
    items: [
      ["report.view", "Xem báo cáo"],
      ["user.manage", "Quản lý tài khoản nhân viên"],
      ["role.manage", "Chỉnh phân quyền"],
      ["settings.manage", "Cài đặt hệ thống và tham số tối ưu"],
      ["audit.view", "Xem nhật ký thao tác"],
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map(([k]) => k));
export const PERMISSION_LABEL = Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.items));

export const DEFAULT_MATRIX = {
  ADMIN: [...ALL_PERMISSIONS.filter((p) => !["order.place", "order.track_own", "notification.own", "delivery.app", "delivery.update"].includes(p))],
  MANAGER: [
    "backoffice.access", "dashboard.view", "order.view_all", "order.confirm", "order.edit_location",
    "order.cancel", "customer.view", "dispatch.view", "route.optimize", "route.approve",
    "route.dispatch", "fleet.manage", "report.view", "settings.manage",
  ],
  SALES: [
    "backoffice.access", "dashboard.view", "order.view_all", "order.confirm", "order.edit_location",
    "customer.view", "product.manage", "dispatch.view",
  ],
  DRIVER: ["delivery.app", "delivery.update"],
  CUSTOMER: ["order.place", "order.track_own", "notification.own"],
};

// Quyền không được gỡ để tránh tự khoá mình khỏi hệ thống
export const LOCKED = { ADMIN: ["backoffice.access", "role.manage", "user.manage"] };

export function can(matrix, role, perm) {
  if (!role) return false;
  return (matrix?.[role] || []).includes(perm);
}

// Trang đích sau khi đăng nhập
export function homeFor(matrix, role) {
  if (can(matrix, role, "backoffice.access")) return "/admin";
  if (can(matrix, role, "delivery.app")) return "/driver";
  return "/";
}
