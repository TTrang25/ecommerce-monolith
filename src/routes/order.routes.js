const router = require('express').Router();
const prisma = require('../lib/prisma');
const auth = require('../middlewares/auth');
const { HttpError, asyncHandler } = require('../middlewares/error');

router.use(auth); // mọi route đặt hàng đều cần token

const include = { details: true, shipments: true };

// POST /api/orders
// body: { "items": [ { "pid": 1, "qty": 2 }, { "pid": 2, "qty": 5 } ] }
router.post('/', asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'items must be a non-empty array');
  }

  // Kiểm tra dữ liệu và gộp các dòng trùng sản phẩm
  const wanted = new Map();
  for (const it of items) {
    const pid = Number(it.pid);
    const qty = Number(it.qty);
    if (!Number.isInteger(pid) || !Number.isInteger(qty) || qty <= 0) {
      throw new HttpError(400, 'Each item needs integer pid and qty > 0');
    }
    wanted.set(pid, (wanted.get(pid) || 0) + qty);
  }

  // Toàn bộ thao tác nằm trong 1 transaction: lỗi ở đâu thì hoàn tác hết
  const order = await prisma.$transaction(async (tx) => {
    const pids = [...wanted.keys()];
    const products = await tx.product.findMany({ where: { pid: { in: pids } } });
    if (products.length !== pids.length) {
      throw new HttpError(404, 'Some products do not exist');
    }

    const created = await tx.order.create({ data: { uid: req.user.uid } }); // createat = now()

    for (const p of products) {
      const qty = wanted.get(p.pid);
      // Chỉ trừ kho khi còn đủ hàng
      const r = await tx.product.updateMany({
        where: { pid: p.pid, quantity: { gte: qty } },
        data: { quantity: { decrement: qty } },
      });
      if (r.count === 0) {
        throw new HttpError(400, `Not enough stock for product "${p.pname}"`);
      }
      await tx.orderDetail.create({
        data: { oid: created.oid, pid: p.pid, qty, unit_price: p.price },
      });
    }

    // Đặt hàng thành công thì tự tạo shipment
    await tx.shipment.create({ data: { oid: created.oid, status: 'PENDING' } });

    return tx.order.findUnique({ where: { oid: created.oid }, include });
  });

  res.status(201).json(order);
}));

// GET /api/orders : đơn hàng của người dùng hiện tại
router.get('/', asyncHandler(async (req, res) => {
  res.json(await prisma.order.findMany({
    where: { uid: req.user.uid },
    include,
    orderBy: { oid: 'desc' },
  }));
}));

// GET /api/orders/:id : xem đơn hàng + chi tiết
router.get('/:id', asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { oid: Number(req.params.id) },
    include,
  });
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.uid !== req.user.uid && req.user.role !== 'admin') {
    throw new HttpError(403, 'Not your order');
  }
  res.json(order);
}));

module.exports = router;