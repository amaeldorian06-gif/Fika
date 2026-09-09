import express from "express";
import path from "path";
import { db } from "./src/db/index.ts";
import { adminUsers, orders, customers, experts, leads } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await db.select().from(adminUsers).where(eq(adminUsers.email, email.toLowerCase().trim())).execute();
      
      if (!user || user.length === 0) {
        return res.status(401).json({ ok: false, message: "E-mail non reconnu." });
      }

      const isValid = await bcrypt.compare(password, user[0].passwordHash);
      if (!isValid) {
        return res.status(401).json({ ok: false, message: "Mot de passe incorrect." });
      }

      // Successful login
      res.json({
        ok: true,
        admin: {
          id: user[0].id,
          email: user[0].email,
          role: user[0].role
        }
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: "Erreur serveur" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ ok: true });
  });


  app.get("/api/admin/overview", async (req, res) => {
    try {
      const allOrders = await db.select().from(orders).execute();
      const allCustomers = await db.select().from(customers).execute();
      const customersById = Object.fromEntries(allCustomers.map(c => [c.id, c.name || "Client Anonyme"]));
      
      let revenue = 0;
      let marginAmount = 0;
      let ordersCount = allOrders.length;
      let todoCount = 0;
      const pipeline: Record<string, number> = {};

      for (const o of allOrders) {
        revenue += Number(o.totalPrice || 0);
        marginAmount += Number(o.marginAmount || 0);
        
        if (['NEW', 'QUALIFYING', 'PAID', 'ASSIGNED', 'IN_PROGRESS', 'QUALITY_CHECK'].includes(o.status)) {
          todoCount++;
        }

        pipeline[o.status] = (pipeline[o.status] || 0) + 1;
      }

      const marginPercent = revenue > 0 ? (marginAmount / revenue) * 100 : 0;
      const averageBasket = ordersCount > 0 ? revenue / ordersCount : 0;

      res.json({
        monthLabel: "Depuis le début",
        revenue,
        previousRevenue: 0,
        marginAmount,
        marginPercent,
        todoCount,
        ordersCount,
        averageBasket,
        pipeline,
        topServices: [], // Simplified for now
        recentOrders: allOrders.slice(0, 5).map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          customerName: customersById[o.customerId] || "Client inconnu",
          totalPrice: Number(o.totalPrice),
          marginAmount: Number(o.marginAmount),
          createdAt: o.createdAt.toISOString()
        }))
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/admin/orders", async (req, res) => {
    try {
      const allOrders = await db.select().from(orders).execute();
      const allCustomers = await db.select().from(customers).execute();
      const customersById = Object.fromEntries(allCustomers.map(c => [c.id, c.name || "Client Anonyme"]));
      
      const mapped = allOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: customersById[o.customerId] || "Client inconnu", 
        serviceName: "Prestation personnalisée", // fallback for now as there is no order_items table yet
        totalPrice: Number(o.totalPrice),
        marginAmount: Number(o.marginAmount),
        createdAt: o.createdAt.toISOString()
      }));
      res.json(mapped);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/admin/customers", async (req, res) => {
    try {
      const allCustomers = await db.select().from(customers).execute();
      res.json(allCustomers.map(c => ({
        id: c.id,
        name: c.name || "Client Anonyme",
        phone: c.phone,
        email: c.email,
        totalOrders: 1, // mocked count
        totalSpent: Number(c.totalSpent || 0),
        createdAt: c.createdAt.toISOString()
      })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/admin/experts", async (req, res) => {
    try {
      const allExperts = await db.select().from(experts).execute();
      res.json(allExperts.map(e => ({
        ...e,
        createdAt: e.createdAt.toISOString()
      })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
