const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();
router.use(requireAuth);

// GET /api/locations — includes live stock value + a naive avg-sale figure per location
router.get("/", async (_req, res) => {
  const locations = await prisma.location.findMany({
    include: {
      inventory: { include: { product: true } },
      sales: true,
    },
  });

  const withStats = locations.map((loc) => {
    const stockUnits = loc.inventory.reduce((s, i) => s + i.quantity, 0);
    const stockValue = loc.inventory.reduce((s, i) => s + i.quantity * Number(i.product.sellingPrice), 0);
    const totalSaleAmount = loc.sales.reduce((s, sale) => s + sale.quantity * Number(sale.price), 0);
    const avgSale = loc.sales.length ? totalSaleAmount / loc.sales.length : 0;
    const { inventory, sales, ...rest } = loc;
    return { ...rest, stockUnits, stockValue, avgSale, salesRecorded: loc.sales.length };
  });

  res.json(withStats);
});

// POST /api/locations  (Super Admin + Regional Manager only)
router.post("/", requireRole("SUPER_ADMIN", "REGIONAL_MANAGER"), async (req, res) => {
  const { name, code, type, address, city, state, pincode, contactPerson, phone, capacityUnits, latitude, longitude } = req.body;
  if (!name || !code || !type || !address || !city || !state || !pincode) {
    return res.status(400).json({ error: "name, code, type, address, city, state, and pincode are required" });
  }
  const location = await prisma.location.create({
    data: { name, code, type, address, city, state, pincode, contactPerson, phone, capacityUnits, latitude, longitude },
  });
  res.status(201).json(location);
});

// PATCH /api/locations/:id/status — toggle active/inactive (e.g. temporarily closed store)
router.patch("/:id/status", requireRole("SUPER_ADMIN", "REGIONAL_MANAGER"), async (req, res) => {
  const { isActive } = req.body;
  const location = await prisma.location.update({
    where: { id: req.params.id },
    data: { isActive: Boolean(isActive) },
  });
  res.json(location);
});

module.exports = router;
