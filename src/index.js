require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const locationRoutes = require("./routes/locations");
const employeeRoutes = require("./routes/employees");
const transferRoutes = require("./routes/transfers");

const app = express();

app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 })); // basic API rate limiting

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/transfers", transferRoutes);
// Add /api/sales for raw sales entry once a POS integration or manual sale form is needed.

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SportsSun API running on port ${PORT}`));
