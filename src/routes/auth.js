const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/login
// Body: { email, password }
// Note: this issues the token directly. Wire in your 2FA step (TOTP verification)
// between password check and token issuance before going to production.
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, storeId: user.storeId, regionId: user.regionId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" } // matches the 15-minute session timeout requirement
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "LOGIN",
      ipAddress: req.ip,
    },
  });

  res.json({
    token,
    refreshToken,
    user: { id: user.id, name: user.name, role: user.role, storeId: user.storeId },
  });
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return res.status(401).json({ error: "User not found" });

    const token = jwt.sign(
      { id: user.id, role: user.role, storeId: user.storeId, regionId: user.regionId },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    res.json({ token });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

module.exports = router;
