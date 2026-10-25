const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const { HttpError, asyncHandler } = require('../middlewares/error');

// POST /api/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const { username, fullname, password } = req.body;
  if (!username || !fullname || !password) {
    throw new HttpError(400, 'username, fullname, password are required');
  }
  const existed = await prisma.user.findUnique({ where: { username } });
  if (existed) throw new HttpError(409, 'Username already exists');

  // Tự động gán role "normal" và membership có score 10
  const role = await prisma.role.upsert({
    where: { rolename: 'normal' },
    update: {},
    create: { rolename: 'normal' },
  });
  const membership = await prisma.memberShip.upsert({
    where: { mname: 'Standard' },
    update: {},
    create: { mname: 'Standard', score: 10 },
  });

  const user = await prisma.user.create({
    data: {
      username,
      fullname,
      password: await bcrypt.hash(password, 10),
      roleid: role.roleid,
      mid: membership.mid,
    },
    include: { role: true, membership: true },
  });

  res.status(201).json({
    uid: user.uid,
    username: user.username,
    fullname: user.fullname,
    role: user.role.rolename,
    membership: { name: user.membership.mname, score: user.membership.score },
  });
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new HttpError(400, 'username and password are required');
  }
  const user = await prisma.user.findUnique({
    where: { username },
    include: { role: true, membership: true },
  });
  const ok = user && (await bcrypt.compare(password, user.password));
  if (!ok) throw new HttpError(401, 'Wrong username or password');

  const token = jwt.sign(
    { uid: user.uid, role: user.role.rolename },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
  res.json({
    token,
    user: {
      uid: user.uid,
      username: user.username,
      role: user.role.rolename,
      membership: { name: user.membership.mname, score: user.membership.score },
    },
  });
}));

module.exports = router;