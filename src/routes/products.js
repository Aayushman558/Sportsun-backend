const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// GET /api/products?search=&category=
router.get("/", async (req, res) => {
  const { search, category } = req.query;
  const products = await prisma.product.findMany({
    where: {
      AND: [
        search
          ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] }
          : {},
        category ? { category } : {},
      ],
    },
    include: { inventory: { include: { location: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(products);
});

// POST /api/products  (Super Admin + Regional Manager only)
router.post("/", requireRole("SUPER_ADMIN", "REGIONAL_MANAGER"), async (req, res) => {
  const { sku, name, category, subCategory, size, color, colorHex, costPrice, sellingPrice, minStock, supplierName } = req.body;

  if (!sku || !name || !category || !size) {
    return res.status(400).json({ error: "sku, name, category, and size are required" });
  }

  const product = await prisma.product.create({
    data: { sku, name, category, subCategory, size, color, colorHex, costPrice, sellingPrice, minStock, supplierName },
  });

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: "CREATE_PRODUCT", details: sku, ipAddress: req.ip },
  });

  res.status(201).json(product);
});

// PATCH /api/products/:id/stock  — adjust stock at a location, triggers low-stock alert
router.patch("/:id/stock", async (req, res) => {
  const { locationId, quantityChange } = req.body;
  if (!locationId || typeof quantityChange !== "number") {
    return res.status(400).json({ error: "locationId and quantityChange (number) are required" });
  }

  const inventory = await prisma.inventory.upsert({
    where: { productId_locationId: { productId: req.params.id, locationId } },
    update: { quantity: { increment: quantityChange } },
    create: { productId: req.params.id, locationId, quantity: Math.max(quantityChange, 0) },
  });

  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (product && inventory.quantity < product.minStock) {
    await prisma.stockAlert.create({
      data: { productId: product.id, threshold: product.minStock, alertType: "LOW_STOCK" },
    });
  }

  res.json(inventory);
});

module.exports = router;
