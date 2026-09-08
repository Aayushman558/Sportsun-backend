const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();
router.use(requireAuth);

// GET /api/employees — includes last 30 days attendance summary
router.get("/", async (_req, res) => {
  const employees = await prisma.employee.findMany({
    include: {
      location: true,
      attendance: { orderBy: { date: "desc" }, take: 30 },
    },
    orderBy: { joinDate: "desc" },
  });

  const withStats = employees.map((e) => {
    const present = e.attendance.filter((a) => a.status === "PRESENT").length;
    const attendanceRate = e.attendance.length ? Math.round((present / e.attendance.length) * 100) : null;
    return { ...e, attendanceRate };
  });

  res.json(withStats);
});

// POST /api/employees  (Super Admin + Regional Manager only)
router.post("/", requireRole("SUPER_ADMIN", "REGIONAL_MANAGER"), async (req, res) => {
  const { name, email, phone, storeId, managerId, shift, designation, salary, hikePercent, experienceYears } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const employee = await prisma.employee.create({
    data: { name, email, phone, storeId, managerId, shift, designation, salary, hikePercent, experienceYears },
  });
  res.status(201).json(employee);
});

// PATCH /api/employees/:id  — update salary, hike %, designation, etc.
router.patch("/:id", requireRole("SUPER_ADMIN", "REGIONAL_MANAGER"), async (req, res) => {
  const allowed = ["name", "email", "phone", "storeId", "managerId", "shift", "designation", "salary", "hikePercent", "experienceYears"];
  const data = {};
  for (const key of allowed) if (key in req.body) data[key] = req.body[key];

  const employee = await prisma.employee.update({ where: { id: req.params.id }, data });
  res.json(employee);
});

// POST /api/employees/:id/attendance — mark today's (or a given date's) attendance
router.post("/:id/attendance", async (req, res) => {
  const { date, status } = req.body;
  const day = date ? new Date(date) : new Date();
  day.setHours(0, 0, 0, 0);

  const record = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: req.params.id, date: day } },
    update: { status: status || "PRESENT" },
    create: { employeeId: req.params.id, date: day, status: status || "PRESENT" },
  });
  res.json(record);
});

module.exports = router;
