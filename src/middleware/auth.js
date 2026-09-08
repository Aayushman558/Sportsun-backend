const jwt = require("jsonwebtoken");

// Verifies the JWT and attaches the decoded user to req.user
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, storeId, regionId }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Restricts a route to specific roles, e.g. requireRole("SUPER_ADMIN", "REGIONAL_MANAGER")
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions for this action" });
    }
    next();
  };
}

// Scopes a Store Manager to only their own store's data.
// Regional Managers and Super Admins bypass this check.
function scopeToLocation(req, res, next) {
  if (req.user.role === "STORE_MANAGER") {
    const requestedLocation = req.params.locationId || req.body.locationId;
    if (requestedLocation && requestedLocation !== req.user.storeId) {
      return res.status(403).json({ error: "You can only access your assigned store" });
    }
  }
  next();
}

module.exports = { requireAuth, requireRole, scopeToLocation };
