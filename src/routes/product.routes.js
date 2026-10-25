const router = require('express').Router();
const prisma = require('../lib/prisma');
const { HttpError, asyncHandler } = require('../middlewares/error');

// GET /api/products
router.get('/', asyncHandler(async (req, res) => {
  res.json(await prisma.product.findMany({ orderBy: { pid: 'asc' } }));
}));

// GET /api/products/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { pid: Number(req.params.id) },
  });
  if (!product) throw new HttpError(404, 'Product not found');
  res.json(product);
}));

module.exports = router;