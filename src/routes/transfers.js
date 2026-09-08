const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();
router.use(requireAuth);

// GET /api/transfers
router.get("/", async (_req, res) => {
  const transfers = await prisma.transfer.findMany({
    include: { fromLocation: true, toLocation: true },
    orderBy: { initiatedAt: "desc" },
  });
  res.json(transfers);
});

// POST /api/transfers
// Body: { fromLocationId, toLocationId, items: [{ productId, quantity }] }
router.post("/", async (req, res) => {
  const { fromLocationId, toLocationId, items } = req.body;
  if (!fromLocationId || !toLocationId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "fromLocationId, toLocationId, and a non-empty items array are required" });
  }

  const transfer = await prisma.transfer.create({
    data: {
      fromLocationId,
      toLocationId,
      itemsJson: items,
      initiatedBy: req.user.id,
      status: "PENDING",
    },
  });
  res.status(201).json(transfer);
});

// PATCH /api/transfers/:id/status — move through PENDING -> IN_TRANSIT -> RECEIVED -> COMPLETED
// Completing a transfer actually moves the stock between locations.
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body;
  const valid = ["PENDING", "IN_TRANSIT", "RECEIVED", "COMPLETED"];
  if (!valid.includes(status)) return res.status(400).json({ error: `status must be one of ${valid.join(", ")}` });

  const transfer = await prisma.transfer.findUnique({ where: { id: req.params.id } });
  if (!transfer) return res.status(404).json({ error: "Transfer not found" });

  if (status === "COMPLETED" && transfer.status !== "COMPLETED") {
    const items = transfer.itemsJson;
    for (const item of items) {
      await prisma.inventory.update({
        where: { productId_locationId: { productId: item.productId, locationId: transfer.fromLocationId } },
        data: { quantity: { decrement: item.quantity } },
      });
      await prisma.inventory.upsert({
        where: { productId_locationId: { productId: item.productId, locationId: transfer.toLocationId } },
        update: { quantity: { increment: item.quantity } },
        create: { productId: item.productId, locationId: transfer.toLocationId, quantity: item.quantity },
      });
    }
  }

  const updated = await prisma.transfer.update({
    where: { id: req.params.id },
    data: { status, completedAt: status === "COMPLETED" ? new Date() : transfer.completedAt },
  });
  res.json(updated);
});

module.exports = router;
